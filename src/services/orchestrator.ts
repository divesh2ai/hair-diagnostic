import { SessionState } from '../types';

export function orchestrate(message: string, state: SessionState) {
  const text = message.toLowerCase();
  let intent: 'GENERAL_QUERY' | 'DIAGNOSIS_REQUIRED' | 'DIRECT_PURCHASE' | 'EXPERT_SUPPORT' = 'GENERAL_QUERY';
  let mode: 'CONVERSATIONAL' | 'DIAGNOSTIC' = 'CONVERSATIONAL';

  if (/hair fall|hairfall|bald|balding|thin hair|shed/.test(text) || (state?.answers && Object.keys(state.answers).length > 0)) {
    intent = 'DIAGNOSIS_REQUIRED';
    mode = 'DIAGNOSTIC';
  }

  if (/buy|purchase|order|price|shop|link/.test(text)) {
    intent = 'DIRECT_PURCHASE';
    mode = 'CONVERSATIONAL';
  }

  if (/expert|doctor|specialist|human/.test(text)) {
    intent = 'EXPERT_SUPPORT';
    mode = 'CONVERSATIONAL';
  }

  // If user explicitly agrees to start diagnosis
  if (/start diagnosis|start test|yes,? do it|let's diagnose|let's do it/.test(text)) {
    intent = 'DIAGNOSIS_REQUIRED';
    mode = 'DIAGNOSTIC';
  }

  return { mode, intent };
}
