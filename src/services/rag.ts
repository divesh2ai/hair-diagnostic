import fs from 'fs';
import path from 'path';

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'for', 'from', 'has', 'have', 'in', 'is', 'it', 'of', 'on', 'or',
  'that', 'the', 'to', 'was', 'were', 'will', 'with', 'yes', 'no', 'normal'
]);

function collectTextFiles(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) return [];

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectTextFiles(fullPath));
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (['.txt', '.md', '.json'].includes(ext)) {
      files.push(fullPath);
    }
  }

  return files;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 1 && !STOP_WORDS.has(term));
}

function createChunks(text: string, chunkSize = 1200, overlap = 250): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + chunkSize, normalized.length);
    if (end < normalized.length) {
      const lastBreak = normalized.lastIndexOf('\n', end);
      if (lastBreak > start + Math.floor(chunkSize / 2)) {
        end = lastBreak;
      }
    }

    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= normalized.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}

export function buildDiagnosisRagQuery(answers: Record<string, any>): string {
  const parts = [
    answers.hairFallCount ? `hair fall ${answers.hairFallCount}` : '',
    answers.durationMonths ? `duration ${answers.durationMonths} months` : '',
    answers.thyroid ? `thyroid ${answers.thyroid}` : '',
    answers.scalpCondition ? `scalp ${answers.scalpCondition}` : '',
    answers.diet ? `diet ${answers.diet}` : ''
  ].filter(Boolean);

  return parts.join(' ');
}

export async function retrieveRelevantDocs(query: string, docsPath = process.env.RAG_DOCS_PATH || './data/docs') {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return '';

  const queryTerms = tokenize(normalizedQuery);
  if (queryTerms.length === 0) return '';

  const files = collectTextFiles(docsPath);
  const scoredHits: Array<{ score: number; snippet: string }> = [];

  for (const filePath of files) {
    const txt = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath);

    for (const chunk of createChunks(txt)) {
      const haystack = chunk.toLowerCase();
      const uniqueTerms = new Set(queryTerms);
      let score = 0;

      for (const term of uniqueTerms) {
        if (haystack.includes(term)) {
          score += 3;
        }
      }

      if (haystack.includes(normalizedQuery)) {
        score += 8;
      }

      const termPairs = queryTerms.slice(0, -1).map((term, index) => `${term} ${queryTerms[index + 1]}`);
      for (const pair of termPairs) {
        if (pair.trim() && haystack.includes(pair)) {
          score += 5;
        }
      }

      if (score === 0) continue;

      scoredHits.push({
        score,
        snippet: `Source: ${fileName}\n${chunk.slice(0, 2000)}`
      });
    }
  }

  return scoredHits
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((hit) => hit.snippet)
    .join('\n---\n');
}
