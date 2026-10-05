import { LabSession } from '../../models/LabSession.js';
import { Attempt } from '../../models/Attempt.js';
import { destroyVm, getVmStatus } from './manager.js';

export async function reapStoppedVms() {
  const sessions = await LabSession.find({ vmAttemptId: { $exists: true }, status: { $in: ['running', 'stopping', 'failed'] } });
  for (const session of sessions) {
    if (session.status === 'running' && await getVmStatus(session.vmAttemptId!)) continue;
    await destroyVm(session.vmAttemptId!);
    session.status = 'failed'; session.endedAt = new Date();
    session.failureReason ||= 'Kali VM stopped unexpectedly.';
    // Clear the resource reference only after successful cleanup.
    session.vmAttemptId = undefined;
    await session.save();
    await Attempt.updateMany({ _id: session.attemptId, status: 'running' }, { $set: { status: 'failed', completedAt: new Date() } });
  }
}
