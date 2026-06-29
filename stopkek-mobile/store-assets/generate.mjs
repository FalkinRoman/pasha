#!/usr/bin/env node
/**
 * Генерация скриншотов App Store (iPhone 6.5" — 1284×2778 px).
 * npm install && npx playwright install chromium && npm run generate
 */
import { chromium } from 'playwright';
import { mkdir, readdir, readFile, writeFile, unlink } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.join(__dirname, '.playwright-browsers');
const SCREENS_DIR = path.join(__dirname, 'screens');
const OUT_DIR = path.join(__dirname, 'output', 'iphone-65');

// 428×926 @3x = 1284×2778 (Apple «6.5 дюйма»)
const VIEWPORT = { width: 428, height: 926 };
const DEVICE_SCALE = 3;

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const files = (await readdir(SCREENS_DIR))
    .filter((f) => f.endsWith('.html'))
    .sort();

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE,
  });

  const sprite = await readFile(path.join(__dirname, 'icons.sprite.svg'), 'utf8');

  for (const file of files) {
    const page = await context.newPage();
    const htmlPath = path.join(SCREENS_DIR, file);
    let html = await readFile(htmlPath, 'utf8');
    // Убираем локальные <svg style="display:none">…</svg> — подставляем общий спрайт
    html = html.replace(/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" style="display:none">[\s\S]*?<\/svg>\s*/g, '');
    html = html.replace('<body>', `<body>\n${sprite}\n`);
    const renderPath = path.join(SCREENS_DIR, `.render-${file}`);
    await writeFile(renderPath, html);
    await page.goto(`file://${renderPath}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    const outName = file.replace('.html', '.png');
    const outPath = path.join(OUT_DIR, outName);
    await page.screenshot({ path: outPath, type: 'png' });
    console.log(`✓ ${outName} (1284×2778)`);
    await page.close();
    await unlink(renderPath).catch(() => {});
  }

  await browser.close();
  console.log(`\nГотово: ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
