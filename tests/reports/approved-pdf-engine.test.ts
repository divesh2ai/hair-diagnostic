import { describe, it, expect, vi } from 'vitest';
import { Readable } from 'node:stream';
const mocks = vi.hoisted(() => ({ render: vi.fn(), upload: vi.fn() }));
vi.mock('@react-pdf/renderer', () => ({ renderToStream: mocks.render }));
vi.mock('../../src/packages/pdf-engine/templates/PatientReportTemplate', () => ({ PatientReportTemplate: () => null }));
vi.mock('../../src/packages/pdf-engine/storage', () => ({ uploadReportToSupabase: mocks.upload }));
import { generateAndStoreReports } from '../../src/packages/pdf-engine';
import type { ReportInputPayload } from '../../src/packages/pdf-engine/types';
it('threads approved identity through rendering, upload and returned metadata', async () => {
  const approvedVersion = { assessmentId: 'a1', patientId: 'p1', clinicId: 'c1', consultationVersionId: 'cv2', contentVersion: 2 };
  mocks.render.mockResolvedValue(Readable.from([Buffer.from('%PDF-approved-v2')]));
  mocks.upload.mockResolvedValue('immutable-v2.pdf');
  const payload = { assessmentId: 'a1', approvedVersion, patient: { name: 'Display Name', age: 30, gender: 'female' },
    clinic: { name: 'Clinic' }, doctor: { name: 'Doctor' }, clinicalProfile: {}, createdAt: new Date('2026-10-15') } as ReportInputPayload;
  const result = await generateAndStoreReports(payload);
  expect(mocks.render.mock.calls[0][0].props.payload).toBe(payload);
  expect(mocks.upload).toHaveBeenCalledWith(Buffer.from('%PDF-approved-v2'), 'a1', 'display-name-report.pdf', approvedVersion);
  expect(result).toMatchObject({ patientPdfUrl: 'immutable-v2.pdf', reportKind: 'approved', ...approvedVersion });
});
