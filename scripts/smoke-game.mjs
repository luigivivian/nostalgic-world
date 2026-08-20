// Visual smoke test for the island game mode: pointer lock, walk, shoot the wall.
// Screenshots into .tmp/, fails on console errors.
// Usage: node scripts/smoke-game.mjs [url]   (default http://localhost:5199)
import { chromium } from 'playwright'
import { mkdir } from 'fs/promises'

const url = process.argv[2] ?? 'http://localhost:5199'
await mkdir('.tmp', { recursive: true })

// headed: pointer lock is rejected in headless chromium (WrongDocumentError)
const browser = await chromium.launch({ headless: false })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text())
})
page.on('pageerror', (err) => errors.push(String(err)))

console.log(`Loading ${url} ...`)
await page.goto(url, { waitUntil: 'networkidle' })
await page.click('.play-btn')
await page.waitForSelector('.game-root canvas', { timeout: 20000 })
await page.waitForTimeout(4500) // island gen + rapier wasm + first frames
await page.screenshot({ path: '.tmp/game-lock-screen.png' })

// enter pointer lock (needs a focused, foreground page)
await page.bringToFront()
await page.evaluate(() => window.focus())
await page.mouse.click(720, 450)
await page.waitForTimeout(800)
// retry once — first click sometimes only acquires window focus
if (await page.evaluate(() => document.pointerLockElement === null)) {
  await page.mouse.click(720, 450)
  await page.waitForTimeout(800)
}
const locked = await page.evaluate(() => document.pointerLockElement !== null)
console.log('pointer locked:', locked)
await page.screenshot({ path: '.tmp/game-locked.png' })

// the block wall spawns straight ahead — walk a bit closer
await page.keyboard.down('KeyW')
await page.waitForTimeout(700)
await page.keyboard.up('KeyW')
await page.screenshot({ path: '.tmp/game-walk.png' })

// shoot a burst straight ahead
for (let s = 0; s < 8; s++) {
  await page.mouse.down()
  await page.mouse.up()
  await page.waitForTimeout(260)
  console.log(`shot ${s}: player at`, await page.evaluate(() => window.__pp?.map((n) => n.toFixed(1))))
}
await page.waitForTimeout(1200)
await page.screenshot({ path: '.tmp/game-shot.png' })
await page.waitForTimeout(2500)
await page.screenshot({ path: '.tmp/game-after.png' })

const fatal = errors.filter((e) => !/favicon|404/.test(e))
if (fatal.length) {
  console.error('CONSOLE ERRORS:\n' + fatal.join('\n'))
  await browser.close()
  process.exit(1)
}
console.log('game smoke OK — screenshots in .tmp/')
await browser.close()
