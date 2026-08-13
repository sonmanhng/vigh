import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import ExcelJS from 'exceljs';

export const createProposal = async (req: any, res: Response) => {
  try {
    const { items, note, approver1Id, approver2Id } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Danh sách đề xuất rỗng' });
    }

    const role = req.user.role;
    let level1Status = 'PENDING';
    let level2Status = 'PENDING';
    let overallStatus = 'PENDING';

    if (role === 'VienTruong' || role === 'SuperAdmin') {
      level1Status = 'APPROVED';
      level2Status = 'APPROVED';
      overallStatus = 'APPROVED';
    } 
    else if (approver1Id && req.user.id === Number(approver1Id)) {
      level1Status = 'APPROVED';
      overallStatus = 'PENDING_LEVEL_2';
    }

    const proposal = await prisma.stationeryProposal.create({
      data: {
        createdById: req.user.id,
        approver1Id: approver1Id ? Number(approver1Id) : null,
        approver2Id: approver2Id ? Number(approver2Id) : null,
        level1Status,
        level2Status,
        status: overallStatus,
        note,
        items: {
          create: items.map((i: any) => ({
            stationeryName: i.stationeryName,
            unit: i.unit,
            quantity: Number(i.quantity) || 0,
            note: i.note
          }))
        }
      },
      include: { items: true }
    });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (overallStatus === 'PENDING' && approver1Id) {
      await prisma.notification.create({
        data: {
          userId: Number(approver1Id),
          title: 'Đề xuất mua văn phòng phẩm mới',
          message: `${user?.name} vừa gửi đề xuất mua văn phòng phẩm. Vui lòng kiểm tra và phê duyệt.`,
          type: 'PROPOSAL_PENDING',
        }
      });
    } else if (overallStatus === 'PENDING_LEVEL_2' && approver2Id) {
      await prisma.notification.create({
        data: {
          userId: Number(approver2Id),
          title: 'Đề xuất mua văn phòng phẩm cần duyệt cấp 2',
          message: `Đề xuất mua VPP của ${user?.name} đã được duyệt cấp 1. Vui lòng kiểm tra và phê duyệt.`,
          type: 'PROPOSAL_PENDING',
        }
      });
    }

    res.status(201).json(proposal);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi khi tạo đề xuất' });
  }
};

export const getProposals = async (req: any, res: Response) => {
  try {
    const proposals = await prisma.stationeryProposal.findMany({
      include: {
        creator: { select: { name: true, email: true } },
        approver1: { select: { name: true, email: true } },
        approver2: { select: { name: true, email: true } },
        items: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(proposals);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi lấy danh sách đề xuất' });
  }
};

export const updateProposalStatus = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { action } = req.body; 
    const role = req.user.role;
    const userId = req.user.id;

    const proposal = await prisma.stationeryProposal.findUnique({
      where: { id: Number(id) },
      include: { creator: true }
    });

    if (!proposal) return res.status(404).json({ error: 'Không tìm thấy đề xuất' });

    let { level1Status, level2Status, status } = proposal;

    if (role === 'VienTruong' || role === 'SuperAdmin') {
      if (action === 'APPROVE') {
        level1Status = 'APPROVED';
        level2Status = 'APPROVED';
        status = 'APPROVED';
      } else {
        level1Status = 'REJECTED';
        level2Status = 'REJECTED';
        status = 'REJECTED';
      }
    } else {
      if (proposal.approver1Id === userId && level1Status === 'PENDING') {
        if (action === 'APPROVE') {
          level1Status = 'APPROVED';
          status = proposal.approver2Id ? 'PENDING_LEVEL_2' : 'APPROVED';
        } else {
          level1Status = 'REJECTED';
          status = 'REJECTED';
        }
      } else if (proposal.approver2Id === userId && status === 'PENDING_LEVEL_2') {
        if (action === 'APPROVE') {
          level2Status = 'APPROVED';
          status = 'APPROVED';
        } else {
          level2Status = 'REJECTED';
          status = 'REJECTED';
        }
      } else {
        return res.status(403).json({ error: 'Không có quyền duyệt đề xuất này ở cấp hiện tại' });
      }
    }

    const updated = await prisma.stationeryProposal.update({
      where: { id: Number(id) },
      data: { level1Status, level2Status, status }
    });

    if (status === 'APPROVED' || status === 'REJECTED') {
      if (proposal.createdById) {
        await prisma.notification.create({
          data: {
            userId: proposal.createdById,
            title: `Đề xuất VPP đã bị ${status === 'APPROVED' ? 'Duyệt' : 'Từ chối'}`,
            message: `Đề xuất mua văn phòng phẩm của bạn đã ${status === 'APPROVED' ? 'được phê duyệt' : 'bị từ chối'}.`,
            type: 'PROPOSAL_RESULT',
          }
        });
      }
    } else if (status === 'PENDING_LEVEL_2' && proposal.approver2Id) {
      await prisma.notification.create({
        data: {
          userId: proposal.approver2Id,
          title: 'Đề xuất mua VPP cần duyệt cấp 2',
          message: `Đề xuất của ${proposal.creator?.name} đã được duyệt cấp 1. Vui lòng phê duyệt.`,
          type: 'PROPOSAL_PENDING',
        }
      });
    }

    res.json(updated);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi cập nhật trạng thái' });
  }
};

export const deleteProposal = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    const proposal = await prisma.stationeryProposal.findUnique({ where: { id: Number(id) } });
    if (!proposal) return res.status(404).json({ error: 'Không tìm thấy' });

    if (proposal.createdById !== userId && role !== 'SuperAdmin') {
      return res.status(403).json({ error: 'Không có quyền xoá' });
    }

    await prisma.stationeryProposal.delete({ where: { id: Number(id) } });
    res.json({ message: 'Xoá thành công' });
  } catch (err: any) {
    res.status(500).json({ error: 'Lỗi xoá đề xuất' });
  }
};

export const exportProposals = async (req: any, res: Response) => {
  try {
    const { status, month, year } = req.query;
    const whereClause: any = {};
    if (status) whereClause.status = status;
    
    if (month && year) {
      const startDate = new Date(Number(year), Number(month) - 1, 1);
      const endDate = new Date(Number(year), Number(month), 0);
      whereClause.createdAt = { gte: startDate, lte: endDate };
    }

    const proposals = await prisma.stationeryProposal.findMany({
      where: whereClause,
      include: {
        creator: { select: { name: true } },
        items: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Danh Sach Du Tru VPP');

    sheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Người đề xuất', key: 'creator', width: 25 },
      { header: 'Trạng thái', key: 'status', width: 20 },
      { header: 'Ngày tạo', key: 'createdAt', width: 20 },
      { header: 'Tên VPP', key: 'stationeryName', width: 35 },
      { header: 'Đơn vị', key: 'unit', width: 15 },
      { header: 'Số lượng', key: 'quantity', width: 15 },
      { header: 'Ghi chú', key: 'note', width: 30 },
    ];

    sheet.getRow(1).font = { bold: true };

    proposals.forEach((p: any) => {
      if (p.items && p.items.length > 0) {
        p.items.forEach((item: any) => {
          sheet.addRow({
            id: p.id,
            creator: p.creator?.name || 'N/A',
            status: p.status,
            createdAt: p.createdAt.toLocaleDateString('vi-VN'),
            stationeryName: item.stationeryName,
            unit: item.unit,
            quantity: item.quantity,
            note: item.note || ''
          });
        });
      } else {
        sheet.addRow({
          id: p.id,
          creator: p.creator?.name || 'N/A',
          status: p.status,
          createdAt: p.createdAt.toLocaleDateString('vi-VN'),
          stationeryName: '', unit: '', quantity: '', note: ''
        });
      }
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Du_tru_VPP.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err: any) {
    res.status(500).json({ error: 'Lỗi export excel' });
  }
};
