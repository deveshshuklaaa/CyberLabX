import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('../models/Attempt.js', () => ({ Attempt: { findOne: vi.fn() } }));
vi.mock('../models/LabSession.js', () => ({ LabSession: { findOne: vi.fn() } }));
vi.mock('../models/Experiment.js', () => ({ Experiment: { findById: vi.fn() } }));
vi.mock('../models/CommandLog.js', () => ({ CommandLog: { findOne: vi.fn() } }));

import { Attempt } from '../models/Attempt.js';
import { LabSession } from '../models/LabSession.js';
import { Experiment } from '../models/Experiment.js';
import { CommandLog } from '../models/CommandLog.js';
import { submitTask } from '../controllers/taskController.js';

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
});
