import { Router } from 'express';
import { getProjection, addProjectionItem, updateProjectionItem, removeProjectionItem, exportProjectionExcel } from '../controllers/stationeryProjection.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.get('/', getProjection); // query: month, year
router.post('/:projectionId/items', addProjectionItem);
router.put('/items/:itemId', updateProjectionItem);
router.delete('/items/:itemId', removeProjectionItem);
router.get('/:projectionId/export', exportProjectionExcel);

export default router;
