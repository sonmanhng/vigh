import { PrismaClient as PrismaSqlite } from '@prisma/client';
import { PrismaClient as PrismaPg } from '@prisma/client';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function restore() {
  const db = await open({
    filename: './prisma/dev.db',
    driver: sqlite3.Database
  });

  const pgPrisma = new PrismaPg({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });

  const users = await db.all("SELECT * FROM User");
  const projects = await db.all("SELECT * FROM Project");
  const tasks = await db.all("SELECT * FROM Task");
  const researches = await db.all("SELECT * FROM ResearchContent");

  console.log("Wiping VPS DB...");
  await pgPrisma.task.deleteMany({});
  await pgPrisma.researchContent.deleteMany({});
  await pgPrisma.project.deleteMany({});
  await pgPrisma.user.deleteMany({});

  const parseDate = (d: any) => d ? new Date(d) : null;

  console.log("Restoring Users...");
  for (const u of users) {
    await pgPrisma.user.create({ data: { ...u, createdAt: parseDate(u.createdAt), updatedAt: parseDate(u.updatedAt) } });
  }

  console.log("Restoring Projects...");
  for (const p of projects) {
    const { startDate, endDate, ...rest } = p;
    await pgPrisma.project.create({ data: { ...rest, startDate: parseDate(p.startDate), endDate: parseDate(p.endDate), createdAt: parseDate(p.createdAt), updatedAt: parseDate(p.updatedAt) } });
  }

  console.log("Restoring Tasks...");
  for (const t of tasks) {
    const { startDate, endDate, ...rest } = t;
    await pgPrisma.task.create({ data: { ...rest, createdAt: parseDate(t.createdAt), updatedAt: parseDate(t.updatedAt) } });
  }

  console.log("Restoring Research...");
  for (const r of researches) {
    await pgPrisma.researchContent.create({ data: { ...r, createdAt: parseDate(r.createdAt), updatedAt: parseDate(r.updatedAt) } });
  }

  console.log("Done!");
}
restore().catch(console.error);
