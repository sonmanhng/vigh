import express from 'express';
import multer from 'multer';
import { authenticateToken } from '../middlewares/auth.middleware';
import { createReport, getReports, deleteReport, downloadReportDocx, downloadResultFile, downloadSynthesisDocx } from '../controllers/weeklyReport.controller';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authenticateToken);

router.post('/', upload.array('files'), createReport);
router.get('/', getReports);
router.get('/synthesis/docx', downloadSynthesisDocx);
router.get('/:id/docx', downloadReportDocx);
router.get('/download-file/:resultId', downloadResultFile);
router.delete('/:id', deleteReport);

export default router;
