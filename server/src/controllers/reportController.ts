import { pipeline } from 'node:stream/promises';
import { consistentReport, openTeacherReport as openAcademicReport, reportAvailable } from '../services/teacherAcademicService.js'; import { asyncHandler } from '../utils/asyncHandler.js'; import { Attempt } from '../models/Attempt.js'; import { Experiment } from '../models/Experiment.js'; import { Report } from '../models/Report.js'; import { generateReport } from '../services/reportService.js';
async function ownReport(id: string | string[], studentId: unknown) { return Report.findOne({ _id: String(id), studentId }); }
export const getReport = asyncHandler(async (req, res) => {
  const report = await ownReport(req.params.id, req.user!._id);
  if (!report) return res.status(404).json({ message: 'Report not found.' });
  const attempt = await Attempt.findOne({ _id: report.attemptId, studentId: req.user!._id });
  if (!attempt || !consistentReport(report, attempt)) return res.status(404).json({ message: 'Report not found.' });
  res.setHeader('Cache-Control', 'private, no-store');
  res.json({ report: { id: report._id, score: report.score, totalMarks: report.totalMarks, quizScore: report.quizScore, generatedAt: report.generatedAt, available: await reportAvailable(report) } });
});
export const generate = asyncHandler(async (req, res) => { const attempt = await Attempt.findOne({ _id: req.params.id, studentId: req.user!._id, status: 'completed' }); if (!attempt) return res.status(404).json({ message: 'Completed attempt not found.' }); const experiment = await Experiment.findById(attempt.experimentId); if (!experiment) return res.status(404).json({ message: 'Experiment not found.' }); const report = await generateReport(attempt, experiment, req.user!); res.status(201).json({ report: { id: report!._id, score: report!.score, totalMarks: report!.totalMarks } }); });
export const download = asyncHandler(async (req, res) => {
  const report = await ownReport(req.params.id, req.user!._id);
  if (!report) return res.status(404).json({ message: 'Report not found.' });
  const attempt = await Attempt.findOne({ _id: report.attemptId, studentId: req.user!._id });
  if (!attempt || !consistentReport(report, attempt)) return res.status(404).json({ message: 'Report file is unavailable.' });
  const file = await openAcademicReport(report);
  if (!file) return res.status(404).json({ message: 'Report file is unavailable.' });
  res.setHeader('Cache-Control', 'private, no-store'); res.type('application/pdf'); res.attachment(`CyberLabX-report-${report._id}.pdf`);
  try { await pipeline(file.createReadStream(), res); }
  catch { if (!res.headersSent) res.status(404).json({ message: 'Report file is unavailable.' }); else res.destroy(); }
});
