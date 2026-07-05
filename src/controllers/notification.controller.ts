import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getNotifications = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    const userId = user?.id;
    if (!userId || !user) return res.status(401).json({ error: 'Unauthorized' });

    // Tự động quét hoá chất dưới ngưỡng nếu là quản lý
    const managerRoles = ['superadmin', 'vientruong', 'vienpho', 'truongphong', 'admin', 'manager'];
    if (managerRoles.includes(user.role.toLowerCase())) {
      const allChemicals = await prisma.chemical.findMany();
      
      for (const chemical of allChemicals) {
        if (chemical.maxQuantity > 0) {
          const percentage = (chemical.quantity / chemical.maxQuantity) * 100;
          if (percentage < chemical.alertThreshold) {
            const title = `Cảnh báo mức hoá chất: ${chemical.name}`;
            const newMessage = `Hoá chất ${chemical.name} đang ở mức thấp (${percentage.toFixed(1)}%). Vui lòng kiểm tra và lên kế hoạch mua bổ sung.`;
            
            const existingNotification = await prisma.notification.findFirst({
              where: {
                userId,
                title,
                isRead: false
              }
            });

            if (!existingNotification) {
              // Double check via transaction/upsert to prevent race conditions
              await prisma.notification.createMany({
                data: [{
                  userId,
                  title,
                  message: newMessage,
                  type: 'CHEMICAL_WARNING'
                }],
                skipDuplicates: true
              }).catch(() => {});
            } else if (existingNotification.message !== newMessage) {
              // Cập nhật lại nội dung và đẩy thông báo lên đầu nếu số lượng tiếp tục giảm (hoặc thay đổi)
              await prisma.notification.update({
                where: { id: existingNotification.id },
                data: { message: newMessage, createdAt: new Date() }
              }).catch(() => {});
            }
          }
        }
      }
    }

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    // Lọc lại một lần nữa ở kết quả trả về để đảm bảo UI không hiện trùng nếu có lỗi logic
    const uniqueNotifications: any[] = [];
    const seenTitles = new Set();
    for (const n of notifications) {
      if (n.title.startsWith('Cảnh báo mức hoá chất') && !n.isRead) {
        if (!seenTitles.has(n.title)) {
          seenTitles.add(n.title);
          uniqueNotifications.push(n);
        }
      } else {
        uniqueNotifications.push(n);
      }
    }

    res.json(uniqueNotifications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi lấy thông báo' });
  }
};

export const markAsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const notificationId = parseInt(req.params.id as string);
    if (!userId || isNaN(notificationId)) return res.status(400).json({ error: 'Invalid data' });

    const updated = await prisma.notification.update({
      where: { id: notificationId, userId },
      data: { isRead: true }
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi cập nhật thông báo' });
  }
};

export const markAllAsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true }
    });

    res.json({ message: 'Đã đánh dấu đọc tất cả' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi cập nhật thông báo' });
  }
};
