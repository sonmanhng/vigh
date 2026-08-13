import { Request, Response } from 'express';
import prisma from '../utils/prisma';

export const getHomeStats = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isAdminOrManager = ['SuperAdmin', 'VienTruong', 'VienPho', 'TruongPhong', 'ADMIN', 'MANAGER'].includes(user.role);

    // 1. Chemicals & Cells & Stationeries running low
    let lowChemicals: any[] = [];
    let lowCells: any[] = [];
    let lowStationeries: any[] = [];
    
    if (isAdminOrManager || user.role === 'ChuyenVien') {
      const allChemicals = await prisma.chemical.findMany();
      lowChemicals = allChemicals.filter((c: any) => c.maxQuantity > 0 && c.quantity <= (c.maxQuantity * c.alertThreshold / 100));
      
      const allCells = await prisma.cell.findMany();
      lowCells = allCells.filter((c: any) => c.maxQuantity > 0 && c.quantity <= (c.maxQuantity * c.alertThreshold / 100));

      const allStationeries = await prisma.stationery.findMany();
      lowStationeries = allStationeries.filter((c: any) => c.quantity <= c.alertThreshold);
    }

    // 2. Upcoming deadlines (Projects ending within 14 days)
    const now = new Date();
    const fourteenDaysLater = new Date();
    fourteenDaysLater.setDate(now.getDate() + 14);

    const projects = await prisma.project.findMany({
      where: isAdminOrManager ? {} : {
        OR: [
          { managerId: userId },
          { members: { some: { id: userId } } }
        ]
      },
      select: { id: true, name: true, endDate: true, status: true }
    });
    
    // Convert string endDate to Date and filter
    const upcomingProjects = projects.filter((p: any) => {
      if (!p.endDate) return false;
      const end = new Date(p.endDate);
      return end >= now && end <= fourteenDaysLater;
    });

    // 3. Incoming reports (WeeklyReports where recipientId == userId, last 14 days)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(now.getDate() - 14);
    
    const incomingReports = await prisma.weeklyReport.findMany({
      where: {
        recipientId: userId,
        createdAt: { gte: fourteenDaysAgo }
      },
      include: {
        reporter: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    // 4. Upcoming Meetings (where user is participant and date >= today)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const upcomingMeetings = await prisma.meeting.findMany({
      where: {
        date: { gte: startOfToday },
        OR: [
          { createdById: userId },
          { participants: { some: { userId } } }
        ]
      },
      include: {
        creator: { select: { name: true } }
      },
      orderBy: { date: 'asc' },
      take: 10
    });

    // 5. Pending Approvals (ChemicalProposals, CellProposals, OvertimeRequests, Projects)
    const pendingChemicalProposals = await prisma.chemicalProposal.findMany({
      where: {
        OR: [
          { approver1Id: userId, level1Status: 'PENDING' },
          { approver2Id: userId, level2Status: 'PENDING' }
        ]
      },
      include: { creator: { select: { name: true } } }
    });

    const pendingCellProposals = await prisma.cellProposal.findMany({
      where: {
        OR: [
          { approver1Id: userId, level1Status: 'PENDING' },
          { approver2Id: userId, level2Status: 'PENDING' }
        ]
      },
      include: { creator: { select: { name: true } } }
    });
    
    const pendingStationeryProposals = await prisma.stationeryProposal.findMany({
      where: {
        OR: [
          { approver1Id: userId, level1Status: 'PENDING' },
          { approver2Id: userId, level2Status: 'PENDING' }
        ]
      },
      include: { creator: { select: { name: true } } }
    });
    
    const pendingOvertimes = await prisma.overtimeRequest.findMany({
      where: {
        OR: [
          { approver1Id: userId, level1Status: 'PENDING' },
          { approver2Id: userId, level2Status: 'PENDING' }
        ]
      },
      include: { user: { select: { name: true } } }
    });

    const pendingProjects = await prisma.project.findMany({
      where: { approverId: userId, status: 'PENDING' }
    });

    res.json({
      lowStock: {
        chemicals: lowChemicals,
        cells: lowCells,
        stationeries: lowStationeries
      },
      upcomingDeadlines: {
        projects: upcomingProjects
      },
      incomingReports,
      upcomingMeetings,
      pendingApprovals: {
        chemicalProposals: pendingChemicalProposals,
        cellProposals: pendingCellProposals,
        stationeryProposals: pendingStationeryProposals,
        overtimes: pendingOvertimes,
        projects: pendingProjects
      }
    });
  } catch (error: any) {
    console.error('Error fetching home stats:', error);
    res.status(500).json({ message: error.message });
  }
};
