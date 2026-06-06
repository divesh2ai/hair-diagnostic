import express from 'express';
import prisma from '../prismaClient';
import { orchestrate } from '../services/orchestrator';
import { converse } from '../services/conversation';
import { SessionState } from '../types';

const router = express.Router();

router.post('/', async (req, res) => {
  const { sessionId, message, language } = req.body;
  let session = null;
  if (sessionId) session = await prisma.session.findUnique({ where: { id: sessionId } });
  const state: SessionState = (session?.state as SessionState) || { mode: 'CONVERSATIONAL', step: 'start', answers: {} };

  const result = orchestrate(message, state);

  if (result.mode === 'CONVERSATIONAL') {
    const reply = await converse(message, (language === 'hi' ? 'hi' : language === 'hinglish' ? 'hinglish' : 'en'));
    // persist message
    if (session) await prisma.message.create({ data: { sessionId: session.id, sender: 'bot', text: reply } });
    return res.json({ mode: result.mode, intent: result.intent, reply });
  }

  // If diagnosis required, instruct client to call /api/diagnose
  return res.json({ mode: result.mode, intent: result.intent, reply: 'Would you like to start a short diagnosis? (Yes/No)' });
});

export default router;
