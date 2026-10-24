import { LabSession } from '../../models/LabSession.js';
import { Attempt } from '../../models/Attempt.js';
import { getVm } from './manager.js';

/** Shared by terminal and desktop; endpoints are never accepted from a browser. */
export async function authorizeVm(sessionId: string, studentId: string) {
  if (!/^[a-f\d]{24}$/i.test(sessionId)) throw new Error('Invalid lab session.');
  const session = await LabSession.findOne({ _id: sessionId, studentId, status: 'running', expiresAt: { $gt: new Date() } });
  if (!session?.vmAttemptId || session.vmAttemptId !== String(session.attemptId)) throw new Error('VM session unavailable.');
  const attempt = await Attempt.findOne({ _id: session.attemptId, studentId, status: 'running' });
  if (!attempt) throw new Error('Active attempt required.');
  const vm = await getVm(session.vmAttemptId);
  if (vm.studentId !== studentId || vm.attemptId !== String(attempt._id) || vm.state !== 'running' || Date.parse(vm.expiresAt) <= Date.now()) throw new Error('VM ownership or expiry mismatch.');
  return { vm, session };
}
