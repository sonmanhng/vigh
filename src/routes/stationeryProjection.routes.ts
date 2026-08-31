import { Router } from 'express';
import { getProjection, addProjectionItem, addProjectionItemByMonthYear, updateProjectionItem, removeProjectionItem, exportProjectionExcel, bulkUpdateProjectionItemsStatus, bulkRemoveProjectionItems } from '../controllers/stationeryProjection.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.get('/', getProjection); // query: month, year
router.post('/', addProjectionItemByMonthYear);
router.post('/:projectionId/items', addProjectionItem);
router.put('/items/bulk-status', bulkUpdateProjectionItemsStatus);
router.delete('/items/bulk', bulkRemoveProjectionItems);
router.put('/items/:itemId', updateProjectionItem);
router.delete('/items/:itemId', removeProjectionItem);
router.get('/:projectionId/export', exportProjectionExcel);

export default router;
