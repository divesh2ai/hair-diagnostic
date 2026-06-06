import { LLMDiagnosis } from '../types';

export function generateHinglishResponse(diagnosis: LLMDiagnosis, answers: any) {
  const lines: string[] = [];
  lines.push('Based on aapke answers 👇');
  lines.push(`Aapko ${diagnosis.condition} ho sakta hai`);
  lines.push('\nGood news ✅');
  lines.push('Yeh reversible ho sakta hai agar timely steps liye gaye');
  lines.push('\nMain reasons:');
  for (const r of diagnosis.root_causes) lines.push(`* ${r}`);
  lines.push('\nTreatment plan:');
  lines.push('1) Scalp care aur gentle shampoo');
  lines.push('2) Diet improvements and supplements if required');
  lines.push('3) Stress management');
  return lines.join('\n');
}
