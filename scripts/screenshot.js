const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2] || '.';
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const shots = [
    { name: 'dashboard', url: 'http://localhost:3100/admin', w: 1180, h: 1100 },
    { name: 'filter-never-logged-in', url: 'http://localhost:3100/admin?filter=NEVER_LOGGED_IN', w: 1180, h: 900 },
    { name: 'filter-report-issues', url: 'http://localhost:3100/admin?filter=REPORT_ISSUES', w: 1180, h: 900 },
    { name: 'drilldown-acube', url: 'http://localhost:3100/admin/clinic/acube-aesthetics', w: 1180, h: 1200 },
    { name: 'mobile-dashboard', url: 'http://localhost:3100/admin', w: 390, h: 1500, mobile: true },
  ];
  for (const s of shots) {
    const ctx = await browser.newContext({
      viewport: { width: s.w, height: s.h },
      deviceScaleFactor: 2,
      colorScheme: 'light',
    });
    const page = await ctx.newPage();
    await page.goto(s.url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${out}/${s.name}.png`, fullPage: !!s.mobile });
    await ctx.close();
    console.log('shot', s.name);
  }
  await browser.close();
})();
