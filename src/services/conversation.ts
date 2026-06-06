import { getChatCompletionsUrl, LLM_API_KEY, LLM_MODEL } from '../config';
import axios from 'axios';

export async function converse(message: string, language: 'en'|'hi'|'hinglish' = 'en') {
  // Minimal LLM call wrapper. In production, use batching, streaming and robust error handling.
  const systemPrompt = `You are an AI trichologist. Explain in ${language === 'hi' ? 'Hindi' : language === 'hinglish' ? 'Hinglish' : 'English'}; be empathetic and do not force diagnosis.`;

  const payload = {
    model: LLM_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ],
    max_tokens: 600
  };

  try {
    const res = await axios.post(getChatCompletionsUrl(), payload, {
      headers: { Authorization: `Bearer ${LLM_API_KEY}` },
      timeout: 30_000
    });
    if (res.status !== 200) {
      console.error('Conversation LLM non-200 response', res.status, res.data);
      return 'Sorry, I could not respond right now.';
    }
    const text = res.data?.choices?.[0]?.message?.content || 'Sorry, I could not respond right now.';
    return text;
  } catch (err: any) {
    console.error('Conversation LLM request failed:', err?.message || err);
    return 'Sorry, I could not respond right now.';
  }
}
