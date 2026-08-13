import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import ExcelJS from 'exceljs';
import { z } from 'zod';

export const getStationeries = async (req: Request, res: Response) => {
  try {
    const stationeries = await prisma.stationery.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(stationeries);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getLowStockStationeries = async (req: Request, res: Response) => {
  try {
    const stationeries = await prisma.stationery.findMany({
      orderBy: { name: 'asc' }
    });
    const lowStock = stationeries.filter(s => s.quantity <= s.alertThreshold);
    res.json(lowStock);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createStationery = async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const existing = await prisma.stationery.findUnique({ where: { code: data.code } });
    if (existing) {
      return res.status(400).json({ message: 'Mã VPP đã tồn tại' });
    }
    const newStationery = await prisma.stationery.create({
      data: {
        code: data.code,
        name: data.name,
        unit: data.unit,
        quantity: Number(data.quantity) || 0,
        alertThreshold: Number(data.alertThreshold) || 10,
        note: data.note
      }
    });
    res.status(201).json(newStationery);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateStationery = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const updated = await prisma.stationery.update({
      where: { id: Number(id) },
      data: {
        name: data.name,
        unit: data.unit,
        alertThreshold: Number(data.alertThreshold) || 10,
        note: data.note
      }
    });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteStationery = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.stationery.delete({ where: { id: Number(id) } });
    res.json({ message: 'Xoá thành công' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Transactions
export const getTransactions = async (req: Request, res: Response) => {
  try {
    const txs = await prisma.stationeryTransaction.findMany({
      include: {
        stationery: { select: { code: true, name: true, unit: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    });
    res.json(txs);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createTransaction = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { type, stationeryId, quantity, note } = req.body;
    
    if (type !== 'IMPORT' && type !== 'EXPORT') {
      return res.status(400).json({ message: 'Loại giao dịch không hợp lệ' });
    }

    const stationery = await prisma.stationery.findUnique({ where: { id: Number(stationeryId) } });
    if (!stationery) {
      return res.status(404).json({ message: 'Không tìm thấy VPP' });
    }

    const qty = Number(quantity);
    if (qty <= 0) {
      return res.status(400).json({ message: 'Số lượng phải lớn hơn 0' });
    }

    if (type === 'EXPORT' && stationery.quantity < qty) {
      return res.status(400).json({ message: `Số lượng tồn kho không đủ (còn ${stationery.quantity})` });
    }

    const [tx, updatedStationery] = await prisma.$transaction([
      prisma.stationeryTransaction.create({
        data: {
          type,
          stationeryId: Number(stationeryId),
          quantity: qty,
          note,
          createdById: userId
        },
        include: { stationery: true }
      }),
      prisma.stationery.update({
        where: { id: Number(stationeryId) },
        data: {
          quantity: type === 'IMPORT' ? stationery.quantity + qty : stationery.quantity - qty
        }
      })
    ]);

    res.status(201).json(tx);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Excel
export const exportStationeries = async (req: Request, res: Response) => {
  try {
    const stationeries = await prisma.stationery.findMany({ orderBy: { name: 'asc' } });
    
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Danh Sach VPP');

    sheet.columns = [
      { header: 'Mã VPP', key: 'code', width: 15 },
      { header: 'Tên VPP', key: 'name', width: 30 },
      { header: 'Đơn vị tính', key: 'unit', width: 15 },
      { header: 'Số lượng tồn', key: 'quantity', width: 15 },
      { header: 'Ngưỡng cảnh báo', key: 'alertThreshold', width: 15 },
      { header: 'Ghi chú', key: 'note', width: 25 },
    ];

    sheet.getRow(1).font = { bold: true };

    stationeries.forEach(s => {
      sheet.addRow({
        code: s.code,
        name: s.name,
        unit: s.unit,
        quantity: s.quantity,
        alertThreshold: s.alertThreshold,
        note: s.note || ''
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Danh_sach_VPP.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const importStationeries = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng upload file Excel' });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer as any);
    const sheet = workbook.getWorksheet(1);
    if (!sheet) return res.status(400).json({ message: 'File Excel không có sheet nào' });

    const imports: any[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header
      const code = row.getCell(1).text?.trim();
      const name = row.getCell(2).text?.trim();
      const unit = row.getCell(3).text?.trim();
      const quantity = Number(row.getCell(4).value) || 0;
      const alertThreshold = Number(row.getCell(5).value) || 10;
      const note = row.getCell(6).text?.trim();

      if (code && name) {
        imports.push({ code, name, unit: unit || 'Cái', quantity, alertThreshold, note });
      }
    });

    let successCount = 0;
    for (const data of imports) {
      await prisma.stationery.upsert({
        where: { code: data.code },
        update: {
          name: data.name,
          unit: data.unit,
          quantity: data.quantity,
          alertThreshold: data.alertThreshold,
          note: data.note
        },
        create: {
          code: data.code,
          name: data.name,
          unit: data.unit,
          quantity: data.quantity,
          alertThreshold: data.alertThreshold,
          note: data.note
        }
      });
      successCount++;
    }

    res.json({ message: `Đã import thành công ${successCount} dòng.` });
  } catch (error: any) {
    console.error('Import error', error);
    res.status(500).json({ message: 'Lỗi xử lý file Excel', error: error.message });
  }
};
