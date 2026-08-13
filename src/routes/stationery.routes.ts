import { Router } from 'express';
import { getStationeries, getLowStockStationeries, createStationery, updateStationery, deleteStationery, getTransactions, createTransaction, exportStationeries, importStationeries, getApprovers } from '../controllers/stationery.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.use(authenticateToken);

// Transactions
router.get('/transactions', getTransactions);
router.post('/transactions', createTransaction);

// Excel
router.get('/export', exportStationeries);
router.post('/import', upload.single('file'), importStationeries);

// CRUD
router.get('/approvers', getApprovers);
router.get('/low-stock', getLowStockStationeries);
router.get('/', getStationeries);
router.post('/', createStationery);
router.put('/:id', updateStationery);
router.delete('/:id', deleteStationery);

export default router;
