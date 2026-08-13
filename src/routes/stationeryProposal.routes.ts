import { Router } from 'express';
import { createProposal, getProposals, updateProposalStatus, deleteProposal, exportProposals } from '../controllers/stationeryProposal.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.get('/export', exportProposals);
router.get('/', getProposals);
router.post('/', createProposal);
router.put('/:id/status', updateProposalStatus);
router.delete('/:id', deleteProposal);

export default router;
