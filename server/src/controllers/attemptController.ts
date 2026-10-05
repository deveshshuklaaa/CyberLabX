import { env } from '../config/env.js';
import { vmExperiment } from '../services/vm/experiments.js';
import { asyncHandler } from '../utils/asyncHandler.js'; import { Attempt } from '../models/Attempt.js';
export const getAttempt = asyncHandler(async (req, res) => { const attempt = await Attempt.findOne({ _id: req.params.id, studentId: req.user!._id }).populate('experimentId'); if (!attempt) return res.status(404).json({ message: 'Attempt not found.' }); const experiment: any = attempt.experimentId; let publicExperiment = experiment?.toObject ? experiment.toObject() : experiment; if (publicExperiment && env.LAB_BACKEND === 'qemu') publicExperiment = vmExperiment(publicExperiment); if (publicExperiment?.quiz?.questions) publicExperiment.quiz.questions.forEach((question: any) => delete question.correctOption); res.json({ attempt: { id: attempt._id, status: attempt.status, currentTaskIndex: attempt.currentTaskIndex, score: attempt.score, experiment: publicExperiment } }); });

