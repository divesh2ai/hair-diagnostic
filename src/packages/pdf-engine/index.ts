import React from 'react';
import { renderToStream } from '@react-pdf/renderer';
import { PatientReportTemplate } from './templates/PatientReportTemplate';
import { uploadReportToSupabase } from './storage';
import { ReportInputPayload } from './types';

/**
 * Converts a patient name into a safe, lowercase filename slug.
 * e.g. "Rohini Sharma"  → "rohini-sharma"
 *      "Séraphin O'Neil" → "seraphin-oneil"
 */
function toFilenameSlug(name: string): string {
  return name
    .normalize('NFD')                   // decompose accented characters
    .replace(/[̀-ͯ]/g, '')    // strip accent marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')       // non-alphanumeric → hyphen
    .replace(/^-+|-+$/g, '');          // trim leading/trailing hyphens
}

/**
 * Main orchestrator for the PDF Generation Engine.
 * Converts React PDF Components into Buffers, uploads them, and returns URLs.
 */
export async function generateAndStoreReports(payload: ReportInputPayload) {
  console.log(`[PDF Engine] Generating reports for Assessment ${payload.assessmentId}...`);

  // Derive a patient-specific filename, e.g. "rohini-report.pdf"
  const patientSlug = toFilenameSlug(payload.patient.name) || 'patient';
  const patientFilename = `${patientSlug}-report.pdf`;

  try {
    // 1. Render Patient Report to a Stream
    // We must use 'any' casting here because `@react-pdf/renderer` typings for Node environments
    // can be tricky regarding JSX.Element vs ReactElement in monorepos.
    console.log(`[PDF Engine] Rendering PDF for patient: ${payload.patient.name}`);
    console.log(`[PDF Engine] clinicalProfile keys: ${Object.keys(payload.clinicalProfile ?? {}).join(', ') || '(empty)'}`);
    console.log(`[PDF Engine] kitRecommendation present: ${!!payload.kitRecommendation}, adjunctProtocol present: ${!!(payload.kitRecommendation as any)?.adjunctProtocol}`);
    console.log(`[PDF Engine] visualJourney sections: ${Array.isArray((payload.visualJourney as any)?.sections) ? (payload.visualJourney as any).sections.length : '(none)'}`);

    const patientReportStream = await renderToStream(
      React.createElement(PatientReportTemplate, { payload }) as any
    );
    console.log(`[PDF Engine] Render stream created — converting to buffer`);

    // 2. Convert Stream to Buffer
    const patientBuffer = await streamToBuffer(patientReportStream);
    console.log(`[PDF Engine] Buffer size: ${patientBuffer.length} bytes`);

    // 3. Upload to Secure Storage
    const patientPdfUrl = await uploadReportToSupabase(
      patientBuffer,
      payload.assessmentId,
      patientFilename
    );
    console.log(`[PDF Engine] Patient Report stored at: ${patientPdfUrl}`);

    // (Doctor report would be generated here similarly)

    return {
      patientPdfUrl,
      // doctorPdfUrl: '...'
    };
  } catch (error) {
    const msg = error instanceof Error ? `${error.message}\n${error.stack}` : String(error);
    console.error(`[PDF Engine] CRASH — patient: ${payload.patient.name}, assessmentId: ${payload.assessmentId}`);
    console.error(`[PDF Engine] Error detail: ${msg}`);
    throw error;
  }
}

// Utility to convert a NodeJS stream to a Buffer
function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', chunk => chunks.push(Buffer.from(chunk)));
    stream.on('error', err => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
