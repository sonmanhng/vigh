import { Router } from 'express';
import {
  getChemicals,
  getTransactions,
  createChemical,
  updateChemical,
  deleteChemical,
  exportChemical,
} from '../controllers/chemical.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.get('/transactions', getTransactions);
router.get('/', getChemicals);
router.post('/', createChemical);
router.put('/:id', updateChemical);
router.delete('/:id', deleteChemical);
router.post('/:id/export', exportChemical);

export default router;
