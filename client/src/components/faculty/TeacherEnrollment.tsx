import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useSessionStore } from '../../store/sessionStore';
import { LoadingState, ErrorState } from '../common/QueryState';
import { enrollmentDate, enrollmentError, enrollmentKeys, enrollmentPageSize, useEnrolledStudent, useEnrolledStudents, useRefreshEnrollments } from '../../services/enrollment';
import type { EnrolledStudent, EnrollmentSelector } from '../../services/enrollment';

export function TeacherEnrollment() {
  const user = useSessionStore(state => state.user);
  // An admin viewing Teacher Portal must never issue a faculty-only request.
  return user?.role === 'faculty' ? <Cohort key={user.id} teacherId={user.id} /> : null;
}

function Cohort({ teacherId }: { teacherId: string }) {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [selector, setSelector] = useState<'email' | 'studentId'>('email');
  const [value, setValue] = useState('');
  const [validation, setValidation] = useState('');
  const list = useEnrolledStudents(teacherId, page);
  const refresh = useRefreshEnrollments();
  const listHeading = useRef<HTMLHeadingElement>(null);
  const enroll = useMutation({
    mutationFn: (input: EnrollmentSelector) => api.post<EnrolledStudent>('/teacher/students', input),
    onSuccess: async () => { setNotice('Student enrolled successfully.'); setValue(''); setSelected(null); await refresh(); },
  });
  const total = list.data?.pagination.total ?? 0;
  const pages = Math.max(1, Math.min(10000, Math.ceil(total / enrollmentPageSize)));
  // Another session may remove the final student on a later page.
  useEffect(() => { if (list.isSuccess && page > pages) { setPage(pages); setSelected(null); } }, [list.isSuccess, page, pages]);
  const submit = (event: FormEvent) => {
    event.preventDefault(); if (enroll.isPending) return;
    const normalized = value.trim(); setNotice(''); enroll.reset();
    if (selector === 'studentId' ? !/^[a-f\d]{24}$/i.test(normalized) : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254) {
      setValidation(selector === 'studentId' ? 'Enter a student ID containing exactly 24 hexadecimal characters.' : 'Enter the existing student’s exact email address.'); return;
    }
    setValidation(''); enroll.mutate(selector === 'email' ? { email: normalized.toLowerCase() } : { studentId: normalized });
  };
  const changePage = (next: number) => { setSelected(null); setPage(next); listHeading.current?.focus(); };
  return <div className="space-y-6">
    <form aria-label="Enroll existing student" onSubmit={submit} className="rounded-lg border border-line p-4 space-y-4" noValidate>
      <h3 className="font-bold">Enroll an existing student</h3>
      <p id="enrollment-help" className="text-sm text-muted">Use exactly one identifier for an active student account. This does not create accounts, send invitations or search a directory.</p>
      <fieldset disabled={enroll.isPending} className="space-y-4">
        <legend className="sr-only">Student identifier</legend>
        <div><label className="label" htmlFor="enrollment-selector">Identify student by</label><select id="enrollment-selector" className="field" value={selector} onChange={event => { setSelector(event.target.value as 'email' | 'studentId'); setValue(''); setValidation(''); enroll.reset(); }}><option value="email">Exact email address</option><option value="studentId">Student ID</option></select></div>
        <div><label className="label" htmlFor="enrollment-identifier">{selector === 'email' ? 'Student email address' : 'Student ID'}</label><input id="enrollment-identifier" className="field" type={selector === 'email' ? 'email' : 'text'} value={value} onChange={event => { setValue(event.target.value); setValidation(''); enroll.reset(); }} required maxLength={selector === 'email' ? 254 : 24} autoComplete="off" spellCheck={false} aria-describedby={`enrollment-help${validation ? ' enrollment-validation' : ''}`} aria-invalid={Boolean(validation)} /></div>
        <button className="button" type="submit">{enroll.isPending ? 'Enrolling...' : 'Enroll student'}</button>
      </fieldset>
      {validation && <p id="enrollment-validation" role="alert" className="text-sm text-danger">{validation}</p>}
      {enroll.isError && <p role="alert" className="error-panel text-sm">{enrollmentError(enroll.error)} Enrollment was not confirmed. Refresh students before submitting again.</p>}
    </form>
    {notice && <p role="status" className="panel p-4 border-emerald-200 text-sm">{notice}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 ref={listHeading} tabIndex={-1} className="font-bold">Your enrolled students</h3><button type="button" className="button-secondary text-sm" disabled={list.isFetching || enroll.isPending} onClick={() => { setSelected(null); void list.refetch(); }}>{list.isFetching ? 'Refreshing students...' : 'Refresh students'}</button></div>
    {list.isPending ? <LoadingState message="Loading enrolled students..." /> : list.isError ? <ErrorState message={enrollmentError(list.error)} onRetry={() => { void list.refetch(); }} retrying={list.isFetching} /> : <>
      <p className="text-sm text-muted" role="status">{total} enrolled {total === 1 ? 'student' : 'students'}. Includes inactive assigned accounts; the dashboard counts active students only.</p>
      {!list.data.students.length ? <div className="state-panel"><h4 className="font-bold">No enrolled students</h4><p className="page-description mx-auto">Enroll an existing student using the exact email or student ID above.</p></div> : <ul aria-label="Enrolled students" className="grid gap-4 sm:grid-cols-2">{list.data.students.map(({ student, enrollment }) => <li key={student.id} className="rounded-lg border border-line p-4 space-y-3 min-w-0">
        <h4 className="font-bold break-words">{student.firstName} {student.lastName}</h4><p className="text-sm break-all">{student.email}</p><p className="text-xs text-muted break-all">Student ID: {student.id}</p>
        <div className="flex flex-wrap gap-2"><span className={`status-badge ${student.isActive ? 'status-success' : 'status-neutral'}`}>{student.isActive ? 'Active account' : 'Inactive account'}</span><span className={`status-badge ${enrollment.status === 'active' ? 'status-success' : 'status-neutral'}`}>{enrollment.status === 'active' ? 'Active enrollment' : 'Inactive enrollment'}</span></div>
        <p className="text-xs text-muted">Enrolled: {enrollmentDate(enrollment.enrolledAt)}</p><button type="button" className="button-secondary text-sm" aria-expanded={selected === student.id} aria-controls="enrolled-student-detail" disabled={enroll.isPending} onClick={() => setSelected(student.id)}>View student: {student.firstName} {student.lastName}</button>
      </li>)}</ul>}
      <nav aria-label="Student list pagination" className="flex flex-wrap items-center gap-3"><button type="button" className="button-secondary text-sm" disabled={page <= 1 || list.isFetching || enroll.isPending} onClick={() => changePage(page - 1)}>Previous page</button><span className="text-sm" role="status">Page {page} of {pages}</span><button type="button" className="button-secondary text-sm" disabled={page >= pages || list.isFetching || enroll.isPending} onClick={() => changePage(page + 1)}>Next page</button></nav>
    </>}
    {selected && !list.isError && <StudentDetail key={selected} teacherId={teacherId} studentId={selected} onClose={() => { setSelected(null); listHeading.current?.focus(); }} onRemoved={() => { setSelected(null); setNotice('Enrollment removed. The student’s account and academic records are preserved.'); listHeading.current?.focus(); }} />}
  </div>;
}

function StudentDetail({ teacherId, studentId, onClose, onRemoved }: { teacherId: string; studentId: string; onClose: () => void; onRemoved: () => void }) {
  const detail = useEnrolledStudent(teacherId, studentId);
  const client = useQueryClient();
  const refresh = useRefreshEnrollments();
  const [confirm, setConfirm] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const confirmHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => { if (confirm) confirmHeading.current?.focus(); }, [confirm]);
  const remove = useMutation({ mutationFn: () => api.delete(`/teacher/students/${studentId}`), onSuccess: async () => {
    onRemoved();
    await client.cancelQueries({ queryKey: enrollmentKeys.detail(teacherId, studentId) });
    client.removeQueries({ queryKey: enrollmentKeys.detail(teacherId, studentId) });
    await refresh();
  } });
  const record = detail.data;
  return <section id="enrolled-student-detail" aria-labelledby="enrolled-detail-heading" className="rounded-lg border border-brand/30 p-4 sm:p-5 space-y-4">
    <div className="flex flex-wrap gap-3 justify-between items-center"><h3 id="enrolled-detail-heading" ref={heading} tabIndex={-1} className="text-lg font-bold">Student detail</h3><button className="button-secondary text-sm" type="button" disabled={remove.isPending} onClick={onClose}>Close student detail</button></div>
    {detail.isPending ? <LoadingState message="Loading student progress..." /> : detail.isError || !record ? <ErrorState message={enrollmentError(detail.error)} onRetry={() => { void detail.refetch(); }} retrying={detail.isFetching} /> : <>
      <h4 className="font-bold break-words">{record.student.firstName} {record.student.lastName}</h4><p className="text-sm break-all">{record.student.email}</p><p className="text-xs text-muted break-all">Student ID: {record.student.id}</p>
      <dl className="grid gap-3 sm:grid-cols-2 text-sm">{[['Attempts', record.progress.attempts], ['Completed attempts', record.progress.completedAttempts], ['Average score', record.progress.averageScore], ['Best score', record.progress.bestScore]].map(([label, value]) => <div className="rounded-lg bg-canvas p-3" key={label}><dt className="text-muted">{label}</dt><dd className="text-xl font-bold">{value}</dd></div>)}</dl>
      <p className="text-sm text-muted">Scores are shown as recorded, without converting them to percentages. This summary includes completed attempts, repeats and work before enrollment. Individual attempts and reports are not available in this view.</p>
      {!confirm ? <button type="button" className="button-secondary text-sm" onClick={() => { remove.reset(); setConfirm(true); }}>Remove enrollment</button> : <section aria-labelledby="unenroll-confirm-heading" className="rounded-lg border border-danger/30 p-4 space-y-3">
        <h4 id="unenroll-confirm-heading" ref={confirmHeading} tabIndex={-1} className="font-bold">Confirm unenrollment</h4><p className="text-sm">Remove this student from your cohort? Their account, attempts and reports will be preserved. You will lose access to their detail and progress. Another teacher can enroll them after removal.</p>
        <div className="flex flex-wrap gap-3"><button type="button" className="button" disabled={remove.isPending} onClick={() => remove.mutate()}>{remove.isPending ? 'Removing...' : 'Confirm remove enrollment'}</button><button type="button" className="button-secondary" disabled={remove.isPending} onClick={() => { setConfirm(false); remove.reset(); heading.current?.focus(); }}>Cancel removal</button></div>
      </section>}
      {remove.isError && <p role="alert" className="error-panel text-sm">{enrollmentError(remove.error)} Removal was not confirmed. Close this detail and refresh students before trying again.</p>}
    </>}
  </section>;
}
