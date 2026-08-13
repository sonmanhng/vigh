import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { isTopAdmin } from '../middlewares/auth.middleware';

export const createMeeting = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const role = (req as any).user?.role;
    
    // Check if user is Viện trưởng, Viện phó, or SuperAdmin
    if (!isTopAdmin(role)) {
      return res.status(403).json({ message: 'Không có quyền tạo lịch họp (Chỉ dành cho Lãnh đạo/SuperAdmin)' });
    }

    const { title, content, date, participantIds } = req.body;
    
    if (!title || !date) {
      return res.status(400).json({ message: 'Tiêu đề và thời gian họp là bắt buộc' });
    }

    const newMeeting = await prisma.meeting.create({
      data: {
        title,
        content,
        date: new Date(date),
        createdById: userId,
        participants: {
          create: (participantIds || []).map((pId: number) => ({
            userId: pId
          }))
        }
      },
      include: {
        participants: {
          include: {
            user: { select: { id: true, name: true, role: true } }
          }
        },
        creator: { select: { id: true, name: true, role: true } }
      }
    });

    res.status(201).json(newMeeting);
  } catch (error: any) {
    console.error('Error creating meeting:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getMyMeetings = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    const meetings = await prisma.meeting.findMany({
      where: {
        OR: [
          { createdById: userId },
          { participants: { some: { userId } } }
        ]
      },
      include: {
        participants: {
          include: {
            user: { select: { id: true, name: true, role: true } }
          }
        },
        creator: { select: { id: true, name: true, role: true } }
      },
      orderBy: { date: 'asc' }
    });

    res.json(meetings);
  } catch (error: any) {
    console.error('Error fetching meetings:', error);
    res.status(500).json({ message: error.message });
  }
};

export const deleteMeeting = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const role = (req as any).user?.role;

    const meeting = await prisma.meeting.findUnique({ where: { id: Number(id) } });
    if (!meeting) {
      return res.status(404).json({ message: 'Không tìm thấy cuộc họp' });
    }

    if (meeting.createdById !== userId && !isTopAdmin(role)) {
      return res.status(403).json({ message: 'Không có quyền xoá cuộc họp này' });
    }

    await prisma.meeting.delete({ where: { id: Number(id) } });
    res.json({ message: 'Xoá thành công' });
  } catch (error: any) {
    console.error('Error deleting meeting:', error);
    res.status(500).json({ message: error.message });
  }
};
