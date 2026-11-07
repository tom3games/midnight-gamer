// 遊び方ごとの分布。種を変えて12回ずつ回す。node sim.mjs（音は出さない）
// read=合図を読む（人の反応0.45秒）/ readSlow=遅い人（0.8秒）/ readMute=読むけど音はずっと消す
// hide=ずっとまくらの下 / sleep=ずっと寝たふり / mash=何も隠さず進める / nothing=何もしない / random=適当
import './mute-auto.mjs'  // テスト中は絶対に音を出さない（playwright を無音に差し替え）
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
const PORT = 5915
const server = spawn(process.execPath, ['server.mjs'], { cwd: import.meta.dirname, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch(MUTE_LAUNCH), ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'ja-JP' }); await muteContext(ctx)
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message))
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__mgReady, null, { timeout: 20000 })
await p.addScriptTag({ path: import.meta.dirname + '/bot.js' })
const N = Number(process.env.N || 12)
const BOTS = (process.env.BOTS || 'read,readSlow,readMute,hide,sleep,mash,nothing,random').split(',')
const out = {}
for (const bot of BOTS) {
  out[bot] = []
  for (let seed = 1; seed <= N; seed++) out[bot].push(await p.evaluate(([bot, seed]) => MGBot.run(MG, bot, seed * 101 + 7), [bot, seed]))
}
const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }
const rows = ['| bot | 判定値 中央/最小/最大 | 進み（ステージ中央） | ボス撃破 | ばれかけ（中央） | 寝落ち（中央） | 没収 | 判定の内訳 |', '|---|---|---|---|---|---|---|---|']
for (const bot of BOTS) {
  const a = out[bot], v = a.map(x => x.val)
  const ranks = {}; for (const x of a) ranks[x.rank] = (ranks[x.rank] || 0) + 1
  rows.push(`| ${bot} | ${med(v)} / ${Math.min(...v)} / ${Math.max(...v)} | ${med(a.map(x => x.stage))} | ${a.filter(x => x.cleared).length}/${N} | ${med(a.map(x => x.near))} | ${med(a.map(x => x.dozes))} | ${a.filter(x => x.conf).length}/${N} | ${Object.entries(ranks).sort().map(([k, n]) => k + n).join(' ')} |`)
}
console.log(rows.join('\n'))
console.log('errors', errs)
await b.close(); server.kill()
