const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany();
  users.forEach(u => console.log(u.email));
}
main().catch(console.error).finally(() => prisma.$disconnect());
