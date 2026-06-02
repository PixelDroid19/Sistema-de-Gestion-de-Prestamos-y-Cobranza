const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });

  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  console.log('login url', page.url());

  const fields = await page.$$eval('input', (nodes) => nodes.map(n => ({id: n.id, name: n.name, type: n.type, placeholder: n.getAttribute('placeholder'), aria: n.getAttribute('aria-label')})));
  console.log('LOGIN fields', JSON.stringify(fields, null, 2));

  await page.fill('input[placeholder="Correo"]', 'qa.admin.20260427@test.local');
  await page.fill('input[type="password"]', 'Admin123!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2200);

  const afterLogin = page.url();
  console.log('after login', afterLogin);

  await page.goto('http://localhost:3000/credits-new', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  console.log('credits-new url', page.url());

  const allControls = await page.$$eval('input,select', (nodes) => nodes.map((n) => ({
    tag: n.tagName,
    id: n.id,
    name: n.name,
    type: n.type,
    role: n.getAttribute('role'),
    placeholder: n.getAttribute('placeholder'),
    className: n.className,
    aria: n.getAttribute('aria-label')
  })));
  console.log('controls', JSON.stringify(allControls, null, 2));

  const labels = await page.$$eval('label', ls => ls.map(l => l.textContent?.trim()).filter(Boolean));
  console.log('labels', labels);

  const sel = await page.$$eval('select', (nodes) => nodes.map(n => ({
    id: n.id,
    name: n.name,
    options: Array.from(n.options).map(o => o.value),
  })));
  console.log('select nodes', sel);

  await page.screenshot({ path: 'scripts/credits-new-before.png' });

  await browser.close();
})();
