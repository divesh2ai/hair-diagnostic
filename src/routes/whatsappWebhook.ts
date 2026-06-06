import express from 'express';
import prisma from '../prismaClient';
import { orchestrate } from '../services/orchestrator';
import { converse } from '../services/conversation';
import { sendText, sendButtons } from '../services/whatsapp';

const router = express.Router();

router.post('/', async (req, res) => {
  const body = req.body;
  const msg = body?.message?.text || body?.messages?.[0]?.text?.body || '';
  const from = body?.contacts?.[0]?.wa_id || body?.messages?.[0]?.from || 'unknown';

  // Lookup existing mapping from WhatsappSession
  let waMap = await prisma.whatsappSession.findUnique({ where: { waId: from } }).catch(() => null as any);
  let session: any = null;
  if (waMap) {
    session = await prisma.session.findUnique({ where: { id: waMap.sessionId } }).catch(() => null as any);
  }

  if (!session) {
    // create a new session and mapping
    session = await prisma.session.create({ data: { state: { whatsappId: from } } });
    await prisma.whatsappSession.create({ data: { waId: from, sessionId: session.id } }).catch(() => null as any);
  }

  const state = (session?.state as any) || { mode: 'CONVERSATIONAL', answers: {} };
  const decision = orchestrate(msg, state);

  try {
    if (decision.mode === 'CONVERSATIONAL') {
      const reply = await converse(msg, 'hinglish');
      await sendText(from, reply);
      return res.json({ ok: true });
    }

    const buttons = [
      { id: 'start_diag', title: 'Start Diagnosis' },
      { id: 'buy', title: 'Buy Product' },
      { id: 'expert', title: 'Talk to Expert' }
    ];
    await sendButtons(from, 'Would you like a short diagnosis?', buttons);
    return res.json({ ok: true });
  } catch (err: any) {
    console.error('WhatsApp send error', err?.response?.data || err.message || err);
    return res.status(500).json({ error: 'failed to send' });
  }
});

export default router;
