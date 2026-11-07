// 文言（日英）と遊びの数字。仕様の正本は ~/Desktop/claudecode/ideas/midnight-gamer.md
window.MG_DATA = {
  URL: 'https://tom3games.github.io/midnight-gamer/',
  DUR: 150,              // 一晩の長さ（秒）。時計は 2:00 から 5:30（1秒＝1.4分）
  START_MIN: 120, END_MIN: 330,
  HIT_EVERY: 0.2,        // A を押している間の攻撃の間隔（秒）
  TAP_MIN: 0.12,         // 連打の最短間隔
  DMG_ON: 1, DMG_OFF: 0.7,   // 音を消すと勇者が弱くなる（気分の問題）
  STAGES: [36, 42, 48, 54, 60, 66, 72, 102],   // 各ステージの敵の体力（8面目がボス）
  T_PILLOW_IN: 0.45, T_PILLOW_OUT: 0.9, T_FUTON: 0.2,   // ゲーム機を動かす時間
  DOZE: 7,               // 寝たふりがこの秒数続くと本当に寝る
  DOZE_SKIP: 16,         // 本当に寝ると夜がこれだけ進む（秒）
  GRACE: 0.15,           // 見られている間、これだけ続いたらばれる
  STRIKES: 3,            // ばれかけ3回で没収
  RANKS: [[125, 'S'], [100, 'A'], [70, 'B'], [40, 'C'], [0, 'D'], [-1e9, 'E']],
  T: {
    ja: {
      title: '深夜ゲーム、バレたら没収', title1: '深夜ゲーム', title2: 'バレたら没収', sub: 'MIDNIGHT GAMER',
      tagline: '朝までにボスを倒せ',
      start: 'はじめる', how: '遊び方', back: 'もどる', loading: '電池を入れています',
      howT: '遊び方',
      h1: '<b>A</b>を押している間、勇者が戦う。朝5:30までに<b>ボス</b>を倒せ',
      h2: '足音が止まったら、光と音を消す。<b>ドアノブ</b>が回ったら寝たふり',
      h3: '<b>パタパタ</b>はおかん。光も音も寝顔も見る。<b>ドスドス</b>はおとん。光しか見ない',
      h4: '猫は通知ランプに飛びつく。まくらの下へ。寝言のあと<b>グゥ</b>なら平気、<b>ガサッ</b>なら来る',
      h5: '寝たふりが長いと本当に寝る。音を消すと勇者が弱い（気分の問題）。<b>ばれかけ3回で没収</b>',
      bFuton: 'ふとんに伏せる', bSleep: '寝たふり', bPillow: 'まくらの下', vol: '音', a: 'A',
      tutA: 'Aを押して戦う', tutStep: '足音がする', tutPillow: 'まくらの下へ', tutSleep: '寝たふり！', tutWake: '目を開ける', tutOut: 'ゲーム機を出す', tutDad: 'おとんは光だけ', tutDad2: 'ふとんに伏せる',
      clock0: '午前2:00',
      oMom: 'パタ…', oDad: 'ドスッ', oCreak: 'ギッ…', oKnob: 'カチャ', oFlush: 'ジャー', oDoor: 'キィ…', oScratch: 'カリカリ', oCar: 'ブォン', oRustle: 'ガサッ', oSnore: 'ぐぅ…', oPurr: 'ゴロゴロ', oRooster: 'コケコッコー', oDoze: 'うと…', oWake: 'はっ', oThud: 'ドタッ',
      sMomOk: '…寝てるね', sMomListenOk: '…気のせいか', sMom1: '早く寝なさいよ', sMom2: '次は預かるからね', sMomTake: 'はい、預かります', sMomBlatant: '…ゲームしてるね',
      sDad1: 'まぶしっ…', sDadTell: '母さんに言うぞ', sDadGamer: '…おまえもか', sDadShh: 'しーっ', sOw: 'いてっ', sWallWhat: '…なに？', sTalk: '…まだ起きてるの…',
      boss: ['早く寝なさい勇者よ', 'ゲームは1日1時間だ', '明日起きられるのか'],
      scrStage: 'STAGE', scrBoss: 'BOSS', scrClear: 'CLEAR!', scrWin: 'まおうをたおした',
      memoMorning: '朝', resHd: 'プレイ記録', rStage: '進んだところ', rNear: 'ばれかけ', rDoze: '寝落ち', rUnit: '回', rBossDown: 'ボス撃破',
      again: 'もう一回', toTitle: 'タイトル', save: '画像を保存', xPost: 'Xでポスト',
      rankName: { S: '夜明けの勇者', A: '朝焼けの勇者', B: 'あと一歩の夜ふかし', C: '中ボスで夜明け', D: 'ふとんの番人', E: '台所の棚送り' },
      memo: { S: 'ゆうべは静かだったね', A: '目の下、クマあるよ', B: '朝ごはん置いとくね', C: '夜はちゃんと寝なさい', D: 'よく寝れた？', E: 'しばらく預かります' },
      dozeName: '寝落ちの達人', dadNote: 'おとんも起きてた',
      sign: '母',
      xText: (r) => `深夜2時から${r.where}まで進めて、ばれかけ${r.near}回「${r.title}」 #深夜ゲームバレたら没収`,
      stageTxt: (n) => `ステージ${n}`, bossTxt: 'ボス撃破',
    },
    en: {
      title: 'Midnight Gamer', title1: 'MIDNIGHT', title2: 'GAMER', sub: 'GET CAUGHT, LOSE IT',
      tagline: 'Beat the boss by dawn',
      start: 'Start', how: 'How to play', back: 'Back', loading: 'Inserting batteries',
      howT: 'How to play',
      h1: 'Hold <b>A</b> to fight. Beat the <b>boss</b> before 5:30 a.m.',
      h2: 'When the steps stop, kill the light and sound. When the <b>knob</b> turns, fake sleep',
      h3: '<b>Pitter-pat</b> is Mom. She checks light, sound and your face. <b>Thud thud</b> is Dad. Only light',
      h4: 'The cat pounces on the blinking LED. Use the pillow. After sleep-talk, <b>zzz</b> is fine, <b>rustle</b> means she is coming',
      h5: 'Fake sleep too long and you really fall asleep. Muted, the hero is weaker. <b>3 close calls and it is gone</b>',
      bFuton: 'Face down', bSleep: 'Fake sleep', bPillow: 'Under pillow', vol: 'VOL', a: 'A',
      tutA: 'Hold A to fight', tutStep: 'Footsteps…', tutPillow: 'Under the pillow', tutSleep: 'Fake sleep!', tutWake: 'Open your eyes', tutOut: 'Take it out', tutDad: 'Dad sees light only', tutDad2: 'Face down',
      clock0: '2:00 a.m.',
      oMom: 'pat…', oDad: 'THUD', oCreak: 'creak', oKnob: 'click', oFlush: 'FLUSH', oDoor: 'creee…', oScratch: 'scratch', oCar: 'vroom', oRustle: 'rustle', oSnore: 'zzz…', oPurr: 'purr', oRooster: 'Cock-a-doodle', oDoze: 'nod…', oWake: '!', oThud: 'THUMP',
      sMomOk: '…asleep. Good', sMomListenOk: '…just me', sMom1: 'Go to sleep', sMom2: 'Next time it\'s mine', sMomTake: 'Hand it over', sMomBlatant: '…you\'re gaming',
      sDad1: 'Too bright…', sDadTell: 'Telling Mom', sDadGamer: '…you too?', sDadShh: 'Shh', sOw: 'Ow!', sWallWhat: '…what?', sTalk: '…still up…?',
      boss: ['Go to bed, hero', 'One hour a day', 'Can you wake up?'],
      scrStage: 'STAGE', scrBoss: 'BOSS', scrClear: 'CLEAR!', scrWin: 'BOSS DOWN',
      memoMorning: 'Morning', resHd: 'PLAY RECORD', rStage: 'Reached', rNear: 'Close calls', rDoze: 'Dozed off', rUnit: '', rBossDown: 'Boss down',
      again: 'Again', toTitle: 'Title', save: 'Save image', xPost: 'Post on X',
      rankName: { S: 'Hero of Dawn', A: 'Sunrise Hero', B: 'One Boss Short', C: 'Midboss at Dawn', D: 'Futon Guardian', E: 'Sent to the Top Shelf' },
      memo: { S: 'So quiet last night', A: 'You have dark circles', B: 'Breakfast is ready', C: 'Sleep at night, OK?', D: 'Did you sleep well?', E: 'I\'m keeping this' },
      dozeName: 'Master of Dozing', dadNote: 'Dad was up too',
      sign: 'Mom',
      xText: (r) => `Gamed from 2 a.m. and reached ${r.where}. ${r.near} close calls. "${r.title}" #MidnightGamer`,
      stageTxt: (n) => `stage ${n}`, bossTxt: 'the boss down',
    },
  },
}
