import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { Attempt } from '../models/Attempt.js';
import { Experiment } from '../models/Experiment.js';
import { LabSession } from '../models/LabSession.js';
import { assertLabReady, labBackend, cleanupLab, inspectLab, provisionLab, resolveLabDefinition } from '../services/labEngine.js';
import { env } from '../config/env.js';

function sessionResponse(session: { _id: unknown; backend?: string; vmAttemptId?: string; attemptId?: unknown; status: string; targetIp?: string; targetHostname?: string; targetDisplayName?: string; terminalPrompt?: string; resources?: unknown[]; expiresAt: Date; failureReason?: string }) {
  return {
    id: session._id,
    backend: session.vmAttemptId ? 'qemu' : session.backend ?? 'docker',
    attemptId: session.attemptId,
    status: session.status,
    targetIp: session.targetIp,
    targetHostname: session.targetHostname,
    targetDisplayName: session.targetDisplayName,
    terminalPrompt: session.terminalPrompt,
    resources: session.resources,
    expiresAt: session.expiresAt,
    failureReason: session.failureReason,
  };
}

export const startLab = asyncHandler(async (req, res) => {
  const { experimentId } = z.object({ experimentId: z.string().min(1) }).parse(req.body);
  const experiment = await Experiment.findOne({ _id: experimentId, status: 'published' });
  if (!experiment) return res.status(404).json({ message: 'Experiment not found.' });

  const active = await LabSession.findOne({ studentId: req.user!._id, status: { $in: ['provisioning', 'running', 'stopping'] } });
  if (active) return res.status(409).json({ message: 'You already have an active lab session.', labSessionId: active._id });

  try {
    resolveLabDefinition(experiment.lab);
  } catch (error) {
    return res.status(409).json({ message: error instanceof Error ? error.message : 'Experiment lab definition is invalid.' });
  }

  await assertLabReady(experiment.lab);
  const backend = labBackend(experiment.lab);
  const attempt = await Attempt.create({ studentId: req.user!._id, experimentId: experiment._id, status: 'running' });
  // Persist the VM reference before spawn so restart/failure recovery can find it.
  const session = await LabSession.create({ attemptId: attempt._id, studentId: req.user!._id, backend, ...(backend === 'qemu' ? { vmAttemptId: String(attempt._id) } : {}), status: 'provisioning', expiresAt: new Date(Date.now() + env.LAB_TTL_MINUTES * 60 * 1000) });

  try {
    const lab = await provisionLab({ attemptId: String(attempt._id), studentId: String(req.user!._id), lab: experiment.lab, expiresAt: session.expiresAt });
    Object.assign(session, lab, {
      status: 'running',
      targetHostname:
        experiment.lab.profile === 'shell-target-v1' || experiment.lab.profile === 'recon-v1'
          ? experiment.lab.target.hostname
          : experiment.lab.profile === 'dos-analysis-v1'
            ? 'victim'
            : undefined,
      targetDisplayName:
        experiment.lab.profile === 'shell-target-v1' || experiment.lab.profile === 'recon-v1'
          ? experiment.lab.target.displayName
          : experiment.lab.profile === 'dos-analysis-v1'
            ? 'Controlled HTTP victim'
            : 'Internal Forensic Sandbox',
      terminalPrompt: backend === 'qemu' ? 'student@somaiya:~$' : experiment.lab.terminal.promptLabel,
      terminalUser: experiment.lab.profile === 'dos-analysis-v1' ? 'student' : undefined,
      startedAt: new Date(),
      lastHeartbeatAt: new Date(),
    });
    await session.save();
    attempt.labSessionId = session._id;
    await attempt.save();
    res.status(201).json({ labSession: sessionResponse(session), attemptId: attempt._id });
  } catch (error) {
    // Preserve failed VM metadata for the reaper if cleanup itself fails.
    await cleanupLab(session).catch(cleanupError => console.error('Provisioning cleanup failed; recovery retained.', cleanupError));
    session.status = 'failed';
    session.failureReason = error instanceof Error ? error.message : 'Lab provisioning failed.';
    await session.save();
    attempt.status = 'failed';
    await attempt.save();
    throw error;
  }
});

export const getLab = asyncHandler(async (req, res) => {
  const session = await LabSession.findOne({ _id: req.params.id, studentId: req.user!._id });
  if (!session) return res.status(404).json({ message: 'Lab session not found.' });
  if (session.status === 'running' && session.expiresAt <= new Date()) {
    await cleanupLab(session);
    session.status = 'expired';
    session.endedAt = new Date();
    await session.save();
    await Attempt.updateMany({ _id: session.attemptId, status: 'running' }, { $set: { status: 'expired', completedAt: new Date() } });
  }
  const running = session.status === 'running' && await inspectLab(session);
  if (!running && session.status === 'running') {
    session.status = 'failed';
    session.failureReason = 'The lab environment is no longer running.';
    await session.save();
    await cleanupLab(session);
    await Attempt.updateMany({ _id: session.attemptId, status: 'running' }, { $set: { status: 'failed', completedAt: new Date() } });
  }
  res.json({ labSession: sessionResponse(session) });
});

export const stopLab = asyncHandler(async (req, res) => {
  const session = await LabSession.findOne({ _id: req.params.id, studentId: req.user!._id });
  if (!session) return res.status(404).json({ message: 'Lab session not found.' });
  if (['stopped', 'expired'].includes(session.status)) return res.status(204).send();
  session.status = 'stopping';
  await session.save();
  await cleanupLab(session);
  session.status = 'stopped';
  session.endedAt = new Date();
  await session.save();
  res.status(204).send();
});
