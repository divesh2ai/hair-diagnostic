import prisma from '../prismaClient';

export async function createSession(userId?: string) {
  const s = await prisma.session.create({ data: { userId: userId || null, state: {} } });
  return s;
}

export async function getSession(id: string) {
  return prisma.session.findUnique({ where: { id } });
}
