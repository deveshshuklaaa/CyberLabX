import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('../config/env.js', () => ({ env: { LAB_TTL_MINUTES: 45 } }));
vi.mock('../models/Experiment.js', () => ({ Experiment: { findOne: vi.fn() } }));
vi.mock('../models/Attempt.js', () => ({ Attempt: { create: vi.fn() } }));
vi.mock('../models/LabSession.js', () => ({ LabSession: { findOne: vi.fn(), create: vi.fn() } }));
vi.mock('../services/labEngine.js', () => ({ assertDockerReady: vi.fn(), cleanupLab: vi.fn(), inspectLab: vi.fn(), provisionLab: vi.fn(), resolveLabDefinition: vi.fn() }));

import { Experiment } from '../models/Experiment.js';
import { Attempt } from '../models/Attempt.js';
import { LabSession } from '../models/LabSession.js';
import { assertDockerReady, provisionLab, resolveLabDefinition } from '../services/labEngine.js';
import { startLab } from '../controllers/labController.js';

const lab = {
  profile: 'shell-target-v1', studentImageKey: 'kali-nmap',
  target: { imageKey: 'nmap-http-target', hostname: 'nmap-target', displayName: 'Controlled Nmap target' },
  terminal: { promptLabel: 'kali@student-lab' },
} as const;

describe('startLab experiment lab metadata', () => {
  beforeEach(() => vi.clearAllMocks());

  it('provisions from the experiment-owned definition and returns its display metadata', async () => {
    const session: any = {
      _id: 'session-1', status: 'provisioning', expiresAt: new Date(),
      save: vi.fn().mockResolvedValue(undefined),
    };
    const attempt: any = { _id: 'attempt-1', save: vi.fn().mockResolvedValue(undefined) };
    (Experiment.findOne as Mock).mockResolvedValue({ _id: 'experiment-1', lab });
    (LabSession.findOne as Mock).mockResolvedValue(null);
    (LabSession.create as Mock).mockResolvedValue(session);
    (Attempt.create as Mock).mockResolvedValue(attempt);
    (assertDockerReady as Mock).mockResolvedValue(undefined);
    (provisionLab as Mock).mockResolvedValue({ networkName: 'network-1', targetIp: '172.20.0.2' });

    const req: any = { body: { experimentId: 'experiment-1' }, user: { _id: 'student-1' } };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await (startLab as any)(req, res, vi.fn());

    expect(provisionLab).toHaveBeenCalledWith(expect.objectContaining({ lab }));
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      labSession: expect.objectContaining({
        targetHostname: lab.target.hostname,
        targetDisplayName: lab.target.displayName,
        terminalPrompt: lab.terminal.promptLabel,
      }),
    }));
  });

  it('returns a clear conflict for a legacy experiment without a lab definition', async () => {
    (Experiment.findOne as Mock).mockResolvedValue({ _id: 'experiment-legacy', lab: undefined });
    (LabSession.findOne as Mock).mockResolvedValue(null);
    (resolveLabDefinition as Mock).mockImplementation(() => { throw new Error('Experiment is missing a valid lab definition. Run the experiment data migration before starting this lab.'); });
    const req: any = { body: { experimentId: 'experiment-legacy' }, user: { _id: 'student-1' } };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await (startLab as any)(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('missing a valid lab definition') }));
    expect(assertDockerReady).not.toHaveBeenCalled();
    expect(Attempt.create).not.toHaveBeenCalled();
  });
});
