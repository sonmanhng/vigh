import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import bcrypt from 'bcrypt';
import { z } from 'zod';

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  avatar: z.string().optional(),
  department: z.string().optional(),
  phone: z.string().optional(),
  password: z.string().min(6).optional(),
  affiliations: z.array(z.string()).optional(),
  orcid: z.string().optional(),
  scholar: z.string().optional(),
  bio: z.string().optional(),
  researchInterests: z.array(z.string()).optional(),
});

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  role: z.enum(['SuperAdmin', 'VienTruong', 'VienPho', 'TruongPhong', 'ChuyenVien', 'Student', 'ADMIN', 'MANAGER', 'USER']).optional(),
  department: z.string().optional(),
  phone: z.string().optional(),
  avatar: z.string().optional(),
  affiliations: z.array(z.string()).optional(),
  orcid: z.string().optional(),
  scholar: z.string().optional(),
  bio: z.string().optional(),
  researchInterests: z.array(z.string()).optional(),
});

const updateUserRoleSchema = z.object({
  role: z.string().optional(),
  department: z.string().optional(),
  name: z.string().optional(),
  phone: z.string().optional(),
  avatar: z.string().optional(),
  affiliations: z.array(z.string()).optional(),
  orcid: z.string().optional(),
  scholar: z.string().optional(),
  bio: z.string().optional(),
  researchInterests: z.array(z.string()).optional(),
});

export const getProfile = async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        department: true,
        phone: true,
        affiliations: true,
        orcid: true,
        scholar: true,
        bio: true,
        researchInterests: true,
        createdAt: true,
      },
    });
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const data = updateProfileSchema.parse(req.body);
    let passwordHash: string | undefined = undefined;

    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(data.password, salt);
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        name: data.name,
        avatar: data.avatar,
        department: data.department,
        phone: data.phone,
        ...(data.affiliations !== undefined && { affiliations: data.affiliations }),
        ...(data.orcid !== undefined && { orcid: data.orcid }),
        ...(data.scholar !== undefined && { scholar: data.scholar }),
        ...(data.bio !== undefined && { bio: data.bio }),
        ...(data.researchInterests !== undefined && { researchInterests: data.researchInterests }),
        ...(passwordHash && { passwordHash }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        department: true,
        phone: true,
        affiliations: true,
        orcid: true,
        scholar: true,
        bio: true,
        researchInterests: true,
      },
    });

    res.json({ message: 'Profile updated successfully', user: updatedUser });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation failed', errors: error.issues });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        department: true,
        phone: true,
        affiliations: true,
        orcid: true,
        scholar: true,
        bio: true,
        researchInterests: true,
        createdAt: true,
      },
      orderBy: { id: 'asc' },
    });
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const createUser = async (req: Request, res: Response) => {
  try {
    const data = createUserSchema.parse(req.body);

    const isTopAdmin = ['SuperAdmin', 'VienTruong', 'VienPho', 'ADMIN'].includes(req.user!.role);
    if (!isTopAdmin && data.role && ['SuperAdmin', 'VienTruong', 'VienPho', 'ADMIN', 'TruongPhong', 'MANAGER'].includes(data.role)) {
      data.role = 'ChuyenVien'; // Downgrade unauthorized role assignment
    }

    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    const newUser = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
        role: data.role || 'ChuyenVien',
        department: data.department,
        phone: data.phone,
        avatar: data.avatar,
        affiliations: data.affiliations || [],
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        department: true,
        phone: true,
        affiliations: true,
      },
    });

    res.status(201).json(newUser);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation failed', errors: error.issues });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const data = updateUserRoleSchema.parse(req.body);

    const isTopAdmin = ['SuperAdmin', 'VienTruong', 'VienPho', 'ADMIN'].includes(req.user!.role);
    if (!isTopAdmin && data.role) {
      delete data.role;
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        department: true,
        phone: true,
        affiliations: true,
      },
    });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    await prisma.user.delete({ where: { id } });
    res.json({ message: 'User deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        department: true,
        phone: true,
        affiliations: true,
        orcid: true,
        scholar: true,
        bio: true,
        researchInterests: true,
        createdAt: true,
        projects: {
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
          }
        },
        memberProjects: {
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
          }
        }
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error: any) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
