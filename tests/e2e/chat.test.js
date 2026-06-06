"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../../src/app"));
// Mock conversation service to avoid real LLM calls
jest.mock('../../src/services/conversation', () => ({
    converse: async (msg, lang) => {
        return `MOCK_REPLY: ${msg}`;
    }
}));
// Mock prismaClient to avoid DB dependency
jest.mock('../../src/prismaClient', () => ({
    session: {
        create: async (data) => ({ id: 'sess_mock', state: data.state || {} }),
        findUnique: async () => null,
        update: async () => ({})
    },
    message: { create: async (d) => ({}) },
    diagnosis: { create: async (d) => ({}) }
}));
describe('E2E API', () => {
    test('POST /api/chat returns conversational reply', async () => {
        const res = await (0, supertest_1.default)(app_1.default).post('/api/chat').send({ message: 'Hello there' });
        expect(res.status).toBe(200);
        expect(res.body.reply).toContain('MOCK_REPLY');
        expect(res.body.mode).toBe('CONVERSATIONAL');
    });
});
