import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('../models/Attempt.js', () => ({ Attempt: { findOne: vi.fn() } }));
vi.mock('../models/LabSession.js', () => ({ LabSession: { findOne: vi.fn() } }));
vi.mock('../models/Experiment.js', () => ({ Experiment: { findById: vi.fn() } }));
vi.mock('../models/CommandLog.js', () => ({ CommandLog: { findOne: vi.fn() } }));
vi.mock('../services/vm/verification.js', () => ({ hasNmapEvidence: vi.fn(), inspectVmTask: vi.fn() }));

import { Attempt } from '../models/Attempt.js';
import { LabSession } from '../models/LabSession.js';
import { Experiment } from '../models/Experiment.js';
import { CommandLog } from '../models/CommandLog.js';
import { submitTask } from '../controllers/taskController.js';
import { hasNmapEvidence, inspectVmTask } from '../services/vm/verification.js';

const attemptId = '64b000000000000000000001';
const sessionId = '64b000000000000000000002';
const studentId = '64b000000000000000000003';

function request(body: Record<string, unknown>) {
  const req: any = { body, params: { id: 'syn-scan' }, user: { _id: studentId } };
  const res: any = {
    statusCode: 200,
    body: undefined,
    status(code: number) { this.statusCode = code; return this; },
    json(value: unknown) { this.body = value; return this; },
  };
  return { req, res, next: vi.fn() };
}

function activeAttempt() {
  return {
    _id: attemptId,
    labSessionId: sessionId,
    experimentId: '64b000000000000000000004',
    status: 'running',
    currentTaskIndex: 0,
    taskResults: [],
    score: 0,
    save: vi.fn(),
  };
}

describe('task verification evidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (LabSession.findOne as Mock).mockResolvedValue({ _id: sessionId, status: 'running' });
    (Experiment.findById as Mock).mockResolvedValue({
      tasks: [{ id: 'syn-scan', order: 1, marks: 15, verification: [{ type: 'command', tool: 'nmap', requiredArgs: ['-sS'] }] }],
    });
  });

  it('rejects browser-supplied command/output when the command was not captured by the terminal', async () => {
    (Attempt.findOne as Mock).mockResolvedValue(activeAttempt());
    (CommandLog.findOne as Mock).mockReturnValue({ sort: vi.fn().mockResolvedValue(null) });
    const { req, res, next } = request({ attemptId, command: 'nmap -sS nmap-target', output: 'forged output' });

    await (submitTask as any)(req, res, next);

    expect(res.statusCode).toBe(422);
    expect(res.body.message).toContain('Run this command');
  });

  it('awards credit only when matching server-captured command evidence exists', async () => {
    const attempt = activeAttempt();
    (Attempt.findOne as Mock).mockResolvedValue(attempt);
    const sort = vi.fn().mockResolvedValue({ command: 'nmap -sS nmap-target', stdout: 'PORT STATE SERVICE\n80/tcp open http\n' });
    (CommandLog.findOne as Mock).mockReturnValue({ sort });
    const { req, res, next } = request({ attemptId, command: 'nmap -sS nmap-target', output: 'ignored browser text' });

    await (submitTask as any)(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(res.body.result.passed).toBe(true);
    expect(attempt.currentTaskIndex).toBe(1);
    expect(CommandLog.findOne).toHaveBeenCalledWith(expect.objectContaining({ attemptId, studentId, sessionId, command: 'nmap -sS nmap-target' }));
  });

  it('does not award VM credit for a failed or incomplete scan', async () => {
    const attempt = activeAttempt();
    vi.mocked(Attempt.findOne).mockResolvedValue(attempt as any);
    vi.mocked(LabSession.findOne).mockResolvedValue({ _id: sessionId, vmAttemptId: attemptId, expiresAt: new Date(Date.now() + 60000) } as any);
    vi.mocked(CommandLog.findOne).mockReturnValue({ sort: vi.fn().mockResolvedValue({ command: 'nmap -sS nmap-target', stdout: 'requires root privileges' }) } as any);
    vi.mocked(hasNmapEvidence).mockReturnValue(false);
    const { req, res, next } = request({ attemptId, command: 'nmap -sS nmap-target' });
    await (submitTask as any)(req, res, next);
    expect(res.statusCode).toBe(422);
    expect(attempt.currentTaskIndex).toBe(0);
    expect(inspectVmTask).not.toHaveBeenCalled();
  });

  it('verifies VM evidence and live target access before using existing grading', async () => {
    const attempt = activeAttempt();
    vi.mocked(Attempt.findOne).mockResolvedValue(attempt as any);
    vi.mocked(LabSession.findOne).mockResolvedValue({ _id: sessionId, vmAttemptId: attemptId, expiresAt: new Date(Date.now() + 60000) } as any);
    vi.mocked(CommandLog.findOne).mockReturnValue({ sort: vi.fn().mockResolvedValue({ command: 'sudo nmap -sS nmap-target', stdout: 'captured output' }) } as any);
    vi.mocked(hasNmapEvidence).mockReturnValue(true);
    vi.mocked(inspectVmTask).mockResolvedValue(true);
    const { req, res, next } = request({ attemptId, command: 'sudo nmap -sS nmap-target' });
    await (submitTask as any)(req, res, next);
    expect(inspectVmTask).toHaveBeenCalledWith(sessionId, studentId);
    expect(res.body.result.passed).toBe(true);
    expect(attempt.currentTaskIndex).toBe(1);
  });
});
