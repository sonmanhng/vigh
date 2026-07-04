import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

async function updateAdmin() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });

  const hashedPassword = await bcrypt.hash('27062003', 10);
  
  // Find the current superadmin
  const admin = await prisma.user.findFirst({
    where: { role: 'SuperAdmin' }
  });

  if (admin) {
    await prisma.user.update({
      where: { id: admin.id },
      data: {
        email: 'sonnm@vigh.vn',
        passwordHash: hashedPassword
      }
    });
    console.log("Updated superadmin to sonnm@vigh.vn");
  } else {
    await prisma.user.create({
      data: {
        email: 'sonnm@vigh.vn',
        passwordHash: hashedPassword,
        name: 'Nguyễn Mạnh Sơn',
        role: 'SuperAdmin',
        department: 'Phòng Tin học'
      }
    });
    console.log("Created sonnm@vigh.vn");
  }
}
updateAdmin().catch(console.error);
