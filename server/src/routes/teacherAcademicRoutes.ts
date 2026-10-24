import { Router } from 'express';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { teacherAnalytics, teacherAttempts, teacherReports, teacherReportDownload } from '../controllers/teacherAcademicController.js';

export const teacherAcademicRouter = Router();
const facultyOnly = [requireAuth, allowRoles('faculty')];
for (const prefix of ['/teacher', '/faculty']) {
  teacherAcademicRouter.get(`${prefix}/students/:studentId/attempts`, ...facultyOnly, teacherAttempts);
  teacherAcademicRouter.get(`${prefix}/students/:studentId/reports`, ...facultyOnly, teacherReports);
  teacherAcademicRouter.get(`${prefix}/students/:studentId/reports/:reportId/download`, ...facultyOnly, teacherReportDownload);
  teacherAcademicRouter.get(`${prefix}/analytics/experiments`, ...facultyOnly, teacherAnalytics);
}
