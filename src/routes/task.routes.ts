import { Router } from 'express';
import { createTask, getProjectTasks, updateTask, deleteTask } from '../controllers/task.controller';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticateToken);

// Create task (Admin, Manager, or Project Manager handled in controller)
router.post('/', createTask);

// Get tasks for a specific project
router.get('/project/:projectId', getProjectTasks);

// Update task (Progress/Status) - Admin, Manager, Assigned User
router.put('/:id', updateTask);

// Delete task (Admin, Manager, or Project Manager handled in controller)
router.delete('/:id', deleteTask);

export default router;
