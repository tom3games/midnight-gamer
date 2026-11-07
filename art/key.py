# 生成したシート（緑背景）を切り抜いて img/*.webp と art.js を作る。~/tools/pyimg/bin/python art/key.py
# 切り方は kobito-vs-okan/art/key.py と同じ。切り絵に見せるため、輪郭の外に紙の白い縁を足す
import numpy as np, os, json, shutil
from PIL import Image, ImageFilter
D = os.path.dirname(os.path.abspath(__file__)); OUT = D + '/../img/'
RIM = 7
def alpha(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    k = g - np.maximum(r, b)
    al = 1 - np.clip((k - 22) / (90 - 22), 0, 1)
    lim = np.maximum(r, b); g2 = np.where(g > lim, lim, g)
    return np.dstack([r, g2, b, al * 255]).clip(0, 255).astype(np.uint8)
def load(src):
    im = Image.fromarray(alpha(np.asarray(Image.open(D + '/raw/' + src + '.png').convert('RGB')).astype(np.float32)), 'RGBA')
    a = im.split()[3].filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7)); im.putalpha(a)
    rim = a.point(lambda v: 255 if v > 60 else 0).filter(ImageFilter.MaxFilter(RIM * 2 + 1)).filter(ImageFilter.GaussianBlur(0.8))
    paper = Image.new('RGBA', im.size, (255, 253, 246, 0)); paper.putalpha(rim)
    return Image.alpha_composite(paper, im)
# 名前: (シート, 左端, 右端)  縦は全部
SPLIT = {
  'mom_a': [('mom_peek', 0, 500), ('mom_listen', 500, 1030), ('mom_relief', 1030, 1536)],
  'mom_b': [('mom_caught', 0, 510), ('mom_yawn', 510, 1010), ('mom_win', 1010, 1536)],
  'dad_a': [('dad_walk', 0, 474), ('dad_peek', 474, 1030), ('dad_gamer', 1030, 1536)],
  'kid_a': [('kid_play', 0, 505), ('kid_hide', 505, 1015), ('kid_sleep', 1015, 1536)],
  'hands_a': [('hand_l', 0, 500), ('hand_r', 500, 1015), ('pillow', 1015, 1536)],
}
out = {}
for src, parts in SPLIT.items():
    im = load(src)
    for name, x0, x1 in parts:
        c = im.crop((x0, 0, x1, im.height)); bb = c.split()[3].point(lambda v: 255 if v > 24 else 0).getbbox()
        c = c.crop(bb); w, h = c.size
        m = 560
        if max(w, h) > m:
            k = m / max(w, h); c = c.resize((round(w * k), round(h * k)), Image.LANCZOS)
        c.save(OUT + name + '.webp', quality=84, method=6, alpha_quality=85)
        out[name] = round(w / h, 4)
# 猫は kobito-vs-okan の切り絵を使う（同じ画風）
for n in ['cat_crouch', 'cat_leap', 'cat_swat']:
    shutil.copy(D + '/../../kobito-vs-okan/img/' + n + '.webp', OUT + n + '.webp')
    w, h = Image.open(OUT + n + '.webp').size; out[n] = round(w / h, 4)
open(D + '/../art.js', 'w').write('// art/key.py が作る。絵の 幅/高さ\nwindow.MG_ART = ' + json.dumps(out) + '\n')
print(out)
