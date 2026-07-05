import { Router } from 'express';
import {
  addLaborLog,
  getMyLaborLogs,
  deleteLaborLog,
  getMyLaborStats,
  getAdminLaborStats,
  createOvertimeRequest,
  getMyOvertimeRequests,
  getPendingOvertimeRequests,
  approveOvertimeRequest
} from '../controllers/labor.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticateToken);

// User endpoints
router.post('/', addLaborLog);
router.get('/my-logs', getMyLaborLogs);
router.delete('/:id', deleteLaborLog);
router.get('/my-statistics', getMyLaborStats);

// Overtime endpoints
router.post('/overtime', createOvertimeRequest);
router.get('/overtime/my-requests', getMyOvertimeRequests);
router.get('/overtime/pending', getPendingOvertimeRequests);
router.put('/overtime/:id/approve', approveOvertimeRequest);

// Admin endpoints
router.get('/admin-statistics', getAdminLaborStats);

export default router;
