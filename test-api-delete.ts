import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const user = await prisma.user.findUnique({ where: { email: 'sonnm@vigh.vn' } });
  if (!user) return console.log('User not found');
  
  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'supersecretkey');
  console.log('Generated token:', token);
  
  // Create a project to test deletion via API
  const project = await prisma.project.create({
    data: { name: 'API Delete Test', status: 'PLANNING' }
  });
  console.log('Created project for API test:', project.id);

  const res = await fetch(`https://api.sonnm.site/api/projects/${project.id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  console.log('Status:', res.status);
  const data = await res.text();
  console.log('Response:', data);
  await prisma.$disconnect();
}

run();
