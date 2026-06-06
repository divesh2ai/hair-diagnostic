import { Finding, FailureComponent, FailureSeverity } from "../types";

export function pk(component: FailureComponent, ref: string, mode: string): string {
  return `${component}::${ref}::${mode}`;
}

export function finding(
  code: string,
  severity: FailureSeverity,
  component: FailureComponent,
  expected: unknown,
  actual: unknown,
  message: string,
  ref: string,
  mode: string
): Finding {
  return { code, severity, component, expected, actual, message, patternKey: pk(component, ref, mode) };
}

export function scoreOf(maxWeight: number, lostWeight: number): number {
  if (maxWeight <= 0) return 100;
  const pct = Math.max(0, Math.min(maxWeight, maxWeight - lostWeight)) / maxWeight;
  return Number((pct * 100).toFixed(2));
}

export function anyCritical(findings: Finding[]): boolean {
  return findings.some((f) => f.severity === "critical");
}
