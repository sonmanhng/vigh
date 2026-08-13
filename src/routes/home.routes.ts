import { Router } from 'express';
import { getHomeStats } from '../controllers/home.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/stats', getHomeStats);

export default router;
