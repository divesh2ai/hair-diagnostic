// Read-only HTTP acceptance: no login attempts, form submissions or DB writes.
// Usage: BASE_URL=https://preview.example EXPECTED_ROOT_PATH=/login node tests/e2e/root-route-smoke.mjs
import assert from 'node:assert/strict';

const origin = new URL(process.env.BASE_URL ?? 'http://localhost:4000');
const rootPath = process.env.EXPECTED_ROOT_PATH;
assert.ok(rootPath?.startsWith('/'), 'Set EXPECTED_ROOT_PATH to the configured root destination');

async function request(path) {
  return fetch(new URL(path, origin), { redirect: 'manual', signal: AbortSignal.timeout(30_000) });
}

const root = await request('/');
assert.equal(root.status, 307, '/ must temporarily redirect');
assert.equal(new URL(root.headers.get('location'), origin).pathname, rootPath);
console.log(`PASS / -> ${rootPath}`);

for (const path of ['/login', '/q/acube-aesthetics']) {
  const response = await request(path);
  assert.equal(response.status, 200, `${path} must render`);
  const html = await response.text();
  assert.ok(!html.includes('<title>404:'), `${path} must not render a Next 404`);
  console.log(`PASS ${path} -> 200`);
}

for (const path of ['/doctor', '/admin']) {
  const response = await request(path);
  assert.equal(response.status, 307, `${path} must redirect anonymous visitors`);
  const login = new URL(response.headers.get('location'), origin);
  assert.equal(login.origin, origin.origin);
  assert.equal(login.pathname, '/login');
  assert.equal(login.searchParams.get('next'), path);
  console.log(`PASS ${path} -> /login?next=${encodeURIComponent(path)}`);
}
