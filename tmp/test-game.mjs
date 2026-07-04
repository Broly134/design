import { chromium } from "playwright-core";

const OUT = "/tmp/claude-0/-home-user-design/d884e2ad-df73-5eb7-952c-2f52293faa97/scratchpad";
const URL = "file:///home/user/design/public/metro-dash/index.html";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE: " + m.text()); });

await page.goto(URL);
await page.waitForTimeout(1200); // loading -> menu
await page.screenshot({ path: `${OUT}/game-menu.png` });

// Lancer une partie
await page.click("#btn-play");
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/game-play1.png` });

// Simuler du gameplay : gauche, saut, droite, glissade
await page.keyboard.press("ArrowLeft");
await page.waitForTimeout(400);
await page.keyboard.press("Space");
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/game-jump.png` });
await page.keyboard.press("ArrowRight");
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(500);
await page.keyboard.press("ArrowDown");
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/game-slide.png` });

// Laisser tourner 12 s pour voir obstacles/pièces + mesurer les FPS
const fps = await page.evaluate(() => new Promise((res) => {
  let frames = 0;
  const t0 = performance.now();
  const tick = () => { frames++; if (performance.now() - t0 < 3000) requestAnimationFrame(tick); else res(Math.round(frames / 3)); };
  requestAnimationFrame(tick);
}));
await page.waitForTimeout(9000);
await page.screenshot({ path: `${OUT}/game-play2.png` });

// Pause
await page.keyboard.press("KeyP");
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/game-pause.png` });
await page.keyboard.press("KeyP");

// Attendre un game over (jusqu'à 60 s sans esquive)
let over = false;
for (let i = 0; i < 60; i++) {
  await page.waitForTimeout(1000);
  over = await page.evaluate(() => document.getElementById("gameover").classList.contains("active"));
  if (over) break;
}
await page.screenshot({ path: `${OUT}/game-over.png` });

const state = await page.evaluate(() => ({
  state: window.metroDash.state,
  score: Math.floor(window.metroDash.scoreMgr.score),
  coins: window.metroDash.scoreMgr.coins,
  dist: Math.floor(window.metroDash.world.dist),
  obstacles: window.metroDash.obstacles.length,
  coinsN: window.metroDash.coins.length,
}));

console.log(JSON.stringify({ fps, over, state, errors: errors.slice(0, 8) }, null, 1));

// Test mobile portrait
const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
mob.on("pageerror", (e) => errors.push("MOB: " + e.message));
await mob.goto(URL);
await mob.waitForTimeout(1100);
await mob.screenshot({ path: `${OUT}/game-mob-menu.png` });
await mob.tap("#btn-play");
await mob.waitForTimeout(2500);
await mob.screenshot({ path: `${OUT}/game-mob-play.png` });
// swipe gauche
await mob.touchscreen.tap(200, 500);
await mob.waitForTimeout(600);
await mob.screenshot({ path: `${OUT}/game-mob-play2.png` });
console.log("mobile ok, errors:", errors.length);

await browser.close();
