import { Router } from 'express';
import {
  getChemicals,
  getTransactions,
  createChemical,
  updateChemical,
  deleteChemical,
  exportChemical,
  createProposal,
  getProposals,
  updateProposalStatus,
  exportProposalToExcel,
  getApprovers,
  getProjectStatistics,
} from '../controllers/chemical.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticateToken);

// Proposals
router.get('/approvers', getApprovers);
router.post('/proposals', createProposal);
router.get('/proposals', getProposals);
router.put('/proposals/:id/status', updateProposalStatus);
router.get('/proposals/:id/export', exportProposalToExcel);

// Regular Chemical endpoints
router.get('/statistics/projects', getProjectStatistics);
router.get('/transactions', getTransactions);
router.get('/', getChemicals);
router.post('/', createChemical);
router.put('/:id', updateChemical);
router.delete('/:id', deleteChemical);
router.post('/:id/export', exportChemical);

export default router;
