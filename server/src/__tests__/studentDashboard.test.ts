import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('../models/Attempt.js', () => ({ Attempt: { aggregate: vi.fn() } }));
vi.mock('../models/Experiment.js', () => ({ Experiment: { countDocuments: vi.fn() } }));
vi.mock('../models/User.js', () => ({ User: { countDocuments: vi.fn() } }));
vi.mock('../models/Report.js', () => ({ Report: { countDocuments: vi.fn() } }));
vi.mock('../models/AuditEvent.js', () => ({ AuditEvent: { find: vi.fn() } }));
vi.mock('../config/env.js', () => ({ env: { JWT_SECRET: 'test-secret-that-is-long-enough' } }));

import { Attempt } from '../models/Attempt.js';
import { Experiment } from '../models/Experiment.js';
import { studentDashboard, studentHistory } from '../controllers/dashboardController.js';
import { requireAuth } from '../middleware/auth.js';

function request(userId = 'student-a') {
  const req: any = { user: { _id: userId, role: 'student' } };
  const res: any = { body: undefined, setHeader: vi.fn(), json(value: unknown) { this.body = value; return this; } };
  return { req, res, next: vi.fn() };
}

describe('student dashboard aggregation', () => {
  beforeEach(() => { vi.clearAllMocks(); (Experiment.countDocuments as Mock).mockResolvedValue(3); });

  it('returns distinct completion statistics and safe recent attempt fields', async () => {
    (Attempt.aggregate as Mock).mockResolvedValue([{
      attempted: [{ count: 2 }],
      publishedCompleted: [{ count: 1 }], completedScores: [{ count: 2, averageScore: 96.5, bestScore: 100 }],
      recentAttempts: [{ attemptId: 'attempt-2', experimentId: 'experiment-2', experimentTitle: 'Controlled DoS Attack Simulation & Traffic Analysis', status: 'completed', score: 100, startedAt: new Date('2026-08-16'), completedAt: new Date('2026-08-16'), report: [{ _id: 'report-2', attemptId: 'attempt-2', studentId: 'student-a', experimentId: 'experiment-2', score: 100, totalMarks: 100, quizScore: 0, generatedAt: new Date(), filePath: 'unavailable.pdf' }] }, { attemptId: 'attempt-1', experimentId: 'experiment-1', experimentTitle: 'Network Mapping using Nmap', status: 'running', score: null, startedAt: new Date('2026-08-15'), reportId: null }],
    }]);
    const { req, res, next } = request();
    await (studentDashboard as any)(req, res, next);
    expect(res.body.stats).toEqual({ totalExperiments: 3, publishedExperimentsCompleted: 1, experimentsAttempted: 2, experimentsCompleted: 2, averageScore: 97, bestScore: 100 });
    expect(res.body.recentAttempts).toEqual(expect.arrayContaining([expect.objectContaining({ attemptId: 'attempt-2', reportAvailable: false, reportId: 'report-2' }), expect.objectContaining({ attemptId: 'attempt-1', score: null, reportAvailable: false })]));
    expect(JSON.stringify(res.body)).not.toContain('containerId');
    expect(JSON.stringify(res.body)).not.toContain('filePath');
  });

  it('returns zero statistics and no recent attempts for a clean student', async () => {
    (Attempt.aggregate as Mock).mockResolvedValue([{}]);
    const { req, res, next } = request();
    await (studentDashboard as any)(req, res, next);
    expect(res.body).toEqual({ scoreUnit: 'points', stats: { totalExperiments: 3, publishedExperimentsCompleted: 0, experimentsAttempted: 0, experimentsCompleted: 0, averageScore: 0, bestScore: 0 }, recentAttempts: [] });
  });

  it('matches only the authenticated student and limits recent attempts server-side', async () => {
    (Attempt.aggregate as Mock).mockResolvedValue([{}]);
    const { req, res, next } = request('student-a');
    await (studentDashboard as any)(req, res, next);
    const pipeline = (Attempt.aggregate as Mock).mock.calls[0][0];
    expect(pipeline[0]).toEqual({ $match: { studentId: 'student-a' } });
    expect(JSON.stringify(pipeline)).toContain('"$limit":5');
    expect(JSON.stringify(pipeline)).toContain('"$match":{"status":"completed"}');
  });
});

describe('student dashboard authentication', () => {
  it('rejects an unauthenticated request before dashboard aggregation', async () => {
    vi.clearAllMocks();
    const req: any = { cookies: {} }; const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await (requireAuth as any)(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(Attempt.aggregate).not.toHaveBeenCalled();
  });
});

describe('student history aggregation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('scopes history query strictly to the authenticated student', async () => {
    (Attempt.aggregate as Mock).mockResolvedValue([
      { attemptId: 'att-1', experimentId: 'exp-1', experimentTitle: 'Nmap', experimentCategory: 'Security', status: 'completed', score: 95, startedAt: new Date(), completedAt: new Date(), report: [{ _id: 'rep-1', attemptId: 'att-1', studentId: 'student-xyz', experimentId: 'exp-1', score: 95, totalMarks: 100, quizScore: 0, generatedAt: new Date(), filePath: 'unavailable.pdf' }] },
    ]);
    const { req, res, next } = request('student-xyz');
    await (studentHistory as any)(req, res, next);
    const pipeline = (Attempt.aggregate as Mock).mock.calls[0][0];
    expect(pipeline[0]).toEqual({ $match: { studentId: 'student-xyz' } });
    expect(res.body.attempts).toHaveLength(1);
    expect(res.body.attempts[0].reportAvailable).toBe(false);
    expect(res.body.attempts[0].reportId).toBe('rep-1');
  });
});

