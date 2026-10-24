import { useSessionStore } from '../../store/sessionStore';
import { enrollmentDate, enrollmentError, useOwnEnrollment } from '../../services/enrollment';
import { ErrorState, LoadingState } from '../common/QueryState';

export function StudentEnrollment() {
  const user = useSessionStore(state => state.user);
  return user?.role === 'student' ? <OwnEnrollment key={user.id} studentId={user.id} /> : null;
}
function OwnEnrollment({ studentId }: { studentId: string }) {
  const query = useOwnEnrollment(studentId);
  const enrollment = query.data?.enrollment;
  return <section className="panel p-5 sm:p-6 space-y-4" aria-labelledby="own-enrollment-heading">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="own-enrollment-heading" className="text-xl font-bold">Your teacher enrollment</h2><button type="button" className="button-secondary text-sm" disabled={query.isFetching} onClick={() => { void query.refetch(); }}>{query.isFetching ? 'Refreshing enrollment...' : 'Refresh enrollment'}</button></div>
    {query.isPending ? <LoadingState message="Loading your enrollment..." /> : query.isError ? <ErrorState message={enrollmentError(query.error)} onRetry={() => { void query.refetch(); }} retrying={query.isFetching} /> : !enrollment ? <div className="state-panel"><h3 className="font-bold">Not enrolled with a teacher</h3><p className="page-description mx-auto">Contact your institution or teacher to arrange enrollment. Your account and learning records remain available.</p></div> : <>
      <span className={`status-badge ${enrollment.status === 'active' ? 'status-success' : 'status-neutral'}`}>{enrollment.status === 'active' ? 'Active enrollment' : 'Inactive enrollment'}</span>
      {enrollment.teacher ? <dl className="grid gap-4 sm:grid-cols-2 text-sm"><div><dt className="label text-muted">Teacher</dt><dd className="break-words">{enrollment.teacher.firstName} {enrollment.teacher.lastName}</dd></div><div><dt className="label text-muted">Teacher email</dt><dd className="break-all">{enrollment.teacher.email}</dd></div><div><dt className="label text-muted">Enrolled on</dt><dd>{enrollmentDate(enrollment.enrolledAt)}</dd></div></dl> : <p className="text-sm">Your assigned teacher is unavailable. Contact an administrator to review this assignment.</p>}
      {enrollment.status === 'inactive' && enrollment.teacher && <p className="text-sm text-muted">This assignment is inactive. Contact your institution; it remains assigned until an authorized removal.</p>}
    </>}
    <p className="text-xs text-muted">Enrollment is managed by authorized teachers or administrators. Refresh after an assignment changes; this view does not change your account.</p>
  </section>;
}
