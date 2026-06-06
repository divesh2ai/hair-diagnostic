import express from 'express';
import prisma from '../prismaClient';
import { startOrContinueDiagnosis } from '../services/diagnosis';
import { triage } from '../services/triage';
import { buildDiagnosisRagQuery, retrieveRelevantDocs } from '../services/rag';
import { runLLMDiagnosis } from '../services/llm';
import { mapProduct } from '../services/productMapper';
import { generateHinglishResponse } from '../services/response';

const router = express.Router();

router.post('/start', async (req, res) => {
  const { sessionId } = req.body;
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const state = (session.state as any) || { mode: 'DIAGNOSTIC', answers: {} };
  const next = await startOrContinueDiagnosis(session.id, state);
  res.json(next);
});

router.post('/answer', async (req, res) => {
  const { sessionId, key, value } = req.body;
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const state = (session.state as any) || { mode: 'DIAGNOSTIC', answers: {} };
  state.answers = { ...state.answers, [key]: value };
  // save
  await prisma.session.update({ where: { id: sessionId }, data: { state } });

  // check if finished
  const questionsDone = Object.keys(state.answers).length;
  if (questionsDone >= 5) {
    // run triage
    const triageRes = triage(state.answers);
    const ragQuery = buildDiagnosisRagQuery(state.answers);
    const docs = await retrieveRelevantDocs(ragQuery);
    const llm = await runLLMDiagnosis(docs, state.answers);
    // store diagnosis
    const diagnosis = await prisma.diagnosis.create({ data: { sessionId: sessionId, condition: llm.condition, confidence: llm.confidence, rootCauses: JSON.stringify(llm.root_causes), recommendations: '{}' } });
    const prod = mapProduct(llm.condition);
    const text = generateHinglishResponse(llm, state.answers);
    return res.json({ triage: triageRes, diagnosis: llm, product: prod, message: text, ragQuery });
  }

  // return next question
  return res.json({ ok: true, nextQuestionIndex: questionsDone });
});

export default router;
