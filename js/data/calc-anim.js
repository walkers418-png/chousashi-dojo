// 計算アニメ図解エンジン ＋ 提供8テーマの完全ガイド（複素数モード／通常モード）
// ------------------------------------------------------------------------
// このファイルは calc-guide.js（CALC_GUIDE）の後に読み込み、
//   ① 座標系SVGアニメの描画エンジン CXAnim を定義
//   ② 既存ガイド（内分点・座標法面積）にアニメ(anim)を後付け
//   ③ 新規6テーマ（外分点／4点交点／2方向角交点／垂線の足／円と直線／距離交会）を追加
// する。アニメは app.js の mountCalcAnim が data-from/data-until で手順送りする。
//
// 座標系: X=北(上・+), Y=東(右・+)。方向角は北(X軸正)から時計回り。
//   画面座標: screenX = f(Y)（東→右）, screenY = g(X)（北→上＝yは反転）
//
// ★数値はすべて Node で独立検算済み（誠実さ＝CONSTITUTION原則1）。
//   提供素材の数値には複数の誤り（外分点・4点交点・円と直線・距離交会・面積）が
//   あったため、本ファイルでは検算済みの正しい数値のみを採用している。

(function () {
  // ===== 記号の統一（全テーマ共通の約束） =====
  // A,B,C,D=既知点 ／ O=円の中心 ／ P=求める点 ／ Q=直線外の点 ／ F=垂線の足
  // r=半径 ／ d=中心⊥距離 ／ t=直線上の距離・倍率 ／ L=距離
  // T(添字)・α・β=方向角 ／ 電卓STO: 座標→A〜D・O・Q（複素変数）, 角度→E・F（実数変数）
  const LEGEND = `<table class="simple cx-legend"><tr><th>記号</th><th>意味</th><th>電卓STO</th></tr>
    <tr><td>A B C D</td><td>既知点（与えられた座標）</td><td>複素変数 A〜D</td></tr>
    <tr><td>O</td><td>円の中心</td><td>複素変数 O(=A等)</td></tr>
    <tr><td>P</td><td>求める点（交点・新点・分割点）</td><td>—</td></tr>
    <tr><td>Q</td><td>直線の外の点</td><td>複素変数 Q</td></tr>
    <tr><td>F</td><td>垂線の足</td><td>複素変数 M に退避</td></tr>
    <tr><td>r / d / t</td><td>半径 / 中心⊥距離 / 直線上の距離・倍率</td><td>実数変数 X Y M</td></tr>
    <tr><td>T・α・β</td><td>方向角（北から時計回り）</td><td>実数変数 E・F</td></tr></table>`;

  // ===== SVG座標図エンジン =====
  const VB_W = 360,
    VB_H = 334;
  const COL = {
    known: "#4fc3f7", // 既知（シアン）
    given2: "#ffb74d", // もう一方の既知（オレンジ）
    ans: "#ef5350", // 求める点（赤）
    aux: "#66bb6a", // 補助線（緑）
    gray: "#8fa0ae",
    txt: "#e8edf2",
    grid: "#172029",
    axis: "#33414c",
  };
  const D2R = (d) => (d * Math.PI) / 180;

  function markerDefs() {
    return (
      "<defs>" +
      [
        ["cxAh", COL.gray],
        ["cxAhB", COL.known],
        ["cxAhR", COL.ans],
        ["cxAhO", COL.given2],
        ["cxAhG", COL.aux],
      ]
        .map(
          ([id, c]) =>
            `<marker id="${id}" markerWidth="9" markerHeight="9" refX="7.5" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="${c}"/></marker>`,
        )
        .join("") +
      "</defs>"
    );
  }
  const ahFor = (c) =>
    c === COL.ans
      ? "cxAhR"
      : c === COL.given2
        ? "cxAhO"
        : c === COL.aux
          ? "cxAhG"
          : c === COL.known
            ? "cxAhB"
            : "cxAh";

  // cfg = { pts:{name:[X,Y]}, bounds:[[X,Y]|name], pad, build:(b)=>innerSVG }
  function cxScene(cfg) {
    const pad = cfg.pad || { l: 32, r: 20, t: 24, b: 28 };
    const pts = cfg.pts;
    const P = (p) => (Array.isArray(p) ? p : pts[p]);
    const all = Object.values(pts).concat((cfg.bounds || []).map(P));
    const Xs = all.map((p) => p[0]),
      Ys = all.map((p) => p[1]);
    const minX = Math.min(...Xs),
      maxX = Math.max(...Xs),
      minY = Math.min(...Ys),
      maxY = Math.max(...Ys);
    const spanX = Math.max(maxX - minX, 1e-6),
      spanY = Math.max(maxY - minY, 1e-6);
    const s = Math.min(
      (VB_W - pad.l - pad.r) / spanY,
      (VB_H - pad.t - pad.b) / spanX,
    );
    const usedW = spanY * s,
      usedH = spanX * s;
    const ox = pad.l + (VB_W - pad.l - pad.r - usedW) / 2;
    const oy = pad.t + (VB_H - pad.t - pad.b - usedH) / 2;
    const X = (p) => ox + (P(p)[1] - minY) * s; // 東→画面x
    const Y = (p) => oy + (maxX - P(p)[0]) * s; // 北→画面y（反転）
    const n2 = (v) => Math.round(v * 100) / 100;

    function gWrap(from, until, inner) {
      const u = until === undefined ? "" : ` data-until="${until}"`;
      return `<g data-from="${from || 0}"${u}>${inner}</g>`;
    }
    // 点（丸＋ラベル）
    function pt(name, o) {
      o = o || {};
      const cx = n2(X(name)),
        cy = n2(Y(name));
      const col = o.color || COL.known;
      const lab = o.label !== undefined ? o.label : name;
      const dx = o.dx !== undefined ? o.dx : 8,
        dy = o.dy !== undefined ? o.dy : -8;
      return gWrap(
        o.from,
        o.until,
        `<circle cx="${cx}" cy="${cy}" r="${o.r || 4.6}" fill="${col}"/>` +
          (lab
            ? `<text x="${n2(cx + dx)}" y="${n2(cy + dy)}" fill="${o.lblColor || COL.txt}" font-size="13" font-weight="bold">${lab}</text>`
            : ""),
      );
    }
    // 線分（任意で延長ext・破線dash・矢印arrow）
    function seg(p1, p2, o) {
      o = o || {};
      let x1 = X(p1),
        y1 = Y(p1),
        x2 = X(p2),
        y2 = Y(p2);
      if (o.ext) {
        const dx = x2 - x1,
          dy = y2 - y1,
          L = Math.hypot(dx, dy) || 1;
        const ux = dx / L,
          uy = dy / L;
        const e1 = o.ext[0] !== undefined ? o.ext[0] : o.ext;
        const e2 = o.ext[1] !== undefined ? o.ext[1] : o.ext;
        x1 -= ux * e1;
        y1 -= uy * e1;
        x2 += ux * e2;
        y2 += uy * e2;
      }
      const col = o.color || COL.gray;
      const dash = o.dash ? ` stroke-dasharray="${o.dash}"` : "";
      const mk = o.arrow ? ` marker-end="url(#${ahFor(col)})"` : "";
      return gWrap(
        o.from,
        o.until,
        `<line x1="${n2(x1)}" y1="${n2(y1)}" x2="${n2(x2)}" y2="${n2(y2)}" stroke="${col}" stroke-width="${o.width || 2.2}"${dash}${mk}/>`,
      );
    }
    // ベクトル矢印（ラベルを中点の外側に）
    function vec(p1, p2, o) {
      o = o || {};
      const col = o.color || COL.known;
      const x1 = X(p1),
        y1 = Y(p1),
        x2 = X(p2),
        y2 = Y(p2);
      const mx = (x1 + x2) / 2,
        my = (y1 + y2) / 2;
      let lab = "";
      if (o.label) {
        const dx = x2 - x1,
          dy = y2 - y1,
          L = Math.hypot(dx, dy) || 1;
        const nx = -dy / L,
          ny = dx / L; // 左法線
        const off = o.loff || 12;
        lab = `<text x="${n2(mx + nx * off)}" y="${n2(my + ny * off)}" text-anchor="middle" fill="${col}" font-size="11" font-weight="bold">${o.label}</text>`;
      }
      return gWrap(
        o.from,
        o.until,
        `<line x1="${n2(x1)}" y1="${n2(y1)}" x2="${n2(x2)}" y2="${n2(y2)}" stroke="${col}" stroke-width="${o.width || 2.4}" marker-end="url(#${ahFor(col)})"/>${lab}`,
      );
    }
    // 方向角の半直線（点pから方位azi・世界長lenW）
    function ray(p, azi, lenW, o) {
      o = o || {};
      const base = P(p);
      const end = [
        base[0] + lenW * Math.cos(D2R(azi)),
        base[1] + lenW * Math.sin(D2R(azi)),
      ];
      return seg(base, end, o);
    }
    // 円（中心center・世界半径rW）
    function circle(center, rW, o) {
      o = o || {};
      const cx = X(center),
        cy = Y(center);
      const rp = rW * s;
      const col = o.color || COL.known;
      const dash = o.dash ? ` stroke-dasharray="${o.dash}"` : "";
      return gWrap(
        o.from,
        o.until,
        `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(rp)}" fill="none" stroke="${col}" stroke-width="${o.width || 2}"${dash}/>`,
      );
    }
    // 方位az1→az2の角弧（中心center・画面半径rad）＋ラベル
    function arc(center, az1, az2, o) {
      o = o || {};
      const c = P(center);
      const cx = X(center),
        cy = Y(center);
      const step = (az) => {
        const w = [c[0] + Math.cos(D2R(az)), c[1] + Math.sin(D2R(az))];
        return Math.atan2(Y(w) - cy, X(w) - cx); // 画面角(rad)
      };
      let a1 = step(az1),
        a2 = step(az2);
      let d = a2 - a1;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      const rad = o.rad || 26;
      const N = 24;
      let pathD = "";
      for (let i = 0; i <= N; i++) {
        const a = a1 + (d * i) / N;
        const px = cx + rad * Math.cos(a),
          py = cy + rad * Math.sin(a);
        pathD += (i === 0 ? "M" : "L") + n2(px) + " " + n2(py) + " ";
      }
      const am = a1 + d / 2;
      const lr = rad + 12;
      const lx = cx + lr * Math.cos(am),
        ly = cy + lr * Math.sin(am);
      const col = o.color || COL.gray;
      return gWrap(
        o.from,
        o.until,
        `<path d="${pathD}" fill="none" stroke="${col}" stroke-width="1.6"/>` +
          (o.label
            ? `<text x="${n2(lx)}" y="${n2(ly + 4)}" text-anchor="middle" fill="${col}" font-size="11" font-weight="bold">${o.label}</text>`
            : ""),
      );
    }
    // 直角マーク（corner を頂点に p1,p2 方向へ小さな四角）
    function rightAngle(corner, p1, p2, o) {
      o = o || {};
      const cx = X(corner),
        cy = Y(corner);
      const u = (p) => {
        const dx = X(p) - cx,
          dy = Y(p) - cy,
          L = Math.hypot(dx, dy) || 1;
        return [dx / L, dy / L];
      };
      const a = u(p1),
        b = u(p2),
        k = o.size || 11;
      const P1 = [cx + a[0] * k, cy + a[1] * k];
      const P2 = [cx + a[0] * k + b[0] * k, cy + a[1] * k + b[1] * k];
      const P3 = [cx + b[0] * k, cy + b[1] * k];
      return gWrap(
        o.from,
        o.until,
        `<path d="M${n2(P1[0])} ${n2(P1[1])} L${n2(P2[0])} ${n2(P2[1])} L${n2(P3[0])} ${n2(P3[1])}" fill="none" stroke="${o.color || COL.aux}" stroke-width="1.6"/>`,
      );
    }
    // 世界点の近くに浮かせるラベル
    function lbl(p, text, o) {
      o = o || {};
      const cx = X(p) + (o.dx || 0),
        cy = Y(p) + (o.dy || 0);
      return gWrap(
        o.from,
        o.until,
        `<text x="${n2(cx)}" y="${n2(cy)}" text-anchor="${o.anchor || "middle"}" fill="${o.color || COL.txt}" font-size="${o.size || 11}" font-weight="${o.weight || "bold"}">${text}</text>`,
      );
    }
    // 多角形（閉じる）
    function poly(names, o) {
      o = o || {};
      const d =
        names
          .map((nm, i) => (i ? "L" : "M") + n2(X(nm)) + " " + n2(Y(nm)))
          .join(" ") + " Z";
      return gWrap(
        o.from,
        o.until,
        `<path d="${d}" fill="${o.fill || "none"}" stroke="${o.color || COL.known}" stroke-width="${o.width || 2.3}"/>`,
      );
    }

    // ── グリッド＋方位（常時表示） ──
    function grid() {
      let g = "";
      // 表示範囲が広いほど目盛り間隔を粗く（密すぎる格子を回避）
      const span = Math.max(spanX, spanY);
      const gstep = span > 120 ? 20 : span > 55 ? 10 : 5;
      const gx0 = Math.ceil(minY / gstep) * gstep,
        gy0 = Math.ceil(minX / gstep) * gstep;
      for (let v = gx0; v <= maxY + 1e-6; v += gstep) {
        const sx = ox + (v - minY) * s;
        g += `<line x1="${n2(sx)}" y1="${n2(oy - 6)}" x2="${n2(sx)}" y2="${n2(oy + usedH + 6)}" stroke="${COL.grid}" stroke-width="1"/>`;
      }
      for (let v = gy0; v <= maxX + 1e-6; v += gstep) {
        const sy = oy + (maxX - v) * s;
        g += `<line x1="${n2(ox - 6)}" y1="${n2(sy)}" x2="${n2(ox + usedW + 6)}" y2="${n2(sy)}" stroke="${COL.grid}" stroke-width="1"/>`;
      }
      // 方位（左上のNコンパス）
      g += `<g opacity="0.85"><line x1="20" y1="34" x2="20" y2="16" stroke="${COL.gray}" stroke-width="1.6" marker-end="url(#cxAh)"/><text x="20" y="12" text-anchor="middle" fill="${COL.gray}" font-size="10">N(X)</text><text x="38" y="33" fill="${COL.gray}" font-size="9">E(Y)→</text></g>`;
      return g;
    }

    const b = {
      X,
      Y,
      s,
      pt,
      seg,
      vec,
      ray,
      circle,
      arc,
      rightAngle,
      lbl,
      poly,
      C: COL,
    };
    const inner = cfg.build(b);
    return `<svg viewBox="0 0 ${VB_W} ${VB_H}" xmlns="http://www.w3.org/2000/svg" class="cxsvg" preserveAspectRatio="xMidYMid meet">${markerDefs()}${grid()}${inner}</svg>`;
  }

  // 公開（app.js から参照可能に。主に検証用）
  window.CXAnim = { scene: cxScene, COL, LEGEND };

  if (typeof CALC_GUIDE === "undefined") return; // 単体読込時の保険

  const find = (id) => CALC_GUIDE.find((g) => g.id === id);
  const legendIntro = (html) =>
    html +
    `<details class="cx-legend-box"><summary class="muted small">📌 記号の約束（全テーマ共通）</summary>${LEGEND}</details>`;

  // ============================================================
  // ① 既存「内分点」にアニメを後付け
  // ============================================================
  const naib = find("naibunten");
  if (naib) {
    naib.intro = legendIntro(naib.intro);
    naib.anim = {
      scene: cxScene({
        pts: { A: [100, 100], B: [140, 130], C: [124, 118] },
        bounds: [
          [100, 96],
          [140, 134],
        ],
        build: (b) =>
          b.seg("A", "B", { color: b.C.known, width: 2.4, from: 0 }) +
          b.pt("A", { from: 0, dx: -16, dy: 6 }) +
          b.pt("B", { from: 0 }) +
          b.vec("A", "B", { color: b.C.given2, loff: 16, from: 1 }) +
          b.lbl("B", "|AB|=50m (B−A)", {
            dx: -8,
            dy: 18,
            anchor: "end",
            color: b.C.given2,
            from: 1,
          }) +
          b.lbl([110, 104], "AC=30m＝0.6倍", {
            dx: -6,
            dy: 4,
            anchor: "end",
            color: b.C.txt,
            from: 2,
          }) +
          b.pt("C", { color: b.C.ans, from: 2, dx: 10, dy: -8 }) +
          b.lbl("C", "C(124.00, 118.00)", {
            dx: 12,
            dy: 8,
            anchor: "start",
            color: b.C.ans,
            from: 3,
          }),
      }),
      steps: [
        "既知の線分ABを引く。A(100,100)→B(140,130)。まず両端の座標を確認する。",
        "方向ベクトル B−A=(40,30) を読む。全長 |AB|=√(40²+30²)=50.00m（3:4:5）。",
        "Aから線分上に AC=30m＝全体の 30/50＝0.6倍 進んだ位置が分割点C。",
        "分割点 C(124.00, 118.00) が確定。複素数なら 100+100i＋30/50×(40+30i) の1行。",
      ],
    };
  }

  // ============================================================
  // ② 既存「座標法面積」にアニメを後付け
  // ============================================================
  const area = find("zahyoho-area");
  if (area) {
    area.intro = legendIntro(area.intro);
    area.anim = {
      scene: cxScene({
        pts: { A: [100, 100], B: [140, 100], C: [150, 140], D: [110, 150] },
        build: (b) =>
          b.poly(["A", "B", "C", "D"], { color: b.C.known, from: 0 }) +
          b.pt("A", { from: 0 }) +
          b.pt("B", { from: 0 }) +
          b.pt("C", { from: 0 }) +
          b.pt("D", { from: 0, dx: 8, dy: -8 }) +
          b.seg("A", "B", {
            color: b.C.given2,
            width: 2.6,
            arrow: true,
            from: 2,
          }) +
          b.seg("B", "C", {
            color: b.C.given2,
            width: 2.6,
            arrow: true,
            from: 2,
          }) +
          b.seg("C", "D", {
            color: b.C.given2,
            width: 2.6,
            arrow: true,
            from: 2,
          }) +
          b.seg("D", "A", {
            color: b.C.given2,
            width: 2.6,
            arrow: true,
            from: 2,
          }) +
          b.lbl([125, 122], "S = 1850.00㎡", {
            color: b.C.ans,
            size: 13,
            from: 3,
          }),
      }),
      steps: [
        "筆界点 A→B→C→D を順に結んだ四角形。これを座標法（倍面積）で求積する。",
        "各点の座標を確認: A(100,100) B(140,100) C(150,140) D(110,150)。",
        "A→B→C→D→A と一周し、隣り合う座標を「たすき掛け」して足し込む（靴ひも公式）。",
        "倍面積 2S=3700 → S=1850.00㎡。宅地以外10㎡超なので登記地積1850㎡。",
      ],
    };
  }

  // ============================================================
  // ③ 新規ガイド（複素数＋通常モード／検証済み数値）
  // ============================================================
  const CMPLX = "cplx",
    CALC = "calc",
    HAND = "hand";
  const NEW = [
    // ── 外分点 ─────────────────────────────────────
    {
      id: "gaibunten",
      name: "外分点の計算（外分点C）",
      tag: "土地・分筆",
      short: "比率は −n·A＋m·B で一撃／距離は延長放射",
      intro:
        legendIntro(`<p>境界線の<b>延長線上</b>にある点（後退割・拡大）を出すのが<b>外分点</b>。線分ABを <b>m:n に外分</b>する点Cは、ABの外側（mが大きければB側の外）にある。</p>
        <p>例：A(106.863, 95.703)・B(141.436, 131.323) を <b>4:3 に外分</b>する点C。比 4:3 は「Aから4、Bから3」だから、Cは <b>Bを越えて</b> ABの方向へ進んだ位置になる。</p>`),
      anim: {
        scene: cxScene({
          pts: {
            A: [106.863, 95.703],
            B: [141.436, 131.323],
            C: [245.155, 238.183],
          },
          build: (b) =>
            b.seg("A", "B", { color: b.C.known, width: 2.6, from: 0 }) +
            b.pt("A", { from: 0 }) +
            b.pt("B", { from: 0 }) +
            b.vec("A", "B", { label: "AB方向", color: b.C.given2, from: 1 }) +
            b.seg("B", "C", { color: b.C.aux, dash: "7 5", from: 2 }) +
            b.lbl([193, 184], "延長（Bを越える）", {
              color: b.C.aux,
              from: 2,
            }) +
            b.pt("C", { color: b.C.ans, from: 3, dx: 8, dy: 5 }) +
            b.lbl("C", "C(245.155, 238.183)", {
              dx: -10,
              dy: 18,
              anchor: "end",
              color: b.C.ans,
              from: 3,
            }),
        }),
        steps: [
          "既知の線分 AB。A(106.863,95.703)→B(141.436,131.323)。",
          "ABの方向（B−A）を把握。外分点はこの方向の延長上に乗る。",
          "比 4:3（Aから4・Bから3）なので、Bを越えて ABの方向へさらに進む。",
          "外分点 C(245.155, 238.183)。複素数なら −3A＋4B の1行で出る（分母 m−n=1）。",
        ],
      },
      formula: `<b>外分点公式（m:n に外分）</b><br>
        C ＝ (−n·A ＋ m·B) ÷ (m − n)　…複素数なら点をそのまま代入<br>
        X<sub>C</sub> ＝ (−n·X<sub>A</sub> ＋ m·X<sub>B</sub>)/(m−n)、 Y<sub>C</sub> ＝ (−n·Y<sub>A</sub> ＋ m·Y<sub>B</sub>)/(m−n)<br>
        <span class="muted small">※4:3 なら m=4, n=3, m−n=1 ⟹ C＝−3A＋4B（割り算不要で最速）</span>`,
      cases: [
        {
          title: "4:3 に外分する点C",
          setup: `<p>A(106.863, 95.703)・B(141.436, 131.323)、m:n＝4:3。m−n＝1なので分母は1。</p>`,
          methods: [
            {
              cls: CMPLX,
              name: "① 複素数モード（最速・1行）",
              body: `<p>点をそのまま複素数で代入：</p>
                <p><span class="mono">−3·A ＋ 4·B</span>（STOした複素変数 A,B を使う）</p>
                <ul>
                  <li>−3A ＝ −3×(106.863＋95.703i) ＝ −320.589 − 287.109i</li>
                  <li>4B ＝ 4×(141.436＋131.323i) ＝ 565.744 ＋ 525.292i</li>
                  <li>合計 ＝ (565.744−320.589) ＋ (525.292−287.109)i ＝ <b>245.155 ＋ 238.183i</b></li>
                </ul>
                <p>∴ <b>C(245.155, 238.183)</b>。X・Yを別々に計算しなくてよい。</p>`,
            },
            {
              cls: CALC,
              name: "② 関数電卓（公式に代入）",
              body: `<p>X<sub>C</sub>＝(−3×106.863＋4×141.436)/1＝(−320.589＋565.744)＝<b>245.155</b><br>
                Y<sub>C</sub>＝(−3×95.703＋4×131.323)/1＝(−287.109＋525.292)＝<b>238.183</b></p>`,
            },
            {
              cls: HAND,
              name: "③ 手計算（延長放射でも確認）",
              body: `<p>T<sub>AB</sub>＝方向角(A→B)＝45°51′16″、|AB|＝49.639m。<br>
                外分4:3 ⟹ Aから ABの 4/(4−3)＝4倍 ＝ AC＝49.639×4＝198.558m 進む。</p>
                <p>X<sub>C</sub>＝106.863＋198.558×cos45°51′16″＝<b>245.155</b><br>
                Y<sub>C</sub>＝95.703＋198.558×sin45°51′16″＝<b>238.183</b>（複素数と一致）</p>
                <p class="trap">外分は「どちら側の外か」を比の大小で判断。m>n ならB側の外、m&lt;n ならA側の外。符号を取り違えると反対側に飛ぶ。</p>`,
            },
          ],
        },
      ],
    },

    // ── 4点指定・2直線の交点（複素数の分数の分数） ──────────
    {
      id: "intersect4",
      name: "交点①：4点指定の2直線（複素数の分数の分数）",
      tag: "交点・最重要",
      short: "直線AB×直線CD を Im の比で一撃",
      intro:
        legendIntro(`<p>2直線 <b>AB</b> と <b>CD</b> の交点P。fx-JP500の複素数モードでは「<b>割り算＝分数</b>」を2つ作り、その<b>虚部(Im)の比</b>＝倍率t で一撃で解ける（＝分数の分数）。</p>
        <p>例：A(90.648,106.205)・B(120.242,116.717)・C(122.597,103.925)・D(86.476,115.170)。</p>`),
      anim: {
        scene: cxScene({
          pts: {
            A: [90.648, 106.205],
            B: [120.242, 116.717],
            C: [122.597, 103.925],
            D: [86.476, 115.17],
            P: [102.15, 110.291],
          },
          build: (b) =>
            b.pt("A", { from: 0 }) +
            b.pt("B", { from: 0 }) +
            b.pt("C", { from: 0, color: b.C.given2 }) +
            b.pt("D", { from: 0, color: b.C.given2 }) +
            b.seg("A", "B", {
              color: b.C.known,
              ext: 14,
              width: 2.4,
              from: 1,
            }) +
            b.seg("C", "D", {
              color: b.C.given2,
              ext: 14,
              width: 2.4,
              from: 2,
            }) +
            b.pt("P", { color: b.C.ans, from: 3, dx: 9, dy: 16 }) +
            b.lbl("P", "P(102.150,110.291)", {
              dy: -10,
              color: b.C.ans,
              from: 3,
            }),
        }),
        steps: [
          "4つの既知点 A,B（直線1）と C,D（直線2）を置く。",
          "直線AB を引く（複素変数では方向 B−A）。",
          "直線CD を引く（方向 D−C）。2直線が交わる。",
          "交点 P(102.150, 110.291)。t＝Im((C−A)/(D−C))÷Im((B−A)/(D−C)) で出る。",
        ],
      },
      formula: `<b>複素数（分数の分数）</b><br>
        t ＝ Im( (C−A)/(D−C) ) ÷ Im( (B−A)/(D−C) )、 <b>P ＝ A ＋ (B−A)·t</b><br>
        <b>連立（外積）</b> r＝B−A, s＝D−C として t＝{(C−A)×s}÷(r×s)、P＝A＋t·r　（×は外積 aₓb_y−a_yb_x）`,
      cases: [
        {
          title: "直線AB×直線CDの交点P",
          setup: `<p>B−A＝(29.594,10.512)、C−A＝(31.949,−2.280)、D−C＝(−36.121,11.245)。</p>`,
          methods: [
            {
              cls: CMPLX,
              name: "① 複素数モード（分数の分数）",
              body: `<p>2つの割り算（分数）を作り、その虚部の比をとる：</p>
                <ul>
                  <li>(C−A)/(D−C) ＝ −0.8243 − <b>0.1935</b>i　→ 分子の Im＝−0.1935</li>
                  <li>(B−A)/(D−C) ＝ −0.6643 − <b>0.4978</b>i　→ 分母の Im＝−0.4978</li>
                  <li>t ＝ (−0.1935)÷(−0.4978) ＝ <b>0.3887</b></li>
                </ul>
                <p>P ＝ A ＋ (B−A)·t ＝ (90.648＋106.205i)＋(29.594＋10.512i)×0.3887</p>
                <p>＝ <b>102.150 ＋ 110.291i</b> ⟹ <b>P(102.150, 110.291)</b></p>
                <p class="muted small">入力は分数キーで Im(…)/Im(…)。OPTN→Im で虚部を取り出す。</p>`,
            },
            {
              cls: CALC,
              name: "② 関数電卓（外積で連立）",
              body: `<p>r＝B−A＝(29.594,10.512)、s＝D−C＝(−36.121,11.245)。<br>
                分母 r×s＝29.594×11.245 − 10.512×(−36.121)＝332.78＋379.74＝<b>712.52</b><br>
                分子 (C−A)×s＝31.949×11.245 − (−2.280)×(−36.121)＝359.27 − 82.36＝<b>276.91</b><br>
                t＝276.91/712.52＝<b>0.3887</b></p>
                <p>P＝A＋t·r＝(90.648＋0.3887×29.594, 106.205＋0.3887×10.512)＝<b>(102.150, 110.291)</b></p>`,
            },
            {
              cls: HAND,
              name: "③ 手計算（連立一次方程式）",
              body: `<p>直線AB上：(90.648＋29.594t, 106.205＋10.512t)／直線CD上：(122.597−36.121u, 103.925＋11.245u)。<br>
                X一致・Y一致の2式を消去法で解くと t＝0.3887。Pを<b>もう一方の直線にも代入</b>して一致を確認（記述式の検算）。</p>
                <p>⟹ <b>P(102.150, 110.291)</b></p>`,
            },
          ],
        },
      ],
    },

    // ── 2方向角指定の交点 ──────────────────────────
    {
      id: "intersect2dir",
      name: "交点②：2方向角指定（既知2点＋方向角）",
      tag: "交点・土地",
      short: "1∠E・1∠F の向きベクトルで交点を放射",
      intro:
        legendIntro(`<p>既知点A・Cから、それぞれ<b>方向角 α・β</b> が与えられたときの交点P。複素数では向きを <b>1∠α</b>（極形式）で表し、4点交点と同じ「分数の分数」で解ける。倍率tは<b>そのまま A→P の距離(m)</b>になる。</p>
        <p>例：A(90.648,106.205) 方向角α＝19°33′26″／C(122.597,103.925) 方向角β＝162°42′23″。</p>`),
      anim: {
        scene: cxScene({
          pts: {
            A: [90.648, 106.205],
            C: [122.597, 103.925],
            P: [102.15, 110.291],
          },
          bounds: [
            [108, 110],
            [90, 100],
          ],
          build: (b) =>
            b.pt("A", { from: 0, dx: -16, dy: 4 }) +
            b.pt("C", { from: 0, color: b.C.given2 }) +
            b.ray("A", 19.557, 16, {
              color: b.C.known,
              arrow: true,
              width: 2.2,
              from: 1,
            }) +
            b.arc("A", 0, 19.557, {
              rad: 22,
              label: "α",
              color: b.C.known,
              from: 1,
            }) +
            b.ray("C", 162.707, 24, {
              color: b.C.given2,
              arrow: true,
              width: 2.2,
              from: 2,
            }) +
            b.arc("C", 0, 162.707, {
              rad: 20,
              label: "β",
              color: b.C.given2,
              from: 2,
            }) +
            b.pt("P", { color: b.C.ans, from: 3, dx: 9, dy: 16 }) +
            b.lbl("P", "P(102.150,110.291)", {
              dy: -10,
              color: b.C.ans,
              from: 3,
            }),
        }),
        steps: [
          "既知の2点 A・C を置く（方向角の起点）。",
          "Aから方向角 α＝19°33′26″ の半直線を引く（北から時計回り）。",
          "Cから方向角 β＝162°42′23″ の半直線を引く。",
          "2直線の交点 P(102.150,110.291)。倍率 t＝12.206 は A→P の距離(m)。",
        ],
      },
      formula: `<b>複素数（方向角は極形式 1∠θ）</b><br>
        t ＝ Im( (C−A)/1∠β ) ÷ Im( 1∠α/1∠β )、 <b>P ＝ A ＋ 1∠α · t</b><br>
        <span class="muted small">分子・分母とも長さ(m)単位 ⟹ t はそのまま A→P の距離。負なら方向角の真逆。</span>`,
      cases: [
        {
          title: "Aから α、Cから β の交点P",
          setup: `<p>α＝19°33′26″（19.5573°）、β＝162°42′23″（162.7064°）。電卓は座標を A,C（複素変数）、角度を E,F（実数変数）に記憶。</p>`,
          methods: [
            {
              cls: CMPLX,
              name: "① 複素数モード（1∠E・1∠F）",
              body: `<p><span class="mono">A ＋ 1∠E × Im((C−A)÷(1∠F)) ÷ Im((1∠E)÷(1∠F))</span></p>
                <ul>
                  <li>(C−A)/1∠β ＝ −31.18 − <b>7.32</b>i　→ 分子 Im＝−7.32</li>
                  <li>1∠α/1∠β ＝ −0.800 − <b>0.600</b>i　→ 分母 Im＝−0.600</li>
                  <li>t ＝ (−7.32)÷(−0.600) ＝ <b>12.206m</b>（A→Pの距離）</li>
                </ul>
                <p>P ＝ A ＋ 1∠α×12.206 ＝ <b>102.150 ＋ 110.291i</b> ⟹ <b>P(102.150, 110.291)</b></p>`,
            },
            {
              cls: CALC,
              name: "② 関数電卓（向きベクトルで連立）",
              body: `<p>1∠α＝(cosα,sinα)＝(0.9422,0.3350)、1∠β＝(cosβ,sinβ)＝(−0.9548,0.2973)。C−A＝(31.949,−2.280)。<br>
                これを A＋t·(1∠α)＝C＋u·(1∠β) の連立で解くと <b>t＝12.206</b>。</p>
                <p>X<sub>P</sub>＝90.648＋12.206×0.9422＝<b>102.150</b>、Y<sub>P</sub>＝106.205＋12.206×0.3350＝<b>110.291</b></p>`,
            },
            {
              cls: HAND,
              name: "③ 手計算（放射の連立）",
              body: `<p>各点から方向角どおりに放射した式を等値し、消去法でtを解く。4点交点との違いは「方向を座標差で作るか、方向角で作るか」だけ。検算は逆にCから β·u で同じPに着くか。</p>
                <p>⟹ <b>P(102.150, 110.291)</b></p>`,
            },
          ],
        },
      ],
    },

    // ── 垂線の足と点と直線の距離 ──────────────────────
    {
      id: "perpfoot",
      name: "垂線の足F と 点と直線の距離",
      tag: "交点・土地",
      short: "Re((Q−A)/1∠α)＝AF、虚部＝離れ",
      intro:
        legendIntro(`<p>点Aを通り方向角αの直線に、外の点Qから下ろした<b>垂線の足F</b>と<b>距離QF</b>。複素数では <b>(Q−A)/1∠α</b> を作るだけで、<b>実部Re＝AF（直線方向の距離）</b>・<b>虚部Im＝QF（離れ・符号付き）</b>が同時に出る。角度を±90°する必要がない最短手筋。</p>
        <p>例：A(114.521,119.639) 方向角α＝126°00′00″／Q(110.799,137.207)。</p>`),
      anim: {
        scene: cxScene({
          pts: {
            A: [114.521, 119.639],
            Q: [110.799, 137.207],
            F: [104.881, 132.907],
          },
          bounds: [
            [120, 113],
            [99, 140],
          ],
          build: (b) =>
            b.seg("A", "F", {
              color: b.C.known,
              ext: [10, 14],
              width: 2.3,
              from: 1,
            }) +
            b.pt("A", { from: 0, dx: 8, dy: 16 }) +
            b.pt("Q", { from: 0, color: b.C.given2 }) +
            b.arc("A", 0, 126, {
              rad: 20,
              label: "α=126°",
              color: b.C.known,
              from: 1,
            }) +
            b.seg("Q", "F", {
              color: b.C.aux,
              dash: "6 4",
              width: 2,
              from: 2,
            }) +
            b.rightAngle("F", "A", "Q", { from: 2 }) +
            b.lbl([108, 135], "QF=7.315", {
              color: b.C.aux,
              anchor: "start",
              from: 2,
            }) +
            b.pt("F", { color: b.C.ans, from: 2, dx: -14, dy: -6 }) +
            b.lbl([110, 126], "AF=16.401", { color: b.C.known, from: 3 }),
        }),
        steps: [
          "直線上の点A(114.521,119.639) と、外の点Q(110.799,137.207) を置く。",
          "Aから方向角 α=126° の直線を引く。Qから直線へ垂線を下ろす（直角）。",
          "(Q−A)/1∠α の 実部=AF=16.401m、虚部=QF=7.315m が同時に出る。",
          "F＝A＋1∠α×16.401 ⟹ F(104.881, 132.907)、点と直線の距離 QF=7.315m。",
        ],
      },
      formula: `<b>複素数（一撃）</b> w ＝ (Q−A)/1∠α、 <b>AF＝Re(w)</b>、 <b>QF＝|Im(w)|</b>、 F ＝ A ＋ 1∠α·Re(w)<br>
        <b>通常モード</b> Pol(Q−A)で距離S・方向角T<sub>AQ</sub> → 挟み角 θ＝α−T<sub>AQ</sub> → AF＝S·cosθ、QF＝S·sinθ`,
      cases: [
        {
          title: "垂線の足Fと距離QF",
          setup: `<p>Q−A＝(−3.722, 17.568)。直線方向 1∠126°＝(−0.5878, 0.8090)。</p>`,
          methods: [
            {
              cls: CMPLX,
              name: "① 複素数モード（Re＝AF・Im＝QF）",
              body: `<p><span class="mono">A ＋ 1∠E × Re( (Q−A) ÷ (1∠E) )</span>（OPTN→Reで実部）</p>
                <ul>
                  <li>(Q−A)/1∠126° ＝ <b>16.4005</b> − <b>7.3151</b>i</li>
                  <li>実部 ＝ AF ＝ <b>16.401m</b>（A→F、直線に沿った距離）</li>
                  <li>虚部 ＝ QF ＝ <b>7.315m</b>（点と直線の距離。符号−は直線の右側を意味）</li>
                </ul>
                <p>F ＝ A ＋ 1∠126°×16.4005 ＝ <b>104.881 ＋ 132.907i</b> ⟹ <b>F(104.881, 132.907)</b></p>
                <p class="muted small">距離だけ欲しいなら Abs(Q−F) でも 7.315 を確認できる。</p>`,
            },
            {
              cls: CALC,
              name: "② 関数電卓（直角三角形AQF）",
              body: `<p><b>Pol(Q−A)</b>＝Pol(−3.722, 17.568) ⟹ S<sub>AQ</sub>＝17.9484m、T<sub>AQ</sub>＝101.9555°。<br>
                挟み角 θ＝α−T<sub>AQ</sub>＝126°−101.9555°＝<b>24.0445°</b></p>
                <p>AF＝S·cosθ＝17.9484×cos24.0445°＝<b>16.401m</b><br>
                QF＝S·sinθ＝17.9484×sin24.0445°＝<b>7.315m</b></p>
                <p>F＝A＋AF∠126°＝<b>(104.881, 132.907)</b>（Rec で放射）</p>`,
            },
            {
              cls: HAND,
              name: "③ 手計算（射影＝内積）",
              body: `<p>直線の単位ベクトル u＝(cos126°, sin126°)。射影 AF＝(Q−A)·u＝(−3.722)(−0.5878)＋(17.568)(0.8090)＝2.188＋14.213＝<b>16.401</b>。<br>
                F＝A＋AF·u、QF＝|Q−F|＝<b>7.315m</b>。</p>
                <p class="trap">「αに−90°するか＋90°するか」で悩まないのが複素数Re/Imの強み。図の左右に関係なく機械的に正しい足が出る。</p>`,
            },
          ],
        },
      ],
    },

    // ── 円と直線の交点 ──────────────────────────────
    {
      id: "circleline",
      name: "円と直線の交点（曲線境界）",
      tag: "交点・土地",
      short: "垂線の足F→d→三平方 t=√(r²−d²)",
      intro:
        legendIntro(`<p>中心O・半径rの円と、点Aを通り方向角αの直線の交点。<b>垂線の足F</b>を経由する方式が、途中の「中心⊥距離d」「足の座標」も小問で問われる記述式に強い。</p>
        <p>例：O(100.390,109.268) r＝8.587／A(112.191,106.971) 方向角α＝154°30′00″。X座標が小さい方の交点を求める。</p>`),
      anim: {
        scene: cxScene({
          pts: {
            O: [100.39, 109.268],
            A: [112.191, 106.971],
            F: [101.686, 111.982],
            P1: [94.425, 115.445],
            P2: [108.944, 108.52],
          },
          bounds: [
            [100.39 + 8.587, 109.268],
            [100.39 - 8.587, 109.268],
            [100.39, 109.268 + 8.587],
            [100.39, 109.268 - 8.587],
          ],
          build: (b) =>
            b.circle("O", 8.587, { color: b.C.gray, from: 0 }) +
            b.pt("O", { from: 0, color: b.C.txt, dx: 6, dy: -6 }) +
            b.pt("A", { from: 0, color: b.C.given2 }) +
            b.seg("A", "F", {
              color: b.C.known,
              ext: [4, 20],
              width: 2.2,
              from: 1,
            }) +
            b.seg("O", "F", { color: b.C.aux, dash: "5 4", from: 2 }) +
            b.rightAngle("F", "O", "A", { from: 2 }) +
            b.lbl("O", "d=3.008", {
              dx: -7,
              dy: 20,
              color: b.C.aux,
              anchor: "end",
              from: 2,
            }) +
            b.pt("F", { from: 2, color: b.C.aux, dx: 6, dy: -6 }) +
            b.pt("P2", { from: 3, color: b.C.known, label: "②" }) +
            b.pt("P1", {
              from: 3,
              color: b.C.ans,
              label: "①",
              dx: -16,
              dy: 4,
            }) +
            b.lbl([94.425, 115.445], "P(94.425,115.445)", {
              dy: 16,
              color: b.C.ans,
              from: 4,
            }),
        }),
        steps: [
          "中心O・半径r=8.587 の円と、点Aを通る直線（方向角154°30′）を置く。",
          "直線を引く。円を2点で貫く。",
          "中心Oから直線へ垂線の足F。中心⊥距離 d=3.008m が出る。",
          "三平方で t=√(r²−d²)=8.043。F±t∠α が2交点①②。",
          "X座標が小さい方＝交点① P(94.425, 115.445) を採用。",
        ],
      },
      formula: `<b>手順（複素数）</b> ① F＝A＋1∠α·Re((O−A)/1∠α)　② d＝Abs(O−F)　③ t＝√(r²−d²)　④ 交点＝F ± t·1∠α<br>
        <b>通常モード</b> Pol(O−A)→挟み角→PF＝S·cosθ・d＝S·sinθ→t＝√(r²−d²)→Aから (PF±t) 放射`,
      cases: [
        {
          title: "Xが小さい方の交点",
          setup: `<p>O−A＝(−11.801, 2.297)。1∠154.5°＝(−0.9026, 0.4305)。</p>`,
          methods: [
            {
              cls: CMPLX,
              name: "① 複素数モード（足F→三平方）",
              body: `<p><b>STEP1</b> 足F：<span class="mono">A＋1∠E×Re((O−A)÷(1∠E))</span><br>
                Re((O−A)/1∠154.5°)＝<b>11.640</b>（AF）⟹ F＝<b>101.686＋111.982i</b>（STO M）</p>
                <p><b>STEP2</b> d＝Abs(O−M)＝<b>3.008</b>（STO Y）</p>
                <p><b>STEP3</b> t＝√(8.587²−3.008²)＝<b>8.043</b>（STO X）</p>
                <p><b>STEP4</b> 交点＝M ± X×1∠E：<br>
                ・M＋X·1∠E ＝ (108.944, 108.520)<br>
                ・M−X·1∠E ＝ <b>(94.425, 115.445)</b> ← Xが小さい</p>
                <p>∴ <b>交点①(94.425, 115.445)</b></p>`,
            },
            {
              cls: CALC,
              name: "② 関数電卓（放射の足し引き）",
              body: `<p>Pol(O−A)＝Pol(−11.801,2.297) ⟹ S＝12.022、T<sub>AO</sub>＝168.962°。挟み角 θ＝168.962−154.5＝14.462°。<br>
                AF＝S·cosθ＝<b>11.640</b>、d＝S·sinθ＝<b>3.008</b>、t＝√(8.587²−3.008²)＝<b>8.043</b>。</p>
                <p>Aからの総距離＝AF−t＝11.640−8.043＝3.597… ではなく、X小側は AF＋t＝<b>19.683</b>。<br>
                X＝112.191＋19.683×cos154.5°＝<b>94.425</b>、Y＝106.971＋19.683×sin154.5°＝<b>115.445</b></p>`,
            },
            {
              cls: HAND,
              name: "③ 手計算（2次方程式）",
              body: `<p>直線を A＋t·u と置き円の式へ代入 ⟹ t²＋2bt＋c＝0。判別式の符号で交差判定（正＝2点）。2解を直線式に戻し、現地条件（X小）で採用。</p>
                <p>⟹ <b>交点①(94.425, 115.445)</b></p>`,
            },
          ],
        },
      ],
    },

    // ── 距離交会（円と円の交点） ──────────────────────
    {
      id: "distintersect",
      name: "距離交会（円と円の交点）",
      tag: "交点・土地",
      short: "余弦定理で内角→方向角に±して放射",
      intro:
        legendIntro(`<p>既知点Aから距離a、既知点Bから距離bにある新点（＝半径a,bの2円の交点）。<b>余弦定理で頂点Aの内角∠A</b>を出し、方向角 T<sub>AB</sub> に <b>±∠A</b> して距離aを放射する。図面の左右で符号(＋/−)を選ぶ。</p>
        <p>例：A(109.308,95.984) からa＝15.264／B(97.860,110.121) からb＝16.576。</p>`),
      anim: {
        scene: cxScene({
          pts: {
            A: [109.308, 95.984],
            B: [97.86, 110.121],
            P1: [94.179, 93.959],
            P2: [114.434, 110.361],
          },
          bounds: [
            [109.308 + 15.264, 95.984],
            [97.86, 110.121 + 16.576],
            [97.86 - 16.576, 110.121],
          ],
          build: (b) =>
            b.seg("A", "B", { color: b.C.gray, width: 2, from: 0 }) +
            b.lbl([103.5, 103], "c=18.191", { color: b.C.gray, from: 0 }) +
            b.pt("A", { from: 0 }) +
            b.pt("B", { from: 0, color: b.C.given2 }) +
            b.circle("A", 15.264, { color: b.C.known, dash: "5 4", from: 1 }) +
            b.lbl([116, 90], "半径a", { color: b.C.known, from: 1 }) +
            b.circle("B", 16.576, { color: b.C.given2, dash: "5 4", from: 2 }) +
            b.lbl([84, 120], "半径b", { color: b.C.given2, from: 2 }) +
            b.pt("P1", {
              from: 3,
              color: b.C.ans,
              label: "左",
              dx: -20,
              dy: 4,
            }) +
            b.pt("P2", { from: 3, color: b.C.ans, label: "右", dx: 8, dy: -6 }),
        }),
        steps: [
          "既知2点 A・B と距離 c=AB=18.191m を確認。",
          "Aを中心に半径 a=15.264 の円を描く。",
          "Bを中心に半径 b=16.576 の円を描く。2円は2点で交わる。",
          "交点は左(94.179,93.959)・右(114.434,110.361)。図面に合う側を採る。",
        ],
      },
      formula: `<b>余弦定理で内角</b> ∠A ＝ cos⁻¹( (a²＋c²−b²) ÷ (2ac) )、 c＝Abs(B−A)、 T<sub>AB</sub>＝arg(B−A)<br>
        <b>新点</b> P ＝ A ＋ a∠(T<sub>AB</sub> ± ∠A)　（＋＝左手側／−＝右手側）`,
      cases: [
        {
          title: "2円の交点（左・右）",
          setup: `<p>c＝Abs(B−A)＝18.191m、T<sub>AB</sub>＝129°00′01″。a＝15.264, b＝16.576。</p>`,
          methods: [
            {
              cls: CMPLX,
              name: "① 複素数モード（距離・方向角を一発）",
              body: `<p>c＝<span class="mono">Abs(B−A)</span>＝<b>18.191</b>（STO C）、 T<sub>AB</sub>＝<span class="mono">arg(B−A)</span>＝<b>129°00′01″</b>（STO F）</p>
                <p>内角：<span class="mono">cos⁻¹((15.264²＋C²−16.576²)÷(2×15.264×C))</span>＝<b>58°37′26″</b>（STO D）</p>
                <p>新点：<span class="mono">A ＋ 15.264∠(F ± D)</span><br>
                ・F＋D（左手側）＝187°37′26″ ⟹ <b>(94.179, 93.959)</b><br>
                ・F−D（右手側）＝70°22′35″ ⟹ <b>(114.434, 110.361)</b></p>`,
            },
            {
              cls: CALC,
              name: "② 関数電卓（Pol＋方向角加減）",
              body: `<p>Pol(B−A)＝Pol(−11.448,14.137) ⟹ c＝<b>18.191</b>、T<sub>AB</sub>＝<b>129.0002°</b>。<br>
                ∠A＝cos⁻¹((15.264²＋18.191²−16.576²)/(2×15.264×18.191))＝<b>58.6238°</b>。</p>
                <p>左：T<sub>AB</sub>＋∠A＝187.6240° → Rec(15.264, 187.6240)をAへ加算＝<b>(94.179, 93.959)</b><br>
                右：T<sub>AB</sub>−∠A＝70.3764° → 同様に＝<b>(114.434, 110.361)</b></p>`,
            },
            {
              cls: HAND,
              name: "③ 手計算（3辺→内角→放射）",
              body: `<p>三角形ABの3辺 a,b,c から余弦定理で∠A。方向角 T<sub>AB</sub> に内角を足す（左回り）か引く（右回り）かを<b>図面で判断</b>し、距離aで放射。</p>
                <p class="trap">2解が必ず出る。試験では「直線ABの左／右どちら側か」を必ず確認し、要らない方を捨てる。</p>`,
            },
          ],
        },
      ],
    },
  ];

  // 追加（交点系は既存「交点計算（5パターン）」概論の直後に置くと探しやすい）
  const at = CALC_GUIDE.findIndex((g) => g.id === "koten");
  if (at >= 0) CALC_GUIDE.splice(at + 1, 0, ...NEW);
  else CALC_GUIDE.push(...NEW);
})();
