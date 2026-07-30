// 記述式（書式）実践問題テンプレート。
//
// 各要素は「メタ情報 + build(rng)」。build は written-gen.js のヘルパーを使って、
// 座標値・地目・地番・当事者・日付を毎回振り直した問題を1問ぶん組み立てる。
// → 同じ問題を二度解くことがないので、答えを覚えて解いた気になるのを防ぐ。
//
// combo を持つテンプレートは複合登記（本試験の主戦場）。複合では「一の申請情報でまとめられるか、
// 連件になるか」が最大の得点源なので、申請件数と各件の登記の目的を必ず問う。
//
// 座標系: X=北(+), Y=東(+)。tasks は数値解答（tol=許容誤差）、appForm は申請書の穴埋め。

// ─────────── 建物用のパラメータ源 ───────────
const _W_STRUCT = [
  { zai: "木造", yane: ["かわらぶき", "スレートぶき", "亜鉛メッキ鋼板ぶき"] },
  { zai: "鉄筋コンクリート造", yane: ["陸屋根"] },
  { zai: "鉄骨造", yane: ["亜鉛メッキ鋼板ぶき", "スレートぶき"] },
  { zai: "軽量鉄骨造", yane: ["亜鉛メッキ鋼板ぶき"] },
];
const _W_KAISU = ["平家建", "2階建", "2階建", "3階建"];
const _W_SHURUI = [
  { name: "居宅", desc: "もっぱら居住の用に供する" },
  { name: "店舗", desc: "もっぱら物品の販売の用に供する" },
  { name: "事務所", desc: "もっぱら事務の用に供する" },
  { name: "倉庫", desc: "もっぱら物品の保管の用に供する" },
];

// 構造（構成材料＋屋根の種類＋階数）を1つ作る
function _wStruct(rng, kaisu) {
  const s = wgPick(rng, _W_STRUCT);
  const k = kaisu || wgPick(rng, _W_KAISU);
  return { text: s.zai + wgPick(rng, s.yane) + k, kaisu: k };
}

// 最大公約数（敷地権の割合を約分するのに使う）
function _wGcd(a, b) {
  return b === 0 ? a : _wGcd(b, a % b);
}

// 床面積は規則115条により 0.01㎡未満を切り捨てる
function _wYuka(area) {
  return Math.floor(area * 100 + 1e-9) / 100;
}

// ─────────── 分筆系テンプレートの共通土台 ───────────
// 事案文・座標表・図形・交点/求積タスクまで組み立てて返す。
// 呼び出し側は「どの登記か」に応じて statement の前後と appForm を足すだけでよい。
//
// o: { mode:"clean"|"real", geo, chimokuPool, digits }
function _wBunpitsuCore(rng, o) {
  o = o || {};
  const sh = wgBunpitsuShape(rng, { mode: o.mode, geo: o.geo });
  if (!sh) return null;

  const dg = o.digits === undefined ? (o.mode === "real" ? 3 : 2) : o.digits;
  const chimoku = wgPick(
    rng,
    o.chimokuPool || WG_CHIMOKU_FINE.concat(WG_CHIMOKU_COARSE),
  );
  const chiban = wgChiban(rng);
  const owner = wgPerson(rng);
  const shiho = wgPerson(rng);
  const shozai = wgShozai(rng);
  const date = wgDate(rng);

  // 残地を西・東のどちらにするかも毎回入れ替える（「残地はいつも東」と覚えるのを防ぐ）
  const zanchiWest = rng() < 0.5;
  const westName = zanchiWest ? chiban.split[0] : chiban.split[1];
  const eastName = zanchiWest ? chiban.split[1] : chiban.split[0];

  const westPts = [sh.A, sh.P, sh.Q, sh.D_];
  const eastPts = [sh.P, sh.B, sh.C, sh.Q];
  const gW = wgChiseki(sh.areaW, chimoku);
  const gE = wgChiseki(sh.areaE, chimoku);
  const total = +(gW + gE).toFixed(2);

  const coords = wgCoordRows([
    ["A", sh.A, "北側筆界（西）"],
    ["B", sh.B, "北側筆界（東）"],
    ["C", sh.C, "南側筆界（東）"],
    ["D", sh.D_, "南側筆界（西）"],
    ["K", sh.K, "分筆線上の境界標"],
    ["L", sh.L, "分筆線上の境界標"],
  ]);

  const mid = (pts) => [
    pts.reduce((s, p) => s + p[0], 0) / pts.length,
    pts.reduce((s, p) => s + p[1], 0) / pts.length,
  ];
  const figure = {
    points: {
      A: sh.A,
      B: sh.B,
      C: sh.C,
      D: sh.D_,
      K: sh.K,
      L: sh.L,
      P: sh.P,
      Q: sh.Q,
    },
    polys: [["A", "B", "C", "D"]],
    lines: [
      ["K", "L"],
      ["P", "Q"],
    ],
    revealPoints: ["P", "Q"],
    areaLabels: [
      {
        at: mid(westPts),
        text: `${westName} (${wgChisekiText(gW, chimoku)}㎡)`,
      },
      {
        at: mid(eastPts),
        text: `${eastName} (${wgChisekiText(gE, chimoku)}㎡)`,
      },
    ],
  };

  // 〔事実関係〕の測量・分筆に関する項目。事案によって前置きの項目数が変わるので、
  // 開始番号を受け取って通し番号を振る（本試験と同じ全角数字）。
  const WIDE_NUM = ["０", "１", "２", "３", "４", "５", "６", "７", "８", "９"];
  const sokuteiNote = (start) => {
    let n = start === undefined ? 2 : start;
    const item = (html) => `<p>${WIDE_NUM[n++]}　${html}</p>`;
    return (
      item(
        `甲土地の筆界点は北側からＡ・Ｂ（北側筆界ＡＢ）、南側にＣ・Ｄ（南側筆界ＤＣ）であり、` +
          `${sh.geo ? "世界測地系（平面直角座標系）" : "任意座標系"}による座標値は〔測量の結果〕のとおりである。`,
      ) +
      item(
        `分筆線は、現地に設置された境界標<b>Ｋ及びＬ</b>を結ぶ直線ＫＬとする。直線ＫＬと北側筆界ＡＢとの交点を<b>Ｐ</b>、` +
          `南側筆界ＤＣとの交点を<b>Ｑ</b>とし、直線ＰＱをもって分筆する。`,
      ) +
      item(
        `分筆後、<b>西側（Ａ・Ｄ側）を ${westName}</b>、<b>東側（Ｂ・Ｃ側）を ${eastName}</b> とする` +
          `（${zanchiWest ? westName : eastName} が残地）。`,
      ) +
      item(
        `座標値・辺長は小数第${dg === 3 ? "３" : "２"}位までとし、地積は不動産登記規則第100条による。`,
      )
    );
  };

  // 不動産の表示（従前）
  const bukkenLine =
    `<p class="small">所　在　${shozai}／地　番　${chiban.text}／地　目　<b>${chimoku}</b>` +
    `／地　積　<b>${wgChisekiText(total, chimoku)}㎡</b>（登記記録）／所有権登記名義人　${owner}</p>`;

  const crossTasks = wgCrossTasks(sh, dg);
  // 地積測量図に記入する辺長。求積だけできても図面に書けなければ点にならないので、
  // 図面の記載事項そのものを設問にする（座標は生成済みなので正答は一意に決まる）。
  const henchoTasks = [
    {
      q: `地積測量図に記入する<b>分筆線ＰＱの辺長</b>を求めよ（小数第${dg === 3 ? "３" : "２"}位まで）。`,
      unit: "m",
      answer: +wgDist(sh.P, sh.Q).toFixed(dg),
      tol: 0.005,
      pts: 3,
      expl:
        `ΔX=${(sh.Q[0] - sh.P[0]).toFixed(dg)}、ΔY=${(sh.Q[1] - sh.P[1]).toFixed(dg)} より ` +
        mathml("\\sqrt{ΔX^{2} ＋ ΔY^{2}}", true) +
        `<p style="text-align:center;margin:0">＝ <b>${wgDist(sh.P, sh.Q).toFixed(dg)}m</b></p>` +
        `辺長は<b>規則77条1項の記録事項</b>で、記入漏れは減点対象。`,
    },
    {
      q: `地積測量図に記入する<b>北側筆界ＡＰの辺長</b>を求めよ（小数第${dg === 3 ? "３" : "２"}位まで）。`,
      unit: "m",
      answer: +wgDist(sh.A, sh.P).toFixed(dg),
      tol: 0.005,
      pts: 2,
      expl:
        `Ａ・Ｐはともに X=${sh.xN.toFixed(dg)} の直線上にあるので、辺長はＹ座標の差＝` +
        `|${sh.P[1].toFixed(dg)}−${sh.A[1].toFixed(dg)}|=<b>${wgDist(sh.A, sh.P).toFixed(dg)}m</b>。`,
    },
  ];
  const at = wgAreaTasks({
    label1: `${westName}（西側 Ａ・Ｐ・Ｑ・Ｄ）`,
    pts1: westPts,
    chimoku1: chimoku,
    label2: `${eastName}（東側 Ｐ・Ｂ・Ｃ・Ｑ）`,
    pts2: eastPts,
    chimoku2: chimoku,
    digits: dg,
  });

  return {
    sh: sh,
    dg: dg,
    // 検証用の答え合わせ情報（scripts/study/test_written_gen.mjs が独立計算で突き合わせる）。
    // 画面には出さないが、生成問題の正しさを機械的に保証するための正本。
    verify: {
      kind: "bunpitsu",
      parcels: [
        { poly: ["A", "P", "Q", "D"], chimoku: chimoku, chiseki: gW },
        { poly: ["P", "B", "C", "Q"], chimoku: chimoku, chiseki: gE },
      ],
      tokiChiseki: total,
      seiChiseki: total,
      kousei: false,
    },
    chimoku: chimoku,
    chiban: chiban,
    owner: owner,
    shiho: shiho,
    shozai: shozai,
    date: date,
    westName: westName,
    eastName: eastName,
    zanchiWest: zanchiWest,
    westPts: westPts,
    eastPts: eastPts,
    gW: gW,
    gE: gE,
    total: total,
    coords: coords,
    figure: figure,
    sokuteiNote: sokuteiNote,
    bukkenLine: bukkenLine,
    // 交点 → 求積 → 図面に記入する辺長、の順で解かせる（本試験の作業順と同じ）
    tasks: crossTasks.concat(at.tasks, henchoTasks),
    figureChecks: wgFigChecks("chisekiSokuryo", [
      `分筆線ＰＱを図示し、交点Ｐ・Ｑに符号を付した`,
      `残地（${zanchiWest ? westName : eastName}）の求積を省略していない`,
    ]),
  };
}

const WRITTEN = [
  // ═══════════════ 土地・単独登記 ═══════════════
  {
    id: "W01",
    type: "土地",
    title: "土地分筆登記（交点計算＋座標法求積）",
    target: "目標55分",
    build(rng) {
      const b = _wBunpitsuCore(rng, { mode: "clean" });
      if (!b) return null;
      const tax = wgBunpitsuTax(2);
      return {
        statement:
          `<p><b>【事案】</b> ${b.owner}は、所有する下記の土地（以下「甲土地」という。）のうち一方の部分を売却するため、` +
          `${b.date.text}、土地家屋調査士${b.shiho}に分筆の登記の申請手続を依頼した。</p>` +
          b.bukkenLine +
          b.sokuteiNote(1),
        coords: b.coords,
        tasks: b.tasks,
        appForm: wgRenkenForm(
          1,
          [
            {
              answer: "土地分筆登記",
              hint: "不動産種別から書く。「分筆登記」だけでは不正確",
            },
          ],
          "分筆の登記だけなので一の申請情報",
        ).concat([
          {
            label: "登記原因及びその日付",
            answer: ["記載しない", "記載を要しない", "なし"],
            hint: "分筆の登記に登記原因はない",
          },
          {
            label: "申請人の資格",
            answer: ["所有権登記名義人", "所有権の登記名義人"],
            hint: "法39条1項",
          },
          {
            label: "添付情報（図面）",
            answer: "地積測量図",
            hint: "分筆に必須（規則77条）",
          },
          {
            label: "登録免許税",
            answer: wgYenAccepts(tax),
            hint: "分筆後の筆数×1,000円",
            pts: 2,
          },
          {
            label: `分筆後 ${b.westName} の地積`,
            answer: wgChisekiAccepts(b.gW, b.chimoku),
            hint: "不動産の表示欄に記載",
            pts: 2,
          },
        ]),
        verify: b.verify,
        figure: b.figure,
        figureChecks: b.figureChecks,
      };
    },
  },

  {
    id: "W02",
    type: "土地",
    title: "土地地積更正登記（座標法求積）",
    target: "目標30分",
    build(rng) {
      const chimoku = wgPick(rng, WG_CHIMOKU_FINE.concat(WG_CHIMOKU_COARSE));
      const chiban = wgChiban(rng);
      const owner = wgPerson(rng);
      const shiho = wgPerson(rng);
      const shozai = wgShozai(rng);
      // 実測用の四角形。整数座標なので座標法の値は厳密。
      const x0 = wgInt(rng, 95, 115);
      const y0 = wgInt(rng, 95, 115);
      const h = wgPick(rng, [8, 10, 12, 14, 16, 18]);
      const w = wgPick(rng, [10, 12, 14, 16, 18, 20]);
      const A = [x0, y0];
      const B = [x0 + h, y0];
      const C = [x0 + h + wgPick(rng, [1, 2, 3]), y0 + w];
      const D = [x0 - wgPick(rng, [1, 2, 3]), y0 + w - wgPick(rng, [0, 1, 2])];
      const pts = [A, B, C, D];
      const area = wgArea(pts);
      const seikai = wgChiseki(area, chimoku);
      // 登記地積は実測とずらす（これが更正の理由）
      const zure = wgPick(rng, [-9, -7, -5, -4, 4, 5, 6, 8]);
      const toki = wgChiseki(seikai + zure, chimoku);
      return {
        statement:
          `<p><b>【事案】</b> 下記の土地（以下「乙土地」という。）について、所有権の登記名義人である${owner}から、` +
          `登記記録上の地積が実測と相違しているとして、土地家屋調査士${shiho}が地積に関する更正の登記の依頼を受けた。` +
          `測量の結果、筆界点Ａ・Ｂ・Ｃ・Ｄの座標値は〔測量の結果〕のとおりであり、<b>筆界について争いはない</b>。</p>` +
          `<p class="small">所　在　${shozai}／地　番　${chiban.text}／地　目　<b>${chimoku}</b>／地　積　<b>${wgChisekiText(toki, chimoku)}㎡</b>（登記記録）</p>` +
          `<p>※ 倍面積・面積は小数第2位まで、地積は規則100条による。</p>`,
        coords: wgCoordRows([
          ["A", A],
          ["B", B],
          ["C", C],
          ["D", D],
        ]),
        tasks: [
          {
            q: "倍面積（座標法）を求めよ。",
            unit: "",
            answer: +wgDoubleArea(pts).toFixed(2),
            tol: 0.02,
            pts: 3,
            expl: `倍面積＝|ΣXᵢ(Yᵢ₊₁−Yᵢ₋₁)|＝<b>${wgDoubleArea(pts).toFixed(2)}</b>`,
          },
          {
            q: "乙土地の面積を求めよ（小数第2位まで）。",
            unit: "㎡",
            answer: +area.toFixed(2),
            tol: 0.02,
            pts: 3,
            expl: `倍面積÷2＝<b>${area.toFixed(2)}㎡</b>`,
          },
          {
            q: "更正後の登記すべき地積を答えよ。",
            unit: "㎡",
            answer: seikai,
            tol: 0,
            pts: 4,
            expl: `${wgChisekiRule(chimoku)}⟹ <b>${wgChisekiText(seikai, chimoku)}㎡</b>。登記地積 ${wgChisekiText(toki, chimoku)}㎡ → ${wgChisekiText(seikai, chimoku)}㎡ へ更正する。`,
          },
          {
            q: "辺ＡＢの長さを求めよ（小数第2位まで）。",
            unit: "m",
            answer: +wgDist(A, B).toFixed(2),
            tol: 0.02,
            pts: 2,
            expl: `ΔX=${(B[0] - A[0]).toFixed(2)}, ΔY=${(B[1] - A[1]).toFixed(2)} ⟹ <b>${wgDist(A, B).toFixed(2)}m</b>`,
          },
          {
            q: "辺ＢＣの長さを求めよ（小数第2位まで）。",
            unit: "m",
            answer: +wgDist(B, C).toFixed(2),
            tol: 0.02,
            pts: 2,
            expl:
              mathml("\\sqrt{ΔX^{2} ＋ ΔY^{2}}", true) +
              `<p style="text-align:center;margin:0">＝ √(${(C[0] - B[0]).toFixed(2)}² ＋ ${(C[1] - B[1]).toFixed(2)}²) ＝ <b>${wgDist(B, C).toFixed(2)}m</b></p><p class="muted small">辺長は小数第2位まで。</p>`,
          },
        ],
        appForm: wgRenkenForm(1, [
          {
            answer: "土地地積更正登記",
            hint: "不動産種別＋「地積更正」を含める",
          },
        ]).concat([
          { label: "添付情報（図面）", answer: "地積測量図", hint: "" },
          {
            label: "登録免許税",
            answer: WG_NONTAX_ACCEPTS,
            hint: "表示に関する登記は非課税（「なし」と入力）",
          },
          {
            label: "この登記の申請義務の有無（あり／なし）",
            answer: ["なし", "無"],
            hint: "地積更正は義務か任意か",
            pts: 2,
          },
        ]),
        figure: {
          points: { A: A, B: B, C: C, D: D },
          polys: [["A", "B", "C", "D"]],
          lines: [],
          revealPoints: [],
          areaLabels: [
            {
              at: [
                (A[0] + B[0] + C[0] + D[0]) / 4,
                (A[1] + B[1] + C[1] + D[1]) / 4,
              ],
              text: `${chiban.text} ${area.toFixed(2)}㎡`,
            },
          ],
        },
      };
    },
  },

  {
    id: "W05",
    type: "土地",
    title: "土地分筆登記（世界測地系・本試験形式）",
    target: "目標55分",
    build(rng) {
      const b = _wBunpitsuCore(rng, { mode: "real", geo: true });
      if (!b) return null;
      const tax = wgBunpitsuTax(2);
      return {
        statement:
          `<p><b>第１問</b>　次の〔事実関係〕及び〔測量の結果〕に基づき、土地家屋調査士${b.shiho}が申請すべき登記の申請情報の内容等を答えよ。</p>` +
          `<p><b>〔事実関係〕</b></p>` +
          `<p>１　${b.owner}は、その所有する下記の土地（以下「甲土地」という。）のうち一方の部分を売却するため、` +
          `${b.date.text}、土地家屋調査士${b.shiho}に分筆の登記の申請手続を依頼した。</p>` +
          b.bukkenLine +
          b.sokuteiNote(2),
        coords: b.coords,
        tasks: b.tasks,
        appForm: wgRenkenForm(1, [
          { answer: "土地分筆登記", hint: "不動産種別から書く" },
        ]).concat([
          {
            label: "登記原因及びその日付",
            answer: ["記載しない", "記載を要しない", "なし"],
            hint: "分筆の登記に登記原因はない",
            pts: 2,
          },
          {
            label: "申請人",
            answer: b.owner,
            hint: `所有権登記名義人。代理人は土地家屋調査士${b.shiho}`,
          },
          {
            label: "添付情報（図面）",
            answer: "地積測量図",
            hint: "ほかに代理権限証明情報",
          },
          {
            label: "登録免許税",
            answer: wgYenAccepts(tax),
            hint: "分筆後の筆数×1,000円",
            pts: 2,
          },
          {
            label: `分筆後 ${b.westName} の地積`,
            answer: wgChisekiAccepts(b.gW, b.chimoku),
            hint: "不動産の表示欄",
            pts: 2,
          },
          {
            label: `分筆後 ${b.eastName} の地積`,
            answer: wgChisekiAccepts(b.gE, b.chimoku),
            hint: "不動産の表示欄",
            pts: 2,
          },
        ]),
        verify: b.verify,
        figure: b.figure,
        figureChecks: b.figureChecks,
      };
    },
  },

  {
    id: "W08",
    type: "土地",
    title: "土地分筆登記（方向角・辺長つき）",
    target: "目標50分",
    build(rng) {
      const b = _wBunpitsuCore(rng, { mode: "clean" });
      if (!b) return null;
      const sh = b.sh;
      // 方向角は北（X軸正方向）から時計回り。atan2(ΔY, ΔX) を 0〜360度に正規化する。
      const dx = sh.Q[0] - sh.P[0],
        dy = sh.Q[1] - sh.P[1];
      let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (deg < 0) deg += 360;
      const d = Math.floor(deg);
      const mi = Math.floor((deg - d) * 60);
      const se = Math.round(((deg - d) * 60 - mi) * 60);
      const tax = wgBunpitsuTax(2);
      return {
        statement:
          `<p><b>【事案】</b> ${b.owner}は、所有する下記の土地（以下「甲土地」という。）の分筆の登記を土地家屋調査士${b.shiho}に依頼した。</p>` +
          b.bukkenLine +
          b.sokuteiNote(1) +
          `<p>５　分筆線ＰＱの<b>方向角</b>（北を0度とし時計回りに測った角）も求めること。</p>`,
        coords: b.coords,
        tasks: b.tasks.concat([
          {
            q: "分筆線ＰからＱに対する方向角を求めよ（度・小数第4位まで）。",
            unit: "度",
            answer: +deg.toFixed(4),
            tol: 0.01,
            pts: 4,
            expl:
              `方向角は北（X軸正方向）から時計回り。tan θ＝ΔY／ΔX で ΔX=${dx.toFixed(2)}, ΔY=${dy.toFixed(2)}。<br>` +
              `θ＝atan2(ΔY, ΔX)＝<b>${deg.toFixed(4)}度</b>（＝${d}°${mi}′${se}″）。<br>` +
              `<b>象限の判断が要</b>: ΔXが負なら第2・第3象限になるので、電卓のatanの値に180度を加える。負の値になったら360度を加えて0〜360度に収める。`,
          },
        ]),
        appForm: wgRenkenForm(1, [{ answer: "土地分筆登記", hint: "" }]).concat(
          [
            {
              label: "添付情報（図面）",
              answer: "地積測量図",
              hint: "分筆に必須（規則77条）",
            },
            {
              label: "登録免許税",
              answer: wgYenAccepts(tax),
              hint: "分筆後の筆数×1,000円",
              pts: 2,
            },
            {
              label: "地積測量図に記録する筆界点間の距離の単位",
              answer: ["小数第2位", "0.01m", "センチメートル"],
              hint: "辺長は何位まで記録するか",
            },
          ],
        ),
        verify: b.verify,
        figure: b.figure,
        figureChecks: b.figureChecks,
      };
    },
  },

  {
    id: "W13",
    type: "土地",
    title: "土地分筆登記（世界測地系・農地・本試験形式）",
    target: "目標55分",
    build(rng) {
      const b = _wBunpitsuCore(rng, {
        mode: "real",
        geo: true,
        chimokuPool: WG_CHIMOKU_COARSE,
      });
      if (!b) return null;
      const tax = wgBunpitsuTax(2);
      return {
        statement:
          `<p><b>第１問</b>　次の〔事実関係〕及び〔測量の結果〕に基づき、土地家屋調査士が申請すべき登記の申請情報の内容等を答えよ。</p>` +
          `<p><b>〔事実関係〕</b></p>` +
          `<p>１　${b.owner}は、その所有する下記の土地（以下「甲土地」という。）の一部を分筆するため、土地家屋調査士${b.shiho}に分筆の登記の申請手続を依頼した。</p>` +
          b.bukkenLine +
          b.sokuteiNote(2) +
          `<p class="small">※ 地目が<b>${b.chimoku}</b>であることに注意して地積の端数処理を判断せよ。</p>`,
        coords: b.coords,
        tasks: b.tasks,
        appForm: wgRenkenForm(1, [{ answer: "土地分筆登記", hint: "" }]).concat(
          [
            {
              label: "登記原因及びその日付",
              answer: ["記載しない", "記載を要しない", "なし"],
              hint: "分筆の登記に登記原因はない",
            },
            { label: "添付情報（図面）", answer: "地積測量図", hint: "" },
            {
              label: "登録免許税",
              answer: wgYenAccepts(tax),
              hint: "分筆後の筆数×1,000円",
              pts: 2,
            },
            {
              label: "地積の端数処理（1㎡未満切捨／0.01㎡未満切捨）",
              answer: [
                "1㎡未満切捨",
                "1平方メートル未満切捨",
                "1㎡未満を切捨て",
              ],
              hint: `${b.chimoku}で10㎡超のとき（規則100条）`,
              pts: 2,
            },
          ],
        ),
        verify: b.verify,
        figure: b.figure,
        figureChecks: b.figureChecks,
      };
    },
  },

  {
    id: "W07",
    type: "土地",
    title: "土地合筆登記（41条の合筆制限・合筆後の地積）",
    target: "目標30分",
    build(rng) {
      const sh = wgGappitsuShape(rng, {});
      const chimoku = wgPick(rng, WG_CHIMOKU_FINE.concat(WG_CHIMOKU_COARSE));
      const owner = wgPerson(rng);
      const shiho = wgPerson(rng);
      const shozai = wgShozai(rng);
      const n1 = wgInt(rng, 3, 60);
      const n2 = n1 + wgPick(rng, [1, 2]);
      const gKou = wgChiseki(sh.areaKou, chimoku);
      const gOtsu = wgChiseki(sh.areaOtsu, chimoku);
      const tax = wgGappitsuTax(1);
      return {
        statement:
          `<p><b>【事案】</b> ${owner}は、相互に<b>接続する</b>2筆の土地を1筆にまとめたいと考え、土地家屋調査士${shiho}に合筆の登記を依頼した。` +
          `2筆はいずれも<b>地目 ${chimoku}</b>、所有権登記名義人はいずれも${owner}であり、<b>所有権以外の権利に関する登記はない</b>。字も同一である。</p>` +
          `<p class="small">甲土地: 所在 ${shozai}／地番 <b>${n1}番</b>／地目 ${chimoku}　　乙土地: 所在 ${shozai}／地番 <b>${n2}番</b>／地目 ${chimoku}（甲の南側に接続）</p>` +
          `<p>※ 合筆の可否は不登法41条による。座標値は小数第2位まで、地積は規則100条による。</p>`,
        coords: wgCoordRows([
          ["A", sh.A, "甲・北西"],
          ["B", sh.B, "甲・北東"],
          ["C", sh.C, "甲乙の境・東"],
          ["D", sh.D, "甲乙の境・西"],
          ["E", sh.E, "乙・南東"],
          ["F", sh.F, "乙・南西"],
        ]),
        tasks: [
          {
            q: `甲土地（${n1}番）の地積を座標法で求めよ。`,
            unit: "㎡",
            answer: gKou,
            tol: 0.02,
            pts: 3,
            expl: `Ａ・Ｂ・Ｃ・Ｄは ${sh.h1}m×${sh.w}m ⟹ <b>${wgChisekiText(gKou, chimoku)}㎡</b>`,
          },
          {
            q: `乙土地（${n2}番）の地積を求めよ。`,
            unit: "㎡",
            answer: gOtsu,
            tol: 0.02,
            pts: 3,
            expl: `Ｄ・Ｃ・Ｅ・Ｆは ${sh.h2}m×${sh.w}m ⟹ <b>${wgChisekiText(gOtsu, chimoku)}㎡</b>`,
          },
          {
            q: "合筆後の土地の地積を求めよ。",
            unit: "㎡",
            answer: +(gKou + gOtsu).toFixed(2),
            tol: 0.02,
            pts: 4,
            expl:
              `合筆は各筆の地積を合算する ⟹ ${wgChisekiText(gKou, chimoku)}＋${wgChisekiText(gOtsu, chimoku)}=<b>${(gKou + gOtsu).toFixed(2)}㎡</b>。<br>` +
              `本問は<b>接続・同一地目・同一所有者・同一字・所有権以外の権利の登記なし</b>で41条の制限に該当せず<b>合筆できる</b>。`,
          },
        ],
        appForm: wgRenkenForm(1, [
          { answer: "土地合筆登記", hint: "不動産種別から書く" },
        ]).concat([
          {
            label: "合筆後の地番",
            answer: [n1 + "番", String(n1)],
            hint: "合筆前の首位（若い）地番を用いる",
            pts: 2,
          },
          {
            label: "添付情報（図面）",
            answer: ["なし", "不要", "提供を要しない"],
            hint: "合筆に地積測量図は必要か（分筆と異なる）",
            pts: 2,
          },
          {
            label: "登録免許税",
            answer: wgYenAccepts(tax),
            hint: "合筆後の筆数×1,000円",
            pts: 2,
          },
          {
            label: "申請人の資格",
            answer: ["所有権登記名義人", "所有権の登記名義人"],
            hint: "法39条1項。表題部所有者では申請できない場合に注意",
          },
          {
            label: "この登記の申請義務の有無（あり／なし）",
            answer: ["なし", "無"],
            hint: "合筆は任意",
          },
        ]),
        figure: {
          points: {
            A: sh.A,
            B: sh.B,
            C: sh.C,
            D: sh.D,
            E: sh.E,
            F: sh.F,
          },
          polys: [
            ["A", "B", "C", "D"],
            ["D", "C", "E", "F"],
          ],
          lines: [],
          revealPoints: [],
          areaLabels: [
            {
              at: [(sh.A[0] + sh.C[0]) / 2, (sh.A[1] + sh.C[1]) / 2],
              text: `${n1}番 ${wgChisekiText(gKou, chimoku)}㎡`,
            },
            {
              at: [(sh.D[0] + sh.E[0]) / 2, (sh.D[1] + sh.E[1]) / 2],
              text: `${n2}番 ${wgChisekiText(gOtsu, chimoku)}㎡`,
            },
          ],
        },
      };
    },
  },

  {
    id: "W11",
    type: "土地",
    title: "土地地積更正登記（世界測地系・端数処理の分岐）",
    target: "目標35分",
    build(rng) {
      const chimoku = wgPick(rng, WG_CHIMOKU_COARSE);
      const chiban = wgChiban(rng);
      const owner = wgPerson(rng);
      const shiho = wgPerson(rng);
      const shozai = wgShozai(rng);
      const off = wgGeoOffset(rng);
      const h = wgPick(rng, [16, 18, 20, 22, 24]);
      const w = wgPick(rng, [26, 28, 30, 32, 34]);
      const mv = (p) => [p[0] + off.x, p[1] + off.y];
      // 南北の辺をわずかにずらして、面積に端数が出るようにする
      const A = mv([0, 0]);
      const B = mv([0, w]);
      const C = mv([-h, w + wgPick(rng, [3, 5, 7])]);
      const D = mv([-h, wgPick(rng, [1, 3, 5])]);
      const pts = [A, B, C, D];
      const area = wgArea(pts);
      const seikai = wgChiseki(area, chimoku);
      const zure = wgPick(rng, [-22, -18, -14, 12, 16, 20]);
      const toki = wgChiseki(seikai + zure, chimoku);
      // 宅地だった場合の地積（端数処理の違いを解説で対比させる）
      const asTakuchi = wgChiseki(area, "宅地");
      return {
        statement:
          `<p><b>【事案】</b> 下記の土地（以下「丙土地」という。）について、所有権登記名義人${owner}から、` +
          `登記地積が実測と相違しているとして、土地家屋調査士${shiho}が地積更正の登記の依頼を受けた。` +
          `世界測地系（平面直角座標系）による筆界点Ａ・Ｂ・Ｃ・Ｄの座標値は〔測量の結果〕のとおりで、筆界に争いはない。</p>` +
          `<p class="small">所　在　${shozai}／地　番　${chiban.text}／地　目　<b>${chimoku}</b>／地　積　<b>${wgChisekiText(toki, chimoku)}㎡</b>（登記記録）</p>` +
          `<p>※ 倍面積・面積は小数第2位、地積は規則100条による。</p>`,
        coords: wgCoordRows([
          ["A", A],
          ["B", B],
          ["C", C],
          ["D", D],
        ]),
        tasks: [
          {
            q: "倍面積（座標法）を求めよ。",
            unit: "",
            answer: +wgDoubleArea(pts).toFixed(2),
            tol: 0.5,
            pts: 3,
            expl: `倍面積＝|ΣXᵢ(Yᵢ₊₁−Yᵢ₋₁)|＝<b>${wgDoubleArea(pts).toFixed(2)}</b>。大座標のまま計算すると桁落ちしやすいので、<b>座標差（原点を近くに移す）</b>で計算するのが定石。`,
          },
          {
            q: "丙土地の面積を求めよ（小数第2位まで）。",
            unit: "㎡",
            answer: +area.toFixed(2),
            tol: 0.05,
            pts: 3,
            expl: `倍面積÷2＝<b>${area.toFixed(2)}㎡</b>`,
          },
          {
            q: "更正後の登記すべき地積を答えよ。",
            unit: "㎡",
            answer: seikai,
            tol: 0,
            pts: 4,
            expl:
              `${wgChisekiRule(chimoku)}⟹ <b>${wgChisekiText(seikai, chimoku)}㎡</b>。` +
              `登記地積 ${wgChisekiText(toki, chimoku)}㎡ → ${wgChisekiText(seikai, chimoku)}㎡ へ更正。<br>` +
              `<b>比較</b>: もし地目が宅地なら 0.01㎡未満切捨てなので <b>${asTakuchi.toFixed(2)}㎡</b> となる。地目で答えが変わるのが最大の落とし穴。`,
          },
          {
            q: "辺ＢＣの長さを求めよ（小数第2位まで）。",
            unit: "m",
            answer: +wgDist(B, C).toFixed(2),
            tol: 0.02,
            pts: 2,
            expl:
              mathml("\\sqrt{ΔX^{2} ＋ ΔY^{2}}", true) +
              `<p style="text-align:center;margin:0">＝ √(${(C[0] - B[0]).toFixed(2)}² ＋ ${(C[1] - B[1]).toFixed(2)}²) ＝ <b>${wgDist(B, C).toFixed(2)}m</b></p>`,
          },
        ],
        appForm: wgRenkenForm(1, [
          { answer: "土地地積更正登記", hint: "「地積更正」を含める" },
        ]).concat([
          { label: "添付情報（図面）", answer: "地積測量図", hint: "" },
          {
            label: "登録免許税",
            answer: WG_NONTAX_ACCEPTS,
            hint: "表示に関する登記は非課税",
          },
          {
            label: "この登記の申請義務の有無（あり／なし）",
            answer: ["なし", "無"],
            hint: "地積更正は義務ではない",
            pts: 2,
          },
        ]),
        figure: {
          points: { A: A, B: B, C: C, D: D },
          polys: [["A", "B", "C", "D"]],
          lines: [],
          revealPoints: [],
          areaLabels: [
            {
              at: [
                (A[0] + B[0] + C[0] + D[0]) / 4,
                (A[1] + B[1] + C[1] + D[1]) / 4,
              ],
              text: `${chiban.text} ${area.toFixed(2)}㎡`,
            },
          ],
        },
      };
    },
  },

  {
    id: "W19",
    type: "土地",
    title: "土地合筆登記（41条の合筆制限で合筆できない筆を見抜く）",
    target: "目標35分",
    build(rng) {
      const sh = wgGappitsuShape(rng, {});
      const chimoku = wgPick(rng, WG_CHIMOKU_FINE.concat(WG_CHIMOKU_COARSE));
      const owner = wgPerson(rng);
      const shiho = wgPerson(rng);
      const shozai = wgShozai(rng);
      const n1 = wgInt(rng, 3, 60);
      const n2 = n1 + 1;
      const n3 = n1 + 2;
      const gKou = wgChiseki(sh.areaKou, chimoku);
      const gOtsu = wgChiseki(sh.areaOtsu, chimoku);
      // 3筆目に制限事由を1つだけ仕込む（毎回どの事由かが変わる）
      const block = wgPick(rng, [
        {
          text: `地目が<b>${wgPick(
            rng,
            WG_CHIMOKU_COARSE.filter((c) => c !== chimoku),
          )}</b>である`,
          reason: "地目が相互に異なる土地であるため（法41条2号）",
          answer: ["地目が異なる", "地目が相互に異なる"],
        },
        {
          text: `所有権登記名義人が<b>${wgPerson(rng)}</b>である`,
          reason: "所有権の登記名義人が相互に異なる土地であるため（法41条4号）",
          answer: [
            "所有権登記名義人が異なる",
            "所有者が異なる",
            "所有権の登記名義人が相互に異なる",
          ],
        },
        {
          text: "<b>抵当権の登記</b>がある",
          reason:
            "所有権以外の権利に関する登記があるため（法41条6号。承役地の地役権等の例外を除く）",
          answer: [
            "所有権以外の権利の登記がある",
            "抵当権の登記がある",
            "所有権以外の権利に関する登記がある",
          ],
        },
        {
          text: "甲土地・乙土地と<b>接続していない</b>（離れている）",
          reason: "相互に接続していない土地であるため（法41条1号）",
          answer: ["接続していない", "相互に接続していない"],
        },
      ]);
      const tax = wgGappitsuTax(1);
      return {
        statement:
          `<p><b>【事案】</b> ${owner}は、下記の3筆の土地をできる限り1筆にまとめたいと考え、土地家屋調査士${shiho}に相談した。</p>` +
          `<p class="small">甲土地: 所在 ${shozai}／地番 <b>${n1}番</b>／地目 ${chimoku}／所有権登記名義人 ${owner}<br>` +
          `乙土地: 所在 ${shozai}／地番 <b>${n2}番</b>／地目 ${chimoku}／所有権登記名義人 ${owner}（甲の南側に接続）<br>` +
          `丙土地: 所在 ${shozai}／地番 <b>${n3}番</b>／${block.text}</p>` +
          `<p>甲土地・乙土地は相互に接続し、同一地目・同一所有者・同一字であり、所有権以外の権利に関する登記はない。</p>` +
          `<p>※ 合筆の可否は不登法41条による。地積は規則100条による。</p>`,
        coords: wgCoordRows([
          ["A", sh.A, "甲・北西"],
          ["B", sh.B, "甲・北東"],
          ["C", sh.C, "甲乙の境・東"],
          ["D", sh.D, "甲乙の境・西"],
          ["E", sh.E, "乙・南東"],
          ["F", sh.F, "乙・南西"],
        ]),
        tasks: [
          {
            q: "合筆できる土地は何筆か。",
            unit: "筆",
            answer: 2,
            tol: 0,
            pts: 4,
            expl: `丙土地（${n3}番）は${block.reason}<b>合筆できない</b>。よって甲土地と乙土地の<b>2筆</b>のみ合筆できる。`,
          },
          {
            q: "合筆後の土地の地積を求めよ。",
            unit: "㎡",
            answer: +(gKou + gOtsu).toFixed(2),
            tol: 0.02,
            pts: 4,
            expl: `${wgChisekiText(gKou, chimoku)}＋${wgChisekiText(gOtsu, chimoku)}=<b>${(gKou + gOtsu).toFixed(2)}㎡</b>（合筆は合算）`,
          },
        ],
        appForm: wgRenkenForm(1, [{ answer: "土地合筆登記", hint: "" }]).concat(
          [
            {
              label: `丙土地（${n3}番）を合筆できない理由`,
              answer: block.answer,
              hint: "法41条の合筆制限のうちどれか（キーワードで）",
              pts: 4,
            },
            {
              label: "合筆後の地番",
              answer: [n1 + "番", String(n1)],
              hint: "合筆前の首位の地番",
              pts: 2,
            },
            {
              label: "登録免許税",
              answer: wgYenAccepts(tax),
              hint: "合筆後の筆数×1,000円",
              pts: 2,
            },
            {
              label: "添付情報（図面）",
              answer: ["なし", "不要", "提供を要しない"],
              hint: "合筆に地積測量図は不要",
            },
          ],
        ),
        figure: {
          points: { A: sh.A, B: sh.B, C: sh.C, D: sh.D, E: sh.E, F: sh.F },
          polys: [
            ["A", "B", "C", "D"],
            ["D", "C", "E", "F"],
          ],
          lines: [],
          revealPoints: [],
          areaLabels: [
            {
              at: [(sh.A[0] + sh.C[0]) / 2, (sh.A[1] + sh.C[1]) / 2],
              text: `${n1}番 ${wgChisekiText(gKou, chimoku)}㎡`,
            },
            {
              at: [(sh.D[0] + sh.E[0]) / 2, (sh.D[1] + sh.E[1]) / 2],
              text: `${n2}番 ${wgChisekiText(gOtsu, chimoku)}㎡`,
            },
          ],
        },
      };
    },
  },

  // ═══════════════ 土地・複合登記（本試験の主戦場） ═══════════════
  {
    id: "W15",
    type: "土地",
    title: "土地地積更正・分筆登記（一の申請情報）",
    target: "目標60分",
    combo: ["地積更正", "分筆"],
    build(rng) {
      const b = _wBunpitsuCore(rng, {
        mode: rng() < 0.5 ? "real" : "clean",
        geo: rng() < 0.5,
      });
      if (!b) return null;
      // 登記地積を実測とずらす。これが「更正を併せて申請する」理由になる。
      const zure = wgPick(rng, [-14, -11, -8, -6, 7, 9, 12, 15]);
      const tokiChiseki = wgChiseki(b.total + zure, b.chimoku);
      const tax = wgBunpitsuTax(2);
      const jitsusoku = wgChiseki(b.sh.areaW + b.sh.areaE, b.chimoku);
      return {
        statement:
          `<p><b>第１問</b>　次の〔事実関係〕及び〔測量の結果〕に基づき、土地家屋調査士${b.shiho}が申請すべき登記の申請情報の内容等を答えよ。</p>` +
          `<p><b>〔事実関係〕</b></p>` +
          `<p>１　${b.owner}は、その所有する下記の土地（以下「甲土地」という。）のうち一方の部分を売却するため、` +
          `${b.date.text}、土地家屋調査士${b.shiho}に必要な登記の申請手続を依頼した。</p>` +
          `<p class="small">所　在　${b.shozai}／地　番　${b.chiban.text}／地　目　<b>${b.chimoku}</b>` +
          `／地　積　<b>${wgChisekiText(tokiChiseki, b.chimoku)}㎡</b>（登記記録）／所有権登記名義人　${b.owner}</p>` +
          `<p>２　測量の結果、甲土地の実測地積は<b>登記記録上の地積と相違していた</b>ため、${b.owner}は、` +
          `<b>地積に関する更正の登記を併せて申請すること</b>を希望している（登記官の許可を得て一の申請情報によるものとする）。</p>` +
          b.sokuteiNote(3),
        coords: b.coords,
        tasks: b.tasks.concat([
          {
            q: "更正後の甲土地（分筆前）の地積を答えよ。",
            unit: "㎡",
            answer: b.total,
            tol: 0.02,
            pts: 4,
            expl:
              `分筆後の各地積の合計＝${wgChisekiText(b.gW, b.chimoku)}＋${wgChisekiText(b.gE, b.chimoku)}=<b>${wgChisekiText(b.total, b.chimoku)}㎡</b>。<br>` +
              `登記記録の ${wgChisekiText(tokiChiseki, b.chimoku)}㎡ をこの値に更正した上で分筆する。実測合計は${jitsusoku.toFixed(2)}㎡。`,
          },
        ]),
        appForm: wgRenkenForm(
          1,
          [
            {
              answer: [
                "土地地積更正・分筆登記",
                "土地地積更正分筆登記",
                "土地地積更正、分筆登記",
              ],
              hint: "更正と分筆を一の申請情報でまとめたときの目的の書き方",
            },
          ],
          "同一の不動産についての表題部の更正の登記と分筆の登記は、規則35条7号により一の申請情報で申請できる",
        ).concat([
          {
            label: "一の申請情報で申請できる根拠（規則の条数）",
            answer: ["規則35条7号", "35条7号", "不動産登記規則35条7号"],
            hint: "令4条ただし書＋規則の号数。平成18・4・3民二799号依命通知",
            pts: 3,
          },
          {
            label: "更正の登記のために別途 地積測量図を提供する必要があるか",
            answer: ["ない", "なし", "不要", "兼用できる"],
            hint: "分筆の登記で提供する地積測量図をもって更正の分に代えられる（依命通知2）",
            pts: 3,
          },
          {
            label: "登記原因及びその日付",
            answer: ["記載しない", "記載を要しない", "なし"],
            hint: "分筆にも地積更正にも登記原因はない",
            pts: 2,
          },
          {
            label: "登録免許税",
            answer: wgYenAccepts(tax),
            hint: "更正は非課税。分筆後の筆数×1,000円のみ",
            pts: 3,
          },
          {
            label: "申請人の資格",
            answer: ["所有権登記名義人", "所有権の登記名義人"],
            hint: "法39条1項",
          },
          {
            label: `分筆後 ${b.westName} の地積`,
            answer: wgChisekiAccepts(b.gW, b.chimoku),
            hint: "不動産の表示欄",
            pts: 2,
          },
        ]),
        // 登記地積は実測と食い違わせてある（更正が必要な状況そのものが出題の核）
        verify: Object.assign({}, b.verify, {
          tokiChiseki: tokiChiseki,
          seiChiseki: b.total,
          kousei: true,
        }),
        figure: b.figure,
        figureChecks: b.figureChecks,
      };
    },
  },

  {
    id: "W16",
    type: "土地",
    title: "土地一部地目変更・分筆登記（申請義務あり）",
    target: "目標60分",
    combo: ["一部地目変更", "分筆"],
    build(rng) {
      const chg = wgPick(rng, WG_CHIMOKU_CHANGE);
      const b = _wBunpitsuCore(rng, {
        mode: rng() < 0.5 ? "real" : "clean",
        geo: rng() < 0.5,
        chimokuPool: [chg.from],
      });
      if (!b) return null;
      // 地目が変わるのはどちら側か
      const changedWest = rng() < 0.5;
      const changedName = changedWest ? b.westName : b.eastName;
      const keptName = changedWest ? b.eastName : b.westName;
      const changedArea = changedWest ? b.sh.areaW : b.sh.areaE;
      // 変更後の地目で端数処理が変わるので、変更部分だけ地目を差し替えて計算し直す
      const gChanged = wgChiseki(changedArea, chg.to);
      const gKept = wgChiseki(changedWest ? b.sh.areaE : b.sh.areaW, chg.from);
      const total = +(gChanged + gKept).toFixed(2);
      const tax = wgBunpitsuTax(2);
      return {
        statement:
          `<p><b>第１問</b>　次の〔事実関係〕及び〔測量の結果〕に基づき、土地家屋調査士${b.shiho}が申請すべき登記の申請情報の内容等を答えよ。</p>` +
          `<p><b>〔事実関係〕</b></p>` +
          `<p>１　${b.owner}は、その所有する下記の土地（以下「甲土地」という。）について、` +
          `<b>${b.date.text}、${changedWest ? "西側（Ａ・Ｄ側）" : "東側（Ｂ・Ｃ側）"}部分の${chg.cause}</b>ため、` +
          `当該部分の現況の地目が<b>${chg.to}</b>となった。${b.owner}は土地家屋調査士${b.shiho}に必要な登記の申請手続を依頼した。</p>` +
          `<p class="small">所　在　${b.shozai}／地　番　${b.chiban.text}／地　目　<b>${chg.from}</b>` +
          `／地　積　<b>${wgChisekiText(total, chg.from)}㎡</b>（登記記録）／所有権登記名義人　${b.owner}</p>` +
          `<p>２　一筆の土地に2種類以上の地目は認められない（一筆一地目主義・規則99条）。</p>` +
          b.sokuteiNote(3) +
          `<p>７　地目が変更した部分（${changedName}）の地積は<b>変更後の地目 ${chg.to}</b>を前提に、` +
          `残る部分（${keptName}）は<b>${chg.from}</b>を前提に端数処理せよ。</p>`,
        coords: b.coords,
        tasks: wgCrossTasks(b.sh, b.dg).concat([
          {
            q: `${changedName}（地目が${chg.to}となった部分）の面積を座標法で求めよ。`,
            unit: "㎡",
            answer: +changedArea.toFixed(b.dg),
            tol: 0.05,
            pts: 4,
            expl: `倍面積＝${(changedArea * 2).toFixed(b.dg)} ⟹ 面積＝<b>${changedArea.toFixed(b.dg)}㎡</b>`,
          },
          {
            q: `${changedName}の登記すべき地積を答えよ（地目は${chg.to}）。`,
            unit: "㎡",
            answer: gChanged,
            tol: 0,
            pts: 4,
            expl: `${wgChisekiRule(chg.to)}⟹ <b>${wgChisekiText(gChanged, chg.to)}㎡</b>`,
          },
          {
            q: `${keptName}（地目は${chg.from}のまま）の登記すべき地積を答えよ。`,
            unit: "㎡",
            answer: gKept,
            tol: 0,
            pts: 4,
            expl:
              `${wgChisekiRule(chg.from)}⟹ <b>${wgChisekiText(gKept, chg.from)}㎡</b>。<br>` +
              `<b>検算</b>: ${wgChisekiText(gChanged, chg.to)}＋${wgChisekiText(gKept, chg.from)}＝${total.toFixed(2).replace(/\.00$/, "")} ＝ 従前の地積 ✓<br>` +
              `<b>要注意</b>: 分筆後の2筆で<b>端数処理の桁が違う</b>（地目が違うため）。同じ桁で処理すると失点する。`,
          },
        ]),
        appForm: wgRenkenForm(
          1,
          [
            {
              answer: [
                "土地一部地目変更・分筆登記",
                "土地一部地目変更分筆登記",
                "一部地目変更・分筆登記",
              ],
              hint: "一筆の土地の一部が別地目になったときの登記の目的",
            },
          ],
          "一部地目変更による分筆の登記として一の申請情報で申請する（法39条2項）",
        ).concat([
          {
            label: "登記原因及びその日付",
            answer: [
              `${b.date.text}地目変更`,
              `${b.date.text} 地目変更`,
              "地目変更",
            ],
            hint: "地目変更の日を原因日付とする",
            pts: 3,
          },
          {
            label: "この登記の申請義務の有無（あり／なし）",
            answer: ["あり", "有"],
            hint: "通常の分筆は任意だが、この登記は？（法37条1項）",
            pts: 4,
          },
          {
            label: "申請期限（地目変更があった日から）",
            answer: ["1か月以内", "一月以内", "1月以内", "1ヶ月以内"],
            hint: "法37条1項",
            pts: 3,
          },
          {
            label:
              "共有地のとき共有者の1人から申請できるか（できる／できない）",
            answer: ["できる", "可"],
            hint: "報告的な登記なので保存行為として扱われる（登記研究367号137頁）",
            pts: 3,
          },
          {
            label:
              "登記官が職権でこの登記をすることができるか（できる／できない）",
            answer: ["できる", "可"],
            hint: "法39条2項",
            pts: 2,
          },
          {
            label: "添付情報（図面）",
            answer: "地積測量図",
            hint: "分筆を伴うので必要",
          },
          {
            label: "登録免許税",
            answer: wgYenAccepts(tax),
            hint: "地目変更は非課税。分筆後の筆数×1,000円",
            pts: 3,
          },
        ]),
        // 分筆後の2筆で地目が違う（＝端数処理の桁が違う）ので、筆ごとに地目を持たせる
        verify: {
          kind: "bunpitsu",
          parcels: [
            {
              poly: ["A", "P", "Q", "D"],
              chimoku: changedWest ? chg.to : chg.from,
              chiseki: changedWest ? gChanged : gKept,
            },
            {
              poly: ["P", "B", "C", "Q"],
              chimoku: changedWest ? chg.from : chg.to,
              chiseki: changedWest ? gKept : gChanged,
            },
          ],
          tokiChiseki: total,
          seiChiseki: total,
          kousei: false,
        },
        figure: Object.assign({}, b.figure, {
          areaLabels: [
            {
              at: [(b.sh.A[0] + b.sh.Q[0]) / 2, (b.sh.A[1] + b.sh.Q[1]) / 2],
              text: changedWest
                ? `${changedName} ${chg.to} ${wgChisekiText(gChanged, chg.to)}㎡`
                : `${keptName} ${chg.from} ${wgChisekiText(gKept, chg.from)}㎡`,
            },
            {
              at: [(b.sh.P[0] + b.sh.C[0]) / 2, (b.sh.P[1] + b.sh.C[1]) / 2],
              text: changedWest
                ? `${keptName} ${chg.from} ${wgChisekiText(gKept, chg.from)}㎡`
                : `${changedName} ${chg.to} ${wgChisekiText(gChanged, chg.to)}㎡`,
            },
          ],
        }),
      };
    },
  },

  {
    id: "W17",
    type: "土地",
    title: "土地分合筆登記（一部を分筆して他の土地に合筆）",
    target: "目標60分",
    combo: ["分筆", "合筆"],
    build(rng) {
      const b = _wBunpitsuCore(rng, {
        mode: rng() < 0.5 ? "real" : "clean",
        geo: rng() < 0.5,
      });
      if (!b) return null;
      // 甲土地の東側(ロ)部分を分筆し、隣接する乙土地に合筆する
      const roArea = b.sh.areaE;
      const gRo = wgChiseki(roArea, b.chimoku);
      const gZan = b.gW; // 分筆残地（西側）
      const otsuNo = wgInt(rng, 61, 98) + "番";
      const otsuChiseki = wgChiseki(
        wgInt(rng, 150, 400) + wgPick(rng, [0, 0.5]),
        b.chimoku,
      );
      const gappitsuGo = +(otsuChiseki + gRo).toFixed(2);
      // 登免税: 分筆後の土地1個＋合筆後の土地1個＝2個
      const tax = 2000;
      return {
        statement:
          `<p><b>第１問</b>　次の〔事実関係〕及び〔測量の結果〕に基づき、土地家屋調査士${b.shiho}が申請すべき登記の申請情報の内容等を答えよ。</p>` +
          `<p><b>〔事実関係〕</b></p>` +
          `<p>１　${b.owner}は、その所有する甲土地の<b>東側部分（Ｐ・Ｂ・Ｃ・Ｑで囲まれた部分。以下「(ロ)部分」という。）</b>を分筆し、` +
          `これを<b>東側に接続する乙土地に合筆して1筆の土地としたい</b>と考え、${b.date.text}、土地家屋調査士${b.shiho}に依頼した。</p>` +
          `<p class="small">甲土地: 所在 ${b.shozai}／地番 <b>${b.chiban.text}</b>／地目 <b>${b.chimoku}</b>／地積 <b>${wgChisekiText(b.total, b.chimoku)}㎡</b>／所有権登記名義人 ${b.owner}<br>` +
          `乙土地: 所在 ${b.shozai}／地番 <b>${otsuNo}</b>／地目 <b>${b.chimoku}</b>／地積 <b>${wgChisekiText(otsuChiseki, b.chimoku)}㎡</b>／所有権登記名義人 ${b.owner}</p>` +
          `<p>２　甲土地・乙土地は相互に接続し、同一地目・同一所有者・同一字であり、所有権以外の権利に関する登記はない。</p>` +
          `<p>３　分筆線は、現地に設置された境界標<b>Ｋ及びＬ</b>を結ぶ直線ＫＬとする。直線ＫＬと北側筆界ＡＢとの交点を<b>Ｐ</b>、南側筆界ＤＣとの交点を<b>Ｑ</b>とする。</p>` +
          `<p>４　分筆残地（西側 Ａ・Ｐ・Ｑ・Ｄ）は <b>${b.chiban.split[0]}</b> とする。</p>` +
          `<p>５　座標値・辺長は小数第${b.dg === 3 ? "３" : "２"}位までとし、地積は規則100条による。</p>`,
        coords: b.coords,
        tasks: wgCrossTasks(b.sh, b.dg).concat([
          {
            q: "(ロ)部分（分筆して合筆する部分）の面積を座標法で求めよ。",
            unit: "㎡",
            answer: +roArea.toFixed(b.dg),
            tol: 0.05,
            pts: 4,
            expl: `Ｐ・Ｂ・Ｃ・Ｑを一周して 倍面積＝${(roArea * 2).toFixed(b.dg)} ⟹ 面積＝<b>${roArea.toFixed(b.dg)}㎡</b>`,
          },
          {
            q: "(ロ)部分の登記すべき地積を答えよ（規則100条）。",
            unit: "㎡",
            answer: gRo,
            tol: 0,
            pts: 3,
            expl:
              `${wgChisekiRule(b.chimoku)}⟹ <b>${wgChisekiText(gRo, b.chimoku)}㎡</b>。<br>` +
              `(ロ)部分は登記記録が設けられることなく乙土地に直接合併されるが、申請情報の「土地の表示」には` +
              `<b>分筆して合筆する部分</b>としてこの地積を記載する（地番は記載しない）。`,
          },
          {
            q: `分筆残地（${b.chiban.split[0]}）の登記すべき地積を答えよ。`,
            unit: "㎡",
            answer: gZan,
            tol: 0,
            pts: 4,
            expl: `西側 Ａ・Ｐ・Ｑ・Ｄ の面積＝${b.sh.areaW.toFixed(b.dg)}㎡。${wgChisekiRule(b.chimoku)}⟹ <b>${wgChisekiText(gZan, b.chimoku)}㎡</b>`,
          },
          {
            q: `合筆後の土地（${otsuNo}）の地積を答えよ。`,
            unit: "㎡",
            answer: gappitsuGo,
            tol: 0.02,
            pts: 4,
            expl:
              `乙土地の地積 ${wgChisekiText(otsuChiseki, b.chimoku)}㎡ ＋ (ロ)部分の地積 ${wgChisekiText(gRo, b.chimoku)}㎡ ＝ <b>${gappitsuGo.toFixed(2)}㎡</b>。<br>` +
              `<b>検算</b>: 分筆残地 ${wgChisekiText(gZan, b.chimoku)}㎡ ＋ (ロ)部分 ${wgChisekiText(gRo, b.chimoku)}㎡ ＝ 甲土地の従前地積 ${wgChisekiText(b.total, b.chimoku)}㎡ ✓`,
          },
        ]),
        appForm: wgRenkenForm(
          1,
          [
            {
              answer: ["土地分合筆登記", "分合筆登記"],
              hint: "規則108条の見出しの言い方",
            },
          ],
          "原則は分筆と合筆で2件連件だが、「土地の一部を分筆してこれを他の土地に合筆する場合」は規則35条1号で一の申請情報にできる",
        ).concat([
          {
            label: "一の申請情報で申請できる根拠（規則の条数）",
            answer: ["規則35条1号", "35条1号", "不動産登記規則35条1号"],
            hint: "見出しは規則108条「土地の分合筆の登記」",
            pts: 3,
          },
          {
            label: "登録免許税",
            answer: wgYenAccepts(tax),
            hint: "分筆後の土地1個＋合筆後の土地1個＝2個×1,000円（規則189条1項）",
            pts: 4,
          },
          {
            label: "分筆して合筆する部分((ロ)部分)に地番を記載するか",
            answer: ["記載しない", "記載してはならない", "しない", "なし"],
            hint: "登記記録が設けられることなく直接合併されるため",
            pts: 4,
          },
          {
            label: "合筆後の土地の地番",
            answer: [otsuNo, otsuNo.replace("番", "")],
            hint: "合筆先である乙土地の地番",
            pts: 2,
          },
          {
            label: "添付情報（図面）",
            answer: "地積測量図",
            hint: "分筆を伴うので必要",
          },
          {
            label: "登記原因及びその日付",
            answer: ["記載しない", "記載を要しない", "なし"],
            hint: "分合筆はその登記により効力を生ずるので登記原因はない（分筆及び合筆の経緯を記載する）",
            pts: 2,
          },
        ]),
        // 西側=分筆残地、東側=(ロ)部分（乙土地に合筆される）。甲土地の従前地積で検算が立つ。
        verify: b.verify,
        figure: Object.assign({}, b.figure, {
          areaLabels: [
            {
              at: [(b.sh.A[0] + b.sh.Q[0]) / 2, (b.sh.A[1] + b.sh.Q[1]) / 2],
              text: `残地 ${b.chiban.split[0]} (${wgChisekiText(gZan, b.chimoku)}㎡)`,
            },
            {
              at: [(b.sh.P[0] + b.sh.C[0]) / 2, (b.sh.P[1] + b.sh.C[1]) / 2],
              text: `(ロ)→${otsuNo}に合筆 (${wgChisekiText(gRo, b.chimoku)}㎡)`,
            },
          ],
        }),
      };
    },
  },

  {
    id: "W18",
    type: "土地",
    title: "土地地積更正・合筆登記＋土地分筆登記（2件連件）",
    target: "目標70分",
    combo: ["地積更正", "合筆", "分筆"],
    build(rng) {
      const chimoku = wgPick(rng, WG_CHIMOKU_FINE.concat(WG_CHIMOKU_COARSE));
      const owner = wgPerson(rng);
      const shiho = wgPerson(rng);
      const shozai = wgShozai(rng);
      const date = wgDate(rng);
      const sh = wgGappitsuShape(rng, {});
      const n1 = wgInt(rng, 3, 55);
      const n2 = n1 + wgPick(rng, [1, 2]);

      const gKou = wgChiseki(sh.areaKou, chimoku);
      const gOtsu = wgChiseki(sh.areaOtsu, chimoku);
      // 乙土地の登記地積だけが実測と相違している → 合筆の前提として地積更正が必要
      const zure = wgPick(rng, [-8, -6, -5, 5, 6, 7, 9]);
      const otsuToki = wgChiseki(gOtsu + zure, chimoku);
      const gappitsuGo = +(gKou + gOtsu).toFixed(2);

      // 合筆後、南北に2等分する分筆（分筆線は東西方向の直線MN）
      const xMid = (sh.A[0] + sh.F[0]) / 2;
      const M = [xMid, sh.A[1]];
      const N = [xMid, sh.B[1]];
      const northPts = [sh.A, sh.B, N, M];
      const southPts = [M, N, sh.E, sh.F];
      const gN = wgChiseki(wgArea(northPts), chimoku);
      const gS = wgChiseki(wgArea(southPts), chimoku);
      const taxGappitsu = wgGappitsuTax(1);
      const taxBunpitsu = wgBunpitsuTax(2);

      return {
        title: "土地地積更正・合筆登記＋土地分筆登記（2件連件）",
        statement:
          `<p><b>第１問</b>　次の〔事実関係〕及び〔測量の結果〕に基づき、土地家屋調査士${shiho}が申請すべき登記の申請情報の内容等を答えよ。</p>` +
          `<p><b>〔事実関係〕</b></p>` +
          `<p>１　${owner}は、その所有する接続する2筆の土地をいったん1筆にまとめた上で、` +
          `<b>あらためて南北2筆に分けたい</b>と考え、${date.text}、土地家屋調査士${shiho}に必要な登記の申請手続を依頼した。</p>` +
          `<p class="small">甲土地: 所在 ${shozai}／地番 <b>${n1}番</b>／地目 <b>${chimoku}</b>／地積 <b>${wgChisekiText(gKou, chimoku)}㎡</b>（登記記録）<br>` +
          `乙土地: 所在 ${shozai}／地番 <b>${n2}番</b>／地目 <b>${chimoku}</b>／地積 <b>${wgChisekiText(otsuToki, chimoku)}㎡</b>（登記記録・甲の南側に接続）</p>` +
          `<p>２　2筆はいずれも所有権登記名義人が${owner}、同一地目・同一字であり、所有権以外の権利に関する登記はない（法41条の合筆制限に該当しない）。</p>` +
          `<p>３　測量の結果、<b>乙土地の実測地積は登記記録上の地積と相違していた</b>（甲土地は相違していない）。` +
          `${owner}は、<b>合筆の登記に併せて乙土地の地積に関する更正の登記を申請すること</b>を希望している。</p>` +
          `<p>４　合筆後、Ｍ・Ｎを結ぶ直線ＭＮ（Ｘ＝${xMid.toFixed(2)} の直線）をもって分筆し、` +
          `<b>北側を ${n1}番1、南側を ${n1}番2</b> とする。</p>` +
          `<p>５　座標値・辺長は小数第2位まで、地積は規則100条による。</p>`,
        coords: wgCoordRows([
          ["A", sh.A, "甲・北西"],
          ["B", sh.B, "甲・北東"],
          ["C", sh.C, "甲乙の境・東"],
          ["D", sh.D, "甲乙の境・西"],
          ["E", sh.E, "乙・南東"],
          ["F", sh.F, "乙・南西"],
          ["M", M, "分筆線の西端"],
          ["N", N, "分筆線の東端"],
        ]),
        tasks: [
          {
            q: `乙土地（${n2}番）の実測面積を座標法で求めよ。`,
            unit: "㎡",
            answer: +sh.areaOtsu.toFixed(2),
            tol: 0.02,
            pts: 3,
            expl: `Ｄ・Ｃ・Ｅ・Ｆは ${sh.h2}m×${sh.w}m ⟹ <b>${sh.areaOtsu.toFixed(2)}㎡</b>`,
          },
          {
            q: `更正後の乙土地（${n2}番）の地積を答えよ。`,
            unit: "㎡",
            answer: gOtsu,
            tol: 0,
            pts: 3,
            expl: `${wgChisekiRule(chimoku)}⟹ <b>${wgChisekiText(gOtsu, chimoku)}㎡</b>。登記地積 ${wgChisekiText(otsuToki, chimoku)}㎡ から更正する。`,
          },
          {
            q: "合筆後の土地の地積を答えよ。",
            unit: "㎡",
            answer: gappitsuGo,
            tol: 0.02,
            pts: 4,
            expl: `${wgChisekiText(gKou, chimoku)}＋${wgChisekiText(gOtsu, chimoku)}=<b>${gappitsuGo.toFixed(2)}㎡</b>（更正後の地積で合算する点が要）`,
          },
          {
            q: `分筆後 ${n1}番1（北側 Ａ・Ｂ・Ｎ・Ｍ）の地積を答えよ。`,
            unit: "㎡",
            answer: gN,
            tol: 0,
            pts: 4,
            expl: `面積＝${wgArea(northPts).toFixed(2)}㎡。${wgChisekiRule(chimoku)}⟹ <b>${wgChisekiText(gN, chimoku)}㎡</b>`,
          },
          {
            q: `分筆後 ${n1}番2（南側 Ｍ・Ｎ・Ｅ・Ｆ）の地積を答えよ。`,
            unit: "㎡",
            answer: gS,
            tol: 0,
            pts: 4,
            expl:
              `面積＝${wgArea(southPts).toFixed(2)}㎡ ⟹ <b>${wgChisekiText(gS, chimoku)}㎡</b>。<br>` +
              `<b>検算</b>: ${wgChisekiText(gN, chimoku)}＋${wgChisekiText(gS, chimoku)}＝${(gN + gS).toFixed(2)} ＝ 合筆後の地積 ✓`,
          },
        ],
        appForm: wgRenkenForm(
          2,
          [
            {
              answer: [
                "土地地積更正・合筆登記",
                "土地地積更正合筆登記",
                "土地地積更正、合筆登記",
              ],
              hint: "更正と合筆は規則35条7号で一の申請情報にできる",
            },
            {
              answer: "土地分筆登記",
              hint: "合筆が終わってから分筆する",
            },
          ],
          "合筆と分筆は一の申請情報にできない（規則35条1号の分合筆は「一部を分筆して他の土地に合筆する」場合だけ）ので2件連件になる",
        ).concat([
          {
            label: "合筆と分筆を一の申請情報で申請できるか（できる／できない）",
            answer: ["できない", "不可", "できません"],
            hint: "規則35条7号は「変更・更正の登記」＋「分筆又は合筆」の組合せ。分筆と合筆同士は対象外",
            pts: 4,
          },
          {
            label: "合筆後の地番",
            answer: [n1 + "番", String(n1)],
            hint: "合筆前の首位の地番",
            pts: 2,
          },
          {
            label: "1件目（地積更正・合筆）の登録免許税",
            answer: wgYenAccepts(taxGappitsu),
            hint: "更正は非課税。合筆後の筆数×1,000円",
            pts: 3,
          },
          {
            label: "2件目（分筆）の登録免許税",
            answer: wgYenAccepts(taxBunpitsu),
            hint: "分筆後の筆数×1,000円",
            pts: 3,
          },
          {
            label: "1件目に地積測量図の提供が必要か（必要／不要）",
            answer: ["必要", "要"],
            hint: "合筆だけなら不要だが、地積更正を併せて申請する",
            pts: 3,
          },
          {
            label: "申請人の資格",
            answer: ["所有権登記名義人", "所有権の登記名義人"],
            hint: "合筆は法39条1項により所有権登記名義人に限られる",
            pts: 2,
          },
        ]),
        figure: {
          points: {
            A: sh.A,
            B: sh.B,
            C: sh.C,
            D: sh.D,
            E: sh.E,
            F: sh.F,
            M: M,
            N: N,
          },
          polys: [
            ["A", "B", "C", "D"],
            ["D", "C", "E", "F"],
          ],
          lines: [["M", "N"]],
          revealPoints: ["M", "N"],
          areaLabels: [
            {
              at: [(sh.A[0] + M[0]) / 2, (sh.A[1] + sh.B[1]) / 2],
              text: `${n1}番1 (${wgChisekiText(gN, chimoku)}㎡)`,
            },
            {
              at: [(M[0] + sh.F[0]) / 2, (sh.F[1] + sh.E[1]) / 2],
              text: `${n1}番2 (${wgChisekiText(gS, chimoku)}㎡)`,
            },
          ],
        },
      };
    },
  },

  // ═══════════════ 建物 ═══════════════
  {
    id: "W03",
    type: "建物",
    title: "建物表題登記（床面積の認定・吹抜け）",
    target: "目標40分",
    build(rng) {
      const owner = wgPerson(rng);
      const shiho = wgPerson(rng);
      const shozai = wgShozai(rng);
      const date = wgDate(rng);
      const chiban = wgInt(rng, 3, 90) + "番地";
      const st = _wStruct(rng, "2階建");
      const shu = wgPick(rng, _W_SHURUI);
      const d1 = wgStep(rng, 7, 10, 0.5);
      const w1 = wgStep(rng, 9, 13, 0.5);
      const w2 = wgStep(rng, 5.5, w1 - 1, 0.5);
      const fa = wgStep(rng, 1.5, 3, 0.5); // 吹抜け
      const fb = wgStep(rng, 2, 4, 0.5);
      const vb = wgStep(rng, 1.5, 2.5, 0.5); // ベランダ
      const vw = wgStep(rng, 3, 5, 0.5);
      const a1 = _wYuka(d1 * w1);
      const a2raw = d1 * w2;
      const a2 = _wYuka(a2raw - fa * fb);
      const nobe = _wYuka(a1 + a2);
      return {
        statement:
          `<p><b>【事案】</b> ${owner}は、${shozai}${chiban}の土地上に建物を新築し、<b>${date.text}</b>に完成と同時に引渡しを受けた。` +
          `${owner}は土地家屋調査士${shiho}に登記の申請手続を依頼した。建物の概要は次のとおりである。</p>` +
          `<ul>` +
          `<li>構成材料・屋根・階数: <b>${st.text}</b></li>` +
          `<li>1階: 奥行 ${d1.toFixed(2)}m × 間口 ${w1.toFixed(2)}m の長方形</li>` +
          `<li>2階: 奥行 ${d1.toFixed(2)}m × 間口 ${w2.toFixed(2)}m の長方形。ただし、その内部に<b>${fa.toFixed(2)}m × ${fb.toFixed(2)}m の吹抜け</b>がある。</li>` +
          `<li>2階の外側に<b>開放されたベランダ</b>（${vb.toFixed(2)}m × ${vw.toFixed(2)}m）がある。</li>` +
          `<li>用途: ${shu.desc}。</li>` +
          `</ul>` +
          `<p>各寸法は<b>壁その他の区画の中心線</b>（壁芯）による（規則115条）。床面積は0.01㎡未満を切り捨てる。</p>`,
        coords: [],
        tasks: [
          {
            q: "1階の床面積を求めよ。",
            unit: "㎡",
            answer: a1,
            tol: 0.005,
            pts: 3,
            expl: `${d1.toFixed(2)}×${w1.toFixed(2)}=<b>${a1.toFixed(2)}㎡</b>（壁芯計算・規則115条）`,
          },
          {
            q: "2階の床面積を求めよ。",
            unit: "㎡",
            answer: a2,
            tol: 0.005,
            pts: 5,
            expl:
              `${d1.toFixed(2)}×${w2.toFixed(2)}=${a2raw.toFixed(2)}㎡ から<b>吹抜け ${fa.toFixed(2)}×${fb.toFixed(2)}=${(fa * fb).toFixed(2)}㎡ を除く</b> ⟹ <b>${a2.toFixed(2)}㎡</b>。<br>` +
              `吹抜けは床がなく水平投影面積に含めない。また<b>開放されたベランダは床面積に算入しない</b>（突出部分）。`,
          },
          {
            q: "延べ床面積を求めよ。",
            unit: "㎡",
            answer: nobe,
            tol: 0.005,
            pts: 2,
            expl: `${a1.toFixed(2)}＋${a2.toFixed(2)}=<b>${nobe.toFixed(2)}㎡</b>`,
          },
        ],
        appForm: wgRenkenForm(1, [
          { answer: "建物表題登記", hint: "表題「登記」（変更ではない）" },
        ]).concat([
          {
            label: "種類",
            answer: shu.name,
            hint: shu.desc,
            pts: 2,
          },
          {
            label: "構造",
            answer: st.text,
            hint: "構成材料＋屋根の種類＋階数の順",
            pts: 3,
          },
          {
            label: "添付情報（図面）",
            answer: [
              "建物図面・各階平面図",
              "建物図面、各階平面図",
              "建物図面及び各階平面図",
            ],
            hint: "2つの図面",
            pts: 2,
          },
          {
            label: "申請期限（所有権取得の日から）",
            answer: ["1か月以内", "一月以内", "1月以内", "1ヶ月以内"],
            hint: "法47条1項の申請義務",
            pts: 2,
          },
          {
            label: "登録免許税",
            answer: WG_NONTAX_ACCEPTS,
            hint: "表示に関する登記は非課税",
          },
        ]),
        figure: {
          points: Object.assign(wgRect("a", d1, w1, 0), wgRect("b", d1, w2, 0)),
          polys: [wgRectPoly("a"), wgRectPoly("b")],
          lines: [],
          revealPoints: [],
          areaLabels: [
            {
              at: [-d1 * 0.8, w1 * 0.72],
              text: `1階 ${d1.toFixed(2)}×${w1.toFixed(2)}=${a1.toFixed(2)}㎡`,
            },
            {
              at: [-d1 * 0.3, w2 * 0.4],
              text: `2階 ${a2raw.toFixed(2)}−${(fa * fb).toFixed(2)}=${a2.toFixed(2)}㎡`,
            },
          ],
          holes: [
            {
              poly: [
                [-(d1 - fa) / 2, (w2 - fb) / 2],
                [-(d1 - fa) / 2, (w2 + fb) / 2],
                [-(d1 + fa) / 2, (w2 + fb) / 2],
                [-(d1 + fa) / 2, (w2 - fb) / 2],
              ],
              label: "吹抜け",
            },
          ],
        },
      };
    },
  },

  {
    id: "W06",
    type: "建物",
    title: "建物表題部変更登記（増築・床面積の変更）",
    target: "目標30分",
    build(rng) {
      const owner = wgPerson(rng);
      const shiho = wgPerson(rng);
      const date = wgDate(rng);
      const st = _wStruct(rng, "2階建");
      const shu = wgPick(rng, _W_SHURUI);
      const d1 = wgStep(rng, 7, 10, 0.5);
      const w1 = wgStep(rng, 9, 13, 0.5);
      const w2 = wgStep(rng, 6, w1 - 1, 0.5);
      const zd = wgStep(rng, 2.5, 4, 0.5);
      const zw = wgStep(rng, 3, 5, 0.5);
      const a1 = _wYuka(d1 * w1);
      const a2 = _wYuka(d1 * w2);
      const za = _wYuka(zd * zw);
      const a1new = _wYuka(a1 + za);
      const nobe = _wYuka(a1new + a2);
      return {
        statement:
          `<p><b>【事案】</b> ${owner}は、所有する${shu.name}（<b>${st.text}</b>、1階 ${a1.toFixed(2)}㎡・2階 ${a2.toFixed(2)}㎡）の` +
          `<b>1階部分に増築工事</b>を行い、<b>${date.text}</b>に工事が完了した。${owner}は土地家屋調査士${shiho}に登記の申請手続を依頼した。</p>` +
          `<ul>` +
          `<li>既存1階: 奥行 ${d1.toFixed(2)}m × 間口 ${w1.toFixed(2)}m（${a1.toFixed(2)}㎡）</li>` +
          `<li>増築部分（1階に接続）: 奥行 ${zd.toFixed(2)}m × 間口 ${zw.toFixed(2)}m</li>` +
          `<li>2階: 奥行 ${d1.toFixed(2)}m × 間口 ${w2.toFixed(2)}m（${a2.toFixed(2)}㎡。今回の工事による変更なし）</li>` +
          `</ul>` +
          `<p>各寸法は壁芯による（規則115条）。この増築による建物の表題部の変更の登記（法51条）について検討せよ。</p>`,
        coords: [],
        tasks: [
          {
            q: "増築部分の床面積を求めよ。",
            unit: "㎡",
            answer: za,
            tol: 0.005,
            pts: 3,
            expl: `${zd.toFixed(2)}×${zw.toFixed(2)}=<b>${za.toFixed(2)}㎡</b>（壁芯計算）`,
          },
          {
            q: "増築後の1階の床面積を求めよ。",
            unit: "㎡",
            answer: a1new,
            tol: 0.005,
            pts: 3,
            expl: `既存 ${a1.toFixed(2)}＋増築 ${za.toFixed(2)}=<b>${a1new.toFixed(2)}㎡</b>。床面積に変更が生じたので法51条の変更登記の対象。`,
          },
          {
            q: "増築後の延べ床面積を求めよ。",
            unit: "㎡",
            answer: nobe,
            tol: 0.005,
            pts: 2,
            expl: `1階 ${a1new.toFixed(2)}＋2階 ${a2.toFixed(2)}=<b>${nobe.toFixed(2)}㎡</b>`,
          },
        ],
        appForm: wgRenkenForm(1, [
          { answer: "建物表題部変更登記", hint: "床面積の「変更」" },
        ]).concat([
          {
            label: "登記原因及びその日付",
            answer: [`${date.text}増築`, `${date.text} 増築`, "増築"],
            hint: "工事完了の日",
            pts: 3,
          },
          {
            label: "申請期限（変更があった日から）",
            answer: ["1か月以内", "一月以内", "1月以内", "1ヶ月以内"],
            hint: "法51条1項の申請義務",
            pts: 2,
          },
          {
            label: "申請人の資格",
            answer: [
              "表題部所有者又は所有権登記名義人",
              "表題部所有者又は所有権の登記名義人",
            ],
            hint: "法51条の申請義務者",
            pts: 2,
          },
          {
            label: "添付情報（図面）",
            answer: [
              "建物図面・各階平面図",
              "建物図面、各階平面図",
              "建物図面及び各階平面図",
            ],
            hint: "床面積が変わるので必要",
            pts: 2,
          },
          {
            label: "登録免許税",
            answer: WG_NONTAX_ACCEPTS,
            hint: "表示に関する登記は非課税",
          },
        ]),
        figure: {
          points: Object.assign(
            wgRect("e", d1, w1, 0),
            wgRect("z", zd, zw, 0, -d1),
          ),
          polys: [wgRectPoly("e"), wgRectPoly("z")],
          lines: [],
          revealPoints: [],
          areaLabels: [
            { at: [-d1 / 2, w1 * 0.45], text: `既存1階 ${a1.toFixed(2)}㎡` },
            {
              at: [-d1 - zd / 2, zw * 0.4],
              text: `増築 ${za.toFixed(2)}㎡`,
            },
          ],
        },
      };
    },
  },

  {
    id: "W09",
    type: "建物",
    title: "建物分割登記（附属建物を独立の建物に）",
    target: "目標30分",
    build(rng) {
      const owner = wgPerson(rng);
      const shiho = wgPerson(rng);
      const st = _wStruct(rng, "平家建");
      const shu = wgPick(rng, _W_SHURUI);
      const fu = wgPick(rng, ["物置", "車庫", "倉庫"]);
      const md = wgStep(rng, 6, 9, 0.5);
      const mw = wgStep(rng, 8, 11, 0.5);
      const fd = wgStep(rng, 2.5, 4, 0.5);
      const fw = wgStep(rng, 3, 5, 0.5);
      const ma = _wYuka(md * mw);
      const fa = _wYuka(fd * fw);
      return {
        statement:
          `<p><b>【事案】</b> ${owner}が所有する登記済みの建物は、<b>主たる建物（${shu.name}）</b>と<b>附属建物（${fu}）</b>から成る。` +
          `${owner}は、附属建物を主たる建物から切り離して<b>別個独立の一個の建物</b>としたいと考え、土地家屋調査士${shiho}に登記の申請手続を依頼した。各寸法は壁芯による。</p>` +
          `<ul>` +
          `<li>主たる建物（${shu.name}）: ${st.text}、奥行 ${md.toFixed(2)}m × 間口 ${mw.toFixed(2)}m</li>` +
          `<li>附属建物（${fu}）: ${st.text}、奥行 ${fd.toFixed(2)}m × 間口 ${fw.toFixed(2)}m</li>` +
          `</ul>` +
          `<p>この登記（法54条1項1号）について検討せよ。</p>`,
        coords: [],
        tasks: [
          {
            q: `主たる建物（${shu.name}）の床面積を求めよ。`,
            unit: "㎡",
            answer: ma,
            tol: 0.005,
            pts: 3,
            expl: `${md.toFixed(2)}×${mw.toFixed(2)}=<b>${ma.toFixed(2)}㎡</b>`,
          },
          {
            q: `附属建物（${fu}）の床面積を求めよ。`,
            unit: "㎡",
            answer: fa,
            tol: 0.005,
            pts: 3,
            expl: `${fd.toFixed(2)}×${fw.toFixed(2)}=<b>${fa.toFixed(2)}㎡</b>。分割後は<b>新たな家屋番号</b>を付した独立の建物となる。`,
          },
        ],
        appForm: wgRenkenForm(1, [
          { answer: "建物分割登記", hint: "附属建物を独立させる登記" },
        ]).concat([
          {
            label: "申請人の資格",
            answer: [
              "表題部所有者又は所有権登記名義人",
              "表題部所有者又は所有権の登記名義人",
            ],
            hint: "法54条・申請適格者が限定される",
            pts: 2,
          },
          {
            label: "この登記の申請義務の有無（あり／なし）",
            answer: ["なし", "無"],
            hint: "分割は任意（形成的登記）",
            pts: 2,
          },
          {
            label: "登記原因及びその日付",
            answer: ["記載しない", "記載を要しない", "なし"],
            hint: "分割はその登記により効力を生ずる形成的登記",
            pts: 2,
          },
          {
            label: "添付情報（図面）",
            answer: [
              "建物図面・各階平面図",
              "建物図面、各階平面図",
              "建物図面及び各階平面図",
            ],
            hint: "分割後の建物の図面が必要",
          },
          {
            label: "登録免許税",
            answer: WG_NONTAX_ACCEPTS,
            hint: "表示に関する登記は非課税",
          },
        ]),
        figure: {
          points: Object.assign(
            wgRect("m", md, mw, 0),
            wgRect("f", fd, fw, mw + 2),
          ),
          polys: [wgRectPoly("m"), wgRectPoly("f")],
          lines: [],
          revealPoints: [],
          areaLabels: [
            { at: [-md / 2, mw * 0.45], text: `主 ${ma.toFixed(2)}㎡` },
            {
              at: [-fd / 2, mw + 2 + fw * 0.45],
              text: `附属 ${fa.toFixed(2)}㎡`,
            },
          ],
        },
      };
    },
  },

  {
    id: "W12",
    type: "建物",
    title: "建物滅失登記（取壊し）",
    target: "目標25分",
    build(rng) {
      const owner = wgPerson(rng);
      const shiho = wgPerson(rng);
      const date = wgDate(rng);
      const st = _wStruct(rng, "2階建");
      const shu = wgPick(rng, _W_SHURUI);
      const d1 = wgStep(rng, 7, 10, 0.5);
      const w1 = wgStep(rng, 9, 12, 0.5);
      const a1 = _wYuka(d1 * w1);
      const nobe = _wYuka(a1 * 2);
      return {
        // 滅失の登記は図面を要しないので作図チェックは出さない（規則上の添付図面なし）
        figureChecks: [],
        statement:
          `<p><b>【事案】</b> ${owner}が所有する登記済みの建物（<b>${st.text}${shu.name}</b>、1階・2階とも 奥行 ${d1.toFixed(2)}m × 間口 ${w1.toFixed(2)}m）を取り壊し、` +
          `<b>${date.text}</b>に取壊しが完了した。${owner}は土地家屋調査士${shiho}に登記の申請手続を依頼した。各寸法は壁芯による。</p>` +
          `<p>建物の滅失の登記（法57条）について検討せよ。</p>`,
        coords: [],
        tasks: [
          {
            q: "取壊し前の1階の床面積を求めよ。",
            unit: "㎡",
            answer: a1,
            tol: 0.005,
            pts: 3,
            expl: `${d1.toFixed(2)}×${w1.toFixed(2)}=<b>${a1.toFixed(2)}㎡</b>`,
          },
          {
            q: "取壊し前の延べ床面積を求めよ。",
            unit: "㎡",
            answer: nobe,
            tol: 0.005,
            pts: 2,
            expl: `1階 ${a1.toFixed(2)}＋2階 ${a1.toFixed(2)}=<b>${nobe.toFixed(2)}㎡</b>`,
          },
        ],
        appForm: wgRenkenForm(1, [
          { answer: "建物滅失登記", hint: "建物が「滅失」した" },
        ]).concat([
          {
            label: "登記原因及びその日付",
            answer: [`${date.text}取壊し`, `${date.text} 取壊`, "取壊し"],
            hint: "取壊し完了の日",
            pts: 3,
          },
          {
            label: "申請期限（滅失の日から）",
            answer: ["1か月以内", "一月以内", "1月以内", "1ヶ月以内"],
            hint: "法57条の申請義務",
            pts: 2,
          },
          {
            label: "申請人の資格",
            answer: [
              "表題部所有者又は所有権登記名義人",
              "表題部所有者又は所有権の登記名義人",
            ],
            hint: "法57条の申請義務者",
            pts: 2,
          },
          {
            label: "添付情報（図面）",
            answer: ["なし", "不要", "提供を要しない"],
            hint: "滅失登記に図面は必要か",
            pts: 2,
          },
          {
            label: "登録免許税",
            answer: WG_NONTAX_ACCEPTS,
            hint: "表示に関する登記は非課税",
          },
        ]),
        figure: {
          points: wgRect("a", d1, w1, 0),
          polys: [wgRectPoly("a")],
          lines: [],
          revealPoints: [],
          areaLabels: [
            {
              at: [-d1 / 2, w1 * 0.45],
              text: `各階 ${d1.toFixed(2)}×${w1.toFixed(2)}=${a1.toFixed(2)}㎡`,
            },
          ],
        },
      };
    },
  },

  {
    id: "W20",
    type: "建物",
    title: "建物表題部変更・建物分割登記（一の申請情報）",
    target: "目標45分",
    combo: ["表題部変更", "分割"],
    build(rng) {
      const owner = wgPerson(rng);
      const shiho = wgPerson(rng);
      const date = wgDate(rng);
      const st = _wStruct(rng, "平家建");
      const shu = wgPick(rng, _W_SHURUI);
      const fu = wgPick(rng, ["物置", "車庫", "倉庫"]);
      const md = wgStep(rng, 6, 9, 0.5);
      const mw = wgStep(rng, 8, 11, 0.5);
      const zd = wgStep(rng, 2, 3.5, 0.5);
      const zw = wgStep(rng, 3, 4.5, 0.5);
      const fd = wgStep(rng, 2.5, 4, 0.5);
      const fw = wgStep(rng, 3, 5, 0.5);
      const ma = _wYuka(md * mw);
      const za = _wYuka(zd * zw);
      const maNew = _wYuka(ma + za);
      const fa = _wYuka(fd * fw);
      return {
        statement:
          `<p><b>【事案】</b> ${owner}が所有する登記済みの建物は、主たる建物（<b>${shu.name}</b>・${st.text}・${ma.toFixed(2)}㎡）と` +
          `附属建物（<b>${fu}</b>・${fa.toFixed(2)}㎡）から成る。${owner}は次の2つを希望し、${date.text}、土地家屋調査士${shiho}に依頼した。</p>` +
          `<ul>` +
          `<li>① 主たる建物に<b>増築</b>（奥行 ${zd.toFixed(2)}m × 間口 ${zw.toFixed(2)}m）した工事が<b>${date.text}</b>に完了したので、床面積の変更を登記したい。</li>` +
          `<li>② 附属建物（${fu}）を主たる建物から切り離し、<b>別個独立の一個の建物</b>としたい。</li>` +
          `</ul>` +
          `<p class="small">主たる建物: 奥行 ${md.toFixed(2)}m × 間口 ${mw.toFixed(2)}m（${ma.toFixed(2)}㎡）／附属建物: 奥行 ${fd.toFixed(2)}m × 間口 ${fw.toFixed(2)}m（${fa.toFixed(2)}㎡）</p>` +
          `<p>各寸法は壁芯による（規則115条）。<b>①と②を何件の申請情報で申請すべきか</b>も検討せよ。</p>`,
        coords: [],
        tasks: [
          {
            q: "増築部分の床面積を求めよ。",
            unit: "㎡",
            answer: za,
            tol: 0.005,
            pts: 3,
            expl: `${zd.toFixed(2)}×${zw.toFixed(2)}=<b>${za.toFixed(2)}㎡</b>`,
          },
          {
            q: "増築後の主たる建物の床面積を求めよ。",
            unit: "㎡",
            answer: maNew,
            tol: 0.005,
            pts: 4,
            expl: `既存 ${ma.toFixed(2)}＋増築 ${za.toFixed(2)}=<b>${maNew.toFixed(2)}㎡</b>。床面積に変更が生じたので法51条の変更登記の対象。`,
          },
          {
            q: `分割して独立の建物となる${fu}の床面積を求めよ。`,
            unit: "㎡",
            answer: fa,
            tol: 0.005,
            pts: 3,
            expl: `${fd.toFixed(2)}×${fw.toFixed(2)}=<b>${fa.toFixed(2)}㎡</b>。分割後は新たな家屋番号を付した独立の建物となる。`,
          },
        ],
        appForm: wgRenkenForm(
          1,
          [
            {
              answer: [
                "建物表題部変更・建物分割登記",
                "建物表題部変更・分割登記",
                "建物表題部変更建物分割登記",
              ],
              hint: "表題部の変更の登記と分割の登記をまとめたときの目的",
            },
          ],
          "同一の不動産についての表題部の変更の登記と建物の分割の登記は、規則35条7号により一の申請情報で申請できる",
        ).concat([
          {
            label: "一の申請情報で申請できる根拠（規則の条数）",
            answer: ["規則35条7号", "35条7号", "不動産登記規則35条7号"],
            hint: "令4条ただし書＋規則の号数",
            pts: 4,
          },
          {
            label: "登記原因及びその日付（変更部分）",
            answer: [`${date.text}増築`, `${date.text} 増築`, "増築"],
            hint: "分割には登記原因がないが、変更には原因がある",
            pts: 3,
          },
          {
            label: "申請人の資格",
            answer: [
              "表題部所有者又は所有権登記名義人",
              "表題部所有者又は所有権の登記名義人",
            ],
            hint: "法51条・54条ともに同じ",
            pts: 2,
          },
          {
            label: "添付情報（図面）",
            answer: [
              "建物図面・各階平面図",
              "建物図面、各階平面図",
              "建物図面及び各階平面図",
            ],
            hint: "床面積の変更と分割の双方で必要",
            pts: 2,
          },
          {
            label: "登録免許税",
            answer: WG_NONTAX_ACCEPTS,
            hint: "いずれも表示に関する登記",
            pts: 2,
          },
        ]),
        figure: {
          points: Object.assign(
            wgRect("m", md, mw, 0),
            wgRect("z", zd, zw, 0, -md),
            wgRect("f", fd, fw, mw + 2),
          ),
          polys: [wgRectPoly("m"), wgRectPoly("z"), wgRectPoly("f")],
          lines: [],
          revealPoints: [],
          areaLabels: [
            { at: [-md / 2, mw * 0.45], text: `主 ${ma.toFixed(2)}㎡` },
            { at: [-md - zd / 2, zw * 0.4], text: `増築 ${za.toFixed(2)}㎡` },
            {
              at: [-fd / 2, mw + 2 + fw * 0.45],
              text: `分割→${fu} ${fa.toFixed(2)}㎡`,
            },
          ],
        },
      };
    },
  },

  // ═══════════════ 区分建物 ═══════════════
  {
    id: "W04",
    type: "区分建物",
    title: "区分建物表題登記（内法計算・敷地権）",
    target: "目標45分",
    build(rng) {
      const corp = wgPick(rng, ["株式会社", "有限会社"]) + wgPerson(rng);
      const shiho = wgPerson(rng);
      const shozai = wgShozai(rng);
      const kai = wgPick(rng, [2, 3, 3, 4]);
      const perFloor = wgPick(rng, [2, 2, 3]);
      const st = _wStruct(rng, kai + "階建");
      const od = wgStep(rng, 10, 14, 0.5);
      const ow = wgStep(rng, 18, 24, 0.5);
      const sd = wgStep(rng, 5.5, 7, 0.5);
      const sw = wgStep(rng, 9, 11, 0.5);
      const t = wgPick(rng, [0.16, 0.18, 0.2, 0.24]);
      const oneFloor = _wYuka(od * ow);
      const uchinori = _wYuka((sd - t) * (sw - t));
      const kabeshin = _wYuka(sd * sw);
      return {
        statement:
          `<p><b>【事案】</b> ${corp}は、所有する${shozai}の土地（所有権・更地）上に、<b>${st.text}</b>の共同住宅を新築した。` +
          `各階に専有部分${perFloor}戸（計${kai * perFloor}戸）があり、各専有部分は構造上・利用上の独立性を備える。` +
          `${corp}は土地家屋調査士${shiho}に登記の申請手続を依頼した。</p>` +
          `<ul>` +
          `<li>一棟の建物の各階: <b>壁芯</b>で 奥行 ${od.toFixed(2)}m × 間口 ${ow.toFixed(2)}m</li>` +
          `<li>専有部分101号: <b>壁芯で 奥行 ${sd.toFixed(2)}m × 間口 ${sw.toFixed(2)}m</b>。周囲の壁の厚さは一様に ${t.toFixed(2)}m（壁芯から内側へ各 ${(t / 2).toFixed(2)}m）。</li>` +
          `<li>敷地利用権: <b>所有権</b>。規約による分離処分可能の定めはない。</li>` +
          `</ul>` +
          `<p>床面積は規則115条による（0.01㎡未満切捨て）。</p>`,
        coords: [],
        tasks: [
          {
            q: "一棟の建物の1階の床面積を求めよ。",
            unit: "㎡",
            answer: oneFloor,
            tol: 0.005,
            pts: 3,
            expl: `一棟の建物は<b>壁芯</b>計算: ${od.toFixed(2)}×${ow.toFixed(2)}=<b>${oneFloor.toFixed(2)}㎡</b>`,
          },
          {
            q: "専有部分101号の床面積を求めよ。",
            unit: "㎡",
            answer: uchinori,
            tol: 0.005,
            pts: 6,
            expl:
              `専有部分は<b>内法（壁の内側線）</b>計算（規則115条かっこ書）: ` +
              `(${sd.toFixed(2)}−${(t / 2).toFixed(2)}×2)×(${sw.toFixed(2)}−${(t / 2).toFixed(2)}×2)=${(sd - t).toFixed(2)}×${(sw - t).toFixed(2)}=<b>${uchinori.toFixed(2)}㎡</b>。<br>` +
              `壁芯の ${kabeshin.toFixed(2)}㎡ と書いたら0点級のミス。<b>一棟の建物は壁芯・専有部分は内法</b>を体に入れること。`,
          },
        ],
        appForm: wgRenkenForm(1, [
          { answer: "区分建物表題登記", hint: "" },
        ]).concat([
          {
            label: "申請人",
            answer: ["原始取得者", "原始取得者である表題部所有者"],
            hint: "誰が申請義務を負うか（一般名称で）",
            pts: 2,
          },
          {
            label: "申請の単位",
            answer: [
              "一棟の建物に属する区分建物の全部",
              "一棟の建物に属する区分建物全部",
            ],
            hint: "法48条1項・一括申請",
            pts: 3,
          },
          { label: "敷地権の種類", answer: "所有権", hint: "" },
          {
            label: "一棟の建物の構造",
            answer: st.text,
            hint: "構成材料＋屋根の種類＋階数",
            pts: 2,
          },
          {
            label: "専有部分の床面積の計算方法（壁芯／内法）",
            answer: ["内法", "内法計算", "内側線"],
            hint: "規則115条かっこ書",
            pts: 3,
          },
        ]),
        figure: {
          points: Object.assign(
            wgRect("o", od, ow, 0),
            wgRect("s", sd, sw, 1, -1),
          ),
          polys: [wgRectPoly("o"), wgRectPoly("s")],
          lines: [],
          revealPoints: [],
          areaLabels: [
            {
              at: [-od * 0.85, ow * 0.5],
              text: `一棟 ${od.toFixed(2)}×${ow.toFixed(2)}（壁芯）`,
            },
            {
              at: [-1 - sd / 2, 1 + sw * 0.45],
              text: `101号 内法 ${uchinori.toFixed(2)}㎡`,
            },
          ],
        },
      };
    },
  },

  {
    id: "W10",
    type: "区分建物",
    title: "区分建物表題登記（内法計算と敷地権の割合）",
    target: "目標45分",
    build(rng) {
      const corp = wgPick(rng, ["株式会社", "有限会社"]) + wgPerson(rng);
      const shiho = wgPerson(rng);
      const st = _wStruct(rng, "2階建");
      const t = wgPick(rng, [0.16, 0.18, 0.2, 0.24]);
      // 2戸のサイズを変えて、敷地権の割合が単純な1/2にならないようにする
      const d1 = wgStep(rng, 5.5, 7, 0.5);
      const w1 = wgStep(rng, 9, 11, 0.5);
      const d2 = d1;
      const w2 = wgStep(rng, 6, w1 - 1, 0.5);
      const a1 = _wYuka((d1 - t) * (w1 - t));
      const a2 = _wYuka((d2 - t) * (w2 - t));
      const sum = _wYuka(a1 + a2);
      // 割合は 0.01㎡単位の整数にしてから約分する
      const c1 = Math.round(a1 * 100),
        cs = Math.round(sum * 100);
      const g = _wGcd(c1, cs);
      const num = c1 / g,
        den = cs / g;
      const pct = +((a1 / sum) * 100).toFixed(4);
      return {
        statement:
          `<p><b>【事案】</b> ${corp}は、所有地（更地・所有権）上に<b>${st.text}</b>の共同住宅を新築した。` +
          `各階に専有部分1戸（<b>101号・102号の計2戸</b>）があり、いずれも構造上・利用上の独立性を備える。` +
          `敷地利用権は所有権で、規約による分離処分可能の定めはない。${corp}は土地家屋調査士${shiho}に登記の申請手続を依頼した。</p>` +
          `<ul>` +
          `<li>101号: <b>壁芯で 奥行 ${d1.toFixed(2)}m × 間口 ${w1.toFixed(2)}m</b></li>` +
          `<li>102号: <b>壁芯で 奥行 ${d2.toFixed(2)}m × 間口 ${w2.toFixed(2)}m</b></li>` +
          `<li>周囲の壁の厚さはいずれも一様に ${t.toFixed(2)}m（壁芯から内側へ各 ${(t / 2).toFixed(2)}m）</li>` +
          `<li>敷地権の割合は、各専有部分の<b>床面積の割合</b>による。</li>` +
          `</ul>`,
        coords: [],
        tasks: [
          {
            q: "101号の床面積を求めよ。",
            unit: "㎡",
            answer: a1,
            tol: 0.005,
            pts: 4,
            expl: `専有部分は<b>内法</b>: (${d1.toFixed(2)}−${t.toFixed(2)})×(${w1.toFixed(2)}−${t.toFixed(2)})=${(d1 - t).toFixed(2)}×${(w1 - t).toFixed(2)}=<b>${a1.toFixed(2)}㎡</b>`,
          },
          {
            q: "102号の床面積を求めよ。",
            unit: "㎡",
            answer: a2,
            tol: 0.005,
            pts: 4,
            expl: `(${d2.toFixed(2)}−${t.toFixed(2)})×(${w2.toFixed(2)}−${t.toFixed(2)})=<b>${a2.toFixed(2)}㎡</b>`,
          },
          {
            q: "専有部分の床面積の合計を求めよ。",
            unit: "㎡",
            answer: sum,
            tol: 0.005,
            pts: 2,
            expl: `${a1.toFixed(2)}＋${a2.toFixed(2)}=<b>${sum.toFixed(2)}㎡</b>`,
          },
          {
            q: "101号の敷地権の割合を百分率で求めよ（小数第4位まで）。",
            unit: "%",
            answer: pct,
            tol: 0.01,
            pts: 4,
            expl: `${a1.toFixed(2)} ÷ ${sum.toFixed(2)} = <b>${pct.toFixed(4)}%</b>（分数では <b>${den}分の${num}</b>）。敷地権の割合は専有部分の床面積の割合による。`,
          },
        ],
        appForm: wgRenkenForm(1, [
          { answer: "区分建物表題登記", hint: "" },
        ]).concat([
          {
            label: "敷地権の割合（101号・「◯分の◯」の形で）",
            answer: [`${den}分の${num}`, `${num}/${den}`],
            hint: "床面積の割合を約分した分数で",
            pts: 4,
          },
          {
            label: "申請の単位",
            answer: [
              "一棟の建物に属する区分建物の全部",
              "一棟の建物に属する区分建物全部",
            ],
            hint: "法48条1項・一括申請",
            pts: 3,
          },
          { label: "敷地権の種類", answer: "所有権", hint: "" },
          {
            label: "専有部分の床面積の計算方法（壁芯／内法）",
            answer: ["内法", "内法計算", "内側線"],
            hint: "規則115条かっこ書",
            pts: 2,
          },
        ]),
        figure: {
          points: Object.assign(
            wgRect("a", d1, w1, 0),
            wgRect("b", d2, w2, w1 + 1.5),
          ),
          polys: [wgRectPoly("a"), wgRectPoly("b")],
          lines: [],
          revealPoints: [],
          areaLabels: [
            {
              at: [-d1 / 2, w1 * 0.45],
              text: `101号 内法 ${a1.toFixed(2)}㎡`,
            },
            {
              at: [-d2 / 2, w1 + 1.5 + w2 * 0.45],
              text: `102号 内法 ${a2.toFixed(2)}㎡`,
            },
          ],
        },
      };
    },
  },

  {
    id: "W14",
    type: "区分建物",
    title: "建物区分登記（一個の建物を区分して区分建物に）",
    target: "目標35分",
    build(rng) {
      const owner = wgPerson(rng);
      const shiho = wgPerson(rng);
      const st = _wStruct(rng, "2階建");
      const od = wgStep(rng, 7, 9, 0.5);
      const ow = wgStep(rng, 18, 22, 0.5);
      const t = wgPick(rng, [0.16, 0.18, 0.2, 0.24]);
      const sd = od - wgPick(rng, [1, 1.5, 2]);
      const sw = +(ow / 2).toFixed(2);
      const oneFloor = _wYuka(od * ow);
      const uchinori = _wYuka((sd - t) * (sw - t));
      const kabeshin = _wYuka(sd * sw);
      return {
        statement:
          `<p><b>【事案】</b> ${owner}が所有する登記済みの建物（<b>${st.text}</b>の共同住宅）は、各階が構造上・利用上独立している。` +
          `${owner}は、これを<b>各階ごとの専有部分（101号・102号の2戸）に区分する登記</b>を申請したいと考え、土地家屋調査士${shiho}に依頼した。各寸法は壁芯による。</p>` +
          `<ul>` +
          `<li>一棟の建物（各階）: 壁芯で 奥行 ${od.toFixed(2)}m × 間口 ${ow.toFixed(2)}m</li>` +
          `<li>専有部分101号・102号: いずれも<b>壁芯で 奥行 ${sd.toFixed(2)}m × 間口 ${sw.toFixed(2)}m</b>。周囲の壁の厚さは一様に ${t.toFixed(2)}m（壁芯から内側へ各 ${(t / 2).toFixed(2)}m）。</li>` +
          `</ul>` +
          `<p>建物の区分の登記（法54条1項2号）について検討せよ。</p>`,
        coords: [],
        tasks: [
          {
            q: "一棟の建物の各階の床面積を求めよ。",
            unit: "㎡",
            answer: oneFloor,
            tol: 0.005,
            pts: 3,
            expl: `一棟の建物は<b>壁芯</b>計算: ${od.toFixed(2)}×${ow.toFixed(2)}=<b>${oneFloor.toFixed(2)}㎡</b>`,
          },
          {
            q: "専有部分101号の床面積を求めよ。",
            unit: "㎡",
            answer: uchinori,
            tol: 0.005,
            pts: 5,
            expl: `専有部分は<b>内法</b>計算: (${sd.toFixed(2)}−${(t / 2).toFixed(2)}×2)×(${sw.toFixed(2)}−${(t / 2).toFixed(2)}×2)=${(sd - t).toFixed(2)}×${(sw - t).toFixed(2)}=<b>${uchinori.toFixed(2)}㎡</b>（規則115条かっこ書）。壁芯 ${kabeshin.toFixed(2)}㎡ と取り違えると失点。`,
          },
          {
            q: "専有部分102号の床面積を求めよ。",
            unit: "㎡",
            answer: uchinori,
            tol: 0.005,
            pts: 2,
            expl: `101号と同形なので<b>${uchinori.toFixed(2)}㎡</b>。`,
          },
        ],
        appForm: wgRenkenForm(1, [
          { answer: "建物区分登記", hint: "一個の建物を区分する登記" },
        ]).concat([
          {
            label: "申請人の資格",
            answer: [
              "表題部所有者又は所有権登記名義人",
              "表題部所有者又は所有権の登記名義人",
            ],
            hint: "法54条・申請適格者が限定される",
            pts: 2,
          },
          {
            label: "専有部分の床面積の計算方法（壁芯／内法）",
            answer: ["内法", "内法計算", "内側線"],
            hint: "区分建物の専有部分は壁芯ではなく？",
            pts: 3,
          },
          {
            label: "この登記の申請義務の有無（あり／なし）",
            answer: ["なし", "無"],
            hint: "区分は形成的登記で任意",
            pts: 2,
          },
          {
            label: "登録免許税",
            answer: WG_NONTAX_ACCEPTS,
            hint: "表示に関する登記は非課税",
          },
        ]),
        figure: {
          points: Object.assign(
            wgRect("o", od, ow, 0),
            wgRect("a", sd, sw, 0, -(od - sd) / 2),
            wgRect("b", sd, sw, sw, -(od - sd) / 2),
          ),
          polys: [wgRectPoly("o"), wgRectPoly("a"), wgRectPoly("b")],
          lines: [],
          revealPoints: [],
          areaLabels: [
            {
              at: [-od / 2, sw * 0.5],
              text: `101号 内法 ${uchinori.toFixed(2)}㎡`,
            },
            {
              at: [-od / 2, sw * 1.5],
              text: `102号 内法 ${uchinori.toFixed(2)}㎡`,
            },
          ],
        },
      };
    },
  },

  // ─────────── W24 区分建物の区分合併（敷地権の割合の合算） ───────────
  // 附属合併（割合そのまま・区分建物のまま）との違いが最大の論点。
  //   ① 区分合併できるのは「互いに接続する区分建物同士」だけ
  //   ② 床面積は内法（規則115条）で測り、隔壁を除去した分が加わる
  //   ③ 敷地権の割合は合算する（附属合併では合算しない）
  {
    id: "W24",
    type: "区分建物",
    title: "区分建物の区分合併登記（内法・敷地権の割合の合算）",
    target: "目標45分",
    build(rng) {
      const owner = wgPerson(rng);
      const shiho = wgPerson(rng);
      const shozai = wgShozai(rng);
      const date = wgDate(rng);
      const base = wgInt(rng, 3, 90);

      // 専有部分は内法。隔壁の厚さ分が合併により床面積に加わる。
      const depth = wgStep(rng, 7, 10, 0.5);
      const w1 = wgStep(rng, 5, 8, 0.5);
      const w2 = wgStep(rng, 5, 8, 0.5);
      const kabe = wgPick(rng, [0.12, 0.15, 0.18]); // 隔壁の厚さ(m)
      const a1 = _wYuka(depth * w1);
      const a2 = _wYuka(depth * w2);
      const addition = _wYuka(depth * kabe); // 隔壁の跡が専有部分に加わる
      const merged = _wYuka(a1 + a2 + addition);

      // 敷地権の割合（一棟の総専有面積に対する各専有部分の割合）
      // 敷地権の割合は登記実務では約分せず、一棟の専有面積合計を分母のまま記録する。
      // 問題文の「分母は◯◯」という記述と表示を必ず一致させるため、約分しない。
      const totalSenyu = wgPick(rng, [800, 1000, 1200, 1500, 2000]);
      const n1 = wgInt(rng, 40, 90);
      const n2 = wgInt(rng, 40, 90);
      const rawFrac = (n) => ({
        num: n,
        den: totalSenyu,
        text: `${totalSenyu}分の${n}`,
        accepts: [`${totalSenyu}分の${n}`, `${n}/${totalSenyu}`],
      });
      const f1 = rawFrac(n1);
      const f2 = rawFrac(n2);
      const fMerged = rawFrac(n1 + n2);

      return {
        statement:
          `<p><b>【事案】</b> ${shozai}に所在する一棟の建物（家屋番号 ${base}番の1から${base}番の8まで）のうち、` +
          `${owner}が所有する<b>${base}番の1</b>と<b>${base}番の2</b>は互いに接続している。` +
          `${owner}は、両者の間の隔壁を除去して1個の専有部分とすることなく、<b>登記記録の上で1個の区分建物にまとめたい</b>と考え、` +
          `${date.text}、土地家屋調査士${shiho}に依頼した。</p>` +
          `<table class="simple"><tr><th>家屋番号</th><th>床面積（内法）</th><th>敷地権の割合</th></tr>` +
          `<tr><td>${base}番の1</td><td>${a1.toFixed(2)}㎡</td><td>${f1.text}</td></tr>` +
          `<tr><td>${base}番の2</td><td>${a2.toFixed(2)}㎡</td><td>${f2.text}</td></tr></table>` +
          `<p class="small">各専有部分: 奥行 ${depth.toFixed(2)}m ／ ${base}番の1の間口 ${w1.toFixed(2)}m ／ ${base}番の2の間口 ${w2.toFixed(2)}m ` +
          `（いずれも<b>内法</b>・規則115条）。両者を隔てる隔壁の厚さは ${kabe.toFixed(2)}m である。</p>` +
          `<p>敷地権の割合は、いずれも一棟の建物の専有部分の床面積の合計 ${totalSenyu} を分母とする割合で登記されている。</p>`,
        coords: [],
        tasks: [
          {
            q: "区分合併により床面積に加わる、隔壁が占めていた部分の面積を求めよ。",
            unit: "㎡",
            answer: addition,
            tol: 0.005,
            pts: 4,
            expl:
              `奥行 ${depth.toFixed(2)}×隔壁の厚さ ${kabe.toFixed(2)}=<b>${addition.toFixed(2)}㎡</b>。<br>` +
              `専有部分は<b>内法</b>で測るため、隔壁の内側までしか算入されていなかった。区分合併により1個の専有部分となると、` +
              `その隔壁が占めていた部分も内法の内側に入る。`,
          },
          {
            q: "区分合併後の区分建物の床面積を求めよ。",
            unit: "㎡",
            answer: merged,
            tol: 0.005,
            pts: 5,
            expl:
              `${a1.toFixed(2)}＋${a2.toFixed(2)}＋${addition.toFixed(2)}=<b>${merged.toFixed(2)}㎡</b>。<br>` +
              `<b>単純な合算にはならない</b>点がこの問題の核心。`,
          },
          {
            q: `区分合併後の敷地権の割合の分子を、分母を${fMerged.den}としたときの数で答えよ。`,
            unit: "",
            answer: fMerged.num,
            tol: 0,
            pts: 4,
            expl:
              `敷地権の割合は<b>合算</b>する。${f1.text}＋${f2.text}＝<b>${fMerged.text}</b>。<br>` +
              `<b>附属合併</b>では主である建物と附属建物の割合はそれぞれ据え置かれ、合算しない点と対比すること。`,
          },
        ],
        appForm: wgRenkenForm(
          1,
          [
            {
              answer: ["建物合併登記", "区分建物合併登記", "建物区分合併登記"],
              hint: "区分建物同士を1個の区分建物にまとめる登記",
            },
          ],
          "合併の登記のみなので一の申請情報",
        ).concat([
          {
            label: "区分合併ができるための、両建物の位置関係の要件",
            answer: [
              "互いに接続していること",
              "接続していること",
              "互いに接続する区分建物であること",
            ],
            hint: "接続していない区分建物同士は区分合併できない（準則86条2号）",
            pts: 4,
          },
          {
            label: "合併後の敷地権の割合",
            answer: fMerged.accepts,
            hint: "合算する。附属合併なら据え置き",
            pts: 3,
          },
          {
            label: "登記原因及びその日付",
            answer: ["記載しない", "記載を要しない", "なし"],
            hint: "合併の登記に登記原因はない",
            pts: 3,
          },
          {
            label: "合併後の建物が区分建物でない建物となるか",
            answer: ["ならない", "区分建物のまま", "区分建物である"],
            hint: "一棟の建物に他の区分建物が残っている",
            pts: 3,
          },
          {
            label: "添付情報（図面）",
            answer: [
              "建物図面・各階平面図",
              "建物図面、各階平面図",
              "建物図面及び各階平面図",
            ],
            hint: "合併後の区分建物について作成する",
            pts: 2,
          },
          {
            label: "登録免許税",
            answer: WG_NONTAX_ACCEPTS,
            hint: "表示に関する登記である",
            pts: 2,
          },
        ]),
        figureChecks: wgFigChecks("tatemonoZumen", [
          "一棟の建物の中における合併後の区分建物の位置を示した",
        ]).concat(
          wgFigChecks("kakukaiHeimen", [
            "隔壁を除いた1個の専有部分として作図した",
            `合併後の床面積 ${merged.toFixed(2)}㎡ を内法で記入した`,
          ]),
        ),
        verify: {
          kind: "kubunGappei",
          a1: a1,
          a2: a2,
          addition: addition,
          merged: merged,
          frac1: [f1.num, f1.den],
          frac2: [f2.num, f2.den],
          fracMerged: [fMerged.num, fMerged.den],
        },
        figure: {
          points: Object.assign(
            wgRect("p", depth, w1, 0),
            wgRect("q", depth, w2, w1 + kabe),
          ),
          polys: [wgRectPoly("p"), wgRectPoly("q")],
          lines: [],
          revealPoints: [],
          areaLabels: [
            {
              at: [-depth / 2, w1 * 0.45],
              text: `${base}番の1 内法 ${a1.toFixed(2)}㎡`,
            },
            {
              at: [-depth / 2, w1 + kabe + w2 * 0.45],
              text: `${base}番の2 内法 ${a2.toFixed(2)}㎡`,
            },
          ],
        },
      };
    },
  },

  // ─────────── W23 建物合併（56条の合併制限を見抜く） ───────────
  // 3個の建物のうち1個に合併制限事由を仕込み、「どれと合併できるか」を判断させる。
  // 合筆制限（W19）の建物版。床面積の合算より、制限事由の判定が失点源になる。
  {
    id: "W23",
    type: "建物",
    title: "建物合併登記（56条の合併制限で合併できない建物を見抜く）",
    target: "目標40分",
    build(rng) {
      const owner = wgPerson(rng);
      const other = wgPerson(rng);
      if (owner === other) return null;
      const shiho = wgPerson(rng);
      const shozai = wgShozai(rng);
      const date = wgDate(rng);
      const st = _wStruct(rng, "平家建");
      const base = wgInt(rng, 3, 90);

      const dim = () => {
        const d = wgStep(rng, 5, 9, 0.5);
        const w = wgStep(rng, 6, 11, 0.5);
        return { d: d, w: w, a: _wYuka(d * w) };
      };
      const kou = dim();
      const otsu = dim();
      const hei = dim();

      // 丙建物に合併制限事由を1つだけ仕込む（毎回どの事由かが変わる）
      const seigen = wgPick(rng, [
        {
          note: `所有権の登記名義人が<b>${other}</b>である`,
          reason:
            "表題部所有者又は所有権の登記名義人が相互に異なる建物であるため（法56条3号）",
        },
        {
          note: "<b>共用部分である旨の登記</b>がある",
          reason: "共用部分である旨の登記がある建物であるため（法56条1号）",
        },
        {
          note: "所有権の登記がなく<b>表題登記のみ</b>である（甲建物には所有権の登記がある）",
          reason:
            "表題登記がある建物と所有権の登記がある建物との合併に当たるため（法56条2号）",
        },
        {
          note: "甲建物とは<b>受付番号が異なる抵当権</b>の設定の登記がある",
          reason:
            "所有権等以外の権利に関する登記があり、受付番号等が同一でないため（法56条5号）",
        },
      ]);

      const merged = _wYuka(kou.a + otsu.a);

      return {
        statement:
          `<p><b>【事案】</b> ${shozai}に所在する次の3個の建物は、いずれも${st.text}で、互いに接続している。` +
          `${owner}は、これらをできる限り1個の建物にまとめたいと考え、${date.text}、土地家屋調査士${shiho}に相談した。</p>` +
          `<table class="simple"><tr><th>建物</th><th>家屋番号</th><th>床面積</th><th>登記の状況</th></tr>` +
          `<tr><td>甲建物</td><td>${base}番1</td><td>${kou.a.toFixed(2)}㎡</td><td>${owner}を所有権の登記名義人とする所有権の登記がある</td></tr>` +
          `<tr><td>乙建物</td><td>${base}番2</td><td>${otsu.a.toFixed(2)}㎡</td><td>${owner}を所有権の登記名義人とする所有権の登記がある</td></tr>` +
          `<tr><td>丙建物</td><td>${base}番3</td><td>${hei.a.toFixed(2)}㎡</td><td>${seigen.note}</td></tr></table>` +
          `<p class="small">甲: 奥行 ${kou.d.toFixed(2)}m × 間口 ${kou.w.toFixed(2)}m ／ 乙: 奥行 ${otsu.d.toFixed(2)}m × 間口 ${otsu.w.toFixed(2)}m ／ 丙: 奥行 ${hei.d.toFixed(2)}m × 間口 ${hei.w.toFixed(2)}m（壁芯）</p>` +
          `<p>甲建物を主である建物とし、合併できる建物のみを<b>附属建物</b>とする合併の登記を申請する。</p>`,
        coords: [],
        tasks: [
          {
            q: "乙建物の床面積を求めよ。",
            unit: "㎡",
            answer: otsu.a,
            tol: 0.005,
            pts: 3,
            expl: `${otsu.d.toFixed(2)}×${otsu.w.toFixed(2)}=<b>${otsu.a.toFixed(2)}㎡</b>`,
          },
          {
            q: "合併後の建物の床面積の合計（主である建物＋附属建物）を求めよ。",
            unit: "㎡",
            answer: merged,
            tol: 0.005,
            pts: 5,
            expl:
              `合併できるのは<b>乙建物のみ</b>。甲 ${kou.a.toFixed(2)}＋乙 ${otsu.a.toFixed(2)}=<b>${merged.toFixed(2)}㎡</b>。<br>` +
              `丙建物は${seigen.reason}合併できないので加えない。<br>` +
              `なお合併は<b>登記記録をまとめるだけ</b>で物理的変更を伴わないから、各建物の床面積は変わらない（合体との違い）。`,
          },
        ],
        appForm: wgRenkenForm(
          1,
          [
            {
              answer: ["建物合併登記", "建物附属合併登記", "建物合併の登記"],
              hint: "甲建物に乙建物を附属建物として合併する",
            },
          ],
          "合併の登記のみなので一の申請情報",
        ).concat([
          {
            label: "丙建物を合併できない理由（根拠の号数まで）",
            answer: [seigen.reason],
            hint: "法56条各号のどれに当たるか",
            pts: 5,
          },
          {
            label: "登記原因及びその日付",
            answer: ["記載しない", "記載を要しない", "なし"],
            hint: "合併の登記に登記原因はない（分筆・合筆と同じ考え方）",
            pts: 3,
          },
          {
            label: "申請人の資格",
            answer: [
              "所有権登記名義人",
              "所有権の登記名義人",
              "表題部所有者又は所有権登記名義人",
            ],
            hint: "本問の甲・乙にはいずれも所有権の登記がある",
            pts: 2,
          },
          {
            label: "添付情報（図面）",
            answer: [
              "建物図面・各階平面図",
              "建物図面、各階平面図",
              "建物図面及び各階平面図",
            ],
            hint: "合併後の建物について作成する",
            pts: 2,
          },
          {
            label: "添付情報（本人性の確認に関するもの）",
            answer: ["登記識別情報", "登記識別情報（合併に係る建物のもの）"],
            hint: "所有権の登記がある建物の合併では提供を要する",
            pts: 3,
          },
          {
            label: "登録免許税",
            answer: WG_NONTAX_ACCEPTS,
            hint: "表示に関する登記である",
            pts: 2,
          },
        ]),
        figureChecks: wgFigChecks("tatemonoZumen", [
          "合併後の主である建物と附属建物を1枚の建物図面に描いた",
          "附属建物に符号を付した",
          "合併できない丙建物を図に含めていない",
        ]).concat(wgFigChecks("kakukaiHeimen")),
        verify: {
          kind: "gappei",
          areaKou: kou.a,
          areaOtsu: otsu.a,
          areaHei: hei.a,
          merged: merged,
          reason: seigen.reason,
        },
        figure: {
          points: Object.assign(
            wgRect("k", kou.d, kou.w, 0),
            wgRect("o", otsu.d, otsu.w, kou.w + 1.5),
          ),
          polys: [wgRectPoly("k"), wgRectPoly("o")],
          lines: [],
          revealPoints: [],
          areaLabels: [
            {
              at: [-kou.d / 2, kou.w * 0.45],
              text: `甲(主) ${kou.a.toFixed(2)}㎡`,
            },
            {
              at: [-otsu.d / 2, kou.w + 1.5 + otsu.w * 0.45],
              text: `乙(附属) ${otsu.a.toFixed(2)}㎡`,
            },
          ],
        },
      };
    },
  },

  // ─────────── W22 土地表題登記（公有水面の埋立地） ───────────
  // 新たに生じた土地の表題登記。答練の記述式で「土地表題登記」は頻出（10回以上）だが
  // テンプレートが無かった類型。要点は
  //   ① 所有権を取得するのは「竣功認可の告示の日」であり、申請義務の起算日もその日
  //   ② 土地所在図と地積測量図の両方が必要（分筆等と違い所在図が要る）
  //   ③ 地積は規則100条（地目により切捨ての桁が変わる）
  {
    id: "W22",
    type: "土地",
    title: "土地表題登記（公有水面埋立地・座標法求積）",
    target: "目標35分",
    build(rng) {
      const sh = wgTanpitsuShape(rng, { geo: rng() < 0.5 });
      if (!sh) return null;
      const owner = wgPerson(rng);
      const shiho = wgPerson(rng);
      const shozai = wgShozai(rng);
      const chiban = wgChiban(rng);
      const chimoku = wgPick(rng, ["宅地", "雑種地", "原野"]);
      const dg = sh.geo ? 3 : 2;

      // 免許 → 竣功 → 告示 の順。所有権取得＝告示の日。
      const dMenkyo = wgDate(rng);
      const dKokuji = wgDate(rng);
      const key = (d) => d.y * 10000 + d.m * 100 + d.d;
      if (key(dMenkyo) >= key(dKokuji)) return null; // 免許が告示より後は事案として破綻

      const gChiseki = wgChiseki(sh.area, chimoku);
      const pts = [sh.A, sh.B, sh.C, sh.D];

      return {
        statement:
          `<p><b>【事案】</b> ${owner}は、公有水面埋立法の規定により<b>${dMenkyo.text}</b>に埋立ての免許を受け、` +
          `埋立工事を完了した。その後、<b>${dKokuji.text}</b>に竣功認可の告示がされた。</p>` +
          `<p>１　${owner}は、新たに生じた土地について必要な登記の申請手続を、土地家屋調査士${shiho}に依頼した。</p>` +
          `<p>２　新たに生じた土地の所在は${shozai}、予定地番は${chiban.text}、現況の地目は<b>${chimoku}</b>である。</p>` +
          `<p>３　筆界点Ａ・Ｂ・Ｃ・Ｄの${sh.geo ? "世界測地系（平面直角座標系）" : "任意座標系"}による座標値は〔測量の結果〕のとおりである。</p>` +
          `<p>４　座標値・辺長は小数第${dg === 3 ? "３" : "２"}位までとし、地積は不動産登記規則第100条による。</p>`,
        coords: wgCoordRows([
          ["A", sh.A, "北側筆界（西）"],
          ["B", sh.B, "北側筆界（東）"],
          ["C", sh.C, "南側筆界（東）"],
          ["D", sh.D, "南側筆界（西）"],
        ]),
        tasks: [
          {
            q: `新たに生じた土地の面積を座標法で求めよ（小数第${dg === 3 ? "３" : "２"}位まで）。`,
            unit: "㎡",
            answer: +sh.area.toFixed(dg),
            tol: 0.05,
            pts: 5,
            expl: `倍面積＝ΣXᵢ(Yᵢ₊₁−Yᵢ₋₁) の絶対値＝${wgDoubleArea(pts).toFixed(dg)} ⟹ 面積＝<b>${sh.area.toFixed(dg)}㎡</b>`,
          },
          {
            q: "登記すべき地積を答えよ（規則100条）。",
            unit: "㎡",
            answer: gChiseki,
            tol: 0,
            pts: 4,
            expl: `${wgChisekiRule(chimoku)}⟹ <b>${wgChisekiText(gChiseki, chimoku)}㎡</b>`,
          },
          {
            q: `地積測量図に記入する<b>北側筆界ＡＢの辺長</b>を求めよ（小数第${dg === 3 ? "３" : "２"}位まで）。`,
            unit: "m",
            answer: +wgDist(sh.A, sh.B).toFixed(dg),
            tol: 0.005,
            pts: 3,
            expl:
              `Ａ・Ｂはともに X=${sh.A[0].toFixed(dg)} の直線上にあるので辺長はＹ座標の差＝` +
              `<b>${wgDist(sh.A, sh.B).toFixed(dg)}m</b>。`,
          },
        ],
        appForm: wgRenkenForm(
          1,
          [
            {
              answer: ["土地表題登記", "土地表題部登記"],
              hint: "新たに生じた土地について最初にする登記",
            },
          ],
          "表題登記のみなので一の申請情報",
        ).concat([
          {
            label: "登記原因及びその日付",
            answer: [
              `${dKokuji.text}公有水面埋立`,
              `${dKokuji.text} 公有水面埋立`,
              "公有水面埋立",
            ],
            hint: "原因の日付は所有権を取得した日（竣功認可の告示の日）",
            pts: 4,
          },
          {
            label: "申請義務の起算日",
            answer: [
              dKokuji.text,
              `${dKokuji.text}（竣功認可の告示の日）`,
              "竣功認可の告示の日",
            ],
            hint: "埋立工事が完了した日でも、免許を受けた日でもない",
            pts: 4,
          },
          {
            label: "申請義務の期間",
            answer: ["1月以内", "1か月以内", "1ヶ月以内", "一月以内"],
            hint: "法36条",
            pts: 2,
          },
          {
            label: "添付情報（図面。2種類とも）",
            answer: [
              "土地所在図・地積測量図",
              "土地所在図、地積測量図",
              "土地所在図及び地積測量図",
            ],
            hint: "分筆の登記と違い、この登記では所在図も必要になる",
            pts: 4,
          },
          {
            label: "添付情報（所有権に関するもの）",
            answer: [
              "所有権を証する情報",
              "所有権証明情報",
              "所有権を証する情報（竣功認可書）",
            ],
            hint: "官庁の証明書（竣功認可書）がこれに当たる",
            pts: 3,
          },
          {
            label: "添付情報（申請人に関するもの）",
            answer: ["住所を証する情報", "住所証明情報"],
            hint: "表題部所有者となる者について必要",
            pts: 2,
          },
          {
            label: "登録免許税",
            answer: WG_NONTAX_ACCEPTS,
            hint: "表示に関する登記である",
            pts: 2,
          },
        ]),
        figureChecks: wgFigChecks("chisekiSokuryo", [
          "土地所在図も併せて作成した（地積測量図だけでは足りない）",
        ]),
        verify: {
          kind: "tanpitsu",
          poly: ["A", "B", "C", "D"],
          chimoku: chimoku,
          chiseki: gChiseki,
          kokujiKey: key(dKokuji),
          menkyoKey: key(dMenkyo),
          kisanbi: dKokuji.text,
        },
        figure: {
          points: { A: sh.A, B: sh.B, C: sh.C, D: sh.D },
          polys: [["A", "B", "C", "D"]],
          lines: [],
          revealPoints: [],
          areaLabels: [
            {
              at: [
                (sh.A[0] + sh.C[0]) / 2,
                (sh.A[1] + sh.B[1] + sh.C[1] + sh.D[1]) / 4,
              ],
              text: `${chiban.text} (${wgChisekiText(gChiseki, chimoku)}㎡)`,
            },
          ],
        },
      };
    },
  },

  // ─────────── W21 建物合体 ───────────
  // 別々の建物が増築工事で構造上1個の建物になった場面。本試験の建物枠で最も重い類型で、
  //   ① 合体後の床面積（接続部分も算入する）
  //   ② 所有者が異なるときの持分（価額の割合。民法244条の付合の規定を類推）
  //   ③ 所有権の登記がある建物を含むときは、所有権の登記も併せて申請する（法49条1項後段）
  //   ④ 申請義務の起算日（合体の日ではなく、その者に係る所有権の登記があった日等）
  // の4点が同時に問われる。①は計算、②〜④は申請書で聞く。
  {
    id: "W21",
    type: "建物",
    title: "建物合体による登記等（床面積・持分・所有権の登記）",
    target: "目標50分",
    combo: ["合体", "所有権保存"],
    build(rng) {
      const ownerA = wgPerson(rng);
      const ownerB = wgPerson(rng);
      if (ownerA === ownerB) return null; // 所有者が別人であることがこの問題の核心
      const shiho = wgPerson(rng);
      const shozai = wgShozai(rng);
      const chiban = wgChiban(rng);
      const st = _wStruct(rng, "平家建");
      const shuA = wgPick(rng, _W_SHURUI);
      const shuB = wgPick(rng, _W_SHURUI);

      // 甲建物（所有権の登記あり）・乙建物（表題登記のみ）・接続部分の寸法。壁芯による。
      const ad = wgStep(rng, 6, 9, 0.5);
      const aw = wgStep(rng, 7, 11, 0.5);
      const bd = wgStep(rng, 5, 8, 0.5);
      const bw = wgStep(rng, 6, 10, 0.5);
      const cd = wgStep(rng, 2.5, Math.min(ad, bd) - 1, 0.5); // 接続部分は両建物より浅い
      const cw = wgStep(rng, 2, 4, 0.5);
      if (cd < 2.5) return null;

      const areaA = _wYuka(ad * aw);
      const areaB = _wYuka(bd * bw);
      const areaC = _wYuka(cd * cw);
      const areaTotal = _wYuka(areaA + areaB + areaC);

      // 持分は合体前の各建物の価額の割合による（民法244条の類推）。
      // 割合を自分で決めさせると割り切れないので、価額を問題文で与える。
      const kaA = wgPick(rng, [1200, 1500, 1800, 2100, 2400]);
      const kaB = wgPick(rng, [600, 800, 900, 1000, 1200]);
      const mochiA = wgReduceFrac(kaA, kaA + kaB);
      const mochiB = wgReduceFrac(kaB, kaA + kaB);

      // 甲建物の所有権の登記は「合体より前」でなければ事案が破綻する。
      // 2つ引いて古い方を所有権の登記の日、新しい方を合体の日にする。
      // （所有権の登記の日は、起算日を誤らせるための撹乱要素として残す）
      const d1 = wgDate(rng);
      const d2 = wgDate(rng);
      const dayKey = (d) => d.y * 10000 + d.m * 100 + d.d;
      if (dayKey(d1) === dayKey(d2)) return null;
      const dHozon = dayKey(d1) < dayKey(d2) ? d1 : d2;
      const dGattai = dayKey(d1) < dayKey(d2) ? d2 : d1;

      return {
        statement:
          `<p><b>【事案】</b> ${shozai}${chiban.text}の土地の上に、次の2個の建物が別々に登記されていた。` +
          `${dGattai.text}、両建物の間に接続部分を増築する工事が完了し、構造上1個の建物となった。</p>` +
          `<p>所有者${ownerA}及び${ownerB}は、土地家屋調査士${shiho}に必要な登記の申請手続を依頼した。</p>` +
          `<table class="simple"><tr><th>建物</th><th>登記の状況</th><th>所有者</th><th>種類・構造</th><th>床面積</th><th>価額</th></tr>` +
          `<tr><td>甲建物</td><td><b>所有権の登記がある</b></td><td>${ownerA}</td><td>${shuA.name}・${st.text}</td><td>${areaA.toFixed(2)}㎡</td><td>${kaA.toLocaleString("en-US")}万円</td></tr>` +
          `<tr><td>乙建物</td><td>表題登記のみ</td><td>${ownerB}</td><td>${shuB.name}・${st.text}</td><td>${areaB.toFixed(2)}㎡</td><td>${kaB.toLocaleString("en-US")}万円</td></tr></table>` +
          `<p class="small">甲建物: 奥行 ${ad.toFixed(2)}m × 間口 ${aw.toFixed(2)}m ／ 乙建物: 奥行 ${bd.toFixed(2)}m × 間口 ${bw.toFixed(2)}m ／ ` +
          `増築した接続部分: 奥行 ${cd.toFixed(2)}m × 間口 ${cw.toFixed(2)}m（いずれも壁芯・規則115条）</p>` +
          `<p>甲建物についての所有権の登記は、合体前の<b>${dHozon.text}</b>に既にされている。合体後の建物の持分は、` +
          `<b>合体前の各建物の価額の割合</b>によるものとする。<b>何件の申請情報で、どのような登記を申請すべきか</b>も検討せよ。</p>`,
        coords: [],
        tasks: [
          {
            q: "増築した接続部分の床面積を求めよ。",
            unit: "㎡",
            answer: areaC,
            tol: 0.005,
            pts: 3,
            expl: `${cd.toFixed(2)}×${cw.toFixed(2)}=<b>${areaC.toFixed(2)}㎡</b>。接続部分も外気分断性を備えた建物の一部なので床面積に算入する。`,
          },
          {
            q: "合体後の建物の床面積を求めよ。",
            unit: "㎡",
            answer: areaTotal,
            tol: 0.005,
            pts: 5,
            expl:
              `甲 ${areaA.toFixed(2)}＋乙 ${areaB.toFixed(2)}＋接続部分 ${areaC.toFixed(2)}=<b>${areaTotal.toFixed(2)}㎡</b>。<br>` +
              `<b>合体前の床面積の単純な合計にはならない</b>点に注意（隔壁の除去や接続部分の増築で生じた部分が加わる）。`,
          },
          {
            q: `合体後の建物について${ownerA}が有する持分の分子を、分母を${mochiA.den}としたときの数で答えよ。`,
            unit: "",
            answer: mochiA.num,
            tol: 0,
            pts: 4,
            expl:
              `持分は合体前の各建物の<b>価額の割合</b>による（民法244条の付合の規定の類推）。<br>` +
              `${ownerA}: ${kaA.toLocaleString("en-US")}／(${kaA.toLocaleString("en-US")}＋${kaB.toLocaleString("en-US")})＝<b>${mochiA.text}</b>、` +
              `${ownerB}: <b>${mochiB.text}</b>。<br>床面積の割合ではない点に注意。`,
          },
        ],
        appForm: wgRenkenForm(
          1,
          [
            {
              answer: [
                "建物合体による登記等",
                "合体による登記等",
                "建物の合体による登記等",
              ],
              hint: "合体後の建物の表題登記と、合体前の建物の表題部の登記の抹消をまとめた目的",
            },
          ],
          "合体後の建物の表題登記と合体前の建物の表題部の登記の抹消は、令5条1項により一の申請情報で申請しなければならない",
        ).concat([
          {
            label: "登記原因及びその日付",
            answer: [`${dGattai.text}合体`, `${dGattai.text} 合体`, "合体"],
            hint: "工事が完了して構造上1個の建物となった日",
            pts: 3,
          },
          {
            label: `合体後の建物について${ownerA}が有する持分`,
            answer: mochiA.accepts,
            hint: "価額の割合による。「◯分の◯」の形で",
            pts: 3,
          },
          {
            label: `合体後の建物について${ownerB}が有する持分`,
            answer: mochiB.accepts,
            hint: "2人の持分の合計は1になる",
            pts: 3,
          },
          {
            label:
              "合体による登記等と併せて申請しなければならない権利に関する登記",
            answer: ["所有権の登記", "合体による所有権の登記", "所有権登記"],
            hint: "合体前の建物に所有権の登記がある建物が含まれている（法49条1項後段）",
            pts: 4,
          },
          {
            label: "申請人",
            answer: [
              `${ownerA}及び${ownerB}`,
              `${ownerA}、${ownerB}`,
              `${ownerA}と${ownerB}`,
              "合体前の各建物の所有者",
            ],
            hint: "合体前の建物の表題部所有者又は所有権の登記名義人",
            pts: 2,
          },
          {
            label: "申請義務の起算日",
            answer: [dGattai.text, `${dGattai.text}（合体の日）`, "合体の日"],
            hint: "本問の両名は合体の時点で既に所有者である（法49条1項）",
            pts: 4,
          },
          {
            label: "申請義務の期間",
            answer: ["1月以内", "1か月以内", "1ヶ月以内", "一月以内"],
            hint: "起算日から。なお合体後に持分を取得した者は取得の日から、合体後に所有権の登記名義人となった者はその登記があった日から起算する（法49条3項・4項）",
            pts: 2,
          },
          {
            label: "添付情報（持分に関するもの）",
            answer: [
              "持分の割合を証する情報",
              "持分を証する情報",
              "所有者が合体後の建物について有する持分の割合を証する情報",
            ],
            hint: "合体前の各建物の所有者が異なるときに必要となる",
            pts: 3,
          },
          {
            label: "添付情報（図面）",
            answer: [
              "建物図面・各階平面図",
              "建物図面、各階平面図",
              "建物図面及び各階平面図",
            ],
            hint: "合体後の建物について作成する",
            pts: 2,
          },
          {
            label: "登録免許税（合体による登記等の部分）",
            answer: WG_NONTAX_ACCEPTS,
            hint: "表示に関する登記である",
            pts: 2,
          },
        ]),
        figureChecks: wgFigChecks("tatemonoZumen", [
          "合体後の建物として1個の建物図面を作成した（甲・乙を別々に描いていない）",
          "接続部分を含めた外周で作図した",
        ]).concat(
          wgFigChecks("kakukaiHeimen", [
            `合体後の床面積 ${areaTotal.toFixed(2)}㎡ を記入した`,
          ]),
        ),
        // ハーネスが床面積と持分を独立に検算するための情報
        verify: {
          kind: "gattai",
          areaA: areaA,
          areaB: areaB,
          areaC: areaC,
          areaTotal: areaTotal,
          kaA: kaA,
          kaB: kaB,
          mochiA: [mochiA.num, mochiA.den],
          mochiB: [mochiB.num, mochiB.den],
          // 事案の時系列（所有権の登記は必ず合体より前）と、起算日の正答
          hozonKey: dHozon.y * 10000 + dHozon.m * 100 + dHozon.d,
          gattaiKey: dGattai.y * 10000 + dGattai.m * 100 + dGattai.d,
          kisanbi: dGattai.text,
        },
        figure: {
          points: Object.assign(
            wgRect("a", ad, aw, 0),
            wgRect("c", cd, cw, aw),
            wgRect("b", bd, bw, aw + cw),
          ),
          polys: [wgRectPoly("a"), wgRectPoly("c"), wgRectPoly("b")],
          lines: [],
          revealPoints: [],
          areaLabels: [
            { at: [-ad / 2, aw * 0.45], text: `甲 ${areaA.toFixed(2)}㎡` },
            {
              at: [-cd / 2, aw + cw * 0.3],
              text: `接続 ${areaC.toFixed(2)}㎡`,
            },
            {
              at: [-bd / 2, aw + cw + bw * 0.45],
              text: `乙 ${areaB.toFixed(2)}㎡`,
            },
          ],
        },
      };
    },
  },

  {
    id: "W25",
    type: "土地",
    title: "土地分筆登記（公差の判断・地積更正の要否）",
    target: "目標55分",
    build(rng) {
      const b = _wBunpitsuCore(rng, { mode: "real", geo: rng() < 0.5 });
      if (!b) return null;

      // 地域区分から精度区分と公差を決める（規則10条4項・国土調査法施行令別表第四）
      const chiiki = wgPick(rng, WG_CHIIKI);
      const kosa = wgKosaShown(b.total, chiiki.seido);
      if (kosa == null || kosa < 0.05) return null;

      // 登記地積を実測からずらす。公差の内と外をおよそ半々で出し、
      // 「毎回更正が必要」と覚えてしまわないようにする。
      const inside = rng() < 0.5;
      // 内側なら公差の30〜85%、外側なら公差の120〜260%だけずらす
      const ratio = inside
        ? wgInt(rng, 30, 85) / 100
        : wgInt(rng, 120, 260) / 100;
      const sign = rng() < 0.5 ? -1 : 1;
      const tokiChiseki = wgChiseki(b.total + sign * kosa * ratio, b.chimoku);
      const sa = +Math.abs(b.total - tokiChiseki).toFixed(4);
      // 丸めの結果、意図した内外が入れ替わることがある。判定は実際の差で確定させる。
      const needsKousei = sa > kosa;
      // 判定が公差ちょうどの近傍だと自己採点で揉めるので、余裕がない事案は捨てる
      if (Math.abs(sa - kosa) < 0.05) return null;

      const tax = wgBunpitsuTax(2);
      const mokuteki = needsKousei
        ? [
            "土地地積更正・分筆登記",
            "土地地積更正分筆登記",
            "地積更正・分筆登記",
          ]
        : ["土地分筆登記", "分筆登記"];

      return {
        statement:
          `<p><b>【事案】</b> ${b.owner}は、所有する下記の土地（以下「甲土地」という。）のうち一方の部分を売却するため、` +
          `${b.date.text}、土地家屋調査士${b.shiho}に必要な登記の申請手続を依頼した。</p>` +
          // 共通の bukkenLine は求積値をそのまま登記地積として書くため使えない。
          // この問題は「登記地積と求積値がずれている」ことが主題なので、登記地積を明示する。
          `<p class="small">所　在　${b.shozai}／地　番　${b.chiban.text}／地　目　<b>${b.chimoku}</b>` +
          `／地　積　<b>${wgChisekiText(tokiChiseki, b.chimoku)}㎡</b>（登記記録）／所有権登記名義人　${b.owner}</p>` +
          b.sokuteiNote(1) +
          `<p>５　甲土地の存する地域は<b>${chiiki.name}</b>であり、地積測定の公差は、` +
          `国土調査法施行令別表第四に掲げる精度区分<b>${chiiki.seido}</b>として ` +
          `<b>${kosa.toFixed(2)}㎡</b> である。</p>` +
          `<p>６　求積値と登記記録の地積との差が<b>公差の範囲内であるときは、地積に関する更正の登記は申請しない</b>ものとする。</p>`,
        coords: b.coords,
        tasks: b.tasks.concat([
          {
            q: "甲土地（分筆前）の求積値と登記記録の地積との差は何㎡か（小数第２位まで）。",
            unit: "㎡",
            answer: +sa.toFixed(2),
            tol: 0.02,
            pts: 4,
            expl:
              `分筆後の地積の合計＝${wgChisekiText(b.gW, b.chimoku)}＋${wgChisekiText(b.gE, b.chimoku)}` +
              `＝<b>${wgChisekiText(b.total, b.chimoku)}㎡</b>。<br>` +
              `登記記録の地積は ${wgChisekiText(tokiChiseki, b.chimoku)}㎡ なので、差は` +
              `|${b.total.toFixed(2)}−${tokiChiseki.toFixed(2)}|＝<b>${sa.toFixed(2)}㎡</b>。`,
          },
        ]),
        appForm: wgRenkenForm(
          1,
          [{ answer: mokuteki, hint: "公差の判断の結果によって変わる" }],
          "一の申請情報による",
        ).concat([
          {
            label: "地積に関する更正の登記の要否（「必要」か「不要」で答える）",
            answer: needsKousei
              ? ["必要", "要", "申請する"]
              : ["不要", "要しない", "申請しない"],
            hint: `差 ${sa.toFixed(2)}㎡ と公差 ${kosa.toFixed(2)}㎡ を比べる`,
            pts: 4,
          },
          {
            label: "申請人の資格",
            answer: ["所有権登記名義人", "所有権の登記名義人"],
            hint: "法39条1項",
          },
          {
            label: "添付情報（図面）",
            answer: "地積測量図",
            hint: "分筆に必須（規則77条）",
          },
          {
            label: "登録免許税",
            answer: wgYenAccepts(tax),
            hint: "分筆後の筆数×1,000円（更正の登記は非課税）",
            pts: 2,
          },
        ]),
        // 公差の判定そのものを検証対象にする（test_written_gen.mjs が独立計算で照合）
        verify: Object.assign({}, b.verify, {
          tokiChiseki: tokiChiseki,
          seiChiseki: b.total,
          kousei: needsKousei,
          kosa: {
            chiiki: chiiki.name,
            seido: chiiki.seido,
            value: kosa,
            sa: sa,
          },
        }),
        figure: b.figure,
        figureChecks: b.figureChecks,
      };
    },
  },
];
