// Playwright screenshot del Vault conectado a backend real.
// Crea un usuario temporal con contraseña conocida, le siembra notas reales,
// las indexa vía /api/vault/reindex, hace login en la PWA y captura el Vault.
// Limpia el usuario temporal al final.
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const API = 'http://127.0.0.1:3110';
const WEB = 'http://127.0.0.1:3101';
const EMAIL = `shot-${Date.now()}@nexus.test`;
const PASSWORD = 'shot12345';

async function api(p, init) {
  const res = await fetch(API + p, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  return res;
}

async function main() {
  // 1. Registrar usuario temporal.
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, displayName: 'Demo Vault' }),
  });
  const regBody = await reg.json();
  console.log('register:', reg.status, regBody.userId);
  const cookie = reg.headers.get('set-cookie')?.split(';')[0] ?? '';

  // 2. Sembrar algunas notas reales copiadas del vault de Jerson (solo lectura).
  const src = '/root/nexus-v2/data/users/user_000001_env/vault';
  const picks = ['HOME.md', 'projects', 'decisions'];
  const userId = regBody.userId;
  // resolver su env por meta
  const usersRoot = '/root/nexus-v2/data/users';
  const dirs = await fs.readdir(usersRoot);
  let destVault = null;
  for (const d of dirs) {
    try {
      const meta = JSON.parse(await fs.readFile(path.join(usersRoot, d, '.meta.json'), 'utf8'));
      if (meta.userId === userId) destVault = path.join(usersRoot, d, 'vault');
    } catch {}
  }
  // Copiar HOME.md + 8 notas de projects + 6 de decisions.
  await fs.copyFile(path.join(src, 'HOME.md'), path.join(destVault, 'HOME.md'));
  for (const sub of ['projects', 'decisions']) {
    await fs.mkdir(path.join(destVault, sub), { recursive: true });
    const files = (await fs.readdir(path.join(src, sub))).filter((f) => f.endsWith('.md')).slice(0, 8);
    for (const f of files) await fs.copyFile(path.join(src, sub, f), path.join(destVault, sub, f));
  }
  console.log('seeded notes into', destVault);

  // 3. (Sin reindex: el árbol y la búsqueda full-text NO requieren BGE; el RAG
  //     real ya se valida por separado con el vault de Jerson.)

  // 4. Playwright: login + Vault.
  const browser = await chromium.launch({
    executablePath: '/root/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',
    args: ['--no-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: 414, height: 896 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(WEB, { waitUntil: 'networkidle' });

  await page.fill('input[type=email]', EMAIL);
  await page.fill('input[type=password]', PASSWORD);
  await page.getByRole('button', { name: /Entrar/i }).click();
  await page.waitForTimeout(1500);

  // Ir a la pestaña Vault.
  await page.getByRole('button', { name: /Vault/i }).first().click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '/tmp/vault-screen.png', fullPage: false });
  console.log('shot 1: /tmp/vault-screen.png');

  // Búsqueda full-text (no requiere BGE): escribir y capturar resultados.
  const search = page.locator('input').first();
  await search.fill('Amparo');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '/tmp/vault-search.png', fullPage: false });
  console.log('shot 2: /tmp/vault-search.png');

  await browser.close();

  // 5. Limpiar usuario temporal (DB + FS).
  const { execSync } = await import('node:child_process');
  execSync(
    `PGPASSWORD=nexus_j4_2026 psql -h 127.0.0.1 -U nexus_user -d nexus_v2 -c "DELETE FROM users WHERE id='${userId}';"`,
    { stdio: 'ignore' }
  );
  if (destVault) await fs.rm(path.dirname(destVault), { recursive: true, force: true });
  console.log('cleaned temp user', userId);
}

main().catch((e) => {
  console.error('SHOT ERROR:', e);
  process.exit(1);
});
