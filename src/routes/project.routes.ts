import { Router } from 'express';
import { createProject, getProjects, getProjectById, updateProject, deleteProject, exportProjectDocx, importProjectDocx, approveProject } from '../controllers/project.controller';
import multer from 'multer';
import { createResearchContent, updateResearchContent, deleteResearchContent, addComment, deleteComment } from '../controllers/researchContent.controller';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authenticateToken);

router.get('/', getProjects);
router.get('/:id', getProjectById);
router.post('/', createProject);
router.put('/:id', updateProject);
router.put('/:id/approve', approveProject);
router.delete('/:id', authorizeRoles('ADMIN', 'MANAGER'), deleteProject);
router.get('/:id/export-docx', exportProjectDocx);
router.post('/:id/import-docx', upload.single('file'), importProjectDocx);

// Research Content sub-cards routes
router.post('/:projectId/research-contents', createResearchContent);
router.put('/:projectId/research-contents/:contentId', updateResearchContent);
router.delete('/:projectId/research-contents/:contentId', deleteResearchContent);

// Comments routes
router.post('/:projectId/research-contents/:contentId/comments', addComment);
router.delete('/:projectId/research-contents/comments/:commentId', deleteComment);

export default router;
