import { Router } from 'express'; import { createUser, updateUser } from '../controllers/adminController.js'; import { allowRoles, requireAuth } from '../middleware/auth.js'; export const adminRouter = Router(); adminRouter.use(requireAuth, allowRoles('admin')); adminRouter.post('/users', createUser); adminRouter.patch('/users/:id', updateUser);

