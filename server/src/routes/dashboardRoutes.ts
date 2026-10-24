import { Router } from 'express';
import { adminDashboard, facultyDashboard, studentDashboard, studentHistory } from '../controllers/dashboardController.js';
import { allowRoles, requireAuth } from '../middleware/auth.js';

export const dashboardRouter = Router();
dashboardRouter.get('/student/dashboard', requireAuth, allowRoles('student'), studentDashboard);
dashboardRouter.get('/student/history', requireAuth, allowRoles('student'), studentHistory);
dashboardRouter.get('/faculty/dashboard', requireAuth, allowRoles('faculty', 'admin'), facultyDashboard);
dashboardRouter.get('/teacher/dashboard', requireAuth, allowRoles('faculty', 'admin'), facultyDashboard);
dashboardRouter.get('/admin/dashboard', requireAuth, allowRoles('admin'), adminDashboard);

