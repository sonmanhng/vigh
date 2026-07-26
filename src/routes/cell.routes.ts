import { Router } from 'express';
import {
  getCells,
  getTransactions,
  createCell,
  updateCell,
  deleteCell,
  exportCell,
  createProposal,
  getProposals,
  updateProposalStatus,
  exportProposalToExcel,
  getApprovers,
  getProjectStatistics,
  importCells
} from '../controllers/cell.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticateToken);

// Proposals
router.get('/approvers', getApprovers);
router.post('/proposals', createProposal);
router.get('/proposals', getProposals);
router.put('/proposals/:id/status', updateProposalStatus);
router.get('/proposals/:id/export', exportProposalToExcel);

// Regular Cell endpoints
router.get('/statistics/projects', getProjectStatistics);
router.get('/transactions', getTransactions);
router.get('/', getCells);
router.post('/', createCell);
router.post('/import', importCells);
router.put('/:id', updateCell);
router.delete('/:id', deleteCell);
router.post('/:id/export', exportCell);

export default router;
