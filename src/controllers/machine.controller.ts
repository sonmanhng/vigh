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
            projectCode: log.project?.code || '',
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

// DELETE /api/machines/:id - Xoá máy móc
export const deleteMachine = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Check if machine is used in logs
    const logCount = await prisma.machineLog.count({
      where: { machineId: Number(id) }
    });

    if (logCount > 0) {
      return res.status(400).json({ error: 'Không thể xoá thiết bị đã có dữ liệu tiêu hao. Vui lòng chuyển trạng thái sang "Không sử dụng".' });
    }

    await prisma.machine.delete({
      where: { id: Number(id) }
    });
    
    res.json({ message: 'Xoá thiết bị thành công' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi server' });
  }
};

// PUT /api/machines/:id - Cập nhật máy móc
export const updateMachine = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { code, name, category, department, characteristics, status } = req.body;
    
    // Check code duplication
    if (code) {
      const existing = await prisma.machine.findFirst({
        where: { 
          code, 
          id: { not: Number(id) } 
        }
      });
      if (existing) {
        return res.status(400).json({ error: 'Mã tài sản đã tồn tại' });
      }
    }

    const machine = await prisma.machine.update({
      where: { id: Number(id) },
      data: {
        code,
        name,
        category,
        department,
        characteristics,
        status,
      }
    });
    res.json(machine);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi server' });
  }
};

export const importMachines = async (req: Request, res: Response) => {
  try {
    const { machines } = req.body;
    if (!Array.isArray(machines)) {
      return res.status(400).json({ error: 'Dữ liệu không hợp lệ. Mong đợi một mảng các máy móc.' });
    }

    let successCount = 0;
    for (const machine of machines) {
      if (!machine.code || !machine.name || !machine.department) continue;
      
      const status = machine.status === 'NOT_IN_USE' ? 'NOT_IN_USE' : 'IN_USE';
      
      await prisma.machine.upsert({
        where: { code: machine.code },
        update: {
          name: machine.name,
          category: machine.category,
          department: machine.department,
          characteristics: machine.characteristics,
          status: status
        },
        create: {
          code: machine.code,
          name: machine.name,
          category: machine.category,
          department: machine.department,
          characteristics: machine.characteristics,
          status: status
        }
      });
      successCount++;
    }

    res.json({ message: `Đã import thành công ${successCount} thiết bị/máy móc.` });
  } catch (error) {
    console.error('Error importing machines:', error);
    res.status(500).json({ error: 'Lỗi server khi import máy móc' });
  }
};
