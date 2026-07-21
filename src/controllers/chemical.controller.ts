import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { getIO } from '../socket';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import path from 'path';

// Danh sách phòng ban hoá chất hợp lệ
export const CHEMICAL_DEPARTMENTS = [
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
 * Lấy danh sách phòng ban hoá chất mà user có quyền xem/thao tác.
 * Trả về undefined nghĩa là xem được tất cả.
 */
function getAllowedChemicalDepts(user: any): string[] | undefined {
  const fullAccessRoles = ['SuperAdmin', 'VienTruong', 'VienPho', 'ADMIN'];
  if (fullAccessRoles.includes(user.role)) return undefined; // Toàn quyền
  
  const dept = user.department || '';
  // Ban lãnh đạo: xem và thao tác toàn bộ
  if (dept === 'Ban lãnh đạo') return undefined;
  // Phòng Sinh học: quản lý cả 2 phòng sinh học
  if (dept === 'Phòng Sinh học') return ['Phòng Thử nghiệm Sinh học', 'Phòng Tài nguyên và Công nghệ Sinh học'];
  // Các phòng khác: chỉ xem phòng của mình
  if (dept === 'Phòng Khoa học Công nghệ') return ['Phòng Khoa học Công nghệ'];
  if (dept === 'Phòng Công nghệ Dược') return ['Phòng Công nghệ Dược'];
  // Không thuộc phòng nào → không thấy gì
  return [];
}

const chemicalSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  unit: z.string().min(1),
  quantity: z.number().min(0),
  maxQuantity: z.number().min(0),
  specification: z.number().min(0.001),
  invoicePrice: z.number().min(0),
  importDate: z.string(),
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

// GET /api/chemicals — Lấy kho theo phòng ban của user
export const getChemicals = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const allowedDepts = getAllowedChemicalDepts(user);
    
    const where: any = {};
    if (allowedDepts !== undefined) {
      if (allowedDepts.length === 0) return res.json([]);
      where.department = { in: allowedDepts };
    }
    
    const chemicals = await prisma.chemical.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    res.json(chemicals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server khi lấy danh sách hoá chất' });
  }
};

// GET /api/chemicals/transactions — Lịch sử xuất nhập (lọc theo phòng ban)
export const getTransactions = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const allowedDepts = getAllowedChemicalDepts(user);
    
    const chemicalWhere: any = {};
    if (allowedDepts !== undefined) {
      if (allowedDepts.length === 0) return res.json([]);
      chemicalWhere.department = { in: allowedDepts };
    }
    
    const transactions = await prisma.chemicalTransaction.findMany({
      where: allowedDepts !== undefined ? { chemical: chemicalWhere } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        chemical: { select: { code: true, name: true, unit: true } },
      },
      take: 200,
    });
    res.json(transactions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server khi lấy lịch sử' });
  }
};

// GET /api/chemicals/statistics/projects — Thống kê sử dụng hoá chất theo dự án
export const getProjectStatistics = async (req: Request, res: Response) => {
  try {
    const role = (req as any).user?.role;
    const userId = (req as any).user?.id;

    let projectCodes: string[] | undefined = undefined;

    if (!['SuperAdmin', 'VienTruong', 'VienPho'].includes(role)) {
      // Find projects this user belongs to
      const userProjects = await prisma.project.findMany({
        where: {
          OR: [
            { managerId: userId },
            { members: { some: { id: userId } } }
          ]
        },
        select: { code: true }
      });
      projectCodes = userProjects.map(p => p.code).filter(Boolean) as string[];
      if (projectCodes.length === 0) {
        return res.json([]);
      }
    }

    const whereClause: any = { type: 'EXPORT', projectCode: { not: null } };
    if (projectCodes) {
      whereClause.projectCode = { in: projectCodes };
    }

    const transactions = await prisma.chemicalTransaction.findMany({
      where: whereClause,
      include: { chemical: true }
    });

    const statsMap: Record<string, any> = {};

    for (const tx of transactions) {
      if (!tx.projectCode) continue;
      
      if (!statsMap[tx.projectCode]) {
        statsMap[tx.projectCode] = {
          projectCode: tx.projectCode,
          chemicals: {}
        };
      }

      const chemId = tx.chemicalId;
      if (!statsMap[tx.projectCode].chemicals[chemId]) {
        statsMap[tx.projectCode].chemicals[chemId] = {
          chemicalId: chemId,
          chemicalCode: tx.chemical.code,
          chemicalName: tx.chemical.name,
          unit: tx.chemical.unit,
          totalQuantity: 0,
          totalValue: 0
        };
      }

      statsMap[tx.projectCode].chemicals[chemId].totalQuantity += tx.quantity;
      statsMap[tx.projectCode].chemicals[chemId].totalValue += (tx.quantity * tx.chemical.unitPrice);
    }

    const allProjectCodes = Object.keys(statsMap);
    const projects = await prisma.project.findMany({
      where: { code: { in: allProjectCodes } },
      select: { code: true, name: true }
    });
    
    const codeToNameMap = new Map(projects.map(p => [p.code, p.name]));

    const result = allProjectCodes.map(code => ({
      projectCode: code,
      projectName: codeToNameMap.get(code) || 'Dự án không tồn tại',
      chemicals: Object.values(statsMap[code].chemicals)
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi lấy thống kê theo dự án' });
  }
};

// POST /api/chemicals — Nhập hoá chất mới
export const createChemical = async (req: Request, res: Response) => {
  try {
    const data = chemicalSchema.parse(req.body);
    const unitPrice = data.invoicePrice / data.specification;

    const existing = await prisma.chemical.findUnique({ where: { code: data.code } });

    if (existing) {
      const updated = await prisma.chemical.update({
        where: { code: data.code },
        data: {
          quantity: { increment: data.quantity },
          name: data.name,
          unit: data.unit,
          maxQuantity: data.maxQuantity,
          specification: data.specification,
          invoicePrice: data.invoicePrice,
          unitPrice,
          importDate: new Date(data.importDate),
          alertThreshold: data.alertThreshold,
          department: data.department,
          location: data.location,
          note: data.note,
          transactions: {
            create: {
              type: 'IMPORT',
              quantity: data.quantity,
              note: `Nhập bổ sung — Phiếu ngày ${data.importDate}`,
              createdById: (req as any).user?.id,
            },
          },
        },
      });
      getIO().emit('sync_chemicals');
      return res.status(200).json(updated);
    }

    const chemical = await prisma.chemical.create({
      data: {
        code: data.code,
        name: data.name,
        unit: data.unit,
        quantity: data.quantity,
        maxQuantity: data.maxQuantity,
        specification: data.specification,
        invoicePrice: data.invoicePrice,
        unitPrice,
        importDate: new Date(data.importDate),
        alertThreshold: data.alertThreshold,
        department: data.department,
        location: data.location,
        note: data.note,
        // Ghi log nhập kho ban đầu
        transactions: {
          create: {
            type: 'IMPORT',
            quantity: data.quantity,
            note: `Nhập kho ban đầu — Phiếu ngày ${data.importDate}`,
            createdById: (req as any).user?.id,
          },
        },
      },
    });

    getIO().emit('sync_chemicals');
    res.status(201).json(chemical);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dữ liệu không hợp lệ', details: (err as any).errors });
    }
    console.error(err);
    res.status(500).json({ error: 'Lỗi server khi nhập hoá chất' });
  }
};

// PUT /api/chemicals/:id — Cập nhật hoá chất
export const updateChemical = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const data = chemicalSchema.parse(req.body);
    const unitPrice = data.invoicePrice / data.specification;

    const chemical = await prisma.chemical.update({
      where: { id },
      data: {
        code: data.code,
        name: data.name,
        unit: data.unit,
        quantity: data.quantity,
        maxQuantity: data.maxQuantity,
        specification: data.specification,
        invoicePrice: data.invoicePrice,
        unitPrice,
        importDate: new Date(data.importDate),
        alertThreshold: data.alertThreshold,
        department: data.department,
        location: data.location,
        note: data.note,
      },
    });

    const percentage = (chemical.quantity / chemical.maxQuantity) * 100;
    const isLow = percentage < chemical.alertThreshold;

    if (isLow) {
      const managers = await prisma.user.findMany({
        where: {
          role: { in: ['SuperAdmin', 'VienTruong', 'VienPho', 'TruongPhong', 'ADMIN', 'MANAGER'] }
        }
      });
      
      const notifications = managers.map(m => ({
        userId: m.id,
        title: 'Cảnh báo mức hoá chất',
        message: `Hoá chất ${chemical.name} đang ở mức thấp (${percentage.toFixed(1)}%). Vui lòng kiểm tra và lên kế hoạch mua bổ sung.`,
        type: 'CHEMICAL_WARNING'
      }));

      if (notifications.length > 0) {
        await prisma.notification.createMany({ data: notifications });
      }
    }

    getIO().emit('sync_chemicals');
    res.json({
      chemical,
      warning: isLow
        ? `⚠️ ${chemical.name} còn ${percentage.toFixed(1)}% — dưới ngưỡng cảnh báo ${chemical.alertThreshold}%!`
        : null,
    });
  } catch (err: any) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Không tìm thấy hoá chất' });
    }
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dữ liệu không hợp lệ', details: (err as any).errors });
    }
    console.error(err);
    res.status(500).json({ error: 'Lỗi server khi cập nhật hoá chất' });
  }
};

// DELETE /api/chemicals/:id — Xoá hoá chất
export const deleteChemical = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    await prisma.chemical.delete({ where: { id } });
    getIO().emit('sync_chemicals');
    getIO().emit('sync_transactions');
    res.json({ message: 'Đã xoá hoá chất thành công' });
  } catch (err: any) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Không tìm thấy hoá chất' });
    }
    console.error(err);
    res.status(500).json({ error: 'Lỗi server khi xoá hoá chất' });
  }
};

// POST /api/chemicals/:id/export — Xuất hoá chất
export const exportChemical = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const data = exportSchema.parse(req.body);

    const chemical = await prisma.chemical.findUnique({ where: { id } });
    if (!chemical) {
      return res.status(404).json({ error: 'Không tìm thấy hoá chất' });
    }
    if (data.quantity > chemical.quantity) {
      return res.status(400).json({
        error: `Số lượng xuất (${data.quantity}) vượt quá tồn kho hiện có (${chemical.quantity} ${chemical.unit})`,
      });
    }

    const newQuantity = chemical.quantity - data.quantity;

    // Transaction: cập nhật số lượng + ghi log xuất kho
    const [updated] = await prisma.$transaction([
      prisma.chemical.update({
        where: { id },
        data: { quantity: newQuantity },
      }),
      prisma.chemicalTransaction.create({
        data: {
          type: 'EXPORT',
          chemicalId: id,
          quantity: data.quantity,
          projectCode: data.projectCode,
          note: data.note,
          createdById: (req as any).user?.id,
        },
      }),
    ]);

    // Kiểm tra cảnh báo <50%
    const percentage = (newQuantity / chemical.maxQuantity) * 100;
    const isLow = percentage < chemical.alertThreshold;

    if (isLow) {
      // Tìm các user có quyền quản lý để báo (SuperAdmin, VienTruong, VienPho, TruongPhong)
      const managers = await prisma.user.findMany({
        where: {
          role: { in: ['SuperAdmin', 'VienTruong', 'VienPho', 'TruongPhong', 'ADMIN', 'MANAGER'] }
        }
      });
      
      const notifications = managers.map(m => ({
        userId: m.id,
        title: 'Cảnh báo mức hoá chất',
        message: `Hoá chất ${chemical.name} đã giảm xuống dưới ngưỡng cảnh báo (${percentage.toFixed(1)}%). Vui lòng kiểm tra và lên kế hoạch mua bổ sung.`,
        type: 'CHEMICAL_WARNING'
      }));

      if (notifications.length > 0) {
        await prisma.notification.createMany({ data: notifications });
      }
    }

    res.json({
      chemical: updated,
      warning: isLow
        ? `⚠️ ${chemical.name} còn ${percentage.toFixed(1)}% — dưới ngưỡng cảnh báo ${chemical.alertThreshold}%!`
        : null,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dữ liệu không hợp lệ', details: (err as any).errors });
    }
    console.error(err);
    res.status(500).json({ error: 'Lỗi server khi xuất hoá chất' });
  }
};

// ── PROPOSALS ─────────────────────────────────────────────────────────────

export const getApprovers = async (req: any, res: any) => {
  try {
    const approver1List = await prisma.user.findMany({
      where: { role: { in: ['TruongPhong', 'VienPho'] } },
      select: { id: true, name: true, role: true, email: true }
    });
    const approver2List = await prisma.user.findMany({
      where: { role: { in: ['VienTruong', 'SuperAdmin'] } },
      select: { id: true, name: true, role: true, email: true }
    });
    res.json({ level1: approver1List, level2: approver2List });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi lấy danh sách người duyệt' });
  }
};

export const createProposal = async (req: any, res: any) => {
  try {
    const { items, note, approver1Id, approver2Id } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Danh sách đề xuất rỗng' });
    }

    const role = req.user.role;
    let level1Status = 'PENDING';
    let level2Status = 'PENDING';
    let overallStatus = 'PENDING';

    // 1. Viện trưởng / SuperAdmin tự tạo -> auto duyệt toàn bộ
    if (role === 'VienTruong' || role === 'SuperAdmin') {
      level1Status = 'APPROVED';
      level2Status = 'APPROVED';
      overallStatus = 'APPROVED';
    } 
    // 2. Người duyệt 1 tự tạo -> auto duyệt cấp 1
    else if (approver1Id && req.user.id === Number(approver1Id)) {
      level1Status = 'APPROVED';
      overallStatus = 'PENDING_LEVEL_2';
    }

    const proposal = await prisma.chemicalProposal.create({
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
            chemicalName: i.chemicalName,
            unit: i.unit,
            quantity: Number(i.quantity) || 0,
            phase: i.phase,
            projectId: i.projectId ? Number(i.projectId) : null,
            projectCode: i.projectCode,
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
          title: 'Đề xuất mua hoá chất mới',
          message: `${user?.name} vừa gửi đề xuất mua hoá chất. Vui lòng kiểm tra và phê duyệt.`,
          type: 'PROPOSAL_PENDING',
        }
      });
    } else if (overallStatus === 'PENDING_LEVEL_2' && approver2Id) {
      await prisma.notification.create({
        data: {
          userId: Number(approver2Id),
          title: 'Đề xuất mua hoá chất cần duyệt cấp 2',
          message: `Đề xuất mua hoá chất của ${user?.name} đã được duyệt cấp 1. Vui lòng kiểm tra và phê duyệt.`,
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

export const getProposals = async (req: any, res: any) => {
  try {
    const proposals = await prisma.chemicalProposal.findMany({
      include: {
        creator: { select: { name: true, email: true } },
        approver1: { select: { name: true, email: true } },
        approver2: { select: { name: true, email: true } },
        items: {
          include: { project: { select: { name: true, code: true } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(proposals);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi lấy danh sách đề xuất' });
  }
};

export const updateProposalStatus = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'APPROVE' or 'REJECT'
    const role = req.user.role;

    const proposal = await prisma.chemicalProposal.findUnique({ where: { id: Number(id) } });
    if (!proposal) return res.status(404).json({ error: 'Không tìm thấy phiếu đề xuất' });

    let { level1Status, level2Status, status } = proposal;

    if (action === 'REJECT') {
      if (req.user.id === proposal.approver1Id) level1Status = 'REJECTED';
      if (req.user.id === proposal.approver2Id || role === 'VienTruong' || role === 'SuperAdmin') level2Status = 'REJECTED';
      status = 'REJECTED';
    } else if (action === 'APPROVE') {
      // is approver 1
      if (req.user.id === proposal.approver1Id) {
        level1Status = 'APPROVED';
        if (level2Status !== 'APPROVED') status = 'PENDING_LEVEL_2';
      }
      // is approver 2 or high level role
      if (req.user.id === proposal.approver2Id || role === 'VienTruong' || role === 'SuperAdmin') {
        level2Status = 'APPROVED';
        status = 'APPROVED';
        // If approver 2 approves, level1 is also implicitly approved if it was pending
        if (level1Status === 'PENDING') level1Status = 'APPROVED';
      }
    }

    const updated = await prisma.chemicalProposal.update({
      where: { id: Number(id) },
      data: { level1Status, level2Status, status },
      include: {
        creator: { select: { name: true, email: true } },
        approver1: { select: { name: true, email: true } },
        approver2: { select: { name: true, email: true } },
        items: {
          include: { project: { select: { name: true, code: true } } }
        }
      }
    });

    if (status === 'PENDING_LEVEL_2' && proposal.approver2Id) {
      await prisma.notification.create({
        data: {
          userId: proposal.approver2Id,
          title: 'Đề xuất mua hoá chất cần duyệt cấp 2',
          message: `Đề xuất mua hoá chất (ID: ${proposal.id}) đã được duyệt cấp 1. Vui lòng kiểm tra và phê duyệt.`,
          type: 'PROPOSAL_PENDING'
        }
      });
    } else if (status === 'APPROVED' || status === 'REJECTED') {
      const statusText = status === 'APPROVED' ? 'Đã được phê duyệt' : 'Đã bị từ chối';
      if (proposal.createdById) {
        await prisma.notification.create({
          data: {
            userId: proposal.createdById,
            title: `Đề xuất mua hoá chất ${statusText}`,
            message: `Đề xuất mua hoá chất (ID: ${proposal.id}) của bạn ${statusText.toLowerCase()}.`,
            type: status === 'APPROVED' ? 'PROPOSAL_RESULT' : 'PROPOSAL_RESULT'
          }
        });
      }
    }

    res.json(updated);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi cập nhật trạng thái phiếu' });
  }
};

export const exportProposalToExcel = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const proposal = await prisma.chemicalProposal.findUnique({
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
      return res.status(404).json({ error: 'Không tìm thấy phiếu đề xuất' });
    }

    const templatePath = path.join(process.cwd(), 'src', 'templates', 'proposal_template.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    
    const worksheet = workbook.worksheets[0];

    // F5: Ngày tháng năm
    const date = new Date(proposal.createdAt);
    worksheet.getCell('F5').value = `Ngày ${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;

    // A8: Nội dung
    worksheet.getCell('A8').value = `Nội dung: ${proposal.note || 'Đề nghị xuất kho NVL cho việc thực hiện dự án'}`;

    const items = proposal.items;
    
    // Clear default template data in rows 10 to 14
    for (let i = 0; i < 5; i++) {
      const rowNum = 10 + i;
      worksheet.getCell(`A${rowNum}`).value = '';
      worksheet.getCell(`B${rowNum}`).value = '';
      worksheet.getCell(`C${rowNum}`).value = '';
      worksheet.getCell(`D${rowNum}`).value = '';
      worksheet.getCell(`E${rowNum}`).value = '';
      worksheet.getCell(`F${rowNum}`).value = '';
    }

    // Rows 10 to 14 are available in the template. 
    // If we have more than 5 items, we need to insert rows before filling data to shift signatures down
    if (items.length > 5) {
      // Insert rows starting at row 15 (after the 5 template rows)
      // duplicate the formatting from row 14
      for (let i = 0; i < items.length - 5; i++) {
        worksheet.duplicateRow(14, 1, true);
      }
    }

    // Fill data
    for (let i = 0; i < items.length; i++) {
      const rowNum = 10 + i;
      const item = items[i];
      worksheet.getCell(`A${rowNum}`).value = i + 1;
      worksheet.getCell(`B${rowNum}`).value = item.chemicalName;
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

    // Signatures
    // Since we duplicated rows, the signature row shifted down by (items.length > 5 ? items.length - 5 : 0)
    const shiftCount = items.length > 5 ? items.length - 5 : 0;
    
    // Signatures title row is 16 + shiftCount
    const titleRow = 16 + shiftCount;
    const nameRow = 20 + shiftCount;

    // Fill actual approver1 role instead of hardcoding "Trưởng Phòng"
    const approver1Role = proposal.approver1?.role === 'VienPho' ? 'Viện Phó' : 'Trưởng Phòng';
    worksheet.getCell(`C${titleRow}`).value = approver1Role;
    
    // Fill names
    worksheet.getCell(`A${nameRow}`).value = proposal.creator?.name || '';
    worksheet.getCell(`C${nameRow}`).value = proposal.approver1?.name || '';
    worksheet.getCell(`F${nameRow}`).value = proposal.approver2?.name || '';

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=DeXuat_${id}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Lỗi khi xuất file Excel' });
    }
  }
};
