import app from './app';
import { PORT, validateEnv } from './config';
import prisma from './prismaClient';

try {
  validateEnv();
} catch (err: any) {
  console.error('Environment validation failed:', err.message || err);
  process.exit(1);
}

(async () => {
  try {
    await prisma.$connect();
    app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
  } catch (err: any) {
    console.error('Startup error:', err?.message || err);
    process.exit(1);
  }
})();
