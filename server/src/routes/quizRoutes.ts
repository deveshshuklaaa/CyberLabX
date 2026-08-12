import { Router } from 'express'; import { submitQuiz } from '../controllers/quizController.js'; import { requireAuth, allowRoles } from '../middleware/auth.js'; export const quizRouter = Router(); quizRouter.post('/:id/submit', requireAuth, allowRoles('student'), submitQuiz);

