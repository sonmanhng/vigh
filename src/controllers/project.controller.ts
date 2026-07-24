import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, BorderStyle } from 'docx';
import mammoth from 'mammoth';
import * as cheerio from 'cheerio';
import { z } from 'zod';
import { isTopAdmin, isManagerOrAbove } from '../middlewares/auth.middleware';

const projectSchema = z.object({
  name: z.string().min(1),
  nameEn: z.string().optional().nullable(),
  code: z.string().optional().nullable(),
  projectType: z.string().optional().nullable(),
  managementUnit: z.string().optional().nullable(),
  hostOrganization: z.string().optional().nullable(),
  advisor: z.string().optional().nullable(),
  executionTime: z.string().optional().nullable(),
  budget: z.string().optional().nullable(),
  laborBudget: z.number().optional().nullable(),
  generalObjective: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  status: z.enum(['PLANNING', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD']).optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  managerId: z.number().optional().nullable(),
  memberIds: z.array(z.number()).optional(),
});

export const createProject = async (req: Request, res: Response) => {
  try {
    const data = projectSchema.parse(req.body);
    const { managerId, memberIds, ...rest } = data;

    // Default managerId to current user if not specified
    const finalManagerId = managerId || req.user!.id;

    const project = await prisma.project.create({
      data: {
        ...rest,
        startDate: rest.startDate ? new Date(rest.startDate) : null,
        endDate: rest.endDate ? new Date(rest.endDate) : null,
        managerId: finalManagerId,
        members: memberIds && memberIds.length > 0 ? {
          connect: memberIds.map(id => ({ id }))
        } : undefined,
      },
      include: {
        manager: { select: { id: true, name: true, email: true, role: true, avatar: true } },
        members: { select: { id: true, name: true, email: true, role: true, avatar: true } },
      }
    });
    res.status(201).json(project);
  } catch (error: any) {
    res.status(400).json({ message: 'Error creating project', error: error.message });
  }
};

export const getProjects = async (req: Request, res: Response) => {
  try {
    const { role, id } = req.user!;
    let projects;

    if (isTopAdmin(role)) {
      projects = await prisma.project.findMany({ 
        include: { 
          manager: { select: { id: true, name: true, email: true, role: true, avatar: true } },
          members: { select: { id: true, name: true, email: true, role: true, avatar: true } },
          tasks: { select: { status: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
    } else {
      projects = await prisma.project.findMany({
        where: {
          OR: [
            { managerId: id },
            { members: { some: { id } } },
            { tasks: { some: { assigneeId: id } } }
          ]
        },
        include: { 
          manager: { select: { id: true, name: true, email: true, role: true, avatar: true } },
          members: { select: { id: true, name: true, email: true, role: true, avatar: true } },
          tasks: { select: { status: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
    }

    const projectsWithProgress = projects.map(p => {
      const totalTasks = p.tasks.length;
      const completedTasks = p.tasks.filter((t: any) => t.status === 'DONE').length;
      const progress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
      
      const { tasks, ...projectData } = p;
      return { ...projectData, progress };
    });

    res.json(projectsWithProgress);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching projects', error: error.message });
  }
};

export const updateProject = async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.id as string);
    const data = projectSchema.parse(req.body);
    const { managerId, memberIds, ...rest } = data;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (!isTopAdmin(req.user!.role) && project.managerId !== req.user!.id) {
      return res.status(403).json({ message: 'Not authorized to edit this project' });
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: {
        ...rest,
        managerId: managerId !== undefined ? managerId : undefined,
        members: memberIds !== undefined ? {
          set: memberIds.map(id => ({ id }))
        } : undefined,
        startDate: rest.startDate ? new Date(rest.startDate) : undefined,
        endDate: rest.endDate ? new Date(rest.endDate) : undefined,
      },
      include: {
        manager: { select: { id: true, name: true, email: true, role: true, avatar: true } },
        members: { select: { id: true, name: true, email: true, role: true, avatar: true } },
        researchContents: { orderBy: { id: 'asc' } },
      }
    });
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ message: 'Error updating project', error: error.message });
  }
};

export const deleteProject = async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.id as string);
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (!isTopAdmin(req.user!.role) && project.managerId !== req.user!.id) {
      return res.status(403).json({ message: 'Not authorized to delete this project' });
    }

    await prisma.project.delete({ where: { id: projectId } });
    res.json({ message: 'Project deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: 'Error deleting project', error: error.message });
  }
};

export const getProjectById = async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.id as string);
    const { role, id } = req.user!;

    const p = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        manager: { select: { id: true, name: true, email: true, role: true, avatar: true } },
        members: { select: { id: true, name: true, email: true, role: true, avatar: true } },
        researchContents: { orderBy: { id: 'asc' } },
        tasks: { 
          include: {
            assignee: { select: { id: true, name: true, email: true, role: true, avatar: true } }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!p) return res.status(404).json({ message: 'Project not found' });

    // Check authorization
    if (!isTopAdmin(role) && p.managerId !== id && !p.members.some(m => m.id === id) && !p.tasks.some(t => t.assigneeId === id)) {
      return res.status(403).json({ message: 'Not authorized to view this project' });
    }

    const totalTasks = p.tasks.length;
    const completedTasks = p.tasks.filter((t: any) => t.status === 'DONE').length;
    const progress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    res.json({ ...p, progress });
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching project details', error: error.message });
  }
};

const DOCX_FIELDS = [
  { key: 'name', label: 'Tên đề tài' },
  { key: 'nameEn', label: 'Tên tiếng Anh' },
  { key: 'code', label: 'Mã số' },
  { key: 'projectType', label: 'Loại đề tài' },
  { key: 'managementUnit', label: 'Đơn vị quản lý' },
  { key: 'hostOrganization', label: 'Tổ chức chủ trì' },
  { key: 'advisor', label: 'Cố vấn' },
  { key: 'executionTime', label: 'Thời gian thực hiện' },
  { key: 'budget', label: 'Kinh phí' },
  { key: 'generalObjective', label: 'Mục tiêu chung' },
  { key: 'description', label: 'Mô tả chi tiết / Tổng quan' }
];

export const exportProjectDocx = async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.id as string);
    const { role, id } = req.user!;
    
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { manager: true }
    });

    if (!project) return res.status(404).json({ message: 'Project not found' });

    // Authorization check
    if (!isTopAdmin(role) && project.managerId !== id) {
      // Members might be allowed to export, let's allow anyone who can see it
      const isMember = await prisma.project.findFirst({
        where: {
          id: projectId,
          OR: [
            { members: { some: { id } } },
            { tasks: { some: { assigneeId: id } } }
          ]
        }
      });
      if (!isMember) {
        return res.status(403).json({ message: 'Not authorized to export this project' });
      }
    }

    const tableRows = DOCX_FIELDS.map(field => {
      return new TableRow({
        children: [
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: field.label, bold: true })] })],
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1 },
              bottom: { style: BorderStyle.SINGLE, size: 1 },
              left: { style: BorderStyle.SINGLE, size: 1 },
              right: { style: BorderStyle.SINGLE, size: 1 },
            }
          }),
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ text: (project as any)[field.key] || '' })],
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1 },
              bottom: { style: BorderStyle.SINGLE, size: 1 },
              left: { style: BorderStyle.SINGLE, size: 1 },
              right: { style: BorderStyle.SINGLE, size: 1 },
            }
          })
        ]
      });
    });

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: `THÔNG TIN ĐỀ TÀI: ${(project.name || '').toUpperCase()}`, bold: true, size: 32 })
            ],
            alignment: 'center',
            spacing: { after: 400 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Vui lòng chỉnh sửa nội dung ở cột thứ 2 bên dưới. Không thay đổi tên các trường ở cột thứ 1.', italics: true })
            ],
            spacing: { after: 200 }
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows
          })
        ]
      }]
    });

    const buffer = await Packer.toBuffer(doc);
    
    res.setHeader('Content-Disposition', `attachment; filename=DeTai_${projectId}_${Date.now()}.docx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ message: 'Error exporting docx', error: error.message });
  }
};

export const importProjectDocx = async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.id as string);
    const { role, id } = req.user!;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ message: 'Project not found' });

    // Ensure only TopAdmin or Manager can update
    if (!isTopAdmin(role) && project.managerId !== id) {
      return res.status(403).json({ message: 'Not authorized to update this project' });
    }

    const result = await mammoth.convertToHtml({ buffer: file.buffer });
    const html = result.value;
    
    const $ = cheerio.load(html);
    const updates: any = {};

    $('table tr').each((i, el) => {
      const tdList = $(el).find('td');
      if (tdList.length >= 2) {
        const fieldName = $(tdList[0]).text().trim();
        const fieldValue = $(tdList[1]).text().trim();
        
        const fieldDef = DOCX_FIELDS.find(f => f.label.toLowerCase() === fieldName.toLowerCase());
        if (fieldDef) {
          updates[fieldDef.key] = fieldValue;
        }
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'Không tìm thấy dữ liệu hợp lệ trong file DOCX' });
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: updates
    });

    res.json({ message: 'Cập nhật thành công', data: updated });
  } catch (error: any) {
    res.status(500).json({ message: 'Error importing docx', error: error.message });
  }
};
