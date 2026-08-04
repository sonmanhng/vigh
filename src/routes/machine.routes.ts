import { Router } from 'express';
import {
  getMachines,
  createMachine,
  addMachineLog,
  getMachineLogs,
  getMachineStatistics,
  updateMachine,
  deleteMachine,
  importMachines,
  deleteMachineLog
} from '../controllers/machine.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.get('/statistics', getMachineStatistics);
router.get('/logs', getMachineLogs);
router.post('/logs', addMachineLog);
router.delete('/logs/:id', deleteMachineLog);
router.get('/', getMachines);
router.post('/', createMachine);
router.post('/import', importMachines);
router.put('/:id', updateMachine);
router.delete('/:id', deleteMachine);

export default router;
