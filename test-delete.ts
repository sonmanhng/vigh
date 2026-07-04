import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testDelete() {
  try {
    const projects = await prisma.project.findMany();
    if (projects.length > 0) {
      console.log(`Trying to delete project ID: ${projects[0].id}`);
      await prisma.project.delete({ where: { id: projects[0].id } });
      console.log('Deleted successfully!');
    } else {
      console.log('No projects found to delete.');
    }
  } catch (err) {
    console.error('Delete error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

testDelete();
