import { Router } from 'express';
import { createUser, getUser, listAuditEvents, listUsers, updateUser } from '../controllers/adminController.js';
import { allowRoles, requireAuth } from '../middleware/auth.js';
export const adminRouter = Router();
adminRouter.use(requireAuth, allowRoles('admin'));
adminRouter.get('/users', listUsers);
adminRouter.get('/users/:id', getUser);
adminRouter.post('/users', createUser);
adminRouter.patch('/users/:id', updateUser);
adminRouter.get('/audit-events', listAuditEvents);

