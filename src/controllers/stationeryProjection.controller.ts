import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import * as ExcelJS from 'exceljs';

// Auto-add function to be called from other controllers
export const autoAddStationeryToCurrentProjection = async (stationeryId: number, name: string, unit: string) => {
  try {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // Ensure projection exists
    let projection = await prisma.stationeryProjection.findUnique({
      where: { month_year: { month, year } }
    });

    if (!projection) {
      projection = await prisma.stationeryProjection.create({
        data: { month, year }
      });
    }

    // Check if it already exists in this projection
    const existingItem = await prisma.stationeryProjectionItem.findFirst({
      where: { projectionId: projection.id, stationeryId }
    });

    if (!existingItem) {
      await prisma.stationeryProjectionItem.create({
        data: {
          projectionId: projection.id,
          stationeryId,
          name,
          unit,
          quantity: 1, // Default quantity when auto-added
          note: 'Tự động thêm do dưới ngưỡng cảnh báo'
        }
      });
    }
  } catch (error) {
    console.error('Lỗi khi tự động thêm VPP vào dự trù:', error);
  }
};

export const getProjection = async (req: Request, res: Response) => {
  try {
    const month = parseInt(req.query.month as string);
    const year = parseInt(req.query.year as string);

    if (!month || !year) {
      return res.status(400).json({ error: 'Thiếu tháng hoặc năm' });
    }

    let projection = await prisma.stationeryProjection.findUnique({
      where: { month_year: { month, year } },
      include: {
        items: {
          include: {
            addedBy: { select: { id: true, name: true } },
            stationery: { select: { code: true } }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!projection) {
      // Create empty projection
      projection = await prisma.stationeryProjection.create({
        data: { month, year },
        include: {
          items: {
            include: {
              addedBy: { select: { id: true, name: true } },
              stationery: { select: { code: true } }
            }
          }
        }
      });
    }

    res.json(projection);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi khi lấy dữ liệu dự trù', details: error.message });
  }
};

export const addProjectionItem = async (req: Request, res: Response) => {
  try {
    const { projectionId } = req.params;
    const { stationeryId, name, unit, quantity, note } = req.body;
    const userId = (req as any).user?.id;

    if (!name || quantity <= 0) {
      return res.status(400).json({ error: 'Tên và số lượng hợp lệ là bắt buộc' });
    }

    // If stationeryId is provided, check if it already exists in the projection
    if (stationeryId) {
      const existing = await prisma.stationeryProjectionItem.findFirst({
        where: { projectionId: Number(projectionId), stationeryId: Number(stationeryId) }
      });
      if (existing) {
        // Just update quantity
        const updated = await prisma.stationeryProjectionItem.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity + Number(quantity) }
        });
        return res.json(updated);
      }
    }

    const item = await prisma.stationeryProjectionItem.create({
      data: {
        projectionId: Number(projectionId),
        stationeryId: stationeryId ? Number(stationeryId) : null,
        name,
        unit: unit || 'Cái',
        quantity: Number(quantity),
        note,
        addedById: userId
      },
      include: {
        addedBy: { select: { id: true, name: true } },
        stationery: { select: { code: true } }
      }
    });

    res.status(201).json(item);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi khi thêm mục dự trù', details: error.message });
  }
};

export const addProjectionItemByMonthYear = async (req: Request, res: Response) => {
  try {
    const { month, year, stationeryId, name, unit, quantity, note } = req.body;
    const userId = (req as any).user?.id;

    if (!month || !year || !name || quantity <= 0) {
      return res.status(400).json({ error: 'Tháng, năm, tên và số lượng hợp lệ là bắt buộc' });
    }

    let projection = await prisma.stationeryProjection.findUnique({
      where: { month_year: { month: Number(month), year: Number(year) } }
    });

    if (!projection) {
      projection = await prisma.stationeryProjection.create({
        data: { month: Number(month), year: Number(year) }
      });
    }

    // Reuse the same logic as addProjectionItem but with projection.id
    if (stationeryId) {
      const existing = await prisma.stationeryProjectionItem.findFirst({
        where: { projectionId: projection.id, stationeryId: Number(stationeryId) }
      });
      if (existing) {
        const updated = await prisma.stationeryProjectionItem.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity + Number(quantity) }
        });
        return res.json(updated);
      }
    }

    const item = await prisma.stationeryProjectionItem.create({
      data: {
        projectionId: projection.id,
        stationeryId: stationeryId ? Number(stationeryId) : null,
        name,
        unit: unit || 'Cái',
        quantity: Number(quantity),
        note,
        addedById: userId
      },
      include: {
        addedBy: { select: { id: true, name: true } },
        stationery: { select: { code: true } }
      }
    });

    res.status(201).json(item);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi khi thêm mục dự trù', details: error.message });
  }
};

export const removeProjectionItem = async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    await prisma.stationeryProjectionItem.delete({
      where: { id: Number(itemId) }
    });
    res.json({ message: 'Đã xoá mục dự trù' });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi khi xoá mục dự trù', details: error.message });
  }
};

export const updateProjectionItem = async (req: Request, res: Response): Promise<any> => {
  try {
    const { itemId } = req.params;
    const { name, unit, quantity, note, status } = req.body;
    
    if (quantity !== undefined && quantity <= 0) {
      return res.status(400).json({ error: 'Số lượng phải lớn hơn 0' });
    }

    const dataToUpdate: any = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (unit !== undefined) dataToUpdate.unit = unit;
    if (quantity !== undefined) dataToUpdate.quantity = Number(quantity);
    if (note !== undefined) dataToUpdate.note = note;
    if (status !== undefined) dataToUpdate.status = status;

    const item = await prisma.stationeryProjectionItem.update({
      where: { id: Number(itemId) },
      data: dataToUpdate,
      include: {
        addedBy: { select: { id: true, name: true } },
        stationery: { select: { code: true } }
      }
    });
    return res.json(item);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: 'Lỗi khi cập nhật mục dự trù', details: error.message });
  }
};

export const exportProjectionExcel = async (req: Request, res: Response) => {
  try {
    const { projectionId } = req.params;
    
    const projection = await prisma.stationeryProjection.findUnique({
      where: { id: Number(projectionId) },
      include: {
        items: {
          include: { stationery: true, addedBy: true },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!projection) {
      return res.status(404).json({ error: 'Không tìm thấy dự trù' });
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(`Dự trù Tháng ${projection.month}-${projection.year}`);

    sheet.columns = [
      { header: 'STT', key: 'stt', width: 5 },
      { header: 'Mã VPP', key: 'code', width: 15 },
      { header: 'Tên Văn Phòng Phẩm', key: 'name', width: 35 },
      { header: 'Đơn Vị', key: 'unit', width: 10 },
      { header: 'Số Lượng Dự Trù', key: 'quantity', width: 15 },
      { header: 'Tồn Kho Hiện Tại', key: 'stock', width: 15 },
      { header: 'Ghi Chú', key: 'note', width: 30 },
      { header: 'Người Thêm', key: 'addedBy', width: 25 },
    ];

    sheet.getRow(1).font = { bold: true };

    projection.items.forEach((item: any, index: number) => {
      sheet.addRow({
        stt: index + 1,
        code: item.stationery?.code || '-',
        name: item.name,
        unit: item.unit,
        quantity: item.quantity,
        stock: item.stationery ? item.stationery.quantity : '-',
        note: item.note || '',
        addedBy: item.addedBy?.name || 'Hệ thống tự động',
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Du_Tru_VPP_Thang_${projection.month}_${projection.year}.xlsx"`);
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi khi xuất Excel', details: error.message });
  }
};

export const bulkUpdateProjectionItemsStatus = async (req: Request, res: Response): Promise<any> => {
  try {
    const { ids, status } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Danh sách ID không hợp lệ' });
    }
    if (!status) {
      return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
    }

    await prisma.stationeryProjectionItem.updateMany({
      where: { id: { in: ids } },
      data: { status }
    });

    return res.json({ message: 'Cập nhật trạng thái thành công' });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: 'Lỗi khi cập nhật trạng thái hàng loạt', details: error.message });
  }
};

export const bulkRemoveProjectionItems = async (req: Request, res: Response): Promise<any> => {
  try {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Danh sách ID không hợp lệ' });
    }

    await prisma.stationeryProjectionItem.deleteMany({
      where: { id: { in: ids } }
    });

    return res.json({ message: 'Xoá thành công' });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: 'Lỗi khi xoá hàng loạt', details: error.message });
  }
};
