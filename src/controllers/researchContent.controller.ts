import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { isTopAdmin, isManagerOrAbove } from '../middlewares/auth.middleware';
import { z } from 'zod';

const researchContentSchema = z.object({
  code: z.string().min(1),
  title: z.string().min(1),
  status: z.string().optional().default('Xong 100%'),
  description: z.string().optional().nullable(),
  activities: z.string().optional().nullable(), // JSON string representing array of { activity, result }
});

export const createResearchContent = async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId as string);
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ message: 'Không tìm thấy đề tài' });

    if (!isManagerOrAbove(req.user!.role) && project.managerId !== req.user!.id) {
      return res.status(403).json({ message: 'Bạn không có quyền thêm nội dung nghiên cứu cho đề tài này' });
    }

    const data = researchContentSchema.parse(req.body);

    const created = await prisma.researchContent.create({
      data: {
        code: data.code,
        title: data.title,
        status: data.status,
        description: data.description,
        activities: data.activities,
        projectId: project.id,
      }
    });

    res.status(201).json(created);
  } catch (error: any) {
    res.status(400).json({ message: 'Lỗi khi tạo nội dung nghiên cứu', error: error.message });
  }
};

export const updateResearchContent = async (req: Request, res: Response) => {
  try {
    const contentId = parseInt(req.params.contentId as string);
    const content = await prisma.researchContent.findUnique({ where: { id: contentId }, include: { project: true } });
    if (!content) return res.status(404).json({ message: 'Không tìm thấy nội dung nghiên cứu' });

    if (!isManagerOrAbove(req.user!.role) && content.project.managerId !== req.user!.id) {
      return res.status(403).json({ message: 'Bạn không có quyền cập nhật nội dung này' });
    }

    const data = researchContentSchema.partial().parse(req.body);

    const updated = await prisma.researchContent.update({
      where: { id: contentId },
      data: data
    });

    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ message: 'Lỗi khi cập nhật nội dung nghiên cứu', error: error.message });
  }
};

export const deleteResearchContent = async (req: Request, res: Response) => {
  try {
    const contentId = parseInt(req.params.contentId as string);
    const content = await prisma.researchContent.findUnique({ where: { id: contentId }, include: { project: true } });
    if (!content) return res.status(404).json({ message: 'Không tìm thấy nội dung nghiên cứu' });

    if (!isManagerOrAbove(req.user!.role) && content.project.managerId !== req.user!.id) {
      return res.status(403).json({ message: 'Bạn không có quyền xóa nội dung này' });
    }

    await prisma.researchContent.delete({ where: { id: contentId } });
    res.json({ message: 'Đã xóa nội dung nghiên cứu' });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi khi xóa nội dung nghiên cứu', error: error.message });
  }
};

export const addComment = async (req: Request, res: Response) => {
  try {
    const contentId = parseInt(req.params.contentId as string);
    const { content } = req.body;
    
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Nội dung bình luận không được để trống' });
    }

    const rc = await prisma.researchContent.findUnique({ where: { id: contentId } });
    if (!rc) return res.status(404).json({ message: 'Không tìm thấy nội dung nghiên cứu' });

    const newComment = await prisma.researchContentComment.create({
      data: {
        content: content.trim(),
        researchContentId: contentId,
        userId: req.user!.id,
      },
      include: {
        user: { select: { id: true, name: true, avatar: true } }
      }
    });

    res.status(201).json(newComment);
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi khi thêm bình luận', error: error.message });
  }
};

export const deleteComment = async (req: Request, res: Response) => {
  try {
    const commentId = parseInt(req.params.commentId as string);
    const comment = await prisma.researchContentComment.findUnique({ where: { id: commentId } });
    if (!comment) return res.status(404).json({ message: 'Không tìm thấy bình luận' });

    // Allow author or project manager to delete
    if (comment.userId !== req.user!.id && !isManagerOrAbove(req.user!.role)) {
      return res.status(403).json({ message: 'Bạn không có quyền xóa bình luận này' });
    }

    await prisma.researchContentComment.delete({ where: { id: commentId } });
    res.json({ message: 'Đã xóa bình luận' });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi khi xóa bình luận', error: error.message });
  }
};
