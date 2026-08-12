import { Router } from 'express'; import { submitTask } from '../controllers/taskController.js'; import { requireAuth, allowRoles } from '../middleware/auth.js'; export const taskRouter = Router(); taskRouter.post('/:id/submit', requireAuth, allowRoles('student'), submitTask);

