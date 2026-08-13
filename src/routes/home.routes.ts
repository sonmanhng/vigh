import { Router } from 'express';
import { getHomeStats } from '../controllers/home.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.get('/stats', getHomeStats);

export default router;
