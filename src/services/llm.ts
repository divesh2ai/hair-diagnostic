import axios from 'axios';
import { getChatCompletionsUrl, LLM_API_KEY, LLM_MODEL } from '../config';
import { LLMDiagnosis } from '../types';

export async function runLLMDiagnosis(context: string, structured: any): Promise<LLMDiagnosis> {
  const system = `You are an AI trichologist. Use only the provided structured data and docs. Respond JSON with keys: condition, confidence, root_causes.`;
  const prompt = `${system}\nContext:\n${context}\nStructured:${JSON.stringify(structured)}`;

  const payload = {
    model: LLM_MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt }
    ],
    max_tokens: 400
  };

  try {
    const res = await axios.post(getChatCompletionsUrl(), payload, {
      headers: { Authorization: `Bearer ${LLM_API_KEY}` },
      timeout: 30_000
    });

    if (res.status !== 200) {
      console.error('LLM non-200 response', res.status, res.data);
      return { condition: 'unknown', confidence: 0.0, root_causes: [] };
    }

    const text = res.data?.choices?.[0]?.message?.content || '';
    try {
      const parsed = JSON.parse(text);
      return {
        condition: parsed.condition || 'unknown',
        confidence: Number(parsed.confidence || 0),
        root_causes: parsed.root_causes || []
      };
    } catch (parseErr) {
      console.error('Failed to parse LLM JSON response:', parseErr, 'raw:', text?.slice?.(0, 1000));
      return { condition: 'unknown', confidence: 0.0, root_causes: [] };
    }
  } catch (err: any) {
    console.error('LLM request failed:', err?.message || err);
    return { condition: 'unknown', confidence: 0.0, root_causes: [] };
  }
}
