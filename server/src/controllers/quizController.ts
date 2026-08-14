import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { Attempt } from '../models/Attempt.js';
import { Experiment } from '../models/Experiment.js';
import { LabSession } from '../models/LabSession.js';
import { generateReport } from '../services/reportService.js';
import { cleanupLab } from '../services/labEngine.js';

export const submitQuiz = asyncHandler(async (req, res) => {
    const experimentId = z.string().regex(/^[a-f\d]{24}$/i).parse(req.params.id);
    const input = z.object({
        attemptId: z.string().regex(/^[a-f\d]{24}$/i),
        answers: z.array(z.object({
            questionId: z.string(),
            selectedOption: z.number().int().min(0).max(10),
        })).max(50),
    }).parse(req.body);

    const attempt = await Attempt.findOne({
        _id: input.attemptId,
        studentId: req.user!._id,
        status: 'running',
    });
    if (!attempt) return res.status(404).json({ message: 'Active attempt not found.' });

    const experiment = await Experiment.findById(attempt.experimentId)
        .select('+quiz.questions.correctOption');
    if (!experiment) return res.status(404).json({ message: 'Experiment not found.' });
    if (String(experiment._id) !== experimentId) return res.status(404).json({ message: 'Experiment not found.' });

    if (attempt.currentTaskIndex < experiment.tasks.length) {
        return res.status(409).json({ message: 'Complete the guided tasks before the quiz.' });
    }

    /* ── Step 1: Calculate final score ─────────────────────────── */
    const answers = experiment.quiz.questions.map(question => ({
        question,
        selectedOption: input.answers.find(a => a.questionId === question.id)?.selectedOption ?? -1,
    }));

    const quizScore = answers.reduce(
        (sum, a) => sum + (a.selectedOption === a.question.correctOption ? a.question.marks : 0), 0,
    );
    const quizTotalMarks = experiment.quiz.questions.reduce((sum, q) => sum + q.marks, 0);

    /* ── Step 2: Finalize the Attempt ──────────────────────────── */
    attempt.quizResult = {
        score: quizScore,
        totalMarks: quizTotalMarks,
        answers: input.answers,
        submittedAt: new Date(),
    };
    attempt.score = attempt.taskResults.reduce((sum, item) => sum + item.score, 0) + quizScore;
    attempt.status = 'completed';
    attempt.completedAt = new Date();
    await attempt.save();

    /* ── Step 3 & 4: Generate PDF report (retryable) ───────────── */
    let reportId: string | null = null;
    let downloadUrl: string | null = null;
    let reportError: string | null = null;

    try {
        const report = await generateReport(attempt, experiment, req.user!);
        if (report) {
            reportId = String(report._id);
            downloadUrl = `/api/reports/${reportId}/download`;
        }
    } catch (err) {
        // Report generation failed — educational data is already saved.
        // The student can retry via POST /api/reports/attempts/:attemptId/generate
        reportError = 'Report generation failed. You can retry from your dashboard.';
        console.error('Report generation failed for attempt', attempt._id, err);
    }

    /* ── Steps 6-8: Cleanup Docker resources ───────────────────── */
    const session = await LabSession.findOne({
        attemptId: attempt._id,
        studentId: req.user!._id,
    });

    if (session && !['stopped', 'expired'].includes(session.status)) {
        try {
            await cleanupLab(session);
        } catch (cleanupErr) {
            // Cleanup is best-effort; removeQuietly inside already swallows errors
            console.error('Lab cleanup warning for session', session._id, cleanupErr);
        }
        session.status = 'stopped';
        session.endedAt = new Date();
        await session.save();
    }

    /* ── Step 5: Return results ────────────────────────────────── */
    res.json({
        score: quizScore,
        totalMarks: quizTotalMarks,
        totalScore: attempt.score,
        reportId,
        downloadUrl,
        reportError,
        answers: answers.map(({ question, selectedOption }) => ({
            questionId: question.id,
            selectedOption,
            correct: selectedOption === question.correctOption,
            explanation: question.explanation,
        })),
    });
});
