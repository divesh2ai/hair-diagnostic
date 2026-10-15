import { describe, it, expect, vi, beforeEach } from 'vitest';
import { approvedReportPath } from '../../src/packages/pdf-engine/version';
const storage = vi.hoisted(() => ({ upload: vi.fn(), download: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ storage: { from: () => storage } }) }));
import { uploadReportToSupabase } from '../../src/packages/pdf-engine/storage';
const identity = { clinicId: 'c1', patientId: 'p1', assessmentId: 'a1', consultationVersionId: 'cv1', contentVersion: 1 };
beforeEach(() => vi.resetAllMocks());
describe('approved PDF immutable storage', () => {
  it('stores v1 and v2 separately and never overwrites v1', async () => {
    const objects = new Map<string, string>();
    storage.upload.mockImplementation(async (path, bytes, options) => {
      expect(options.upsert).toBe(false);
      if (objects.has(path)) return { error: { message: 'The resource already exists', statusCode: '409' } };
      objects.set(path, bytes.toString()); return { error: null };
    });
    storage.download.mockImplementation(async path => ({ data: new Blob([objects.get(path)!]), error: null }));
    const v1 = await uploadReportToSupabase(Buffer.from('approved v1'), 'a1', 'same-name.pdf', identity);
    const v2 = await uploadReportToSupabase(Buffer.from('approved v2'), 'a1', 'same-name.pdf', { ...identity, contentVersion: 2, consultationVersionId: 'cv2' });
    expect(v1).not.toBe(v2);
    await uploadReportToSupabase(Buffer.from('retry must not replace'), 'a1', 'renamed.pdf', identity);
    expect([...objects.values()]).toEqual(['approved v1', 'approved v2']);
  });
  it('separates same-name patients, assessments and clinics; names do not affect identity', () => {
    const path = approvedReportPath(identity);
    for (const change of [{ patientId: 'p2' }, { assessmentId: 'a2' }, { clinicId: 'c2' }]) expect(approvedReportPath({ ...identity, ...change })).not.toBe(path);
  });
  it('rejects traversal and invalid versions', () => {
    expect(() => approvedReportPath({ ...identity, patientId: '../p2' })).toThrow();
    expect(() => approvedReportPath({ ...identity, contentVersion: 0 })).toThrow();
  });
  it('fails on upload errors and unreadable duplicate objects', async () => {
    storage.upload.mockResolvedValue({ error: { message: 'offline' } });
    await expect(uploadReportToSupabase(Buffer.from('x'), 'a1', 'p.pdf', identity)).rejects.toThrow('offline');
    storage.upload.mockResolvedValue({ error: { message: 'The resource already exists' } });
    storage.download.mockResolvedValue({ error: { message: 'unavailable' }, data: null });
    await expect(uploadReportToSupabase(Buffer.from('x'), 'a1', 'p.pdf', identity)).rejects.toThrow();
  });
  it('keeps draft uploads outside approved paths', async () => {
    storage.upload.mockResolvedValue({ error: null });
    expect(await uploadReportToSupabase(Buffer.from('draft'), 'a1', 'patient.pdf')).toBe('drafts/a1/patient.pdf');
  });
});
