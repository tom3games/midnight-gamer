import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// 深夜ゲーム、バレたら没収 の検証。node verify.mjs（音は出さない）
import { chromium, webkit } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
const ROOT = import.meta.dirname
mkdirSync(ROOT + '/shots', { recursive: true })
const PORT = 5911
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const URL0 = `http://localhost:${PORT}/`
let pass = 0, fail = 0
const results = []
async function t(name, fn) {
  try { const r = await fn(); if (r === false) throw new Error('false'); pass++; results.push(`ok   ${name}${r && r !== true ? '  ' + JSON.stringify(r) : ''}`) }
  catch (e) { fail++; results.push(`FAIL ${name}  ${e.message.split('\n')[0]}`) }
}
const expect = (c, msg) => { if (!c) throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)) }
async function open(browser, opts = {}, keepLS = false) {
  const ctx = await browser.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, ...opts })
  await muteContext(ctx)
  if (!keepLS) await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('kept')) { localStorage.clear(); sessionStorage.setItem('kept', '1') } } catch (e) {} })
  const p = await ctx.newPage(); p.errs = []
  p.on('pageerror', e => p.errs.push('pageerror ' + e.message))
  p.on('console', m => { if (m.type() === 'error') p.errs.push('console ' + m.text()) })
  p.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) p.errs.push('reqfail ' + r.url()) })
  p.on('popup', pp => pp.close().catch(() => {}))
  await p.goto(URL0); await p.waitForFunction(() => window.__mgReady, null, { timeout: 20000 })
  await p.addScriptTag({ path: ROOT + '/bot.js' })
  return p
}
const overflow = p => p.evaluate(() => {
  const W = document.documentElement.clientWidth, bad = []
  for (const el of document.querySelectorAll('main:not([hidden]) *')) {
    if (el.closest('[hidden]') || (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true }))) continue
    const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1)) bad.push((el.id || el.className || el.tagName) + ':' + Math.round(r.left) + '-' + Math.round(r.right))
  }
  return { sw: document.documentElement.scrollWidth, W, bad: bad.slice(0, 5) }
})
const fit = q => q.evaluate(() => {
  const H = innerHeight, de = document.documentElement, over = []
  if (de.scrollHeight > H + 1) over.push('page:' + de.scrollHeight)
  for (const el of document.querySelectorAll('main:not([hidden]) button,main:not([hidden]) a,#con:not([hidden]) button')) { if (!el.offsetParent || (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true })) || document.body.classList.contains('mode-result') && el.closest('#con')) continue; const r = el.getBoundingClientRect(); if (r.bottom > H + 1 || r.top < -1 || r.left < -1 || r.right > innerWidth + 1) over.push((el.id || el.className) + ':' + Math.round(r.top) + '-' + Math.round(r.bottom)) }
  for (const v of document.querySelectorAll('main:not([hidden])')) if (v.scrollHeight > v.clientHeight + 1) over.push('view:' + v.id + ':' + v.scrollHeight)
  return { H, over: over.slice(0, 6) }
})
// WebGL の絵の散らばり（ほぼ単色＝描けていない）
const glVar = p => p.evaluate(() => new Promise(res => { const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = 120; c.height = 240; const x = c.getContext('2d'); x.drawImage(img, 0, 0, 120, 240); const d = x.getImageData(0, 0, 120, 100).data; let s = 0, s2 = 0, n = 0; for (let i = 0; i < d.length; i += 4) { const v = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; s += v; s2 += v * v; n++ } res(Math.round(s2 / n - (s / n) ** 2)) }; img.src = document.getElementById('gl').toDataURL() }))
const SIZES = [[360, 640, 'small'], [390, 844, 'phone'], [430, 932, 'large']]

const browser = await chromium.launch(MUTE_LAUNCH)
const p = await open(browser)
await t('起動時にエラーが出ない', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await t('ロード画面が消えている（読み込みが終わってから）', async () => { const r = await p.evaluate(() => ({ hidden: document.getElementById('boot').hidden, lit: [...document.querySelectorAll('#cells i')].filter(i => i.style.opacity === '1').length })); expect(r.hidden && r.lit === 12, r); return r })
await t('ブラウザの拡大が起きない（viewport・ピンチ・Ctrl+ホイール・Ctrl+プラス）', async () => {
  const r = await p.evaluate(() => {
    const vp = document.querySelector('meta[name=viewport]').content
    const g = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(g)
    const w = new WheelEvent('wheel', { ctrlKey: true, deltaY: -10, bubbles: true, cancelable: true }); window.dispatchEvent(w)
    const k = new KeyboardEvent('keydown', { key: '+', ctrlKey: true, bubbles: true, cancelable: true }); window.dispatchEvent(k)
    return { vp, gesture: g.defaultPrevented, wheel: w.defaultPrevented, key: k.defaultPrevented, ta: getComputedStyle(document.documentElement).touchAction, us: getComputedStyle(document.body).userSelect }
  })
  expect(/user-scalable=no/.test(r.vp) && r.gesture && r.wheel && r.key && r.ta === 'manipulation' && r.us === 'none', r); return r
})
await t('OGP 一式がある（画像は絶対URL）', async () => {
  const r = await p.evaluate(() => ({ list: ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'].map(k => !!document.querySelector(`meta[property="${k}"]`)).concat(!!document.querySelector('meta[name="twitter:card"]')), img: document.querySelector('meta[property="og:image"]').content }))
  expect(r.list.every(Boolean) && /^https:\/\/tom3games\.github\.io\/midnight-gamer\/og\.png/.test(r.img), r)
})
await t('og.png が 1200x630', async () => { const r = await p.evaluate(() => new Promise(res => { const i = new Image(); i.onload = () => res([i.width, i.height]); i.onerror = () => res(null); i.src = 'og.png' })); expect(r && r[0] === 1200 && r[1] === 630, r) })
await t('日本語の端末では日本語で始まる', async () => { const r = await p.evaluate(() => ({ lang: document.documentElement.lang, start: document.getElementById('bStart').textContent })); expect(r.lang === 'ja' && r.start === 'はじめる', r) })
await t('タイトルの3Dが描けている（部屋の上側の明るさが散らばっている）', async () => { const v = await glVar(p); expect(v > 150, v); return v })
await t('遊び方の画面の下にプライバシーのリンク（押せる高さ38px以上）とクレジット', async () => {
  await p.click('#bHow')
  const r = await p.evaluate(() => { const a = document.querySelector('#vHow a[href="privacy.html"]'); return { h: a && a.getBoundingClientRect().height, credits: !!document.querySelector('#vHow a[href="CREDITS.md"]') } })
  await p.click('#bHowBack'); expect(r.h >= 38 && r.credits, r); return r
})

// ---- 一晩の時刻表
await t('同じ種なら同じ夜（時刻表が同じ）', async () => {
  const a = await p.evaluate(() => { MG.dbg.pause(true); MG.dbg.start(77, { noTut: true }); return JSON.stringify(MG.S.events.map(e => [e.kind, e.sub, e.approach, e.awake, e.gamer, e.t0.toFixed(3)])) })
  const b = await p.evaluate(() => { MG.dbg.start(77, { noTut: true }); return JSON.stringify(MG.S.events.map(e => [e.kind, e.sub, e.approach, e.awake, e.gamer, e.t0.toFixed(3)])) })
  expect(a === b, 'differs'); return { events: JSON.parse(a).length }
})
await t('時刻表: 毎晩くじで並びが変わる・おかん（のぞく/聞く）・おとん・猫・寝言（平気/来る）が入る・重ならない・朝までに終わる', async () => {
  const r = await p.evaluate(() => { const o = [], orders = new Set(); for (let s = 1; s <= 24; s++) { MG.dbg.start(s, { noTut: true }); const E = MG.S.events; orders.add(E.map(e => e.kind[0]).join('')); let overlap = false; for (let i = 1; i < E.length; i++) if (E[i].t0 < E[i - 1].end - 1e-6) overlap = true; o.push({ n: E.length, peek: E.some(e => e.kind === 'mom' && e.sub === 'peek'), listen: E.some(e => e.kind === 'mom' && e.sub === 'listen'), dad: E.filter(e => e.kind === 'dad').length, cat: E.filter(e => e.kind === 'cat').length, talkS: E.some(e => e.kind === 'talk' && !e.awake), talkA: E.some(e => e.kind === 'talk' && e.awake), overlap, last: E[E.length - 1].end }) } return { o, orders: orders.size } })
  const bad = r.o.filter(x => !(x.n >= 8 && x.peek && x.listen && x.dad >= 1 && x.cat >= 1 && !x.overlap && x.last <= 150))
  expect(!bad.length && r.orders >= 15, { bad: bad.slice(0, 2), orders: r.orders }); return { first: r.o[0], orders: r.orders }
})
await t('合図から見られるまで十分な時間がある（足音→止まる1.5秒以上・ノブ→のぞく1.0秒以上・おとんの足音→通る2.0秒以上・猫のカリカリ→見る3.0秒以上）', async () => {
  const r = await p.evaluate(() => { const o = { step: 99, knob: 99, dad: 99, cat: 99 }; for (let s = 1; s <= 24; s++) { MG.dbg.start(s, { noTut: true }); for (const e of MG.S.events) { if (e.kind === 'mom') { o.step = Math.min(o.step, e.stop - (e.walkA + 0.2)); if (e.knob != null) o.knob = Math.min(o.knob, e.checks[0].a - e.knob) } if (e.kind === 'dad') o.dad = Math.min(o.dad, e.checks[0].a - (e.t0 + 0.3)); if (e.kind === 'cat') o.cat = Math.min(o.cat, e.checks[0].a - e.t0) } } return o })
  expect(r.step >= 1.45 && r.knob >= 1.0 && r.dad >= 2.0 && r.cat >= 3.0, r); return r
})

// ---- 判定（乱数なし。状態だけで決まる）
// 指定の出来事の見られる時間の少し前まで進めて、決めた形にして、その出来事の結果を見る
const tryEv = (p, pick, how) => p.evaluate(([pick, how]) => {
  for (let s = 1; s < 200; s++) {
    MG.dbg.pause(true); MG.dbg.start(s, { noTut: true })
    const S = MG.S, i = S.events.findIndex(e => e.kind === pick.kind && (pick.sub == null || e.sub === pick.sub) && (pick.gamer == null || !!e.gamer === pick.gamer) && (pick.awake == null || e.awake === pick.awake))
    if (i < 0) continue
    const e = S.events[i], before = S.events.slice(0, i)
    // 前の出来事は読む bot でやり過ごす
    let n = 0
    while (S.mode === 'play' && S.t < e.t0 - 0.2 && n++ < 60 * 200) { MGBot.step(MG, 'read'); MG.dbg.tick(1) }
    if (S.strikes || S.mode !== 'play') continue
    if (S.sleep) MG.act('sleep')
    if (S.cons === 'moving') { S.cons = S.moveTo; S.moveTo = null }
    if (S.cons === 'futon') MG.act('futon')
    if (S.cons === 'pillow') { S.cons = 'up' }
    MG.pressA(false)
    if (how.cons === 'futon') MG.act('futon')
    if (how.cons === 'pillow') { MG.act('pillow'); MG.dbg.tick(40) }
    if (how.vol === false && S.vol) MG.act('vol')
    if (how.vol !== false && !S.vol) MG.act('vol')
    const a = e.checks.length ? e.checks[0].a : e.t0
    while (S.mode === 'play' && S.t < a - 0.5) MG.dbg.tick(1)
    if (how.sleep) MG.act('sleep')
    if (how.play) MG.pressA(true)
    while (S.mode === 'play' && S.t < e.end + 0.1 && !e.done) MG.dbg.tick(1)
    return { seed: s, res: e.res, strikes: S.strikes, cons: S.cons, mode: S.mode, need: e.checks.map(c => c.need.join('')) }
  }
  return { none: true }
}, [pick, how])
await t('おかん・のぞく: まくらの下＋寝たふり → 平気', async () => { const r = await tryEv(p, { kind: 'mom', sub: 'peek' }, { cons: 'pillow', sleep: true }); expect(r.res === 'safe' && r.strikes === 0, r); return r })
await t('おかん・のぞく: ふとんに伏せる＋音を消す＋寝たふり → 平気', async () => { const r = await tryEv(p, { kind: 'mom', sub: 'peek' }, { cons: 'futon', vol: false, sleep: true }); expect(r.res === 'safe', r); return r })
await t('おかん・のぞく: ふとんに伏せて寝たふり（音はついたまま）→ ばれかけ1', async () => { const r = await tryEv(p, { kind: 'mom', sub: 'peek' }, { cons: 'futon', sleep: true }); expect(r.res === 'caught' && r.strikes === 1, r); return r })
await t('おかん・のぞく: まくらの下でも目を開けていたら → ばれかけ1', async () => { const r = await tryEv(p, { kind: 'mom', sub: 'peek' }, { cons: 'pillow' }); expect(r.res === 'caught' && r.strikes === 1, r); return r })
await t('おかん・のぞく: 何も隠さず遊んでいる → ばれかけ2（光・音・寝顔の全部）', async () => { const r = await tryEv(p, { kind: 'mom', sub: 'peek' }, { play: true }); expect(r.res === 'caught' && r.strikes === 2, r); return r })
await t('おかん・聞く: ふとん＋音を消す → 平気（寝たふりはいらない）', async () => { const r = await tryEv(p, { kind: 'mom', sub: 'listen' }, { cons: 'futon', vol: false }); expect(r.res === 'safe', r); return r })
await t('おかん・聞く: ふとんだけ（音はついたまま）→ ばれる', async () => { const r = await tryEv(p, { kind: 'mom', sub: 'listen' }, { cons: 'futon' }); expect(r.res === 'caught' && r.strikes === 1, r); return r })
await t('おかん・聞く: 寝たふりだけ（画面は光ったまま）→ ばれる', async () => { const r = await tryEv(p, { kind: 'mom', sub: 'listen' }, { sleep: true }); expect(r.res === 'caught', r); return r })
await t('おとん: ふとんに伏せる（音はついたまま）→ 平気（おとんは光しか見ない）', async () => { const r = await tryEv(p, { kind: 'dad', gamer: false }, { cons: 'futon' }); expect(r.res === 'safe' && r.strikes === 0, r); return r })
await t('おとん: 光ったまま → ばれかけ1（1回目で見つかり、2回目は数えない）', async () => { const r = await tryEv(p, { kind: 'dad', gamer: false }, { play: true }); expect(r.res === 'caught' && r.strikes === 1, r); return r })
await t('猫: ふとんに伏せても通知ランプに飛びつく → ばれかけ1・画面が伏せられる', async () => { const r = await tryEv(p, { kind: 'cat' }, { cons: 'futon' }); expect(r.res === 'caught' && r.strikes === 1 && r.cons === 'futon', r); return r })
await t('猫: まくらの下 → 平気', async () => { const r = await tryEv(p, { kind: 'cat' }, { cons: 'pillow' }); expect(r.res === 'safe', r); return r })
await t('寝言（グゥ）と車は見られない（遊び続けてよい）', async () => {
  const a = await tryEv(p, { kind: 'talk', awake: false }, { play: true }), b = await tryEv(p, { kind: 'car' }, { play: true })
  expect(a.res === 'none' && a.strikes === 0 && b.res === 'none' && b.strikes === 0, { a, b }); return { a: a.res, b: b.res }
})
await t('寝言（ガサッ）のあとは、すぐおかんが来る', async () => {
  const r = await p.evaluate(() => { for (let s = 1; s < 100; s++) { MG.dbg.start(s, { noTut: true }); const E = MG.S.events, i = E.findIndex(e => e.kind === 'talk' && e.awake); if (i < 0 || !E[i + 1]) continue; return { next: E[i + 1].kind, fast: E[i + 1].fast, gap: +(E[i + 1].t0 - E[i].end).toFixed(2) } } })
  expect(r.next === 'mom' && r.fast && r.gap === 0, r); return r
})
await t('寝たふりが7秒続くと本当に寝る（夜が16秒進む・その間は操作できない）', async () => {
  const r = await p.evaluate(() => { MG.dbg.start(9, { noTut: true }); const S = MG.S; MG.act('pillow'); MG.dbg.tick(40); MG.act('sleep'); const t0 = S.t; while (!S.asleep && S.t < t0 + 10) MG.dbg.tick(1); const at = S.t - t0; const blocked = !MG.act('futon'); while (S.asleep) MG.dbg.tick(1); return { at: +at.toFixed(2), dozes: S.dozes, blocked, awake: !S.sleep, skipped: +(S.t - t0 - at).toFixed(1) } })
  expect(r.at >= 6.9 && r.at <= 7.2 && r.dozes === 1 && r.blocked && r.awake && r.skipped >= 15.9, r); return r
})
await t('音を消すと勇者が弱い（1回の攻撃が 0.7）', async () => {
  const r = await p.evaluate(() => { MG.dbg.start(9, { noTut: true }); const S = MG.S; MG.pressA(true); MG.dbg.tick(60); const on = S.dmg / S.hits; MG.pressA(false); MG.act('vol'); const d0 = S.dmg, h0 = S.hits; MG.pressA(true); MG.dbg.tick(60); MG.pressA(false); return { on: +on.toFixed(2), off: +((S.dmg - d0) / (S.hits - h0)).toFixed(2), perSec: h0 } })
  expect(r.on === 1 && r.off === 0.7 && r.perSec >= 5 && r.perSec <= 6, r); return r
})
await t('まくらから出すのに0.9秒（その間は攻撃できない）・ふとんはすぐ戻る', async () => {
  const r = await p.evaluate(() => { MG.dbg.start(9, { noTut: true }); const S = MG.S; MG.act('pillow'); MG.dbg.tick(40); MG.act('pillow'); MG.pressA(true); const h = S.hits; MG.dbg.tick(50); const during = S.hits - h, mid = S.cons; MG.dbg.tick(10); const out = S.cons; MG.pressA(false); MG.act('futon'); const f1 = S.cons; MG.act('futon'); return { during, mid, out, f1, f2: S.cons } })
  expect(r.during === 0 && r.mid === 'moving' && r.out === 'up' && r.f1 === 'futon' && r.f2 === 'up', r); return r
})
await t('ばれかけ3回で没収 → 判定 E・朝まで隠し通せていない', async () => {
  const r = await p.evaluate(() => { MG.dbg.start(5, { noTut: true }); const S = MG.S; MG.pressA(true); let n = 0; while (S.mode === 'play' && n++ < 60 * 200) MG.dbg.tick(1); MG.dbg.finish(); return { conf: S.conf, reason: S.endReason, mode: S.mode, rank: MG.judge().rank, strikes: S.strikes } })
  expect(r.conf && r.reason === 'conf' && r.rank === 'E' && r.strikes === 3, r); return r
})
await t('何もしないで1回終える → 最低の判定（E・没収）', async () => {
  const r = await p.evaluate(() => { const o = []; for (let s = 1; s <= 8; s++) { MG.dbg.start(s * 13, { noTut: true }); MG.dbg.finish(); const j = MG.judge(); o.push(j.rank + (j.conf ? '没' : '') + j.val) } return o })
  expect(r.every(x => x.startsWith('E没')), r); return r
})
await t('読む bot は朝までにボスに届く（12夜の半分以上）・何もしない bot より必ず上', async () => {
  const r = await p.evaluate(() => { let clr = 0, worse = 0; for (let s = 1; s <= 12; s++) { const a = MGBot.run(MG, 'read', s * 101 + 7); MG.dbg.start(s * 101 + 7, { noTut: true }); MG.dbg.finish(); const b = MG.judge(); if (a.cleared) clr++; if (a.val <= b.val) worse++ } return { clr, worse } })
  expect(r.clr >= 6 && r.worse === 0, r); return r
})
await t('同じ操作なら同じ結果（乱数で当たり外れを決めない）', async () => {
  const r = await p.evaluate(() => [JSON.stringify(MGBot.run(MG, 'read', 31)), JSON.stringify(MGBot.run(MG, 'read', 31)), JSON.stringify(MGBot.run(MG, 'random', 31)), JSON.stringify(MGBot.run(MG, 'random', 31))])
  expect(r[0] === r[1] && r[2] === r[3], r); return JSON.parse(r[0])
})
await t('ボスを倒すと朝が来て終わる（朝まで隠し通した）', async () => {
  const r = await p.evaluate(() => { MG.dbg.start(9, { noTut: true }); const S = MG.S; S.stage = 7; S.hp = 2; MG.pressA(true); MG.dbg.tick(30); return { mode: S.mode, reason: S.endReason, cleared: S.cleared, rank: (MG.dbg.finish(), MG.judge().rank) } })
  expect(r.mode === 'end' && r.reason === 'boss' && r.cleared && r.rank === 'S', r); return r
})
await t('ボスの面でおかんをやり過ごすと、ボスがおかんと同じことを言う', async () => {
  const r = await p.evaluate(() => { for (let s = 1; s < 100; s++) { MG.dbg.start(s, { noTut: true }); const S = MG.S, e = S.events.find(e => e.kind === 'mom' && e.sub === 'peek'); if (!e) continue; let n = 0; while (S.mode === 'play' && S.t < e.t0 - 0.2 && n++ < 60 * 200) { MGBot.step(MG, 'read'); MG.dbg.tick(1) } S.stage = 7; S.hp = 500; while (S.mode === 'play' && S.t < e.end) { MGBot.step(MG, 'read'); MG.dbg.tick(1) } return { line: S.bossLine, res: e.res } } })
  expect(r.res === 'safe' && /寝|1時間|起き/.test(r.line), r); return r
})
await t('HUD にバー・メーターが無い（時計・空・ゲーム機で見せる）', async () => {
  const r = await p.evaluate(() => [...document.querySelectorAll('#vPlay progress,#vPlay meter,#vPlay [class*=bar],#vPlay [class*=gauge],#vPlay [class*=meter],#fg [class*=bar],#fg [class*=gauge]')].length)
  expect(r === 0, r)
})

// ---- チュートリアル（最初の1回だけ）
await t('チュートリアル: A→足音でまくら→ノブで寝たふり→起きて出す→おとんでふとん。2回目からは出ない', async () => {
  const q = await open(browser)
  await q.evaluate(() => { MG.dbg.pause(true) })
  await q.click('#bStart')
  const r = await q.evaluate(() => {
    const S = MG.S, steps = []; S.introT = 99; MG.dbg.tick(2)
    const hint = () => document.getElementById('hint').hidden ? '' : document.getElementById('hint').textContent
    const fin = () => !document.getElementById('finger').hidden
    const until = (f, max = 60 * 60) => { for (let i = 0; i < max && !f(); i++) MG.dbg.tick(1) }
    steps.push(['A', hint(), fin(), S.speed]); for (let i = 0; i < 4; i++) { MG.pressA(true); MG.pressA(false); S.realT += 0.2 } MG.dbg.tick(2)
    until(() => S.speed === 0); steps.push(['pillow', hint(), fin(), +S.t.toFixed(1)]); MG.act('pillow')
    MG.dbg.tick(2); until(() => S.speed === 0); steps.push(['sleep', hint(), fin(), +S.t.toFixed(1)]); MG.act('sleep')
    until(() => /目を開け|開け/.test(hint())); steps.push(['wake', hint(), fin()]); MG.act('sleep'); MG.dbg.tick(2)
    steps.push(['out', hint(), fin()]); MG.act('pillow'); until(() => S.cons === 'up'); MG.dbg.tick(2)
    until(() => S.speed === 0); steps.push(['dad', hint(), fin(), S.events[1].kind]); MG.act('futon')
    until(() => S.tut === 2)
    return { steps, res0: S.events[0].res, strikes: S.strikes, tut: S.tut }
  })
  await q.evaluate(() => { MG.dbg.finish(); MG.dbg.result() })
  const again = await q.evaluate(() => { MG.dbg.start(9); return MG.S.tut })
  await q.context().close()
  const s = r.steps
  expect(s[0][1] === 'Aを押して戦う' && s[0][2] && s[1][1] === 'まくらの下へ' && s[1][2] && s[2][1] === '寝たふり！' && s[3][1] === '目を開ける' && s[4][1] === 'ゲーム機を出す' && s[5][1] === 'ふとんに伏せる' && s[5][3] === 'dad' && r.res0 === 'safe' && r.strikes === 0 && again === 2, { ...r, again }); return s.map(x => x[1])
})

// ---- 文字の量（実時間で40秒、読む bot で遊んで、同時に出ている文字を数える）
await t('文字は同時に2つまで・1つは13字以内（実時間で見る）', async () => {
  const q = await open(browser)
  await q.evaluate(() => { MG.dbg.start(21, { noTut: true }); MG.dbg.pause(false) })
  const r = await q.evaluate(() => new Promise(res => {
    let max = 0; const long = new Set(), seen = new Set()
    const iv = setInterval(() => {
      MGBot.step(MG, 'read')
      max = Math.max(max, MG.texts())
      for (const el of document.querySelectorAll('#fx > *, #hint:not([hidden]), #bigMsg:not([hidden])')) { const s = el.textContent; seen.add(s); if ([...s].length > 13) long.add(s) }
      if (MG.S.bossLine && [...MG.S.bossLine].length > 13) long.add(MG.S.bossLine)
    }, 30)
    setTimeout(() => { clearInterval(iv); res({ max, long: [...long], seen: seen.size, t: +MG.S.t.toFixed(1) }) }, 40000)
  }))
  await q.context().close()
  expect(r.max <= 2 && r.long.length === 0 && r.seen >= 4, r); return r
})
await t('台詞と擬音はすべて13字以内（日本語）', async () => {
  const r = await p.evaluate(() => { const T = MG.D.T.ja, out = []; for (const [k, v] of Object.entries(T)) { if (/^(o|s)[A-Z]/.test(k) && typeof v === 'string' && [...v].length > 13) out.push(k) } for (const v of T.boss) if ([...v].length > 13) out.push(v); for (const v of Object.values(T.memo)) if ([...v].length > 13) out.push(v); return out })
  expect(!r.length, r)
})

// ---- 結果
await t('結果: 判定は発表まで見せない → 記録 → メモ → 判定', async () => {
  const r = await p.evaluate(async () => {
    MGBot.run(MG, 'read', 21, { noFinish: true }); MG.dbg.pause(false)
    while (MG.S.mode !== 'result') await new Promise(r => setTimeout(r, 50))
    await new Promise(r => setTimeout(r, 300))
    const early = { rank: document.getElementById('rRank').classList.contains('on'), mode: MG.S.mode, memo: document.getElementById('memo').classList.contains('on') }
    await new Promise(r => setTimeout(r, 3500))
    const late = { rank: document.getElementById('rRank').classList.contains('on'), rows: [...document.querySelectorAll('.lcd .r.on')].length, memo: document.getElementById('mText').textContent, name: document.getElementById('rName').textContent }
    return { early, late }
  })
  expect(r.early.mode === 'result' && !r.early.rank && !r.early.memo && r.late.rank && r.late.rows === 3 && r.late.memo && r.late.name, r); return r
})
await t('結果: 支援リンク（もう一回のそば・あったかい牛乳）・もう一回は bAgain', async () => {
  const r = await p.evaluate(() => { const a = document.getElementById('tmSupport'); return { a: !!a, text: a && a.textContent, again: !!document.getElementById('bAgain') } })
  expect(r.a && /あったかい牛乳/.test(r.text) && r.again, r); return r
})
await t('Xでポスト: x.com/intent/post・本文にURLを入れず url パラメータ', async () => {
  const r = await p.evaluate(() => { const u = new URL(MG.xUrl()); return { host: u.host + u.pathname, text: u.searchParams.get('text'), url: u.searchParams.get('url') } })
  expect(r.host === 'x.com/intent/post' && r.url === 'https://tom3games.github.io/midnight-gamer/' && !/https?:/.test(r.text) && /#深夜ゲームバレたら没収/.test(r.text), r); return r
})
await t('結果画像が描ける（1080x1350・LCD の色と部屋の絵がある）', async () => {
  const r = await p.evaluate(() => { const c = MG.resultCanvas(), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let lcd = 0, top = 0; for (let i = 0; i < d.length; i += 40) { if (Math.abs(d[i] - 169) < 6 && Math.abs(d[i + 1] - 199) < 6 && Math.abs(d[i + 2] - 154) < 6) lcd++ } const t = c.getContext('2d').getImageData(0, 0, 1080, 500).data; let s = 0, s2 = 0, n = 0; for (let i = 0; i < t.length; i += 40) { const v = t[i] * .3 + t[i + 1] * .59 + t[i + 2] * .11; s += v; s2 += v * v; n++ } return { w: c.width, h: c.height, lcd, varTop: Math.round(s2 / n - (s / n) ** 2) } })
  expect(r.w === 1080 && r.h === 1350 && r.lcd > 3000 && r.varTop > 100, r); return r
})
await t('画像を保存を押すとダウンロード（またはシェア）', async () => {
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }).catch(() => null), p.click('#bSave')])
  expect(dl && /midnight-gamer\.png/.test(dl.suggestedFilename()), dl && dl.suggestedFilename())
})
await t('計測: 開始で TM.start、結果で TM.end（朝まで隠し通したか）、シェアで TM.share', async () => {
  await p.click('#bX')
  const r = await p.evaluate(() => window.__tmLog.map(x => x.name + (x.name === 'game_end' ? ':' + x.params.cleared : '')))
  expect(r.includes('game_start') && r.some(x => x.startsWith('game_end')) && r.filter(x => x === 'share').length >= 2, r); return r.slice(-4)
})
await t('没収の結果: 台所の棚の絵・TM.end は cleared=0', async () => {
  const r = await p.evaluate(async () => { MG.dbg.pause(true); MG.dbg.start(5, { noTut: true }); MG.pressA(true); MG.dbg.finish(); MG.dbg.result(); MG.dbg.render(); const last = window.__tmLog.filter(x => x.name === 'game_end').pop(); return { kitchen: MG.scene.children.some(c => c.visible && c.position.x > 20), cleared: last.params.cleared, name: document.getElementById('rName').textContent, memo: document.getElementById('mText').textContent } })
  expect(r.kitchen && r.cleared === 0 && r.name === '台所の棚送り' && r.memo === 'しばらく預かります', r); return r
})
await t('もう一回で夜が始まり直す', async () => {
  await p.click('#bAgain')
  const r = await p.evaluate(() => ({ mode: MG.S.mode, t: MG.S.t, strikes: MG.S.strikes, view: !document.getElementById('vPlay').hidden, conf: MG.S.conf }))
  expect((r.mode === 'intro' || r.mode === 'play') && r.strikes === 0 && !r.conf && r.view, r); return r
})
await t('Chromium: 音を鳴らす操作のあとも実際には無音・音は呼ばれている', async () => {
  await p.evaluate(() => { MG.dbg.pause(false); MG.S.introT = 99 })
  await p.waitForTimeout(600)
  await p.evaluate(() => { MG.pressA(true); MG.act('futon'); MG.act('futon') })
  await p.waitForTimeout(400)
  const r = await p.evaluate(() => ({ ok: window.__muteOk(), calls: window.__soundCalls, played: Object.values(Snd.played).reduce((a, b) => a + b, 0) }))
  await p.evaluate(() => MG.pressA(false))
  expect(r.ok && r.calls > 0 && r.played > 0, r); return r
})
await t('英語に切り替えられる（遊び方・ボタン・結果）', async () => {
  await p.evaluate(() => { MG.dbg.pause(true) })
  await p.click('#bLang')
  const r = await p.evaluate(() => ({ lang: document.documentElement.lang, start: document.getElementById('bStart').textContent, futon: document.querySelector('#bFuton span').textContent, how: document.querySelector('[data-h=h3]').textContent }))
  await p.click('#bLang')
  expect(r.lang === 'en' && r.start === 'Start' && r.futon === 'Face down' && /Dad/.test(r.how), r); return r
})
await t('最後まで: エラーなし', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await p.close()

// ---- スマホ縦3サイズ × 全画面（タイトル・遊び方・チュートリアル・遊び中・ふとん・寝たふり・結果）、英語も
for (const [w, h, name] of SIZES) for (const loc of ['ja-JP', 'en-US']) {
  const q = await open(browser, { viewport: { width: w, height: h }, locale: loc, deviceScaleFactor: 1 })
  const views = {}
  views.title = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-${loc}-title.png` })
  await q.click('#bHow'); views.how = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-${loc}-how.png` }); await q.click('#bHowBack')
  await q.evaluate(() => MG.dbg.pause(true)); await q.click('#bStart')
  await q.evaluate(() => { const S = MG.S; S.introT = 99; MG.dbg.tick(2); MG.dbg.frames(30) })
  await q.waitForTimeout(400)
  views.tut = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-${loc}-tut.png` })
  const hintIn = await q.evaluate(() => { const h = document.getElementById('hint').getBoundingClientRect(), f = document.getElementById('finger').getBoundingClientRect(); return h.left >= 0 && h.right <= innerWidth && h.top >= 0 && !document.getElementById('hint').hidden && f.width > 0 })
  await q.evaluate(() => { const S = MG.S; for (let i = 0; i < 4; i++) { MG.pressA(true); MG.pressA(false); S.realT += 0.2 } MG.dbg.tick(2); for (let i = 0; i < 60 * 20 && S.speed !== 0; i++) MG.dbg.tick(1); MG.dbg.frames(20) })
  await q.waitForTimeout(300)
  views.tut2 = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-${loc}-tut2.png` })
  await q.evaluate(() => { MG.S.tut = 2; MG.S.speed = 1; MG.dbg.start(21, { noTut: true }); MG.pressA(true); MG.dbg.tick(60 * 3); MG.dbg.frames(30) })
  await q.waitForTimeout(300)
  views.play = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-${loc}-play.png` })
  await q.evaluate(() => { MG.pressA(false); MG.act('futon'); MG.dbg.frames(30) }); await q.waitForTimeout(400)
  views.futon = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-${loc}-futon.png` })
  await q.evaluate(() => { MG.act('futon'); MG.act('pillow'); MG.dbg.tick(40); MG.act('sleep'); MG.dbg.frames(30) }); await q.waitForTimeout(900)
  views.sleep = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-${loc}-sleep.png` })
  await q.evaluate(() => { MG.act('sleep'); MGBot.run(MG, 'read', 21); MG.dbg.result() }); await q.waitForTimeout(400)
  views.result = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-${loc}-result.png` })
  const memoIn = await q.evaluate(() => { const m = document.getElementById('memo').getBoundingClientRect(); return m.top >= 0 && m.right <= innerWidth + 1 && m.left >= 0 })
  for (const [v, r] of Object.entries(views)) await t(`一画面に収まる ${name} ${w}x${h} ${loc} ${v}`, async () => { expect(!r.over.length, r) })
  await t(`${name} ${loc}: チュートリアルの案内と指が画面内`, async () => { expect(hintIn, hintIn) })
  await t(`${name} ${loc}: 結果のメモが画面内`, async () => { expect(memoIn, memoIn) })
  await t(`${name} ${loc}: はみ出し・エラーなし`, async () => { const o = await overflow(q); expect(o.sw <= o.W && !o.bad.length && !q.errs.length, JSON.stringify(o) + q.errs.join('|')) })
  await t(`${name} ${loc}: ドアの下の隙間がゲーム機より上に見えている`, async () => {
    const r = await q.evaluate(() => { MG.dbg.start(21, { noTut: true }); MG.dbg.frames(2); const v = new (MG.camera.position.constructor)(0.45, 0.02, -2.38).project(MG.camera); const y = (-v.y * 0.5 + 0.5) * innerHeight, con = document.getElementById('con').getBoundingClientRect().top; return { gapY: Math.round(y), conTop: Math.round(con) } })
    expect(r.gapY < r.conTop - 2 && r.gapY > 60, r); return r
  })
  if (loc === 'en-US') await t(`${name}: 英語の端末では英語（タイトルと遊び方に日本語が残らない）`, async () => { await q.click('#bTitle').catch(() => q.evaluate(() => document.getElementById('bTitle').click())); const r = await q.evaluate(() => ({ lang: document.documentElement.lang, ja: /[ぁ-んァ-ヶ一-龠]/.test(document.getElementById('vTitle').innerText + document.querySelector('#vHow ol').innerText + document.getElementById('acts').innerText) })); expect(r.lang === 'en' && !r.ja, r) })
  await q.context().close()
}
await browser.close()

// ---- WebKit（iPhone 相当）でタッチの通し
const wb = await webkit.launch(), wp = await open(wb, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
await t('WebKit: 2本指の touchmove を止める', async () => {
  const r = await wp.evaluate(() => { const e = new Event('touchmove', { cancelable: true, bubbles: true }); Object.defineProperty(e, 'touches', { value: [{}, {}] }); document.body.dispatchEvent(e); return e.defaultPrevented })
  expect(r, r)
})
await t('WebKit: タップで始めて、A をタップで攻撃できる・ふとんをタップで伏せられる', async () => {
  await wp.tap('#bStart')
  await wp.evaluate(() => { MG.S.introT = 99; MG.dbg.pause(true); MG.dbg.tick(2); MG.dbg.pause(false) })
  await wp.waitForTimeout(300)
  for (let i = 0; i < 3; i++) { await wp.tap('#bA'); await wp.waitForTimeout(160) }
  const hits = await wp.evaluate(() => MG.S.hits)
  await wp.evaluate(() => { MG.S.tut = 2; MG.S.speed = 1 })
  await wp.tap('#bFuton')
  const r = await wp.evaluate(() => ({ cons: MG.S.cons }))
  expect(hits >= 3 && r.cons === 'futon', { hits, ...r }); return { hits, ...r }
})
await t('WebKit: 実際には無音（タップで音を鳴らす操作のあと）', async () => { const r = await wp.evaluate(() => ({ ok: window.__muteOk(), calls: window.__soundCalls })); expect(r.ok && r.calls > 0, r); return r })
await t('WebKit: 3Dが描けている', async () => { await wp.waitForTimeout(300); const v = await glVar(wp); expect(v > 100, v); return v })
await t('WebKit: 結果まで通る', async () => { await wp.evaluate(() => { MG.dbg.pause(true); MGBot.run(MG, 'read', 33); MG.dbg.result() }); await wp.waitForTimeout(300); await wp.screenshot({ path: `${ROOT}/shots/wk-result.png` }); const r = await fit(wp); expect(!r.over.length, r) })
await t('WebKit: エラーなし', async () => { expect(wp.errs.length === 0, wp.errs.join('|')) })
await wb.close()
server.kill()
console.log(results.join('\n'))
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
