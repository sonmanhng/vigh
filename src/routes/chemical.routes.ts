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
  getApprovers,
} from '../controllers/chemical.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticateToken);

// Proposals
router.get('/approvers', getApprovers);
router.post('/proposals', createProposal);
router.get('/proposals', getProposals);
router.put('/proposals/:id/status', updateProposalStatus);

// Regular Chemical endpoints
router.get('/transactions', getTransactions);
router.get('/', getChemicals);
router.post('/', createChemical);
router.put('/:id', updateChemical);
router.delete('/:id', deleteChemical);
router.post('/:id/export', exportChemical);

export default router;
