// 計算道場 — 測量計算の無限自動生成エンジン
// 座標系: X=北(+), Y=東(+)。方向角Tは北(X軸正方向)から時計回り。
//   X = X0 + S·cosT, Y = Y0 + S·sinT
//
// 座標表示は小数第3位(mm)まで。座標系は2モード:
//   local … 任意座標（X,Y ≒ 100 前後の扱いやすい値）
//   jgd  … 世界測地系・平面直角座標系（原点から ±数千〜数万m、符号つき）
// 幾何計算は精度確保のため必ず「ローカル枠（小さい値）」で行い、
// 表示・解答だけ base を足してワールド座標にする（大座標での桁落ちを回避）。

const CalcUtil = {
  ri(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
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
<p>S=√(ΔX²+ΔY²)=<b>${U.f3(S)}m</b></p>
<p>T=atan(ΔY/ΔX) を象限補正（ΔX${dx > 0 ? ">0" : "<0"}・ΔY${dy > 0 ? ">0" : "<0"} ⟹ 第${dx > 0 ? (dy > 0 ? "1" : "4") : dy > 0 ? "2" : "3"}象限）⟹ <b>${U.dmsStr(dms)}</b></p>
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
<p class="formula">a ＝ {(Y<sub>B</sub>−Y<sub>A</sub>)cosT<sub>B</sub>−(X<sub>B</sub>−X<sub>A</sub>)sinT<sub>B</sub>} ÷ sin(T<sub>A</sub>−T<sub>B</sub>) ＝ <b>${a.toFixed(3)}m</b></p>
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
        solution: `<p>|AB|＝√(ΔX²＋ΔY²)＝${L.toFixed(4)}m、相似比 k＝AC/|AB|＝${k.toFixed(5)}</p>
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
      const chiseki = ar > 10 ? Math.floor(ar + 1e-9) : U.floor2(ar);
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
        html: `<p>筆界点A・B・C・Dで囲まれた土地（宅地）の<b>面積</b>と<b>登記すべき地積</b>を求めよ。</p>
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
        solution: `<p>倍面積＝ΣXᵢ(Yᵢ₊₁−Yᵢ₋₁)（座標差の式なので世界測地系の大座標でも値は同じ）</p><p class="mono small">${calcRows}</p>
<p>倍面積＝${dbl.toFixed(4)} ⟹ 面積＝<b>${U.f2(ar)}㎡</b></p>
<p>地積（規則100条）: ${ar > 10 ? "10㎡超 ⟹ 1㎡未満切捨て" : "10㎡以下 ⟹ 0.01㎡未満切捨て"} ⟹ <b>${chiseki}㎡</b></p>`,
      };
    },
  },

  // ⑤ 床面積（座標系の影響なし＝建物寸法）
  floor: {
    name: "床面積の計算（建物・区分建物）",
    desc: "壁芯／内法・吹抜け・規則115条の切捨て処理",
    group: "求積・面積",
    gen() {
      const U = CalcUtil;
      const kubun = Math.random() < 0.4;
      if (kubun) {
        const w = U.ri(5000, 12000) / 1000,
          d = U.ri(4000, 9000) / 1000;
        const t = [0.15, 0.2, 0.25][U.ri(0, 2)];
        const iw = w - t,
          id_ = d - t;
        const ans = U.floor2(iw * id_);
        return {
          html: `<p>区分建物の専有部分は、壁芯寸法で <b>${w.toFixed(3)}m × ${d.toFixed(3)}m</b> の長方形である。周囲の壁厚は一様に <b>${t.toFixed(2)}m</b>（壁芯から内側へ各${(t / 2).toFixed(3)}m）。専有部分の床面積を求めよ。</p>`,
          fields: [
            {
              label: "床面積（㎡・小数第2位）",
              kind: "num",
              answer: ans,
              tol: 0.001,
            },
          ],
          solution: `<p>専有部分は<b>内法計算</b>（規則115条かっこ書）。</p>
<p>内法寸法: ${iw.toFixed(3)}×${id_.toFixed(3)}＝${(iw * id_).toFixed(4)}㎡</p>
<p>1/100㎡未満<b>切捨て</b> ⟹ <b>${ans.toFixed(2)}㎡</b></p>`,
        };
      }
      const a = U.ri(7000, 12000) / 1000,
        b = U.ri(5000, 9000) / 1000;
      const hasVoid = Math.random() < 0.6;
      const vw = U.ri(1500, 3000) / 1000,
        vd = U.ri(1500, 3000) / 1000;
      const raw = hasVoid ? a * b - vw * vd : a * b;
      const ans = U.floor2(raw);
      return {
        html: `<p>木造2階建ての2階部分は、壁芯寸法で <b>${a.toFixed(3)}m × ${b.toFixed(3)}m</b> の長方形である。${hasVoid ? `内部に <b>${vw.toFixed(3)}m × ${vd.toFixed(3)}m の吹抜け</b>がある。` : "外側に開放されたベランダ（2.000m×3.000m）が付属する。"}2階の床面積を求めよ。</p>`,
        fields: [
          {
            label: "2階床面積（㎡・小数第2位）",
            kind: "num",
            answer: ans,
            tol: 0.001,
          },
        ],
        solution: `<p>${a.toFixed(3)}×${b.toFixed(3)}＝${(a * b).toFixed(4)}㎡${hasVoid ? `<br>吹抜け ${(vw * vd).toFixed(4)}㎡ は<b>算入しない</b>（準則82条）` : "<br>開放されたベランダは<b>算入しない</b>（準則82条）"}</p>
<p>${raw.toFixed(4)}㎡ ⟹ 1/100㎡未満切捨て（規則115条）⟹ <b>${ans.toFixed(2)}㎡</b></p>`,
      };
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
        solution: `<p>方向ベクトル r=B−A、s=D−C。 <b>t＝{(C−A)×s} ÷ (r×s)</b>（×は外積）、P＝A＋t·r。</p>
<p>⟹ <b>P(${U.dispX(P[0])}, ${U.dispY(P[1])})</b></p>
<p class="muted small">複素数モード: 2直線を「点＋方向角」に直し交点公式へ。</p>`,
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
        solution: `<p>直線を P＋t·(cosθ, sinθ) と置き円の式へ代入。<b>t²＋2bt＋c＝0</b>、b＝(Pₓ−Oₓ)cosθ＋(P_y−O_y)sinθ、c＝(Pₓ−Oₓ)²＋(P_y−O_y)²−r²。</p>
<p>t＝−b±√(b²−c) ⟹ <b>①(${U.dispX(sol[0][0])}, ${U.dispY(sol[0][1])})・②(${U.dispX(sol[1][0])}, ${U.dispY(sol[1][1])})</b></p>
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
        solution: `<p>AB間距離 d、Aから垂線の足まで <b>a＝(d²＋r1²−r2²)/(2d)</b>、高さ <b>h＝√(r1²−a²)</b>。足M＝A＋a·(AB単位ベクトル)、交点＝M±h·(ABに直交する単位ベクトル)。</p>
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
        solution: `<p>外分点公式（分母が <b>引き算 m−n</b>）: X<sub>C</sub>＝(m·X<sub>B</sub>−n·X<sub>A</sub>)/(m−n)、Y<sub>C</sub>＝(m·Y<sub>B</sub>−n·Y<sub>A</sub>)/(m−n)</p>
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
<p><b>均等法</b>: 全測線へ等分 → vX＝−ΔX/n＝${(-eX / n).toFixed(4)}、vY＝−ΔY/n＝${(-eY / n).toFixed(4)}</p>
<p><b>コンパス法(ボーディッチ)</b>: 距離に比例 → vX＝−ΔX×Sᵢ/ΣS、vY＝−ΔY×Sᵢ/ΣS（第1測線: ${((-eX * L0.S) / sumS).toFixed(4)}, ${((-eY * L0.S) / sumS).toFixed(4)}）</p>
<p><b>トランシット法</b>: 緯距・経距の絶対値に比例 → vX＝−ΔX×|ΔXᵢ|/Σ|ΔX|、vY＝−ΔY×|ΔYᵢ|/Σ|ΔY|（第1測線: ${((-eX * Math.abs(L0.dX)) / sumAX).toFixed(4)}, ${((-eY * Math.abs(L0.dY)) / sumAY).toFixed(4)}）</p>
<p>本問は<b>${method}</b>: 第1測線 vX＝<b>${U.f3(vX)}</b>, vY＝<b>${U.f3(vY)}</b></p>
<p>調整後P2＝P1＋(第1測線ΔX＋vX, ΔY＋vY)＝<b>(${U.dispX(p2x)}, ${U.dispY(p2y)})</b></p>
<p class="muted small">使い分け: 角と距離の精度が同程度→コンパス法（最も一般的）。角の精度が高い→トランシット法。簡易→均等法。</p>`,
      };
    },
  },
};

// 計算道場のメニュー構成（グループ表示用）。CALC_TYPES は全種目のフラットな一覧。
const CALC_GROUPS = [
  { label: "基礎計算", types: ["dist", "radiate"] },
  {
    label: "交点計算",
    types: [
      "intersect",
      "intersect4",
      "circleLine",
      "circleCircle",
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
