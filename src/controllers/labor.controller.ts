import { Request, Response } from 'express';
import prisma from '../utils/prisma';

export const addLaborLog = async (req: Request, res: Response) => {
  try {
    const { date, adminHours, proHours, cleanHours, projectId } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!date) {
      return res.status(400).json({ error: 'Ngày không hợp lệ' });
    }

    const log = await prisma.laborLog.create({
      data: {
        userId,
        date: new Date(date),
        adminHours: Number(adminHours) || 0,
        proHours: Number(proHours) || 0,
        cleanHours: Number(cleanHours) || 0,
        projectId: projectId ? Number(projectId) : null,
      }
    });

    res.status(201).json(log);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi server khi thêm giờ công' });
  }
};

export const getMyLaborLogs = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const logs = await prisma.laborLog.findMany({
      where: { userId },
      include: {
        project: {
          select: { id: true, code: true, name: true }
        }
      },
      orderBy: [
        { date: 'desc' },
        { createdAt: 'desc' }
      ]
    });
    res.json(logs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi lấy lịch sử giờ công' });
  }
};

export const deleteLaborLog = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const log = await prisma.laborLog.findFirst({
      where: { id: Number(id), userId }
    });

    if (!log) {
      return res.status(404).json({ error: 'Không tìm thấy hoặc không có quyền xoá' });
    }

    await prisma.laborLog.delete({ where: { id: Number(id) } });
    res.json({ message: 'Xoá thành công' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi xoá giờ công' });
  }
};

// Calculate personal statistics
export const getMyLaborStats = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Lấy query
    const todayStr = req.query.date as string || new Date().toISOString().split('T')[0];
    const todayDate = new Date(todayStr);
    
    // Tính khoảng thời gian cho Tuần (Thứ 2 đến Chủ Nhật)
    const dayOfWeek = todayDate.getDay() || 7; // Sunday is 0, make it 7
    const monday = new Date(todayDate);
    monday.setDate(todayDate.getDate() - dayOfWeek + 1);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    // Tính khoảng thời gian cho Tháng
    const firstDayOfMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
    const lastDayOfMonth = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0, 23, 59, 59, 999);

    // Lấy tất cả log trong tháng để tính gộp
    const monthlyLogs = await prisma.laborLog.findMany({
      where: {
        userId,
        date: {
          gte: firstDayOfMonth,
          lte: lastDayOfMonth
        }
      },
      include: {
        project: {
          select: { id: true, code: true, name: true }
        }
      }
    });

    // Hàm tính toán %
    const calculateStats = (logs: any[]) => {
      if (logs.length === 0) {
        return { adminPercent: 0, proPercent: 0, cleanPercent: 0, totalHours: 0, loggedDays: 0 };
      }

      // Đếm số ngày có nhập liệu
      const uniqueDays = new Set(logs.map(l => l.date.toISOString().split('T')[0]));
      const loggedDays = uniqueDays.size;

      // Tổng số giờ làm việc chuẩn = loggedDays * 8
      const maxExpectedHours = loggedDays * 8;

      let adminTotal = 0;
      let proTotal = 0;
      let cleanTotal = 0;
      
      logs.forEach(l => {
        adminTotal += l.adminHours;
        proTotal += l.proHours;
        cleanTotal += l.cleanHours;
      });

      const totalHours = adminTotal + proTotal + cleanTotal;

      return {
        adminPercent: maxExpectedHours > 0 ? (adminTotal / maxExpectedHours) * 100 : 0,
        proPercent: maxExpectedHours > 0 ? (proTotal / maxExpectedHours) * 100 : 0,
        cleanPercent: maxExpectedHours > 0 ? (cleanTotal / maxExpectedHours) * 100 : 0,
        totalHours,
        loggedDays,
        maxExpectedHours
      };
    };

    // Filter logs for Day and Week
    const todayDateStr = todayDate.toISOString().split('T')[0];
    const dailyLogs = monthlyLogs.filter((l: any) => l.date.toISOString().split('T')[0] === todayDateStr);
    const weeklyLogs = monthlyLogs.filter((l: any) => l.date >= monday && l.date <= sunday);

    // Tính % cho Ngày, Tuần, Tháng
    const dailyStats = calculateStats(dailyLogs);
    const weeklyStats = calculateStats(weeklyLogs);
    const monthlyStats = calculateStats(monthlyLogs);

    // Tính % theo Dự án trong Tháng (Chỉ dựa trên giờ Chuyên môn)
    const projectMap: Record<string, { projectId: number, projectName: string, projectCode: string, totalHours: number }> = {};
    let totalMonthlyProHours = 0;
    monthlyLogs.forEach((l: any) => {
      const pId = l.projectId ? l.projectId.toString() : 'none';
      if (!projectMap[pId]) {
        projectMap[pId] = {
          projectId: l.projectId || 0,
          projectName: l.project?.name || 'Khác',
          projectCode: l.project?.code || '',
          totalHours: 0
        };
      }
      projectMap[pId].totalHours += l.proHours;
      totalMonthlyProHours += l.proHours;
    });

    const projectStats = Object.values(projectMap).map(p => ({
      ...p,
      percent: totalMonthlyProHours > 0 ? (p.totalHours / totalMonthlyProHours) * 100 : 0
    })).sort((a, b) => b.percent - a.percent);

    res.json({
      daily: dailyStats,
      weekly: weeklyStats,
      monthly: monthlyStats,
      projects: projectStats
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi lấy thống kê cá nhân' });
  }
};

export const getAdminLaborStats = async (req: Request, res: Response) => {
  try {
    const { month } = req.query; // YYYY-MM
    if (!month || typeof month !== 'string') {
      return res.status(400).json({ error: 'Vui lòng truyền tham số month (YYYY-MM)' });
    }

    const year = parseInt(month.split('-')[0]);
    const monthNum = parseInt(month.split('-')[1]) - 1;

    const firstDayOfMonth = new Date(year, monthNum, 1);
    const lastDayOfMonth = new Date(year, monthNum + 1, 0, 23, 59, 59, 999);

    const logs = await prisma.laborLog.findMany({
      where: {
        date: {
          gte: firstDayOfMonth,
          lte: lastDayOfMonth
        }
      },
      include: {
        user: { select: { id: true, name: true, role: true, department: true } },
        project: { select: { id: true, code: true, name: true } }
      }
    });

    // Group by User
    const userMap: Record<number, any> = {};

    logs.forEach((l: any) => {
      if (!userMap[l.userId]) {
        userMap[l.userId] = {
          userId: l.userId,
          userName: l.user.name,
          department: l.user.department,
          logs: [],
        };
      }
      userMap[l.userId].logs.push(l);
    });

    // Calculate stats per user
    const result = Object.values(userMap).map(u => {
      const uniqueDays = new Set(u.logs.map((l: any) => l.date.toISOString().split('T')[0]));
      const loggedDays = uniqueDays.size;
      const maxExpectedHours = loggedDays * 8;

      let adminTotal = 0;
      let proTotal = 0;
      let cleanTotal = 0;

      u.logs.forEach((l: any) => {
        adminTotal += l.adminHours;
        proTotal += l.proHours;
        cleanTotal += l.cleanHours;
      });

      // Tính % theo Dự án trong Tháng (Chỉ dựa trên giờ Chuyên môn)
      const projectMap: Record<string, { projectId: number, projectName: string, projectCode: string, totalHours: number }> = {};
      let totalProHours = 0;
      u.logs.forEach((l: any) => {
        const pId = l.projectId ? l.projectId.toString() : 'none';
        if (!projectMap[pId]) {
          projectMap[pId] = {
            projectId: l.projectId || 0,
            projectName: l.project?.name || 'Khác',
            projectCode: l.project?.code || '',
            totalHours: 0
          };
        }
        projectMap[pId].totalHours += l.proHours;
        totalProHours += l.proHours;
      });

      const projects = Object.values(projectMap).map(p => ({
        ...p,
        percent: totalProHours > 0 ? (p.totalHours / totalProHours) * 100 : 0
      })).sort((a, b) => b.percent - a.percent);

      return {
        userId: u.userId,
        userName: u.userName,
        department: u.department,
        loggedDays,
        adminPercent: maxExpectedHours > 0 ? (adminTotal / maxExpectedHours) * 100 : 0,
        proPercent: maxExpectedHours > 0 ? (proTotal / maxExpectedHours) * 100 : 0,
        cleanPercent: maxExpectedHours > 0 ? (cleanTotal / maxExpectedHours) * 100 : 0,
        projects
      };
    });

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi lấy thống kê toàn hệ thống' });
  }
};

export const createOvertimeRequest = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { date, hours, reason, projectId, approver1Id, approver2Id } = req.body;

    if (!date || !hours || !reason || !approver1Id || !approver2Id) {
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin bắt buộc' });
    }

    const request = await prisma.overtimeRequest.create({
      data: {
        userId,
        date: new Date(date),
        hours: Number(hours),
        reason,
        projectId: projectId ? Number(projectId) : null,
        approver1Id: Number(approver1Id),
        approver2Id: Number(approver2Id),
      }
    });

    res.status(201).json(request);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi server khi tạo đề xuất' });
  }
};

export const getMyOvertimeRequests = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const requests = await prisma.overtimeRequest.findMany({
      where: { userId },
      include: {
        project: { select: { id: true, code: true, name: true } },
        approver1: { select: { id: true, name: true, role: true } },
        approver2: { select: { id: true, name: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(requests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi lấy danh sách đề xuất' });
  }
};

export const getPendingOvertimeRequests = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Requests waiting for approver1 or approver2
    const requests = await prisma.overtimeRequest.findMany({
      where: {
        OR: [
          { approver1Id: userId, level1Status: 'PENDING' },
          { approver2Id: userId, level1Status: 'APPROVED', level2Status: 'PENDING' }
        ]
      },
      include: {
        user: { select: { id: true, name: true, department: true } },
        project: { select: { id: true, code: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(requests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi lấy danh sách duyệt đề xuất' });
  }
};

export const approveOvertimeRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'APPROVE' or 'REJECT'
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const request = await prisma.overtimeRequest.findUnique({
      where: { id: Number(id) }
    });

    if (!request) return res.status(404).json({ error: 'Không tìm thấy đề xuất' });

    let dataToUpdate: any = {};

    if (request.approver1Id === userId && request.level1Status === 'PENDING') {
      dataToUpdate.level1Status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      if (action === 'REJECTED') {
        dataToUpdate.status = 'REJECTED';
      } else {
        dataToUpdate.status = 'PENDING_LEVEL_2';
      }
    } else if (request.approver2Id === userId && request.level1Status === 'APPROVED' && request.level2Status === 'PENDING') {
      dataToUpdate.level2Status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      dataToUpdate.status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    } else {
      return res.status(403).json({ error: 'Bạn không có quyền duyệt đề xuất này ở thời điểm hiện tại' });
    }

    const updated = await prisma.overtimeRequest.update({
      where: { id: Number(id) },
      data: dataToUpdate
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi duyệt đề xuất' });
  }
};
