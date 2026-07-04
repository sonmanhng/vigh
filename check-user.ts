import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUser() {
  const user = await prisma.user.findUnique({ where: { email: 'sonnm@vigh.vn' } });
  console.log('User role:', user?.role);
}

checkUser().finally(() => prisma.$disconnect());
