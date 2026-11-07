// SNS用サムネ og.png（1200x630）。node og.mjs（音は出さない）
// ボス面で遊んでいる最中におかんがドアから覗く瞬間を縦画面で撮り、右にタイトルと一言を重ねる
import './mute-auto.mjs'  // テスト中は絶対に音を出さない（playwright を無音に差し替え）
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
const ROOT = import.meta.dirname
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: '5917' } })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch(MUTE_LAUNCH)
const ctx = await b.newContext({ viewport: { width: 420, height: 780 }, deviceScaleFactor: 2, locale: 'ja-JP' }); await muteContext(ctx)
const p = await ctx.newPage()
await p.goto('http://localhost:5917/'); await p.waitForFunction(() => window.__mgReady, null, { timeout: 20000 })
await p.evaluate(() => document.fonts.ready)
await p.addScriptTag({ path: ROOT + '/bot.js' })
await p.evaluate(() => {
  MG.dbg.pause(true)
  for (let s = 1; s < 200; s++) { MG.dbg.start(s, { noTut: true }); const e = MG.S.events.find(e => e.kind === 'mom' && e.sub === 'peek' && e.t0 > 20); if (e) { window.__e = e; break } }
  const S = MG.S, e = window.__e
  let n = 0
  while (S.mode === 'play' && S.t < e.open - 0.3 && n++ < 60 * 200) { MGBot.step(MG, 'read'); MG.dbg.tick(1) }
  S.stage = 7; S.hp = 61
  // 見つかる直前: 画面を出して遊んでいる
  if (S.sleep) MG.act('sleep')
  S.cons = 'up'; S.moveTo = null; MG.act('vol'); MG.act('vol'); MG.pressA(true)
  n = 0
  while (S.mode === 'play' && S.t < e.open + 0.42 && n++ < 600) MG.dbg.tick(1)
  MG.dbg.frames(50)
  S.dbgPause = true
  document.querySelectorAll('#fx > *').forEach(x => x.remove())
})
await p.addStyleTag({ content: '#corner,#acts,#hint,#finger,#bigMsg,#boot{display:none!important}' })
await p.evaluate(() => {
  // 吹き出しは手で置く（同時に2つまで）
  const v = MG.camera, w = new (MG.camera.position.constructor)(0.33, 1.72, -2.6).project(v)
  const x = (w.x * 0.5 + 0.5) * innerWidth, y = (-w.y * 0.5 + 0.5) * innerHeight
  const d = document.createElement('div'); d.className = 'sb'; d.textContent = '…まだ起きてる？'; d.style.cssText = `position:fixed;left:${x - 120}px;top:${y - 70}px;transform:none;font-size:17px`; document.body.appendChild(d)
  MG.dbg.boss('早く寝なさい勇者よ'); MG.dbg.render()
})
await p.waitForTimeout(200)
const shot = await p.screenshot({ clip: { x: 0, y: 0, width: 420, height: 640 } })
await ctx.close()
// 1200x630 に組む
const c2 = await b.newContext({ viewport: { width: 1200, height: 630 } }); await muteContext(c2)
const q = await c2.newPage()
const src = 'data:image/png;base64,' + shot.toString('base64')
await q.setContent(`<html><head><link href="https://fonts.googleapis.com/css2?family=DotGothic16&family=Klee+One:wght@600&display=swap" rel="stylesheet"></head>
<body style="margin:0;width:1200px;height:630px;background:#0b1430;overflow:hidden;position:relative">
<img src="${src}" style="position:absolute;left:40px;top:-20px;width:420px;height:640px;object-fit:cover;border-radius:0;box-shadow:0 0 0 6px #1b1a22,0 20px 50px rgba(0,0,0,.6);transform:rotate(-2deg)">
<div style="position:absolute;left:520px;right:40px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;gap:22px;color:#fff3c4;font-family:'DotGothic16'">
  <div style="font-size:24px;letter-spacing:.3em;color:#9fb2d8">AM 2:00 / MIDNIGHT GAMER</div>
  <div style="font-size:84px;line-height:1.08;text-shadow:0 0 18px rgba(255,220,120,.5)">深夜ゲーム、<br><span style="color:#ff9d8f">バレたら没収</span></div>
  <div style="font-family:'Klee One';font-weight:600;font-size:30px;line-height:1.55;color:#f7eedc">足音を読んで、画面をふとんへ。<br>ドアノブが回ったら寝たふり。</div>
</div></body></html>`)
await q.evaluate(() => document.fonts.ready); await q.waitForTimeout(400)
await q.screenshot({ path: ROOT + '/og.png' })
await b.close(); server.kill()
console.log('ok')
