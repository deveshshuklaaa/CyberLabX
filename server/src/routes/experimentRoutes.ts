import { Router } from 'express'; import { getExperiment, listExperiments } from '../controllers/experimentController.js'; import { requireAuth } from '../middleware/auth.js'; export const experimentRouter = Router(); experimentRouter.use(requireAuth); experimentRouter.get('/', listExperiments); experimentRouter.get('/:id', getExperiment);

