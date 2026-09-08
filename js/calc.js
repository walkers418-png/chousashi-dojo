// 計算道場 — 測量計算の無限自動生成エンジン
// 座標系: X=北(+), Y=東(+)。方向角Tは北(X軸正方向)から時計回り。
//   X = X0 + S·cosT, Y = Y0 + S·sinT
//
// 座標表示は小数第3位(mm)まで。座標系は2モード:
//   local … 任意座標（X,Y ≒ 100 前後の扱いやすい値）
//   jgd  … 世界測地系・平面直角座標系（原点から ±数千〜数万m、符号つき）
// 幾何計算は精度確保のため必ず「ローカル枠（小さい値）」で行い、
// 表示・解答だけ base を足してワールド座標にする（大座標での桁落ちを回避）。

// 規則100条で「地積の大小にかかわらず0.01㎡未満切捨て」となる地目。
// それ以外の地目は10㎡を超えると1㎡未満切捨てになる。
const FINE_CHIMOKU = ["宅地", "鉱泉地"];
// 座標法の問題で使う地目。切捨ての桁を毎回考えさせるため両系統を混ぜる。
const AREA_CHIMOKU = ["宅地", "鉱泉地", "田", "畑", "山林", "雑種地", "原野"];

const CalcUtil = {
  ri(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },
  // 配列から1つ選ぶ
  pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  },
  // mm精度のローカル座標値（lo〜hi の整数 + 0.000〜0.999）
  rc(lo, hi) {
    return this.ri(lo, hi) + this.ri(0, 999) / 1000;
  },
  r2(v) {
    return Math.round(v * 100) / 100;
  },
  r3(v) {
    return Math.round(v * 1000) / 1000;
  },
  // 面積の中間値用。cm単位(小数第2位)の辺長どうしの積は必ず小数第4位までに収まるので、
  // ここで丸めておくと表示した数値と答えが完全に一致する（浮動小数の誤差を落とす）。
  r4(v) {
    return Math.round(v * 10000) / 10000;
  },
  f2(v) {
    return (Math.round(v * 100) / 100).toFixed(2);
  },
  f3(v) {
    return (Math.round(v * 1000) / 1000).toFixed(3);
  },
  floor2(v) {
    return Math.floor(v * 100 + 1e-9) / 100;
  },
  deg2rad(d) {
    return (d * Math.PI) / 180;
  },
  rad2deg(r) {
    return (r * 180) / Math.PI;
  },

  // ── 座標系（UIで切替・store と同期） ──
  coordMode: "local", // "local" | "jgd"
  base: [0, 0],
  newBase() {
    if (this.coordMode === "jgd") {
      // 平面直角座標系: X(北)は原点の南側で負になりやすい。Y(東)は正負どちらも。
      this.base = [
        -(this.ri(6000, 58000) + this.ri(0, 999) / 1000),
        (Math.random() < 0.5 ? 1 : -1) *
          (this.ri(2000, 42000) + this.ri(0, 999) / 1000),
      ];
    } else {
      this.base = [0, 0];
    }
    return this.base;
  },
  dispX(lx) {
    return (lx + this.base[0]).toFixed(3);
  },
  dispY(ly) {
    return (ly + this.base[1]).toFixed(3);
  },
  ansX(lx) {
    return Math.round((lx + this.base[0]) * 1000) / 1000;
  },
  ansY(ly) {
    return Math.round((ly + this.base[1]) * 1000) / 1000;
  },

  // 方向角(度) → 度分秒
  toDMS(deg) {
    deg = ((deg % 360) + 360) % 360;
    let total = Math.round(deg * 3600);
    if (total >= 360 * 3600) total -= 360 * 3600;
    return {
      d: Math.floor(total / 3600),
      m: Math.floor((total % 3600) / 60),
      s: total % 60,
    };
  },
  dmsStr(dms) {
    return `${dms.d}°${String(dms.m).padStart(2, "0")}′${String(dms.s).padStart(2, "0")}″`;
  },
  dmsToDeg(d, m, s) {
    return d + m / 60 + s / 3600;
  },

  // 2点間の方向角（度・0〜360）
  bearing(x1, y1, x2, y2) {
    let t = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
    return ((t % 360) + 360) % 360;
  },
  dist(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
  },

  // 座標法の倍面積（符号付き）
  doubleArea(pts) {
    let s = 0;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const prev = pts[(i - 1 + n) % n],
        next = pts[(i + 1) % n];
      s += pts[i][0] * (next[1] - prev[1]);
    }
    return s;
  },
};

// ───────── 交点・トラバース計算の共通関数（すべてローカル枠で動く） ─────────
// 4点指定の2直線（直線AB × 直線CD）の交点。媒介変数の連立で解く。
function lineLineIntersect(A, B, C, D) {
  const rX = B[0] - A[0],
    rY = B[1] - A[1];
  const sX = D[0] - C[0],
    sY = D[1] - C[1];
  const den = rX * sY - rY * sX; // 方向ベクトルの外積（0なら平行）
  if (Math.abs(den) < 1e-9) return null;
  const t = ((C[0] - A[0]) * sY - (C[1] - A[1]) * sX) / den;
  return [A[0] + t * rX, A[1] + t * rY];
}
// 円(中心C・半径r) と 直線(点P・方向角θ°) の交点（2個 or null）。t²+2bt+c=0 を解く。
function circleLineIntersect(C, r, P, thetaDeg) {
  const th = CalcUtil.deg2rad(thetaDeg);
  const ux = Math.cos(th),
    uy = Math.sin(th);
  const dx = P[0] - C[0],
    dy = P[1] - C[1];
  const b = dx * ux + dy * uy;
  const c = dx * dx + dy * dy - r * r;
  const disc = b * b - c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  return [
    [P[0] + (-b - sq) * ux, P[1] + (-b - sq) * uy],
    [P[0] + (-b + sq) * ux, P[1] + (-b + sq) * uy],
  ];
}
// 円(C1,r1) と 円(C2,r2) の交点（2個 or null）。距離交会。
function circleCircleIntersect(C1, r1, C2, r2) {
  const dx = C2[0] - C1[0],
    dy = C2[1] - C1[1];
  const d = Math.hypot(dx, dy);
  if (d === 0 || d > r1 + r2 || d < Math.abs(r1 - r2)) return null;
  const a = (d * d + r1 * r1 - r2 * r2) / (2 * d);
  const h2 = r1 * r1 - a * a;
  if (h2 < 0) return null;
  const h = Math.sqrt(h2);
  const ux = dx / d,
    uy = dy / d;
  const mx = C1[0] + a * ux,
    my = C1[1] + a * uy;
  return [
    [mx - h * uy, my + h * ux],
    [mx + h * uy, my - h * ux],
  ];
}
// 2点を X→Y の昇順に並べ替え（2解の順序を一意化して採点を安定させる）
function sortPts(pts) {
  return pts.slice().sort((p, q) => p[0] - q[0] || p[1] - q[1]);
}
// 方向角(度)を「whole分」に丸める（トラバースの与件を整数分にして閉合差を見せる）
function roundBearingToMin(deg) {
  let tm = Math.round((((deg % 360) + 360) % 360) * 60);
  if (tm >= 360 * 60) tm -= 360 * 60;
  return tm / 60;
}

// ── 床面積：構造から「測る線」を決める ──
// 木造は壁の厚さ・形状にかかわらず柱の中心線。鉄骨造は被覆の状態で3通りに分かれ、
// 鉄筋コンクリート造等の壁構造は壁の中心線による。区分建物の専有部分だけが内側線（内法）。
// 寸法はすべてcm単位（小数第2位）で与える。長さが2桁小数なら面積は4桁小数に収まり、
// 解説に印字した数値をそのまま追っても答えが再現できる（丸め由来の食い違いが出ない）。
function floorLineCases(U, cx, cy, col, wall) {
  const m = (v) => v.toFixed(2);
  return [
    {
      kouzou: "木造",
      yane: U.pick(["かわらぶき", "スレートぶき", "亜鉛メッキ鋼板ぶき"]),
      given: `柱の中心間の距離は <b>${m(cx)}m × ${m(cy)}m</b>、柱の見付きは <b>${m(col)}m</b>、外壁の厚さは <b>${m(wall)}m</b> である。`,
      w: cx,
      d: cy,
      line: "柱の中心線",
      why: `木造は<b>壁の厚さ又は形状にかかわらず柱の中心線</b>による。柱の中心間の距離がそのまま辺長になり、外壁の厚さ ${m(wall)}m は<b>使わない</b>（この数値が引っかけ）。`,
    },
    {
      kouzou: "鉄骨造",
      yane: "亜鉛メッキ鋼板ぶき",
      given: `柱の中心間の距離は <b>${m(cx)}m × ${m(cy)}m</b>、柱の見付きは <b>${m(col)}m</b> である。柱は<b>外側のみが被覆</b>されており、内側は露出している。`,
      w: U.r2(cx + col),
      d: U.r2(cy + col),
      line: "柱の外面を結ぶ線",
      why: `外側だけ被覆されている鉄骨造は<b>柱の外面を結ぶ線</b>による。柱の中心から外面までは見付きの半分 ${m(col / 2)}m なので、両側で ${m(col)}m 広がる。`,
    },
    {
      kouzou: "鉄骨造",
      yane: "陸屋根",
      given: `柱の中心間の距離は <b>${m(cx)}m × ${m(cy)}m</b>、柱の見付きは <b>${m(col)}m</b> である。柱は<b>両側が被覆</b>されている。`,
      w: cx,
      d: cy,
      line: "柱の中心線",
      why: `両側が被覆された鉄骨造は<b>柱の中心線</b>による（木造と同じ扱いになる）。柱の中心間の距離がそのまま辺長で、見付き ${m(col)}m は<b>使わない</b>。`,
    },
    {
      kouzou: "鉄骨造",
      yane: "陸屋根",
      given: `柱の中心間の距離は <b>${m(cx)}m × ${m(cy)}m</b>、柱の見付きは <b>${m(col)}m</b>。<b>柱の外側に厚さ ${m(wall)}m の壁</b>があり、壁の内面は柱の外面と接している。`,
      w: U.r2(cx + col + wall),
      d: U.r2(cy + col + wall),
      line: "壁の中心線",
      why: `柱の外側に壁があるときは<b>壁の中心線</b>による。柱の中心→柱の外面が ${m(col / 2)}m、そこから壁の中心まで ${m(wall / 2)}m。合わせて片側 ${m((col + wall) / 2)}m、両側で ${m(col + wall)}m 広がる。`,
    },
    {
      kouzou: "鉄筋コンクリート造",
      yane: "陸屋根",
      given: `この建物は<b>壁構造</b>である。壁の内のり寸法は <b>${m(cx)}m × ${m(cy)}m</b>、壁の厚さは一様に <b>${m(wall)}m</b> である。`,
      w: U.r2(cx + wall),
      d: U.r2(cy + wall),
      line: "壁の中心線",
      why: `鉄筋コンクリート造等の<b>壁構造は壁の中心線</b>による。内のりから壁の中心までは片側 ${m(wall / 2)}m なので、両側で ${m(wall)}m 広がる。`,
    },
  ];
}

// 床面積に算入しない付属物（準則82条・先例）。求積には影響しないが、
// 与件に混ぜて「引いてはいけないものを引く／足してはいけないものを足す」誤りを誘う。
const FLOOR_FUSANNYU = [
  {
    text: (U) =>
      `1階には、屋根及び手すりが設置された<b>屋外の階段</b>（${(U.ri(90, 140) / 100).toFixed(2)}m × ${(U.ri(240, 360) / 100).toFixed(2)}m）が接続している。`,
    why: "建物に附属する<b>屋外の階段</b>は、屋根及び手すりが設置されていても床面積に<b>算入しない</b>。",
  },
  {
    text: (U) =>
      `2階の外壁には、下部が床面と同一の高さにない<b>出窓</b>（${(U.ri(160, 240) / 100).toFixed(2)}m × ${(U.ri(40, 60) / 100).toFixed(2)}m）がある。`,
    why: "<b>出窓</b>は、その下部が床面と同一の高さにないものは床面積に<b>算入しない</b>。",
  },
  {
    text: (U) =>
      `2階には、外側に<b>開放されたベランダ</b>（${(U.ri(150, 220) / 100).toFixed(2)}m × ${(U.ri(300, 450) / 100).toFixed(2)}m）が付属している。`,
    why: "外側に<b>開放されたベランダ</b>は床面積に<b>算入しない</b>。",
  },
];

// 一般の建物（木造・鉄骨造・RC壁構造）の2階建て。各階ごとに切り捨てて合計する。
function floorIppanProblem(U) {
  const cx = U.ri(800, 1400) / 100; // 柱の中心間または内のり（間口）
  const cy = U.ri(600, 1100) / 100; // 同（奥行）
  const col = U.pick([0.2, 0.25, 0.3, 0.4]); // 柱の見付き
  const wall = U.pick([0.12, 0.15, 0.18, 0.2]); // 壁の厚さ
  const c = U.pick(floorLineCases(U, cx, cy, col, wall));

  // 2階には吹抜けがあり、その分だけ2階の床面積が小さくなる
  const vw = U.ri(160, 300) / 100;
  const vd = U.ri(160, 300) / 100;
  const voidArea = U.r4(vw * vd);

  const fu = U.pick(FLOOR_FUSANNYU);
  const base = U.r4(c.w * c.d);
  const raw2 = U.r4(base - voidArea);
  const a1 = U.floor2(base);
  const a2 = U.floor2(raw2);
  const total = U.r2(a1 + a2);

  return {
    html: `<p><b>${c.kouzou}${c.yane}2階建て</b>の建物について、次の与件から各階の床面積及びその合計を求めよ。</p>
<p>${c.given}1階・2階の外周は同一で、各階とも<b>階段室</b>を含む。</p>
<p>2階の内部に <b>${vw.toFixed(2)}m × ${vd.toFixed(2)}m の吹抜け</b>がある。${fu.text(U)}</p>`,
    fields: [
      { label: "1階の床面積（㎡）", kind: "num", answer: a1, tol: 0.001 },
      { label: "2階の床面積（㎡）", kind: "num", answer: a2, tol: 0.001 },
      { label: "床面積の合計（㎡）", kind: "num", answer: total, tol: 0.001 },
    ],
    solution: `<p><b>① どの線で測るか ⟹ ${c.line}</b></p>
<p>${c.why}</p>
<p>辺長 <b>${c.w.toFixed(2)}m × ${c.d.toFixed(2)}m</b>　＝　${base.toFixed(4)}㎡</p>
<hr class="sep">
<p><b>② 算入・不算入</b></p>
<p>・<b>吹抜け</b>は上階の床面積に<b>算入しない</b> ⟹ 2階から ${vw.toFixed(2)}×${vd.toFixed(2)}＝<b>${voidArea.toFixed(4)}㎡</b> を控除<br>
・${fu.why} ⟹ <b>加算しない</b><br>
・<b>階段室は各階の床面積に算入する</b> ⟹ 外周の内側にあるのでそのまま</p>
<hr class="sep">
<p><b>③ 各階ごとに1/100㎡未満を切り捨てる（規則115条）</b></p>
<p>1階　${base.toFixed(4)}㎡ ⟹ <b>${a1.toFixed(2)}㎡</b><br>
2階　${base.toFixed(4)}－${voidArea.toFixed(4)}＝${raw2.toFixed(4)}㎡ ⟹ <b>${a2.toFixed(2)}㎡</b></p>
<hr class="sep">
<p><b>④ 合計</b>　${a1.toFixed(2)}＋${a2.toFixed(2)}＝<b>${total.toFixed(2)}㎡</b></p>
<p class="muted small">登記記録は<b>各階ごとに</b>床面積を記録する。だから端数処理も<b>階ごと</b>に行い、その後で合計する。先に合計してから切り捨てると答えが変わることがある。</p>
<p class="muted small"><b>構造別のまとめ</b>：木造＝柱の中心線／鉄骨造は<b>外側被覆＝柱の外面を結ぶ線・両側被覆＝柱の中心線・柱の外側に壁＝壁の中心線</b>／鉄筋コンクリート造等の壁構造＝壁の中心線。区分建物の専有部分だけが<b>内側線（内法）</b>。</p>`,
  };
}

// 区分建物。規則115条の本文（区画の中心線）とかっこ書（専有部分は内側線）を1問で対比させる。
function floorKubunProblem(U) {
  const w = U.ri(1400, 2200) / 100; // 一棟の建物の壁芯（間口）
  const d = U.ri(800, 1300) / 100; // 同（奥行）
  const t = U.pick([0.15, 0.18, 0.2, 0.25]); // 壁の厚さ
  const uw = U.r2(w / 2 - U.ri(30, 90) / 100); // 専有部分の壁芯（間口）
  const ud = U.r2(d - U.ri(50, 150) / 100); // 同（奥行）
  const iw = U.r2(uw - t);
  const id2 = U.r2(ud - t);

  const ittou = U.r4(w * d);
  const senyu = U.r4(iw * id2);
  const a1 = U.floor2(ittou);
  const a2 = U.floor2(senyu);

  return {
    html: `<p>鉄筋コンクリート造陸屋根3階建ての<b>一棟の建物</b>がある。その1階部分は、壁その他の区画の<b>中心線</b>で囲むと <b>${w.toFixed(2)}m × ${d.toFixed(2)}m</b> の長方形である。</p>
<p>この1階には区分建物である <b>101号室</b> があり、その周囲の壁の<b>中心線</b>で囲まれた部分は <b>${uw.toFixed(2)}m × ${ud.toFixed(2)}m</b>、壁の厚さは一様に <b>${t.toFixed(2)}m</b> である。</p>
<p>次の2つの床面積を求めよ。</p>`,
    fields: [
      {
        label: "一棟の建物の1階の床面積（㎡）",
        kind: "num",
        answer: a1,
        tol: 0.001,
      },
      { label: "101号室の床面積（㎡）", kind: "num", answer: a2, tol: 0.001 },
    ],
    solution: `<p><b>① どの線で測るか</b></p>
<p>・<b>一棟の建物</b>＝原則どおり<b>区画の中心線</b>（壁芯）<br>
・<b>専有部分</b>＝<b>区画の内側線</b>（内法。規則115条かっこ書）</p>
<hr class="sep">
<p><b>② 一棟の建物の1階</b></p>
<p>${w.toFixed(2)}×${d.toFixed(2)}＝${ittou.toFixed(4)}㎡ ⟹ 1/100㎡未満切捨て ⟹ <b>${a1.toFixed(2)}㎡</b></p>
<hr class="sep">
<p><b>③ 101号室（専有部分）</b></p>
<p>壁芯から内側へ片側 ${(t / 2).toFixed(3)}m ずつ、両側で ${t.toFixed(2)}m 小さくなる。</p>
<p>内法寸法　${uw.toFixed(2)}－${t.toFixed(2)}＝<b>${iw.toFixed(2)}m</b>　／　${ud.toFixed(2)}－${t.toFixed(2)}＝<b>${id2.toFixed(2)}m</b></p>
<p>${iw.toFixed(2)}×${id2.toFixed(2)}＝${senyu.toFixed(4)}㎡ ⟹ 1/100㎡未満切捨て ⟹ <b>${a2.toFixed(2)}㎡</b></p>
<p class="muted small">同じ建物でも<b>一棟は壁芯・専有部分は内法</b>で、専有部分は壁の厚みのぶん小さく出る。共用部分の持分は、規約に別段の定めがない限りこの<b>専有部分の床面積の割合</b>による。</p>`,
  };
}

const CalcGen = {
  // ① 距離と方向角
  dist: {
    name: "距離・方向角の計算",
    desc: "2点の座標から距離と方向角を求める（atanの象限判断）",
    group: "基礎計算",
    gen() {
      const U = CalcUtil;
      U.newBase();
      const x1 = U.rc(80, 120),
        y1 = U.rc(80, 120);
      let dx = 0,
        dy = 0;
      while (Math.abs(dx) < 3 || Math.abs(dy) < 3) {
        dx = U.rc(-25, 25);
        dy = U.rc(-25, 25);
      }
      const x2 = x1 + dx,
        y2 = y1 + dy;
      const S = U.dist(x1, y1, x2, y2);
      const T = U.bearing(x1, y1, x2, y2);
      const dms = U.toDMS(T);
      return {
        html: `<p>点A(X=${U.dispX(x1)}, Y=${U.dispY(y1)})、点B(X=${U.dispX(x2)}, Y=${U.dispY(y2)}) のとき、AからBへの<b>距離S</b>と<b>方向角T</b>を求めよ。</p>`,
        fields: [
          {
            label: "距離 S (m・小数第3位)",
            kind: "num",
            answer: U.r3(S),
            tol: 0.01,
          },
          { label: "方向角 T", kind: "dms", answer: dms, tolSec: 2 },
        ],
        solution: `<p>ΔX=${U.f3(dx)}, ΔY=${U.f3(dy)}（差は座標系に依らない）</p>
<div class="formula">${mathml("S ＝ \\sqrt{ΔX^{2} ＋ ΔY^{2}}", true)}<p style="text-align:center;margin:0">＝ <b>${U.f3(S)}m</b></p>${mathml("T ＝ tan^{-1}\\frac{ΔY}{ΔX}", true)}</div>
<p>Tを象限補正（ΔX${dx > 0 ? ">0" : "<0"}・ΔY${dy > 0 ? ">0" : "<0"} ⟹ 第${dx > 0 ? (dy > 0 ? "1" : "4") : dy > 0 ? "2" : "3"}象限）⟹ <b>${U.dmsStr(dms)}</b></p>
<p class="muted small">電卓: <b>Pol(ΔX, ΔY)</b> ⟹ RCL X=距離・RCL Y=方向角 を一発（θが負なら＋360°）。複素数モードなら (ΔX＋ΔYi) を極形式。差で計算するので世界測地系でも桁は気にしない。</p>`,
      };
    },
  },

  // ② 放射計算
  radiate: {
    name: "放射計算（新点座標）",
    desc: "既知点＋方向角＋距離から新点の座標を求める",
    group: "基礎計算",
    gen() {
      const U = CalcUtil;
      U.newBase();
      const x0 = U.rc(90, 130),
        y0 = U.rc(90, 130);
      const d = U.ri(0, 359),
        m = U.ri(0, 59);
      const T = U.dmsToDeg(d, m, 0);
      const S = U.ri(5000, 40000) / 1000;
      const x = x0 + S * Math.cos(U.deg2rad(T));
      const y = y0 + S * Math.sin(U.deg2rad(T));
      return {
        html: `<p>既知点A(X=${U.dispX(x0)}, Y=${U.dispY(y0)}) から、方向角 <b>${d}°${String(m).padStart(2, "0")}′00″</b>、距離 <b>${S.toFixed(3)}m</b> の新点Pの座標を求めよ（小数第3位）。</p>`,
        fields: [
          { label: "PのX座標", kind: "num", answer: U.ansX(x), tol: 0.01 },
          { label: "PのY座標", kind: "num", answer: U.ansY(y), tol: 0.01 },
        ],
        solution: `<p>X=X₀+S·cosT=${U.dispX(x0)}+${S.toFixed(3)}×cos${d}°${String(m).padStart(2, "0")}′=<b>${U.dispX(x)}</b></p>
<p>Y=Y₀+S·sinT=${U.dispY(y0)}+${S.toFixed(3)}×sin${d}°${String(m).padStart(2, "0")}′=<b>${U.dispY(y)}</b></p>
<p class="muted small">電卓: <b>Rec(S, T)</b> ⟹ RCL X=ΔX・RCL Y=ΔY を起点に加算。複素数モードなら 起点＋S∠T。</p>`,
      };
    },
  },

  // ③ 交点計算（2直線・点＋方向角）
  intersect: {
    name: "交点計算（2直線の交点）",
    desc: "記述式（土地）の核心。点＋方向角で定まる2直線の交点",
    group: "交点計算",
    gen() {
      const U = CalcUtil;
      U.newBase();
      const ix = U.rc(95, 125),
        iy = U.rc(95, 125);
      const d1 = U.ri(0, 35) * 10,
        dd = U.ri(4, 14) * 10;
      const d2 = (d1 + dd) % 360;
      const t1 = U.deg2rad(d1),
        t2 = U.deg2rad(d2);
      const s1 = U.ri(8000, 30000) / 1000,
        s2 = U.ri(8000, 30000) / 1000;
      const ax = U.r3(ix - s1 * Math.cos(t1)),
        ay = U.r3(iy - s1 * Math.sin(t1));
      const bx = U.r3(ix - s2 * Math.cos(t2)),
        by = U.r3(iy - s2 * Math.sin(t2));
      const det = Math.cos(t1) * Math.sin(t2) - Math.sin(t1) * Math.cos(t2);
      const a = ((bx - ax) * Math.sin(t2) - (by - ay) * Math.cos(t2)) / det;
      const px = ax + a * Math.cos(t1),
        py = ay + a * Math.sin(t1);
      // 複素数法の表示用: A→Bの距離 S_AB と方向角 T_AB
      const sab = Math.hypot(bx - ax, by - ay);
      const tab =
        ((((Math.atan2(by - ay, bx - ax) * 180) / Math.PI) % 360) + 360) % 360;
      return {
        html: `<p>点A(X=${U.dispX(ax)}, Y=${U.dispY(ay)}) を通り方向角 <b>${d1}°00′00″</b> の直線と、点B(X=${U.dispX(bx)}, Y=${U.dispY(by)}) を通り方向角 <b>${d2}°00′00″</b> の直線との交点Pの座標を求めよ（小数第3位）。</p>`,
        fields: [
          { label: "PのX座標", kind: "num", answer: U.ansX(px), tol: 0.02 },
          { label: "PのY座標", kind: "num", answer: U.ansY(py), tol: 0.02 },
        ],
        solution: `<p><b>【連立方程式（媒介変数）法】</b></p>
<p>直線1上の点＝A＋a∠T<sub>A</sub>、直線2上の点＝B＋b∠T<sub>B</sub> が一致するとして連立（a,bは各点からの距離）:</p>
<p class="formula">X<sub>A</sub>＋a·cosT<sub>A</sub> ＝ X<sub>B</sub>＋b·cosT<sub>B</sub><br>Y<sub>A</sub>＋a·sinT<sub>A</sub> ＝ Y<sub>B</sub>＋b·sinT<sub>B</sub></p>
<p>a について解く（クラメルの公式）:</p>
<div class="formula">${mathml("a ＝ \\frac{\\paren{Y_{B}−Y_{A}}cosT_{B} − \\paren{X_{B}−X_{A}}sinT_{B}}{sin\\paren{T_{A}−T_{B}}}", true)}<p style="text-align:center;margin:0">＝ <b>${a.toFixed(3)}m</b></p></div>
<p>P ＝ A＋a∠T<sub>A</sub> ⟹ X=<b>${U.dispX(px)}</b>、Y=<b>${U.dispY(py)}</b></p>
<hr class="sep">
<p><b>【複素数（fx-JP500）法】</b> 点を A＝X<sub>A</sub>＋Y<sub>A</sub>i、B＝X<sub>B</sub>＋Y<sub>B</sub>i で表す（<b>実部=X(北)・虚部=Y(東)・∠=方向角</b>）。</p>
<p>① (B−A) を <b>►r∠θ</b> で極形式に ⟹ S<sub>AB</sub>＝<b>${sab.toFixed(3)}m</b> ∠ T<sub>AB</sub>＝<b>${tab.toFixed(4)}°</b></p>
<p>② 正弦定理より AP（＝a）を求める:</p>
<p class="formula">AP ＝ S<sub>AB</sub>·sin(T<sub>AB</sub>−T<sub>B</sub>) ÷ sin(T<sub>A</sub>−T<sub>B</sub>) ＝ <b>${a.toFixed(3)}m</b></p>
<p>③ P ＝ A＋AP∠T<sub>A</sub> を <b>►a+bi</b> で直交形式に ⟹ X=<b>${U.dispX(px)}</b>、Y=<b>${U.dispY(py)}</b></p>
<p class="muted small">2法は同じ a（AP）に帰着する（連立で出た式に X<sub>B</sub>−X<sub>A</sub>=S<sub>AB</sub>cosT<sub>AB</sub>・Y<sub>B</sub>−Y<sub>A</sub>=S<sub>AB</sub>sinT<sub>AB</sub> を代入すると複素数法の式になる）。検算: Bから方向角${d2}°の直線にPが乗るか確認。</p>`,
      };
    },
  },

  // ③-2 内分点
  internal: {
    name: "内分点の計算（分割点C）",
    desc: "線分ABを距離または比で内分する点を求める（分筆の基礎）",
    group: "内外分点・トラバース",
    gen() {
      const U = CalcUtil;
      U.newBase();
      const ax = U.rc(90, 120),
        ay = U.rc(90, 120);
      let dx = 0,
        dy = 0;
      while (Math.hypot(dx, dy) < 18) {
        dx = U.rc(-45, 45);
        dy = U.rc(-45, 45);
      }
      const bx = ax + dx,
        by = ay + dy;
      const L = U.dist(ax, ay, bx, by);
      const byRatio = Math.random() < 0.5;
      if (byRatio) {
        const m = U.ri(1, 4),
          n = U.ri(1, 4);
        const cx = (n * ax + m * bx) / (m + n);
        const cy = (n * ay + m * by) / (m + n);
        return {
          html: `<p>線分AB〔A(X=${U.dispX(ax)}, Y=${U.dispY(ay)})、B(X=${U.dispX(bx)}, Y=${U.dispY(by)})〕を <b>AC:CB＝${m}:${n}</b> に内分する点Cの座標を求めよ（小数第3位）。</p>`,
          fields: [
            { label: "CのX座標", kind: "num", answer: U.ansX(cx), tol: 0.01 },
            { label: "CのY座標", kind: "num", answer: U.ansY(cy), tol: 0.01 },
          ],
          solution: `<p>内分点公式（Bに比m、Aに比nを掛ける“たすき掛け”）</p>
<p>X<sub>C</sub>＝(n·X<sub>A</sub>＋m·X<sub>B</sub>)/(m＋n)＝<b>${U.dispX(cx)}</b></p>
<p>Y<sub>C</sub>＝(n·Y<sub>A</sub>＋m·Y<sub>B</sub>)/(m＋n)＝<b>${U.dispY(cy)}</b></p>
<p class="muted small">複素数モード: (${n}×A＋${m}×B)÷${m + n}。詳しくは「計算手法ガイド」へ。</p>`,
        };
      }
      const Lc = U.r3(L * (U.ri(250, 750) / 1000));
      const k = Lc / L;
      const cx = ax + k * dx,
        cy = ay + k * dy;
      return {
        html: `<p>点A(X=${U.dispX(ax)}, Y=${U.dispY(ay)})から点B(X=${U.dispX(bx)}, Y=${U.dispY(by)})へ向かう線分上で、Aから距離 <b>${Lc.toFixed(3)}m</b> の点Cの座標を求めよ（小数第3位）。</p>`,
        fields: [
          { label: "CのX座標", kind: "num", answer: U.ansX(cx), tol: 0.02 },
          { label: "CのY座標", kind: "num", answer: U.ansY(cy), tol: 0.02 },
        ],
        solution: `<div class="formula">${mathml("\\abs{AB} ＝ \\sqrt{ΔX^{2} ＋ ΔY^{2}}", true)}<p style="text-align:center;margin:0">＝ ${L.toFixed(4)}m</p>${mathml("k ＝ \\frac{AC}{\\abs{AB}}", true)}<p style="text-align:center;margin:0">＝ ${k.toFixed(5)}</p></div>
<p>X<sub>C</sub>＝X<sub>A</sub>＋k·ΔX＝<b>${U.dispX(cx)}</b>、Y<sub>C</sub>＝Y<sub>A</sub>＋k·ΔY＝<b>${U.dispY(cy)}</b></p>
<p class="muted small">複素数モード: A＋(${Lc.toFixed(3)}÷|B−A|)×(B−A)。</p>`,
      };
    },
  },

  // ④ 座標法による面積
  area: {
    name: "座標法による面積計算",
    desc: "倍面積 → 面積 → 地積（規則100条の端数処理）",
    group: "求積・面積",
    gen() {
      const U = CalcUtil;
      U.newBase();
      const cx = U.rc(95, 115),
        cy = U.rc(95, 115);
      const angs = [
        U.ri(10, 60),
        U.ri(100, 150),
        U.ri(190, 240),
        U.ri(280, 330),
      ];
      const pts = angs.map((ang) => {
        const r = U.ri(7000, 15000) / 1000;
        return [
          U.r3(cx + r * Math.cos(U.deg2rad(ang))),
          U.r3(cy + r * Math.sin(U.deg2rad(ang))),
        ];
      });
      const names = ["A", "B", "C", "D"];
      const dbl = Math.abs(U.doubleArea(pts)); // ローカル枠で計算（桁落ちなし）
      const ar = dbl / 2;
      // 規則100条は地目で切捨ての桁が変わる。宅地・鉱泉地は常に0.01㎡未満切捨て、
      // それ以外は10㎡超なら1㎡未満切捨て。本試験の最大の失点源なので地目も毎回変える。
      const chimoku = U.pick(AREA_CHIMOKU);
      const isFine = FINE_CHIMOKU.indexOf(chimoku) >= 0;
      const coarse = !isFine && ar > 10;
      const chiseki = coarse
        ? Math.floor(+ar.toFixed(6))
        : Math.floor(+(ar * 100).toFixed(4)) / 100;
      const rows = pts
        .map(
          (p, i) =>
            `<tr><td>${names[i]}</td><td class="num">${U.dispX(p[0])}</td><td class="num">${U.dispY(p[1])}</td></tr>`,
        )
        .join("");
      const calcRows = pts
        .map((p, i) => {
          const prev = pts[(i + 3) % 4],
            next = pts[(i + 1) % 4];
          return `${names[i]}: X×(Y<sub>次</sub>−Y<sub>前</sub>)=${(p[0] * (next[1] - prev[1])).toFixed(4)}`;
        })
        .join("<br>");
      return {
        html: `<p>筆界点A・B・C・Dで囲まれた土地（地目 <b>${chimoku}</b>）の<b>面積</b>と<b>登記すべき地積</b>を求めよ。</p>
<table class="simple"><tr><th>点</th><th>X座標(m)</th><th>Y座標(m)</th></tr>${rows}</table>`,
        fields: [
          {
            label: "面積（㎡・小数第2位）",
            kind: "num",
            answer: U.r2(ar),
            tol: 0.02,
          },
          {
            label: "登記すべき地積（㎡）",
            kind: "num",
            answer: chiseki,
            tol: 0.001,
          },
        ],
        solution: `<div class="formula">${mathml("2S ＝ Σ X_{i}\\paren{Y_{i+1} − Y_{i−1}}", true)}</div><p class="muted small">座標差の式なので、世界測地系の大きな座標でも値は変わらない。</p><p class="mono small">${calcRows}</p>
<p>倍面積＝${dbl.toFixed(4)} ⟹ 面積＝<b>${U.f2(ar)}㎡</b></p>
<p>地積（規則100条）: ${
          isFine
            ? `<b>${chimoku}</b>は地積の大小にかかわらず<b>0.01㎡未満を切捨て</b>`
            : coarse
              ? `<b>${chimoku}</b>で10㎡超 ⟹ <b>1㎡未満を切捨て</b>（宅地・鉱泉地なら0.01㎡未満切捨てになる点に注意）`
              : `<b>${chimoku}</b>だが10㎡以下 ⟹ <b>0.01㎡未満を切捨て</b>`
        } ⟹ <b>${coarse ? chiseki : chiseki.toFixed(2)}㎡</b></p>`,
      };
    },
  },

  // ⑤ 床面積（座標系の影響なし＝建物寸法）
  // 建物の床面積を1問に統合する。本試験の記述式と同じ順で
  //   ① 構造から「どの線で測るか」を決める
  //   ② 算入・不算入を判断する
  //   ③ 各階ごとに規則115条で切り捨てる
  //   ④ 合計する
  // を通しで問う。どこか1つを外すと以降が全部ずれる構造にしてある。
  floor: {
    name: "床面積の計算（構造判断→算入不算入→端数処理）",
    desc: "測る線を構造から決め、吹抜け等を除き、各階ごとに規則115条で切り捨てて合計する",
    group: "求積・面積",
    gen() {
      const U = CalcUtil;
      return Math.random() < 0.35 ? floorKubunProblem(U) : floorIppanProblem(U);
    },
  },

  // ⑥ 4点指定の2直線交点
  intersect4: {
    name: "交点計算（4点指定の2直線）",
    desc: "直線ABと直線CDの交点。分筆線×筆界線で多用",
    group: "交点計算",
    gen() {
      const U = CalcUtil;
      U.newBase();
      const ix = U.rc(100, 140),
        iy = U.rc(100, 140);
      const d1 = U.ri(0, 16) * 10;
      const d2 = (d1 + U.ri(4, 14) * 10) % 360;
      const t1 = U.deg2rad(d1),
        t2 = U.deg2rad(d2);
      const A = [
        U.r3(ix - U.rc(8, 22) * Math.cos(t1)),
        U.r3(iy - U.rc(8, 22) * Math.sin(t1)),
      ];
      const B = [
        U.r3(ix + U.rc(8, 22) * Math.cos(t1)),
        U.r3(iy + U.rc(8, 22) * Math.sin(t1)),
      ];
      const C = [
        U.r3(ix - U.rc(8, 22) * Math.cos(t2)),
        U.r3(iy - U.rc(8, 22) * Math.sin(t2)),
      ];
      const D = [
        U.r3(ix + U.rc(8, 22) * Math.cos(t2)),
        U.r3(iy + U.rc(8, 22) * Math.sin(t2)),
      ];
      const P = lineLineIntersect(A, B, C, D);
      return {
        html: `<p>筆界点の座標が下表のとき、<b>直線ABと直線CDの交点P</b>を求めよ（小数第3位）。</p>
<table class="simple"><tr><th>点</th><th>X(北)</th><th>Y(東)</th></tr>
<tr><td>A</td><td class="num">${U.dispX(A[0])}</td><td class="num">${U.dispY(A[1])}</td></tr>
<tr><td>B</td><td class="num">${U.dispX(B[0])}</td><td class="num">${U.dispY(B[1])}</td></tr>
<tr><td>C</td><td class="num">${U.dispX(C[0])}</td><td class="num">${U.dispY(C[1])}</td></tr>
<tr><td>D</td><td class="num">${U.dispX(D[0])}</td><td class="num">${U.dispY(D[1])}</td></tr></table>`,
        fields: [
          { label: "PのX座標", kind: "num", answer: U.ansX(P[0]), tol: 0.02 },
          { label: "PのY座標", kind: "num", answer: U.ansY(P[1]), tol: 0.02 },
        ],
        solution: `<p><b>【外積法】</b>方向ベクトル r＝B−A、s＝D−C（×は外積）。</p>
<div class="formula">${mathml("t ＝ \\frac{\\paren{C−A}×s}{r×s}", true)}${mathml("P ＝ A ＋ t·r", true)}</div>
<hr class="sep">
<p><b>【複素数法（fx-JP500）】</b> 各点を複素数で電卓の <b>A〜D に STO</b>（実部=X北・虚部=Y東）。</p>
<div class="formula">${mathml("t ＝ \\frac{Im\\paren{\\frac{C−A}{D−C}}}{Im\\paren{\\frac{B−A}{D−C}}}", true)}${mathml("P ＝ A ＋ \\paren{B−A}×t", true)}</div>
<p class="muted small">複素数の割り算（分数）の<b>虚部</b>どうしの比で t が出る（＝「分数の分数」）。P を = すると直交 X,Y で読める。</p>
<p>⟹ <b>P(${U.dispX(P[0])}, ${U.dispY(P[1])})</b></p>`,
      };
    },
  },

  // ⑦ 円と直線
  circleLine: {
    name: "交点計算（円と直線）",
    desc: "中心・半径の円に、点を通る方向角の直線が交わる2点",
    group: "交点計算",
    gen() {
      const U = CalcUtil;
      U.newBase();
      const C = [U.rc(100, 130), U.rc(100, 130)];
      const r = U.ri(8000, 18000) / 1000;
      const a1 = U.ri(0, 359),
        a2 = (a1 + U.ri(40, 140)) % 360;
      const K1 = [
        C[0] + r * Math.cos(U.deg2rad(a1)),
        C[1] + r * Math.sin(U.deg2rad(a1)),
      ];
      const K2 = [
        C[0] + r * Math.cos(U.deg2rad(a2)),
        C[1] + r * Math.sin(U.deg2rad(a2)),
      ];
      const Tline = U.bearing(K1[0], K1[1], K2[0], K2[1]);
      const back = U.ri(3000, 9000) / 1000;
      const P = [
        U.r3(K1[0] - back * Math.cos(U.deg2rad(Tline))),
        U.r3(K1[1] - back * Math.sin(U.deg2rad(Tline))),
      ];
      const dms = U.toDMS(Tline);
      const theta = U.dmsToDeg(dms.d, dms.m, dms.s);
      const rG = U.r3(r);
      const sol = sortPts(circleLineIntersect(C, rG, P, theta));
      return {
        html: `<p>中心 <b>O(${U.dispX(C[0])}, ${U.dispY(C[1])})</b>・半径 <b>${rG.toFixed(3)}m</b> の円と、点 <b>P(${U.dispX(P[0])}, ${U.dispY(P[1])})</b> を通り方向角 <b>${U.dmsStr(dms)}</b> の直線との交点を求めよ。2交点のうち <b>X座標が小さい方を①</b> とする（小数第3位）。</p>`,
        fields: [
          {
            label: "交点①のX",
            kind: "num",
            answer: U.ansX(sol[0][0]),
            tol: 0.03,
          },
          {
            label: "交点①のY",
            kind: "num",
            answer: U.ansY(sol[0][1]),
            tol: 0.03,
          },
          {
            label: "交点②のX",
            kind: "num",
            answer: U.ansX(sol[1][0]),
            tol: 0.03,
          },
          {
            label: "交点②のY",
            kind: "num",
            answer: U.ansY(sol[1][1]),
            tol: 0.03,
          },
        ],
        solution: `<p>直線を P＋t·(cosθ, sinθ) と置いて円の式へ代入すると、t の2次方程式になる。</p>
<div class="formula">${mathml("t^{2} ＋ 2bt ＋ c ＝ 0", true)}<p class="muted small" style="text-align:center;margin:2px 0 6px">b ＝ (Pₓ−Oₓ)cosθ ＋ (P_y−O_y)sinθ　　c ＝ (Pₓ−Oₓ)² ＋ (P_y−O_y)² − r²</p>${mathml("t ＝ −b ± \\sqrt{b^{2} − c}", true)}</div>
<p>⟹ <b>①(${U.dispX(sol[0][0])}, ${U.dispY(sol[0][1])})・②(${U.dispX(sol[1][0])}, ${U.dispY(sol[1][1])})</b></p>
<p class="muted small">判別式が負なら交わらない、0なら接する。</p>`,
      };
    },
  },

  // ⑧ 円と円（距離交会）
  circleCircle: {
    name: "交点計算（円と円・距離交会）",
    desc: "既知点A・Bからの距離a・bで新点を定める",
    group: "交点計算",
    gen() {
      const U = CalcUtil;
      U.newBase();
      const A = [U.rc(95, 120), U.rc(95, 120)];
      const baseAng = U.deg2rad(U.ri(0, 359));
      const dAB = U.ri(16000, 26000) / 1000;
      const B = [
        A[0] + dAB * Math.cos(baseAng),
        A[1] + dAB * Math.sin(baseAng),
      ];
      const M = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
      const ux = (B[0] - A[0]) / dAB,
        uy = (B[1] - A[1]) / dAB;
      const off = (U.ri(8000, 15000) / 1000) * (Math.random() < 0.5 ? 1 : -1);
      const along = U.ri(-4000, 4000) / 1000;
      const T = [M[0] + along * ux - off * uy, M[1] + along * uy + off * ux];
      const r1 = U.r3(U.dist(A[0], A[1], T[0], T[1]));
      const r2 = U.r3(U.dist(B[0], B[1], T[0], T[1]));
      const sol = sortPts(circleCircleIntersect(A, r1, B, r2));
      return {
        html: `<p>既知点 <b>A(${U.dispX(A[0])}, ${U.dispY(A[1])})</b> から距離 <b>${r1.toFixed(3)}m</b>、既知点 <b>B(${U.dispX(B[0])}, ${U.dispY(B[1])})</b> から距離 <b>${r2.toFixed(3)}m</b> にある新点を求めよ（距離交会）。2解のうち <b>X座標が小さい方を①</b>（小数第3位）。</p>`,
        fields: [
          {
            label: "①のX座標",
            kind: "num",
            answer: U.ansX(sol[0][0]),
            tol: 0.03,
          },
          {
            label: "①のY座標",
            kind: "num",
            answer: U.ansY(sol[0][1]),
            tol: 0.03,
          },
          {
            label: "②のX座標",
            kind: "num",
            answer: U.ansX(sol[1][0]),
            tol: 0.03,
          },
          {
            label: "②のY座標",
            kind: "num",
            answer: U.ansY(sol[1][1]),
            tol: 0.03,
          },
        ],
        solution: `<p>AB間距離を d として、Aから垂線の足Mまでの距離 a と高さ h を出す。</p>
<div class="formula">${mathml("a ＝ \\frac{d^{2} ＋ r_{1}^{2} − r_{2}^{2}}{2d}", true)}${mathml("h ＝ \\sqrt{r_{1}^{2} − a^{2}}", true)}</div>
<p>足M＝A＋a·(AB単位ベクトル)、交点＝M±h·(ABに直交する単位ベクトル)。</p>
<p>⟹ <b>①(${U.dispX(sol[0][0])}, ${U.dispY(sol[0][1])})・②(${U.dispX(sol[1][0])}, ${U.dispY(sol[1][1])})</b>（基線の両側）</p>
<p class="muted small">境界点復元・TS距離観測で頻出。</p>`,
      };
    },
  },

  // ⑨ 垂線の足
  perpFoot: {
    name: "垂線の足・点と直線の距離",
    desc: "点Qから直線へ下ろした垂線の足Fと距離",
    group: "交点計算",
    gen() {
      const U = CalcUtil;
      U.newBase();
      const A = [U.rc(100, 120), U.rc(100, 120)];
      const theta = U.ri(5, 175);
      const dx = Math.cos(U.deg2rad(theta)),
        dy = Math.sin(U.deg2rad(theta));
      const footT = U.ri(6000, 26000) / 1000;
      const F0 = [A[0] + footT * dx, A[1] + footT * dy];
      const off = (U.ri(5000, 15000) / 1000) * (Math.random() < 0.5 ? 1 : -1);
      const Q = [U.r3(F0[0] - off * dy), U.r3(F0[1] + off * dx)];
      const proj = (Q[0] - A[0]) * dx + (Q[1] - A[1]) * dy;
      const F = [A[0] + proj * dx, A[1] + proj * dy];
      const dist = Math.hypot(Q[0] - F[0], Q[1] - F[1]);
      return {
        html: `<p>点 <b>A(${U.dispX(A[0])}, ${U.dispY(A[1])})</b> を通り方向角 <b>${theta}°00′00″</b> の直線に対し、点 <b>Q(${U.dispX(Q[0])}, ${U.dispY(Q[1])})</b> から下ろした垂線の足Fの座標と、QF間の距離を求めよ（小数第3位）。</p>`,
        fields: [
          { label: "FのX座標", kind: "num", answer: U.ansX(F[0]), tol: 0.02 },
          { label: "FのY座標", kind: "num", answer: U.ansY(F[1]), tol: 0.02 },
          { label: "距離 QF (m)", kind: "num", answer: U.r3(dist), tol: 0.02 },
        ],
        solution: `<p>直線方向の単位ベクトル u＝(cosθ, sinθ)。射影長 <b>p＝(Q−A)·u</b>＝${proj.toFixed(3)} ⟹ F＝A＋p·u＝<b>(${U.dispX(F[0])}, ${U.dispY(F[1])})</b></p>
<p>距離 QF＝|Q−F|＝<b>${U.f3(dist)}m</b></p>
<p class="muted small">電卓: <b>Pol(ΔX, ΔY)</b> で|AQ|と方位角を出し、直線方向角との差ψを作れば 射影＝|AQ|cosψ、離れ＝|AQ|sinψ。境界線からのオフセット・求積の高さ算出に使う。</p>`,
      };
    },
  },

  // ⑩ 外分点
  external: {
    name: "外分点の計算",
    desc: "線分ABをm:nに外分する点（内分点と対）",
    group: "内外分点・トラバース",
    gen() {
      const U = CalcUtil;
      U.newBase();
      const A = [U.rc(95, 120), U.rc(95, 120)];
      let dx = 0,
        dy = 0;
      while (Math.hypot(dx, dy) < 18) {
        dx = U.rc(-40, 40);
        dy = U.rc(-40, 40);
      }
      const B = [A[0] + dx, A[1] + dy];
      let m = U.ri(2, 5),
        n = U.ri(1, 4);
      while (m === n) {
        m = U.ri(2, 5);
        n = U.ri(1, 4);
      }
      const cx = (m * B[0] - n * A[0]) / (m - n);
      const cy = (m * B[1] - n * A[1]) / (m - n);
      return {
        html: `<p>線分AB〔A(X=${U.dispX(A[0])}, Y=${U.dispY(A[1])})、B(X=${U.dispX(B[0])}, Y=${U.dispY(B[1])})〕を <b>${m}:${n} に外分</b>する点Cの座標を求めよ（小数第3位）。</p>`,
        fields: [
          { label: "CのX座標", kind: "num", answer: U.ansX(cx), tol: 0.02 },
          { label: "CのY座標", kind: "num", answer: U.ansY(cy), tol: 0.02 },
        ],
        solution: `<p>外分点公式。内分点と違い<b>分母が引き算 m−n</b> になる。</p>
<div class="formula">${mathml("X_{C} ＝ \\frac{m·X_{B} − n·X_{A}}{m − n}", true)}${mathml("Y_{C} ＝ \\frac{m·Y_{B} − n·Y_{A}}{m − n}", true)}</div>
<p>⟹ <b>C(${U.dispX(cx)}, ${U.dispY(cy)})</b>　${m > n ? "（Bの外側）" : "（Aの外側）"}</p>
<p class="muted small">内分点で n を −n に置換した形。</p>`,
      };
    },
  },

  // ⑪ 方位角の計算（夾角→方位角）
  azimuth: {
    name: "方位角の計算（夾角→方位角）",
    desc: "出発方位角と各測点の夾角から測線の方位角を順次計算",
    group: "内外分点・トラバース",
    gen() {
      const U = CalcUtil;
      const k = U.ri(3, 4);
      const T = [U.dmsToDeg(U.ri(10, 350), U.ri(0, 59), 0)];
      for (let i = 1; i <= k; i++)
        T.push(U.dmsToDeg(U.ri(0, 359), U.ri(0, 59), 0));
      const beta = [];
      for (let i = 1; i <= k; i++)
        beta.push((((T[i] - T[i - 1] + 180) % 360) + 360) % 360);
      const rows = beta
        .map(
          (b, i) =>
            `<tr><td>測点${i + 1}</td><td>${U.dmsStr(U.toDMS(b))}</td></tr>`,
        )
        .join("");
      return {
        html: `<p>結合・閉合トラバースの方位角計算。第1測線の方位角が <b>${U.dmsStr(U.toDMS(T[0]))}</b>、各測点の夾角(右側)が下表のとき、<b>第2測線</b>と<b>第${k + 1}測線</b>の方位角を求めよ。</p>
<table class="simple"><tr><th>測点</th><th>夾角 β</th></tr>${rows}</table>
<p class="small">公式: 次測線の方位角 ＝ 前測線の方位角 ＋ β − 180°（0未満は＋360°、360以上は−360°）。</p>`,
        fields: [
          {
            label: "第2測線の方位角",
            kind: "dms",
            answer: U.toDMS(T[1]),
            tolSec: 2,
          },
          {
            label: `第${k + 1}測線の方位角`,
            kind: "dms",
            answer: U.toDMS(T[k]),
            tolSec: 2,
          },
        ],
        solution: `<p>T₂＝${U.dmsStr(U.toDMS(T[0]))}＋${U.dmsStr(U.toDMS(beta[0]))}−180°＝<b>${U.dmsStr(U.toDMS(T[1]))}</b></p>
<p>… 繰り返して 第${k + 1}測線 ＝<b>${U.dmsStr(U.toDMS(T[k]))}</b></p>
<p class="muted small">結合では「計算到達方位角−既知到達方位角」が方位角閉合差。測点数で割り各角へ配分。</p>`,
      };
    },
  },

  // ⑫ 結合トラバースの座標計算
  traverse: {
    name: "結合トラバースの座標計算",
    desc: "既知点A→B。各測線の方位角・距離から座標と閉合差",
    group: "内外分点・トラバース",
    gen() {
      const U = CalcUtil;
      U.newBase();
      const A = [U.rc(90, 110), U.rc(90, 110)];
      const k = 3;
      const legs = [];
      for (let i = 0; i < k; i++) {
        legs.push({
          T: roundBearingToMin(U.ri(0, 35999) / 100),
          S: U.ri(18000, 36000) / 1000,
        });
      }
      let Bd = [A[0], A[1]];
      legs.forEach((l) => {
        Bd = [
          Bd[0] + l.S * Math.cos(U.deg2rad(l.T)),
          Bd[1] + l.S * Math.sin(U.deg2rad(l.T)),
        ];
      });
      const ex = U.ri(-80, 80) / 1000,
        ey = U.ri(-80, 80) / 1000;
      const Bgiven = [U.r3(Bd[0] + ex), U.r3(Bd[1] + ey)];
      const dX = Bgiven[0] - Bd[0],
        dY = Bgiven[1] - Bd[1];
      const rows = legs
        .map(
          (l, i) =>
            `<tr><td>第${i + 1}測線</td><td>${U.dmsStr(U.toDMS(l.T))}</td><td class="num">${l.S.toFixed(3)}</td></tr>`,
        )
        .join("");
      return {
        html: `<p>既知点 <b>A(${U.dispX(A[0])}, ${U.dispY(A[1])})</b> から既知点 <b>B(${U.dispX(Bgiven[0])}, ${U.dispY(Bgiven[1])})</b> へ至る結合トラバース。下表の方位角・距離から、計算到達点 <b>B′の座標</b>と <b>座標閉合差(ΔX, ΔY)＝B−B′</b> を求めよ（小数第3位）。</p>
<table class="simple"><tr><th>測線</th><th>方位角</th><th>距離(m)</th></tr>${rows}</table>`,
        fields: [
          { label: "B′のX座標", kind: "num", answer: U.ansX(Bd[0]), tol: 0.03 },
          { label: "B′のY座標", kind: "num", answer: U.ansY(Bd[1]), tol: 0.03 },
          { label: "閉合差 ΔX (m)", kind: "num", answer: U.r3(dX), tol: 0.02 },
          { label: "閉合差 ΔY (m)", kind: "num", answer: U.r3(dY), tol: 0.02 },
        ],
        solution: `<p>各測線を放射計算で加算: ΔX＝S·cosT、ΔY＝S·sinT。B′＝A＋Σ(ΔX, ΔY)＝<b>(${U.dispX(Bd[0])}, ${U.dispY(Bd[1])})</b></p>
<p>閉合差 ΔX＝<b>${U.f3(dX)}</b>、ΔY＝<b>${U.f3(dY)}</b>、閉合距離＝${U.f3(Math.hypot(dX, dY))}m</p>
<p class="muted small">電卓: 各測線 <b>Rec(Sᵢ, Tᵢ)</b> でΔX,ΔYを出しM+で加算。この閉合差を各測線へ配分して座標補正する（→「閉合差の調整」種目）。</p>`,
      };
    },
  },

  // ⑬ 閉合トラバースの座標計算
  closedTraverse: {
    name: "閉合トラバースの座標計算",
    desc: "出発点に戻る多角形。測点座標と閉合差",
    group: "内外分点・トラバース",
    gen() {
      const U = CalcUtil;
      U.newBase();
      const P0 = [U.rc(95, 110), U.rc(95, 110)];
      const k = U.ri(4, 5);
      const legs = [];
      let cur = [P0[0], P0[1]];
      for (let i = 0; i < k - 1; i++) {
        const T = roundBearingToMin(U.ri(0, 35999) / 100);
        const S = U.ri(15000, 30000) / 1000;
        legs.push({ T, S });
        cur = [
          cur[0] + S * Math.cos(U.deg2rad(T)),
          cur[1] + S * Math.sin(U.deg2rad(T)),
        ];
      }
      const Tl = roundBearingToMin(U.bearing(cur[0], cur[1], P0[0], P0[1]));
      const Sl = U.r3(
        U.dist(cur[0], cur[1], P0[0], P0[1]) + U.ri(-40, 40) / 1000,
      );
      legs.push({ T: Tl, S: Sl });
      const stations = [[P0[0], P0[1]]];
      let c = [P0[0], P0[1]];
      legs.forEach((l) => {
        c = [
          c[0] + l.S * Math.cos(U.deg2rad(l.T)),
          c[1] + l.S * Math.sin(U.deg2rad(l.T)),
        ];
        stations.push([c[0], c[1]]);
      });
      const end = stations[stations.length - 1];
      const dX = end[0] - P0[0],
        dY = end[1] - P0[1];
      const rows = legs
        .map(
          (l, i) =>
            `<tr><td>${i + 1}→${i + 2 > legs.length ? "1" : i + 2}</td><td>${U.dmsStr(U.toDMS(l.T))}</td><td class="num">${l.S.toFixed(3)}</td></tr>`,
        )
        .join("");
      return {
        html: `<p>出発点 <b>P1(${U.dispX(P0[0])}, ${U.dispY(P0[1])})</b> から一周して戻る閉合トラバース。下表の方位角・距離から、<b>測点P2の座標</b>と一周後の <b>座標閉合差(ΔX, ΔY)</b> を求めよ（小数第3位）。</p>
<table class="simple"><tr><th>測線</th><th>方位角</th><th>距離(m)</th></tr>${rows}</table>`,
        fields: [
          {
            label: "P2のX座標",
            kind: "num",
            answer: U.ansX(stations[1][0]),
            tol: 0.03,
          },
          {
            label: "P2のY座標",
            kind: "num",
            answer: U.ansY(stations[1][1]),
            tol: 0.03,
          },
          { label: "閉合差 ΔX (m)", kind: "num", answer: U.r3(dX), tol: 0.03 },
          { label: "閉合差 ΔY (m)", kind: "num", answer: U.r3(dY), tol: 0.03 },
        ],
        solution: `<p>各測点＝前点＋放射計算。P2＝P1＋第1測線＝<b>(${U.dispX(stations[1][0])}, ${U.dispY(stations[1][1])})</b></p>
<p>一周後の到達点と出発点の差＝閉合差 ΔX＝<b>${U.f3(dX)}</b>、ΔY＝<b>${U.f3(dY)}</b>、閉合距離＝${U.f3(Math.hypot(dX, dY))}m</p>
<p class="muted small">電卓: 各測線 <b>Rec(Sᵢ, Tᵢ)</b> で緯距経距を順次加算。閉合比＝閉合距離÷全測線長。補正は均等/コンパス/トランシット法（→「閉合差の調整」）。</p>`,
      };
    },
  },

  // ⑭ 閉合差の調整（均等法・コンパス法・トランシット法）
  traverseAdjust: {
    name: "閉合差の調整（均等・コンパス・トランシット法）",
    desc: "閉合差を3つの配分法で補正し調整後座標を求める",
    group: "内外分点・トラバース",
    gen() {
      const U = CalcUtil;
      U.newBase();
      const P0 = [U.rc(95, 110), U.rc(95, 110)];
      const n = U.ri(4, 4); // 測線数
      const legs = [];
      let cur = [P0[0], P0[1]];
      for (let i = 0; i < n - 1; i++) {
        const T = roundBearingToMin(U.ri(0, 35999) / 100);
        const S = U.ri(15000, 28000) / 1000;
        legs.push({ T, S });
        cur = [
          cur[0] + S * Math.cos(U.deg2rad(T)),
          cur[1] + S * Math.sin(U.deg2rad(T)),
        ];
      }
      const Tl = roundBearingToMin(U.bearing(cur[0], cur[1], P0[0], P0[1]));
      const Sl = U.r3(
        U.dist(cur[0], cur[1], P0[0], P0[1]) + U.ri(-60, 60) / 1000,
      );
      legs.push({ T: Tl, S: Sl });
      // 各測線の緯距(ΔX)・経距(ΔY)
      legs.forEach((l) => {
        l.dX = l.S * Math.cos(U.deg2rad(l.T));
        l.dY = l.S * Math.sin(U.deg2rad(l.T));
      });
      const eX = legs.reduce((s, l) => s + l.dX, 0); // 閉合差 X（=Σ緯距）
      const eY = legs.reduce((s, l) => s + l.dY, 0);
      const sumS = legs.reduce((s, l) => s + l.S, 0);
      const sumAX = legs.reduce((s, l) => s + Math.abs(l.dX), 0);
      const sumAY = legs.reduce((s, l) => s + Math.abs(l.dY), 0);
      const methods = ["均等法", "コンパス法", "トランシット法"];
      const mi = U.ri(0, 2);
      const method = methods[mi];
      // 第1測線の補正量（補正は閉合差の符号を打ち消す向き＝マイナス配分）
      const L0 = legs[0];
      let vX, vY;
      if (mi === 0) {
        vX = -eX / n;
        vY = -eY / n;
      } else if (mi === 1) {
        vX = (-eX * L0.S) / sumS;
        vY = (-eY * L0.S) / sumS;
      } else {
        vX = (-eX * Math.abs(L0.dX)) / sumAX;
        vY = (-eY * Math.abs(L0.dY)) / sumAY;
      }
      // 調整後P2 = P1 + (第1測線の調整後緯距・経距)
      const p2x = P0[0] + L0.dX + vX;
      const p2y = P0[1] + L0.dY + vY;
      const rows = legs
        .map(
          (l, i) =>
            `<tr><td>第${i + 1}測線</td><td>${U.dmsStr(U.toDMS(l.T))}</td><td class="num">${l.S.toFixed(3)}</td></tr>`,
        )
        .join("");
      return {
        html: `<p>閉合トラバース（出発点 <b>P1(${U.dispX(P0[0])}, ${U.dispY(P0[1])})</b>）の観測値が下表。座標閉合差を <b>${method}</b> で配分し、<b>第1測線の補正量(ΔXの補正・ΔYの補正)</b> と <b>調整後の測点P2の座標</b> を求めよ（小数第3位）。</p>
<table class="simple"><tr><th>測線</th><th>方位角</th><th>距離(m)</th></tr>${rows}</table>
<p class="small">閉合差: ΔX(緯距和)＝${eX.toFixed(4)}, ΔY(経距和)＝${eY.toFixed(4)} ／ 全長ΣS＝${sumS.toFixed(3)}m</p>`,
        fields: [
          {
            label: "第1測線 ΔXの補正量(m)",
            kind: "num",
            answer: U.r3(vX),
            tol: 0.002,
          },
          {
            label: "第1測線 ΔYの補正量(m)",
            kind: "num",
            answer: U.r3(vY),
            tol: 0.002,
          },
          {
            label: "調整後P2のX座標",
            kind: "num",
            answer: U.ansX(p2x),
            tol: 0.01,
          },
          {
            label: "調整後P2のY座標",
            kind: "num",
            answer: U.ansY(p2y),
            tol: 0.01,
          },
        ],
        solution: `<p><b>補正の向き</b>: 閉合差を打ち消すので各測線へ <b>−ΔX, −ΔY</b> を配分する。</p>
<p><b>均等法</b>（全測線へ等分）</p>
<div class="formula">${mathml("vX ＝ \\frac{−ΔX}{n}　　vY ＝ \\frac{−ΔY}{n}", true)}<p style="text-align:center;margin:0">＝ ${(-eX / n).toFixed(4)}, ${(-eY / n).toFixed(4)}</p></div>
<p><b>コンパス法（ボーディッチ）</b>（距離に比例）</p>
<div class="formula">${mathml("vX_{i} ＝ −ΔX·\\frac{S_{i}}{ΣS}　　vY_{i} ＝ −ΔY·\\frac{S_{i}}{ΣS}", true)}<p style="text-align:center;margin:0">第1測線: ${((-eX * L0.S) / sumS).toFixed(4)}, ${((-eY * L0.S) / sumS).toFixed(4)}</p></div>
<p><b>トランシット法</b>（緯距・経距の絶対値に比例）</p>
<div class="formula">${mathml("vX_{i} ＝ −ΔX·\\frac{\\abs{ΔX_{i}}}{Σ\\abs{ΔX}}　　vY_{i} ＝ −ΔY·\\frac{\\abs{ΔY_{i}}}{Σ\\abs{ΔY}}", true)}<p style="text-align:center;margin:0">第1測線: ${((-eX * Math.abs(L0.dX)) / sumAX).toFixed(4)}, ${((-eY * Math.abs(L0.dY)) / sumAY).toFixed(4)}</p></div>
<p>本問は<b>${method}</b>: 第1測線 vX＝<b>${U.f3(vX)}</b>, vY＝<b>${U.f3(vY)}</b></p>
<p>調整後P2＝P1＋(第1測線ΔX＋vX, ΔY＋vY)＝<b>(${U.dispX(p2x)}, ${U.dispY(p2y)})</b></p>
<p class="muted small">使い分け: 角と距離の精度が同程度→コンパス法（最も一般的）。角の精度が高い→トランシット法。簡易→均等法。</p>`,
      };
    },
  },

  // 平行線 — 「既知の筆界線に平行で、そこから d だけ離れた線」を引く型。
  // 答練の記述式では「直線ＰＱは直線ＡＥと平行」「筆界線から平行に○m後退」の形で頻出。
  parallel: {
    name: "平行線の作図計算（等距離の平行線と交点）",
    desc: "既知の筆界線に平行で d 離れた直線と、他の筆界との交点",
    group: "交点計算",
    gen() {
      const U = CalcUtil;
      U.newBase();
      // 基準となる筆界線 AB
      const A = [U.rc(100, 115), U.rc(100, 110)];
      const theta = U.ri(10, 170);
      const dx = Math.cos(U.deg2rad(theta)),
        dy = Math.sin(U.deg2rad(theta));
      const lenAB = U.ri(25000, 45000) / 1000;
      const B = [U.r3(A[0] + lenAB * dx), U.r3(A[1] + lenAB * dy)];
      // AB から距離 d の平行線。法線方向は (−dy, dx)。
      const side = Math.random() < 0.5 ? 1 : -1;
      const d = U.ri(2000, 12000) / 1000;
      // 平行線が通る点（AB上の点を法線方向に d 動かす）
      const M0 = [A[0] + lenAB * 0.5 * dx, A[1] + lenAB * 0.5 * dy];
      const M = [M0[0] - side * d * dy, M0[1] + side * d * dx];
      // 交わる相手の筆界線 CD（AB と平行にならない向き）
      const phi = theta + U.ri(35, 145);
      const ex = Math.cos(U.deg2rad(phi)),
        ey = Math.sin(U.deg2rad(phi));
      const C = [
        U.r3(A[0] - 8 * dx - side * 3 * dy),
        U.r3(A[1] - 8 * dy + side * 3 * dx),
      ];
      // 平行線（点M・方向(dx,dy)）と 直線C＋t(ex,ey) の交点
      const det = dx * -ey - dy * -ex;
      if (Math.abs(det) < 1e-6) return null;
      const rx = C[0] - M[0],
        ry = C[1] - M[1];
      const s = (rx * -ey - ry * -ex) / det;
      const P = [M[0] + s * dx, M[1] + s * dy];
      // 交点が現実的な範囲に来ない配置は捨てる
      if (Math.hypot(P[0] - M0[0], P[1] - M0[1]) > 120) return null;
      return {
        html: `<p>筆界線 <b>ＡＢ</b> は点 <b>Ａ(${U.dispX(A[0])}, ${U.dispY(A[1])})</b> を通り方向角 <b>${theta}°00′00″</b> の直線である。<br>
このＡＢに<b>平行</b>で、ＡＢから <b>${U.f3(d)}m</b> 離れた直線（点 <b>Ｍ(${U.dispX(M[0])}, ${U.dispY(M[1])})</b> を通る側）を引く。<br>
この平行線と、点 <b>Ｃ(${U.dispX(C[0])}, ${U.dispY(C[1])})</b> を通り方向角 <b>${phi % 360}°00′00″</b> の直線ＣＤとの交点 <b>Ｐ</b> の座標を求めよ（小数第3位）。</p>`,
        fields: [
          { label: "PのX座標", kind: "num", answer: U.ansX(P[0]), tol: 0.02 },
          { label: "PのY座標", kind: "num", answer: U.ansY(P[1]), tol: 0.02 },
        ],
        solution: `<p><b>考え方</b>: 平行線は「方向が同じで、通る点だけが違う直線」。方向角はＡＢと同じ <b>${theta}°</b> のまま、通る点をＭに替えて交点計算をするだけでよい。</p>
<p>平行線: (X, Y)＝Ｍ＋t(cos${theta}°, sin${theta}°)　　直線ＣＤ: (X, Y)＝Ｃ＋u(cos${phi % 360}°, sin${phi % 360}°)</p>
<p>連立して t を解くと t＝${s.toFixed(4)} ⟹ Ｐ＝<b>(${U.dispX(P[0])}, ${U.dispY(P[1])})</b></p>
<p class="muted small"><b>平行線の点の作り方</b>: 基準線上の点から<b>法線方向</b>（方向角±90°）へ d だけ進める。方向角θの法線は (−sinθ, cosθ)。
電卓なら <b>Rec(d, θ+90°)</b> で増分ΔX,ΔYが直接出る。<br>
記述式では「筆界線から○m後退した線」「隣地境界と平行な分割線」として出る。<b>平行＝方向角が同じ</b>と気づけば、あとは通常の交点計算に落ちる。</p>`,
      };
    },
  },

  // 円の接線 — 円外の一点から円に引いた接線と、その接点。
  // 隅切り・曲線境界の取付けで使う型。
  tangent: {
    name: "円の接線と接点（円外の一点から）",
    desc: "円外の点Pから円Oへの接線長と接点Tの座標",
    group: "交点計算",
    gen() {
      const U = CalcUtil;
      U.newBase();
      const O = [U.rc(100, 115), U.rc(100, 115)];
      const r = U.ri(6000, 16000) / 1000;
      // 中心からの距離が半径の1.6〜3.2倍になる位置に外部点Pを置く
      const dist = (r * U.ri(160, 320)) / 100;
      const ang = U.ri(0, 359);
      const P = [
        U.r3(O[0] + dist * Math.cos(U.deg2rad(ang))),
        U.r3(O[1] + dist * Math.sin(U.deg2rad(ang))),
      ];
      const dOP = Math.hypot(P[0] - O[0], P[1] - O[1]);
      const tanLen = Math.sqrt(dOP * dOP - r * r);
      // 接点は OP を基準に ±α 回転した方向。α＝arccos(r/|OP|)
      const alpha = Math.acos(r / dOP);
      const baseAng = Math.atan2(O[1] - P[1], O[0] - P[0]); // P→O の向き
      const tAng = Math.atan2(P[1] - O[1], P[0] - O[0]); // O→P の向き
      const sgn = Math.random() < 0.5 ? 1 : -1;
      const T = [
        O[0] + r * Math.cos(tAng + sgn * alpha),
        O[1] + r * Math.sin(tAng + sgn * alpha),
      ];
      const half = U.rad2deg(alpha);
      return {
        html: `<p>中心 <b>Ｏ(${U.dispX(O[0])}, ${U.dispY(O[1])})</b>・半径 <b>${U.f3(r)}m</b> の円がある。<br>
円外の点 <b>Ｐ(${U.dispX(P[0])}, ${U.dispY(P[1])})</b> からこの円に引いた接線について、<b>接線長ＰＴ</b>と、
<b>${sgn > 0 ? "左回り" : "右回り"}側の接点Ｔ</b>の座標を求めよ（小数第3位）。</p>`,
        fields: [
          {
            label: "接線長 PT (m)",
            kind: "num",
            answer: U.r3(tanLen),
            tol: 0.02,
          },
          { label: "TのX座標", kind: "num", answer: U.ansX(T[0]), tol: 0.03 },
          { label: "TのY座標", kind: "num", answer: U.ansY(T[1]), tol: 0.03 },
        ],
        solution: `<p><b>接線長</b>: 接点Ｔでは <b>ＯＴ⊥ＰＴ</b> なので、△ＯＴＰは∠Ｔ＝90°の直角三角形。<br>
|ＯＰ|＝${U.f3(dOP)}m、半径 r＝${U.f3(r)}m。</p>
<div class="formula">${mathml("ＰＴ ＝ \\sqrt{\\abs{ＯＰ}^{2} − r^{2}}", true)}<p style="text-align:center;margin:0">＝ √(${(dOP * dOP).toFixed(3)} − ${(r * r).toFixed(3)}) ＝ <b>${U.f3(tanLen)}m</b></p></div>
<p><b>接点の座標</b>: Ｏから見たＰの方向角を θ<sub>OP</sub>＝${U.f3(U.rad2deg(tAng) < 0 ? U.rad2deg(tAng) + 360 : U.rad2deg(tAng))}° とすると、
接点は θ<sub>OP</sub> から α だけ回した方向にある。</p>
<div class="formula">${mathml("α ＝ cos^{-1}\\frac{r}{\\abs{ＯＰ}}", true)}<p style="text-align:center;margin:0">＝ <b>${U.f3(half)}°</b></p></div>
<p>
Ｔ＝Ｏ＋<b>Rec(r, θ<sub>OP</sub>${sgn > 0 ? "＋" : "−"}α)</b>＝<b>(${U.dispX(T[0])}, ${U.dispY(T[1])})</b></p>
<p class="muted small"><b>電卓手順</b>: ①<b>Pol</b>でＯ→Ｐの距離と方向角 ②ＰＴ＝√(距離²−r²) ③α＝cos⁻¹(r÷距離) ④<b>Rec</b>(r, 方向角±α) で接点の増分ΔX,ΔYを出しＯに足す。<br>
接点は<b>2つ</b>ある（θ±α）。問題文がどちら側かを必ず確認すること。<b>接線長は左右どちらでも同じ</b>。</p>`,
      };
    },
  },
};

// ─────────── 出題頻度 ───────────
// 根拠は東京法経学院の答練63冊（2019〜2023年度）のOCR全文を種目に固有の表現で検索した
// 実測値。**本試験そのものの統計ではない**ため、0冊でも本試験に出ないとは限らない。
// weight は「ごちゃ混ぜ」で選ばれる相対確率。頻出のものほど多く回すための重み。
//
//   base  … すべての計算の土台になるもの（単独での出題は少ないが毎回使う）
//   high  … 答練で頻出
//   mid   … ときどき出る
//   low   … まれ
//   none  … 答練63冊では確認できなかった（本試験での出題を否定するものではない）
const CALC_FREQ = {
  area: {
    rank: "high",
    vol: 54,
    weight: 10,
    note: "記述式の土地はほぼ毎回これで求積する",
  },
  floor: {
    rank: "high",
    vol: 63,
    weight: 10,
    note: "記述式の建物は毎回床面積の認定・計算がある。構造から測る線を誤ると求積全体が崩れる",
  },
  parallel: {
    rank: "high",
    vol: 39,
    weight: 8,
    note: "「筆界線と平行な分割線」の形で頻出",
  },
  intersect: {
    rank: "high",
    vol: 18,
    weight: 8,
    note: "分筆線と筆界の交点。記述式の定番",
  },
  intersect4: {
    rank: "high",
    vol: 18,
    weight: 7,
    note: "交点計算の4点指定バージョン",
  },
  dist: {
    rank: "base",
    vol: null,
    weight: 8,
    note: "逆計算。辺長・方向角の算出で毎回使う土台",
  },
  radiate: {
    rank: "base",
    vol: null,
    weight: 7,
    note: "正計算。新点を出す土台",
  },
  internal: {
    rank: "mid",
    vol: 11,
    weight: 5,
    note: "面積を指定して分割する場面で使う",
  },
  perpFoot: {
    rank: "low",
    vol: 7,
    weight: 3,
    note: "境界線からのオフセットを出す場面",
  },
  external: {
    rank: "low",
    vol: 5,
    weight: 2,
    note: "内分点と対で覚えるが出番は少ない",
  },
  traverse: { rank: "low", vol: 2, weight: 2, note: "測量士補の範囲と重なる" },
  closedTraverse: {
    rank: "low",
    vol: 2,
    weight: 2,
    note: "測量士補の範囲と重なる",
  },
  traverseAdjust: {
    rank: "low",
    vol: 2,
    weight: 1,
    note: "閉合差の配分。調査士試験での出題は薄い",
  },
  circleLine: {
    rank: "none",
    vol: 0,
    weight: 1,
    note: "曲線境界の取付けで使う。備えとして残す",
  },
  circleCircle: {
    rank: "none",
    vol: 0,
    weight: 1,
    note: "距離交会。現地復元の考え方として押さえる",
  },
  tangent: {
    rank: "none",
    vol: 0,
    weight: 1,
    note: "隅切り・曲線の取付けで使う考え方",
  },
  azimuth: {
    rank: "none",
    vol: 0,
    weight: 1,
    note: "夾角からの方位角。測量士補の範囲と重なる",
  },
};

const CALC_FREQ_LABEL = {
  high: { text: "頻出", cls: "freq-high" },
  base: { text: "基礎", cls: "freq-base" },
  mid: { text: "ときどき", cls: "freq-mid" },
  low: { text: "まれ", cls: "freq-low" },
  none: { text: "答練では未確認", cls: "freq-none" },
};

// 種目の頻度バッジHTML。問題画面と計算手法ガイドの両方で使う。
function calcFreqBadge(type) {
  const f = CALC_FREQ[type];
  if (!f) return "";
  const l = CALC_FREQ_LABEL[f.rank];
  const basis =
    f.vol === null
      ? "他の計算の土台として毎回使う"
      : `答練63冊中 ${f.vol}冊で確認`;
  return `<span class="freq-badge ${l.cls}" title="${basis}">${l.text}</span>`;
}

// 頻度の注記（本文）。0冊のものは「本試験に出ない」と誤解されないよう明記する。
function calcFreqNote(type) {
  const f = CALC_FREQ[type];
  if (!f) return "";
  const basis =
    f.vol === null
      ? "単独での出題は少ないが、他の計算の土台として毎回使う。"
      : `答練63冊（2019〜2023年度）のうち <b>${f.vol}冊</b> で確認。`;
  const caveat =
    f.rank === "none"
      ? "<br><b>※この調査では出題を確認できなかった種目です。</b>調査対象は答練であり本試験そのものではないため、本試験に出ないという意味ではありません。考え方を押さえる目的で残しています。"
      : "";
  return `<p class="muted small freq-note">📊 ${basis}${f.note ? " " + f.note + "。" : ""}${caveat}</p>`;
}

// 計算道場のメニュー構成（グループ表示用）。CALC_TYPES は全種目のフラットな一覧。
const CALC_GROUPS = [
  { label: "基礎計算", types: ["dist", "radiate"] },
  {
    label: "交点計算",
    types: [
      "intersect",
      "intersect4",
      "parallel",
      "circleLine",
      "circleCircle",
      "tangent",
      "perpFoot",
    ],
  },
  {
    label: "内外分点・トラバース",
    types: [
      "internal",
      "external",
      "azimuth",
      "traverse",
      "closedTraverse",
      "traverseAdjust",
    ],
  },
  { label: "求積・面積", types: ["area", "floor"] },
];
const CALC_TYPES = CALC_GROUPS.flatMap((g) => g.types);
