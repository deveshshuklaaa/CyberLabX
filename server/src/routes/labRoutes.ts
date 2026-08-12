import { Router } from 'express'; import { getLab, startLab, stopLab } from '../controllers/labController.js'; import { requireAuth, allowRoles } from '../middleware/auth.js';
export const labRouter = Router(); labRouter.use(requireAuth, allowRoles('student')); labRouter.post('/start', startLab); labRouter.get('/:id', getLab); labRouter.post('/:id/stop', stopLab);
