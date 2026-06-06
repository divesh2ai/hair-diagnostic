import request from 'supertest';
import app from '../../src/app';

// Mock conversation service to avoid real LLM calls
jest.mock('../../src/services/conversation', () => ({
  converse: async (msg: string, lang: string) => {
    return `MOCK_REPLY: ${msg}`;
  }
}));

// Mock prismaClient to avoid DB dependency
jest.mock('../../src/prismaClient', () => ({
  session: {
    create: async (data: any) => ({ id: 'sess_mock', state: data.state || {} }),
    findUnique: async () => null,
    update: async () => ({})
  },
  message: { create: async (d: any) => ({}) },
  diagnosis: { create: async (d: any) => ({}) }
}));

describe('E2E API', () => {
  test('POST /api/chat returns conversational reply', async () => {
    const res = await request(app).post('/api/chat').send({ message: 'Hello there' });
    expect(res.status).toBe(200);
    expect(res.body.reply).toContain('MOCK_REPLY');
    expect(res.body.mode).toBe('CONVERSATIONAL');
  });
});
