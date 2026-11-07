import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// 公開URLの確認。node live.mjs（ログインしていないブラウザで見る）。SKIPGH=1 で GitHub ページの確認を省く
// 深夜ゲーム、バレたら没収: タイトル → はじめる → チュートリアル（A・まくら・寝たふり）→ 早送りで終わり → プレイ記録
import { chromium, webkit } from 'playwright'
import { execSync } from 'node:child_process'
// 個人のアカウント名は公開リポジトリに書かない。実行時に gh から取る
const OWNER = (() => { try { return execSync('gh api user -q .login', { encoding: 'utf8' }).trim().toLowerCase() } catch { return '' } })()
const URL0 = process.env.URL || 'https://tom3games.github.io/midnight-gamer/'
const out = []
for (const [name, bt, opts] of [['chromium', chromium, {}], ['webkit', webkit, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
  const b = await bt.launch(bt === chromium ? MUTE_LAUNCH : {}), ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, ...opts })
  await muteContext(ctx)
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
  p.on('requestfailed', r => errs.push('fail ' + r.url()))
  await p.goto(URL0 + '?t=' + Date.now(), { waitUntil: 'networkidle' })
  await p.waitForFunction(() => window.__mgReady, null, { timeout: 15000 })
  const tap = sel => name === 'webkit' ? p.tap(sel) : p.click(sel)
  await tap('#bStart')
  await p.waitForFunction(() => MG.S.mode === 'play' && MG.S.speed === 0, null, { timeout: 15000 })   // A を押すまで止まる
  for (let i = 0; i < 4; i++) { await tap('#bA'); await p.waitForTimeout(200) }
  await p.waitForFunction(() => MG.S.speed === 0 && MG.S.t > 1, null, { timeout: 20000 })   // 足音でまくらの案内
  await tap('#bPillow')
  await p.waitForFunction(() => MG.S.speed === 0 && MG.S.t >= MG.S.events[0].knob, null, { timeout: 20000 })   // ノブで寝たふりの案内
  await tap('#bSleep')
  await p.waitForFunction(() => MG.S.events[0].done, null, { timeout: 20000 })
  const first = await p.evaluate(() => MG.S.events[0].res)
  await p.evaluate(() => { MG.dbg.pause(true); MG.dbg.finish(); MG.dbg.pause(false) })
  await p.waitForFunction(() => document.getElementById('rBtns').classList.contains('on'), null, { timeout: 15000 })
  const res = await p.evaluate(() => ({ rank: document.getElementById('rName').textContent, mute: window.__muteOk() }))
  out.push(`${name}: tutorial=${first} result=${res.rank} muteOk=${res.mute}`)
  await p.screenshot({ path: `shots/live-${name}.png` })
  const og = await p.evaluate(async () => { try { const r = await fetch(document.querySelector('meta[property="og:image"]').content); return r.status + ' ' + r.headers.get('content-type') } catch (e) { return 'fetch failed' } })
  out.push(`${name}: og=${og} errors=${errs.length ? errs.join(' | ') : 'none'}`)
  await b.close()
}
if (process.env.SKIPGH) { console.log(out.join('\n')); process.exit(0) }
// ログアウト状態でリポジトリ・更新履歴に個人のIDが出ていないか
const b = await chromium.launch(MUTE_LAUNCH), p = await b.newPage()
for (const u of ['https://github.com/tom3games/midnight-gamer', 'https://github.com/tom3games/midnight-gamer/commits/main']) {
  const res = await p.goto(u, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500)
  out.push(`${u} status=${res.status()} owner=${OWNER && (await p.content()).toLowerCase().includes(OWNER) ? 'FOUND' : 'none'}`)
}
await b.close()
console.log(out.join('\n'))
