import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { z } from 'zod';

const chemicalSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  unit: z.string().min(1),
  quantity: z.number().min(0),
  maxQuantity: z.number().min(0),
  specification: z.number().min(0.001),
  invoicePrice: z.number().min(0),
  importDate: z.string(),
  alertThreshold: z.number().min(1).max(100).default(50),
  location: z.string().optional(),
  note: z.string().optional(),
});

const exportSchema = z.object({
  projectCode: z.string().min(1),
  quantity: z.number().min(0.001),
  note: z.string().optional(),
});

// GET /api/chemicals — Lấy toàn bộ kho
export const getChemicals = async (req: Request, res: Response) => {
  try {
    const chemicals = await prisma.chemical.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(chemicals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server khi lấy danh sách hoá chất' });
  }
};

// GET /api/chemicals/transactions — Lịch sử xuất nhập
export const getTransactions = async (req: Request, res: Response) => {
  try {
    const transactions = await prisma.chemicalTransaction.findMany({
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

// POST /api/chemicals — Nhập hoá chất mới
export const createChemical = async (req: Request, res: Response) => {
  try {
    const data = chemicalSchema.parse(req.body);
    const unitPrice = data.invoicePrice / data.specification;

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

    res.status(201).json(chemical);
  } catch (err: any) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: `Mã hoá chất "${req.body.code}" đã tồn tại` });
    }
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dữ liệu không hợp lệ', details: err.errors });
    }
    console.error(err);
    res.status(500).json({ error: 'Lỗi server khi nhập hoá chất' });
  }
};

// PUT /api/chemicals/:id — Cập nhật hoá chất
export const updateChemical = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
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
        location: data.location,
        note: data.note,
      },
    });

    res.json(chemical);
  } catch (err: any) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Không tìm thấy hoá chất' });
    }
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dữ liệu không hợp lệ', details: err.errors });
    }
    console.error(err);
    res.status(500).json({ error: 'Lỗi server khi cập nhật hoá chất' });
  }
};

// DELETE /api/chemicals/:id — Xoá hoá chất
export const deleteChemical = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.chemical.delete({ where: { id } });
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
    const id = parseInt(req.params.id);
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

    res.json({
      chemical: updated,
      warning: isLow
        ? `⚠️ ${chemical.name} còn ${percentage.toFixed(1)}% — dưới ngưỡng cảnh báo ${chemical.alertThreshold}%!`
        : null,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dữ liệu không hợp lệ', details: err.errors });
    }
    console.error(err);
    res.status(500).json({ error: 'Lỗi server khi xuất hoá chất' });
  }
};
