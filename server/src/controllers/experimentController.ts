import { env } from '../config/env.js';
import { vmExperiment } from '../services/vm/experiments.js';
import { asyncHandler } from '../utils/asyncHandler.js'; import { Experiment } from '../models/Experiment.js';
const hideAnswers = (experiment: any) => { const value = env.LAB_BACKEND === 'qemu' ? vmExperiment(experiment.toObject()) : experiment.toObject(); value.quiz.questions = value.quiz.questions.map((question: any) => { delete question.correctOption; return question; }); return value; };
export const listExperiments = asyncHandler(async (_req, res) => { const experiments = await Experiment.find({ status: 'published' }).select('title slug description difficulty estimatedTimeMinutes tasks').lean(); res.json({ experiments: experiments.map(e => ({ ...e, taskCount: e.tasks.length, tasks: undefined })) }); });
export const getExperiment = asyncHandler(async (req, res) => { const experiment = await Experiment.findOne({ _id: req.params.id, status: 'published' }); if (!experiment) return res.status(404).json({ message: 'Experiment not found.' }); res.json({ experiment: hideAnswers(experiment) }); });

