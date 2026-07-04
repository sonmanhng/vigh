import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testCascade() {
  try {
    // 1. Create a project
    const project = await prisma.project.create({
      data: {
        name: 'Test Project for Cascade',
        status: 'PLANNING'
      }
    });
    console.log(`Created project: ${project.id}`);

    // 2. Create a task for it
    const task = await prisma.task.create({
      data: {
        title: 'Test task',
        projectId: project.id
      }
    });
    console.log(`Created task: ${task.id} for project ${project.id}`);

    // 3. Try deleting the project
    console.log(`Attempting to delete project ${project.id}...`);
    await prisma.project.delete({ where: { id: project.id } });
    console.log('Successfully deleted project with task! Cascade works.');

  } catch (err) {
    console.error('Cascade failed! Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

testCascade();
