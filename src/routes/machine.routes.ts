import { Router } from 'express';
import {
  getMachines,
  createMachine,
  addMachineLog,
  getMachineLogs,
  getMachineStatistics
} from '../controllers/machine.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.get('/statistics', getMachineStatistics);
router.get('/logs', getMachineLogs);
router.post('/logs', addMachineLog);
router.get('/', getMachines);
router.post('/', createMachine);

export default router;
