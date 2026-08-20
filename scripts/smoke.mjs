// Visual smoke test: home -> tazo collection -> flip -> card collection.
// Screenshots into .tmp/, fails on console errors or a blank canvas.
// Usage: node scripts/smoke.mjs [url]   (default http://localhost:5199)
import { chromium } from 'playwright'
import { mkdir, stat } from 'fs/promises'

const url = process.argv[2] ?? 'http://localhost:5199'
await mkdir('.tmp', { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text())
})
page.on('pageerror', (err) => errors.push(String(err)))

console.log(`Loading ${url} ...`)
await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForSelector('.collection-card', { timeout: 15000 })
await page.screenshot({ path: '.tmp/smoke-home.png' })

// Tazo collection
await page.click('.collection-card:has-text("Looney")')
await page.waitForSelector('canvas', { timeout: 15000 })
await page.waitForTimeout(3000)
await page.screenshot({ path: '.tmp/smoke-tazo.png' })
await page.click('text=Virar')
await page.waitForTimeout(1600)
await page.screenshot({ path: '.tmp/smoke-tazo-back.png' })

// Card collection (shared back)
await page.click('text=← Coleções')
await page.waitForSelector('.collection-card', { timeout: 15000 })
await page.click('.collection-card:has-text("Star Wars")')
await page.waitForSelector('canvas', { timeout: 15000 })
await page.waitForTimeout(3000)
await page.screenshot({ path: '.tmp/smoke-card.png' })

await browser.close()

let failed = false
for (const f of [
  '.tmp/smoke-home.png',
  '.tmp/smoke-tazo.png',
  '.tmp/smoke-tazo-back.png',
  '.tmp/smoke-card.png',
]) {
  const s = await stat(f)
  // A blank/failed canvas compresses to a few KB; a rendered scene is much larger.
  const ok = s.size > 50_000
  console.log(`${f}: ${(s.size / 1024).toFixed(0)}KB ${ok ? 'OK' : 'TOO SMALL — likely blank'}`)
  if (!ok) failed = true
}
const realErrors = errors.filter((e) => !e.includes('favicon'))
if (realErrors.length) {
  console.log('\nConsole errors:')
  for (const e of realErrors) console.log('  ' + e)
  failed = true
}
console.log(failed ? '\nSMOKE FAIL' : '\nSMOKE PASS')
process.exit(failed ? 1 : 0)
