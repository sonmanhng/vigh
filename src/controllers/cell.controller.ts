import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { getIO } from '../socket';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import path from 'path';

// Danh sách phòng ban hợp lệ cho tế bào
export const CELL_DEPARTMENTS = [
  'Phòng Công nghệ Dược',
  'Phòng Thử nghiệm Sinh học',
  'Phòng Tài nguyên và Công nghệ Sinh học',
  'Phòng Khoa học Công nghệ',
] as const;

// Danh sách phòng ban người dùng hợp lệ
export const USER_DEPARTMENTS = [
  'Ban lãnh đạo',
  'Phòng Khoa học Công nghệ',
  'Phòng Sinh học',
  'Phòng Công nghệ Dược',
] as const;

/**
 * Lấy danh sách phòng ban tế bào mà user có quyền xem/thao tác.
 * Trả về undefined nghĩa là xem được tất cả.
 */
function getAllowedCellDepts(user: any): string[] | undefined {
  const fullAccessRoles = ['SuperAdmin', 'VienTruong', 'VienPho', 'ADMIN'];
  if (fullAccessRoles.includes(user.role)) return undefined; // Toàn quyền
  
  const dept = user.department || '';
  if (dept === 'Ban lãnh đạo') return undefined;
  if (dept === 'Phòng Sinh học') return ['Phòng Thử nghiệm Sinh học', 'Phòng Tài nguyên và Công nghệ Sinh học'];
  if (dept === 'Phòng Khoa học Công nghệ') return ['Phòng Khoa học Công nghệ'];
  if (dept === 'Phòng Công nghệ Dược') return ['Phòng Công nghệ Dược'];
  return [];
}

const cellSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  ref: z.string().optional(),
  lot: z.string().optional(),
  v: z.string().optional(),
  p: z.string().optional(),
  unit: z.string().min(1).default('Ống'),
  quantity: z.number().min(0),
  maxQuantity: z.number().min(0).default(0),
  specification: z.number().min(0.001).default(1),
  invoicePrice: z.number().min(0).default(0),
  importDate: z.string().optional(),
  alertThreshold: z.number().min(0).default(5),
  department: z.string().optional(),
  location: z.string().optional(),
  note: z.string().optional(),
});

const exportSchema = z.object({
  projectCode: z.string().min(1),
  quantity: z.number().min(0.001),
  note: z.string().optional(),
});

// GET /api/cells — Lấy kho tế bào theo phòng ban của user
export const getCells = async (req: Request, res: Response) => {
  try {
    const allowed = getAllowedCellDepts((req as any).user);
    const where: any = {};
    if (allowed !== undefined) {
      where.department = { in: allowed };
    }

    const cells = await prisma.cell.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    res.json(cells);
  } catch (error) {
    console.error('Error fetching cells:', error);
    res.status(500).json({ error: 'Lỗi tải danh sách tế bào' });
  }
};

// GET /api/cells/transactions — Lấy lịch sử giao dịch (Nhập/Xuất kho)
export const getTransactions = async (req: Request, res: Response) => {
  try {
    const allowed = getAllowedCellDepts((req as any).user);
    const where: any = {};
    if (allowed !== undefined) {
      where.cell = { department: { in: allowed } };
    }

    const transactions = await prisma.cellTransaction.findMany({
      where,
      include: {
        cell: {
          select: { code: true, name: true, unit: true, department: true, ref: true, lot: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Lỗi tải lịch sử giao dịch' });
  }
};

// GET /api/cells/statistics — Thống kê tế bào đã xuất theo đề tài
export const getProjectStatistics = async (req: Request, res: Response) => {
  try {
    const allowed = getAllowedCellDepts((req as any).user);
    const whereClause: any = { type: 'EXPORT', projectCode: { not: null } };
    if (allowed !== undefined) {
      whereClause.cell = { department: { in: allowed } };
    }

    const transactions = await prisma.cellTransaction.findMany({
      where: whereClause,
      include: {
        cell: {
          select: { code: true, name: true, unit: true, unitPrice: true, department: true, ref: true, lot: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const byProject: Record<string, {
      projectCode: string;
      totalValue: number;
      exportCount: number;
      items: {
        cellCode: string;
        cellName: string;
        ref?: string | null;
        lot?: string | null;
        unit: string;
        quantity: number;
        unitPrice: number;
        totalValue: number;
        department: string;
        exportDate: string;
        note?: string | null;
      }[];
    }> = {};

    const byDepartment: Record<string, { totalValue: number; exportCount: number }> = {};

    for (const tx of transactions) {
      const pCode = tx.projectCode || 'Khác';
      const c = tx.cell;
      if (!c) continue;
      const val = tx.quantity * c.unitPrice;

      if (!byProject[pCode]) {
        byProject[pCode] = { projectCode: pCode, totalValue: 0, exportCount: 0, items: [] };
      }
      byProject[pCode].totalValue += val;
      byProject[pCode].exportCount += 1;
      byProject[pCode].items.push({
        cellCode: c.code,
        cellName: c.name,
        ref: c.ref,
        lot: c.lot,
        unit: c.unit,
        quantity: tx.quantity,
        unitPrice: c.unitPrice,
        totalValue: val,
        department: c.department || '',
        exportDate: tx.createdAt.toISOString(),
        note: tx.note,
      });

      const dept = c.department || 'Khác';
      if (!byDepartment[dept]) {
        byDepartment[dept] = { totalValue: 0, exportCount: 0 };
      }
      byDepartment[dept].totalValue += val;
      byDepartment[dept].exportCount += 1;
    }

    res.json({
      byProject: Object.values(byProject).sort((a, b) => b.totalValue - a.totalValue),
      byDepartment: Object.entries(byDepartment).map(([dept, data]) => ({
        department: dept,
        ...data,
      })),
      totalExportValue: Object.values(byProject).reduce((s, p) => s + p.totalValue, 0),
      totalExportCount: transactions.length,
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Lỗi tải dữ liệu thống kê' });
  }
};

// POST /api/cells — Thêm mới tế bào
export const createCell = async (req: Request, res: Response) => {
  try {
    const data = cellSchema.parse(req.body);

    const existing = await prisma.cell.findUnique({ where: { code: data.code } });
    if (existing) {
      return res.status(400).json({ error: 'Mã tế bào đã tồn tại' });
    }

    const unitPrice = data.specification > 0 ? data.invoicePrice / data.specification : 0;
    const importDate = data.importDate ? new Date(data.importDate) : new Date();

    const cell = await prisma.cell.create({
      data: {
        code: data.code,
        name: data.name,
        ref: data.ref || null,
        lot: data.lot || null,
        v: data.v || null,
        p: data.p || null,
        unit: data.unit,
        quantity: data.quantity,
        maxQuantity: data.maxQuantity,
        specification: data.specification,
        invoicePrice: data.invoicePrice,
        unitPrice,
        importDate,
        alertThreshold: data.alertThreshold,
        department: data.department || null,
        location: data.location || null,
        note: data.note || null,
        transactions: {
          create: {
            type: 'IMPORT',
            quantity: data.quantity,
            note: 'Nhập kho ban đầu',
            createdById: (req as any).user?.id,
          },
        },
      },
    });

    getIO().emit('cell_updated', { action: 'create', cell });
    res.status(201).json(cell);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: (error as any).errors });
    }
    console.error('Error creating cell:', error);
    res.status(500).json({ error: 'Lỗi thêm tế bào' });
  }
};

// PUT /api/cells/:id — Cập nhật thông tin tế bào
export const updateCell = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = cellSchema.partial().parse(req.body);

    const existing = await prisma.cell.findUnique({ where: { id: Number(id) } });
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy tế bào' });

    let unitPrice = existing.unitPrice;
    if (data.invoicePrice !== undefined || data.specification !== undefined) {
      const inv = data.invoicePrice ?? existing.invoicePrice;
      const spec = data.specification ?? existing.specification;
      unitPrice = spec > 0 ? inv / spec : 0;
    }

    const oldQty = existing.quantity;
    const newQty = data.quantity ?? oldQty;
    const diff = newQty - oldQty;

    const cell = await prisma.cell.update({
      where: { id: Number(id) },
      data: {
        ...data,
        unitPrice,
        importDate: data.importDate ? new Date(data.importDate) : existing.importDate,
      },
    });

    if (diff !== 0) {
      await prisma.cellTransaction.create({
        data: {
          type: diff > 0 ? 'IMPORT' : 'EXPORT',
          cellId: cell.id,
          quantity: Math.abs(diff),
          note: `Điều chỉnh thủ công (${diff > 0 ? '+' : ''}${diff})`,
          createdById: (req as any).user?.id,
        },
      });
    }

    getIO().emit('cell_updated', { action: 'update', cell });
    res.json(cell);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: (error as any).errors });
    console.error('Error updating cell:', error);
    res.status(500).json({ error: 'Lỗi cập nhật tế bào' });
  }
};

// DELETE /api/cells/:id — Xoá tế bào
export const deleteCell = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.cell.delete({ where: { id: Number(id) } });
    getIO().emit('cell_updated', { action: 'delete', id: Number(id) });
    res.json({ message: 'Đã xoá tế bào thành công' });
  } catch (error) {
    console.error('Error deleting cell:', error);
    res.status(500).json({ error: 'Lỗi xoá tế bào' });
  }
};

// POST /api/cells/:id/export — Xuất tế bào cho dự án
export const exportCell = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = exportSchema.parse(req.body);

    const existing = await prisma.cell.findUnique({ where: { id: Number(id) } });
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy tế bào' });

    if (existing.quantity < data.quantity) {
      return res.status(400).json({
        error: `Tồn kho không đủ để xuất. (Tồn hiện tại: ${existing.quantity} ${existing.unit})`,
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const cell = await tx.cell.update({
        where: { id: Number(id) },
        data: { quantity: { decrement: data.quantity } },
      });

      await tx.cellTransaction.create({
        data: {
          type: 'EXPORT',
          cellId: cell.id,
          projectCode: data.projectCode,
          quantity: data.quantity,
          note: data.note || `Xuất sử dụng cho đề tài ${data.projectCode}`,
          createdById: (req as any).user?.id,
        },
      });

      return cell;
    });

    getIO().emit('cell_updated', { action: 'update', cell: updated });
    res.json(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: (error as any).errors });
    console.error('Error exporting cell:', error);
    res.status(500).json({ error: 'Lỗi xuất kho tế bào' });
  }
};

// POST /api/cells/import — Nhập hàng loạt từ file Excel
export const importCells = async (req: Request, res: Response) => {
  try {
    const { cells } = req.body;
    if (!Array.isArray(cells)) {
      return res.status(400).json({ error: 'Dữ liệu không hợp lệ. Mong đợi một mảng tế bào.' });
    }

    let successCount = 0;
    for (const item of cells) {
      if (!item.code || !item.name) continue;
      
      const quantity = Number(item.quantity) || 0;
      const maxQuantity = Number(item.maxQuantity) || 0;
      const specification = Number(item.specification) || 1;
      const invoicePrice = Number(item.invoicePrice) || 0;
      const unitPrice = invoicePrice / specification;
      const alertThreshold = Number(item.alertThreshold) || 5;
      const importDate = item.importDate ? new Date(item.importDate) : new Date();

      const existing = await prisma.cell.findUnique({ where: { code: item.code } });

      if (existing) {
        await prisma.cell.update({
          where: { code: item.code },
          data: {
            quantity: { increment: quantity },
            name: item.name,
            ref: item.ref || existing.ref,
            lot: item.lot || existing.lot,
            v: item.v || existing.v,
            p: item.p || existing.p,
            unit: item.unit || existing.unit,
            maxQuantity,
            specification,
            invoicePrice,
            unitPrice,
            importDate,
            alertThreshold,
            department: item.department || existing.department,
            location: item.location || existing.location,
            note: item.note || existing.note,
            transactions: {
              create: {
                type: 'IMPORT',
                quantity,
                note: `Nhập bổ sung từ Excel — Ngày ${importDate.toLocaleDateString('vi-VN')}`,
                createdById: (req as any).user?.id,
              },
            },
          }
        });
      } else {
        await prisma.cell.create({
          data: {
            code: item.code,
            name: item.name,
            ref: item.ref || null,
            lot: item.lot || null,
            v: item.v || null,
            p: item.p || null,
            unit: item.unit || 'Ống',
            quantity,
            maxQuantity,
            specification,
            invoicePrice,
            unitPrice,
            importDate,
            alertThreshold,
            department: item.department || null,
            location: item.location || null,
            note: item.note || null,
            transactions: {
              create: {
                type: 'IMPORT',
                quantity,
                note: 'Nhập kho mới từ file Excel',
                createdById: (req as any).user?.id,
              },
            },
          }
        });
      }
      successCount++;
    }

    getIO().emit('cell_updated', { action: 'import' });
    res.json({ message: `Đã xử lý nhập kho thành công ${successCount} dòng tế bào` });
  } catch (error) {
    console.error('Error importing cells:', error);
    res.status(500).json({ error: 'Lỗi nhập dữ liệu tế bào từ file Excel' });
  }
};

// ——— CELL PROPOSAL ENDPOINTS ———

// GET /api/cells/approvers
export const getApprovers = async (req: any, res: any) => {
  try {
    const approver1List = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true, name: true, department: true }
    });

    const approver2List = await prisma.user.findMany({
      where: { role: { in: ['VienTruong', 'VienPho'] } },
      select: { id: true, name: true, role: true }
    });

    res.json({ approver1: approver1List, approver2: approver2List });
  } catch (error) {
    console.error('Error getting approvers:', error);
    res.status(500).json({ error: 'Lỗi lấy danh sách người duyệt' });
  }
};

// POST /api/cells/proposals
export const createProposal = async (req: any, res: any) => {
  try {
    const { approver1Id, approver2Id, note, items } = req.body;
    const createdById = req.user.id;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Danh sách tế bào đề xuất không được để trống' });
    }

    const proposal = await prisma.cellProposal.create({
      data: {
        createdById,
        approver1Id: approver1Id ? Number(approver1Id) : null,
        approver2Id: approver2Id ? Number(approver2Id) : null,
        note,
        status: 'PENDING',
        level1Status: 'PENDING',
        level2Status: 'PENDING',
        items: {
          create: items.map((i: any) => ({
            cellName: i.cellName,
            ref: i.ref || null,
            lot: i.lot || null,
            v: i.v || null,
            p: i.p || null,
            unit: i.unit || 'Ống',
            quantity: Number(i.quantity),
            phase: i.phase || '',
            projectId: i.projectId ? Number(i.projectId) : null,
            projectCode: i.projectCode || null
          }))
        }
      },
      include: { items: true }
    });

    getIO().emit('cell_proposal_updated', { action: 'create', proposalId: proposal.id });
    res.status(201).json(proposal);
  } catch (error) {
    console.error('Error creating proposal:', error);
    res.status(500).json({ error: 'Lỗi tạo đề xuất mua sắm tế bào' });
  }
};

// GET /api/cells/proposals
export const getProposals = async (req: any, res: any) => {
  try {
    const user = req.user;
    const where: any = {};

    const fullAccessRoles = ['SuperAdmin', 'VienTruong', 'VienPho', 'ADMIN'];
    if (!fullAccessRoles.includes(user.role)) {
      where.OR = [
        { createdById: user.id },
        { approver1Id: user.id },
        { approver2Id: user.id }
      ];
    }

    const proposals = await prisma.cellProposal.findMany({
      where,
      include: {
        creator: { select: { id: true, name: true, department: true } },
        approver1: { select: { id: true, name: true } },
        approver2: { select: { id: true, name: true } },
        items: {
          include: {
            project: { select: { id: true, code: true, name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(proposals);
  } catch (error) {
    console.error('Error getting proposals:', error);
    res.status(500).json({ error: 'Lỗi lấy danh sách đề xuất' });
  }
};

// PUT /api/cells/proposals/:id/status
export const updateProposalStatus = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { level, status, note } = req.body;
    const user = req.user;

    const proposal = await prisma.cellProposal.findUnique({ where: { id: Number(id) } });
    if (!proposal) return res.status(404).json({ error: 'Không tìm thấy đề xuất' });

    let dataToUpdate: any = {};

    if (level === 1) {
      if (proposal.approver1Id !== user.id && user.role !== 'SuperAdmin' && user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Bạn không có quyền duyệt ở cấp 1' });
      }
      dataToUpdate.level1Status = status;
      if (status === 'REJECTED') {
        dataToUpdate.status = 'REJECTED';
      } else if (status === 'APPROVED') {
        dataToUpdate.status = proposal.approver2Id ? 'PENDING_LEVEL_2' : 'APPROVED';
      }
    } else if (level === 2) {
      if (proposal.approver2Id !== user.id && user.role !== 'SuperAdmin' && !['VienTruong', 'VienPho'].includes(user.role)) {
        return res.status(403).json({ error: 'Bạn không có quyền duyệt ở cấp 2' });
      }
      dataToUpdate.level2Status = status;
      dataToUpdate.status = status === 'REJECTED' ? 'REJECTED' : 'APPROVED';
    }

    if (note !== undefined) {
      dataToUpdate.note = note;
    }

    const updated = await prisma.cellProposal.update({
      where: { id: Number(id) },
      data: dataToUpdate,
      include: {
        creator: { select: { id: true, name: true, department: true } },
        approver1: { select: { id: true, name: true } },
        approver2: { select: { id: true, name: true } },
        items: true
      }
    });

    getIO().emit('cell_proposal_updated', { action: 'update', proposal: updated });
    res.json(updated);
  } catch (error) {
    console.error('Error updating proposal status:', error);
    res.status(500).json({ error: 'Lỗi cập nhật trạng thái đề xuất' });
  }
};

// GET /api/cells/proposals/:id/export — Xuất phiếu đề xuất tế bào ra Excel
export const exportProposalToExcel = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const proposal = await prisma.cellProposal.findUnique({
      where: { id: Number(id) },
      include: {
        creator: { select: { name: true } },
        approver1: { select: { name: true, role: true } },
        approver2: { select: { name: true, role: true } },
        items: {
          include: {
            project: { select: { code: true, name: true } }
          }
        }
      }
    });

    if (!proposal) {
      return res.status(404).json({ error: 'Không tìm thấy phiếu đề xuất tế bào' });
    }

    const templatePath = path.join(process.cwd(), 'src', 'templates', 'proposal_template.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    
    const worksheet = workbook.worksheets[0];

    const date = new Date(proposal.createdAt);
    worksheet.getCell('F5').value = `Ngày ${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
    worksheet.getCell('A8').value = `Nội dung: ${proposal.note || 'Đề nghị xuất kho tế bào cho việc thực hiện nghiên cứu'}`;

    const items = proposal.items;
    
    for (let i = 0; i < 5; i++) {
      const rowNum = 10 + i;
      worksheet.getCell(`A${rowNum}`).value = '';
      worksheet.getCell(`B${rowNum}`).value = '';
      worksheet.getCell(`C${rowNum}`).value = '';
      worksheet.getCell(`D${rowNum}`).value = '';
      worksheet.getCell(`E${rowNum}`).value = '';
      worksheet.getCell(`F${rowNum}`).value = '';
    }

    if (items.length > 5) {
      for (let i = 0; i < items.length - 5; i++) {
        worksheet.duplicateRow(14, 1, true);
      }
    }

    for (let i = 0; i < items.length; i++) {
      const rowNum = 10 + i;
      const item = items[i];
      worksheet.getCell(`A${rowNum}`).value = i + 1;
      worksheet.getCell(`B${rowNum}`).value = `${item.cellName}${item.ref ? ` (REF: ${item.ref})` : ''}${item.lot ? ` (LOT: ${item.lot})` : ''}`;
      worksheet.getCell(`C${rowNum}`).value = item.unit;
      worksheet.getCell(`D${rowNum}`).value = item.quantity;
      worksheet.getCell(`E${rowNum}`).value = item.phase || '';

      let projectDisplay = '';
      if (item.project) {
        projectDisplay = `${item.project.code} - ${item.project.name}`;
      } else if (item.projectCode) {
        projectDisplay = item.projectCode;
      }
      worksheet.getCell(`F${rowNum}`).value = projectDisplay;
    }

    const shiftCount = items.length > 5 ? items.length - 5 : 0;
    const titleRow = 16 + shiftCount;
    const nameRow = 20 + shiftCount;

    const approver1Role = proposal.approver1?.role === 'VienPho' ? 'Viện Phó' : 'Trưởng Phòng';
    worksheet.getCell(`C${titleRow}`).value = approver1Role;
    worksheet.getCell(`A${nameRow}`).value = proposal.creator?.name || '';
    worksheet.getCell(`C${nameRow}`).value = proposal.approver1?.name || '';
    worksheet.getCell(`F${nameRow}`).value = proposal.approver2?.name || '';

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=DeXuat_TeBao_${id}.xlsx`);

    const buffer = await workbook.xlsx.writeBuffer();
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting proposal to Excel:', error);
    res.status(500).json({ error: 'Lỗi xuất file Excel phiếu đề xuất' });
  }
};
