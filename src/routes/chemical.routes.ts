import { Router } from 'express';
import {
  getChemicals,
  getTransactions,
  createChemical,
  updateChemical,
  exportChemical,
  createProposal,
  getProposals,
  updateProposalStatus,
  exportProposalToExcel,
  getApprovers,
  getProjectStatistics,
  importChemicals,
  undoChemicalTransaction,
  getExportData,
  requestDeleteChemical,
  requestBulkDeleteChemicals,
  approveDeleteChemical,
  rejectDeleteChemical
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
router.get('/export-data', getExportData);
router.get('/transactions', getTransactions);
router.delete('/transactions/:id', undoChemicalTransaction);
router.get('/', getChemicals);
router.post('/', createChemical);
router.post('/import', importChemicals);
router.post('/bulk-request-delete', requestBulkDeleteChemicals);
router.post('/:id/export', exportChemical);
router.post('/:id/request-delete', requestDeleteChemical);
router.post('/:id/approve-delete', approveDeleteChemical);
router.post('/:id/reject-delete', rejectDeleteChemical);
router.put('/:id', updateChemical);

export default router;
