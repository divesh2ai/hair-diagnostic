import fs from "node:fs";
import path from "node:path";
import { ClinicalReplayCase } from "../types";

const CASES_DIR = path.resolve(__dirname, "..", "..", "..", "..", "tests", "fixtures", "replay-corpus-v2", "cases");

export function loadCorpus(opts: { filter?: string } = {}): ClinicalReplayCase[] {
  const files = fs.readdirSync(CASES_DIR).filter((f) => f.endsWith(".json")).sort();
  const cases = files.map((f) =>
    JSON.parse(fs.readFileSync(path.join(CASES_DIR, f), "utf8")) as ClinicalReplayCase
  );
  if (!opts.filter) return cases;
  const f = opts.filter;
  return cases.filter((c) => c.caseId === f || c.category === f || c.caseId.includes(f));
}
