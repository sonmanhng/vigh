import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';
import { z } from 'zod';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  role: z.enum(['SuperAdmin', 'VienTruong', 'VienPho', 'TruongPhong', 'ChuyenVien', 'Student', 'ADMIN', 'MANAGER', 'USER']).optional(),
  avatar: z.string().optional(),
  department: z.string().optional(),
  phone: z.string().optional(),
  affiliations: z.array(z.string()).optional(),
});

const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string(),
});

export const register = async (req: Request, res: Response) => {
  try {
    const parsedData = registerSchema.parse(req.body);
    const { email, password, name, role, avatar, department, phone, affiliations } = parsedData;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: role || 'ChuyenVien',
        avatar,
        department,
        phone,
        affiliations: affiliations || [],
      },
    });

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        avatar: newUser.avatar,
        department: newUser.department,
        phone: newUser.phone,
        affiliations: newUser.affiliations,
        orcid: newUser.orcid,
        scholar: newUser.scholar,
        bio: newUser.bio,
        researchInterests: newUser.researchInterests,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation failed', errors: error.issues });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const parsedData = loginSchema.parse(req.body);
    const normalizeStr = (str: string) => str.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");
    const cleanEmail = normalizeStr(parsedData.email);
    const emailPrefix = cleanEmail.split('@')[0];

    const allUsers = await prisma.user.findMany();
    let user = allUsers.find(u => {
      const uClean = normalizeStr(u.email);
      const uPrefix = uClean.split('@')[0];
      return uClean === cleanEmail || uPrefix === emailPrefix;
    }) || null;

    if (!user) {
      return res.status(401).json({ message: 'Tài khoản không tồn tại trong hệ thống' });
    }

    const password = parsedData.password.trim();
    let isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      const cleanPass = normalizeStr(password);
      isMatch = await bcrypt.compare(cleanPass, user.passwordHash);
    }

    if (!isMatch) {
      return res.status(401).json({ message: 'Mật khẩu không chính xác' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        department: user.department,
        phone: user.phone,
        affiliations: user.affiliations,
        orcid: user.orcid,
        scholar: user.scholar,
        bio: user.bio,
        researchInterests: user.researchInterests,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation failed', errors: error.issues });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
