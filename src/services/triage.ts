export function triage(data: any) {
  let severity: 'LOW'|'MEDIUM'|'HIGH' = 'LOW';
  let needsHuman = false;

  const hairFall = Number(data.hairFallCount || 0);
  const duration = Number(data.durationMonths || 0);

  if (hairFall > 150) {
    severity = 'HIGH';
    needsHuman = true;
  } else if (hairFall > 80 || duration > 6) {
    severity = 'MEDIUM';
  }

  if ((data.thyroid || '').toString().toLowerCase() === 'yes') {
    needsHuman = true;
    severity = severity === 'LOW' ? 'MEDIUM' : severity;
  }

  return { severity, needsHuman };
}
