import { createHash } from "node:crypto";
import JSZip from "jszip";

export const FIVE_KIT_EXTRACTOR_VERSION = "five-kit-ooxml/1.0.0";

export type SourceProvenance = {
  sourceFile: string;
  sourceVersion: number;
  sourceFingerprint: string;
  sourceSection?: string;
  sourceSheet?: string;
  sourceRow?: number;
  sourceColumn?: number;
  cellAddress?: string;
  paragraphStart?: number;
  paragraphEnd?: number;
  rawExtractedValue: unknown;
  normalisedValue: unknown;
  formula?: string | null;
  formulaResult?: unknown;
  formulaError?: string | null;
  extractedAt: string;
  extractorVersion: string;
};

export type WorkbookCell = {
  address: string;
  row: number;
  column: number;
  rawValue: string | number | boolean | null;
  displayValue: string;
  formula: string | null;
  formulaResult: string | number | boolean | null;
  formulaError: string | null;
  styleIndex: number | null;
};

export type WorkbookSheet = {
  name: string;
  relationshipTarget: string;
  authoritativeCandidate: boolean;
  rows: Map<number, Map<number, WorkbookCell>>;
};

export type ExtractedWorkbook = {
  fileName: string;
  fingerprint: string;
  extractedAt: string;
  extractorVersion: string;
  sheets: WorkbookSheet[];
};

export type DocxBlock = {
  position: number;
  kind: "PARAGRAPH" | "TABLE";
  text: string;
  style: string;
  headingLevel: number | null;
  bullet: boolean;
  tableRows?: string[][];
};

export type ExtractedDocx = {
  fileName: string;
  fingerprint: string;
  extractedAt: string;
  extractorVersion: string;
  blocks: DocxBlock[];
};

const ERROR_VALUES = new Set(["#REF!", "#VALUE!", "#N/A", "#DIV/0!", "#NAME?", "#NUM!", "#NULL!"]);

const decodeXml = (value: string): string => value
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'")
  .replace(/&amp;/g, "&")
  .replace(/&#(\d+);/g, (_, value: string) => String.fromCodePoint(Number(value)))
  .replace(/&#x([0-9a-f]+);/gi, (_, value: string) => String.fromCodePoint(Number.parseInt(value, 16)));

const attr = (xml: string, name: string): string | null => {
  const match = xml.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`));
  return match ? decodeXml(match[1]) : null;
};

const tagText = (xml: string, tag: string): string | null => {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`));
  return match ? decodeXml(match[1].replace(/<[^>]+>/g, "")) : null;
};

const allText = (xml: string, tag: string): string[] => [...xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "g"))]
  .map((match) => decodeXml(match[1].replace(/<[^>]+>/g, "")));

const fingerprint = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

const columnNumber = (address: string): number => {
  const letters = address.match(/^[A-Z]+/i)?.[0].toUpperCase() ?? "A";
  return [...letters].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0);
};

const parseScalar = (value: string | null, type: string | null, shared: string[]): string | number | boolean | null => {
  if (value === null || value === "") return null;
  if (type === "s") return shared[Number(value)] ?? value;
  if (type === "b") return value === "1";
  if (type === "str" || type === "inlineStr" || type === "e") return value;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value;
};

const authoritativeSheet = (name: string): boolean => {
  if (/\b(copy|working|temporary|temp|do not consider|not confirm)\b/i.test(name)) return false;
  return ["Individual products MRP", "New MRP of kits", "Complete formulation"].includes(name);
};

/** Direct OOXML workbook reader. It intentionally preserves formulas and cached results separately. */
export async function extractWorkbook(bytes: Uint8Array, fileName: string): Promise<ExtractedWorkbook> {
  const zip = await JSZip.loadAsync(bytes);
  const workbookXml = await zip.file("xl/workbook.xml")?.async("string");
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");
  if (!workbookXml || !relsXml) throw new Error("Invalid XLSX: workbook parts are missing");

  const sharedXml = await zip.file("xl/sharedStrings.xml")?.async("string");
  const shared = sharedXml ? [...sharedXml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map((match) => allText(match[1], "t").join("")) : [];
  const rels = new Map<string, string>();
  for (const match of relsXml.matchAll(/<Relationship\s+([^>]+)\/?\s*>/g)) {
    const id = attr(match[1], "Id");
    const target = attr(match[1], "Target");
    if (id && target) rels.set(id, target.replace(/^\//, ""));
  }

  const extractedAt = new Date().toISOString();
  const sheets: WorkbookSheet[] = [];
  for (const match of workbookXml.matchAll(/<sheet\s+([^>]+)\/?\s*>/g)) {
    const name = attr(match[1], "name");
    const relationshipId = attr(match[1], "r:id");
    if (!name || !relationshipId) continue;
    const rawTarget = rels.get(relationshipId);
    if (!rawTarget) continue;
    const target = rawTarget.startsWith("xl/") ? rawTarget : `xl/${rawTarget.replace(/^\.\//, "")}`;
    const xml = await zip.file(target)?.async("string");
    if (!xml) continue;
    const rows = new Map<number, Map<number, WorkbookCell>>();
    for (const rowMatch of xml.matchAll(/<row\s+([^>]*)>([\s\S]*?)<\/row>/g)) {
      const rowNumber = Number(attr(rowMatch[1], "r"));
      const cells = new Map<number, WorkbookCell>();
      for (const cellMatch of rowMatch[2].matchAll(/<c\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const address = attr(cellMatch[1], "r") ?? `A${rowNumber}`;
        const type = attr(cellMatch[1], "t");
        const body = cellMatch[2] ?? "";
        const formula = tagText(body, "f");
        const inline = type === "inlineStr" ? allText(body, "t").join("") : null;
        const cached = inline ?? tagText(body, "v");
        const parsed = parseScalar(cached, type, shared);
        const formulaError = (type === "e" || (typeof parsed === "string" && ERROR_VALUES.has(parsed))) ? String(parsed) : null;
        const column = columnNumber(address);
        cells.set(column, {
          address,
          row: rowNumber,
          column,
          rawValue: formula ? formula : parsed,
          displayValue: parsed === null ? "" : String(parsed),
          formula,
          formulaResult: formula ? parsed : null,
          formulaError,
          styleIndex: attr(cellMatch[1], "s") === null ? null : Number(attr(cellMatch[1], "s")),
        });
      }
      if (cells.size) rows.set(rowNumber, cells);
    }
    sheets.push({ name, relationshipTarget: target, authoritativeCandidate: authoritativeSheet(name), rows });
  }
  return { fileName, fingerprint: fingerprint(bytes), extractedAt, extractorVersion: FIVE_KIT_EXTRACTOR_VERSION, sheets };
}

const paragraphText = (xml: string): string => {
  const output: string[] = [];
  const tokens = [...xml.matchAll(/<w:(t|tab|br)(?:\s[^>]*)?(?:>([\s\S]*?)<\/w:\1>|\/\s*>)/g)];
  for (const token of tokens) {
    if (token[1] === "tab") output.push("\t");
    else if (token[1] === "br") output.push("\n");
    else output.push(decodeXml((token[2] ?? "").replace(/<[^>]+>/g, "")));
  }
  return output.join("").replace(/[ \t]+\n/g, "\n").trim();
};

const paragraphStyle = (xml: string): string => xml.match(/<w:pStyle\s+w:val="([^"]+)"\s*\/>/)?.[1] ?? "Normal";

const headingLevel = (style: string): number | null => {
  if (/^Title$/i.test(style)) return 1;
  const match = style.match(/^Heading\s*([1-9])/i);
  return match ? Number(match[1]) : null;
};

/** Direct DOCX reader retaining paragraph order, styles, bullets and tables. */
export async function extractDocx(bytes: Uint8Array, fileName: string): Promise<ExtractedDocx> {
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) throw new Error("Invalid DOCX: word/document.xml is missing");
  const body = xml.match(/<w:body>([\s\S]*?)<\/w:body>/)?.[1] ?? xml;
  const blocks: DocxBlock[] = [];
  let position = 0;
  for (const match of body.matchAll(/<w:(p|tbl)(?:\s[^>]*)?>([\s\S]*?)<\/w:\1>/g)) {
    position += 1;
    if (match[1] === "p") {
      const text = paragraphText(match[2]);
      if (!text) continue;
      const style = paragraphStyle(match[2]);
      blocks.push({ position, kind: "PARAGRAPH", text, style, headingLevel: headingLevel(style), bullet: /<w:numPr[\s>]/.test(match[2]) });
      continue;
    }
    const tableRows = [...match[2].matchAll(/<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g)].map((row) =>
      [...row[1].matchAll(/<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g)].map((cell) => paragraphText(cell[1])),
    );
    const text = tableRows.map((row) => row.join(" | ")).join("\n").trim();
    if (text) blocks.push({ position, kind: "TABLE", text, style: "Table", headingLevel: null, bullet: false, tableRows });
  }
  return { fileName, fingerprint: fingerprint(bytes), extractedAt: new Date().toISOString(), extractorVersion: FIVE_KIT_EXTRACTOR_VERSION, blocks };
}

export function cellAt(sheet: WorkbookSheet, row: number, column: number): WorkbookCell | null {
  return sheet.rows.get(row)?.get(column) ?? null;
}

export function provenanceForCell(workbook: ExtractedWorkbook, sheet: WorkbookSheet, cell: WorkbookCell, normalisedValue: unknown): SourceProvenance {
  return {
    sourceFile: workbook.fileName,
    sourceVersion: 1,
    sourceFingerprint: workbook.fingerprint,
    sourceSheet: sheet.name,
    sourceRow: cell.row,
    sourceColumn: cell.column,
    cellAddress: cell.address,
    rawExtractedValue: cell.rawValue,
    normalisedValue,
    formula: cell.formula,
    formulaResult: cell.formulaResult,
    formulaError: cell.formulaError,
    extractedAt: workbook.extractedAt,
    extractorVersion: workbook.extractorVersion,
  };
}
