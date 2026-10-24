import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Mock config/env BEFORE importing code under test                  */
/* ------------------------------------------------------------------ */
vi.mock('../config/env.js', () => ({
    env: {
        JWT_SECRET: 'test-secret-that-is-long-enough',
        LAB_MEMORY_MB: 512,
        LAB_CPU_NANOS: 500000000,
        LAB_NETWORK_PREFIX: 'cyberlabx-lab',
        LAB_IMAGE: 'cyberlabx-kali:latest',
        TARGET_IMAGE: 'cyberlabx-target:latest',
        REPORT_DIR: './reports',
        LAB_TTL_MINUTES: 45,
        CLIENT_URL: 'http://localhost:5173',
        BCRYPT_ROUNDS: 10,
        JWT_EXPIRES_IN: '7d',
        SERVER_PORT: 5000,
        MONGO_URI: 'mongodb://localhost:27017/test',
    },
    isProduction: false,
}));

/* ------------------------------------------------------------------ */
/*  Mock Mongoose models BEFORE importing code under test             */
/* ------------------------------------------------------------------ */
vi.mock('../models/Attempt.js', () => ({
    Attempt: {
        findOne: vi.fn(),
        updateMany: vi.fn(),
    },
}));
vi.mock('../models/Experiment.js', () => ({
    Experiment: { findById: vi.fn() },
}));
vi.mock('../models/LabSession.js', () => ({
    LabSession: { findOne: vi.fn() },
}));
vi.mock('../models/Report.js', () => ({
    Report: {
        findOne: vi.fn(),
        findOneAndUpdate: vi.fn(),
    },
}));
vi.mock('../models/User.js', () => ({
    User: { findById: vi.fn() },
}));

vi.mock('../services/reportService.js', () => ({
    generateReport: vi.fn(),
}));
vi.mock('../services/labEngine.js', () => ({
    cleanupLab: vi.fn(),
}));

import { Attempt } from '../models/Attempt.js';
import { Experiment } from '../models/Experiment.js';
import { LabSession } from '../models/LabSession.js';
import { generateReport } from '../services/reportService.js';
import { cleanupLab } from '../services/labEngine.js';

/* ------------------------------------------------------------------ */
/*  We directly test the controller-level quiz logic by calling it    */
/*  with mocked req/res objects.                                      */
/* ------------------------------------------------------------------ */
import { submitQuiz } from '../controllers/quizController.js';

/* Helper to build Express-like req/res */
function mockReqRes(body: Record<string, unknown>, userId = 'student-1') {
    const user: any = { _id: userId, firstName: 'Demo', lastName: 'Student' };
    const req: any = { body, user, params: { id: '64b000000000000000000004' }, cookies: {} };
    const res: any = {
        statusCode: 200,
        body: null as any,
        status(code: number) { res.statusCode = code; return res; },
        json(data: any) { res.body = data; return res; },
    };
    const next = vi.fn();
    return { req, res, next };
}

/* Experiment fixture */
const experimentFixture: any = {
    _id: '64b000000000000000000004',
    tasks: [
        { id: 't1', marks: 10, order: 1, verification: [] },
    ],
    quiz: {
        questions: [
            { id: 'q1', correctOption: 0, marks: 5, explanation: 'Correct.' },
            { id: 'q2', correctOption: 2, marks: 5, explanation: 'Also correct.' },
        ],
    },
};
const attemptId = '64b000000000000000000001';

/* Attempt fixture — tasks completed */
function makeAttempt() {
    return {
        _id: attemptId,
        studentId: 'student-1',
        experimentId: '64b000000000000000000004',
        labSessionId: 'session-1',
        status: 'running',
        currentTaskIndex: 1, // all tasks done
        taskResults: [{ taskId: 't1', passed: true, score: 10, submittedAt: new Date() }],
        quizResult: undefined as any,
        score: 10,
        completedAt: undefined as Date | undefined,
        save: vi.fn(),
    };
}

describe('submitQuiz — lab completion flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('retains a retryable VM cleanup state after completion when shutdown fails', async () => {
        const attempt = makeAttempt();
        (Attempt.findOne as Mock).mockResolvedValue(attempt);
        (Experiment.findById as Mock).mockReturnValue({ select: vi.fn().mockResolvedValue(experimentFixture) });
        (generateReport as Mock).mockResolvedValue({ _id: 'report-1' });
        const session: any = { _id: 'session', vmAttemptId: 'vm', status: 'running', save: vi.fn() };
        (LabSession.findOne as Mock).mockResolvedValue(session);
        (cleanupLab as Mock).mockRejectedValue(new Error('VM still running'));
        const { req, res, next } = mockReqRes({ attemptId, answers: [] });
        await (submitQuiz as any)(req, res, next);
        expect(attempt.status).toBe('completed');
        expect(res.body.reportId).toBe('report-1');
        expect(session.status).toBe('stopping');
        expect(session.vmAttemptId).toBe('vm');
        expect(session.endedAt).toBeUndefined();
    });

    it('calculates score, generates report, cleans up lab, returns reportId', async () => {
        const attempt = makeAttempt();
        (Attempt.findOne as Mock).mockResolvedValue(attempt);
        (Experiment.findById as Mock).mockReturnValue({ select: vi.fn().mockResolvedValue(experimentFixture) });
        (generateReport as Mock).mockResolvedValue({ _id: 'report-1', score: 15, totalMarks: 20 });
        const session: any = { _id: 'session-1', attemptId, status: 'running', save: vi.fn() };
        (LabSession.findOne as Mock).mockResolvedValue(session);
        (cleanupLab as Mock).mockResolvedValue(undefined);

        const { req, res, next } = mockReqRes({
            attemptId,
            answers: [
                { questionId: 'q1', selectedOption: 0 },
                { questionId: 'q2', selectedOption: 2 },
            ],
        });

        await (submitQuiz as any)(req, res, next);

        // Score calculation
        expect(attempt.score).toBe(20); // 10 tasks + 10 quiz
        expect(attempt.status).toBe('completed');
        expect(attempt.completedAt).toBeDefined();
        expect(attempt.save).toHaveBeenCalled();

        // Report generated
        expect(generateReport).toHaveBeenCalledOnce();
        expect(res.body.reportId).toBe('report-1');
        expect(res.body.downloadUrl).toBe('/api/reports/report-1/download');

        // Lab cleaned up
        expect(cleanupLab).toHaveBeenCalledWith(session);
        expect(session.status).toBe('stopped');
        expect(session.save).toHaveBeenCalled();
    });

    it('still completes attempt and cleans up if report generation fails', async () => {
        const attempt = makeAttempt();
        (Attempt.findOne as Mock).mockResolvedValue(attempt);
        (Experiment.findById as Mock).mockReturnValue({ select: vi.fn().mockResolvedValue(experimentFixture) });
        (generateReport as Mock).mockRejectedValue(new Error('PDF engine crash'));
        const session: any = { _id: 'session-1', attemptId, status: 'running', save: vi.fn() };
        (LabSession.findOne as Mock).mockResolvedValue(session);
        (cleanupLab as Mock).mockResolvedValue(undefined);

        const { req, res, next } = mockReqRes({
            attemptId,
            answers: [{ questionId: 'q1', selectedOption: 0 }, { questionId: 'q2', selectedOption: 1 }],
        });

        await (submitQuiz as any)(req, res, next);

        // Attempt still completed
        expect(attempt.status).toBe('completed');
        expect(attempt.save).toHaveBeenCalled();

        // Report is null but error message present
        expect(res.body.reportId).toBeNull();
        expect(res.body.reportError).toBeTruthy();

        // Lab still cleaned up
        expect(cleanupLab).toHaveBeenCalled();
        expect(session.status).toBe('stopped');
    });

    it('returns 409 if tasks not completed', async () => {
        const attempt = makeAttempt();
        attempt.currentTaskIndex = 0; // tasks not done
        (Attempt.findOne as Mock).mockResolvedValue(attempt);
        (Experiment.findById as Mock).mockReturnValue({ select: vi.fn().mockResolvedValue(experimentFixture) });

        const { req, res, next } = mockReqRes({
            attemptId,
            answers: [],
        });

        await (submitQuiz as any)(req, res, next);

        expect(res.statusCode).toBe(409);
        expect(generateReport).not.toHaveBeenCalled();
        expect(cleanupLab).not.toHaveBeenCalled();
    });
});
