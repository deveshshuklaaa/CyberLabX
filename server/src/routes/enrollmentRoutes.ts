import { Router } from 'express';
import { allowRoles, requireAuth } from '../middleware/auth.js';
import { enrollStudent, getEnrolledStudent, listEnrolledStudents, ownEnrollment, removeEnrollment } from '../controllers/enrollmentController.js';

export const enrollmentRouter = Router();
const facultyStudents = Router();
facultyStudents.use(requireAuth, allowRoles('faculty'));
facultyStudents.get('/', listEnrolledStudents);
facultyStudents.post('/', enrollStudent);
facultyStudents.get('/:studentId', getEnrolledStudent);
facultyStudents.delete('/:studentId', removeEnrollment);
enrollmentRouter.use('/faculty/students', facultyStudents);
enrollmentRouter.use('/teacher/students', facultyStudents);

const adminStudents = Router({ mergeParams: true });
adminStudents.use(requireAuth, allowRoles('admin'));
adminStudents.get('/', listEnrolledStudents);
adminStudents.post('/', enrollStudent);
adminStudents.get('/:studentId', getEnrolledStudent);
adminStudents.delete('/:studentId', removeEnrollment);
enrollmentRouter.use('/admin/teachers/:teacherId/students', adminStudents);

enrollmentRouter.get('/student/enrollment', requireAuth, allowRoles('student'), ownEnrollment);
