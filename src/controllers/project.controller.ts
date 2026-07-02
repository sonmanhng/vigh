import { Request, Response } from 'express';
import prisma from '../utils/prisma';
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
