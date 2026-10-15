import { describe, it, expect, vi, beforeEach } from 'vitest';
import { approvedReportPath } from '../../src/packages/pdf-engine/version';
const m = vi.hoisted(() => ({
  ctx: vi.fn(), verify: vi.fn(), generate: vi.fn(), sign: vi.fn(),
  assessment: { findUnique: vi.fn() }, consultation: { findUnique: vi.fn() },
  consultationVersion: { findFirst: vi.fn() },
  aIArtifact: { findUnique: vi.fn(), findFirst: vi.fn(), upsert: vi.fn() },
  reportAsset: { findUnique: vi.fn(), upsert: vi.fn() },
  auditLog: { findFirst: vi.fn(), upsert: vi.fn() }, $transaction: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({ prisma: m }));
vi.mock('@/lib/auth', () => ({ getClinicContext: m.ctx, isSuperAdmin: (role: string) => role === 'SUPER_ADMIN',
  handleAuthError: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }) }));
vi.mock('@/lib/reviewToken', () => ({ verifyReviewToken: m.verify }));
vi.mock('@hairos/packages/pdf-engine', () => ({ generateAndStoreReports: m.generate }));
vi.mock('@hairos/packages/pdf-engine/storage', () => ({ signReportUrl: m.sign }));
vi.mock('@/lib/observability/lifecycle', () => ({ logLifecycleEvent: vi.fn() }));
import { GET, POST } from '../../apps/patient-portal/src/app/api/assessment/pdf/route';
import { recordApprovedPdf } from '../../apps/patient-portal/src/lib/reports/approvedPdf';

const subject = { id: 'a1', patientId: 'p1', clinicId: 'c1' };
const readiness = { schemaVersion: 1, evaluatedAt: '2026-10-15T00:00:00Z', sourceClinicalArtifactVersion: 'v4',
  isReadyForApproval: true, groundingViolations: [], reasoningGaps: [], blockingCodes: [], summary: { groundingViolationCount: 0, reasoningGapCount: 0 } };
function version(n: number) {
  return { id: `cv${n}`, contentVersion: n, approvalStatus: 'APPROVED', approvedAt: new Date('2026-10-15T00:00:00Z'), contentHash: `hash${n}`, approvedBy: 'd1',
    content: { patient: { id: 'p1', name: 'Same Name', age: 42, sex: 'female' }, assessment: { id: 'a1' },
      version: { contentVersion: n }, clinicalReadiness: readiness, audit: { createdAt: '2026-10-15T00:00:00Z' },
      clinicalReport: { marker: `approved-${n}`, treatmentStrategy: ['old engine plan'] },
      treatmentPlan: { kitPhases: [`doctor plan ${n}`], topicals: [], topicalCautions: [], expectedTimeline: [] } } };
}
let versions: ReturnType<typeof version>[];
let current: ReturnType<typeof version>;
let assets: Map<string, any>;
let audits: Map<string, any>;
let pointer: any;
let failCommit: boolean;
const post = (body: object = { assessmentId: 'a1' }) => POST(new Request('http://localhost/api/assessment/pdf', { method: 'POST', body: JSON.stringify(body) }));
const get = (query = '') => GET(new Request(`http://localhost/api/assessment/pdf?id=a1${query}`));
beforeEach(() => {
  vi.resetAllMocks();
  versions = [version(1)]; current = versions[0]; assets = new Map(); audits = new Map(); pointer = null; failCommit = false;
  m.ctx.mockResolvedValue({ role: 'DOCTOR', clinicId: 'c1' });
  m.assessment.findUnique.mockResolvedValue({ ...subject, patient: { name: 'Renamed live patient' }, clinic: { name: 'Clinic' }, reviewingDoctor: { name: 'Doctor' } });
  m.consultation.findUnique.mockImplementation(async (args: any) => {
    if (args.select) return { currentVersionId: current.id };
    const n = args.include?.versions?.where?.contentVersion;
    return { id: 'con1', ...subject, currentVersion: current, versions: n ? versions.filter(v => v.contentVersion === n) : [] };
  });
  m.consultationVersion.findFirst.mockImplementation(async (args: any) => versions.find(v => v.id === args.where.id && v.approvalStatus === args.where.approvalStatus) ?? null);
  m.reportAsset.findUnique.mockImplementation(async (args: any) => assets.get(args.where.render_key.consultationVersionId) ?? null);
  m.reportAsset.upsert.mockImplementation(async (args: any) => {
    const key = args.where.render_key.consultationVersionId;
    if (!assets.has(key)) assets.set(key, { id: `asset-${key}`, ...args.create });
    return assets.get(key);
  });
  m.auditLog.upsert.mockImplementation(async (args: any) => { if (!audits.has(args.where.id)) audits.set(args.where.id, args.create); return audits.get(args.where.id); });
  m.auditLog.findFirst.mockImplementation(async () => [...audits.values()].find(a => a.action === 'PDF_REFERENCE_PRESERVED') ?? null);
  m.aIArtifact.findUnique.mockImplementation(async () => pointer);
  m.aIArtifact.upsert.mockImplementation(async (args: any) => { pointer = { id: 'report1', content: args.update.content }; return pointer; });
  m.$transaction.mockImplementation(async (fn: any) => {
    const before = { assets: new Map(assets), audits: new Map(audits), pointer };
    try { const result = await fn(m); if (failCommit) throw new Error('database commit failed'); return result; }
    catch (error) { assets = before.assets; audits = before.audits; pointer = before.pointer; throw error; }
  });
  m.generate.mockImplementation(async (payload: any) => ({ patientPdfUrl: approvedReportPath(payload.approvedVersion) }));
  m.sign.mockImplementation(async path => `https://signed.example/${path}`);
  vi.stubGlobal('fetch', vi.fn(async () => new Response('pdf', { headers: { 'content-type': 'application/pdf' } })));
});

describe('approved PDF version preservation route', () => {
  it('binds content and doctor edits to v1, stores v2 separately, and retrieves v1 while v2 is a draft', async () => {
    expect((await post()).status).toBe(200);
    const first = assets.get('cv1');
    const payload = m.generate.mock.calls[0][0];
    expect(payload.clinicalReport.marker).toBe('approved-1');
    expect(payload.clinicalReport.treatmentStrategy).toEqual(['doctor plan 1']);
    expect(payload.patient.name).toBe('Same Name');
    expect(m.aIArtifact.findFirst).not.toHaveBeenCalled();
    current = version(2); versions.push(current);
    expect((await post()).status).toBe(200);
    expect(assets.size).toBe(2);
    expect(assets.get('cv1')).toEqual(first);
    expect(assets.get('cv2').storagePath).not.toBe(first.storagePath);
    expect(audits.get('pdf-approved-asset-cv1').metadata.contentHash).toBe('hash1');
    current.approvalStatus = 'PENDING_REVIEW';
    expect((await get('&contentVersion=1')).status).toBe(200);
    expect(m.sign).toHaveBeenLastCalledWith(first.storagePath, 300);
    expect((await get('&contentVersion=2')).status).toBe(403);
  });
  it('idempotently reuses a READY version without rendering or replacing metadata', async () => {
    await post(); const saved = assets.get('cv1');
    expect((await post()).status).toBe(200);
    expect(m.generate).toHaveBeenCalledTimes(1);
    expect(assets.get('cv1')).toEqual(saved);
  });
  it('concurrent requests converge on one record and unique-conflict retries reuse the committed winner', async () => {
    const responses = await Promise.all([post(), post()]);
    expect(responses.map(r => r.status)).toEqual([200, 200]);
    expect(assets.size).toBe(1);
    const saved = assets.get('cv1');
    m.$transaction.mockRejectedValueOnce({ code: 'P2002' });
    expect(await recordApprovedPdf(subject, 'con1', current, saved.storagePath)).toEqual(saved);
  });
  it('fails if approval is withdrawn while the PDF is rendering', async () => {
    m.generate.mockImplementationOnce(async payload => {
      current.approvalStatus = 'REJECTED';
      return { patientPdfUrl: approvedReportPath(payload.approvedVersion) };
    });
    expect((await post()).status).toBe(500);
    expect(assets.size).toBe(0); expect(pointer).toBeNull();
  });
  it('does not report success after upload or DB failure; a retry completes safely', async () => {
    m.generate.mockRejectedValueOnce(new Error('upload failed'));
    expect((await post()).status).toBe(500); expect(assets.size).toBe(0);
    failCommit = true;
    expect((await post()).status).toBe(500); expect(assets.size).toBe(0); expect(pointer).toBeNull();
    failCommit = false;
    expect((await post()).status).toBe(200); expect(assets.size).toBe(1);
  });
  it('denies cross-clinic generation and historical retrieval before signing or rendering', async () => {
    m.ctx.mockResolvedValue({ role: 'DOCTOR', clinicId: 'other' });
    expect((await post()).status).toBe(403);
    expect((await get('&contentVersion=1')).status).toBe(403);
    expect(m.sign).not.toHaveBeenCalled(); expect(m.generate).not.toHaveBeenCalled();
  });
  it('denies anonymous and wrong-assessment tokens', async () => {
    m.ctx.mockRejectedValue(new Error('unauthenticated')); m.verify.mockReturnValue({ ok: true, assessmentId: 'other' });
    expect((await post()).status).toBe(401);
    expect((await get('&t=wrong&contentVersion=1')).status).toBe(401);
    expect(m.generate).not.toHaveBeenCalled(); expect(m.sign).not.toHaveBeenCalled();
  });
  it('accepts only an assessment-bound patient token for approved history and refuses legacy access', async () => {
    await post();
    m.ctx.mockRejectedValue(new Error('unauthenticated')); m.verify.mockReturnValue({ ok: true, assessmentId: 'a1' });
    expect((await get('&t=bound&contentVersion=1')).status).toBe(200);
    m.sign.mockClear();
    expect((await get('&t=bound&legacy=1')).status).toBe(403);
    expect(m.sign).not.toHaveBeenCalled();
  });
  it('refuses mismatched historical asset identity before signing', async () => {
    await post(); assets.get('cv1').clinicId = 'other';
    expect((await get('&contentVersion=1')).status).toBe(500);
    expect(m.sign).not.toHaveBeenCalled();
  });
  it('refuses unapproved, unready, inconsistent and stale snapshots', async () => {
    current.approvalStatus = 'PENDING_REVIEW'; expect((await post()).status).toBe(403);
    current.approvalStatus = 'APPROVED';
    expect((await post({ assessmentId: 'a1', contentVersion: 2 })).status).toBe(409);
    current.content.clinicalReadiness = null as any; expect((await post()).status).toBe(422);
    current.content.clinicalReadiness = readiness;
    current.content.patient.id = 'other'; expect((await post()).status).toBe(500);
    expect(m.generate).not.toHaveBeenCalled();
  });
  it('recovers a missing historical PDF from its approved snapshot, never the latest pointer', async () => {
    pointer = { content: { patientPdfUrl: 'reports/new.pdf', consultationVersionId: 'cv2' } };
    expect((await get('&contentVersion=1')).status).toBe(200);
    expect(m.generate.mock.calls[0][0].clinicalReport.marker).toBe('approved-1');
    expect(m.sign).toHaveBeenLastCalledWith(assets.get('cv1').storagePath, 300);
  });
  it('doctor download links recover a draft pointer only after approval, and fail truthfully', async () => {
    pointer = { id: 'draft', content: { patientPdfUrl: 'drafts/a1/p.pdf', reportKind: 'draft' } };
    m.generate.mockRejectedValueOnce(new Error('offline'));
    expect((await get()).status).toBe(500);
    expect(m.sign).not.toHaveBeenCalled();
    expect((await get()).status).toBe(200);
    expect(m.sign).toHaveBeenLastCalledWith(assets.get('cv1').storagePath, 300);
  });
  it('preserves an existing legacy URL verbatim and keeps it downloadable after new generation', async () => {
    const legacy = 'https://old.example/storage/v1/object/public/clinical-reports/reports/a1/old.pdf';
    pointer = { id: 'old-report', content: { patientPdfUrl: legacy, oldMetadata: 'keep' } };
    expect((await get('&legacy=1')).status).toBe(200);
    expect(m.sign).toHaveBeenLastCalledWith('reports/a1/old.pdf', 300);
    expect((await post()).status).toBe(200);
    expect(audits.get('pdf-legacy-old-report').metadata).toEqual({ patientPdfUrl: legacy, oldMetadata: 'keep' });
    expect((await get('&legacy=1')).status).toBe(200);
    expect(m.sign).toHaveBeenLastCalledWith('reports/a1/old.pdf', 300);
  });
});
