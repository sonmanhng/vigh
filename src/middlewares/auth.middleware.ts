import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; role: string };
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });

    if (!user) {
      return res.status(401).json({ message: 'Invalid token. User not found.' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token.' });
  }
};

export const ADMIN_ROLES = ['SuperAdmin', 'VienTruong', 'VienPho', 'ADMIN'];
export const MANAGER_ROLES = ['SuperAdmin', 'VienTruong', 'VienPho', 'TruongPhong', 'ADMIN', 'MANAGER'];

export const isTopAdmin = (role: string) => ADMIN_ROLES.includes(role);
export const isManagerOrAbove = (role: string) => MANAGER_ROLES.includes(role);

export const authorizeRoles = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(403).json({ message: 'You do not have permission to perform this action.' });
    }
    const userRole = req.user.role;
    if (roles.includes(userRole)) {
      return next();
    }
    if (roles.includes('ADMIN') && ADMIN_ROLES.includes(userRole)) {
      return next();
    }
    if (roles.includes('MANAGER') && MANAGER_ROLES.includes(userRole)) {
      return next();
    }
    return res.status(403).json({ message: 'You do not have permission to perform this action.' });
  };
};
