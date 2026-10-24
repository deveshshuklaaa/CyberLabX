import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSessionStore } from '../../store/sessionStore';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { api } from '../../services/api';
import { adminError, useRefreshAdmin } from '../../services/adminManagement';
import type { AdminUser } from '../../services/adminManagement';
import type { EnrollmentSelector, StudentList, StudentDetail } from '../../services/enrollment';
import { enrollmentDate } from '../../services/enrollment';
import { LoadingState, ErrorState } from '../common/QueryState';
import { AcademicPagination } from '../faculty/AcademicControls';

export function AdminTeacherCohort(props: { adminId: string; teacher: AdminUser }) {
  const user = useSessionStore(state => state.user);
  return user?.role === 'admin' ? <TeacherCohort key={props.teacher.id} {...props} /> : null;
}
function TeacherCohort({ adminId, teacher }: { adminId: string; teacher: AdminUser }) {
  const [page, setPage] = useState(1), [selected, setSelected] = useState<string | null>(null);
  const [by, setBy] = useState<'email' | 'studentId'>('email'), [value, setValue] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const base = `/admin/teachers/${teacher.id}/students`, refresh = useRefreshAdmin();
  const query = useQuery({ queryKey: ['admin-cohort', adminId, teacher.id, page], retry: false, queryFn: async () => {
    const { data } = await api.get<StudentList>(base, { params: { page, limit: 10 } });
    if (!Array.isArray(data?.students) || !data.pagination) throw new Error('Invalid cohort response.'); return data;
  } });
  const enroll = useMutation({ mutationFn: (input: EnrollmentSelector) => api.post(base, input), onSuccess: async () => { setValue(''); setSelected(null); setNotice('Student enrolled with the selected teacher.'); await refresh(); } });
  const submit = (event: FormEvent) => {
    event.preventDefault(); if (enroll.isPending || !teacher.isActive) return;
    const input = value.trim(); setNotice(''); enroll.reset();
    if (by === 'studentId' ? !/^[a-f\d]{24}$/i.test(input) : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input) || input.length > 254) { setError(by === 'studentId' ? 'Enter an exact 24-character student ID.' : 'Enter an exact student email address.'); return; }
    setError(''); enroll.mutate(by === 'email' ? { email: input.toLowerCase() } : { studentId: input });
  };
  return <section aria-label="Selected teacher cohort" className="border-t border-line pt-5 space-y-4">
    <h4 className="font-bold">Selected teacher cohort</h4><p className="text-sm break-words">Teacher: {teacher.firstName} {teacher.lastName}</p><p className="text-xs text-muted break-all">Teacher ID: {teacher.id}. Admin actions always use this explicit teacher scope.</p>
    {!teacher.isActive && <p className="state-panel text-sm">This teacher is inactive. Existing assignments can be reviewed or removed; new enrollment is disabled.</p>}
    <form aria-label="Admin enroll existing student" onSubmit={submit} className="rounded-lg border border-line p-4 space-y-3" noValidate><fieldset disabled={!teacher.isActive || enroll.isPending} className="space-y-3"><legend className="font-semibold">Assign an existing student</legend>
      <div><label className="label" htmlFor="admin-cohort-by">Cohort student identifier</label><select id="admin-cohort-by" className="field" value={by} onChange={e => { setBy(e.target.value as 'email' | 'studentId'); setValue(''); setError(''); enroll.reset(); }}><option value="email">Exact email</option><option value="studentId">Student ID</option></select></div>
      <div><label className="label" htmlFor="admin-cohort-value">{by === 'email' ? 'Existing student email' : 'Existing student ID'}</label><input id="admin-cohort-value" className="field" type={by === 'email' ? 'email' : 'text'} maxLength={by === 'email' ? 254 : 24} value={value} onChange={e => { setValue(e.target.value); setError(''); enroll.reset(); }} /></div>
      <p className="text-xs text-muted">Uses exactly one identifier. An existing assignment must be explicitly released before another teacher can enroll the student. This action creates no accounts.</p><button className="button" type="submit">{enroll.isPending ? 'Assigning student...' : 'Enroll with selected teacher'}</button>
    </fieldset>{error && <p role="alert" className="text-sm text-danger">{error}</p>}{enroll.isError && <p role="alert" className="error-panel text-sm">{adminError(enroll.error)} Enrollment was not confirmed. Refresh the cohort before retrying.</p>}</form>
    {notice && <p role="status" className="state-panel">{notice}</p>}
    <button className="button-secondary" disabled={query.isFetching || enroll.isPending} onClick={() => { setSelected(null); void query.refetch(); }}>Refresh teacher cohort</button>
    {query.isPending ? <LoadingState message="Loading selected teacher cohort..." /> : query.isError ? <ErrorState message={adminError(query.error)} onRetry={() => { void query.refetch(); }} retrying={query.isFetching} /> : <>
      {!query.data.students.length ? <p className="state-panel">No students assigned to this teacher.</p> : <ul aria-label="Admin teacher students" className="grid gap-4 md:grid-cols-2">{query.data.students.map(row => <li key={row.student.id} className="rounded-lg border border-line p-4 space-y-3 min-w-0"><h5 className="font-bold break-words">{row.student.firstName} {row.student.lastName}</h5><p className="text-sm break-all">{row.student.email}</p><p className="text-xs break-all">Student ID: {row.student.id}</p><span className={`status-badge ${row.enrollment.status === 'active' ? 'status-success' : 'status-neutral'}`}>{row.enrollment.status === 'active' ? 'Active enrollment' : 'Inactive enrollment'}</span><p className="text-xs text-muted">Enrolled: {enrollmentDate(row.enrollment.enrolledAt)}</p><button className="button-secondary text-sm" disabled={enroll.isPending} onClick={() => setSelected(row.student.id)}>View cohort student: {row.student.firstName} {row.student.lastName}</button></li>)}</ul>}
      <AcademicPagination data={query.data.pagination} page={page} busy={query.isFetching} onPage={next => { setSelected(null); setPage(next); }} />
    </>}
    {selected && !query.isError && <CohortStudent key={selected} adminId={adminId} teacherId={teacher.id} studentId={selected} onClose={() => setSelected(null)} onRemoved={() => { setSelected(null); setNotice('Assignment removed. The account and academic records are preserved.'); }} />}
  </section>;
}
function CohortStudent({ adminId, teacherId, studentId, onClose, onRemoved }: { adminId: string; teacherId: string; studentId: string; onClose: () => void; onRemoved: () => void }) {
  const base = `/admin/teachers/${teacherId}/students/${studentId}`, refresh = useRefreshAdmin(), client = useQueryClient();
  const [confirm, setConfirm] = useState(false); const heading = useRef<HTMLHeadingElement>(null), confirmHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []); useEffect(() => { if (confirm) confirmHeading.current?.focus(); }, [confirm]);
  const query = useQuery({ queryKey: ['admin-student', adminId, teacherId, studentId], retry: false, queryFn: async () => {
    const { data } = await api.get<StudentDetail>(base); if (data?.student?.id !== studentId || !data.progress) throw new Error('Invalid student detail.'); return data;
  } });
  const remove = useMutation({ mutationFn: () => api.delete(base), onSuccess: async () => {
    onRemoved(); await client.cancelQueries({ queryKey: ['admin-student', adminId, teacherId, studentId] }); client.removeQueries({ queryKey: ['admin-student', adminId, teacherId, studentId] });
    await client.cancelQueries({ queryKey: ['teacher-academics', teacherId, studentId] }); client.removeQueries({ queryKey: ['teacher-academics', teacherId, studentId] }); await refresh();
  } });
  return <section aria-label="Admin cohort student detail" className="rounded-lg border border-brand/30 p-4 space-y-4"><div className="flex flex-wrap justify-between gap-3"><h5 ref={heading} tabIndex={-1} className="font-bold">Cohort student detail</h5><button className="button-secondary" disabled={remove.isPending} onClick={onClose}>Close cohort student</button></div>
    {query.isPending ? <LoadingState message="Loading cohort student progress..." /> : query.isError ? <ErrorState message={adminError(query.error)} onRetry={() => { void query.refetch(); }} retrying={query.isFetching} /> : <>
      <p className="text-sm break-words">{query.data.student.firstName} {query.data.student.lastName}</p><dl className="grid gap-3 sm:grid-cols-2">{[['Attempts', query.data.progress.attempts], ['Completed attempts', query.data.progress.completedAttempts], ['Average recorded points', query.data.progress.averageScore], ['Best recorded points', query.data.progress.bestScore]].map(([label, value]) => <div key={label}><dt className="text-sm text-muted">{label}</dt><dd className="font-bold">{value}</dd></div>)}</dl>
      <p className="text-xs text-muted">Scores use completed attempts, including repeats and pre-enrollment history. This aggregate admin route does not grant teacher-only report or attempt-history access.</p>
      {!confirm ? <button className="button-secondary" onClick={() => setConfirm(true)}>Release teacher assignment</button> : <ConfirmDialog label="Confirm teacher assignment removal" onCancel={() => { if (!remove.isPending) setConfirm(false); }}><div className="space-y-3"><h6 ref={confirmHeading} tabIndex={-1} className="font-bold">Confirm assignment removal</h6><p className="text-sm">Remove this student from the selected teacher? Their account, attempts and reports remain. Another teacher may enroll only after removal.</p><div className="flex flex-wrap gap-3"><button className="button" disabled={remove.isPending} onClick={() => remove.mutate()}>{remove.isPending ? 'Releasing assignment...' : 'Confirm release assignment'}</button><button className="button-secondary" disabled={remove.isPending} onClick={() => { setConfirm(false); remove.reset(); heading.current?.focus(); }}>Cancel assignment removal</button></div></div></ConfirmDialog>}
      {remove.isError && <p role="alert" className="error-panel">{adminError(remove.error)} Removal was not confirmed. Refresh before retrying.</p>}
    </>}
  </section>;
}
