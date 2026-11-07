// 場面を台本どおりに進めて撮る。node shot.mjs [幅x高さ] [webkit]（音は出さない）
import './mute-auto.mjs'  // テスト中は絶対に音を出さない（playwright を無音に差し替え）
import { chromium, webkit } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
const ROOT = import.meta.dirname
mkdirSync(ROOT + '/shots', { recursive: true })
const PORT = 5912
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const [W, H] = (process.argv[2] || '390x844').split('x').map(Number)
const BT = process.argv[3] === 'webkit' ? webkit : chromium
const b = await BT.launch(BT === chromium ? MUTE_LAUNCH : {}), ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, locale: process.env.LOC || 'ja-JP', hasTouch: true, isMobile: BT === webkit })
await muteContext(ctx)
const p = await ctx.newPage(); const errs = []
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__mgReady, null, { timeout: 20000 })
await p.waitForTimeout(600)
const tag = `${W}${BT === webkit ? '-wk' : ''}${process.env.LOC ? '-' + process.env.LOC : ''}`
const snap = async n => p.screenshot({ path: `${ROOT}/shots/s-${n}-${tag}.png` })
await p.addScriptTag({ path: ROOT + '/bot.js' })
// 読む bot で指定の時刻まで進めて、見た目を落ち着かせてから撮る
const goTo = async (t, bot = 'read') => { await p.evaluate(([t, bot]) => { MG.dbg.pause(true); let n = 0; while (MG.S.mode === 'play' && MG.S.t < t && n++ < 60 * 300) { MGBot.step(MG, bot); MG.dbg.tick(1) } MG.dbg.frames(40) }, [t, bot]); await p.waitForTimeout(120) }
await snap('title')
await p.click('#bHow'); await snap('how'); await p.click('#bHowBack')
const SEED = Number(process.env.SEED || 11)
await p.evaluate(s => { MG.dbg.pause(true); MG.dbg.start(s, { noTut: true }) }, SEED)
const E = await p.evaluate(() => MG.S.events.map(e => ({ k: e.kind, sub: e.sub || (e.awake ? 'awake' : ''), app: e.approach, t0: e.t0, stop: e.stop, knob: e.knob, open: e.open, close: e.close, end: e.end, gamer: e.gamer, pass1: e.pass1, walk: e.walk, jump: e.jump, sweep: e.sweep })))
console.log(E.map(e => `${e.k}${e.sub ? ':' + e.sub : ''}@${e.t0.toFixed(1)}`).join(' '))
const scenes = [[2.5, 'play']]
const mom = E.find(e => e.k === 'mom' && e.sub === 'peek')
if (mom) scenes.push([mom.stop - 0.3, 'momsteps'], [mom.open + 1.2, 'mompeek'])
const lis = E.find(e => e.k === 'mom' && e.sub === 'listen')
if (lis) scenes.push([lis.stop + 1.4, 'momlisten'])
const dad = E.find(e => e.k === 'dad')
if (dad) scenes.push([dad.pass1[0] + 0.8, 'dadpass'])
const cat = E.find(e => e.k === 'cat')
if (cat) scenes.push([cat.walk[0] + 0.7, 'catwalk'], [cat.jump[1] + 0.6, 'catshelf'])
const car = E.find(e => e.k === 'car')
if (car) scenes.push([car.t0 + 1.6, 'car'])
const talk = E.find(e => e.k === 'talk')
if (talk) scenes.push([talk.t0 + 0.8, 'talk'])
scenes.sort((a, b) => a[0] - b[0])
for (const [t, n] of scenes) { await goTo(t); await snap(n) }
// ばれる場面: 別の夜を「何も隠さない」で進めて、最初ののぞきで撮る
await p.evaluate(s => { MG.dbg.start(s, { noTut: true }) }, SEED)
if (mom) { await goTo(mom.open + 1.4, 'mash'); await snap('caught') }
await goTo(999, 'mash'); await p.evaluate(() => MG.dbg.frames(60)); await snap('conf')
await p.evaluate(() => { MG.dbg.finish() }); await p.evaluate(() => MG.dbg.pause(false)); await p.waitForTimeout(4500); await snap('result-conf')
await p.evaluate(s => { MG.dbg.pause(true); MG.dbg.start(s, { noTut: true }) }, SEED)
await goTo(999, 'read'); await p.evaluate(() => { MG.dbg.finish() }); await p.evaluate(() => MG.dbg.pause(false)); await p.waitForTimeout(4500); await snap('result')
console.log(JSON.stringify(await p.evaluate(() => MG.judge())))
console.log('errors', errs)
await b.close(); server.kill()
