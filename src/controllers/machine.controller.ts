import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { z } from 'zod';

const machineSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  category: z.string().optional(),
  department: z.string().min(1),
  characteristics: z.string().optional(),
  status: z.enum(['IN_USE', 'NOT_IN_USE']).default('IN_USE'),
});

const logSchema = z.object({
  machineId: z.number().int().positive(),
  date: z.string(),
  minutes: z.number().int().positive(),
  projectId: z.number().int().positive(),
});

export const getMachines = async (req: Request, res: Response) => {
  try {
    const machines = await prisma.machine.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(machines);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi lấy danh sách máy móc' });
  }
};

export const createMachine = async (req: Request, res: Response) => {
  try {
    const data = machineSchema.parse(req.body);
    
    const existing = await prisma.machine.findUnique({ where: { code: data.code } });
    if (existing) {
      return res.status(400).json({ error: 'Mã tài sản đã tồn tại' });
    }

    const machine = await prisma.machine.create({
      data: {
        code: data.code,
        name: data.name,
        category: data.category,
        department: data.department,
        characteristics: data.characteristics,
        status: data.status,
      },
    });

    res.status(201).json(machine);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dữ liệu không hợp lệ', details: (err as any).errors });
    }
    console.error(err);
    res.status(500).json({ error: 'Lỗi tạo máy móc' });
  }
};

export const addMachineLog = async (req: Request, res: Response) => {
  try {
    const data = logSchema.parse(req.body);
    const userId = (req as any).user?.id;

    const machine = await prisma.machine.findUnique({ where: { id: data.machineId } });
    if (!machine) {
      return res.status(404).json({ error: 'Không tìm thấy máy móc' });
    }

    const log = await prisma.machineLog.create({
      data: {
        machineId: data.machineId,
        date: new Date(data.date),
        minutes: data.minutes,
        projectId: data.projectId,
        createdById: userId,
      },
      include: {
        machine: true,
        project: true,
        creator: true,
      }
    });

    res.status(201).json(log);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dữ liệu không hợp lệ', details: (err as any).errors });
    }
    console.error(err);
    res.status(500).json({ error: 'Lỗi ghi nhận tiêu hao' });
  }
};

export const getMachineLogs = async (req: Request, res: Response) => {
  try {
    const logs = await prisma.machineLog.findMany({
      orderBy: { date: 'desc' },
      include: {
        machine: true,
        project: true,
        creator: { select: { name: true } },
      },
      take: 200,
    });
    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi lấy lịch sử tiêu hao' });
  }
};

export const getMachineStatistics = async (req: Request, res: Response) => {
  try {
    const { month } = req.query; // format: 'YYYY-MM'
    if (!month || typeof month !== 'string') {
      return res.status(400).json({ error: 'Thiếu tham số month (YYYY-MM)' });
    }

    const [yearStr, monthStr] = month.split('-');
    const yearNum = parseInt(yearStr);
    const monthNum = parseInt(monthStr);

    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ error: 'Định dạng tháng không hợp lệ' });
    }

    // Tính số ngày trong tháng
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
    const totalMinutesInMonth = daysInMonth * 24 * 60;

    const startDate = new Date(yearNum, monthNum - 1, 1);
    const endDate = new Date(yearNum, monthNum, 1);

    // Filter logs for this month
    const logs = await prisma.machineLog.findMany({
      where: {
        date: {
          gte: startDate,
          lt: endDate,
        }
      },
      include: {
        machine: true,
        project: true,
      }
    });

    const machineMap: Record<number, any> = {};

    for (const log of logs) {
      if (!machineMap[log.machineId]) {
        machineMap[log.machineId] = {
          machineId: log.machineId,
          machineCode: log.machine.code,
          machineName: log.machine.name,
          totalMinutes: 0,
          percentUsage: 0,
          projectsMap: {}
        };
      }

      machineMap[log.machineId].totalMinutes += log.minutes;

      if (log.projectId) {
        if (!machineMap[log.machineId].projectsMap[log.projectId]) {
          machineMap[log.machineId].projectsMap[log.projectId] = {
            projectId: log.projectId,
            projectName: log.project?.name || 'Không xác định',
            minutes: 0,
          };
        }
        machineMap[log.machineId].projectsMap[log.projectId].minutes += log.minutes;
      }
    }

    const result = Object.values(machineMap).map((m: any) => {
      return {
        machineId: m.machineId,
        machineCode: m.machineCode,
        machineName: m.machineName,
        totalMinutes: m.totalMinutes,
        percentUsage: (m.totalMinutes / totalMinutesInMonth) * 100,
        projects: Object.values(m.projectsMap),
      };
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi lấy thống kê máy móc' });
  }
};
