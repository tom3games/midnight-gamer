// 検証用の bot（index.html では読まない）。sim.mjs・shot.mjs・og.mjs が page.addScriptTag で入れる
// 読む bot は「見えた・聞こえた合図の時刻 + 反応の遅れ」だけで動く（先の台本は見ない）
window.MGBot = (function () {
  function want(S, tp) {
    let hide = 'up', sleep = false
    const order = { up: 0, futon: 1, pillow: 2 }
    const up = h => { if (order[h] > order[hide]) hide = h }
    for (let i = 0; i < S.events.length; i++) {
      const e = S.events[i]
      if (tp < e.t0 - 0.1 || tp > e.end + 6) continue
      if (e.kind === 'mom') {
        const coming = e.approach === 'stairs' ? e.t0 + 0.85 : e.walkA + 0.2 + (e.fast ? 0.5 : 0.6)   // 2つ目の音で気づく
        const gone = e.open != null ? e.close + 0.45 : e.leave + 0.6
        if (tp >= coming && tp < gone) up('pillow')
        if (e.knob != null && tp >= e.knob && tp < gone) sleep = true
      }
      if (e.kind === 'dad') {
        if (tp >= e.t0 + 1.0 && tp < e.pass1[1]) up('futon')
        const back = e.t0 + 10.3, end2 = e.pass2 ? e.pass2[1] : e.close + 0.45
        if (tp >= back && tp < end2) up('futon')
      }
      if (e.kind === 'cat' && tp >= e.t0 && tp < e.t0 + 5.4) up('pillow')
      if (e.kind === 'talk' && e.awake && tp >= e.t0 + 2.4 && tp < e.end + 1.2) up('pillow')
    }
    return { hide, sleep }
  }
  function reach(MG, S, hide, sleep) {
    if (S.cons !== 'moving' && !S.asleep) {
      if (hide === 'pillow' && S.cons !== 'pillow') MG.act('pillow')
      else if (hide === 'futon' && S.cons === 'up') MG.act('futon')
      else if (hide === 'futon' && S.cons === 'pillow') MG.act('futon')
      else if (hide === 'up' && S.cons === 'futon') MG.act('futon')
      else if (hide === 'up' && S.cons === 'pillow') MG.act('pillow')
    }
    if (!S.asleep && sleep !== S.sleep) MG.act('sleep')
  }
  let rs = 1
  const rnd = () => (rs = (rs * 9301 + 49297) % 233280) / 233280
  return {
    seed(n) { rs = n },
    // 1歩ぶんの操作（毎 tick 呼ぶ）
    step(MG, name, o = {}) {
      const S = MG.S
      if (S.mode !== 'play') return
      if (name === 'read' || name === 'readSlow' || name === 'readMute') {
        const lag = name === 'readSlow' ? 0.8 : 0.45
        const w = want(S, S.t - lag)
        reach(MG, S, w.hide, w.sleep)
        if (name === 'readMute' && S.vol) MG.act('vol')
        const can = S.cons === 'up' && !S.sleep && !S.asleep
        if (can !== S.holdA) MG.pressA(can)
      } else if (name === 'hide') { reach(MG, S, 'pillow', false); if (S.holdA) MG.pressA(false) }
      else if (name === 'sleep') { reach(MG, S, 'pillow', true); if (S.holdA) MG.pressA(false) }
      else if (name === 'mash') { if (!S.holdA) MG.pressA(true) }
      else if (name === 'random') {
        if (!S.__rb || S.t > S.__rb) {
          S.__rb = S.t + 0.8 + rnd() * 1.2
          const k = Math.floor(rnd() * 6)
          if (k === 0) MG.act('futon'); else if (k === 1) MG.act('pillow'); else if (k === 2) MG.act('sleep'); else if (k === 3) MG.act('vol'); else MG.pressA(!S.holdA)
        }
      }
    },
    run(MG, name, seed, o = {}) {
      this.seed(seed * 7 + 3)
      MG.dbg.pause(true); MG.dbg.start(seed, { noTut: true })
      MG.S.__rb = 0
      let n = 0
      while (MG.S.mode === 'play' && n++ < 60 * 400) { this.step(MG, name, o); MG.dbg.tick(1) }
      if (o.noFinish) return null
      MG.dbg.finish()
      return MG.judge()
    },
  }
})()
