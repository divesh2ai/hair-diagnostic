import fs from 'fs';
import os from 'os';
import path from 'path';
import { buildDiagnosisRagQuery, retrieveRelevantDocs } from '../src/services/rag';

describe('retrieveRelevantDocs', () => {
  test('reads text knowledge files recursively and returns ranked hits', async () => {
    const docsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rag-docs-'));
    const nestedDir = path.join(docsRoot, 'nested');
    fs.mkdirSync(nestedDir);

    fs.writeFileSync(path.join(docsRoot, 'ignore.bin'), 'binary', 'utf8');
    fs.writeFileSync(path.join(docsRoot, 'alpha.txt'), 'alopecia treatment support', 'utf8');
    fs.writeFileSync(path.join(nestedDir, 'beta.md'), 'alopecia protocol and phenotype guidance', 'utf8');
    fs.writeFileSync(path.join(nestedDir, 'gamma.json'), '{"note":"hair only"}', 'utf8');

    const result = await retrieveRelevantDocs('alopecia protocol', docsRoot);

    expect(result).toContain('alopecia treatment support');
    expect(result).toContain('alopecia protocol and phenotype guidance');
    expect(result).toContain('Source:');

    fs.rmSync(docsRoot, { recursive: true, force: true });
  });

  test('builds a broader diagnosis query from structured answers', () => {
    const query = buildDiagnosisRagQuery({
      hairFallCount: '120',
      durationMonths: '8',
      thyroid: 'yes',
      scalpCondition: 'oily',
      diet: 'vegetarian'
    });

    expect(query).toContain('hair fall 120');
    expect(query).toContain('duration 8 months');
    expect(query).toContain('thyroid yes');
    expect(query).toContain('scalp oily');
    expect(query).toContain('diet vegetarian');
  });
});
