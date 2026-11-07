// 深夜ゲーム、バレたら没収（midnight-gamer）。仕様の正本は ~/Desktop/claudecode/ideas/midnight-gamer.md
// 遊びの処理（S と step）は固定60Hz。見た目は render。遊びの乱数は S.rand（種つき）、見た目の乱数は Math.random
// 見た目は「出来事の時刻表」から毎フレーム計算する（早送りしても絵と判定がずれない）
import * as THREE from 'three'
import { setupLook } from './look.js'

const D = window.MG_DATA, ART = window.MG_ART
const $ = id => document.getElementById(id)
const DT = 1 / 60
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const lerp = (a, b, k) => a + (b - a) * k
const sm = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k) }
const TOTAL = D.STAGES.reduce((a, b) => a + b, 0)

// ---------- 言語
let LANG = 'ja'
try { LANG = localStorage.getItem('mg_lang') || ((navigator.language || 'ja').toLowerCase().startsWith('ja') ? 'ja' : 'en') } catch (e) { LANG = (navigator.language || 'ja').toLowerCase().startsWith('ja') ? 'ja' : 'en' }
const T = () => D.T[LANG]
function applyLang() {
  document.documentElement.lang = LANG
  for (const el of document.querySelectorAll('[data-t]')) { const v = T()[el.dataset.t]; if (typeof v === 'string') el.textContent = v }
  for (const el of document.querySelectorAll('[data-h]')) el.innerHTML = T()[el.dataset.h]
  $('langTxt').textContent = LANG === 'ja' ? 'EN' : 'JP'
  document.title = T().title + ' | MIDNIGHT GAMER'
}

// ---------- 乱数
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }

// ---------- 状態
const S = {
  mode: 'title', t: 0, realT: 0, rand: Math.random, seed: 1, speed: 1, dbgPause: false,
  cons: 'up', moveTo: null, moveEnd: 0, sleep: false, asleep: false, asleepEnd: 0, drowsy: 0, vol: true,
  holdA: false, holdAcc: 0, lastHitReal: -9, stage: 0, hp: D.STAGES[0], dmg: 0, hits: 0, cleared: false, clearT: -9,
  strikes: 0, dozes: 0, conf: false, events: [], log: [], tut: 2, tutPhase: 0, endReason: '', endT: 0, introT: 0,
  dadGamer: false, caughtAt: [], bossLineT: -99, bossLine: '', snoring: null,
}
function resetState(seed) {
  Object.assign(S, {
    seed, rand: mulberry(seed * 7919 + 13), t: 0, realT: 0, speed: 1,
    cons: 'up', moveTo: null, moveEnd: 0, sleep: false, asleep: false, asleepEnd: 0, drowsy: 0, vol: true,
    holdA: false, holdAcc: 0, lastHitReal: -9, stage: 0, hp: D.STAGES[0], dmg: 0, hits: 0, cleared: false, clearT: -9,
    strikes: 0, dozes: 0, conf: false, events: [], log: [], tutPhase: 0, endReason: '', endT: 0, introT: 0,
    dadGamer: false, caughtAt: [], bossLineT: -99, bossLine: '', confT: 0,
  })
  makeSchedule()
}

// ---------- 出来事の時刻表（種で決まる。同じ種なら同じ夜）
// mom: 足音（パタパタ）か階段のきしみ、ドアの前で止まる、peek（ドアノブが回って開く。光・音・寝顔を見る）/ listen（ドアの前で聞くだけ。光と音）
// dad: ドスドス、廊下を通る（ドアのすりガラスに影。光だけ見る）→ トイレ、また通る
// cat: カリカリ、ノブの音なしでドアが少し開く、棚に乗ってこっちを見る（通知ランプが見えたら飛びつく）
// talk: 壁の向こうの寝言。グゥなら平気、ガサッならおかんがすぐ来る
// car: 窓の外を車が通る。光が壁を流れる（無視してよい）
function mkMom(t0, o = {}) {
  const e = { kind: 'mom', t0, sub: o.sub || 'peek', approach: o.approach || 'hall', fast: !!o.fast, cues: [], checks: [], res: null }
  let t = t0
  if (e.approach === 'stairs') { for (let i = 0; i < 4; i++) e.cues.push([t0 + i * 0.85, 'creak', (i + 1) / 4]); t = t0 + 3.3; e.lightOn = t0 + 1.2 } else e.lightOn = t0
  const n = e.fast ? 3 : 5, gap = e.fast ? 0.5 : 0.6
  e.walkA = t
  for (let i = 0; i < n; i++) e.cues.push([t + 0.2 + i * gap, 'mstep', (i + 1) / n])
  e.stop = t + 0.2 + n * gap
  if (e.sub === 'peek') {
    e.knob = e.stop + 0.6; e.open = e.stop + 1.25; e.close = e.stop + 3.9
    e.cues.push([e.knob, 'knob'], [e.open, 'dopen'], [e.close, 'dclose'])
    e.checks.push({ a: e.open + 0.45, b: e.close - 0.25, need: ['L', 'S', 'A'], viol: 0 })
    e.leave = e.close + 0.3
  } else {
    e.checks.push({ a: e.stop + 1.0, b: e.stop + 3.2, need: ['L', 'S'], viol: 0 })
    e.leave = e.stop + 3.4
  }
  for (let i = 0; i < 4; i++) e.cues.push([e.leave + i * 0.6, 'mstepAway', 1 - (i + 1) / 4])
  e.lightOff = e.leave + 2.6; e.end = e.lightOff + 0.3
  return e
}
function mkDad(t0, gamer) {
  const e = { kind: 'dad', t0, gamer, cues: [], checks: [], res: null, lightOn: t0 }
  for (let i = 0; i < 4; i++) e.cues.push([t0 + 0.3 + i * 0.7, 'dstep', 0.35 + 0.65 * (i + 1) / 4])
  e.pass1 = [t0 + 2.2, t0 + 3.9]
  e.checks.push({ a: t0 + 2.5, b: t0 + 3.5, need: ['L'], viol: 0 })
  e.cues.push([t0 + 3.1, 'dstep', 0.8], [t0 + 3.8, 'dstep', 0.5], [t0 + 4.4, 'tdoor'], [t0 + 4.9, 'flush'], [t0 + 9.2, 'tdoor'])
  for (let i = 0; i < 3; i++) e.cues.push([t0 + 9.6 + i * 0.7, 'dstep', 0.5 + 0.5 * (i + 1) / 3])
  if (!gamer) {
    e.pass2 = [t0 + 11.0, t0 + 12.7]
    e.checks.push({ a: t0 + 11.3, b: t0 + 12.3, need: ['L'], viol: 0 })
    e.cues.push([t0 + 12.0, 'dstep', 0.7], [t0 + 12.7, 'dstep', 0.4])
    e.lightOff = t0 + 13.6; e.end = t0 + 13.9
  } else {
    e.stop = t0 + 11.2; e.knob = t0 + 11.6; e.open = t0 + 12.2; e.close = t0 + 15.6
    e.cues.push([e.knob, 'knob'], [e.open, 'dopen'], [t0 + 12.6, 'dadGamer'], [t0 + 14.2, 'dadShh'], [e.close, 'dclose'], [t0 + 15.9, 'dstep', 0.6], [t0 + 16.6, 'dstep', 0.35])
    e.lightOff = t0 + 17.2; e.end = t0 + 17.5
  }
  return e
}
function mkCat(t0) {
  const e = { kind: 'cat', t0, cues: [[t0, 'scratch'], [t0 + 0.5, 'scratch'], [t0 + 1.0, 'scratch'], [t0 + 1.7, 'creep'], [t0 + 5.4, 'purr'], [t0 + 8.6, 'catLeave'], [t0 + 9.4, 'catClose']], checks: [], res: null }
  e.creep = [t0 + 1.6, t0 + 2.4]; e.walk = [t0 + 2.4, t0 + 3.8]; e.jump = [t0 + 3.8, t0 + 4.15]; e.leave = [t0 + 8.6, t0 + 9.4]
  e.checks.push({ a: t0 + 3.6, b: t0 + 5.2, need: ['LED'], viol: 0 })
  e.end = t0 + 9.7
  return e
}
function mkTalk(t0, awake) { return { kind: 'talk', t0, awake, cues: [[t0, 'talk'], [t0 + 2.4, awake ? 'rustle' : 'tsnore']], checks: [], res: null, end: t0 + 3.4 } }
function mkCar(t0) { return { kind: 'car', t0, cues: [[t0, 'car']], checks: [], res: null, sweep: [t0 + 0.6, t0 + 3.0], end: t0 + 3.6 } }

function makeSchedule() {
  const r = S.rand, DUR = D.DUR, tut = S.tut === 0
  // 1晩の札: おかん3（＋寝言のあとに1）・おとん2・猫2・寝言2（1つは本当に起きている）・車1。くじで並べる（同じ種類は続けない）
  let pool = ['mom', 'mom', 'mom', 'dad', 'dad', 'cat', 'cat', 'talkS', 'talkA', 'car']
  const kindOf = k => k.startsWith('talk') ? 'talk' : k
  for (let tries = 0; tries < 80; tries++) {
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1));[pool[i], pool[j]] = [pool[j], pool[i]] }
    let ok = true; for (let i = 1; i < pool.length; i++) if (kindOf(pool[i]) === kindOf(pool[i - 1])) ok = false
    if (tut && (pool[0] !== 'mom' || pool[1] !== 'dad')) ok = false
    if (ok) break
  }
  if (tut) { const rest = pool.filter((_, i) => i > 1); pool = ['mom', 'dad', ...rest] }
  // おかんの中身: のぞく/聞くを交互（最初はくじ）、階段は1〜2回
  let peekFirst = r() < 0.5, mi = 0
  const nStairs = 1 + (r() < 0.5 ? 1 : 0)
  let gamerUsed = false
  let t = tut ? 4.5 : 4 + r() * 2
  for (const k of pool) {
    let ev, extra = null
    if (k === 'mom') {
      const sub = tut && mi === 0 ? 'peek' : ((mi % 2 === 0) === peekFirst ? 'peek' : 'listen')
      const approach = !(tut && mi === 0) && mi >= 1 && mi <= nStairs ? 'stairs' : 'hall'
      ev = mkMom(t, { sub, approach }); mi++
    } else if (k === 'dad') { const g = !gamerUsed && !tut && r() < 0.12; if (g) gamerUsed = true; ev = mkDad(t, g) }
    else if (k === 'cat') ev = mkCat(t)
    else if (k === 'talkS') ev = mkTalk(t, false)
    else if (k === 'talkA') { ev = mkTalk(t, true); extra = mkMom(ev.end, { sub: r() < 0.5 ? 'peek' : 'listen', fast: true }); extra.fromTalk = true }
    else if (k === 'car') ev = mkCar(t)
    const last = extra || ev
    if (last.end > DUR - 4) break
    S.events.push(ev); if (extra) S.events.push(extra)
    t = last.end + lerp(4.6, 2.6, t / DUR) + r() * 2.0
  }
  S.events.forEach((e, i) => { e.i = i; e.cues.sort((a, b) => a[0] - b[0]); e.ci = 0 })
}

// ---------- 見られているか（乱数なし。状態だけで決まる）
// L=画面の光（ゲーム機が出ている） S=ゲーム機の音（音量オンでまくらの下でない） A=起きている LED=通知ランプ（まくらの下でない）
function seen(need) {
  const v = []
  for (const k of need) {
    if (k === 'L' && S.cons === 'up') v.push('L')
    if (k === 'S' && S.vol && S.cons !== 'pillow') v.push('S')
    if (k === 'A' && !S.sleep && !S.asleep) v.push('A')
    if (k === 'LED' && S.cons !== 'pillow') v.push('LED')
  }
  return v
}
const canPlay = () => S.mode === 'play' && S.cons === 'up' && !S.sleep && !S.asleep

// ---------- 遊びの1歩（60Hz）
function step() {
  if (S.mode === 'intro') { S.introT += DT; if (S.introT >= 1.6) { S.mode = 'play'; refreshActs() } return }
  if (S.mode === 'end') { S.endT += DT; endStep(); return }
  if (S.mode !== 'play') return
  S.realT += DT
  tutStep()
  const dt = DT * S.speed
  S.t += dt
  // ゲーム機を動かしている途中
  if (S.cons === 'moving' && S.t >= S.moveEnd) { S.cons = S.moveTo; S.moveTo = null; onConsChanged() }
  // 攻撃（A を押している間。現実の時間で数える）
  if (S.holdA && canPlay()) { S.holdAcc += DT; while (S.holdAcc >= D.HIT_EVERY) { S.holdAcc -= D.HIT_EVERY; hit() } }
  // 寝たふり、長いと本当に寝る
  if (S.asleep) { if (S.t >= S.asleepEnd) wakeUp() }
  else if (S.sleep && S.tut !== 0) { S.drowsy += dt; if (S.drowsy >= D.DOZE) doze() }
  else S.drowsy = Math.max(0, S.drowsy - dt * 1.5)
  // 出来事
  for (const e of S.events) {
    if (S.t < e.t0 - 3 || e.done) continue
    while (e.ci < e.cues.length && S.t >= e.cues[e.ci][0]) { const c = e.cues[e.ci++]; cue(e, c[1], c[2]) }
    for (const c of e.checks) {
      if (c.done || S.t < c.a) continue
      if (S.t <= c.b && e.res !== 'caught') {
        const v = seen(c.need)
        if (v.length) { c.viol += dt; if (c.viol >= D.GRACE) caught(e, c, v) } else c.viol = 0
      } else if (S.t > c.b) { c.done = true; if (!c.failed) { c.passed = true; checkPassed(e, c) } }
    }
    if (S.t >= e.end) { e.done = true; if (!e.res) e.res = e.checks.length ? 'safe' : 'none' }
  }
  if (S.mode !== 'play') return
  // おとんのいびき（壁の向こう）。おとんが起きる2.5秒前に止まる
  const dadUp = S.events.some(e => e.kind === 'dad' && S.t > e.t0 - 2.5 && S.t < e.end)
  setSnore(!dadUp)
  if (S.t >= D.DUR) endNight('dawn')
}

function cue(e, name, k) {
  const t = T()
  const doorP = () => tmpV.set(0.45, 1.05, -2.3), gapP = () => tmpV.set(0.45, 0.25, -2.3), wallP = () => tmpV.set(-1.25, 1.95, -2.3)
  switch (name) {
    case 'creak': Snd.play('cr', { vol: 0.25 + 0.3 * k, dest: 'muf' }); if (k > 0.4) ono(t.oCreak, doorP, '', 0.9); break
    case 'mstep': Snd.play('ms', { vol: 0.15 + 0.45 * k, rate: 1.15 }); if (k > 0.3 && Math.round(k * 10) % 4 === 0) ono(t.oMom, gapP, 'warm', 0.9); break
    case 'mstepAway': Snd.play('ms', { vol: 0.1 + 0.4 * k, rate: 1.15 }); break
    case 'dstep': Snd.play('ds', { vol: 0.35 + 0.65 * k, rate: 0.72 }); fx.shake = Math.max(fx.shake, 0.12 * k); if (k > 0.6) ono(t.oDad, gapP, 'big', 0.9); break
    case 'knob': Snd.play('knob', { vol: 0.9 }); fx.knobT = S.t; ono(t.oKnob, () => tmpV.set(0.8, 1.0, -2.3), 'warm', 1.0); break
    case 'dopen': Snd.play('dopen', { vol: 0.6 }); break
    case 'dclose': Snd.play('dclose', { vol: 0.6 }); break
    case 'tdoor': Snd.play('dclose', { vol: 0.25, dest: 'muf' }); break
    case 'flush': Snd.play('flush', { vol: 0.5, dest: 'muf' }); ono(t.oFlush, () => tmpV.set(1.2, 1.7, -2.3), 'cool', 1.4); break
    case 'scratch': Snd.play('cl', { vol: 0.5, rate: 1.4 }); if (e.cues[0][0] === S.t || e.ci === 1) ono(t.oScratch, gapP, '', 1.4); break
    case 'creep': Snd.play('cr', { vol: 0.35, rate: 1.3 }); ono(t.oDoor, doorP, '', 1.0); break
    case 'purr': if (e.res !== 'caught') { Snd.play('mew', { vol: 0.5 }); ono(t.oPurr, () => tmpV.set(-1.05, 1.1, -2.2), 'warm', 1.3) } break
    case 'catLeave': Snd.play('mew', { vol: 0.35, rate: 1.1 }); break
    case 'catClose': Snd.play('dclose', { vol: 0.3 }); break
    case 'talk': say(wallP, t.sTalk, 'wall'); break
    case 'tsnore': Snd.play('sn', { vol: 0.35, dest: 'muf' }); ono(t.oSnore, wallP, 'cool', 1.2); break
    case 'rustle': Snd.play('cl', { vol: 0.9, rate: 0.8 }); ono(t.oRustle, wallP, 'big', 1.1); break
    case 'car': Snd.play('car', { vol: 0.55, dest: 'muf' }); ono(t.oCar, () => tmpV.set(-1.05, 1.5, -2.3), '', 1.2); break
    case 'dadGamer': S.dadGamer = true; say(() => tmpV.set(0.45, 1.75, -2.6), t.sDadGamer); break
    case 'dadShh': say(() => tmpV.set(0.45, 1.75, -2.6), t.sDadShh); break
  }
}
function checkPassed(e, c) {
  if (e.kind === 'mom' && e.sub === 'peek') { say(() => tmpV.set(0.35, 1.7, -2.6), T().sMomOk); Snd.play('yawn', { vol: 0.25, delay: 0.6 }) }
  if (e.kind === 'mom' && e.sub === 'listen') say(() => tmpV.set(0.45, 1.6, -2.3), T().sMomListenOk)
  // ボスの面で見回りを切り抜けると、ボスが同じことを言う
  if (e.kind === 'mom' && S.stage === 7 && !S.cleared) bossSay()
}
function caught(e, c, v) {
  e.res = 'caught'; c.failed = true; for (const x of e.checks) x.done = true
  const blatant = e.kind === 'mom' && e.sub === 'peek' && v.length === 3
  const n = blatant ? 2 : 1
  S.strikes = Math.min(D.STRIKES, S.strikes + n)
  S.caughtAt.push({ kind: e.kind, sub: e.sub, t: +S.t.toFixed(2), v })
  e.caughtT = S.t
  const t = T()
  fx.shake = 0.5
  if (e.kind === 'mom') {
    if (e.sub === 'listen') { e.open = S.t + 0.5; e.close = S.t + 3.0; e.leave = e.close + 0.3; e.lightOff = e.leave + 2.6; e.end = Math.max(e.end, e.lightOff + 0.3); Snd.play('knob', { vol: 0.9 }); Snd.play('dopen', { vol: 0.6, delay: 0.5 }); e.cues.push([e.close, 'dclose']); e.cues.sort((a, b) => a[0] - b[0]) }
    if (S.strikes < D.STRIKES) setTimeout(() => say(() => tmpV.set(0.35, 1.7, -2.6), blatant ? t.sMomBlatant : (S.strikes >= 2 ? t.sMom2 : t.sMom1)), e.sub === 'listen' ? 700 : 150)
  }
  if (e.kind === 'dad') { say(() => tmpV.set(0.45, 1.5, -2.3), t.sDad1); if (S.strikes < D.STRIKES) setTimeout(() => say(() => tmpV.set(0.45, 1.5, -2.3), t.sDadTell), 1300) }
  if (e.kind === 'cat') {
    fx.pounceT = performance.now(); Snd.play('thud', { vol: 0.9, delay: 0.35 }); Snd.play('mew', { vol: 0.7, rate: 1.3 })
    setTimeout(() => { if (S.mode === 'play') say(() => tmpV.set(0.1, 1.2, -1.2), t.sOw) }, 450)
    setTimeout(() => { if (S.mode === 'play' && S.strikes < D.STRIKES) say(() => tmpV.set(-1.25, 1.95, -2.3), t.sWallWhat, 'wall') }, 1500)
    if (S.cons === 'up') { S.cons = 'futon'; onConsChanged() }
  }
  Snd.play('paper', { vol: 0.6, delay: 0.3 })
  addSticky()
  if (S.strikes >= D.STRIKES) confiscate(e)
}
function confiscate(e) {
  S.conf = true; S.holdA = false
  endNight('conf')
}
function endNight(reason) {
  if (S.mode !== 'play') return
  S.mode = 'end'; S.endReason = reason; S.endT = 0; S.holdA = false
  setSnore(false); setCbgm()
  tutHint(0)
  if (reason === 'conf') { S.confT = S.t; Snd.play('knob', { vol: 0.8, delay: 0.3 }); Snd.play('lose', { vol: 0.7, delay: 1.6 }); setTimeout(() => say(() => tmpV.set(0.35, 1.7, -2.6), T().sMomTake), 900) }
  if (reason === 'dawn') { Snd.play('rooster', { vol: 0.7 }); ono(T().oRooster, () => tmpV.set(-1.05, 1.5, -2.3), 'warm', 1.8) }
  if (reason === 'boss') { Snd.play('bosswin', { vol: 0.6 }); setTimeout(() => { Snd.play('rooster', { vol: 0.6 }); ono(T().oRooster, () => tmpV.set(-1.05, 1.5, -2.3), 'warm', 1.8) }, 1600) }
}
function endStep() {
  const wait = S.endReason === 'conf' ? 4.2 : 3.6
  if (S.endT >= wait) showResult()
}
function doze() {
  S.asleep = true; S.dozes++; S.asleepEnd = S.t + D.DOZE_SKIP; S.speed = 6; S.holdA = false
  ono(T().oDoze, () => tmpV.set(0.1, 1.3, -2.2), 'cool', 1.2); refreshActs()
}
function wakeUp() {
  S.asleep = false; S.sleep = false; S.drowsy = 0; S.speed = 1
  ono(T().oWake, () => tmpV.set(0.1, 1.3, -2.2), 'big', 1.0); Snd.play('cl', { vol: 0.6 }); refreshActs()
}

// ---------- 操作
function hit() {
  if (!canPlay()) return
  S.hits++; S.lastHitReal = S.realT
  const d = S.vol ? D.DMG_ON : D.DMG_OFF
  S.hp -= d; S.dmg += d
  if (S.vol) Snd.play('hit', { vol: 0.2 })
  if (S.hp <= 1e-6) {
    S.stage++; S.clearT = S.realT
    if (S.stage >= D.STAGES.length) { S.cleared = true; S.stage = D.STAGES.length - 1; S.hp = 0; S.dmg = TOTAL; endNight('boss'); return }
    S.hp = D.STAGES[S.stage]
    if (S.vol) Snd.play('stage', { vol: 0.3 })
    if (S.stage === 7) setTimeout(bossSay, 1200)
  }
}
function pressA(on) {
  if (on) {
    if (canPlay() && S.realT - S.lastHitReal >= D.TAP_MIN) { hit(); S.holdAcc = 0 }
    S.holdA = true
  } else S.holdA = false
  $('bA').classList.toggle('on', !!on && S.mode === 'play')
}
function act(k) {
  if (S.mode !== 'play' || S.asleep) return false
  if (k === 'vol') { S.vol = !S.vol; Snd.play('cl', { vol: 0.3, rate: 1.6 }); setCbgm(); refreshActs(); S.log.push([+S.t.toFixed(2), k]); return true }
  if (k === 'sleep') { S.sleep = !S.sleep; if (S.sleep) { S.holdA = false; Snd.play('sn', { vol: 0.18, rate: 1.25, delay: 0.3 }) } refreshActs(); S.log.push([+S.t.toFixed(2), k]); return true }
  if (S.cons === 'moving') return false
  if (k === 'futon') {
    if (S.cons === 'up') S.cons = 'futon'
    else if (S.cons === 'futon') S.cons = 'up'
    else { S.cons = 'moving'; S.moveTo = 'futon'; S.moveEnd = S.t + D.T_PILLOW_OUT }
    Snd.play('cl', { vol: 0.45 })
  } else if (k === 'pillow') {
    if (S.cons === 'pillow') { S.cons = 'moving'; S.moveTo = 'up'; S.moveEnd = S.t + D.T_PILLOW_OUT }
    else { S.cons = 'moving'; S.moveTo = 'pillow'; S.moveEnd = S.t + D.T_PILLOW_IN }
    Snd.play('cl', { vol: 0.6, rate: 0.9 })
  } else return false
  S.log.push([+S.t.toFixed(2), k])
  onConsChanged()
  return true
}
function onConsChanged() { setCbgm(); refreshActs() }
function refreshActs() {
  const b = document.body
  b.classList.toggle('st-futon', S.cons === 'futon' || S.moveTo === 'futon')
  b.classList.toggle('st-pillow', S.cons === 'pillow' || (S.cons === 'moving' && S.moveTo === 'pillow'))
  b.classList.toggle('st-moving', S.cons === 'moving' && S.moveTo === 'up')
  $('bFuton').classList.toggle('on', S.cons === 'futon' || S.moveTo === 'futon')
  $('bPillow').classList.toggle('on', S.cons === 'pillow' || S.moveTo === 'pillow')
  $('bSleep').classList.toggle('on', S.sleep || S.asleep)
  $('bVol').classList.toggle('off', !S.vol)
  for (const id of ['bFuton', 'bSleep', 'bPillow']) $(id).disabled = S.asleep
  // まくらの下に入りきったらゲーム機を消す（入れる途中は動きを見せる）
  clearTimeout(refreshActs.hideT); const con = $('con')
  if (S.cons === 'pillow') refreshActs.hideT = setTimeout(() => { if (S.cons === 'pillow') con.style.visibility = 'hidden' }, 300); else con.style.visibility = ''
  $('kidImg').src = (S.sleep || S.asleep) ? 'img/kid_sleep.webp' : 'img/kid_play.webp'
}
function addSticky() {
  const s = $('stk'); s.innerHTML = ''
  for (let i = 0; i < Math.min(S.strikes, D.STRIKES - 1); i++) { const n = document.createElement('i'); n.textContent = LANG === 'ja' ? (i ? '次は没収' : 'はよ寝') : (i ? 'Last one' : 'Sleep!'); s.appendChild(n) }
}

// ---------- 音（録音素材）
Snd.def({
  ms: ['snd/ms1.mp3', 'snd/ms2.mp3', 'snd/ms3.mp3'], ds: ['snd/ds1.mp3', 'snd/ds2.mp3', 'snd/ds3.mp3'], cr: ['snd/cr1.mp3', 'snd/cr2.mp3', 'snd/cr3.mp3'],
  knob: 'snd/knob.mp3', dopen: 'snd/dopen.mp3', dclose: ['snd/dclose1.mp3', 'snd/dclose2.mp3'], flush: 'snd/flush.mp3', cl: ['snd/cl1.mp3', 'snd/cl2.mp3', 'snd/cl3.mp3', 'snd/cl4.mp3'],
  mew: ['snd/mew1.mp3', 'snd/mew2.mp3'], sn: ['snd/sn1.mp3', 'snd/sn2.mp3', 'snd/sn3.mp3', 'snd/sn4.mp3'], yawn: 'snd/yawn.mp3', car: 'snd/car.mp3', rooster: 'snd/rooster.mp3',
  hit: ['snd/hit1.mp3', 'snd/hit2.mp3', 'snd/hit3.mp3'], click: 'snd/click.mp3', stage: 'snd/stage.mp3', bosswin: 'snd/bosswin.mp3', thud: 'snd/thud.mp3', paper: 'snd/paper.mp3',
  win: 'snd/win.mp3', mid: 'snd/mid.mp3', lose: 'snd/lose.mp3',
})
let muted = false
try { muted = localStorage.getItem('mg_mute') === '1' } catch (e) {}
Snd.setMute(muted)
function setMuteUI() { $('icOn').hidden = muted; $('icOff').hidden = !muted }
setMuteUI()
function soundOn() { Snd.init(); Snd.loop('amb', 'snd/amb_night.mp3', 0.1); Snd.loop('clock', 'snd/clock.mp3', 0.2); Snd.loop('fridge', 'snd/fridge.mp3', 0.07) }
function setSnore(on) { if (S.snoring === on) return; S.snoring = on; Snd.loop('snore', on ? 'snd/snoreloop.mp3' : null, 0.07, 0.8) }
let cbgmVol = -1
function setCbgm() {
  const v = S.mode === 'play' && S.vol ? (S.cons === 'up' ? 0.11 : S.cons === 'futon' ? 0.04 : S.cons === 'moving' ? 0.03 : 0) : 0
  if (v === cbgmVol) return; cbgmVol = v
  Snd.loop('cbgm', v > 0 ? 'snd/cbgm.mp3' : null, v, 0.25)
}

// ---------- ゲーム機の中のゲーム（160x120 のドット絵）
const PAL = { 0: '#c4d9b0', 1: '#8fae7d', 2: '#4f6b45', 3: '#1f2e1a' }
function drawSprite(x, rows, ox, oy, s, pal = PAL) { for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) { const c = rows[j][i]; if (c === '.') continue; x.fillStyle = pal[c]; x.fillRect(ox + i * s, oy + j * s, s, s) } }
const HERO = ['...3333...', '..333333..', '..300003..', '..303303..', '..300003..', '...3333...', '.22222222.', '2.222222.2', '..222222..', '..22..22..', '..33..33..', '.333..333.']
const MON = {
  slime: ['....3333....', '..33111133..', '.3111111113.', '311311113113', '311311113113', '311111111113', '311133331113', '.3333333333.'],
  bat: ['3..........3', '33........33', '323.3333.323', '.3223113223.', '..32111123..', '...322223...', '....3..3....'],
  mush: ['...333333...', '..32212213..', '.3221222123.', '322222222223', '.3333333333.', '...300003...', '...303303...', '...300003...', '...333333...'],
  ghost: ['...3333...', '..311113..', '.31311313.', '.31111113.', '.31133113.', '.31111113.', '.31111113.', '.3.31.3.3.', '3...3...3.'],
  golem: ['..333333..', '.32222223.', '.32322323.', '.32222223.', '3332222333', '3223333223', '32.3223.23', '...3223...', '..33..33..', '.333..333.'],
}
// ボス（なぜかパーマ）
const BOSS = ['.3.3.3333.3.3.', '.333333333333.', '.322222222223.', '.320022220023.', '.320322223023.', '.322222222223.', '..3223333223..', '...32222223...', '..3333333333..', '.322223322223.', '32.32222223.23', '...32222223...', '...33....33...']
// ---------- 3D: 夜の子ども部屋（奥の壁に窓・時計・ドア）
const canvas = $('gl')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1))
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x05070f)
const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 80)
const L = setupLook(renderer, scene, { sky: 0x4a5c94, ground: 0x18161f, hemi: 0.85, sun: 1.1, sunColor: 0x9fb4ff, sunPos: [-3, 3, 1], fill: 0.25, exposure: 1.05 })
const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...o })
function mesh(g, m, x = 0, y = 0, z = 0, parent = scene) { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); parent.add(o); return o }
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t }
const WALLZ = -2.4, DOORX = 0.05, DOORW = 0.8, DOORH = 1.95
const consLight = new THREE.PointLight(0x9fd8ff, 0, 6, 1.6); consLight.position.set(0.1, 1.0, 0.6); scene.add(consLight)
const hallLight = new THREE.PointLight(0xffc27a, 0, 5, 1.4); hallLight.position.set(0.45, 1.6, -1.9); scene.add(hallLight)
const dawnLight = new THREE.DirectionalLight(0xffb27a, 0); dawnLight.position.set(-3, 2, -1); scene.add(dawnLight)
{
  // 床（フローリング）
  const floorTex = canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#7a5a3e'; x.fillRect(0, 0, w, h)
    for (let i = 0; i < 12; i++) { const y = i * 43; x.fillStyle = `hsl(26,${30 + (i * 7) % 10}%,${32 + (i * 13) % 8}%)`; x.fillRect(0, y, w, 42); x.fillStyle = 'rgba(30,18,8,.4)'; x.fillRect(0, y + 42, w, 1); x.fillRect((i * 173) % 512, y, 1, 43) }
  })
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(2, 2)
  const f = mesh(new THREE.PlaneGeometry(3.4, 4.6), std(0xffffff, { map: floorTex, roughness: 0.6 }), 0, 0, -0.1); f.rotation.x = -Math.PI / 2
  // 敷物
  const rug = mesh(new THREE.CircleGeometry(0.75, 32), std(0x4a3a30, { roughness: 1 }), 0.1, 0.004, -1.75); rug.rotation.x = -Math.PI / 2; rug.scale.set(1.1, 0.6, 1)
  // 奥の壁（窓とドアの穴を空けて板を並べる）
  const wallTex = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#d9d2c2'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(140,120,90,.10)'; for (let i = 0; i < 16; i++) x.fillRect(i * 16, 0, 2, h); for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(120,100,80,${Math.random() * 0.05})`; x.fillRect(Math.random() * w, Math.random() * h, 3, 3) } })
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping
  const wallM = std(0xffffff, { map: wallTex, roughness: 0.95 })
  const wp = (x0, x1, y0, y1) => { const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (x0 + uv.getX(i) * (x1 - x0)) * 1.2, (y0 + uv.getY(i) * (y1 - y0)) * 1.2); mesh(g, wallM, (x0 + x1) / 2, (y0 + y1) / 2, WALLZ) }
  wp(-1.7, -1.42, 0, 2.4); wp(-1.42, -0.68, 0, 0.92); wp(-1.42, -0.68, 1.86, 2.4); wp(-0.68, DOORX, 0, 2.4); wp(DOORX, DOORX + DOORW, DOORH, 2.4); wp(DOORX + DOORW, 1.7, 0, 2.4)
  // 横の壁と天井
  const lw = mesh(new THREE.PlaneGeometry(4.6, 2.4), wallM, -1.7, 1.2, -0.1); lw.rotation.y = Math.PI / 2
  const rw = mesh(new THREE.PlaneGeometry(4.6, 2.4), wallM, 1.7, 1.2, -0.1); rw.rotation.y = -Math.PI / 2
  const ce = mesh(new THREE.PlaneGeometry(3.4, 4.6), std(0xcfc8b8), 0, 2.4, -0.1); ce.rotation.x = Math.PI / 2
  mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.06, 28), std(0xf2eee4, { roughness: 0.5 }), 0.1, 2.37, -1.2)
  // 幅木
  const base = std(0x5a3f2a)
  mesh(new THREE.BoxGeometry(0.75, 0.07, 0.02), base, -0.32, 0.035, WALLZ + 0.01); mesh(new THREE.BoxGeometry(0.28, 0.07, 0.02), base, -1.56, 0.035, WALLZ + 0.01); mesh(new THREE.BoxGeometry(0.85, 0.07, 0.02), base, 1.27, 0.035, WALLZ + 0.01)
  // ドア枠
  const trim = std(0x6b4a30, { roughness: 0.6 })
  mesh(new THREE.BoxGeometry(0.05, DOORH + 0.05, 0.06), trim, DOORX - 0.02, (DOORH + 0.05) / 2, WALLZ + 0.02)
  mesh(new THREE.BoxGeometry(0.05, DOORH + 0.05, 0.06), trim, DOORX + DOORW + 0.02, (DOORH + 0.05) / 2, WALLZ + 0.02)
  mesh(new THREE.BoxGeometry(DOORW + 0.09, 0.05, 0.06), trim, DOORX + DOORW / 2, DOORH + 0.025, WALLZ + 0.02)
  // 窓枠とカーテン
  const wf = std(0xe8e4dc, { roughness: 0.5 })
  mesh(new THREE.BoxGeometry(0.78, 0.04, 0.08), wf, -1.05, 0.92, WALLZ + 0.02); mesh(new THREE.BoxGeometry(0.78, 0.04, 0.08), wf, -1.05, 1.86, WALLZ + 0.02)
  mesh(new THREE.BoxGeometry(0.04, 0.98, 0.08), wf, -1.42, 1.39, WALLZ + 0.02); mesh(new THREE.BoxGeometry(0.04, 0.98, 0.08), wf, -0.68, 1.39, WALLZ + 0.02); mesh(new THREE.BoxGeometry(0.03, 0.94, 0.05), wf, -1.05, 1.39, WALLZ + 0.01)
  const curtTex = canvasTex(128, 64, (x, w, h) => { for (let i = 0; i < w; i++) { const v = 0.75 + 0.25 * Math.sin(i / w * Math.PI * 7); x.fillStyle = `rgb(${Math.round(70 * v)},${Math.round(96 * v)},${Math.round(140 * v)})`; x.fillRect(i, 0, 1, h) } })
  const cm = std(0xffffff, { map: curtTex, roughness: 1, side: THREE.DoubleSide })
  mesh(new THREE.PlaneGeometry(0.3, 1.25), cm, -1.5, 1.32, WALLZ + 0.07); mesh(new THREE.PlaneGeometry(0.26, 1.25), cm, -0.62, 1.32, WALLZ + 0.07)
  mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.1, 6), std(0x888888, { metalness: 0.6 }), -1.05, 1.96, WALLZ + 0.08).rotation.z = Math.PI / 2
  // 窓の下の低い棚（猫が乗る）と漫画
  const shelf = std(0x8a6a4a, { roughness: 0.7 })
  mesh(new THREE.BoxGeometry(0.9, 0.04, 0.3), shelf, -1.05, 0.72, WALLZ + 0.16); mesh(new THREE.BoxGeometry(0.9, 0.04, 0.3), shelf, -1.05, 0.36, WALLZ + 0.16)
  mesh(new THREE.BoxGeometry(0.03, 0.74, 0.3), shelf, -1.49, 0.37, WALLZ + 0.16); mesh(new THREE.BoxGeometry(0.03, 0.74, 0.3), shelf, -0.61, 0.37, WALLZ + 0.16)
  const spines = [0xd9534f, 0x3f7fbf, 0xf0c040, 0x5cb85c, 0xe08a3c, 0x8e6bbf, 0xf2f2f2, 0x333333]
  let bx = -1.46
  for (let i = 0; i < 22; i++) { const w = 0.03 + Math.random() * 0.012, hh = 0.2 + Math.random() * 0.08; if (bx + w > -0.64) break; mesh(new THREE.BoxGeometry(w, hh, 0.2), std(spines[(i * 5) % spines.length], { roughness: 0.6 }), bx + w / 2, 0.38 + hh / 2, WALLZ + 0.15); bx += w + 0.003 }
  bx = -1.46
  for (let i = 0; i < 14; i++) { const w = 0.04 + Math.random() * 0.02, hh = 0.24 + Math.random() * 0.06; if (bx + w > -0.9) break; mesh(new THREE.BoxGeometry(w, hh, 0.22), std(spines[(i * 3 + 1) % spines.length], { roughness: 0.6 }), bx + w / 2, 0.02 + hh / 2, WALLZ + 0.15); bx += w + 0.004 }
  // 机（右）とランドセル、ポスター
  const desk = std(0xa98258, { roughness: 0.6 })
  mesh(new THREE.BoxGeometry(0.75, 0.04, 0.5), desk, 1.3, 0.7, WALLZ + 0.3); mesh(new THREE.BoxGeometry(0.04, 0.7, 0.48), desk, 0.95, 0.35, WALLZ + 0.3); mesh(new THREE.BoxGeometry(0.04, 0.7, 0.48), desk, 1.65, 0.35, WALLZ + 0.3)
  mesh(new THREE.BoxGeometry(0.28, 0.3, 0.2), std(0x8a2a2a, { roughness: 0.4 }), 1.2, 0.87, WALLZ + 0.3)
  const lamp = new THREE.Group(); lamp.position.set(1.52, 0.72, WALLZ + 0.2); scene.add(lamp)
  mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.02, 16), std(0xe8e8e8), 0, 0.01, 0, lamp); mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.32, 6), std(0xe8e8e8), 0, 0.17, 0, lamp)
  mesh(new THREE.ConeGeometry(0.08, 0.1, 16, 1, true), std(0xe8e8e8, { side: THREE.DoubleSide }), 0.04, 0.33, 0, lamp)
  const poster = canvasTex(160, 220, (x, w, h) => {
    x.fillStyle = '#26361f'; x.fillRect(0, 0, w, h); x.fillStyle = '#a9c79a'; x.fillRect(8, 8, w - 16, h - 16)
    x.fillStyle = '#26361f'; x.font = '20px DotGothic16, monospace'; x.textAlign = 'center'; x.fillText('YOFUKA', w / 2, 40); x.fillText('QUEST', w / 2, 64)
    drawSprite(x, BOSS, 40, 90, 4, { 1: '#7d9c6e', 2: '#4f6b45', 3: '#26361f' })
  })
  mesh(new THREE.PlaneGeometry(0.42, 0.58), std(0xffffff, { map: poster, roughness: 0.9 }), 1.3, 1.6, WALLZ + 0.01).rotation.z = -0.04
  // 時計の下のカレンダー
  const cal = canvasTex(64, 80, (x, w, h) => { x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, w, h); x.fillStyle = '#c0392b'; x.fillRect(0, 0, w, 16); x.fillStyle = '#555'; for (let i = 0; i < 5; i++) for (let j = 0; j < 7; j++) x.fillRect(5 + j * 8, 22 + i * 11, 5, 6) })
  mesh(new THREE.PlaneGeometry(0.22, 0.28), std(0xffffff, { map: cal, roughness: 1 }), -0.3, 1.25, WALLZ + 0.01)
}
// 窓の外: 空（時刻で色が変わる）・月・向かいの家
const skyCanvas = document.createElement('canvas'); skyCanvas.width = 4; skyCanvas.height = 64
const skyTex = new THREE.CanvasTexture(skyCanvas); skyTex.colorSpace = THREE.SRGBColorSpace
mesh(new THREE.PlaneGeometry(6, 4), new THREE.MeshBasicMaterial({ map: skyTex }), -1.0, 1.6, -4.6)
const moon = mesh(new THREE.CircleGeometry(0.16, 24), new THREE.MeshBasicMaterial({ color: 0xfff3c4 }), -1.35, 2.1, -4.5)
const houses = new THREE.Group(); scene.add(houses)
for (const [x, w, h] of [[-2.2, 1.0, 1.1], [-1.1, 0.9, 1.45], [-0.1, 1.2, 1.0]]) {
  const hm = mesh(new THREE.BoxGeometry(w, h, 0.5), new THREE.MeshBasicMaterial({ color: 0x0c1022 }), x, h / 2 + 0.1, -4.2, houses)
  const roof = mesh(new THREE.ConeGeometry(w * 0.75, 0.35, 4), new THREE.MeshBasicMaterial({ color: 0x0a0d1a }), x, h + 0.27, -4.2, houses); roof.rotation.y = Math.PI / 4
  if (x !== -0.1) { const lit = mesh(new THREE.PlaneGeometry(0.14, 0.12), new THREE.MeshBasicMaterial({ color: 0xffd27a }), x + 0.2, h * 0.6, -3.94, houses); lit.userData.win = true }
}
const carGlow = mesh(new THREE.PlaneGeometry(1.2, 0.5), new THREE.MeshBasicMaterial({ map: canvasTex(128, 64, (x, w, h) => { const g = x.createRadialGradient(64, 32, 2, 64, 32, 60); g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(1, 'rgba(255,250,220,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h) }), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), -2.5, 0.6, -3.9)
carGlow.visible = false
// 車のライトが部屋の壁を流れる
const sweep = mesh(new THREE.PlaneGeometry(0.9, 1.3), new THREE.MeshBasicMaterial({ map: canvasTex(64, 128, (x, w, h) => { const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(255,248,220,0)'); g.addColorStop(0.5, 'rgba(255,248,220,.55)'); g.addColorStop(1, 'rgba(255,248,220,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h) }), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), 0, 1.7, WALLZ + 0.03)
sweep.visible = false
function drawSky(k) {
  const x = skyCanvas.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 64)
  const night = ['#060a1c', '#0d1636', '#18224a'], dawn = ['#2b3a78', '#c46f78', '#f6b26b']
  const mix = (a, b, t) => { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); const c = [16, 8, 0].map(s => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, t))); return `rgb(${c})` }
  const kk = sm(0.62, 1, k)
  g.addColorStop(0, mix(night[0], dawn[0], kk)); g.addColorStop(0.55, mix(night[1], dawn[1], kk)); g.addColorStop(1, mix(night[2], dawn[2], kk))
  x.fillStyle = g; x.fillRect(0, 0, 4, 64); skyTex.needsUpdate = true
}
drawSky(0)
// 壁の時計（2:00 から 5:30）
const clock = new THREE.Group(); clock.position.set(-0.3, 1.86, WALLZ + 0.03); scene.add(clock)
{
  const face = canvasTex(256, 256, (x) => { x.fillStyle = '#fbfaf5'; x.beginPath(); x.arc(128, 128, 120, 0, 7); x.fill(); x.lineWidth = 14; x.strokeStyle = '#b2452f'; x.stroke(); x.fillStyle = '#2a2a2a'; x.font = 'bold 34px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; for (let i = 1; i <= 12; i++) { const a = i / 12 * Math.PI * 2; x.fillText(String(i), 128 + Math.sin(a) * 88, 128 - Math.cos(a) * 88) } })
  mesh(new THREE.CircleGeometry(0.2, 40), new THREE.MeshBasicMaterial({ map: face }), 0, 0, 0, clock)
  const hm = new THREE.MeshBasicMaterial({ color: 0x1e1e1e })
  clock.userData.h = mesh(new THREE.PlaneGeometry(0.026, 0.11).translate(0, 0.045, 0), hm, 0, 0, 0.004, clock)
  clock.userData.m = mesh(new THREE.PlaneGeometry(0.018, 0.16).translate(0, 0.07, 0), hm, 0, 0, 0.005, clock)
}
// ドア（左が蝶番。すりガラスの細い窓と、下の隙間に廊下の光）
const door = new THREE.Group(); door.position.set(DOORX, 0, WALLZ); scene.add(door)
const glassCanvas = document.createElement('canvas'); glassCanvas.width = 32; glassCanvas.height = 96
const glassTex = new THREE.CanvasTexture(glassCanvas); glassTex.colorSpace = THREE.SRGBColorSpace
const gapCanvas = document.createElement('canvas'); gapCanvas.width = 128; gapCanvas.height = 4
const gapTex = new THREE.CanvasTexture(gapCanvas); gapTex.colorSpace = THREE.SRGBColorSpace
let knob
{
  const leafTex = canvasTex(128, 256, (x, w, h) => { x.fillStyle = '#9a7650'; x.fillRect(0, 0, w, h); for (let i = 0; i < 30; i++) { x.fillStyle = `rgba(60,35,15,${0.05 + Math.random() * 0.08})`; x.fillRect(0, Math.random() * h, w, 1 + Math.random() * 2) } x.strokeStyle = 'rgba(50,30,12,.45)'; x.lineWidth = 3; x.strokeRect(14, 150, 100, 92) })
  const leaf = mesh(new THREE.BoxGeometry(DOORW - 0.01, DOORH - 0.02, 0.04), std(0xffffff, { map: leafTex, roughness: 0.7 }), DOORW / 2, DOORH / 2 + 0.02, 0, door)
  leaf.userData.leaf = true
  mesh(new THREE.PlaneGeometry(0.16, 0.6), new THREE.MeshBasicMaterial({ map: glassTex }), DOORW / 2, 1.38, 0.022, door)
  knob = new THREE.Group(); knob.position.set(DOORW - 0.1, 0.95, 0.03); door.add(knob)
  mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.03, 12), std(0xc9b27a, { metalness: 0.7, roughness: 0.3 }), 0, 0, 0, knob).rotation.x = Math.PI / 2
  mesh(new THREE.BoxGeometry(0.12, 0.02, 0.02), std(0xc9b27a, { metalness: 0.7, roughness: 0.3 }), -0.05, 0, 0.02, knob)
}
const gap = mesh(new THREE.PlaneGeometry(DOORW - 0.02, 0.022), new THREE.MeshBasicMaterial({ map: gapTex, toneMapped: false }), DOORX + DOORW / 2, 0.011, WALLZ + 0.025)
// 廊下（ドアの向こう）
const hallM = new THREE.MeshBasicMaterial({ color: 0x000000 })
mesh(new THREE.PlaneGeometry(2.4, 2.4), hallM, 0.45, 1.2, -3.5)
const hf = mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshBasicMaterial({ color: 0x000000 }), 0.45, 0.002, -2.95); hf.rotation.x = -Math.PI / 2; hf.userData.hallFloor = true
const hwL = mesh(new THREE.PlaneGeometry(1.2, 2.4), hallM, -0.6, 1.2, -2.95); hwL.rotation.y = Math.PI / 2
const hwR = mesh(new THREE.PlaneGeometry(1.2, 2.4), hallM, 1.5, 1.2, -2.95); hwR.rotation.y = -Math.PI / 2
// 切り絵の人（板）。テクスチャは読み込みが済んだら貼る
const TEX = {}
const texLoader = new THREE.TextureLoader()
const SPRITES = ['mom_peek', 'mom_listen', 'mom_relief', 'mom_caught', 'mom_yawn', 'mom_win', 'dad_walk', 'dad_peek', 'dad_gamer', 'cat_crouch', 'cat_leap', 'cat_swat']
function loadTex(n) { return new Promise(res => texLoader.load(`img/${n}.webp`, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; TEX[n] = t; res() }, undefined, () => res())) }
const person = mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.05, depthWrite: true }), 0.45, 0.8, -2.75)
person.visible = false
const cat = mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.05, color: 0x9a9aa8 }), 0, 0, 0)
cat.visible = false
function setPlane(m, name, h) { const t = TEX[name]; if (!t) { m.visible = false; return false } if (m.material.map !== t) { m.material.map = t; m.material.needsUpdate = true } m.scale.set(h * (ART[name] || 0.6), h, 1); return true }
// 台所の棚（没収の絵）。部屋から離れた所に置く
const KX = 30
const kitchen = new THREE.Group(); kitchen.position.set(KX, 0, 1.5); scene.add(kitchen)
let shelfConsole
{
  const kw = std(0xe9e1cf, { roughness: 0.95 })
  mesh(new THREE.PlaneGeometry(4, 2.6), kw, 0, 1.3, WALLZ, kitchen)
  const tile = canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#e8efe9'; x.fillRect(0, 0, w, h); x.strokeStyle = '#b9c4bd'; x.lineWidth = 2; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32, h); x.moveTo(0, i * 32); x.lineTo(w, i * 32); x.stroke() } })
  tile.wrapS = tile.wrapT = THREE.RepeatWrapping; tile.repeat.set(5, 2)
  mesh(new THREE.PlaneGeometry(4, 0.7), std(0xffffff, { map: tile }), 0, 1.25, WALLZ + 0.01, kitchen)
  mesh(new THREE.BoxGeometry(3.4, 0.9, 0.6), std(0x8a6a4a, { roughness: 0.6 }), 0, 0.45, WALLZ + 0.3, kitchen)
  mesh(new THREE.BoxGeometry(3.4, 0.04, 0.62), std(0xd8d4cc, { roughness: 0.4 }), 0, 0.91, WALLZ + 0.3, kitchen)
  // 吊り棚（いちばん上の段に没収されたゲーム機）
  const sh = std(0xa07850, { roughness: 0.6 })
  for (const y of [1.62, 2.05]) mesh(new THREE.BoxGeometry(1.6, 0.04, 0.3), sh, 0.3, y, WALLZ + 0.16, kitchen)
  mesh(new THREE.BoxGeometry(0.04, 0.5, 0.3), sh, -0.5, 1.84, WALLZ + 0.16, kitchen); mesh(new THREE.BoxGeometry(0.04, 0.5, 0.3), sh, 1.1, 1.84, WALLZ + 0.16, kitchen)
  // 炊飯器・調味料・缶
  const rc = mesh(new THREE.CylinderGeometry(0.17, 0.18, 0.24, 24), std(0xf2f2f0, { roughness: 0.35 }), -1.0, 1.05, WALLZ + 0.3, kitchen)
  mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.05, 24), std(0xd9d9d6, { roughness: 0.35 }), -1.0, 1.19, WALLZ + 0.3, kitchen)
  for (const [x, c, h] of [[-0.3, 0xc0392b, 0.18], [-0.18, 0xf0c040, 0.14], [-0.06, 0x3f7fbf, 0.16], [0.6, 0x7a5230, 0.2], [0.75, 0xeeeeee, 0.12]]) mesh(new THREE.CylinderGeometry(0.045, 0.045, h, 14), std(c, { roughness: 0.4 }), x, 1.64 + h / 2, WALLZ + 0.16, kitchen)
  // 没収されたゲーム機（ミント色・赤いボタン。おかんの絵と同じ）
  shelfConsole = new THREE.Group(); shelfConsole.position.set(0.35, 2.07, WALLZ + 0.18); shelfConsole.rotation.set(-0.35, 0.25, 0.04); kitchen.add(shelfConsole)
  mesh(new THREE.BoxGeometry(0.34, 0.035, 0.17), std(0x97d3b4, { roughness: 0.45 }), 0, 0.02, 0, shelfConsole)
  mesh(new THREE.PlaneGeometry(0.17, 0.12), std(0x25302a, { roughness: 0.2 }), 0, 0.039, 0, shelfConsole).rotation.x = -Math.PI / 2
  mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 14), std(0xd8443a, { roughness: 0.4 }), 0.12, 0.042, 0.01, shelfConsole)
  // 「預かります」のメモ
  const memoTex = canvasTex(256, 200, (x, w, h) => { x.fillStyle = '#fbe57a'; x.fillRect(0, 0, w, h) })
  const memo = mesh(new THREE.PlaneGeometry(0.26, 0.2), std(0xffffff, { map: memoTex, roughness: 1 }), 0.62, 1.95, WALLZ + 0.32, kitchen); memo.rotation.z = 0.08
  kitchen.userData.memo = memo
  const kl = new THREE.PointLight(0xfff1d8, 2.2, 6, 1.2); kl.position.set(0.2, 2.3, -0.8); kitchen.add(kl)
  kitchen.visible = false
}

const MON_ORDER = ['slime', 'bat', 'mush', 'ghost', 'slime', 'bat', 'golem']
const scr = $('scr'), sx = scr.getContext('2d')
sx.imageSmoothingEnabled = false
let scrT = 0, bossBubble = 0
function bossSay() { const a = T().boss; S.bossLine = a[Math.floor(Math.random() * a.length)]; S.bossLineT = S.realT; bossBubble = readSec(S.bossLine, 1.6); while (FLOATS.length && shownTexts() > 2) FLOATS.shift().el.remove() }
function drawScreen(dt) {
  scrT += dt
  const x = sx
  x.fillStyle = PAL[0]; x.fillRect(0, 0, 160, 120)
  // 地面と背景のレンガ
  x.fillStyle = PAL[1]; for (let i = 0; i < 8; i++) x.fillRect(i * 20 + ((i % 2) * 6), 20, 14, 6)
  x.fillStyle = PAL[2]; x.fillRect(0, 96, 160, 2); x.fillStyle = PAL[1]; for (let i = 0; i < 16; i++) x.fillRect(i * 10 + ((scrT * 8) % 10), 102, 4, 2)
  x.font = '12px DotGothic16, monospace'; x.textBaseline = 'top'; x.textAlign = 'left'
  if (S.mode === 'title' || S.mode === 'how') {
    x.fillStyle = PAL[3]; x.textAlign = 'center'; x.font = '16px DotGothic16, monospace'; x.fillText('YOFUKA', 80, 26); x.fillText('QUEST', 80, 44)
    drawSprite(x, HERO, 30, 70 + Math.round(Math.sin(scrT * 4)), 2); drawSprite(x, MON.slime, 102, 80 + Math.round(Math.abs(Math.sin(scrT * 3)) * -3), 2)
    if (Math.floor(scrT * 2) % 2) { x.font = '10px DotGothic16, monospace'; x.fillText('PUSH START', 80, 106) }
    return
  }
  const boss = S.stage === 7
  // 上の表示
  x.fillStyle = PAL[3]; x.fillText(boss ? T().scrBoss : `${T().scrStage} ${S.stage + 1}`, 6, 4)
  x.textAlign = 'right'; x.fillText('HP ' + Math.max(0, Math.ceil(S.hp)), 154, 4); x.textAlign = 'left'
  if (!S.vol) { x.fillStyle = PAL[3]; x.fillRect(64, 6, 4, 6); x.fillRect(68, 4, 3, 10); x.fillRect(74, 5, 2, 2); x.fillRect(76, 7, 2, 2); x.fillRect(78, 9, 2, 2); x.fillRect(78, 5, 2, 2); x.fillRect(74, 9, 2, 2) }
  const since = S.realT - S.lastHitReal, lunge = since < 0.1 ? 8 : 0
  drawSprite(x, HERO, 26 + lunge, 72, 2)
  if (since < 0.12) { x.fillStyle = PAL[3]; x.fillRect(50 + lunge, 70, 3, 16); x.fillRect(53 + lunge, 72, 3, 12) }
  // 敵
  const clearing = S.realT - S.clearT < 0.7
  if (clearing) { x.fillStyle = PAL[3]; x.textAlign = 'center'; x.font = '16px DotGothic16, monospace'; x.fillText(T().scrClear, 80, 40) }
  else if (S.mode === 'end' && S.endReason === 'boss') { x.fillStyle = PAL[3]; x.textAlign = 'center'; x.font = '12px DotGothic16, monospace'; x.fillText(T().scrWin, 80, 40) }
  else {
    const flash = since < 0.08
    const pal = flash ? { 1: PAL[0], 2: PAL[1], 3: PAL[2] } : PAL
    const bob = Math.round(Math.sin(scrT * 5) * 1.5)
    if (boss) drawSprite(x, BOSS, 96, 44 + bob, 3, pal)
    else { const m = MON[MON_ORDER[S.stage]]; drawSprite(x, m, 102, 96 - m.length * 3 + bob, 3, pal) }
  }
  // ボスのお説教（おかんと同じことを言う）
  if (bossBubble > 0) {
    bossBubble -= dt
    x.fillStyle = PAL[0]; x.fillRect(4, 22, 152, 18); x.strokeStyle = PAL[3]; x.lineWidth = 1; x.strokeRect(4.5, 22.5, 151, 17)
    x.fillStyle = PAL[3]; x.font = '11px DotGothic16, monospace'; x.textAlign = 'center'; x.fillText(S.bossLine, 80, 25)
  }
}

// ---------- 画面の文字（同時に2つまで。表示は 0.9秒＋1字0.09秒以上）
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3()
const FLOATS = []
function readSec(text, min = 0) { return Math.max(min, 0.9 + 0.09 * [...text].length) }
function shownTexts() { return FLOATS.length + (!$('hint').hidden ? 1 : 0) + (!$('bigMsg').hidden ? 1 : 0) + (bossBubble > 0 ? 1 : 0) }
function addFloat(el, anchor, sec) {
  while (FLOATS.length && shownTexts() >= 2) FLOATS.shift().el.remove()
  if (shownTexts() >= 2) return
  $('fx').appendChild(el); FLOATS.push({ el, anchor, life: sec, age: 0 })
}
function ono(text, anchor, cls, sec) { const el = document.createElement('div'); el.className = 'ono ' + (cls || ''); el.textContent = text; addFloat(el, anchor, readSec(text, sec)) }
function say(anchor, text, cls) { if (!text) return; const el = document.createElement('div'); el.className = 'sb' + (cls ? ' ' + cls : ''); el.textContent = text; addFloat(el, anchor, readSec(text, 1.2)) }
let bigT = 0
function bigMsg(text, sec) { const b = $('bigMsg'); b.textContent = text; b.hidden = false; bigT = readSec(text, sec); while (FLOATS.length > 1) FLOATS.shift().el.remove() }
function conTopPx() { return innerHeight * 0.41 + 8 }
function updateFloats(dt) {
  const W = innerWidth, top = conTopPx()
  for (let i = FLOATS.length - 1; i >= 0; i--) {
    const o = FLOATS[i]; o.age += dt
    if (o.age > o.life) { o.el.remove(); FLOATS.splice(i, 1); continue }
    const p = o.anchor().clone().project(camera)
    let x = (p.x * 0.5 + 0.5) * W, y = (-p.y * 0.5 + 0.5) * innerHeight
    const w = o.el.offsetWidth, h = o.el.offsetHeight
    x = clamp(x - w / 2, 6, W - w - 6); y = clamp(y - h, 54, top - h - 14)
    const k = Math.min(1, o.age / 0.12), out = o.life - o.age < 0.25 ? (o.life - o.age) / 0.25 : 1
    o.el.style.transform = `translate(${x}px,${y}px) scale(${lerp(0.6, 1, k)}) rotate(${o.el.classList.contains('ono') ? -5 : 0}deg)`
    o.el.style.opacity = out
  }
  if (FLOATS.length === 2) {
    const a = FLOATS[0].el.getBoundingClientRect(), b = FLOATS[1].el.getBoundingClientRect()
    if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) FLOATS[1].el.style.transform += ` translateY(${a.top - b.bottom - 4}px)`
  }
}

// ---------- チュートリアル（最初の1回だけ）
let hintState = ''
function tutHint(key, target) {
  const id = key ? key + '|' + (target || '') : ''
  if (id === hintState) return; hintState = id
  const h = $('hint'), f = $('finger')
  for (const b of document.querySelectorAll('.ping')) b.classList.remove('ping')
  if (!key) { h.hidden = true; f.toggleAttribute('hidden', true); return }
  h.textContent = T()[key]; h.hidden = false
  while (FLOATS.length && shownTexts() > 2) FLOATS.shift().el.remove()
  placeHint(target)
}
function placeHint(target) {
  const h = $('hint'), f = $('finger')
  if (!target) { h.style.top = (conTopPx() - 64) + 'px'; h.style.left = '50%'; f.toggleAttribute('hidden', true); return }
  const b = $(target); b.classList.add('ping')
  const r = b.getBoundingClientRect()
  h.style.top = Math.max(60, r.top - 54) + 'px'
  const hw = h.offsetWidth || 160
  h.style.left = clamp(r.left + r.width / 2, hw / 2 + 8, innerWidth - hw / 2 - 8) + 'px'
  f.style.left = (r.left + r.width / 2 - 8) + 'px'; f.style.top = (r.top + r.height / 2 - 6) + 'px'; f.toggleAttribute('hidden', false)
}
function tutStep() {
  if (S.tut === 2) return
  const e0 = S.events[0], e1 = S.events[1]
  if (S.tut === 0) {
    if (S.tutPhase === 0) { S.speed = 0; tutHint('tutA', 'bA'); if (S.hits >= 4) { S.tutPhase = 1; S.speed = 1; tutHint('') } return }
    if (!e0) { S.tut = 1; return }
    if (S.t >= e0.t0 && S.t < e0.knob) {
      if (S.cons === 'pillow' || S.moveTo === 'pillow') { S.speed = 0.7; tutHint('') }
      else if (S.t >= e0.t0 + 1.0) { S.speed = 0; tutHint('tutPillow', 'bPillow') }
      else { S.speed = 0.6; tutHint('tutStep') }
      return
    }
    if (S.t >= e0.knob && S.t < e0.close) {
      if (!S.sleep) { S.speed = 0; tutHint('tutSleep', 'bSleep') } else { S.speed = 1; tutHint('') }
      return
    }
    if (S.t >= e0.close + 0.4) {
      S.speed = 1
      if (S.sleep) tutHint('tutWake', 'bSleep')
      else if (S.cons !== 'up' && S.moveTo !== 'up') tutHint('tutOut', 'bPillow')
      else { tutHint(''); S.tut = 1 }
    }
    return
  }
  if (S.tut === 1 && e1 && e1.kind === 'dad') {
    if (S.t >= e1.t0 && S.t < e1.t0 + 1.2) tutHint('tutDad')
    else if (S.t >= e1.t0 + 1.2 && S.t < e1.checks[0].b) { if (S.cons === 'up') { S.speed = 0; tutHint('tutDad2', 'bFuton') } else { S.speed = 1; tutHint('') } }
    else if (S.t >= e1.checks[0].b) { S.speed = 1; tutHint(''); S.tut = 2; try { localStorage.setItem('mg_tut', '1') } catch (e) {} }
  } else if (S.tut === 1 && (!e1 || e1.kind !== 'dad')) { S.tut = 2 }
}

// ---------- カメラ（奥の壁が画面の上4割に収まるようにレンズをずらす）
const CAM = { pos: new THREE.Vector3(0.1, 1.15, 1.6), dist: 4.0 }
let camYp = 0
function resize() {
  const W = innerWidth, H = innerHeight
  renderer.setSize(W, H, false)
  const m = Math.min((W / 2) / 1.2, (0.385 * H) / 2.45)   // 奥の壁での 1m あたりのピクセル
  const yFloor = conTopPx() - 4
  camYp = yFloor - m * CAM.pos.y
  const F = H * 3, f = m * CAM.dist
  camera.fov = 2 * Math.atan((F / 2) / f) * 180 / Math.PI
  camera.aspect = W / F
  camera.setViewOffset(W, F, 0, F / 2 - camYp, W, H)
  camera.updateProjectionMatrix()
}
addEventListener('resize', () => { resize(); if (!$('hint').hidden) placeHint(hintState.split('|')[1]) })
resize()

// ---------- 見た目の更新（出来事の時刻表から毎フレーム計算）
const fx = { shake: 0, knobT: -9, pounceT: 0, hall: 0, open: 0, lit: 1 }
let skyK = -1
function activeEvents(t) { return S.events.filter(e => t >= e.t0 - 0.1 && t < e.end + 0.3) }
function render(dt) {
  const tm = performance.now() / 1000
  const playing = S.mode === 'play' || S.mode === 'end' || S.mode === 'intro'
  const t = S.t
  const evs = playing ? activeEvents(t) : []
  // 廊下の明かり・ドアの開き・ガラスの影・隙間の足
  let hall = 0, open = 0, sil = null, feet = null, who = null, pose = null, catPos = null, catPose = 'cat_crouch', sweepK = -1
  for (const e of evs) {
    if (e.lightOn != null) hall = Math.max(hall, sm(e.lightOn, e.lightOn + 0.4, t) * (1 - sm(e.lightOff, e.lightOff + 0.4, t)))
    if (e.kind === 'mom') {
      const ap = sm(e.walkA, e.stop, t)
      if (t < e.stop) sil = { x: lerp(-0.4, 0.5, ap), a: 0.25 + 0.6 * ap }
      if (e.open != null) {
        open = Math.max(open, sm(e.open, e.open + 0.5, t) * (1 - sm(e.close, e.close + 0.45, t)) * 0.95)
        if (t >= e.open && t < e.close + 0.45) { who = 'mom'; pose = e.res === 'caught' ? 'mom_caught' : (e.checks[0].passed ? 'mom_relief' : 'mom_peek') }
        if (t >= e.stop && t < e.open) sil = { x: 0.5, a: 0.85 }, feet = { x: 0.5, a: 1 }
      } else if (t >= e.stop && t < e.leave) { sil = { x: 0.5, a: 0.85 }; feet = { x: 0.5, a: 1 } }
      if (t >= e.leave && t < e.leave + 1.6) sil = { x: lerp(0.5, -0.5, sm(e.leave, e.leave + 1.6, t)), a: 0.8 }
    }
    if (e.kind === 'dad') {
      const pass = (p, dir) => { if (p && t >= p[0] && t < p[1]) { const k = (t - p[0]) / (p[1] - p[0]); sil = { x: dir > 0 ? lerp(-0.5, 1.5, k) : lerp(1.5, -0.5, k), a: 0.95, big: true }; feet = { x: dir > 0 ? lerp(-0.2, 1.2, k) : lerp(1.2, -0.2, k), a: 1 } } }
      pass(e.pass1, 1); pass(e.pass2, -1)
      if (e.gamer && e.open != null) {
        if (t >= e.stop && t < e.open) { sil = { x: 0.5, a: 0.95, big: true }; feet = { x: 0.5, a: 1 } }
        open = Math.max(open, sm(e.open, e.open + 0.5, t) * (1 - sm(e.close, e.close + 0.45, t)) * 0.95)
        if (t >= e.open && t < e.close + 0.45) { who = 'dad'; pose = 'dad_gamer' }
      }
      if (e.res === 'caught' && e.caughtT != null && t < e.caughtT + 1.2) sil = { x: 0.5, a: 1, big: true }
    }
    if (e.kind === 'cat') {
      open = Math.max(open, 0.25 * sm(e.creep[0], e.creep[1], t) * (1 - sm(e.leave[1], e.leave[1] + 0.4, t)))
      if (t >= e.creep[0] + 0.4 && t < e.leave[1]) {
        if (t < e.walk[0]) catPos = [0.72, 0, WALLZ + 0.1]
        else if (t < e.walk[1]) { const k = sm(e.walk[0], e.walk[1], t); catPos = [lerp(0.72, -0.85, k), Math.abs(Math.sin(k * 14)) * 0.02, WALLZ + 0.12] }
        else if (t < e.jump[1]) { const k = (t - e.jump[0]) / (e.jump[1] - e.jump[0]); catPos = [lerp(-0.85, -1.0, k), 0.74 * k + Math.sin(k * Math.PI) * 0.25, WALLZ + 0.2] }
        else if (t < e.leave[0]) { catPos = [-1.0, 0.74, WALLZ + 0.2]; catPose = e.res === 'caught' ? 'cat_swat' : (t < e.checks[0].b ? 'cat_crouch' : 'cat_swat') }
        else { const k = sm(e.leave[0], e.leave[1], t); catPos = [lerp(-1.0, 0.72, k), 0.74 * (1 - Math.min(1, k * 4)), WALLZ + 0.12] }
        if (e.res === 'caught' && e.caughtT != null && t > e.caughtT && t < e.leave[0]) catPos = null   // 飛びついて布団の上（見えない）
      }
    }
    if (e.kind === 'car' && t >= e.sweep[0] && t < e.sweep[1]) sweepK = (t - e.sweep[0]) / (e.sweep[1] - e.sweep[0])
  }
  // 没収: おかんが入ってくる
  if (S.mode === 'end' && S.endReason === 'conf') { const k = sm(0.3, 0.8, S.endT); open = Math.max(open, 0.95 * k); hall = Math.max(hall, k); who = 'mom'; pose = S.endT > 2.0 ? 'mom_win' : 'mom_caught' }
  // 朝の結果: おかんがあくびしながら起こしに来る
  if (S.mode === 'result' && !S.conf) { open = 0.95; hall = 0.3; who = 'mom'; pose = 'mom_yawn' }
  fx.hall = lerp(fx.hall, hall, 1 - Math.exp(-dt * 12)); fx.open = lerp(fx.open, open, 1 - Math.exp(-dt * 10))
  door.rotation.y = fx.open * 1.25
  gap.visible = fx.open < 0.05
  // ドアノブが回る
  knob.rotation.z = (S.t - fx.knobT >= 0 && S.t - fx.knobT < 0.6) ? -0.6 * Math.sin((S.t - fx.knobT) / 0.6 * Math.PI) : 0
  // すりガラスと隙間
  {
    const g = glassCanvas.getContext('2d'), w = 32, h = 96
    const base = fx.hall
    g.fillStyle = `rgb(${Math.round(lerp(22, 236, base))},${Math.round(lerp(26, 196, base))},${Math.round(lerp(40, 128, base))})`; g.fillRect(0, 0, w, h)
    if (sil && base > 0.05) { g.fillStyle = `rgba(40,26,14,${sil.a * base})`; const cx = sil.x * w, bw = sil.big ? 30 : 24; g.beginPath(); g.ellipse(cx, 26, bw * 0.42, 15, 0, 0, 7); g.fill(); g.fillRect(cx - bw / 2, 38, bw, 60) }
    g.fillStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i < 6; i++) g.fillRect(0, i * 16, w, 2)
    glassTex.needsUpdate = true
    const q = gapCanvas.getContext('2d')
    q.fillStyle = `rgb(${Math.round(lerp(8, 255, base))},${Math.round(lerp(8, 210, base))},${Math.round(lerp(14, 130, base))})`; q.fillRect(0, 0, 128, 4)
    if (feet && base > 0.05) { q.fillStyle = `rgba(20,12,6,${feet.a})`; const fx0 = feet.x * 128; q.fillRect(fx0 - 22, 0, 16, 4); q.fillRect(fx0 + 4, 0, 16, 4) }
    gapTex.needsUpdate = true
  }
  const hl = 0.06 + 0.94 * fx.hall
  hallM.color.setRGB(0.55 * hl, 0.42 * hl, 0.28 * hl); hf.material.color.setRGB(0.45 * hl, 0.33 * hl, 0.22 * hl)
  hallLight.intensity = fx.hall * fx.open * 2.4
  // ドアの向こうの人
  if (who && fx.open > 0.25 && setPlane(person, pose, who === 'dad' ? 1.6 : 1.5)) {
    person.visible = true
    person.position.set(who === 'dad' ? 0.47 : (pose === 'mom_peek' ? 0.3 : 0.45), person.scale.y / 2, -2.78)
    const lk = 0.35 + 0.65 * Math.max(fx.hall, S.mode === 'result' ? 0.9 : 0)
    person.material.color.setRGB(lk, lk * 0.92, lk * 0.8)
  } else person.visible = false
  // 猫
  if (catPos && setPlane(cat, catPose, 0.36)) { cat.visible = true; cat.position.set(catPos[0], catPos[1] + 0.18, catPos[2]) } else cat.visible = false
  // 飛びつく猫（手前の絵の上を横切る）
  const pk = (performance.now() - fx.pounceT) / 650
  const pe = $('pounce')
  if (pk >= 0 && pk < 1 && fx.pounceT) { pe.hidden = false; pe.style.transform = `translate(${lerp(innerWidth * 0.05, innerWidth * 0.5, pk) - pe.offsetWidth / 2}px,${lerp(conTopPx() * 0.6, conTopPx() + 40, pk)}px) scale(${lerp(0.5, 1.4, pk)}) rotate(${lerp(-10, 14, pk)}deg)` } else pe.hidden = true
  // 車のライト
  sweep.visible = sweepK >= 0; carGlow.visible = sweepK >= 0
  if (sweepK >= 0) { sweep.position.x = lerp(-1.6, 1.8, sweepK); sweep.material.opacity = Math.sin(sweepK * Math.PI); carGlow.position.x = lerp(-2.6, 1.0, sweepK) }
  // 時刻（空・月・時計・明るさ）
  const k = S.mode === 'result' ? 1 : (playing ? clamp(t / D.DUR, 0, 1) : 0)
  if (Math.abs(k - skyK) > 0.004) { skyK = k; drawSky(k) }
  const dawn = sm(0.7, 1, k)
  moon.material.color.setRGB(1, 0.95, 0.77).multiplyScalar(1 - dawn * 0.6)
  L.hemi.intensity = 0.85 + dawn * 0.7; L.sun.intensity = 1.1 * (1 - dawn); dawnLight.intensity = dawn * 2.0
  const mins = D.START_MIN + k * (D.END_MIN - D.START_MIN)
  clock.userData.m.rotation.z = -(mins % 60) / 60 * Math.PI * 2
  clock.userData.h.rotation.z = -(mins / 60 % 12) / 12 * Math.PI * 2
  // ゲーム機の光（部屋を青く照らす）
  const lit = S.mode === 'title' ? 1 : (S.cons === 'up' && playing && !S.conf ? 1 : 0)
  fx.lit = lerp(fx.lit, lit, 1 - Math.exp(-dt * 10))
  consLight.intensity = fx.lit * (1.6 + 0.25 * Math.sin(tm * 9))
  const fg = $('fg').style
  fg.setProperty('--lit', fx.lit.toFixed(3)); fg.setProperty('--kb', (0.42 + 0.3 * fx.lit + 0.4 * dawn).toFixed(3))
  // 通知ランプ（点滅）
  $('led').classList.toggle('on', Math.floor(tm * 1.6) % 2 === 0)
  document.body.classList.toggle('st-taken', S.mode === 'end' && S.endReason === 'conf' && S.endT > 1.6)
  // まぶた
  const lid = $('lids')
  if (S.asleep && S.mode === 'play') { lid.children[0].style.height = '52svh'; lid.children[1].style.height = '52svh' }
  else if (S.sleep && S.mode === 'play') { lid.children[0].style.height = (8 + Math.max(0, S.drowsy - 2.5) * 4.5) + 'svh'; lid.children[1].style.height = '58svh' }
  else { lid.children[0].style.height = '0'; lid.children[1].style.height = '0' }
  // 自分の頭（遊んでいると少し前のめり）
  fg.setProperty('--kidY', (S.sleep || S.asleep ? 10 : (S.holdA && canPlay() ? 2 * Math.sin(tm * 30) : 0)).toFixed(1) + 'px')
  // カメラ（息で少し揺れる。重い足音で揺れる）
  fx.shake = Math.max(0, fx.shake - dt)
  const inK = S.mode === 'result' && S.conf
  kitchen.visible = inK
  const base = inK ? tmpV.set(KX + 0.25, 1.5, CAM.pos.z) : tmpV.copy(CAM.pos)
  camera.position.copy(base).add(tmpV2.set(Math.sin(tm * 0.5) * 0.015, Math.sin(tm * 0.8) * 0.012 + Math.sin(tm * 40) * 0.02 * fx.shake, 0))
  camera.lookAt(camera.position.x, camera.position.y, camera.position.z - CAM.dist)
  if (inK) { scene.background.setHex(0x1a1a1a); L.hemi.intensity = 1.1; L.sun.intensity = 0.3; dawnLight.intensity = 1.6 }
  drawScreen(dt)
  renderer.render(scene, camera)
}

// ---------- 画面
const VIEWS = ['vTitle', 'vHow', 'vPlay', 'vResult']
function show(id) { for (const v of VIEWS) $(v).hidden = v !== id; document.body.classList.toggle('mode-result', id === 'vResult'); document.body.classList.toggle('mode-how', id === 'vHow') }
function clearFloats() { for (const f of FLOATS.splice(0)) f.el.remove(); $('bigMsg').hidden = true; bossBubble = 0 }
function toTitle() { S.mode = 'title'; S.cons = 'up'; S.sleep = false; S.asleep = false; S.moveTo = null; S.vol = true; S.strikes = 0; addSticky(); refreshActs(); show('vTitle'); clearFloats(); tutHint(''); setCbgm(); setSnore(true) }
function startGame(seed) {
  soundOn()
  try { S.tut = localStorage.getItem('mg_tut') === '1' ? 2 : 0 } catch (e) { S.tut = 0 }
  if (window.__mgNoTut) S.tut = 2
  resetState(seed ?? ((Date.now() % 100000) + 1))
  S.mode = 'intro'; S.introT = 0
  addSticky(); refreshActs(); show('vPlay'); clearFloats(); tutHint('')
  bigMsg(T().clock0, 1.4)
  setSnore(true); cbgmVol = -1; setCbgm()
  if (window.TM) TM.start()
}

// ---------- 結果
function judge() {
  const prog = S.cleared ? 1 : clamp(S.dmg / TOTAL, 0, 1)
  const val = Math.round(prog * 100) + (S.cleared ? 30 : 0) - S.strikes * 12 - (S.conf ? 70 : 0) - S.dozes * 5
  const rank = D.RANKS.find(x => val >= x[0])[1]
  return { val, rank, prog: +prog.toFixed(3), stage: S.stage + 1, cleared: S.cleared, near: S.strikes, dozes: S.dozes, conf: S.conf, dadGamer: S.dadGamer }
}
let RES = null, revealTimers = []
function titleOf(r) { const t = T(); if (!r.conf && r.dozes >= 2 && (r.rank === 'C' || r.rank === 'D')) return t.dozeName; return t.rankName[r.rank] }
function showResult() {
  if (S.mode === 'result') return
  S.mode = 'result'
  clearFloats(); tutHint(''); setCbgm(); setSnore(false)
  try { localStorage.setItem('mg_tut', '1') } catch (e) {}
  RES = judge()
  const t = T()
  const min = Math.round(D.START_MIN + clamp(S.t / D.DUR, 0, 1) * (D.END_MIN - D.START_MIN))
  $('rTime').textContent = S.conf ? `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}` : '5:30'
  $('rv1').textContent = RES.cleared ? t.rBossDown : `${t.scrStage} ${RES.stage}/8`
  $('rv2').textContent = `${RES.near}${t.rUnit}`
  $('rv3').textContent = `${RES.dozes}${t.rUnit}`
  $('rLetter').textContent = RES.rank
  $('rName').textContent = titleOf(RES)
  $('mText').textContent = t.memo[RES.rank] + (RES.dadGamer && !RES.conf ? '。' + t.dadNote : '')
  $('mSign').textContent = t.sign
  for (const id of ['r1', 'r2', 'r3', 'rRank']) $(id).classList.remove('on')
  $('memo').classList.remove('on'); $('rBtns').classList.remove('on')
  show('vResult')
  revealTimers.forEach(clearTimeout); revealTimers = []
  const at = (ms, f) => revealTimers.push(setTimeout(f, ms))
  ;['r1', 'r2', 'r3'].forEach((id, i) => at(400 + i * 480, () => { $(id).classList.add('on'); Snd.play('hit', { vol: 0.3 }) }))
  at(2000, () => { $('memo').classList.add('on'); Snd.play('paper', { vol: 0.8 }) })
  at(2700, () => { $('rRank').classList.add('on'); Snd.play(['S', 'A'].includes(RES.rank) ? 'win' : (['B', 'C'].includes(RES.rank) ? 'mid' : 'lose'), { vol: 0.8 }) })
  at(3300, () => $('rBtns').classList.add('on'))
  if (window.TM) TM.end(Math.max(0, RES.val), !RES.conf)
}
function revealAll() { revealTimers.forEach(clearTimeout); revealTimers = [];['r1', 'r2', 'r3', 'rRank', 'memo', 'rBtns'].forEach(id => $(id).classList.add('on')) }
function resultCanvas() {
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; const x = c.getContext('2d'), t = T()
  const DOT = 'DotGothic16, monospace', HAND = '"Klee One", serif'
  x.fillStyle = '#0b1430'; x.fillRect(0, 0, 1080, 1350)
  // 3D の絵（上4割）
  render(0)
  const g = renderer.domElement, sh = g.height * 0.42
  x.drawImage(g, 0, 0, g.width, sh, 0, 0, 1080, 1080 * sh / g.width > 620 ? 620 : 1080 * sh / g.width)
  // プレイ記録（ゲーム機の画面）
  x.fillStyle = '#2f2f35'; x.fillRect(90, 660, 900, 560)
  x.fillStyle = '#a9c79a'; x.fillRect(120, 690, 840, 500)
  x.fillStyle = '#1e2b18'; x.font = `40px ${DOT}`; x.textBaseline = 'alphabetic'; x.fillText(t.resHd, 150, 750); x.fillRect(150, 770, 780, 4)
  const rows = [[t.rStage, $('rv1').textContent], [t.rNear, $('rv2').textContent], [t.rDoze, $('rv3').textContent]]
  rows.forEach(([k, v], i) => { const y = 850 + i * 80; x.font = `38px ${DOT}`; x.textAlign = 'left'; x.fillText(k, 160, y); x.textAlign = 'right'; x.font = `52px ${DOT}`; x.fillText(v, 920, y + 4) })
  x.textAlign = 'left'; x.lineWidth = 6; x.strokeStyle = '#1e2b18'; x.strokeRect(160, 1060, 120, 110); x.font = `96px ${DOT}`; x.fillText(RES.rank, 182, 1152)
  x.font = `48px ${DOT}`; x.fillText(titleOf(RES), 310, 1130, 620)
  // おかんのメモ
  x.save(); x.translate(760, 560); x.rotate(0.07); x.fillStyle = '#fbe57a'; x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 24; x.fillRect(-200, -70, 400, 170); x.restore()
  x.save(); x.translate(760, 560); x.rotate(0.07); x.fillStyle = '#2b2208'; x.font = `600 40px ${HAND}`; x.textAlign = 'center'; x.fillText(t.memo[RES.rank], 0, 10, 370); x.font = `600 34px ${HAND}`; x.fillText(t.sign, 140, 72); x.restore()
  x.fillStyle = '#9fb2d8'; x.font = `30px ${DOT}`; x.textAlign = 'left'; x.fillText(t.title, 90, 1290); x.textAlign = 'right'; x.font = `26px ${DOT}`; x.fillText('tom3games.github.io/midnight-gamer', 990, 1290)
  return c
}
async function saveImage() {
  if (window.TM) TM.share('save')
  const c = resultCanvas()
  const blob = await new Promise(r => c.toBlob(r, 'image/png'))
  const file = new File([blob], 'midnight-gamer.png', { type: 'image/png' })
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return } } catch (e) { if (e && e.name === 'AbortError') return }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'midnight-gamer.png'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 1000)
}
function xUrl() {
  const t = T(), r = { where: RES.cleared ? t.bossTxt : t.stageTxt(RES.stage), near: RES.near, title: titleOf(RES) }
  return `https://x.com/intent/post?text=${encodeURIComponent(t.xText(r))}&url=${encodeURIComponent(D.URL)}`
}

// ---------- 入力
$('bStart').onclick = () => { Snd.init(); Snd.play('click', { vol: 0.6 }); startGame() }
$('bHow').onclick = () => { Snd.init(); S.mode = 'how'; show('vHow') }
$('bHowBack').onclick = () => { S.mode = 'title'; show('vTitle') }
$('bAgain').onclick = () => startGame()
$('bTitle').onclick = () => toTitle()
$('bSave').onclick = () => saveImage()
$('bX').onclick = () => { if (window.TM) TM.share('x'); window.open(xUrl(), '_blank', 'noopener') }
$('bLang').onclick = () => { LANG = LANG === 'ja' ? 'en' : 'ja'; try { localStorage.setItem('mg_lang', LANG) } catch (e) {} applyLang(); addSticky(); if (S.mode === 'result' && RES) { S.mode = 'end'; showResult(); revealAll() } }
$('bMute').onclick = () => { muted = !muted; Snd.init(); Snd.setMute(muted); try { localStorage.setItem('mg_mute', muted ? '1' : '0') } catch (e) {} setMuteUI() }
const bA = $('bA')
bA.addEventListener('pointerdown', e => { e.preventDefault(); try { bA.setPointerCapture(e.pointerId) } catch (er) {} pressA(true) })
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) bA.addEventListener(ev, () => pressA(false))
$('bVol').addEventListener('pointerdown', e => { e.preventDefault(); act('vol') })
for (const [id, k] of [['bFuton', 'futon'], ['bSleep', 'sleep'], ['bPillow', 'pillow']]) $(id).addEventListener('pointerdown', e => { e.preventDefault(); act(k) })
addEventListener('keydown', e => { if (e.repeat) return; if (e.key === ' ' || e.key === 'Enter') { if (S.mode === 'play') { e.preventDefault(); pressA(true) } } const i = ['1', '2', '3'].indexOf(e.key); if (i >= 0) act(['futon', 'sleep', 'pillow'][i]); if (e.key === 'm') act('vol') })
addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') pressA(false) })
document.addEventListener('visibilitychange', () => { if (document.hidden) { lastT = 0; pressA(false) } })
{ const p = document.createElement('img'); p.id = 'pounce'; p.src = 'img/cat_leap.webp'; p.alt = ''; p.hidden = true; p.style.cssText = 'position:fixed;left:0;top:0;width:min(46vw,220px);z-index:31;pointer-events:none'; document.body.appendChild(p) }

// ---------- ループ（固定60Hz）
let lastT = 0, acc = 0
function frame(now) {
  requestAnimationFrame(frame)
  const t = performance.now() / 1000, dt = lastT ? Math.min(0.1, t - lastT) : DT; lastT = t
  if (!S.dbgPause) { acc += dt; let n = 0; while (acc >= DT && n < 8) { step(); acc -= DT; n++ } if (n >= 8) acc = 0 }
  if (bigT > 0) { bigT -= dt; if (bigT <= 0) $('bigMsg').hidden = true }
  updateFloats(dt)
  render(S.dbgPause ? 0 : dt)
}

// ---------- 検証用の窓口
window.MG = {
  S, D, act, pressA, judge, seen, camera, scene, renderer, FLOATS, xUrl, resultCanvas, TOTAL,
  state: () => ({ mode: S.mode, t: +S.t.toFixed(2), cons: S.cons, sleep: S.sleep, asleep: S.asleep, vol: S.vol, stage: S.stage + 1, hp: +S.hp.toFixed(1), dmg: +S.dmg.toFixed(1), strikes: S.strikes, dozes: S.dozes, conf: S.conf, cleared: S.cleared }),
  texts: () => shownTexts(),
  dbg: {
    pause(on) { S.dbgPause = on },
    start(seed, o = {}) { if (o.noTut) window.__mgNoTut = true; else window.__mgNoTut = false; startGame(seed); S.introT = 99; step() },
    tick(n = 1) { for (let i = 0; i < n; i++) step() },
    step(n = 1) { for (let i = 0; i < n; i++) step(); render(DT) },
    render() { updateFloats(0); render(0) },
    frames(n = 1) { for (let i = 0; i < n; i++) { updateFloats(DT); render(DT) } },
    fx,
    finish() { if (S.tut < 2) { S.tut = 2; S.speed = 1; tutHint('') } let n = 0; while ((S.mode === 'play' || S.mode === 'end' || S.mode === 'intro') && n++ < 60 * 600) step() },
    result() { showResult(); revealAll() },
    boss(text, sec = 99) { S.bossLine = text; bossBubble = sec },
  },
}
applyLang()
toTitle()
requestAnimationFrame(frame)
window.__jsUp = true
// ロード画面: 切り絵の本物の読み込みで進み、そろったら消す。遅い回線でも12秒で必ず消す
{
  const cells = $('cells'); for (let i = 0; i < 12; i++) cells.appendChild(document.createElement('i'))
  let shown = 0, done = false, got = 0
  const set = p => { shown = Math.max(shown, Math.min(1, p)); const n = Math.round(shown * 12); [...cells.children].forEach((c, i) => { c.style.opacity = i < n ? 1 : 0.15 }) }
  set(0.08)
  const finish = () => { if (done) return; done = true; set(1); setTimeout(() => { $('boot').classList.add('out'); setTimeout(() => { $('boot').hidden = true; window.__mgReady = true }, 380) }, 220) }
  const imgs = ['kid_play', 'kid_sleep', 'hand_l', 'hand_r', 'pillow', 'cat_leap'].map(n => new Promise(res => { const i = new Image(); i.onload = i.onerror = () => { got++; set(0.1 + 0.8 * got / (SPRITES.length + 6)); res() }; i.src = `img/${n}.webp` }))
  const texP = SPRITES.map(n => loadTex(n).then(() => { got++; set(0.1 + 0.8 * got / (SPRITES.length + 6)) }))
  const fontP = document.fonts ? Promise.race([Promise.all([document.fonts.load('16px DotGothic16'), document.fonts.load('600 16px "Klee One"')]), new Promise(r => setTimeout(r, 3000))]) : Promise.resolve()
  Promise.all([...imgs, ...texP, fontP]).then(finish)
  setTimeout(finish, 12000)
}
