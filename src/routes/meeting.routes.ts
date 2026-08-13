import { Router } from 'express';
import { createMeeting, getMyMeetings, deleteMeeting } from '../controllers/meeting.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.post('/', createMeeting);
router.get('/', getMyMeetings);
router.delete('/:id', deleteMeeting);

export default router;
