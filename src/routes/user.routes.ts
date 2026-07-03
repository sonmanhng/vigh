import { Router } from 'express';
import { getProfile, updateProfile, getAllUsers, createUser, updateUser, deleteUser, getUserById } from '../controllers/user.controller';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticateToken);

// Profile routes (Any logged-in user can view and edit their own profile)
router.get('/profile', getProfile);
router.put('/profile', updateProfile);

// Assignable users route (Any logged-in user can fetch users for task/project assignment)
router.get('/assignable', getAllUsers);

// Personnel management routes
router.get('/:id', getUserById);
router.get('/', getAllUsers);
router.post('/', authorizeRoles('ADMIN', 'MANAGER'), createUser);
router.put('/:id', authorizeRoles('ADMIN', 'MANAGER'), updateUser);
router.delete('/:id', authorizeRoles('ADMIN'), deleteUser);

export default router;
