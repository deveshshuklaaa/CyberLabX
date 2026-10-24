import { asyncHandler } from '../utils/asyncHandler.js'; import { Attempt } from '../models/Attempt.js'; import { User } from '../models/User.js'; import { Report } from '../models/Report.js'; import { Experiment } from '../models/Experiment.js'; import { AuditEvent } from '../models/AuditEvent.js';
export const facultyDashboard = asyncHandler(async (req, res) => {
  const faculty = req.user!.role === 'faculty';
  const studentScope = faculty ? { studentId: { $in: (await User.find({ role: 'student', teacherId: req.user!._id }).select('_id').lean()).map(student => student._id) } } : {};
  const completedScope = { ...studentScope, status: 'completed' };
  const [students, completed, scores, reports] = await Promise.all([
    User.countDocuments({ role: 'student', isActive: true, ...(faculty ? { teacherId: req.user!._id } : {}) }),
    Attempt.countDocuments(completedScope),
    Attempt.aggregate([{ $match: completedScope }, { $group: { _id: null, average: { $avg: '$score' } } }]),
    Report.countDocuments(studentScope),
  ]);
  res.json({ metrics: { students, completedAttempts: completed, averageScore: Math.round(scores[0]?.average ?? 0), reports } });
});
export const adminDashboard = asyncHandler(async (_req, res) => { const [users, activeStudents, attempts, events] = await Promise.all([User.countDocuments(), User.countDocuments({ role: 'student', isActive: true }), Attempt.countDocuments(), AuditEvent.find().select('_id action userId resourceType resourceId createdAt').sort({ createdAt: -1, _id: -1 }).limit(20).lean()]); res.json({ metrics: { users, activeStudents, attempts }, events }); });

/** Read-only academic progress view. Scores and completion states remain owned by Attempt. */
export const studentDashboard = asyncHandler(async (req, res) => {
  const [totalExperiments, aggregate] = await Promise.all([
    Experiment.countDocuments({ status: 'published' }),
    Attempt.aggregate([
      { $match: { studentId: req.user!._id } },
      {
        $facet: {
          attempted: [{ $group: { _id: '$experimentId' } }, { $count: 'count' }],
          completedScores: [
            { $match: { status: 'completed' } },
            { $group: { _id: '$experimentId', score: { $max: '$score' } } },
            { $group: { _id: null, count: { $sum: 1 }, averageScore: { $avg: '$score' }, bestScore: { $max: '$score' } } },
          ],
          recentAttempts: [
            { $sort: { startedAt: -1, _id: -1 } }, { $limit: 5 },
            { $lookup: { from: 'experiments', localField: 'experimentId', foreignField: '_id', as: 'experiment' } },
            { $unwind: { path: '$experiment', preserveNullAndEmptyArrays: true } },
            { $lookup: { from: 'reports', let: { attemptId: '$_id' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$attemptId', '$$attemptId'] }, { $eq: ['$studentId', req.user!._id] }] } } }, { $project: { _id: 1 } }], as: 'report' } },
            {
              $project: {
                _id: 0, attemptId: '$_id', experimentId: '$experimentId', experimentTitle: '$experiment.title', status: 1,
                score: { $cond: [{ $eq: ['$status', 'completed'] }, '$score', null] }, startedAt: 1, completedAt: 1,
                reportId: { $cond: [{ $gt: [{ $size: '$report' }, 0] }, { $arrayElemAt: ['$report._id', 0] }, null] },
              },
            },
          ],
        },
      },
    ]),
  ]);
  const data = aggregate[0] ?? {};
  const completed = data.completedScores?.[0] ?? {};
  res.json({
    stats: {
      totalExperiments,
      experimentsAttempted: data.attempted?.[0]?.count ?? 0,
      experimentsCompleted: completed.count ?? 0,
      averageScore: Math.round(completed.averageScore ?? 0),
      bestScore: completed.bestScore ?? 0,
    },
    recentAttempts: (data.recentAttempts ?? []).map((attempt: { reportId?: unknown; [key: string]: unknown }) => ({
      ...attempt, reportAvailable: Boolean(attempt.reportId), reportId: attempt.reportId ? String(attempt.reportId) : undefined,
    })),
  });
});

/** Full authenticated student attempt history. Scoped strictly to studentId. */
export const studentHistory = asyncHandler(async (req, res) => {
  const attempts = await Attempt.aggregate([
    { $match: { studentId: req.user!._id } },
    { $sort: { startedAt: -1, _id: -1 } },
    { $lookup: { from: 'experiments', localField: 'experimentId', foreignField: '_id', as: 'experiment' } },
    { $unwind: { path: '$experiment', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'reports', let: { attemptId: '$_id' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$attemptId', '$$attemptId'] }, { $eq: ['$studentId', req.user!._id] }] } } }, { $project: { _id: 1 } }], as: 'report' } },
    {
      $project: {
        _id: 0,
        attemptId: '$_id',
        experimentId: '$experimentId',
        experimentTitle: '$experiment.title',
        experimentCategory: '$experiment.category',
        status: 1,
        score: { $cond: [{ $eq: ['$status', 'completed'] }, '$score', null] },
        startedAt: 1,
        completedAt: 1,
        reportId: { $cond: [{ $gt: [{ $size: '$report' }, 0] }, { $arrayElemAt: ['$report._id', 0] }, null] },
      },
    },
  ]);

  res.json({
    attempts: attempts.map((attempt: { reportId?: unknown; [key: string]: unknown }) => ({
      ...attempt,
      reportAvailable: Boolean(attempt.reportId),
      reportId: attempt.reportId ? String(attempt.reportId) : undefined,
    })),
  });
});

