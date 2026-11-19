// 本試験（午後の部）記述式の「型」。過去問の骨格を再現し、数値・形・当事者を乱数で変える。
//
// 仕様書: docs/chousashi/exam_types/*.md（型ごと）。出典: 法務省 土地家屋調査士試験問題。
// 本試験の文は写さない。人名・地名・地番・日付・数値はすべて自作し、事案の骨格だけを再現する。
// 法務省は記述式の解答例を公表していないので、正答は出題の式から求めた値であり、
// 出題者の解答ではない。検査は scripts/study/test_exam_types.mjs（独立再計算・不変条件）で行う。
//
// 各型は written.js の WRITTEN と同じ形（id/type/title/target/build(rng)）で追加するので、
// 画面・採点・履歴・シード再現・フル模試はそのまま使える。

// ─────────── 部品 ───────────
const EX_REIWA_OFFSET = 2018; // 令和N年 = 西暦(N+2018)年

function exRound(v) {
  return Math.round(v * 100) / 100;
}

// min〜max の一様乱数を 0.01 刻みで返す
function exU(rng, min, max) {
  return exRound(min + rng() * (max - min));
}

// 北を基準に時計回りの方位角（ラジアン）。X=北、Y=東。
function exBearing(p, q) {
  const a = Math.atan2(q[1] - p[1], q[0] - p[0]);
  return a < 0 ? a + 2 * Math.PI : a;
}

function exDist(p, q) {
  return Math.hypot(q[0] - p[0], q[1] - p[1]);
}

// 秒単位の角度 → 「325°06′51″」
function exDmsText(totalSec) {
  const d = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${d}°${String(m).padStart(2, "0")}′${String(s).padStart(2, "0")}″`;
}

// 令和の日付に日数を足す
function exAddDays(date, days) {
  const t = new Date(
    Date.UTC(date.y + EX_REIWA_OFFSET, date.m - 1, date.d + days),
  );
  const y = t.getUTCFullYear() - EX_REIWA_OFFSET;
  const m = t.getUTCMonth() + 1;
  const d = t.getUTCDate();
  return { y: y, m: m, d: d, text: `令和${y}年${m}月${d}日` };
}

function exNum(v, dg) {
  return v.toFixed(dg === undefined ? 2 : dg);
}

// 表（HTML）。head は見出しの配列、rows は行（セルの配列）の配列。
function exTable(head, rows) {
  return (
    `<table class="simple" style="font-size:12.5px"><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr>` +
    rows
      .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
      .join("") +
    `</table>`
  );
}

const EX_TOWNS = ["N町", "T町", "D町", "R町", "U町", "M町", "H町", "K町"];
const EX_CITIES = ["A市", "K市", "Q市", "S市", "M市", "P市"];
const EX_CHOME = ["一丁目", "二丁目", "三丁目", "四丁目"];

// ─────────── 令和7年度 第21問（土地）の型 ───────────
// 事案: 相続した2筆（甲=畑・乙=宅地）。乙を面積が等しくなるよう分筆し、のちに甲の一部と
// 分筆後の北側（丙）の一部を交換する。座標の算出→公差と地積更正の要否→地積測量図→
// 交換範囲の座標→丙土地の申請書、の順に問う。
function exBuildR7Land(rng) {
  // 1. 形状 ------------------------------------------------------------
  const xs = exU(rng, 150, 250);
  const ya = exU(rng, 80, 110);
  const lns = exU(rng, 30, 38);
  const wN = exU(rng, 17, 20);
  const A = [xs, ya];
  const B = [exRound(xs + lns), ya];
  const C = [B[0], exRound(ya + wN)];
  const E = [xs, exRound(ya + wN - exU(rng, 2, 4.5))];
  const F = [xs, exRound(E[1] + exU(rng, 14.5, 17.5))];
  const yg = exRound(F[1] + exU(rng, 1.5, 3));
  const G = [exRound(xs + exU(rng, 8, 12)), yg];
  const H = [exRound(B[0] - exU(rng, 2, 4)), yg];

  // 筆界の曲がり点D。観測値（基準点T2から後視T1・観測角・距離）から求めさせるので、
  // 先に真のD0を置き、観測値を丸めてから、丸めた観測値で再計算したものを正解にする。
  const xd = exRound(xs + lns * exU(rng, 0.4, 0.65));
  const tt = (xd - E[0]) / (C[0] - E[0]);
  const yLine = E[1] + tt * (C[1] - E[1]);
  const D0 = [xd, yLine + exU(rng, 1.3, 2.6) * (rng() < 0.5 ? -1 : 1)];
  const T2 = [exRound(xs + exU(rng, 2, 5)), exRound(ya - exU(rng, 6, 9))];
  const T1 = [exRound(xs + exU(rng, 0.5, 2)), exRound(F[1] + exU(rng, 3, 6))];
  const b1 = exBearing(T2, T1);
  const b2 = exBearing(T2, D0);
  const alphaSec = Math.round(
    (((b2 - b1 + 2 * Math.PI) % (2 * Math.PI)) * 180 * 3600) / Math.PI,
  );
  const dObs = exRound(exDist(T2, D0));
  const bD = b1 + (alphaSec / 3600) * (Math.PI / 180);
  const D = [
    exRound(T2[0] + dObs * Math.cos(bD)),
    exRound(T2[1] + dObs * Math.sin(bD)),
  ];
  // 曲がりが甲側（西）に向いていること（のちの交換範囲の作図が成り立つ条件）
  if (!(D[1] < C[1] - 0.8) || !(D[0] > E[0] + 6) || !(D[0] < C[0] - 7))
    return null;

  // 2. 乙土地の等分割（Kは辺HG上）---------------------------------------
  const polyOtsu = [C, H, G, F, E, D];
  const fOtsu = wgArea(polyOtsu);
  const aN = (xk) => wgArea([D, C, H, [xk, yg]]);
  const a0 = aN(G[0]);
  const a1 = aN(H[0]);
  const half = fOtsu / 2;
  if (!(a0 > half && a1 < half)) return null;
  const kx = H[0] + (G[0] - H[0]) * ((half - a1) / (a0 - a1));
  const K = [exRound(kx), yg];
  const aEach = wgChiseki(half, "宅地"); // 宅地は0.01㎡未満切捨て（規則100条）
  const sumAfter = exRound(aEach * 2);

  // 3. 地域区分 → 精度区分 → 公差、登記記録の地積と更正の要否 ------------
  const chiiki = wgPick(rng, WG_CHIIKI);
  const needKousei = rng() < 0.5;
  let recorded = sumAfter;
  for (let i = 0; i < 3; i++) {
    const k = wgKosaShown(recorded, chiiki.seido);
    const gap = needKousei ? k * exU(rng, 1.4, 2.6) : k * exU(rng, 0.15, 0.7);
    recorded = exRound(sumAfter + (rng() < 0.5 ? -gap : gap));
  }
  const kosa = wgKosaShown(recorded, chiiki.seido);
  const diff = exRound(Math.abs(recorded - sumAfter));
  const exceeds = diff > kosa;
  // 公差のぎりぎりでは判定が割れるので、余裕のないものは棄却する
  if (needKousei ? diff < kosa * 1.1 : diff > kosa * 0.9) return null;
  if (exceeds !== needKousei) return null;

  // 4. 交換する範囲（J・L）-----------------------------------------------
  const biLen = exU(rng, 3, 5); // Bから西辺ABに沿ってIまでの距離
  const I = [exRound(B[0] - biLen), ya];
  const tJ = (C[0] - I[0]) / (C[0] - D[0]);
  if (!(tJ > 0.05 && tJ < 0.95)) return null;
  const J = [I[0], exRound(C[1] + tJ * (D[1] - C[1]))];
  const sSwap = wgArea([B, C, J, I]); // 甲から丙へ渡す範囲の面積
  // 直線CDと辺HGの延長線の交点W（北側で交わるとき）。MLをDKに平行に引いて面積を合わせる。
  const sW = (yg - C[1]) / (D[1] - C[1]);
  if (!(sW < 0)) return null;
  const W = [C[0] + sW * (D[0] - C[0]), yg];
  const t0 = wgArea([W, D, [kx, yg]]);
  if (!(sSwap < t0 * 0.9)) return null;
  const lam = Math.sqrt(1 - sSwap / t0);
  const M = [W[0] + lam * (D[0] - W[0]), W[1] + lam * (D[1] - W[1])];
  const L = [W[0] + lam * (kx - W[0]), yg];
  if (!(M[0] < C[0] - 0.6 && L[0] > kx + 0.4 && L[0] < H[0] - 0.4)) return null;
  const Jr = J;
  const Lr = [exRound(L[0]), exRound(L[1])];
  const Mr = [exRound(M[0]), exRound(M[1])];
  // 丙土地（乙の北側）から切り取る範囲の地積（宅地は0.01㎡未満切捨て）
  const aStrip = wgChiseki(wgArea([Mr, Lr, K, D]), "宅地");
  const aHeiRest = exRound(aEach - aStrip);

  // 5. 当事者・場所・日付 ------------------------------------------------
  const sur = wgPick(rng, WG_SURNAME);
  const givenM = WG_GIVEN_M.slice();
  const g1 = wgPick(rng, givenM);
  givenM.splice(givenM.indexOf(g1), 1);
  const g2 = wgPick(rng, givenM);
  givenM.splice(givenM.indexOf(g2), 1);
  const g0 = wgPick(rng, givenM);
  const deceased = sur + g0;
  const wife = sur + wgPick(rng, WG_GIVEN_F);
  const son1 = sur + g1;
  const son2 = sur + g2;
  const shiho = wgPerson(rng);
  const city = wgPick(rng, EX_CITIES);
  const towns = EX_TOWNS.slice();
  const t1 = wgPick(rng, towns);
  towns.splice(towns.indexOf(t1), 1);
  const t2 = wgPick(rng, towns);
  towns.splice(towns.indexOf(t2), 1);
  const t3 = wgPick(rng, towns);
  const shozaiKou = city + t1 + wgPick(rng, EX_CHOME);
  const shozaiOtsu = city + t2 + wgPick(rng, EX_CHOME);
  const chiKou = wgInt(rng, 120, 480);
  const chiOtsu = wgInt(rng, 5, 60);
  const nameKou = chiKou + "番";
  const nameOtsu = chiOtsu + "番";
  const nameHei = chiOtsu + "番1"; // 乙の北側（丙）
  const nameTei = chiOtsu + "番2"; // 乙の南側（丁）
  const nameNew = chiOtsu + "番3"; // 丙から切り取る範囲に付く地番
  const dDeath = wgDate(rng);
  const dBun = exAddDays(dDeath, wgInt(rng, 95, 130)); // 遺産分割協議書の日
  const dApp1 = exAddDays(dBun, wgInt(rng, 3, 9)); // 乙の分筆等の申請
  const dReg = exAddDays(dApp1, wgInt(rng, 14, 20)); // 所有権登記の申請
  const dMove = exAddDays(dReg, wgInt(rng, 28, 40)); // 長男の住所異動
  const dApp2 = exAddDays(dMove, wgInt(rng, 24, 34)); // 丙の分筆の申請
  const dMarkK = exAddDays(dBun, wgInt(rng, 1, 2));
  const dMarkML = exAddDays(dApp2, -wgInt(rng, 7, 12));
  const addr1 = `${shozaiOtsu}${chiOtsu}番1号`; // 長男が移る住所（丙土地）
  const addr2 = `${shozaiOtsu}${chiOtsu}番2号`; // 二男の住所（丁土地）
  const oldAddr = `${city}${t3}${wgPick(rng, EX_CHOME)}${wgInt(rng, 1, 9)}番${wgInt(rng, 1, 9)}号`;
  const neighbor = (n) => n + wgInt(rng, 1, 3);

  // 6. 申請書の答え（丙土地の分筆）-------------------------------------------
  const tax = wgBunpitsuTax(2);
  const dgs = 2;

  const toRow = (name, p) => [name, exNum(p[0], dgs), exNum(p[1], dgs)];
  const given = [
    ["A", A],
    ["B", B],
    ["C", C],
    ["E", E],
    ["F", F],
    ["G", G],
    ["H", H],
  ].map(([n, p]) => toRow(n, p));
  given.splice(3, 0, ["D", "省略", "省略"]);

  // 7. 問題文 ------------------------------------------------------------
  const gapWord = exceeds ? "超えています" : "超えていません";
  const reasonWord = exceeds ? "錯誤" : "不要";
  const needWord = exceeds ? "必要があります" : "必要がありません";
  const kosaTable = ["甲一", "甲二", "甲三", "乙一", "乙二", "乙三"];
  const html =
    `<p><b>【出題の趣旨】</b>土地家屋調査士${shiho}は、〔調査図素図〕に示す${shozaiKou}${nameKou}の土地（以下「甲土地」という。）` +
    `及び${shozaiOtsu}${nameOtsu}の土地（以下「乙土地」といい、甲土地と併せて「本件各土地」という。）について、` +
    `関係当事者から表示に関する登記の相談を受け、【聴取結果の概要】のとおり事情を聴取し、` +
    `必要となる表示に関する登記の申請手続の代理並びに当該登記に必要な調査及び測量の依頼を受けた。` +
    `【調査及び測量の結果の概要】のとおり調査及び測量を行ったうえ、必要となる登記の申請をした。` +
    `以上に基づき、次の本試験の問1から問5までに相当する各問に答えなさい。（問題図は下に表示される。）</p>` +
    `<p><b>【問1】</b>【聴取結果の概要】及び【調査及び測量の結果の概要】から、図上の<b>Ｄ点及びＫ点の座標値</b>を求めなさい。</p>` +
    `<p><b>【問2】</b>${shiho}は、関係当事者から、「遺産分割協議書の内容に沿って乙土地を2つの土地に分けたいが、` +
    `乙土地の登記記録上の地積は実測値と異なるようだ。どのような登記の申請手続が必要か。」との質問を受けた。` +
    `次の文は、この質問に対する説明である。（ア）から（カ）までに入る数値又は文言を答えなさい。` +
    `ただし、（ア）には、座標法により求積した結果に基づき、分筆後の各土地の地積として表示すべき数値を記載する。` +
    `（ウ）には「超えています」又は「超えていません」、（カ）には「必要があります」又は「必要がありません」のいずれかが入る。` +
    `また、（オ）の登記を申請する必要がないと判断したときは、（エ）には「不要」と記載する。</p>` +
    `<blockquote class="small" style="margin:6px 0 10px 8px;padding-left:10px;border-left:3px solid var(--border)">` +
    `乙土地を2つの土地に分けるためには、分筆の登記をする必要があります。ところで、乙土地の登記記録上の地積は${exNum(recorded)}㎡と` +
    `記録されていますが、【調査及び測量の結果の概要】によれば、分筆後の各土地の地積はそれぞれ（ア）㎡であることが分かりました。` +
    `乙土地に適用される精度区分による地積測定の公差は（イ）㎡までですので、分筆前の登記記録上の地積と分筆後の地積の差は、` +
    `この公差の範囲を（ウ）。そのため、乙土地の分筆の登記を申請する場合には、登記原因を（エ）とする（オ）の登記を申請する（カ）。</blockquote>` +
    `<p><b>【問3】</b>地積測量図（${dApp1.text}に申請する乙土地の分筆の登記に添付するもの）を、縮尺250分の1で作図しなさい。（紙で作図し、採点後にチェック項目で確認する。）</p>` +
    `<p><b>【問4】</b>【聴取結果の概要】及び【調査及び測量の結果の概要】から、図上の<b>Ｊ点及びＬ点の座標値</b>を求めなさい。</p>` +
    `<p><b>【問5】</b>${dApp2.text}に申請した丙土地（${shozaiOtsu}${nameHei}の土地）に関する登記の申請書を完成させなさい。</p>` +
    `<p class="small" style="margin-top:10px">（注）</p>` +
    [
      "本問における行為は全て適法に行われており、法律上必要な書類は全て適法に作成されているものとする。",
      "登記の申請は、書面申請の方法によってするものとする。",
      "座標値は、計算結果の小数第3位を四捨五入し、小数第2位までとすること。",
      "地積測量図は、250分の1の縮尺により作成すること。距離は計算結果の小数第3位を四捨五入し、小数第2位までとすること。",
      "地積測量図には、各筆界点の座標値、平面直角座標系の番号又は記号、地積及びその求積方法並びに測量年月日は、記載することを要しない。",
      "使用可能な基準点は、地積測量図にその地点を明示して点名を付して記載すること（座標値は不要）。",
      "分筆により新しい地番が生じる場合は、北側から順に地番を付すこと。",
    ]
      .map((t, i) => `<p class="small">${i + 1}　${t}</p>`)
      .join("") +
    // ── 聴取結果
    `<p style="margin-top:14px"><b>【聴取結果の概要】</b></p>` +
    [
      `本件各土地の所有者である${deceased}は、${dDeath.text}に死亡した。`,
      `${deceased}の最後の住所地は、${shozaiOtsu}${chiOtsu}番1号である。`,
      `${deceased}の長男である${son1}は、${deceased}の法定相続情報一覧図保管の申出を行い、別紙1のとおりの一覧図の写しが交付された。`,
      `${deceased}の法定相続人らは、遺産分割協議を行い、別紙2のとおり、遺産分割協議書（以下「本件協議書」という。）を作成した。`,
      `${shiho}は、${dApp1.text}、乙土地について、本件協議書に基づく分割をするために必要となる表示に関する登記を申請し、その後当該登記が完了した。`,
      `${wife}、${son1}及び${son2}は、${dReg.text}、それぞれ、本件協議書に基づいて取得した各土地について、所有権に関する登記の申請を行い、当該登記が完了した。`,
      `${son1}は、${nameHei}の土地（以下「丙土地」という。）を取得した後、丙土地上の建物を取り壊して新たな建物を建築しようと考えた。` +
        `建築会社との協議の中で、丙土地が道路に面しない土地であることが将来支障をきたすおそれがあると説明を受けたため、` +
        `道路に面した土地とする方法について${wife}及び${son2}と話合いを行った。`,
      `甲土地は畑として利用されており、丙土地は${wife}の自宅の敷地、${nameTei}の土地（以下「丁土地」という。）は${son2}の自宅の敷地として利用されている。`,
      `${wife}の供述により、丙土地上の建物の上下水道管が甲土地の北側のブロック塀に沿って、甲土地を通り西側道路の各種管へ接続していることが判明した。`,
      `そこで${wife}と${son1}は、上下水道管の位置を考慮し、甲土地の北側の一部と丙土地の南側の一部を交換することとし、必要となる登記を行うことに合意した。` +
        `交換の対象となる土地の範囲は、次のとおり定められた。` +
        `<br>⑴　${wife}が${son1}に譲渡する範囲は、甲土地のうちＢ、Ｃ、Ｊ、Ｉ及びＢの各点を順次直線で結んだ範囲とする。ただし、Ｉ点はＢ点とＡ点を結ぶ直線上の点で、Ｂ点とＩ点の距離は${exNum(biLen)}ｍである。` +
        `また、Ｊ点は甲土地と丙土地の筆界線上の点で、Ｉ点とＪ点を結ぶ直線はＢ点とＣ点を結ぶ直線と平行である。` +
        `<br>⑵　${son1}が${wife}に譲渡する範囲は、丙土地のうちＭ、Ｌ、Ｋ、Ｄ及びＭの各点を順次直線で結んだ範囲とする。ただし、Ｍ点は甲土地と丙土地の筆界線上の点で、` +
        `Ｌ点はＨ点とＫ点を結ぶ直線上の点である。また、Ｍ点とＬ点を結ぶ直線はＤ点とＫ点を結ぶ直線と平行である。` +
        `<br>⑶　⑴の範囲の面積と⑵の範囲の面積は、等しくなるようにする。`,
      `${son1}は、${dMove.text}に${addr1}へ住所を異動したため、所有権登記名義人住所変更登記の申請を行い、当該登記が完了した。`,
      `${shiho}は、${dApp2.text}、丙土地の一部を交換するために必要となる丙土地についての表示に関する登記を申請した。`,
    ]
      .map((t, i) => `<p>${i + 1}　${t}</p>`)
      .join("") +
    // ── 別紙1
    `<p style="margin-top:12px"><b>別紙1　${deceased}の法定相続情報一覧図の写し（抜粋）</b></p>` +
    exTable(
      ["続柄", "氏名", "住所", "備考"],
      [
        [
          "被相続人",
          deceased,
          `${shozaiOtsu}${chiOtsu}番1号（最後の住所）`,
          `死亡 ${dDeath.text}`,
        ],
        ["配偶者", wife, "（略）", ""],
        ["長男（申出人）", son1, oldAddr, ""],
        ["二男", son2, addr2, ""],
      ],
    ) +
    // ── 別紙2
    `<p style="margin-top:12px"><b>別紙2　遺産分割協議書</b></p>` +
    `<p class="small">${dDeath.text}${deceased}の死亡により開始した相続に関し、相続人全員において次のとおり遺産分割の協議をした。<br>` +
    `1．相続人${wife}は次の遺産を取得する。<br>　所在 ${shozaiKou}／地番 ${nameKou}／地目 畑／地積 ${exNum(fKou(A, B, C, D, E), 0)}㎡<br>` +
    `2．相続人${son1}及び相続人${son2}は次のとおり遺産を取得する。<br>　所在 ${shozaiOtsu}／地番 ${nameOtsu}／地目 宅地／地積 ${exNum(recorded)}㎡<br>` +
    `　上記土地を図のＤ点とＫ点を結ぶ直線で分割し、その北側の範囲の土地を${son1}が、その南側の範囲の土地を${son2}が取得する。` +
    `ただし、Ｋ点はＨ点とＧ点を結ぶ直線上の点であり、${son1}が取得する土地の面積と${son2}が取得する土地の面積が等しくなるように分割する。` +
    `（北側部分は予定地番 ${nameHei}、南側部分は予定地番 ${nameTei}）<br>${dBun.text}　（当欄には、関係当事者全員の住所及び氏名が記され、押印がされているものとする。）</p>` +
    // ── 調査及び測量の結果
    `<p style="margin-top:12px"><b>【調査及び測量の結果の概要】</b></p>` +
    `<p>1　資料に関する調査の結果</p>` +
    `<p class="small">⑴　登記記録の抜粋（${dDeath.text}時点）</p>` +
    exTable(
      ["", "所在", "地番", "地目", "地積", "甲区（所有者）", "乙区"],
      [
        [
          "甲土地",
          shozaiKou,
          nameKou,
          "畑",
          `${exNum(fKou(A, B, C, D, E), 0)}㎡`,
          `${shozaiOtsu}${chiOtsu}番1号 ${deceased}`,
          "（登記事項なし）",
        ],
        [
          "乙土地",
          shozaiOtsu,
          nameOtsu,
          "宅地",
          `${exNum(recorded)}㎡`,
          `${shozaiOtsu}${chiOtsu}番1号 ${deceased}`,
          "（登記事項なし）",
        ],
      ],
    ) +
    `<p class="small" style="margin-top:6px">⑵　地図等に関する調査結果　${shozaiKou.replace(/[一二三四]丁目/, "")}には不動産登記法第14条第1項の地図が備え付けられており、` +
    `乙土地の存する${shozaiOtsu.replace(/[一二三四]丁目/, "")}には同項の地図は備え付けられていないが、地図に準ずる図面が備え付けられている。` +
    `${shiho}は、両町の図面を合成して筆界線の形状を照合した（合成図は省略）。本件各土地の地域は、不動産登記規則第10条第4項の<b>${chiiki.name}</b>に属する。</p>` +
    `<p class="small">⑶　隣接地に係る図面等の調査結果　本件各土地の隣接地のうち、${shozaiOtsu}${neighbor(chiOtsu - 1)}番、同${neighbor(chiOtsu + 1)}番及び同${neighbor(chiOtsu + 3)}番の各土地については地積測量図が備え付けられている。その他の土地については備え付けられていない。</p>` +
    `<p class="small">⑷　市道路管理課における道路境界の調査の結果　本件各土地については道路境界の確認がされており、道路境界確認図が備え付けられている。</p>` +
    `<p class="small">⑸　乙土地の地積測定の公差（登記記録上の地積 ${exNum(recorded)}㎡ に対する値）</p>` +
    exTable(["精度区分"].concat(kosaTable), [
      [`${exNum(recorded)}㎡`].concat(
        kosaTable.map((s) => `${exNum(wgKosaShown(recorded, s))}㎡`),
      ),
    ]) +
    `<p style="margin-top:8px">2　本件土地の利用状況等</p>` +
    `<p class="small">⑴　利用状況は【聴取結果の概要】のとおり。<br>` +
    `⑵　境界標の状況　Ａ点、Ｂ点、Ｃ点、Ｅ点、Ｆ点及びＨ点にはコンクリート杭が、Ｇ点には金属標が設置されている。全ての境界標に永続性がある。<br>` +
    `⑶　立会い等　ア　道路管理課職員との現地立会いの結果、道路の境界点がＡ点、Ｂ点、Ｆ点及びＧ点であることが確認され、現地の境界標と道路境界確認図の成果は整合している。<br>` +
    `　イ　本件各土地と接する各筆界について、${wife}、${son1}及び${son2}と隣接地の所有権の登記名義人が現地で立会確認した。現地の境界標と登記所備付けの地積測量図の成果は整合している。<br>` +
    `　ウ　${wife}は当初、甲土地と乙土地の筆界がＣ点とＥ点を結ぶ直線であると説明したが、${son2}は、${deceased}から、自宅と畑を分断している生垣の間にコンクリート杭があると聞いていたと説明した。` +
    `探索したところＤ点にコンクリート杭が発見され、実測図と合成図の曲がり点が合致したため、Ｄ点が甲土地と乙土地の筆界点であることを、${wife}、${son1}及び${son2}と立会いのうえ確認した。<br>` +
    `　エ　${dMarkK.text}、${shiho}は、分割点であるＫ点に永続性のある金属標を設置した。<br>` +
    `　オ　${dMarkML.text}、${shiho}は、分割点であるＭ点に永続性のあるコンクリート杭を、Ｌ点に永続性のある金属標を設置した。<br>` +
    `⑷　測量の結果　市基準点であるＴ1点及びＴ2点並びに関連する基準点の点検測量を行い、許容誤差内であることを確認した。次の成果表の値により測量を行い、観測値及び筆界点等の座標値を得た。</p>` +
    `<p class="small">ア　〔市基準点成果表〕</p>` +
    exTable(
      ["点名", "Ｘ座標（ｍ）", "Ｙ座標（ｍ）"],
      [
        ["Ｔ1", exNum(T1[0]), exNum(T1[1])],
        ["Ｔ2", exNum(T2[0]), exNum(T2[1])],
      ],
    ) +
    `<p class="small" style="margin-top:6px">イ　〔測量によって得られた観測値〕</p>` +
    exTable(
      ["器械点", "後視点", "測点", "観測角", "水平距離"],
      [
        ["Ｔ2", "Ｔ1", "Ｔ1", "0°00′00″", "─"],
        ["Ｔ2", "Ｔ1", "Ｄ", exDmsText(alphaSec), `${exNum(dObs)}ｍ`],
      ],
    ) +
    `<p class="small">（注）観測角は時計回りの角度を示す。北はＸ軸の正方向に一致する。</p>` +
    `<p class="small">ウ　〔測量によって得られた座標値〕（Ｄ点は省略）</p>` +
    exTable(["点名", "Ｘ座標（ｍ）", "Ｙ座標（ｍ）"], given);

  // 面積の表示用（甲土地の登記記録の地積。畑は1㎡未満切捨て）
  function fKou(a, b, c, d, e) {
    return Math.floor(wgArea([a, b, c, d, e]));
  }

  // 8. 設問の答え ------------------------------------------------------------
  // Kは小数第2位に丸めて使うので、面積はKのX誤差(±0.005m)×(yg−Dのy)だけ動く。その分を許容する。
  const tolArea = exRound(0.006 * (yg - D[1]) + 0.02);
  const tasks = [
    {
      label: "問1",
      q: `Ｄ点のＸ座標（Ｔ2から後視Ｔ1の方向角に観測角を加えて求める）`,
      unit: "m",
      answer: D[0],
      tol: 0.011,
      pts: 3,
      expl: `Ｔ2→Ｔ1の方向角＝atan2(ΔY,ΔX)。これに観測角${exDmsText(alphaSec)}を加えた方向角と距離${exNum(dObs)}mから、X=Ｔ2のX＋距離×cos(方向角)＝<b>${exNum(D[0])}</b>。`,
    },
    {
      label: "問1",
      q: `Ｄ点のＹ座標`,
      unit: "m",
      answer: D[1],
      tol: 0.011,
      pts: 3,
      expl: `Y=Ｔ2のY＋距離×sin(方向角)＝<b>${exNum(D[1])}</b>。`,
    },
    {
      label: "問1",
      q: `Ｋ点のＸ座標（直線ＤＫで乙土地の面積を二等分する。Ｋは辺ＨＧ上）`,
      unit: "m",
      answer: K[0],
      tol: 0.011,
      pts: 4,
      expl:
        `Ｋ点はＨ・Ｇと同じＹ座標（${exNum(yg)}）の直線上。北側の四角形Ｄ-Ｃ-Ｈ-Ｋの面積が乙土地全体の半分（${exNum(fOtsu / 2, 3)}㎡）になるＸを、面積がＫのＸの1次式であることを使って解く。` +
        `答え：<b>${exNum(K[0])}</b>。`,
    },
    {
      label: "問1",
      q: `Ｋ点のＹ座標`,
      unit: "m",
      answer: K[1],
      tol: 0.011,
      pts: 1,
      expl: `ＫはＨＧ上の点なので、Ｙ座標はＨ・Ｇと同じ<b>${exNum(K[1])}</b>。`,
    },
    {
      label: "問2（ア）",
      q: `分筆後の各土地の地積（㎡）`,
      unit: "㎡",
      answer: aEach,
      tol: tolArea,
      pts: 3,
      expl:
        `乙土地を座標法で求積した面積の半分。宅地なので0.01㎡未満を切り捨てる（規則100条）。答え：<b>${exNum(aEach)}㎡</b>。` +
        `（Ｋの座標を四捨五入してから求積するかで末位が動くため、±${exNum(tolArea)}㎡まで正解としている。）`,
    },
    {
      label: "問2（イ）",
      q: `公差（㎡）。この地域は<b>${chiiki.name}</b>であることから、乙土地に適用される精度区分の値を表から選ぶ`,
      unit: "㎡",
      answer: kosa,
      tol: 0.005,
      pts: 3,
      expl: `${chiiki.ref}により、${chiiki.name}で使える精度区分は<b>${chiiki.seido}</b>まで。表の${chiiki.seido}の値<b>${exNum(kosa)}㎡</b>。`,
    },
    {
      label: "問4",
      q: `Ｊ点のＸ座標（Ｉ点とＪ点を結ぶ直線はＢ点とＣ点を結ぶ直線と平行）`,
      unit: "m",
      answer: Jr[0],
      tol: 0.011,
      pts: 3,
      expl: `ＩはＢから西辺ＡＢに沿って${exNum(biLen)}mの点。ＩＪはＢＣと平行なのでＪのXはＩのXと同じ（${exNum(B[0])}−${exNum(biLen)}）＝<b>${exNum(Jr[0])}</b>。`,
    },
    {
      label: "問4",
      q: `Ｊ点のＹ座標（Ｊは甲土地と丙土地の筆界線ＣＤ上の点）`,
      unit: "m",
      answer: Jr[1],
      tol: 0.011,
      pts: 3,
      expl: `ＪはＣとＤを結ぶ直線上で、Ｘ座標が${exNum(Jr[0])}の点。内分比 (${exNum(C[0])}−${exNum(Jr[0])})/(${exNum(C[0])}−${exNum(D[0])}) から、Y＝<b>${exNum(Jr[1])}</b>。`,
    },
    {
      label: "問4",
      q: `Ｌ点のＸ座標（ＭＬはＤＫと平行。⑴の範囲と⑵の範囲の面積が等しい）`,
      unit: "m",
      answer: Lr[0],
      tol: 0.015,
      pts: 4,
      expl:
        `⑴の範囲の面積は台形ＢＣＪＩ＝${exNum(sSwap, 3)}㎡。直線ＣＤの延長と辺ＨＧの延長が交わる点Ｗを取ると、ＭＬがＤＫと平行なのでＷ-Ｍ-ＬとＷ-Ｄ-Ｋは相似。` +
        `⑵の範囲＝三角形ＷＤＫ−三角形ＷＭＬ ＝ ${exNum(sSwap, 3)}㎡ から相似比を求め、Ｌの座標を出す。答え：<b>${exNum(Lr[0])}</b>。`,
    },
    {
      label: "問4",
      q: `Ｌ点のＹ座標`,
      unit: "m",
      answer: Lr[1],
      tol: 0.011,
      pts: 1,
      expl: `ＬはＨＫ上の点なので、Ｙ座標はＨ・Ｋと同じ<b>${exNum(Lr[1])}</b>。`,
    },
  ];

  // 申請書（丙土地の分筆）。問2のウ〜カは申請書の外で問われる説明文の空欄。
  const appForm = [
    {
      label: "登記の目的",
      answer: ["土地分筆登記", "分筆登記"],
      hint: "不動産種別から書く",
      pts: 2,
    },
    {
      label: "登記原因及びその日付",
      answer: ["記載しない", "記載を要しない", "なし"],
      hint: "分筆の登記に登記原因はない",
      pts: 2,
    },
    {
      label: "申請人",
      answer: [son1, addr1 + son1],
      hint: "所有権登記名義人（住所は異動後）",
      pts: 2,
    },
    {
      label: "添付情報（①）",
      answer: ["地積測量図"],
      hint: "ほかに代理権限証明情報",
      pts: 2,
    },
    {
      label: "登録免許税",
      answer: wgYenAccepts(tax),
      hint: "分筆後の筆数×1,000円",
      pts: 2,
    },
    ..._wTochiSheet(shozaiOtsu, [
      { chiban: nameHei, chimoku: "宅地", chiseki: aHeiRest },
      { chiban: nameNew, chimoku: "宅地", chiseki: aStrip },
    ]),
    {
      label: "（ウ）分筆前の地積と分筆後の地積の差は公差の範囲を",
      answer: [gapWord],
      hint: "「超えています」「超えていません」",
      pts: 2,
    },
    {
      label: "（エ）登記原因",
      answer: [reasonWord],
      hint: "不要のときは「不要」",
      pts: 2,
    },
    {
      label: "（オ）併せて申請する登記",
      answer: ["地積更正", "地積に関する更正", "地積の更正"],
      hint: "登記の種類",
      pts: 2,
    },
    {
      label: "（カ）登記の申請は",
      answer: [needWord],
      hint: "「必要があります」「必要がありません」",
      pts: 2,
    },
  ];

  const figure = {
    points: {
      A: A,
      B: B,
      C: C,
      D: D,
      E: E,
      F: F,
      G: G,
      H: H,
      K: K,
      I: I,
      J: Jr,
      L: Lr,
      M: Mr,
      T1: T1,
      T2: T2,
    },
    polys: [
      ["A", "B", "C", "D", "E"],
      ["C", "H", "G", "F", "E", "D"],
    ],
    lines: [
      ["D", "K"],
      ["I", "J"],
      ["M", "L"],
    ],
    revealPoints: ["D", "K", "J", "L", "M"],
    areaLabels: [
      {
        at: [(D[0] + C[0] + H[0] + K[0]) / 4, (D[1] + C[1] + H[1] + K[1]) / 4],
        text: `${nameHei} ${exNum(aEach)}㎡`,
      },
      {
        at: [(D[0] + K[0] + G[0] + F[0]) / 4, (D[1] + K[1] + G[1] + F[1]) / 4],
        text: `${nameTei} ${exNum(aEach)}㎡`,
      },
    ],
  };

  return {
    statement: html,
    coords: [],
    tasks: tasks,
    appForm: appForm,
    figure: figure,
    figureChecks: wgFigChecks("chisekiSokuryo", [
      `分割線ＤＫを記入し、Ｄ点・Ｋ点の符号を付した`,
      `分筆後の地番（北側から ${nameHei}・${nameTei}）を記入した`,
      `基準点Ｔ1・Ｔ2の点名を記入した（座標値は不要）`,
      `隣接地の地番を記入した`,
      `Ｄ点・Ｋ点の境界標の種類を記入した`,
    ]),
    articleFill: null,
    // 検証用の答え合わせ情報（scripts/study/test_exam_types.mjs が独立計算で突き合わせる）
    verify: {
      kind: "exam-r7-land",
      pts: {
        A: A,
        B: B,
        C: C,
        D: D,
        E: E,
        F: F,
        G: G,
        H: H,
        K: K,
        I: I,
        J: Jr,
        L: Lr,
        M: Mr,
        T1: T1,
        T2: T2,
      },
      obs: { alphaSec: alphaSec, dist: dObs },
      fOtsu: fOtsu,
      aEach: aEach,
      recorded: recorded,
      seido: chiiki.seido,
      kosa: kosa,
      exceeds: exceeds,
      sSwap: sSwap,
      aStrip: aStrip,
      aHeiRest: aHeiRest,
    },
  };
}

// ─────────── 令和7年度 第22問（建物）の型 ───────────
// 事案: 会社が所有する建物（主である建物＋附属建物2棟）の建替え・改築を2期に分けて行い、
// 工事の完了ごとに表題部の変更の登記を申請する。
//   第一期: 主である建物の取壊し／附属建物（符号2）の一部取壊しと用途変更 → 符号2が主である建物になる
//   第二期: 新築倉庫（附属建物）の新築／守衛所（符号4）の解体撤去と同じ材料での再築
// 設問: 申請書2通（第1欄・第2欄）、各階平面図の作図（紙）、変更登記の趣旨の穴埋め。
//
// 正答の根拠（確認できたものだけを正答にしている）:
//   不動産登記法51条1項（変更から1月以内）・164条（10万円以下の過料）／令別表十四の項（添付情報）
//   規則113条2項（用途が2以上なら2以上で種類を定める）・114条（構造）・115条（床面積）・83条（各階平面図）
//   準則82条(6)(7)(8)（階段室は算入・屋外階段は不算入・吹抜けは上階から除く）、83条（再築＝滅失＋新築）、
//   94条（附属建物の変更の記録）、102条（主たる建物の滅失→附属建物が主たる建物に変更）
// 登記原因の細かい文言のうち公式資料で確かめられないものは、採点しない欄（薄い入力欄）にしている。
function exFloor2(v) {
  return Math.floor(+(v * 100).toFixed(6)) / 100;
}

function exBuildR7Tatemono(rng) {
  // 1. 寸法 --------------------------------------------------------------
  // 従前の主である建物（2階建、各階同形）
  const dm = wgStep(rng, 9, 11, 0.5);
  const wm = wgStep(rng, 11, 14, 0.5);
  const a1m = exFloor2(dm * wm);
  // 符号2の附属建物（2階は各辺1m小さい）
  const d2 = wgStep(rng, 8, 10, 0.5);
  const w2 = wgStep(rng, 13, 16, 0.5);
  const b1 = exFloor2(d2 * w2);
  const b2 = exFloor2((d2 - 1) * (w2 - 1));
  // 第一期工事で取り壊す1階の一部
  const rd = wgStep(rng, 2, 3.5, 0.5);
  const rw = wgStep(rng, 3, 5, 0.5);
  const b1New = exFloor2(b1 - rd * rw);
  // 守衛所（平家）
  const cd = wgStep(rng, 2.5, 3.5, 0.5);
  const cw = wgStep(rng, 3.5, 5, 0.5);
  const cArea = exFloor2(cd * cw);
  // 新築倉庫: 長方形の本体＋南東の階段室（L字）。2階の吹抜けは1〜2か所。
  const W = wgStep(rng, 12, 16, 0.5); // 東西
  const D = wgStep(rng, 7.5, 10, 0.5); // 南北
  const w3 = wgStep(rng, 4, 6, 0.5);
  const d3 = wgStep(rng, 3, 5, 0.5);
  const holes = [];
  holes.push({ d: wgStep(rng, 2, 3.5, 0.5), w: wgStep(rng, 3, 5, 0.5), x0: 1, y0: 1 });
  if (rng() < 0.6) {
    const hd = wgStep(rng, 2, 3.5, 0.5);
    const hw = wgStep(rng, 3, 4, 0.5);
    holes.push({ d: hd, w: hw, x0: D - 1 - hd, y0: W - 1 - hw });
  }
  if (holes.some((h) => h.x0 + h.d > D - 0.5 || h.y0 + h.w > W - 0.5)) return null;
  const hasOutStair = rng() < 0.5; // 屋外階段は床面積に算入しない（準則82条7号）
  const out1 = exFloor2(W * D + w3 * d3);
  const holeSum = holes.reduce((a, h) => a + h.d * h.w, 0);
  const out2 = exFloor2(W * D + w3 * d3 - holeSum); // 階段室は各階に算入、吹抜けは上階から除く
  if (out2 <= 0) return null;

  // 2. 当事者・場所・日付 ----------------------------------------------------
  const city = wgPick(rng, EX_CITIES);
  const town = wgPick(rng, EX_TOWNS) + wgPick(rng, ["二丁目", "三丁目", "四丁目"]);
  const baseNo = wgInt(rng, 100, 480);
  const sub1 = wgInt(rng, 1, 5);
  const sub2 = sub1 + 1;
  const shozaiTown = city + town;
  const shozaiReg = `${shozaiTown}${baseNo}番地${sub1}、${baseNo}番地${sub2}`;
  const kaoku = `${baseNo}番${sub1}`;
  const corpName =
    "株式会社" + wgPick(rng, ["甲一", "乙川", "丙野", "南海", "北斗", "東和", "西光", "大和"]) + wgPick(rng, ["物流", "商事", "産業", "運輸"]);
  const rep = wgPerson(rng);
  const corpNo =
    String(wgInt(rng, 1000, 9999)) + String(wgInt(rng, 10, 99)) + String(wgInt(rng, 100000, 999999));
  const corpNoHyphen = `${corpNo.slice(0, 4)}-${corpNo.slice(4, 6)}-${corpNo.slice(6)}`;
  const hqAddr = `${city}${wgPick(rng, EX_TOWNS)}${wgPick(rng, EX_CHOME)}${wgInt(rng, 1, 9)}番${wgInt(rng, 1, 9)}号`;
  const shiho = wgPerson(rng);
  const phone = `0${wgInt(rng, 10, 99)}-${wgInt(rng, 100, 999)}-${wgInt(rng, 1000, 9999)}`;
  const d1a = wgDate(rng); // 主である建物の取壊し
  const d1b = exAddDays(d1a, wgInt(rng, 8, 14)); // 符号2の一部取壊し・用途変更
  const app1 = exAddDays(d1b, wgInt(rng, 4, 9));
  const dTaishin = exAddDays(app1, wgInt(rng, 170, 220));
  const dTear = exAddDays(dTaishin, wgInt(rng, 3, 10)); // 符号4の解体撤去
  const dNew = exAddDays(dTear, wgInt(rng, 8, 14)); // 新築倉庫の完了
  const dRe = exAddDays(dNew, wgInt(rng, 8, 14)); // 守衛所の再築の完了
  const app2 = exAddDays(dRe, wgInt(rng, 4, 9));
  const yearOld = wgInt(rng, 3, 12);
  const struct2 = "鉄骨造亜鉛メッキ鋼板ぶき2階建";
  const structNew = "鉄骨造亜鉛メッキ鋼板ぶき2階建";
  const structGuard = "軽量鉄骨造亜鉛メッキ鋼板ぶき平家建";
  const kindOld = "事務所・倉庫";

  // 3. 問題文 -------------------------------------------------------------
  const kinds = ["1年", "3月", "形成", "物理", "1月", "創設", "10万円以下の過料", "6月", "間接", "3月以内の遅延損害金納付", "報告", "3年", "50万円以下の罰金", "用途", "6月以下の懲役", "直接", "2週間"];
  const shuffled = kinds
    .map((k) => [rng(), k])
    .sort((a, b) => a[0] - b[0])
    .map((x) => x[1]);
  const floors = (x, y) => `1階 ${exNum(x)}㎡　2階 ${exNum(y)}㎡`;
  const dimRows = [
    ["1階の本体", "東西（柱の中心間）", exNum(W), "南北", exNum(D)],
    ["1階の階段室（南東）", "東西", exNum(w3), "南北", exNum(d3)],
  ].concat(
    holes.map((h, i) => [`2階の吹抜け${holes.length > 1 ? i + 1 : ""}`, "東西", exNum(h.w), "南北", exNum(h.d)]),
  );
  const html =
    `<p><b>【出題の趣旨】</b>${corpName}（代表取締役${rep}、会社法人等番号${corpNoHyphen}。以下「甲社」という。）は、${shozaiTown}${baseNo}番${sub1}の土地及び同${baseNo}番${sub2}の土地並びにこれらの土地上の建物（以下「本件建物」という。）を所有しており、` +
    `本件建物の建替えや改築等の工事（以下「本件工事」という。）を行った。土地家屋調査士${shiho}（連絡先電話番号${phone}）は、【事実関係】のとおり甲社から表示に関する登記の相談を受け、` +
    `【登記記録の内容】のとおり登記記録の調査を行い、現地の調査・測量を行ったうえで、法令に従い必要となる登記の申請をした。` +
    `ただし、登記の申請においては、申請人の会社法人等番号を申請書の申請人欄に記載するものとする。</p>` +
    `<p><b>【問1】</b>第一期工事の建物に関する登記の申請書（第1欄）を完成させなさい。</p>` +
    `<p><b>【問2】</b>第二期工事の建物に関する登記の申請書（第2欄）を完成させなさい。</p>` +
    `<p><b>【問3】</b>問2の申請書に添付する<b>各階平面図</b>を、250分の1の縮尺で作図しなさい（建物図面は不要。主である建物の記載は省略してよい）。` +
    `距離は小数第2位まで記載する。（紙で作図し、採点後にチェック項目で確認する。）</p>` +
    `<p><b>【問4】</b>${shiho}は、甲社から「第一期工事・第二期工事が完了した都度それぞれ登記を行うとのことですが、全て完了した後にまとめて行うことはできないのですか。」との質問を受けた。` +
    `次の説明の（ア）から（エ）までに入る文言を〔語句群〕から選びなさい。</p>` +
    `<blockquote class="small" style="margin:6px 0 10px 8px;padding-left:10px;border-left:3px solid var(--border)">` +
    `本件工事に伴って必要となる表示に関する登記は、既に登記がされている建物の登記事項に変更を生じた場合に、その（ア）的状態を登記記録に速やかに反映させるためのものです。` +
    `これは（イ）的登記ともいわれ、法令によれば、所有者等は、登記事項の変更があった日から（ウ）以内に申請する義務があります。` +
    `申請義務がある者が正当な理由がないにもかかわらずその申請を怠った場合には、（エ）に処せられます。そのため、第一期工事、第二期工事の完了の都度、登記申請を行う必要があります。</blockquote>` +
    `<p class="small"><b>〔語句群〕</b>${shuffled.join("　")}</p>` +
    `<p class="small" style="margin-top:10px">（注）</p>` +
    [
      "本問における行為は全て適法に行われており、法律上必要な書類は全て適法に作成されているものとする。",
      "登記の申請は、書面申請の方法によってするものとする。",
      "各階平面図は250分の1の縮尺により作成すること。",
      "各階平面図に記載する距離は、小数第2位までを記載すること。",
      "床面積は、各階ごとに壁その他の区画の中心線で囲まれた部分の面積により、0.01㎡未満を切り捨てる。",
    ]
      .map((t, i) => `<p class="small">${i + 1}　${t}</p>`)
      .join("") +
    // ── 事実関係
    `<p style="margin-top:14px"><b>【事実関係】</b></p>` +
    [
      `甲社は、${hqAddr}に本店を有しており、本件建物のうち主である建物を事務所・倉庫、符号2の附属建物を倉庫、符号4を守衛所として利用していた。`,
      `甲社は、建物の老朽化や事業拡大に対応するため、建替えや改築等をする計画を立て、建設会社に本件工事を依頼した。限られた敷地内で行う工事の内容や甲社の業務の都合により、本件工事は第一期工事と第二期工事の二期に分けて行うこととなった。` +
        `${shiho}は、着工前に、各期の工事が完了した段階で必要となる登記手続を甲社に説明し、確認した。`,
      `第一期工事の内容は次のとおりである。<br>⑴　主である建物の取壊しを${d1a.text}に完了した。<br>⑵　符号2の附属建物の<b>2階部分を倉庫から事務所へ</b>用途を変更する工事と、<b>1階部分の一部（${exNum(rd)}ｍ×${exNum(rw)}ｍの部分）の取壊し</b>を${d1b.text}に完了した。`,
      `${shiho}は、第一期工事後の現地の調査・測量を行い、工事の内容及び各建物の配置を確認した。また、主である建物が取り壊された後に残った建物の主従関係等について甲社と協議し、甲社の指示により、符号2の附属建物を主である建物とすることを確認した。`,
      `${shiho}は、${app1.text}、第一期工事の結果により必要となる表示に関する登記を申請した。`,
      `第二期工事の内容は次のとおりである。<br>⑴　主である建物の耐震補強工事を${dTaishin.text}に完了した（構造・床面積に影響しない）。` +
        `<br>⑵　新築倉庫の建築工事を${dNew.text}に完了した（概要は⑶〜⑸及び〔新築倉庫の寸法〕のとおり）。` +
        `<br>⑶　新築倉庫の主要構造は鉄骨造、屋根は合金メッキ鋼板ぶきの2階建で、床面から天井までの高さは1階・2階ともに3.80ｍである。` +
        `<br>⑷　新築倉庫の南東部分には階段室（壁と屋根で囲まれ、1階と2階を結ぶ）があり、2階の一部には1階まで続く吹抜け部分がある。` +
        (hasOutStair ? `<br>⑸　新築倉庫の外壁の外側に、鉄骨の屋外階段が取り付けられている。` : `<br>⑸　新築倉庫の外側に階段その他の付属設備はない。`) +
        `<br>⑹　第二期工事を進める都合により、符号4の附属建物を一時的に解体撤去する工事を${dTear.text}に完了し、その後、元の建物と同じ種類の建物を、元の位置に、元の大きさ、元の材料と同じ素材を利用して建築する工事を${dRe.text}に完了した。`,
      `${shiho}は、第二期工事後の現地の調査・測量を行い、工事の内容と各建物の配置を確認した。甲社と協議のうえ、主である建物はそのまま主である建物として維持し、新築倉庫及び守衛所はいずれも附属建物として登記すること、` +
        `<b>各附属建物に付する符号は、従前の附属建物の符号の最大の数に続けて、工事完了の順に付す</b>ことを確認した。`,
      `${shiho}は、${app2.text}、第二期工事の結果により必要となる表示に関する登記を申請した。`,
    ]
      .map((t, i) => `<p>${i + 1}　${t}</p>`)
      .join("") +
    // ── 登記記録
    `<p style="margin-top:12px"><b>【登記記録の内容】</b>（本件工事が行われる前の情報）</p>` +
    `<p class="small">土地：${shozaiTown}${baseNo}番${sub1}（宅地）、同${baseNo}番${sub2}（宅地）。甲区は甲社の所有、乙区は登記事項なし。</p>` +
    exTable(
      ["区分", "種類", "構造", "床面積", "原因及びその日付"],
      [
        ["主である建物（家屋番号" + kaoku + "）", kindOld, "鉄骨造スレートぶき2階建", `1階 ${exNum(a1m)}㎡　2階 ${exNum(a1m)}㎡`, `平成${yearOld}年新築`],
        ["附属建物 符号2", "倉庫", struct2, floors(b1, b2), `平成${yearOld + 8}年新築`],
        ["附属建物 符号4", "守衛所", structGuard, `${exNum(cArea)}㎡`, `平成${yearOld + 10}年新築`],
      ],
    ) +
    `<p class="small">所在：${shozaiReg}。所有者：${hqAddr}　${corpName}。（符号1及び符号3は既に取壊しの登記がされている。）</p>` +
    `<p style="margin-top:12px"><b>【調査・測量】</b></p>` +
    `<p class="small">〔新築倉庫の寸法〕（単位：ｍ。数値は柱及び壁の中心間の距離。建物の隅部は全て直角。）</p>` +
    exTable(["部分", "方向", "長さ", "方向", "長さ"], dimRows) +
    `<p class="small">吹抜けの位置は〔問題図〕の点線の部分（2階の平面）。階段室は1階・2階とも本体の南東に接する（図は1階の外形）。</p>`;

  // 4. 設問の答え ------------------------------------------------------------
  const tasks = [
    {
      label: "問1",
      q: `第一期工事後の主である建物（旧符号2）の<b>1階</b>の床面積（㎡）`,
      unit: "㎡",
      answer: b1New,
      tol: 0.005,
      pts: 3,
      expl: `1階の従前の床面積${exNum(b1)}㎡から取壊し部分${exNum(rd)}×${exNum(rw)}＝${exNum(rd * rw)}㎡を差し引く（準則84条）。答え：<b>${exNum(b1New)}㎡</b>。`,
    },
    {
      label: "問1",
      q: `第一期工事後の主である建物（旧符号2）の<b>2階</b>の床面積（㎡）`,
      unit: "㎡",
      answer: b2,
      tol: 0.005,
      pts: 2,
      expl: `2階は取壊し・増築がないので従前と同じ<b>${exNum(b2)}㎡</b>（用途を事務所に変えたのは種類の変更で、面積は変わらない）。`,
    },
    {
      label: "問2",
      q: `新築倉庫の<b>1階</b>の床面積（㎡）`,
      unit: "㎡",
      answer: out1,
      tol: 0.005,
      pts: 3,
      expl: `1階は本体${exNum(W)}×${exNum(D)}と階段室${exNum(w3)}×${exNum(d3)}の合計。階段室は床を有するものとみなして各階の床面積に算入する（準則82条6号）。答え：<b>${exNum(out1)}㎡</b>。` +
        (hasOutStair ? "屋外階段は床面積に算入しない（準則82条7号）。" : ""),
    },
    {
      label: "問2",
      q: `新築倉庫の<b>2階</b>の床面積（㎡）`,
      unit: "㎡",
      answer: out2,
      tol: 0.005,
      pts: 4,
      expl: `2階は1階と同じ外形の${exNum(W * D + w3 * d3, 3)}㎡から、吹抜けの合計${exNum(holeSum, 3)}㎡を除く（吹抜けは上階の床面積に算入しない。準則82条8号）。階段室は2階にも算入する。答え：<b>${exNum(out2)}㎡</b>。`,
    },
  ];

  const sheet1 = 1;
  const sheet2 = 2;
  const yen = ["不要", "非課税", "なし", "0円"];
  const attachFig = ["建物図面及び各階平面図", "建物図面、各階平面図", "建物図面・各階平面図", "各階平面図及び建物図面", "各階平面図、建物図面"];
  const attachProxy = ["代理権限証明情報", "委任状"];
  const attachOwn = ["所有権証明情報", "所有権を証する情報", "建築確認済証及び検査済証", "建築請負人の証明書"];
  const corpAns = [corpNo, corpNoHyphen, "会社法人等番号" + corpNo, "会社法人等番号" + corpNoHyphen];
  const mk = (sheetNo, f) => Object.assign({ sheetNo: sheetNo }, f);
  const appForm = [
    // 第1欄（第一期工事）
    mk(sheet1, { label: "登記の目的", answer: ["建物表題部変更登記", "建物表題部変更", "建物の表題部の変更登記"], hint: "工事の結果に応じた登記の目的を書く", pts: 2 }),
    mk(sheet1, { label: "申請人", answer: [corpName, hqAddr + corpName], hint: "会社の商号（会社法人等番号は別項目）", pts: 2 }),
    mk(sheet1, { label: "申請人の会社法人等番号", slot: "applicant", answer: corpAns, hint: "12桁", pts: 2 }),
    mk(sheet1, { label: "添付情報（①）", answer: attachFig, hint: "床面積を変更するときの図面（令別表十四の項）", pts: 2 }),
    mk(sheet1, { label: "添付情報（②）", slot: "attach", answer: attachProxy, hint: "代理人による申請のとき", pts: 1 }),
    mk(sheet1, { label: "登録免許税", answer: yen, hint: "課税の有無を判断する。不要のときは「不要」と記載", pts: 1 }),
    mk(sheet1, _wPre("tatemonoA", "所在", [shozaiReg], 1)),
    mk(sheet1, _wPre("tatemonoA", "家屋番号", [kaoku], 1)),
    mk(sheet1, _wCell("tatemonoA", 0, "gen", "1行目（従前の主である建物）の登記原因及びその日付", [`${d1a.text}取壊し`, `${d1a.text}主である建物取壊し`, `${d1a.text}主たる建物取壊し`], 2, "取壊しの日（準則102条）")),
    mk(sheet1, _wCell("tatemonoA", 1, "shufuku", "2行目の主である建物又は附属建物", ["主である建物", "主たる建物"], 1, "符号2は主である建物になる")),
    mk(sheet1, _wCell("tatemonoA", 1, "shurui", "2行目の種類", [kindOld], 2, "用途が2以上のときは2以上で定める（規則113条2項）")),
    mk(sheet1, _wCell("tatemonoA", 1, "kozo", "2行目の構造", [struct2], 1, "")),
    mk(sheet1, _wCell("tatemonoA", 1, "yuka", "2行目の床面積", wgFloorsAccepts([b1New, b2]), 3, "各階ごと")),
    mk(sheet1, _wCell("tatemonoA", 1, "gen", "2行目の登記原因及びその日付", [`${d1a.text}主たる建物に変更`, `${d1a.text}主である建物に変更`, `${d1b.text}主たる建物に変更`, `${d1b.text}主である建物に変更`], 2, "「令和何年何月何日主たる建物に変更」（準則102条）")),
    // 第2欄（第二期工事）
    mk(sheet2, { label: "登記の目的", answer: ["建物表題部変更登記", "建物表題部変更", "建物の表題部の変更登記"], hint: "工事の結果に応じた登記の目的を書く", pts: 2 }),
    mk(sheet2, { label: "申請人", answer: [corpName, hqAddr + corpName], hint: "会社の商号", pts: 2 }),
    mk(sheet2, { label: "申請人の会社法人等番号", slot: "applicant", answer: corpAns, hint: "12桁", pts: 2 }),
    mk(sheet2, { label: "添付情報（①）", answer: attachFig, hint: "附属建物を新築したとき（令別表十四の項ハ）", pts: 2 }),
    mk(sheet2, { label: "添付情報（②）", slot: "attach", answer: attachOwn, hint: "新築した附属建物の所有権を証する情報", pts: 2 }),
    mk(sheet2, { label: "添付情報（③）", slot: "attach", answer: attachProxy, hint: "代理人による申請のとき", pts: 1 }),
    mk(sheet2, { label: "登録免許税", answer: yen, hint: "課税の有無を判断する。不要のときは「不要」と記載", pts: 1 }),
    mk(sheet2, _wPre("tatemonoB", "所在", [shozaiReg], 1)),
    mk(sheet2, _wPre("tatemonoB", "家屋番号", [kaoku], 1)),
    mk(sheet2, _wCell("tatemonoB", 0, "shufuku", "1行目の附属建物の符号", ["符号4", "附属建物符号4", "4"], 1, "従前の符号")),
    mk(sheet2, _wCell("tatemonoB", 0, "gen", "1行目の登記原因及びその日付", [`${dTear.text}取壊し`], 2, "再築は滅失と新築として扱う（準則83条）")),
    mk(sheet2, _wCell("tatemonoB", 1, "shufuku", "2行目の附属建物の符号", ["符号5", "附属建物符号5", "5"], 2, "従前の最大の符号に続けて、完了の早い順")),
    mk(sheet2, _wCell("tatemonoB", 1, "shurui", "2行目の種類", ["倉庫"], 1, "")),
    mk(sheet2, _wCell("tatemonoB", 1, "kozo", "2行目の構造", [structNew, "鉄骨造合金メッキ鋼板ぶき2階建"], 2, "合金メッキ鋼板ぶきは亜鉛メッキ鋼板ぶきに準じる（規則114条）")),
    mk(sheet2, _wCell("tatemonoB", 1, "yuka", "2行目の床面積", wgFloorsAccepts([out1, out2]), 4, "階段室は算入、吹抜けは上階から除く")),
    mk(sheet2, _wCell("tatemonoB", 1, "gen", "2行目の登記原因及びその日付", [`${dNew.text}新築`], 2, "")),
    mk(sheet2, _wCell("tatemonoB", 2, "shufuku", "3行目の附属建物の符号", ["符号6", "附属建物符号6", "6"], 2, "再築した守衛所は新たな附属建物")),
    mk(sheet2, _wCell("tatemonoB", 2, "shurui", "3行目の種類", ["守衛所"], 1, "")),
    mk(sheet2, _wCell("tatemonoB", 2, "kozo", "3行目の構造", [structGuard], 1, "")),
    mk(sheet2, _wCell("tatemonoB", 2, "yuka", "3行目の床面積", wgAreaAccepts(cArea), 1, "")),
    mk(sheet2, _wCell("tatemonoB", 2, "gen", "3行目の登記原因及びその日付", [`${dRe.text}新築`], 2, "")),
    // 問4
    mk(3, { label: "（ア）変更登記は、登記記録を何的状態に合わせるためのものか", answer: ["物理", "物理的"], hint: "語句群から", pts: 1 }),
    mk(3, { label: "（イ）これは何的登記ともいわれるか", answer: ["報告", "報告的"], hint: "語句群から", pts: 1 }),
    mk(3, { label: "（ウ）申請義務の期間", answer: ["1月", "一月", "1月以内"], hint: "法51条1項", pts: 1 }),
    mk(3, { label: "（エ）申請を怠った場合", answer: ["10万円以下の過料"], hint: "法164条", pts: 1 }),
  ];

  // 5. 図: 新築倉庫の1階の外形と2階の吹抜け（X=北・Y=東。南東の階段室が出っ張るL字）
  const P = { P1: [0, 0], P2: [D, 0], P3: [D, W], P4: [-d3, W], P5: [-d3, W - w3], P6: [0, W - w3] };
  const figure = {
    points: P,
    polys: [["P1", "P2", "P3", "P4", "P5", "P6"]],
    holes: holes.map((h, i) => ({
      poly: [
        [h.x0, h.y0],
        [h.x0 + h.d, h.y0],
        [h.x0 + h.d, h.y0 + h.w],
        [h.x0, h.y0 + h.w],
      ],
      label: `吹抜${i + 1}`,
    })),
    lines: [],
    revealPoints: [],
    areaLabels: [
      { at: [D / 2, W / 2], text: `1階 ${exNum(out1)}㎡` },
      { at: [D / 2 + 1.2, W / 2], text: `2階 ${exNum(out2)}㎡` },
    ],
  };

  return {
    statement: html,
    coords: [],
    tasks: tasks,
    appForm: appForm,
    sheetTitles: { 1: "第1欄（問1：第一期工事の登記申請書）", 2: "第2欄（問2：第二期工事の登記申請書）", 3: "問4（説明文の空欄）" },
    figure: figure,
    figureChecks: [
      "縮尺（250分の1）で作図した（規則83条2項）",
      "各階の別（1階・2階）を記入した（規則83条1項）",
      "各階の平面の形状を図示し、1階の位置を示した",
      "各階ごとの建物の周囲の長さ（各辺の距離）を、小数第2位まで記入した",
      "床面積及びその求積方法を記入した",
      "附属建物の別と符号（符号5）を記入した",
      "階段室を各階の床面積に算入した（準則82条6号）",
      `2階の吹抜け${holes.length}か所を床面積から除き、点線等で示した（準則82条8号）`,
      hasOutStair ? "屋外階段は床面積に算入していない（準則82条7号）" : "付属設備のない外壁線だけで形状を示した",
    ],
    articleFill: null,
    verify: {
      kind: "exam-r7-tatemono",
      dims: { dm, wm, d2, w2, rd, rw, cd, cw, W, D, w3, d3, holes, hasOutStair },
      areas: { a1m, b1, b2, b1New, cArea, out1, out2 },
      figure: P,
      // 工事・申請の日付（昇順でなければ事案が成り立たない）
      dates: [d1a, d1b, app1, dTaishin, dTear, dNew, dRe, app2].map((x) => x.y * 10000 + x.m * 100 + x.d),
    },
  };
}

// ─────────── 令和6年度 第22問（建物）の型 ───────────
// 事案: 夫婦が共同で費用を出して新築した木造2階建の居宅。表題登記の申請書、所有権を証する情報、
// 建物図面・各階平面図、区分建物でない建物としての独立性、を問う。
// 床面積の認定の核心は、①出窓（高さ1.5m以上で下部が床面と同一の高さのものだけ算入）、
// ②外気と分断されていない部分（屋外廊下・バルコニー・周壁のない車庫）は算入しない、の2点。
//
// 根拠: 準則87条1項（所有権を証する情報）、準則82条11号（出窓）、規則111条（建物の要件）、
//   規則112〜115条（家屋番号・種類・構造・床面積）、規則82条・83条（図面）、令別表十二の項（添付情報）、
//   区分所有法1条（構造上・利用上の独立性）。
function exBuildR6Tatemono(rng) {
  // 1. 寸法（柱の中心間。0.45mの倍数）---------------------------------------
  const m = (a, b) => 0.45 * wgInt(rng, a, b);
  const w1 = m(20, 26); // 1階本体の東西
  const d1 = m(14, 17); // 1階本体の南北
  const a1 = m(6, 8); // 1階の張り出し（リビング）の東西
  const b1 = m(4, 6); // 同 南北
  const w2 = m(18, 22); // 2階本体の東西
  const d2 = m(18, 20); // 2階本体の南北
  const aw = m(6, 7); // 2階の（あ）部分（屋外廊下の向こうの居室）の東西
  const ad = m(20, 22); // 同 南北
  const gap = m(2, 3); // 屋外廊下の幅（床面積に算入しない）
  const bw = m(4, 6); // バルコニー（算入しない）
  const bd = m(2, 3);
  // 出窓: 床面から窓枠下端までの高さと窓の高さ。算入するのは「高さ1.5m以上で下部が床面と同一の高さ」だけ。
  const h0 = wgPick(rng, [0.9, 0.9, 0.6, 0.3, 0]);
  const hw = wgPick(rng, [1.1, 1.4, 1.5, 1.8, 2.0]);
  const bayCounts = h0 === 0 && hw >= 1.5;
  const bayW = m(3, 4);
  const bayD = 0.45;
  const bayA = bayW * bayD;
  const area1 = exFloor2(w1 * d1 + a1 * b1 + (bayCounts ? bayA : 0));
  const area2 = exFloor2(w2 * d2 + aw * ad + (bayCounts ? bayA : 0));
  // 土地（長方形）と、建物の外壁から筆界までの距離
  const xN = exU(rng, 40, 60);
  const yA = exU(rng, 10, 20);
  const wl = wgStep(rng, 19, 23, 0.5);
  const dl = wgStep(rng, 12.5, 15, 0.5);
  const ow = wgStep(rng, 1, 2, 0.5); // 西側筆界から
  const on = wgStep(rng, 1.5, 2.5, 0.5); // 北側筆界から
  const siteA = [xN, yA];
  const siteC = [xN, exRound(yA + wl)];
  const siteD = [exRound(xN - dl), siteC[1]];
  const siteE = [siteD[0], yA];
  const bx = exRound(xN - on); // 建物1階本体の北西角
  const by = exRound(yA + ow);
  // 建物（1階の外形と、屋外廊下を隔てた2階の（あ）部分）が土地の内側に収まること
  if (by + w1 + gap + aw > siteC[1] - 0.5 || bx - d1 - b1 < siteE[0] + 0.5 || bx - ad < siteE[0] + 0.5) return null;

  // 2. 当事者・場所・日付・持分 --------------------------------------------------
  const sur = wgPick(rng, WG_SURNAME);
  const wife = sur + wgPick(rng, WG_GIVEN_F);
  let g = wgPick(rng, WG_GIVEN_M);
  const husband = sur + g;
  const mother = sur + wgPick(rng, WG_GIVEN_F.filter((x) => sur + x !== wife));
  const shiho = wgPerson(rng);
  const builder = wgPick(rng, WG_SURNAME) + "建設株式会社";
  const city = wgPick(rng, EX_CITIES);
  const town = wgPick(rng, EX_TOWNS) + wgPick(rng, ["二丁目", "三丁目", "四丁目"]);
  const baseNo = wgInt(rng, 5, 60);
  const sub = wgInt(rng, 2, 30);
  const shozaiTown = city + town;
  const shozaiBld = `${shozaiTown}${baseNo}番地${sub}`;
  const kaoku = `${baseNo}番${sub}`;
  const shares = wgPick(rng, [
    [[2, 5], [3, 5]],
    [[1, 3], [2, 3]],
    [[3, 10], [7, 10]],
    [[1, 4], [3, 4]],
  ]);
  const share = (x) => `${x[1]}分の${x[0]}`;
  const dDone = wgDate(rng);
  const dApp = exAddDays(dDone, wgInt(rng, 14, 25));
  const struct = "木造亜鉛メッキ鋼板ぶき2階建";
  const nb = (x) => exNum(x);

  // 3. 問題文 -------------------------------------------------------------------
  const words = [
    "検査", "敷地権", "登記事項証明書", "確認", "固定資産税", "適合証明書", "登記識別情報通知", "公告", "報告", "建築請負人",
    "許可", "登録免許税", "所得税", "届出", "法務事務官", "規約証明書", "後見人", "受理", "賃借人",
  ]
    .map((k) => [rng(), k])
    .sort((a, b) => a[0] - b[0])
    .map((x) => x[1]);
  const html =
    `<p><b>【出題の趣旨】</b>${wife}は、配偶者である${husband}と共同して、${shozaiTown}${baseNo}番${sub}の土地（以下「本件土地」という。）上に住居としての建物（以下「本件建物」という。）を新築した。` +
    `土地家屋調査士${shiho}は、【事実関係】のとおり${wife}から表示に関する登記の相談を受け、必要となる登記の申請手続の代理並びに調査及び測量の依頼を受け、現地の測量を行い、必要となる登記の申請を行った。` +
    `なお、本件土地には、記録されている権利以外の権利は存在しない。</p>` +
    `<p><b>【問1】</b>${shiho}は、${wife}から、「本件建物の表示に関する登記には所有権を証する情報が必要ということだが、そもそも所有権を証する情報として、一般的にどのようなものが必要か。」との質問を受けた。` +
    `次の文は、不動産登記事務取扱手続準則第87条第1項の規定を要約したものである。（ア）から（エ）までに入る文言（（ア）及び（イ）は順不同）を、〔語句群〕から選びなさい。</p>` +
    `<blockquote class="small" style="margin:6px 0 10px 8px;padding-left:10px;border-left:3px solid var(--border)">` +
    `所有権を証する情報は、建築基準法上の（ア）及び（イ）のあったことを証する情報、（ウ）又は敷地所有者の証明情報、（エ）の納付証明に係る情報その他申請人の所有権の取得を証するに足る情報といったものがあります。</blockquote>` +
    `<p class="small"><b>〔語句群〕</b>${words.join("　")}</p>` +
    `<p><b>【問2】</b>${shiho}が${dApp.text}に申請した、本件建物の表示に関する登記の申請書を完成させなさい。</p>` +
    `<p><b>【問3】</b>問2の申請書に添付する<b>建物図面（500分の1）及び各階平面図（250分の1）</b>を作図しなさい。` +
    `各階平面図に記載する距離は小数第2位まで、建物図面に記載する距離は小数第1位までとする。（紙で作図し、採点後にチェック項目で確認する。）</p>` +
    `<p><b>【問4】</b>${wife}は、${shiho}に対し、「本件建物のうち屋外廊下により隔てられた東側部分（図の（あ）部分）のみについて、${husband}を表題部所有者とする区分建物でない建物として表示に関する登記の申請が可能か。」と質問した。` +
    `次の説明の（①）及び（②）に入る文言を答えなさい。</p>` +
    `<blockquote class="small" style="margin:6px 0 10px 8px;padding-left:10px;border-left:3px solid var(--border)">` +
    `（あ）部分の1階部分は周壁が設けられておらず、外気と分断されていると認めることができませんが、（あ）部分の2階部分は、壁、屋根、床が設けられていることにより外気と分断されていると認められることから、（①）の独立性は認められます。` +
    `しかし、（あ）部分に出入りするためには屋外廊下を使用しなければならないことから、（②）の独立性を認めることができず、（あ）部分のみを1個の建物として表示に関する登記の申請をすることができません。` +
    `したがって、全体を1個の建物として、表題部所有者を${husband}及び${wife}とする表示に関する登記を申請することになります。</blockquote>` +
    `<p class="small" style="margin-top:10px">（注）</p>` +
    [
      "本問における行為は全て適法に行われており、法律上必要な書類は全て適法に作成されているものとする。",
      `登記の申請は書面申請の方法によってするものとし、申請人は${wife}とする。`,
      "建物図面は500分の1、各階平面図は250分の1の縮尺により作成すること。",
      "床面積は、各階ごとに壁その他の区画の中心線で囲まれた部分の面積により、0.01㎡未満を切り捨てる。",
    ]
      .map((t, i) => `<p class="small">${i + 1}　${t}</p>`)
      .join("") +
    `<p style="margin-top:14px"><b>【事実関係】</b></p>` +
    [
      `本件土地は、${husband}の母である${mother}が所有している。`,
      `本件建物は、${shozaiBld}に住所を有する${wife}及び${husband}が共同して費用を分担して新築した。本件建物は${dDone.text}に完成し、${wife}及び${husband}は、同日、新築工事をした${builder}から引渡しを受けた。`,
      `${wife}及び${husband}は、新築工事の代金を支出した割合に応じて、${wife}の持分を${share(shares[0])}とし、${husband}の持分を${share(shares[1])}とする表示に関する登記の申請をすることで合意している。`,
      `本件建物の概要は次のとおりである。<br>⑴　主たる構造は木造である。<br>⑵　屋外廊下及びバルコニーについては、外気と分断されていない。<br>⑶　屋根の構造は合金メッキ鋼板ぶきである。` +
        `<br>⑷　1階及び2階に出窓があり、いずれも<b>床面から窓枠下端までの高さが${nb(h0)}ｍ、窓の高さが${nb(hw)}ｍ</b>である。` +
        `<br>⑸　（あ）部分の1階部分は車庫として利用するための空間で、周壁はない。（あ）部分の1階部分には、（あ）部分の2階部分へ昇降するための階段はなく、2階部分に出入りするには屋外廊下を利用しなければならない。` +
        `（あ）部分の2階部分は、柱及びコンクリート基礎により地上に定着している。`,
    ]
      .map((t, i) => `<p>${i + 1}　${t}</p>`)
      .join("") +
    `<p style="margin-top:12px"><b>【調査・測量】</b>（単位：ｍ。各階平面図の数値は柱の中心間の距離。建物の隅部は全て直角。）</p>` +
    exTable(
      ["部分", "東西", "南北", "備考"],
      [
        ["1階 本体", nb(w1), nb(d1), ""],
        ["1階 張り出し部分（南東）", nb(a1), nb(b1), "本体に接する"],
        ["1階 （あ）部分（車庫）", nb(aw), nb(ad), "柱と屋根のみで周壁なし"],
        ["2階 本体", nb(w2), nb(d2), ""],
        ["2階 （あ）部分の居室", nb(aw), nb(ad), "屋外廊下を隔てて東側"],
        ["屋外廊下", nb(gap), nb(ad), "2階。外気と分断されていない"],
        ["バルコニー（2階）", nb(bw), nb(bd), "外気と分断されていない"],
        ["出窓（各階1か所）", nb(bayW), nb(bayD), `床面から下端 ${nb(h0)}ｍ・窓の高さ ${nb(hw)}ｍ`],
      ],
    ) +
    `<p class="small">土地の筆界点の座標値（Ｘは北、Ｙは東）：Ａ(${nb(siteA[0])}, ${nb(siteA[1])})、Ｃ(${nb(siteC[0])}, ${nb(siteC[1])})、Ｄ(${nb(siteD[0])}, ${nb(siteD[1])})、Ｅ(${nb(siteE[0])}, ${nb(siteE[1])})。` +
    `建物の1階本体の外壁は、北側の筆界から${nb(on)}ｍ、西側の筆界から${nb(ow)}ｍの位置にある。</p>`;

  // 4. 設問の答え --------------------------------------------------------------------
  const tasks = [
    {
      label: "問2",
      q: `本件建物の<b>1階</b>の床面積（㎡）`,
      unit: "㎡",
      answer: area1,
      tol: 0.005,
      pts: 4,
      expl: `1階は本体${nb(w1)}×${nb(d1)}と張り出し${nb(a1)}×${nb(b1)}。（あ）部分の1階は周壁がなく外気と分断されていないので算入しない（規則111条）。` +
        (bayCounts ? `出窓は高さ${nb(hw)}ｍ（1.5ｍ以上）で下部が床面と同一の高さなので算入する（準則82条11号）。` : `出窓は下端が${nb(h0)}ｍ・高さ${nb(hw)}ｍで、「高さ1.5ｍ以上で下部が床面と同一の高さ」に当たらないので算入しない（準則82条11号）。`) +
        `答え：<b>${nb(area1)}㎡</b>。`,
    },
    {
      label: "問2",
      q: `本件建物の<b>2階</b>の床面積（㎡）`,
      unit: "㎡",
      answer: area2,
      tol: 0.005,
      pts: 4,
      expl: `2階は本体${nb(w2)}×${nb(d2)}と（あ）部分の居室${nb(aw)}×${nb(ad)}。屋外廊下とバルコニーは外気と分断されていないので算入しない。（あ）部分の2階は壁・屋根・床があるので算入する。` +
        (bayCounts ? `出窓は算入する。` : `出窓は算入しない。`) + `答え：<b>${nb(area2)}㎡</b>。`,
    },
  ];

  const mk = (f) => Object.assign({ sheetNo: 0 }, f);
  const yen = ["不要", "非課税", "なし", "0円"];
  const person = (name, sh) => [name, shozaiBld + name, `持分${share(sh)}${name}`, `${shozaiBld}持分${share(sh)}${name}`, `${share(sh)}${name}`];
  const appForm = [
    mk({ label: "登記の目的", answer: ["建物表題登記"], hint: "不動産種別から書く", pts: 2 }),
    mk({ label: "登記原因及びその日付", answer: [`${dDone.text}新築`], hint: "完成（引渡し）の日", pts: 2 }),
    mk({ label: "添付情報（①）", answer: ["建物図面及び各階平面図", "建物図面、各階平面図", "建物図面・各階平面図", "各階平面図及び建物図面", "各階平面図、建物図面"], hint: "令別表十二の項", pts: 2 }),
    mk({ label: "添付情報（②）", slot: "attach", answer: ["所有権証明情報", "所有権を証する情報", "建築確認済証及び検査済証", "建築請負人の証明書"], hint: "準則87条", pts: 2 }),
    mk({ label: "添付情報（③）", slot: "attach", answer: ["住所証明情報", "住民票の写し", "住民票", "住所を証する情報"], hint: "表題部所有者となる者の住所（令別表十二の項）", pts: 2 }),
    mk({ label: "添付情報（④）", slot: "attach", answer: ["代理権限証明情報", "委任状"], hint: "代理人による申請のとき", pts: 1 }),
    mk({ label: "申請人（1人目）", slot: "applicant", answer: person(wife, shares[0]), hint: "氏名（持分は別項目）", pts: 2 }),
    mk({ label: "1人目の持分", slot: "applicant", answer: [share(shares[0]), `持分${share(shares[0])}`], hint: "共有の持分", pts: 2 }),
    mk({ label: "申請人（2人目）", slot: "applicant", answer: person(husband, shares[1]), hint: "氏名（持分は別項目）", pts: 2 }),
    mk({ label: "2人目の持分", slot: "applicant", answer: [share(shares[1]), `持分${share(shares[1])}`], hint: "共有の持分", pts: 2 }),
    mk({ label: "登録免許税", answer: yen, hint: "課税の有無を判断する。不要のときは「不要」と記載", pts: 1 }),
    mk(_wPre("tatemono", "所在", [shozaiBld], 1)),
    mk(_wPre("tatemono", "家屋番号", [kaoku], 1)),
    mk(_wCell("tatemono", 0, "shurui", "種類", ["居宅"], 2, "住居としての建物（規則113条）")),
    mk(_wCell("tatemono", 0, "kozo", "構造", [struct, "木造合金メッキ鋼板ぶき2階建"], 3, "合金メッキ鋼板ぶきは亜鉛メッキ鋼板ぶきに準じる（規則114条）")),
    mk(_wCell("tatemono", 0, "yuka", "床面積", wgFloorsAccepts([area1, area2]), 4, "各階ごと")),
    // 問1（準則87条1項）・問4
    mk({ sheetNo: 3, label: "（ア）（イ）建築基準法上のあったことを証する情報（順不同）", answer: ["確認・検査", "検査・確認", "確認、検査", "検査、確認", "確認と検査", "検査と確認", "確認及び検査", "検査及び確認"], hint: "準則87条1項。語句群から2つ", pts: 2 }),
    mk({ sheetNo: 3, label: "（ウ）敷地所有者の証明情報と並ぶもの", answer: ["建築請負人"], hint: "語句群から", pts: 1 }),
    mk({ sheetNo: 3, label: "（エ）何の納付証明に係る情報か", answer: ["固定資産税"], hint: "語句群から", pts: 1 }),
    mk({ sheetNo: 3, label: "（①）（あ）部分の2階について認められる独立性", answer: ["構造上"], hint: "区分所有法1条の独立性のうち", pts: 2 }),
    mk({ sheetNo: 3, label: "（②）屋外廊下を使わないと出入りできないため認められない独立性", answer: ["利用上"], hint: "区分所有法1条の独立性のうち", pts: 2 }),
  ];

  // 5. 図: 土地（筆界）と建物の1階の外形。2階の（あ）部分と屋外廊下は点線で示す
  // 1階の外形（北西角から時計回り。南東に張り出し部分が付くL字）
  const R1 = [[bx, by], [bx, by + w1], [bx - d1 - b1, by + w1], [bx - d1 - b1, by + w1 - a1], [bx - d1, by + w1 - a1], [bx - d1, by]];
  // 2階の（あ）部分は1階本体の東側に、屋外廊下を隔てて置く
  const east = by + w1 + gap;
  const R2a = [[bx, east], [bx - ad, east], [bx - ad, east + aw], [bx, east + aw]];
  const pts = { A: siteA, C: siteC, D: siteD, E: siteE };
  const figure = {
    points: pts,
    polys: [["A", "C", "D", "E"]],
    holes: [
      { poly: R1, label: "1階" },
      { poly: R2a, label: "2階(あ)" },
    ],
    lines: [],
    revealPoints: [],
    areaLabels: [{ at: [bx - d1 / 2, by + w1 / 2], text: `1階 ${nb(area1)}㎡` }],
  };
  return {
    statement: html,
    coords: [],
    tasks: tasks,
    appForm: appForm,
    sheetTitles: { 0: "申請書（問2）", 3: "問1・問4（語句の空欄）" },
    figure: figure,
    figureChecks: [
      "建物図面は500分の1、各階平面図は250分の1で作図した（規則82条3項・83条2項）",
      "建物図面に方位、敷地の地番とその形状、隣接地の地番を記入した（規則82条2項）",
      "建物の1階の位置・形状を、筆界からの距離（小数第1位まで）で示した",
      "各階平面図に各階の別、各階の平面の形状、1階の位置を記入した（規則83条1項）",
      "各階ごとの建物の周囲の長さ（各辺の距離）を、小数第2位まで記入した",
      "床面積及びその求積方法を各階ごとに記入した",
      "屋外廊下・バルコニー・（あ）部分の1階（周壁なし）を床面積に算入していない",
      bayCounts ? "出窓（高さ1.5ｍ以上で下部が床面と同一）を床面積に算入した" : "出窓を床面積に算入していない（準則82条11号）",
    ],
    articleFill: null,
    verify: {
      kind: "exam-r6-tatemono",
      dims: { w1, d1, a1, b1, w2, d2, aw, ad, gap, bw, bd, h0, hw, bayW, bayD, bayCounts, bx, by },
      areas: { area1, area2 },
      shares: shares,
      site: { A: siteA, C: siteC, D: siteD, E: siteE, wl, dl, ow, on },
      figure: { R1: R1, R2a: R2a },
    },
  };
}

// ─────────── 令和6年度 第21問（土地）の型 ───────────
// 事案: 隣り合う2筆（甲=山田、乙=野原）の筆界を調査する。ブロック塀の位置は両者が合意して置いたもので、
// 塀の端の金属標（C）は道路境界線上にない。調査・立会いの結果、筆界は「Bから道路境界線上のP」と確認された。
// 設問: B・D・Pの座標値（観測値と直線の交点）、各土地の地積と公差の比較（更正の要否）、
// 必要な土地の地積更正登記の申請書、地積測量図の作図（紙）。
//
// 本試験の問1（筆界を何の資料で判断するか）と問5（地図に準ずる図面の訂正）は、条文で決まらない
// 通説・実務の判断を含むので、本型では出さない。筆界は問題文で「立会いにより確認した」と定める。
//
// 根拠: 規則10条4項1号（市街地地域の精度区分は甲二まで）、国土調査法施行令 別表第四（公差の算式）、
//   準則73条（地積の更正の原因は「③錯誤」と記録）、規則77条（地積測量図）、規則100条（地積の端数）。
function exBuildR6Land(rng) {
  // 1. 道路境界線（東側。J・I・D・Pはこの直線上）と、各点 ------------------------------------
  const slope = exU(rng, -0.03, 0.03);
  const xJ = exU(rng, 15, 25);
  const yJ = exU(rng, 58, 64);
  const road = (x) => yJ + slope * (x - xJ);
  const xI = exRound(xJ + 2);
  const I = [xI, exRound(road(xI))];
  const J = [xJ, yJ];
  // Bは観測値から求めさせる。Dは道路境界線上の点。先に真値を置き、観測値を丸めてから再計算した値を正解にする。
  const yWidth = exU(rng, 6.2, 7.4); // 乙の東西（Hから道路境界線まで）
  const B0 = [exRound(xI + exU(rng, 5.2, 6.0)), exRound(I[1] - yWidth)];
  const xC0 = exRound(B0[0] + exU(rng, 0.05, 0.15));
  const xD0 = exRound(xC0 + exU(rng, 2.0, 3.5));
  const D0 = [xD0, exRound(road(xD0))];
  const T2 = [exRound(xC0 + exU(rng, -1, 1)), exRound(road(xC0) + exU(rng, 3, 3.6))];
  const T1 = [exRound(xJ - exU(rng, 2.5, 4)), exRound(yJ + exU(rng, 0.4, 1.2))];
  const b1 = exBearing(T2, T1);
  const obs = (P0) => {
    const a = (exBearing(T2, P0) - b1 + 2 * Math.PI) % (2 * Math.PI);
    return { sec: Math.round((a * 180 * 3600) / Math.PI), dist: exRound(exDist(T2, P0)) };
  };
  const polar = (o) => {
    const br = b1 + (o.sec / 3600) * (Math.PI / 180);
    return [exRound(T2[0] + o.dist * Math.cos(br)), exRound(T2[1] + o.dist * Math.sin(br))];
  };
  const obsB = obs(B0);
  const obsD = obs(D0);
  const B = polar(obsB);
  const D = polar(obsD);
  const H = [xI, B[1]];
  // 塀の端の金属標C（道路境界線の外側に約0.1mずれている）
  const xC = exRound(B[0] + exU(rng, 0.05, 0.15));
  const C = [xC, exRound(road(xC) + exU(rng, 0.08, 0.14))];
  // P = 直線BC と 直線DJ の交点
  const line = (p, q) => ({ a: q[1] - p[1], b: p[0] - q[0], c: (q[1] - p[1]) * p[0] + (p[0] - q[0]) * p[1] });
  const l1 = line(B, C);
  const l2 = line(D, J);
  const det = l1.a * l2.b - l2.a * l1.b;
  if (Math.abs(det) < 1e-9) return null;
  const Pexact = [(l1.c * l2.b - l2.c * l1.b) / det, (l1.a * l2.c - l2.a * l1.c) / det];
  const P = [exRound(Pexact[0]), exRound(Pexact[1])];
  if (!(P[0] < D[0] - 0.5 && P[0] > I[0] + 0.5)) return null;
  // 甲土地の残りの点
  const xE = exRound(D[0] + exU(rng, 4.5, 6));
  const E = [xE, exRound(road(xE) + exU(rng, -0.15, 0.15))];
  const F = [xE, exRound(E[1] - exU(rng, 10.3, 11.0))];
  const yW = exRound(F[1] - exU(rng, 1.5, 2.2));
  const G = [exRound(xE - exU(rng, 1.2, 2.0)), yW];
  const A = [exRound(B[0] - exU(rng, 1.9, 2.8)), yW];
  if (!(A[1] < B[1] - 3 && G[0] > A[0] + 3 && F[1] < E[1] - 8)) return null;

  // 2. 面積と公差、更正の要否 ----------------------------------------------------
  const polyKou = [A, B, P, D, E, F, G];
  const polyOtsu = [B, H, I, P];
  const sKou = wgChiseki(wgArea(polyKou), "宅地");
  const sOtsu = wgChiseki(wgArea(polyOtsu), "宅地");
  const needKou = rng() < 0.5;
  const seido = "甲二"; // 市街地地域（規則10条4項1号）
  const mkRecorded = (measured, over) => {
    let rec = measured;
    for (let i = 0; i < 3; i++) {
      const k = wgKosaShown(rec, seido);
      const gap = over ? k * exU(rng, 1.5, 2.8) : k * exU(rng, 0.1, 0.6);
      rec = exRound(measured + (rng() < 0.5 ? -gap : gap));
    }
    return rec;
  };
  const recKou = mkRecorded(sKou, needKou);
  const recOtsu = mkRecorded(sOtsu, !needKou);
  const kKou = wgKosaShown(recKou, seido);
  const kOtsu = wgKosaShown(recOtsu, seido);
  const dKou = exRound(Math.abs(recKou - sKou));
  const dOtsu = exRound(Math.abs(recOtsu - sOtsu));
  const margin = (d, k, over) => (over ? d >= k * 1.1 : d <= k * 0.9);
  if (!margin(dKou, kKou, needKou) || !margin(dOtsu, kOtsu, !needKou)) return null;
  if (recKou <= 20 || recOtsu <= 20) return null;

  // 3. 当事者・場所 ------------------------------------------------------------------
  const ownerKou = wgPerson(rng);
  let ownerOtsu = wgPerson(rng, "f");
  if (ownerOtsu.slice(0, 1) === ownerKou.slice(0, 1)) ownerOtsu = wgPerson(rng, "f");
  const shiho = wgPerson(rng);
  const city = wgPick(rng, EX_CITIES);
  const town = wgPick(rng, EX_TOWNS) + wgPick(rng, EX_CHOME);
  const shozai = city + town;
  const nK = wgInt(rng, 2, 30);
  const nO = nK + 1;
  const bunK = `${nK}番1`;
  const bunO = `${nO}番1`;
  const addrK = `${shozai}${nK}番地1`;
  const addrO = `${shozai}${nO}番地1`;
  const dApp = wgDate(rng);
  const dView = exAddDays(dApp, -wgInt(rng, 60, 90));
  const yearFence = wgInt(rng, 10, 20);
  const nb = (v) => exNum(v);

  // 4. 問題文 -----------------------------------------------------------------------
  const kosaRows = ["甲一", "甲二", "甲三", "乙一", "乙二", "乙三"];
  const html =
    `<p><b>【出題の趣旨】</b>土地家屋調査士${shiho}は、${shozai}${bunK}の土地（以下「甲土地」という。）及び同${bunO}の土地（以下「乙土地」といい、甲土地と併せて「本件各土地」という。）について、` +
    `甲土地の所有者である${ownerKou}及び乙土地の所有者である${ownerOtsu}から、筆界の調査に関する相談を受け、【聴取結果の概要】のとおり事情を聴取し、` +
    `必要となる表示に関する登記の申請手続の代理並びに調査及び測量の依頼を受け、【調査及び測量の結果の概要】のとおり調査及び測量を行ったうえ、必要となる表示に関する登記の申請をした。</p>` +
    `<p><b>【問1】</b>【聴取結果の概要】及び【調査及び測量の結果の概要】から、図上の<b>Ｂ点、Ｄ点及びＰ点の座標値</b>を求めなさい（Ｐ点は【調査及び測量の結果の概要】2⑶参照）。</p>` +
    `<p><b>【問2】</b>甲土地及び乙土地の地積（測量の結果による地積）を求め、登記記録上の地積との差を公差と比べて、それぞれ<b>地積更正の登記が必要か</b>を判断しなさい。</p>` +
    `<p><b>【問3】</b>${shiho}が${dApp.text}に申請した、本件各土地に関する登記の申請書を完成させなさい（申出書は記載しなくてよい。登録免許税の納付を要しないときは「不要」と記載する）。</p>` +
    `<p><b>【問4】</b>問3の申請書に添付する<b>地積測量図</b>を、250分の1の縮尺で作図しなさい。（紙で作図し、採点後にチェック項目で確認する。）</p>` +
    `<p class="small" style="margin-top:10px">（注）</p>` +
    [
      "本問における行為は全て適法に行われており、法律上必要な書類は全て適法に作成されているものとする。",
      "登記の申請は、書面申請の方法によってするものとする。",
      "座標値は、計算結果の小数第3位を四捨五入し、小数第2位までとすること。",
      "地積測量図は、250分の1の縮尺により作成すること。距離は小数第3位を四捨五入し、小数第2位までとすること。",
      "地積測量図には、各筆界点の座標値、平面直角座標系の番号又は記号、地積及びその求積方法並びに測量年月日は、記載することを要しない。",
      "市基準点の各点は、地積測量図にその地点を明示して点名を付して記載すること（座標値は不要）。",
      "座標法で求めた面積は、宅地であるから0.01㎡未満を切り捨てる（規則100条）。",
    ]
      .map((t, i) => `<p class="small">${i + 1}　${t}</p>`)
      .join("") +
    `<p style="margin-top:14px"><b>【聴取結果の概要】</b></p>` +
    [
      `${addrK}に住所を有する${ownerKou}は、Ａ点、Ｂ点、Ｃ点、Ｄ点、Ｅ点、Ｆ点、Ｇ点及びＡ点を順次直線で結んだ範囲を自宅の敷地として使用している。`,
      `${addrO}に住所を有する${ownerOtsu}は、Ｂ点、Ｈ点、Ｉ点、Ｃ点及びＢ点を順次直線で結んだ範囲を自宅の敷地として使用している。`,
      `${ownerOtsu}は、${dView.text}、乙土地を売却しようとして登記所で乙土地に関する地図に準ずる図面を閲覧したところ、土地の形状が自宅の敷地の形状と違うことに気付き、${ownerKou}に伝えた。`,
      `${ownerKou}及び${ownerOtsu}は、${shiho}の調査及び測量の結果に基づき、本件各土地の筆界を確認し、必要となる登記は、その土地の所有者が行い、もう一方の所有者が協力することを合意した。`,
      `甲土地の南側にあるブロック塀（以下「本件ブロック塀」という。）は、平成${yearFence + 15}年に${ownerKou}が費用を出して設置したもので、測量の結果に基づくものではなく、両者が合意した位置に置かれた。このとき、筆界の確認はしていない。`,
      `本件ブロック塀上のＣ点には金属標が設置されているが、これも測量の結果に基づくものではなく、両者が合意した位置に置かれたものである。`,
    ]
      .map((t, i) => `<p>${i + 1}　${t}</p>`)
      .join("") +
    `<p style="margin-top:12px"><b>【調査及び測量の結果の概要】</b></p>` +
    `<p>1　資料に関する調査の結果</p>` +
    `<p class="small">⑴　登記記録の抜粋</p>` +
    exTable(
      ["", "所在", "地番", "地目", "地積", "甲区（所有者）", "乙区"],
      [
        ["甲土地", shozai, bunK, "宅地", `${nb(recKou)}㎡`, `${addrK}　${ownerKou}`, "（登記事項なし）"],
        ["乙土地", shozai, bunO, "宅地", `${nb(recOtsu)}㎡`, `${addrO}　${ownerOtsu}`, "（登記事項なし）"],
      ],
    ) +
    `<p class="small" style="margin-top:6px">⑵　地図等に関する調査結果　本件各土地の所在する地域には、不動産登記法第14条第1項の地図は備え付けられていないが、地図に準ずる図面が備え付けられている。本件各土地は、不動産登記規則第10条第2項第1号の<b>市街地地域</b>に属する。</p>` +
    `<p class="small">⑶　道路境界の調査の結果　${shozai.replace(/[一二三四]丁目/, "")}の市道路管理課の道路境界確認図のＫ1点及びＫ2点は、図上のＤ点及びＪ点と合致している。道路境界線は、Ｄ点とＪ点を結ぶ直線上にあり、Ｉ点もその直線上にある。</p>` +
    `<p>2　利用状況、境界標の状況並びに立会い及び測量の結果</p>` +
    `<p class="small">⑴　Ａ点、Ｂ点、Ｄ点、Ｅ点、Ｆ点、Ｇ点、Ｈ点、Ｉ点及びＪ点にはコンクリート杭が、Ｃ点には金属標が設置されている。Ｃ点以外の境界標には永続性がある。<br>` +
    `⑵　${shiho}による現地立会いの結果、本件各土地の筆界は、${ownerKou}及び${ownerOtsu}の認識とも一致した。また、全ての隣接土地所有者と確認を行い、その認識が一致した。<br>` +
    `⑶　${shiho}の現地立会い及び測量の結果、Ｃ点に設置されている金属標が<b>道路との境界線上に設置されていない</b>ことが判明した。移設後の点名は<b>Ｐ点</b>とする。` +
    `筆界は<b>Ｂ点から道路境界線上のＰ点まで</b>の直線であり、Ｐ点は直線ＢＣと直線ＤＪ（道路境界線）の交点とする。境界標の種類は移動前と同種のものを永続性のある状態で設置した。<br>` +
    `⑷　近傍の市基準点の点検測量を行い、許容誤差内にあることを確認した。成果表の値により測量を行い、観測値及び筆界点等の座標値を得た。</p>` +
    `<p class="small">⑸　地積測定の公差（登記記録上の地積に対する値。精度区分は地域に応じて選ぶ。市街地地域＝規則10条4項1号）</p>` +
    exTable(
      ["区分"].concat(kosaRows),
      [
        [`甲土地 ${nb(recKou)}㎡`].concat(kosaRows.map((q) => `${nb(wgKosaShown(recKou, q))}㎡`)),
        [`乙土地 ${nb(recOtsu)}㎡`].concat(kosaRows.map((q) => `${nb(wgKosaShown(recOtsu, q))}㎡`)),
      ],
    ) +
    `<p class="small" style="margin-top:6px">ア　〔市基準点成果表〕</p>` +
    exTable(["点名", "Ｘ座標（ｍ）", "Ｙ座標（ｍ）"], [
      ["Ｔ1", nb(T1[0]), nb(T1[1])],
      ["Ｔ2", nb(T2[0]), nb(T2[1])],
    ]) +
    `<p class="small" style="margin-top:6px">イ　〔測量によって得られた観測値〕</p>` +
    exTable(["器械点", "後視点", "測点", "観測角", "水平距離（ｍ）"], [
      ["Ｔ2", "Ｔ1", "Ｔ1", "0°00′00″", "－"],
      ["Ｔ2", "Ｔ1", "Ｂ", exDmsText(obsB.sec), nb(obsB.dist)],
      ["Ｔ2", "Ｔ1", "Ｄ", exDmsText(obsD.sec), nb(obsD.dist)],
    ]) +
    `<p class="small">（注）観測角は時計回りの角度を示す。北はＸ軸の正方向に一致する。</p>` +
    `<p class="small">ウ　〔測量によって得られた座標値〕（Ｂ点、Ｄ点、Ｐ点は省略）</p>` +
    exTable(["点名", "Ｘ座標（ｍ）", "Ｙ座標（ｍ）"],
      [["Ａ", A], ["Ｃ", C], ["Ｅ", E], ["Ｆ", F], ["Ｇ", G], ["Ｈ", H], ["Ｉ", I], ["Ｊ", J]].map(([n, p]) => [n, nb(p[0]), nb(p[1])]),
    );

  // 5. 設問の答え --------------------------------------------------------------------
  const needName = needKou ? "甲土地" : "乙土地";
  const needOwner = needKou ? ownerKou : ownerOtsu;
  const needAddr = needKou ? addrK : addrO;
  const needBun = needKou ? bunK : bunO;
  const needArea = needKou ? sKou : sOtsu;
  const needKosa = needKou ? kKou : kOtsu;
  const tol = 0.011;
  const tasks = [
    { label: "問1", q: `Ｂ点のＸ座標（Ｔ2から後視Ｔ1の方向角に観測角を加え、距離から求める）`, unit: "m", answer: B[0], tol, pts: 3, expl: `Ｔ2→Ｔ1の方向角に観測角${exDmsText(obsB.sec)}を加えた方向角と距離${nb(obsB.dist)}mから、X＝Ｔ2のX＋距離×cos(方向角)＝<b>${nb(B[0])}</b>。` },
    { label: "問1", q: `Ｂ点のＹ座標`, unit: "m", answer: B[1], tol, pts: 3, expl: `Y＝Ｔ2のY＋距離×sin(方向角)＝<b>${nb(B[1])}</b>。` },
    { label: "問1", q: `Ｄ点のＸ座標`, unit: "m", answer: D[0], tol, pts: 3, expl: `観測角${exDmsText(obsD.sec)}・距離${nb(obsD.dist)}mから同様に、X＝<b>${nb(D[0])}</b>。` },
    { label: "問1", q: `Ｄ点のＹ座標`, unit: "m", answer: D[1], tol, pts: 3, expl: `Y＝<b>${nb(D[1])}</b>。` },
    { label: "問1", q: `Ｐ点のＸ座標（直線ＢＣと直線ＤＪの交点）`, unit: "m", answer: P[0], tol: 0.02, pts: 4, expl: `直線ＢＣと道路境界線（直線ＤＪ）の2直線の方程式を連立して解く。X＝<b>${nb(P[0])}</b>。（Ｂ・Ｄを丸めた値で解くか否かで末位が動くため±0.02まで正解としている。）` },
    { label: "問1", q: `Ｐ点のＹ座標`, unit: "m", answer: P[1], tol: 0.02, pts: 4, expl: `連立方程式のY＝<b>${nb(P[1])}</b>。` },
    { label: "問2", q: `甲土地の地積（㎡。座標法で求積、0.01㎡未満切捨て）。多角形はＡ-Ｂ-Ｐ-Ｄ-Ｅ-Ｆ-Ｇ`, unit: "㎡", answer: sKou, tol: 0.05, pts: 4, expl: `甲土地は筆界ＢＰで乙土地と接するので、Ａ-Ｂ-Ｐ-Ｄ-Ｅ-Ｆ-Ｇの面積。宅地は0.01㎡未満を切り捨てる（規則100条）。答え：<b>${nb(sKou)}㎡</b>。` },
    { label: "問2", q: `乙土地の地積（㎡。多角形はＢ-Ｈ-Ｉ-Ｐ）`, unit: "㎡", answer: sOtsu, tol: 0.05, pts: 4, expl: `乙土地はＢ-Ｈ-Ｉ-Ｐの面積。答え：<b>${nb(sOtsu)}㎡</b>。` },
    { label: "問2", q: `地積更正が必要な土地（${needName}）の公差（㎡）。市街地地域の精度区分（甲二）の値を表から選ぶ`, unit: "㎡", answer: needKosa, tol: 0.005, pts: 3, expl: `市街地地域は精度区分甲二まで（規則10条4項1号）。登記記録上の地積${nb(needKou ? recKou : recOtsu)}㎡に対する甲二の値<b>${nb(needKosa)}㎡</b>。` },
  ];
  const yesAns = ["必要", "必要がある", "要", "あり"];
  const noAns = ["不要", "必要がない", "否", "なし"];
  const mk = (f) => Object.assign({ sheetNo: 0 }, f);
  const appForm = [
    mk({ label: "登記の目的", answer: ["土地地積更正登記", "地積更正登記"], hint: "不動産の種別から書く", pts: 2 }),
    mk({ label: "登記原因及びその日付", answer: ["錯誤", "③錯誤"], hint: "原因の書き方は準則73条。日付の要否も判断する", pts: 2 }),
    mk({ label: "申請人", answer: [needOwner, needAddr + needOwner], hint: "所有権の登記名義人", pts: 2 }),
    mk({ label: "添付情報（①）", answer: ["地積測量図"], hint: "ほかに代理権限証明情報", pts: 2 }),
    mk({ label: "添付情報（②）", slot: "attach", answer: ["代理権限証明情報", "委任状"], hint: "代理人による申請のとき", pts: 1 }),
    mk({ label: "登録免許税", answer: WG_NONTAX_ACCEPTS, hint: "課税の有無を判断する。不要のときは「不要」と記載", pts: 2 }),
    ..._wTochiSheet(shozai, [{ chiban: needBun, chimoku: "宅地", chiseki: needArea }]).map((f) => mk(f)),
    mk({ sheetNo: 2, label: "甲土地について地積更正の登記は（必要／不要）", answer: needKou ? yesAns : noAns, hint: `登記記録の地積と測量の地積の差を公差と比べる`, pts: 3 }),
    mk({ sheetNo: 2, label: "乙土地について地積更正の登記は（必要／不要）", answer: needKou ? noAns : yesAns, hint: `登記記録の地積と測量の地積の差を公差と比べる`, pts: 3 }),
    mk({ sheetNo: 2, label: "地積更正の登記の申請義務の有無（あり／なし）", answer: ["なし", "無"], hint: "地積更正は義務か任意か", pts: 2 }),
  ];

  const figure = {
    points: { A: A, B: B, C: C, D: D, E: E, F: F, G: G, H: H, I: I, J: J, P: P, T1: T1, T2: T2 },
    polys: [
      ["A", "B", "C", "D", "E", "F", "G"],
      ["B", "H", "I", "C"],
    ],
    lines: [["B", "P"]],
    revealPoints: ["B", "D", "P"],
    areaLabels: [
      { at: [(A[0] + E[0]) / 2, (A[1] + E[1]) / 2], text: `${bunK} ${nb(sKou)}㎡` },
      { at: [(B[0] + I[0]) / 2, (H[1] + I[1]) / 2], text: `${bunO} ${nb(sOtsu)}㎡` },
    ],
  };
  return {
    statement: html,
    coords: [],
    tasks: tasks,
    appForm: appForm,
    sheetTitles: { 0: `申請書（問3：${needName}の地積更正）`, 2: "問2（更正の要否・申請義務）" },
    figure: figure,
    figureChecks: wgFigChecks("chisekiSokuryo", [
      `筆界ＢＰ（Ｂ点から道路境界線上のＰ点まで）を示し、Ｐ点に点名を付した`,
      `移設前のＣ点ではなくＰ点を筆界点として記載した`,
      `基準点Ｔ1・Ｔ2の点名を記入した（座標値は不要）`,
      `隣接地の地番を記入した`,
      `${needName}（${needBun}）の地積測量図であり、地積更正の対象の土地を明示した`,
    ]),
    articleFill: null,
    verify: {
      kind: "exam-r6-land",
      pts: { A, B, C, D, E, F, G, H, I, J, P, T1, T2 },
      obs: { B: obsB, D: obsD },
      road: { slope, xJ, yJ },
      areas: { sKou, sOtsu },
      recorded: { recKou, recOtsu },
      kosa: { kKou, kOtsu },
      needKou: needKou,
      pexact: Pexact,
    },
  };
}

// ─────────── 令和5年度 第21問（土地）の型 ───────────
// 事案: 所有者が、乙土地の西側部分を借地人に売り、乙土地の東側の細長い部分（斜線部分）を甲土地と一筆にして
// 隣の店舗に売る。乙土地を分筆（地積更正が要るかは公差で判断）し、甲土地は地目を雑種地から宅地に変更して、
// 分筆した東側部分と合筆する。
// 設問: 筆界点の判断（地積測量図の点間距離との照合）、分筆線の端点B・Hの座標値、地積測量図（紙）、
//   甲土地の「地目変更・合筆」の申請書。
//
// 本試験の問5（地図作成事業での職権の分筆・合筆）は条文の穴埋めだが、ここでは出さない。
//
// 根拠: 法2条（地積測量図の定義）、法41条（合筆の制限）、規則35条7号（表題部の変更と合筆は一の申請情報で）、
//   令8条1項1号・規則（所有権の登記がある土地の合筆は登記識別情報）、令16条2項（印鑑証明書）、
//   準則68条3号（宅地）、準則73条（地目変更・更正の原因の冠記）、規則100条（地積の端数）、
//   法務局の記載例（合筆: 登録免許税は合筆後の土地1個につき1,000円、地目変更: ②③令和何年何月何日地目変更）。
function exBuildR5Land(rng) {
  // 1. 形状 -----------------------------------------------------------------
  const ya = exU(rng, 685, 695);
  const w1 = exU(rng, 10.4, 11.2); // AからCまでの東西
  const w2 = exU(rng, 13.5, 14.5); // CからDまでの東西
  const yc = exRound(ya + w1);
  const yd = exRound(yc + w2);
  const sl = exU(rng, 0.1, 0.14); // 北側筆界（A・C・Dは一直線）の傾き
  const xA = exU(rng, 698, 706);
  const A = [xA, ya];
  const C = [exRound(xA + sl * (yc - ya)), yc];
  const D = [exRound(xA + sl * (yd - ya)), yd];
  const xs = exU(rng, 679.5, 682);
  const G = [xs, yc];
  const I = [xs, ya];
  const F = [exRound(xs - exU(rng, 0.4, 0.6)), yc];
  const J = [exRound(xs - exU(rng, 0.1, 0.25)), ya];
  const E = [exRound(xs - exU(rng, 0.8, 1.4)), yd];
  // 乙土地の南側の筆界点は、F・Gのどちらか、I・Jのどちらか（地積測量図の点間距離で判断する）
  const useF = rng() < 0.5;
  const useJ = rng() < 0.5;
  const tF = useF ? F : G;
  const tI = useJ ? J : I;
  const dCF = exRound(exDist(C, F));
  const dCG = exRound(exDist(C, G));
  const dAI = exRound(exDist(A, I));
  const dAJ = exRound(exDist(A, J));
  if (Math.abs(dCF - dCG) < 0.1 || Math.abs(dAI - dAJ) < 0.1) return null;
  const recDCF = useF ? dCF : dCG; // 旧地積測量図に記録されている点間距離
  const recDAI = useJ ? dAJ : dAI;
  // 分筆線BH（Cの東西線CGと平行で、西へwだけ離れる）。BはAC上、HはtF-tI上。
  const w = wgStep(rng, 0.8, 1.6, 0.1);
  const tB = w / (yc - ya);
  const B = [exRound(C[0] - (C[0] - A[0]) * tB), exRound(yc - w)];
  const H = [exRound(tF[0] + (tI[0] - tF[0]) * tB), exRound(yc - w)];

  // 2. 面積と公差 ---------------------------------------------------------------
  const west = wgChiseki(wgArea([A, B, H, tI]), "宅地"); // 乙の西側（1番2）
  const east = wgChiseki(wgArea([B, C, tF, H]), "宅地"); // 乙の東側（斜線部分。新地番1番4）
  const sumOtsu = exRound(west + east);
  const needKousei = rng() < 0.5;
  const seido = "甲二"; // 市街地地域
  let recOtsu = sumOtsu;
  for (let i = 0; i < 3; i++) {
    const k = wgKosaShown(recOtsu, seido);
    const gap = needKousei ? k * exU(rng, 1.5, 2.8) : k * exU(rng, 0.1, 0.6);
    recOtsu = exRound(sumOtsu + (rng() < 0.5 ? -gap : gap));
  }
  const kOtsu = wgKosaShown(recOtsu, seido);
  const dOtsu = exRound(Math.abs(recOtsu - sumOtsu));
  // B・Hを丸めた値で求めた西側+東側と、乙全体を直接求積した値は最大0.2㎡ほど違うので、どちらで判断しても同じ結論になる余裕を取る
  if (needKousei ? dOtsu < kOtsu * 1.25 : dOtsu > kOtsu * 0.75) return null;
  // 甲土地: 雑種地の登記記録の地積は整数（規則100条）。宅地に変えると0.01㎡まで表す（地積が変わる）。
  const kouArea = wgArea([C, D, E, tF]);
  const kouZatsu = Math.floor(+kouArea.toFixed(6)); // 雑種地（10㎡超は1㎡未満切捨て）
  const kouTaku = wgChiseki(kouArea, "宅地");
  if (Math.abs(kouTaku - kouZatsu) < 0.01) return null; // 地積が変わらないと「③」が付かない
  const sumGappitsu = exRound(kouTaku + east);

  // 3. 当事者・場所・日付 ----------------------------------------------------------
  const owner = wgPerson(rng, "f");
  const shiho = wgPerson(rng);
  const lessee = wgPerson(rng, "m");
  const store = "株式会社" + wgPick(rng, ["桜", "楓", "梅", "松", "竹"]) + "ストア";
  const storeRep = wgPerson(rng, "m");
  const city = wgPick(rng, EX_CITIES);
  const town = wgPick(rng, EX_TOWNS) + wgPick(rng, EX_CHOME);
  const shozai = city + town;
  const base = wgInt(rng, 1, 9);
  const nKou = `${base}番1`;
  const nOtsu = `${base}番2`;
  const nEast = `${base}番4`; // 分筆後の東側（新地番）
  const addr = `${shozai.replace(/[一二三四]丁目/, "")}${wgPick(rng, EX_CHOME)}${wgInt(rng, 1, 9)}番地1`;
  const dMove = wgDate(rng);
  const dContract = exAddDays(dMove, -wgInt(rng, 120, 150)); // 売買契約
  const dDemo = exAddDays(dContract, wgInt(rng, 2, 4));
  const dBun = exAddDays(dContract, wgInt(rng, 120, 130)); // 乙の登記の申請
  const dDone = exAddDays(dBun, wgInt(rng, 38, 45)); // 工事完了・営業開始＝地目変更の日
  const dMort = exAddDays(dDone, 0); // 抵当権の抹消の申請（同日）
  const dApp = exAddDays(dDone, wgInt(rng, 24, 30));
  const bunIn = exAddDays(dBun, wgInt(rng, 8, 14));
  const nb = (v) => exNum(v);
  const mortYear = wgInt(rng, 10, 20);
  const T1 = [exRound(xs - exU(rng, 0.2, 0.6)), exRound(ya - exU(rng, 1.5, 2.5))];
  const T2 = [exRound(C[0] + exU(rng, 0.5, 1.2)), exRound(ya - exU(rng, 1.5, 2.5))];

  // 4. 問題文 ----------------------------------------------------------------------
  const kosaRows = ["甲一", "甲二", "甲三", "乙一", "乙二", "乙三"];
  const nameF = useF ? "Ｆ点" : "Ｇ点";
  const nameI = useJ ? "Ｊ点" : "Ｉ点";
  const html =
    `<p><b>【出題の趣旨】</b>土地家屋調査士${shiho}は、〔調査図素図〕に示す${shozai}${nKou}の土地（以下「甲土地」という。）、同${nOtsu}の土地（以下「乙土地」といい、甲土地と併せて「本件各土地」という。）の所有者である${owner}から、` +
    `本件各土地の表示に関する登記の相談を受け、【聴取結果の概要】のとおり事情を聴取し、必要となる表示に関する登記の申請手続の代理並びに調査及び測量の依頼を受け、【調査及び測量の結果の概要】のとおり調査及び測量を行ったうえ、必要となる表示に関する登記の申請を行った。</p>` +
    `<p class="small">〔調査図素図の注〕Ｂ点はＡ点とＣ点を結ぶ直線上にある。Ｈ点は${useF ? "Ｆ" : "Ｇ"}点と${useJ ? "Ｊ" : "Ｉ"}点を結ぶ直線上にある。${useJ ? "Ｊ" : "Ｉ"}点はＡ点と${useJ ? "Ｉ" : "Ｊ"}点を結ぶ直線上にある。</p>` +
    `<p><b>【問1】</b>次の文は、乙土地の南側の筆界点（イ地点・ロ地点）を判断するにあたって検討した事項である。（ア）から（エ）までに入る文言を答えなさい。（ウ）は「Ｆ点」又は「Ｇ点」、（エ）は「Ｉ点」又は「Ｊ点」が入る。</p>` +
    `<blockquote class="small" style="margin:6px 0 10px 8px;padding-left:10px;border-left:3px solid var(--border)">` +
    `地積測量図とは、（ア）の土地の地積に関する（イ）の結果を明らかにする図面であって、法務省令で定めるところにより作成されるものをいう。不動産登記規則において、地積測量図には、筆界の点間距離を記録することとなっている。` +
    `【調査及び測量の結果の概要】から、Ｃ点から（ウ）までの点間距離及びＡ点から（エ）までの点間距離を算出すると、これらと乙土地の分筆の際に提出された地積測量図に記録されている点間距離とが一致する。` +
    `したがって、イ地点における筆界点を（ウ）、ロ地点における筆界点を（エ）と判断した。</blockquote>` +
    `<p><b>【問2】</b>【聴取結果の概要】及び【調査及び測量の結果の概要】から、<b>Ｂ点及びＨ点の座標値</b>を求めなさい。</p>` +
    `<p><b>【問3】</b>${shiho}が${dBun.text}に申請した乙土地に関する登記の申請書に添付する<b>地積測量図</b>を、250分の1の縮尺で作図しなさい。（紙で作図し、採点後にチェック項目で確認する。）</p>` +
    `<p><b>【問4】</b>${shiho}が${dApp.text}に申請した甲土地に関する登記の申請書を完成させなさい。必要な土地の表示に関する登記が複数ある場合は、一の申請情報により申請するものとする。登録免許税の納付を要しないときは「不要」と記載する。</p>` +
    `<p class="small" style="margin-top:10px">（注）</p>` +
    [
      "本問における行為は全て適法に行われており、法律上必要な書類は全て適法に作成されているものとする。",
      "登記の申請は、書面申請の方法によってするものとする。",
      "座標値は、計算結果の小数点以下第3位を四捨五入し、小数点以下第2位までとすること。",
      "地積測量図は、250分の1の縮尺により作成すること。距離は小数点以下第3位を四捨五入し、小数点以下第2位までとすること。",
      "地積測量図には、各筆界点の座標値、平面直角座標系の番号又は記号、地積及びその求積方法並びに測量年月日は、記載することを要しない。",
      "市基準点の各点は、地積測量図にその地点を明示して点名を付して記載すること（座標値は不要）。",
      `乙土地を分筆する場合の分筆後の地番は、分筆後の土地のうち西側の土地を${nOtsu}とし、その余の土地については新地番を${nEast}として付番すること。`,
      "登記申請書に記載する地積について、小数点以下の端数が生じる場合には、提出済みの地積測量図に記載された端数を援用すること。",
    ]
      .map((t, i) => `<p class="small">${i + 1}　${t}</p>`)
      .join("") +
    `<p style="margin-top:14px"><b>【聴取結果の概要】</b></p>` +
    [
      `${addr}に住所を有する${owner}は、本件各土地を所有している。`,
      `${storeRep}が代表取締役を務める${store}は、隣接する3番1の土地を所有している。`,
      `${owner}は、平成${mortYear + 3}年から、${store}に対し、3番1の土地にある既存店舗の従業員のみが使用する駐車場として、甲土地を賃貸している。`,
      `${owner}は、平成${mortYear + 13}年から、${lessee}に対し、Ａ点、Ｃ点、${useF ? "Ｆ" : "Ｇ"}点、${useJ ? "Ｊ" : "Ｉ"}点及びＡ点を順次直線で結んだ範囲の土地（本件借地）を賃貸している。`,
      `${store}は、既存店舗の建替えに伴い、${owner}に対し、甲土地及び乙土地の東側の一部（Ｂ点、Ｃ点、${useF ? "Ｆ" : "Ｇ"}点、Ｈ点及びＢ点を順次結んだ範囲の部分。以下「斜線部分」という。）を新店舗の敷地として購入したい旨を申し出た。` +
        `${lessee}は、本件借地の賃借権の範囲を変更するよりも、本件借地の西側部分（Ａ点、Ｂ点、Ｈ点、${useJ ? "Ｊ" : "Ｉ"}点及びＡ点を順次結んだ範囲。以下「西側部分」という。）を購入したい旨を申し出たため、${owner}は${lessee}に西側部分を売却することを合意した。`,
      `${owner}は、${dContract.text}、${store}との間で甲土地及び斜線部分の土地を売却する契約を締結し、次の合意をした。なお、Ｂ点とＨ点を結ぶ直線は、Ｃ点と${useF ? "Ｆ" : "Ｇ"}点を結ぶ直線に平行で、その西側に<b>${nb(w)}ｍ</b>離れた直線である。` +
        `<br>①　${store}は、新店舗の新築工事と併せて、ブロック塀を撤去し、新たにＢ点とＨ点を結ぶ直線上にブロック塀を設置する工事を行う。` +
        `<br>②　工事完了後、${owner}は、甲土地及び斜線部分の土地を一筆の土地にしたうえで、一筆の土地について${owner}から${store}への所有権の移転の登記をする。`,
      `${store}は、${dDemo.text}から既存店舗の解体工事に着手し、${dDone.text}の前に新店舗の新築工事及び上記①の工事の全てを完了し、${dDone.text}に新店舗の営業が開始した。`,
      `甲土地及び斜線部分の土地は、新店舗を利用する者の車両や納品車両の駐車場として利用されているとともに、新店舗で販売する商品を屋外に陳列する展示販売所としても利用されている。`,
      `${owner}は、所有権の移転の登記を申請する前提として必要となる表示に関する登記を行うことを希望している。`,
      `${shiho}は、${dBun.text}、乙土地について必要な登記を申請し、当該登記は完了した。`,
      `${owner}は、${dMort.text}、甲土地について、順位1番の抵当権の抹消の登記を申請し、当該登記は完了した。その後、${shiho}は、${dApp.text}、甲土地及び斜線部分の土地について必要な登記を申請した。`,
      `${owner}は、本件各土地の登記識別情報を保有している。`,
    ]
      .map((t, i) => `<p>${i + 1}　${t}</p>`)
      .join("") +
    `<p style="margin-top:12px"><b>【調査及び測量の結果の概要】</b></p>` +
    `<p>1　資料に関する調査の結果　⑴　登記記録の抜粋</p>` +
    exTable(
      ["", "地番", "地目", "地積", "権利部"],
      [
        ["甲土地", nKou, "雑種地", `${kouZatsu}㎡`, `甲区：${addr}　${owner}。乙区：順位1番　抵当権設定（平成${mortYear + 3}年）`],
        ["乙土地", nOtsu, "宅地", `${nb(recOtsu)}㎡`, `甲区：${addr}　${owner}。乙区：登記事項なし`],
        ["3番1の土地", "3番1", "宅地", `${exNum(wgInt(rng, 800, 1100) + rng())}㎡`, `甲区：${store}`],
      ],
    ) +
    `<p class="small" style="margin-top:6px">⑵　地図等　本件各土地の地域には、不動産登記法第14条第1項の地図は備え付けられていないが、地図に準ずる図面が備え付けられている。本件各土地は、不動産登記規則第10条第2項第1号の<b>市街地地域</b>に属する。</p>` +
    `<p class="small">⑶　図面等　乙土地の分筆の際に提出された地積測量図が備え付けられており、筆界点の点間距離として「Ｃ点から乙土地の南東の筆界点まで<b>${nb(recDCF)}ｍ</b>」及び「Ａ点から乙土地の南西の筆界点まで<b>${nb(recDAI)}ｍ</b>」が記録されている。道路境界確認図も備え付けられており、現地の境界標と整合している。</p>` +
    `<p class="small">⑷　乙土地の地積測定の公差（登記記録上の地積 ${nb(recOtsu)}㎡ に対する値）</p>` +
    exTable(["区分"].concat(kosaRows), [[`乙土地`].concat(kosaRows.map((q) => `${nb(wgKosaShown(recOtsu, q))}㎡`))]) +
    `<p style="margin-top:8px">2　利用状況、境界標、立会い及び測量の結果</p>` +
    `<p class="small">⑴　Ａ点、Ｄ点、Ｅ点及び${useJ ? "Ｉ" : "Ｊ"}点にはコンクリート杭が、Ｃ点、${useF ? "Ｇ" : "Ｆ"}点、${useF ? "Ｆ" : "Ｇ"}点及び${useJ ? "Ｊ" : "Ｉ"}点には金属標が設置されている。全ての境界標に永続性がある。<br>` +
    `⑵　現地の境界標と登記所備付けの地積測量図及び道路境界確認図の成果は整合している。本件各土地の筆界は、備付けの地積測量図のとおりであることが確認され、${owner}の認識とも一致した。` +
    `甲土地及び乙土地と3番1の土地との筆界は、Ａ点、Ｃ点及びＤ点を順次結んだ直線であることが確認され、${storeRep}の認識とも一致した。<br>` +
    `⑶　${shiho}は、分割点であるＢ点及びＨ点に永続性のあるコンクリート杭を設置した。<br>` +
    `⑷　近傍の市基準点の点検測量を行い、許容誤差内にあることを確認した。成果表の値により測量を行い、次の座標値を得た。</p>` +
    exTable(["点名", "Ｘ座標（ｍ）", "Ｙ座標（ｍ）"], [
      ["Ｔ1（市基準点）", nb(T1[0]), nb(T1[1])],
      ["Ｔ2（市基準点）", nb(T2[0]), nb(T2[1])],
      ...[["Ａ", A], ["Ｃ", C], ["Ｄ", D], ["Ｅ", E], ["Ｆ", F], ["Ｇ", G], ["Ｉ", I], ["Ｊ", J]].map(([n, p]) => [n, nb(p[0]), nb(p[1])]),
    ]);

  // 5. 設問の答え ----------------------------------------------------------------------
  const tol = 0.011;
  const tasks = [
    { label: "問2", q: `Ｂ点のＸ座標（ＢはＡ点とＣ点を結ぶ直線上で、Ｙ座標はＣより${nb(w)}ｍ西）`, unit: "m", answer: B[0], tol, pts: 3, expl: `ＢＨはＣ-${useF ? "Ｆ" : "Ｇ"}と平行（Ｙ座標が一定）でＣの西${nb(w)}ｍ。Ｙ＝${nb(B[1])}。直線ＡＣ上の点なので、Ｙの比で内分して X＝<b>${nb(B[0])}</b>。` },
    { label: "問2", q: `Ｂ点のＹ座標`, unit: "m", answer: B[1], tol, pts: 2, expl: `Ｙ＝Ｃ点のＹ（${nb(C[1])}）−${nb(w)}＝<b>${nb(B[1])}</b>。` },
    { label: "問2", q: `Ｈ点のＸ座標（Ｈは直線${useF ? "Ｆ" : "Ｇ"}${useJ ? "Ｊ" : "Ｉ"}上でＹ座標はＢと同じ）`, unit: "m", answer: H[0], tol, pts: 3, expl: `Ｈは${nameF}と${nameI}を結ぶ直線上にあるので、Ｙ座標の比で内分して X＝<b>${nb(H[0])}</b>。` },
    { label: "問2", q: `Ｈ点のＹ座標`, unit: "m", answer: H[1], tol, pts: 2, expl: `ＢＨはＹ一定なので Y＝<b>${nb(H[1])}</b>。` },
    { label: "問3の前提", q: `分筆後の西側（${nOtsu}）の地積（㎡、座標法・0.01㎡未満切捨て）`, unit: "㎡", answer: west, tol: 0.05, pts: 3, expl: `Ａ-Ｂ-Ｈ-${useJ ? "Ｊ" : "Ｉ"}の面積。宅地なので0.01㎡未満を切り捨てる。答え：<b>${nb(west)}㎡</b>。` },
    { label: "問3の前提", q: `分筆後の東側（斜線部分、${nEast}）の地積（㎡）`, unit: "㎡", answer: east, tol: 0.05, pts: 3, expl: `Ｂ-Ｃ-${useF ? "Ｆ" : "Ｇ"}-Ｈの面積。答え：<b>${nb(east)}㎡</b>。` },
    { label: "問4の前提", q: `甲土地を宅地としたときの地積（㎡、座標法・0.01㎡未満切捨て）`, unit: "㎡", answer: kouTaku, tol: 0.05, pts: 3, expl: `甲土地はＣ-Ｄ-Ｅ-${useF ? "Ｆ" : "Ｇ"}の面積。雑種地の登記記録は1㎡未満を切り捨てた${kouZatsu}㎡だが、宅地に変更すると0.01㎡まで表す（規則100条）。答え：<b>${nb(kouTaku)}㎡</b>。` },
  ];

  const mk = (sheetNo, f) => Object.assign({ sheetNo: sheetNo }, f);
  const yen1000 = wgYenAccepts(1000);
  const genChange = [`②③${dDone.text}地目変更`, `②③${dDone.text} 地目変更`];
  const appForm = [
    mk(0, { label: "登記の目的", answer: ["土地地目変更・合筆登記", "土地地目変更合筆登記", "土地地目変更、合筆登記"], hint: "必要な登記を一の申請情報でまとめる。手続の順に並べる", pts: 3 }),
    mk(0, { label: "添付情報（①）", slot: "attach", answer: ["登記識別情報", "登記識別情報（又は登記済証）", "登記済証"], hint: "所有権の登記がある土地の合筆（令8条1項1号）。いずれか1筆分", pts: 2 }),
    mk(0, { label: "添付情報（②）", slot: "attach", answer: ["印鑑証明書"], hint: "所有権の登記名義人が申請するとき（令16条2項）。作成後3か月以内", pts: 2 }),
    mk(0, { label: "添付情報（③）", slot: "attach", answer: ["代理権限証明情報", "委任状"], hint: "代理人による申請のとき", pts: 1 }),
    mk(0, { label: "申請人", answer: [owner, addr + owner], hint: "所有権の登記名義人", pts: 2 }),
    mk(0, { label: "登録免許税", answer: yen1000, hint: "登録免許税法の課税の有無と個数を判断する。不要のときは「不要」と記載", pts: 3 }),
    mk(0, _wPre("tochiG", "所在", [shozai], 1)),
    mk(0, _wCell("tochiG", 0, "chiban", "1行目の地番", [nKou], 1, "変更前")),
    mk(0, _wCell("tochiG", 0, "chimoku", "1行目の地目", ["雑種地"], 1, "変更前")),
    mk(0, _wCell("tochiG", 0, "chiseki", "1行目の地積", wgChisekiAccepts(kouZatsu, "雑種地"), 1, "変更前（登記記録のとおり）")),
    mk(0, _wCell("tochiG", 1, "chimoku", "2行目の地目", ["宅地"], 3, "新店舗の敷地及びその維持・効用に必要な土地（準則68条3号）")),
    mk(0, _wCell("tochiG", 1, "chiseki", "2行目の地積", wgChisekiAccepts(kouTaku, "宅地"), 3, "宅地は0.01㎡まで")),
    mk(0, _wCell("tochiG", 1, "gen", "2行目の登記原因及びその日付", genChange, 3, "地目と地積が変わるので②③を冠記（準則73条）。地目変更の日は工事完了の日")),
    mk(0, _wCell("tochiG", 2, "chiban", "3行目の地番", [nEast], 2, "合筆する斜線部分（分筆で付した新地番）")),
    mk(0, _wCell("tochiG", 2, "chimoku", "3行目の地目", ["宅地"], 1, "")),
    mk(0, _wCell("tochiG", 2, "chiseki", "3行目の地積", wgChisekiAccepts(east, "宅地"), 2, "提出済みの地積測量図の端数を援用")),
    mk(0, _wCell("tochiG", 2, "gen", "3行目の登記原因及びその日付", [`${nKou}に合筆`], 3, "合筆により消滅する土地の原因（法務局の記載例）")),
    mk(0, _wCell("tochiG", 3, "chiban", "4行目の地番", [nKou], 2, "合筆後の土地")),
    mk(0, _wCell("tochiG", 3, "chimoku", "4行目の地目", ["宅地"], 1, "")),
    mk(0, _wCell("tochiG", 3, "chiseki", "4行目の地積", wgChisekiAccepts(sumGappitsu, "宅地"), 3, "合筆前の2筆の地積の合計")),
    mk(0, _wCell("tochiG", 3, "gen", "4行目の登記原因及びその日付", [`③${nEast}を合筆`], 3, "合筆後の土地の原因。地積が変わるので③（法務局の記載例）")),
    // 問1・判断の設問
    mk(3, { label: "（ア）地積測量図は何筆の土地の地積に関するものか", answer: ["一筆", "1筆"], hint: "法2条17号", pts: 1 }),
    mk(3, { label: "（イ）地積に関する何の結果を明らかにする図面か", answer: ["測量"], hint: "法2条17号", pts: 1 }),
    mk(3, { label: "（ウ）イ地点の筆界点（Ｆ点又はＧ点）", answer: [nameF, nameF.replace("点", "")], hint: "Ｃ点からの点間距離が地積測量図と一致する点", pts: 3 }),
    mk(3, { label: "（エ）ロ地点の筆界点（Ｉ点又はＪ点）", answer: [nameI, nameI.replace("点", "")], hint: "Ａ点からの点間距離が地積測量図と一致する点", pts: 3 }),
    mk(2, { label: "乙土地の分筆の登記と併せて、地積更正の登記は（必要／不要）", answer: needKousei ? ["必要", "必要がある", "要", "あり"] : ["不要", "必要がない", "否", "なし"], hint: "登記記録の地積と分筆後の地積の合計の差を公差（市街地地域＝甲二）と比べる", pts: 3 }),
    mk(2, { label: "地目変更と合筆を一の申請情報で申請できる根拠（規則の条数）", answer: ["規則35条7号", "35条7号", "不動産登記規則35条7号"], hint: "表題部の変更の登記と合筆の登記", pts: 3 }),
  ];

  const figure = {
    points: { A: A, B: B, C: C, D: D, E: E, F: F, G: G, H: H, I: I, J: J, T1: T1, T2: T2 },
    polys: [
      ["C", "D", "E", useF ? "F" : "G"],
      ["A", "C", useF ? "F" : "G", useJ ? "J" : "I"],
    ],
    lines: [["B", "H"]],
    revealPoints: ["B", "H"],
    areaLabels: [
      { at: [(A[0] + C[0]) / 2 - 8, (ya + yc - w) / 2], text: `${nOtsu} ${nb(west)}㎡` },
      { at: [(C[0] + E[0]) / 2, (yc + yd) / 2], text: `${nKou} ${nb(kouTaku)}㎡` },
    ],
  };
  return {
    statement: html,
    coords: [],
    tasks: tasks,
    appForm: appForm,
    sheetTitles: { 0: `申請書（問4：甲土地の地目変更・合筆）`, 2: "判断の設問", 3: "問1（筆界点の判断）" },
    figure: figure,
    figureChecks: wgFigChecks("chisekiSokuryo", [
      `分筆線ＢＨを記入し、Ｂ点・Ｈ点の符号を付した`,
      `分筆後の地番（西側${nOtsu}、東側${nEast}）を記入した`,
      `Ｂ点・Ｈ点の境界標（コンクリート杭）の種類を記入した`,
      `基準点Ｔ1・Ｔ2の点名を記入した（座標値は不要）`,
      `隣接地（3番1ほか）の地番を記入した`,
    ]),
    articleFill: null,
    verify: {
      kind: "exam-r5-land",
      pts: { A, B, C, D, E, F, G, H, I, J, T1, T2 },
      useF, useJ, w,
      dist: { dCF, dCG, dAI, dAJ, recDCF, recDAI },
      areas: { west, east, sumOtsu, kouZatsu, kouTaku, sumGappitsu },
      rec: { recOtsu, kOtsu },
      needKousei,
    },
  };
}

// ─────────── 令和5年度 第22問（建物）の型 ───────────
// 事案: 二世帯住宅として区分登記されている2戸の区分建物。増築・リフォームで内部がつながったため、
// 区分建物でない1個の建物にしたい（区分合併）。表題部の変更と建物の合併を一の申請情報で申請する。
// 設問: 合併の可否の説明の穴埋め、申請書（合併後の建物の表示）、建物図面・各階平面図（紙）、
//   新築時の表題登記の添付情報の穴埋め（規約を設定したことを証する情報）。
//
// 条文で確認できない言葉（「同一性が失われる」「滅失したとみる」）は問題文に書き込んで空欄にしていない。
//
// 根拠: 法54条1項3号（区分合併）、法56条（合併の制限）、準則86条2号（接続していない区分建物は合併できない）、
//   令8条1項3号・2項3号（合併の登記は所有権の登記がある建物の登記識別情報）、令16条2項（印鑑証明書）、
//   令別表十六の項（合併後の建物図面・各階平面図）、令別表十二の項ホ（敷地権が存しないときの添付情報）、
//   区分所有法22条1項（専有部分と敷地利用権の分離処分の禁止と規約の別段の定め）、
//   登録免許税法 別表第一 一(十三)ロ（建物の合併 合併後の個数1個につき1,000円）、
//   規則115条（床面積は区分建物でない建物は壁その他の区画の中心線）、準則82条1号（天井高1.5m未満の屋階）。
function exBuildR5Tatemono(rng) {
  // 1. 寸法（柱・壁の中心間。0.45mの倍数）------------------------------------
  const m = (a, b) => 0.45 * wgInt(rng, a, b);
  const Wb = m(22, 28); // 1階の外形 東西
  const Db = m(16, 20); // 1階の外形 南北
  const w1 = m(10, Wb / 0.45 - 10); // 1の1（世帯1）の東西
  const ex = m(6, 8); // 2階のリビング拡張（旧バルコニーの一部を増築）東西
  const ey = m(3, 5); // 同 南北
  // 2階（1の区分建物の上。リビングの増築部分を含む）が1階の外形に収まるように、2階の寸法は1階から決める
  const capW2 = Math.floor((Wb - ex - 0.45) / 0.45 + 1e-9);
  const W2 = m(Math.min(16, capW2), Math.min(20, capW2)); // 2階の外形 東西
  const capD2 = Math.floor((Db - 0.9) / 0.45 + 1e-9);
  const D2 = m(Math.min(14, capD2), Math.min(18, capD2)); // 2階の外形 南北
  const ax = m(6, 8); // 屋根裏部屋 東西
  const ay = m(6, 8);
  const atticH = wgPick(rng, [1.2, 1.3, 1.4]); // 天井高1.5m未満の屋階は算入しない（準則82条1号）
  const t = 0.15; // 壁の厚さ
  const floor1 = exFloor2(Wb * Db);
  const floor2 = exFloor2(W2 * D2 + ex * ey);
  // 区分建物としての従前の登記記録（内側線の面積）
  const old11a = exFloor2((w1 - t) * (Db - t));
  const old11b = exFloor2((W2 - t) * (D2 - t));
  const old12 = exFloor2((Wb - w1 - t) * (Db - t));
  // 土地（四角形）と建物の外壁から筆界までの距離
  const x0 = exU(rng, 40, 60);
  const y0 = exU(rng, 70, 80);
  const ow = wgStep(rng, 1.5, 2.5, 0.5); // 西側筆界から
  const os = wgStep(rng, 1.5, 2.5, 0.5); // 南側筆界から
  const lw = wgStep(rng, Math.ceil((Wb + ow + 1.5) * 2) / 2, Math.ceil((Wb + ow + 4) * 2) / 2, 0.5);
  const ld = wgStep(rng, Math.ceil((Db + os + 1.5) * 2) / 2, Math.ceil((Db + os + 4) * 2) / 2, 0.5);
  if (Wb + ow + 1 > lw || Db + os + 1 > ld) return null;
  // 2階（1の区分建物の上。リビングの増築部分を含む）が1階の外形に収まること
  if (D2 + 0.9 > Db || W2 + ex + 0.45 > Wb) return null;
  const A = [x0, y0];
  const B = [exRound(x0 + ld), y0];
  const C = [B[0], exRound(y0 + lw)];
  const D = [x0, C[1]];

  // 2. 当事者・場所・日付 ----------------------------------------------------------
  const sur = wgPick(rng, WG_SURNAME);
  const g1 = wgPick(rng, WG_GIVEN_M);
  const owner = sur + g1;
  const son = sur + wgPick(rng, WG_GIVEN_M.filter((x) => x !== g1));
  const builder = wgPick(rng, WG_SURNAME) + "建設株式会社";
  const city = wgPick(rng, EX_CITIES);
  const town = wgPick(rng, EX_TOWNS) + wgPick(rng, EX_CHOME);
  const baseNo = wgInt(rng, 2, 40);
  const sub = wgInt(rng, 2, 9);
  const shozaiTown = city + town;
  const shozaiBld = `${shozaiTown}${baseNo}番地${sub}`;
  const kaoku = `${baseNo}番${sub}`;
  const shiho = wgPerson(rng);
  const dDone = wgDate(rng);
  const dApp = exAddDays(dDone, wgInt(rng, 30, 60));
  const yearNew = wgInt(rng, 25, 30);
  const nb = (v) => exNum(v);

  // 3. 問題文 --------------------------------------------------------------------
  const html =
    `<p><b>【出題の趣旨】</b>${owner}は、自己の所有する${shozaiTown}${baseNo}番${sub}の土地（以下「本件土地」という。）上に、家屋番号${baseNo}番${sub}の1の区分建物（以下「1の区分建物」という。）及び${baseNo}番${sub}の2の区分建物（以下「2の区分建物」といい、併せて「本件各区分建物」という。）を新築し、所有している。` +
    `土地家屋調査士${shiho}は、【事実関係】のとおり${owner}から表示に関する登記の相談を受け、必要となる全ての表示に関する登記の申請手続の代理並びに調査及び測量の依頼を受け、現地の測量及び登記記録の調査をしたうえで、必要となる登記の申請を行った。` +
    `なお、本件土地及び本件各区分建物には、【登記記録】に記録されている権利以外の権利は存在しない。</p>` +
    `<p><b>【問1】</b>${shiho}は、${owner}から、「本件各区分建物を区分建物でない建物としたいが、どのような登記手続が可能なのか。」との質問を受けた。次の説明の（ア）（エ）（オ）に入る文言を答えなさい。</p>` +
    `<blockquote class="small" style="margin:6px 0 10px 8px;padding-left:10px;border-left:3px solid var(--border)">` +
    `今回、申請すべき登記は、区分建物の（ア）の登記となります。まず、本件工事の内容からすると、本件各区分建物の同一性が失われるものではないため、本件各区分建物が滅失したとみることはできません。` +
    `本件各区分建物は、所有権の登記名義人が相互に異なる建物ではなく、所有権等の登記以外の（エ）に関する登記のある建物でもありません。また、本件各区分建物は、主たる建物と附属建物の関係にはありませんが、互いに（オ）している建物です。` +
    `そのほかに区分建物の（ア）の登記を制限する事由はありません。そのため、本件各区分建物を区分建物ではない建物にするためには、（ア）の登記を申請すべきことになります。また、本件工事により建物の登記事項に変更が生じている場合には、建物の表題部の変更の登記を申請する必要があります。</blockquote>` +
    `<p><b>【問2】</b>${shiho}が${dApp.text}に申請した、本件各区分建物に関する表示に関する登記の申請書（合併後の建物の表示）を完成させなさい。登記の申請は一の申請情報によってし、建物の表題部の変更の登記に係る申請情報を先に記載する。登録免許税の納付を要しないときは「不要」と記載する。</p>` +
    `<p><b>【問3】</b>問2の申請書に添付する建物図面（500分の1）及び各階平面図（250分の1）を作図しなさい。（紙で作図し、採点後にチェック項目で確認する。）</p>` +
    `<p><b>【問4】</b>仮に、${shiho}が本件各区分建物の新築当時にその表題登記の申請の依頼を受けたとする。次の文は、そのときに提供したと考えられる添付情報とその理由を説明したものである。（①）から（⑤）までに入る文言を答えなさい。</p>` +
    `<blockquote class="small" style="margin:6px 0 10px 8px;padding-left:10px;border-left:3px solid var(--border)">` +
    `登記申請時に必要な添付情報は、建物図面、各階平面図、所有権を証する情報、住所を証する情報、代理権限を証する情報及び（①）があります。（①）が添付情報として必要な理由は、本件各区分建物の登記記録に、（②）が記録されていないので、専有部分とその専有部分に係る（③）とを（④）して（⑤）することができる旨を定めた（①）を、登記申請時に提供しなければならないためです。</blockquote>` +
    `<p class="small" style="margin-top:10px">（注）</p>` +
    [
      "本問における行為は全て適法に行われており、法律上必要な書類は全て適法に作成されているものとする。",
      "登記の申請は、書面申請の方法によってするものとする。",
      "建物図面は500分の1、各階平面図は250分の1の縮尺により作成すること。",
      "各階平面図に記載する距離は小数点以下第2位まで、建物図面に記載する距離は小数点以下第1位までとする。",
      `鉄骨は両側が被覆されており、壁の厚さは全ての部分で${nb(t)}メートルである。建物の隅部は全て直角である。数値は鉄骨の柱又は壁の中心間の距離を示す。`,
      "床面積は壁その他の区画の中心線で囲まれた部分の面積により、0.01㎡未満を切り捨てる（区分建物でない建物）。",
    ]
      .map((x, i) => `<p class="small">${i + 1}　${x}</p>`)
      .join("") +
    `<p style="margin-top:14px"><b>【事実関係】</b></p>` +
    [
      `${shozaiBld}に住所を有する${owner}は、相続により単独で所有権を取得した本件土地上に、平成${yearNew}年に二世帯住宅として本件各区分建物を新築し、所有している。本件各区分建物は、世帯ごとに区画された部分について区分建物として登記されている。`,
      `${owner}は2の区分建物に妻と二人で居住しており、${owner}の息子の${son}とその妻は、1の区分建物に居住している。`,
      `${son}の家族に子供が生まれたため、${owner}は、本件各区分建物について増築及びリフォーム工事（本件工事）を行い、その代金を全て支払った。`,
      `本件工事の概要は次のとおりである。<br>⑴　外に出ることなく1階と2階を往来できるように、施錠できる木製の扉を付けた。` +
        `<br>⑵　バルコニーとして使用していた部分の一部（東西${nb(ex)}ｍ×南北${nb(ey)}ｍ）を増築して、2階のリビングを拡張した。増築した部分の構造は軽量鉄骨造である。` +
        `<br>⑶　子供部屋を設けられるよう2階の間取りを変更した。` +
        `<br>⑷　陸屋根をスレートぶきの勾配屋根に変更した。` +
        `<br>⑸　物置として使用するための屋根裏部屋（東西${nb(ax)}ｍ×南北${nb(ay)}ｍ、<b>天井の高さ${nb(atticH)}ｍ</b>）を設置した。`,
      `本件工事は${dDone.text}に完了した。工事を請け負った${builder}は、同日、${owner}に本件各区分建物を引き渡した。`,
      `${owner}は、本件工事後に必要となる表示に関する登記手続をした。また、今後相続が発生したときに備えて、本件各区分建物を区分建物でない建物とすることを希望している。${owner}は、本件各区分建物の登記識別情報を保有している。`,
    ]
      .map((x, i) => `<p>${i + 1}　${x}</p>`)
      .join("") +
    `<p style="margin-top:12px"><b>【登記記録】</b>（工事前）</p>` +
    exTable(
      ["家屋番号", "種類", "構造", "床面積（区分建物は壁の内側線）", "原因"],
      [
        [`${kaoku}の1`, "居宅", "軽量鉄骨造2階建", `1階部分 ${nb(old11a)}㎡　2階部分 ${nb(old11b)}㎡`, `平成${yearNew}年新築`],
        [`${kaoku}の2`, "居宅", "軽量鉄骨造平家建", `${nb(old12)}㎡`, `平成${yearNew}年新築`],
      ],
    ) +
    `<p class="small">一棟の建物の表示：所在 ${shozaiBld}、構造 軽量鉄骨造陸屋根2階建。所有者：${shozaiBld}　${owner}（甲区は所有権保存のみ、乙区は登記事項なし）。` +
    `土地：${shozaiTown}${baseNo}番${sub}、宅地、233.00㎡。所有者 ${owner}（敷地権の登記はなく、本件各区分建物の登記記録には敷地権が記録されていない）。</p>` +
    `<p style="margin-top:8px"><b>【調査・測量】</b>（単位：ｍ）</p>` +
    exTable(
      ["部分", "東西", "南北", "備考"],
      [
        ["1階の外形（1の区分建物と2の区分建物を合わせた建物全体）", nb(Wb), nb(Db), `1の区分建物は西側の東西${nb(w1)}ｍ`],
        ["2階（1の区分建物の2階）", nb(W2), nb(D2), "増築前の外形"],
        ["2階 リビングの増築部分", nb(ex), nb(ey), "旧バルコニーの一部。2階に含める"],
        ["屋根裏部屋", nb(ax), nb(ay), `天井の高さ ${nb(atticH)}ｍ`],
      ],
    ) +
    `<p class="small">本件土地の筆界点の座標値（Ｘは北、Ｙは東）：Ａ(${nb(A[0])}, ${nb(A[1])})、Ｂ(${nb(B[0])}, ${nb(B[1])})、Ｃ(${nb(C[0])}, ${nb(C[1])})、Ｄ(${nb(D[0])}, ${nb(D[1])})。` +
    `建物の1階の外壁は、西側の筆界（ＡＢ）から${nb(ow)}ｍ、南側の筆界（ＡＤ）から${nb(os)}ｍの位置にある。</p>`;

  // 4. 設問の答え ----------------------------------------------------------------------
  const tasks = [
    { label: "問2", q: `合併後の建物（区分建物でない建物）の<b>1階</b>の床面積（㎡）`, unit: "㎡", answer: floor1, tol: 0.005, pts: 4, expl: `区分建物でない建物は壁その他の区画の<b>中心線</b>で囲まれた部分の面積（規則115条）。1階の外形${nb(Wb)}×${nb(Db)}＝<b>${nb(floor1)}㎡</b>。区分建物の内側線の面積（従前の登記記録）とは違う点に注意。` },
    { label: "問2", q: `合併後の建物の<b>2階</b>の床面積（㎡）`, unit: "㎡", answer: floor2, tol: 0.005, pts: 4, expl: `2階は${nb(W2)}×${nb(D2)}にリビングの増築部分${nb(ex)}×${nb(ey)}を加えた<b>${nb(floor2)}㎡</b>。屋根裏部屋は天井の高さが1.5ｍ未満の屋階なので算入しない（準則82条1号）。` },
  ];
  const mk = (sheetNo, f) => Object.assign({ sheetNo: sheetNo }, f);
  const appForm = [
    mk(0, { label: "登記の目的", answer: ["建物表題部変更・建物合併登記", "建物表題部変更、建物合併登記", "建物表題部変更建物合併登記", "建物表題部変更・建物区分合併登記"], hint: "必要な登記を一の申請情報でまとめる。表題部の変更を先に", pts: 3 }),
    mk(0, { label: "添付情報（①）", slot: "attach", answer: ["登記識別情報", "登記識別情報（又は登記済証）", "登記済証"], hint: "所有権の登記がある建物の合併（令8条1項3号）。いずれか1個分", pts: 2 }),
    mk(0, { label: "添付情報（②）", slot: "attach", answer: ["印鑑証明書"], hint: "登記識別情報を提供する申請（令16条2項）", pts: 2 }),
    mk(0, { label: "添付情報（③）", slot: "attach", answer: ["建物図面及び各階平面図", "建物図面、各階平面図", "建物図面・各階平面図", "各階平面図及び建物図面", "各階平面図、建物図面"], hint: "合併後の建物の図面（令別表十六の項イ）", pts: 2 }),
    mk(0, { label: "添付情報（④）", slot: "attach", answer: ["代理権限証明情報", "委任状"], hint: "代理人による申請のとき", pts: 1 }),
    mk(0, { label: "申請人", answer: [owner, shozaiBld + owner], hint: "所有権の登記名義人", pts: 2 }),
    mk(0, { label: "登録免許税", answer: wgYenAccepts(1000), hint: "登録免許税法 別表第一 で課税の有無と個数を判断する。不要のときは「不要」と記載", pts: 3 }),
    mk(0, _wPre("tatemono", "所在", [shozaiBld], 1)),
    mk(0, _wPre("tatemono", "家屋番号", [kaoku], 2)),
    mk(0, _wCell("tatemono", 0, "shurui", "合併後の種類", ["居宅"], 1, "")),
    mk(0, _wCell("tatemono", 0, "kozo", "合併後の構造", ["軽量鉄骨造スレートぶき2階建"], 3, "屋根は陸屋根からスレートぶきに変更（規則114条）")),
    mk(0, _wCell("tatemono", 0, "yuka", "合併後の床面積", wgFloorsAccepts([floor1, floor2]), 5, "壁の中心線で各階ごと。屋根裏部屋は算入しない")),
    mk(3, { label: "（ア）区分建物を1個の建物にする登記", answer: ["合併", "建物の合併", "区分合併", "建物の区分合併"], hint: "法54条1項3号", pts: 3 }),
    mk(3, { label: "（エ）所有権等の登記以外の何に関する登記のある建物でもないか", answer: ["権利", "権利に関する登記"], hint: "法56条5号", pts: 2 }),
    mk(3, { label: "（オ）区分建物の合併ができる関係", answer: ["接続", "接続している"], hint: "法54条1項3号・準則86条2号", pts: 2 }),
    mk(3, { label: "（①）敷地権が記録されていないときの添付情報", answer: ["規約証明書", "規約を設定したことを証する情報", "規約を証する情報", "規約"], hint: "令別表十二の項ホ", pts: 3 }),
    mk(3, { label: "（②）登記記録に記録されていないもの", answer: ["敷地権"], hint: "", pts: 2 }),
    mk(3, { label: "（③）専有部分と一体となる権利", answer: ["敷地利用権"], hint: "区分所有法22条1項", pts: 2 }),
    mk(3, { label: "（④）専有部分と敷地利用権とを何して処分するか", answer: ["分離"], hint: "区分所有法22条1項", pts: 2 }),
    mk(3, { label: "（⑤）分離して何することができる旨の規約か", answer: ["処分"], hint: "区分所有法22条1項ただし書", pts: 2 }),
  ];

  // 5. 図: 土地と、建物の1階（実線）・2階（点線）
  const bx = exRound(x0 + os + Db); // 建物の北西角のX（南が小さい。Xは北）
  const by = exRound(y0 + ow);
  const R1 = [[exRound(x0 + os), by], [bx, by], [bx, exRound(by + Wb)], [exRound(x0 + os), exRound(by + Wb)]];
  // 2階は本体（南北D2×東西W2）に、リビングの増築部分（南北ey×東西ex）がL字に付く
  const x2 = exRound(x0 + os + 0.45); // 1階の南の外壁から0.45ｍ内側に置く（D2＋0.9≦Db を生成時に確認済み）
  const R2 = [
    [x2, by],
    [exRound(x2 + D2), by],
    [exRound(x2 + D2), exRound(by + W2)],
    [exRound(x2 + ey), exRound(by + W2)],
    [exRound(x2 + ey), exRound(by + W2 + ex)],
    [x2, exRound(by + W2 + ex)],
  ];
  const figure = {
    points: { A: A, B: B, C: C, D: D },
    polys: [["A", "B", "C", "D"]],
    holes: [
      { poly: R1, label: "1階" },
      { poly: R2, label: "2階" },
    ],
    lines: [],
    revealPoints: [],
    areaLabels: [{ at: [x0 + os + Db / 2, by + Wb / 2], text: `1階 ${nb(floor1)}㎡` }],
  };
  return {
    statement: html,
    coords: [],
    tasks: tasks,
    appForm: appForm,
    sheetTitles: { 0: "申請書（問2：合併後の建物）", 3: "問1・問4（語句の空欄）" },
    figure: figure,
    figureChecks: [
      "建物図面は500分の1、各階平面図は250分の1で作図した（規則82条3項・83条2項）",
      "建物図面に方位、敷地の地番とその形状、隣接地の地番を記入した（規則82条2項）",
      "建物の1階の位置・形状を、筆界からの距離（小数第1位まで）で示した",
      "各階平面図に各階の別、各階の平面の形状、1階の位置を記入した（規則83条1項）",
      "各階ごとの建物の周囲の長さを、小数第2位まで記入した",
      "床面積及びその求積方法を各階ごとに記入した（壁の中心線による）",
      "2階にリビングの増築部分を含め、屋根裏部屋（天井高1.5m未満）を算入していない",
      "合併後は1個の建物として、区分建物の専有部分の区画線を記入していない",
    ],
    articleFill: null,
    verify: {
      kind: "exam-r5-tatemono",
      dims: { Wb, Db, w1, W2, D2, ex, ey, ax, ay, atticH, t },
      areas: { floor1, floor2, old11a, old11b, old12 },
      site: { A, B, C, D, ow, os },
      figure: { R1, R2 },
    },
  };
}

// ─────────── 令和4年度 第21問（土地）の型 ───────────
// 事案: 村落地域の1筆（本件土地）の所有者が、東側部分を隣の所有者に売る。東側部分の範囲は、
// 現地の基準点Ｔ1・Ｔ2からの観測で決めた点Ｐを基に、「Ｐを通り南の筆界に直交する線」で切る（Ｊ・Ｉ点）。
// 設問: Ｉ・Ｊの座標値、筆界特定の定義の穴埋め、分筆（地積更正が要るかは公差で判断）の申請書、地積測量図（紙）、
//   本人確認情報の留意点の穴埋め。
//
// 本試験は、これに隣地（185番3）との所有権界を合わせるための土地の一部の交換が加わり、分筆が3筆になる。
// 本型は交換を除き、東側の分筆（2筆）に絞った。分筆後の地番は問題文の指定どおり、最も東側を元の地番、
// その余を新地番とする。
//
// 根拠: 規則10条4項2号（村落・農耕地域の精度区分は乙一まで）、国土調査法施行令 別表第四（公差）、
//   法123条1号・2号（筆界・筆界特定の定義）、規則72条1項・2項（本人確認情報）、
//   登録免許税法 別表第一 一(十三)イ（分筆後の個数1個につき1,000円）、規則100条（地積）。
function exBuildR4Land(rng) {
  // 1. 形状（南の筆界BC上にG・C、東の筆界CD、北の筆界ED、西の筆界E-F-G）-------------------
  const xB = exU(rng, 270, 290);
  const yC = exU(rng, 295, 310);
  const C = [xB, yC];
  const yE = exRound(yC - exU(rng, 29, 31));
  const E = [exRound(xB + exU(rng, 17, 22)), yE];
  const D = [exRound(E[0] + exU(rng, 2.5, 3.5)), yC];
  const G = [xB, exRound(yE + exU(rng, 5.5, 7.5))];
  const F = [exRound(xB + exU(rng, 8, 10.5)), exRound(yE + exU(rng, 0, 0.12))];
  // 基準点と、売却する範囲の基準点P（観測値から求めさせる）
  const yP0 = exRound(yC - exU(rng, 8.5, 11));
  const northX = (y) => E[0] + ((D[0] - E[0]) * (y - yE)) / (yC - yE); // 北の筆界ED上のX
  const P0 = [exRound(northX(yP0) + exU(rng, 0.2, 0.6)), yP0];
  const T1 = [exRound(D[0] + exU(rng, 4, 7)), exRound(yC + exU(rng, 1.5, 3))];
  const T2 = [exRound(E[0] + exU(rng, 3, 8)), exRound(yE - exU(rng, 0.3, 1))];
  const b0 = exBearing(T1, T2);
  const alphaSec = Math.round((((exBearing(T1, P0) - b0 + 2 * Math.PI) % (2 * Math.PI)) * 180 * 3600) / Math.PI);
  const dObs = exRound(exDist(T1, P0));
  const bP = b0 + (alphaSec / 3600) * (Math.PI / 180);
  const P = [exRound(T1[0] + dObs * Math.cos(bP)), exRound(T1[1] + dObs * Math.sin(bP))];
  // J: 直線BCにPから下ろした垂線の足（BCはX一定の線）。I: 直線PJと直線EDの交点。
  const J = [xB, P[1]];
  const I = [exRound(northX(P[1])), P[1]];
  if (!(P[0] > I[0] + 0.05 && I[0] > J[0] + 8)) return null;

  // 2. 面積・公差 ------------------------------------------------------------------
  const polyAll = [E, D, C, G, F];
  const east = wgChiseki(wgArea([C, D, I, J]), "宅地"); // 売却する東側（元の地番184番1）
  const west = wgChiseki(wgArea([E, I, J, G, F]), "宅地"); // 西側の残り（新地番）
  const sumAfter = exRound(east + west);
  const needKousei = rng() < 0.5;
  const seido = "乙一"; // 村落・農耕地域（規則10条4項2号）
  let rec = sumAfter;
  for (let i = 0; i < 3; i++) {
    const k = wgKosaShown(rec, seido);
    const gap = needKousei ? k * exU(rng, 1.5, 2.8) : k * exU(rng, 0.1, 0.6);
    rec = exRound(sumAfter + (rng() < 0.5 ? -gap : gap));
  }
  const kRec = wgKosaShown(rec, seido);
  const direct = wgChiseki(wgArea(polyAll), "宅地");
  const diff1 = Math.abs(rec - sumAfter);
  const diff2 = Math.abs(rec - direct);
  // 西側＋東側と、全体を直接求積した値は丸めの分だけ違うので、どちらで判断しても同じ結論になる余裕を取る
  if (needKousei ? Math.min(diff1, diff2) < kRec * 1.25 : Math.max(diff1, diff2) > kRec * 0.75) return null;

  // 3. 当事者・場所 -----------------------------------------------------------------
  const owner = wgPerson(rng, "f");
  const buyer = wgPerson(rng, "f");
  const brother = wgPerson(rng, "m");
  const shiho = wgPerson(rng);
  const city = wgPick(rng, EX_CITIES);
  const azaName = ["八幡", "上原", "新田", "山根", "中島"][wgInt(rng, 0, 4)];
  const shozai = `${city}${wgPick(rng, ["B", "C", "D"])}字${azaName}`;
  const n0 = wgInt(rng, 100, 400);
  const nMain = `${n0}番1`;
  const nWest = `${n0}番3`; // 分筆後の西側（新地番）
  const addr = `${city}${wgPick(rng, ["C台", "D丘", "E原"])}${wgInt(rng, 100, 300)}番地${wgInt(rng, 1, 9)}`;
  const dApp = wgDate(rng);
  const dSale = exAddDays(dApp, -wgInt(rng, 20, 35));
  const nb = (v) => exNum(v);

  // 4. 問題文 -------------------------------------------------------------------------
  const kosaRows = ["甲一", "甲二", "甲三", "乙一", "乙二", "乙三"];
  const html =
    `<p><b>【出題の趣旨】</b>土地家屋調査士${shiho}は、〔調査図素図〕に示す${shozai}${nMain}の土地（以下「本件土地」という。）の所有者である${owner}から、筆界の調査に関する相談を受け、` +
    `【聴取結果の概要】のとおり事情を聴取し、必要となる表示に関する登記の申請手続の代理並びに調査及び測量の依頼を受け、【調査及び測量の結果の概要】のとおり調査及び測量を行ったうえ、${dApp.text}、必要となる表示に関する登記の申請を行った。</p>` +
    `<p class="small">〔調査図素図の注〕Ｉ点は、Ｅ点とＤ点を結ぶ直線上にある。Ｊ点は、Ｂ点とＣ点を結ぶ直線上にある（ＢはＣ・Ｇと同じ南側の筆界の線上の点）。</p>` +
    `<p><b>【問1】</b>【聴取結果の概要】及び【調査及び測量の結果の概要】から、<b>Ｉ点及びＪ点の座標値</b>を求めなさい。</p>` +
    `<p><b>【問2】</b>${shiho}は、${owner}から、「仮に、本件土地と隣の土地の筆界が明らかでない場合には、筆界特定制度を利用できると聞いたが、筆界特定とはどのようなものか。」との質問を受けた。次の説明の（ア）から（エ）までに入る文言を答えなさい。</p>` +
    `<blockquote class="small" style="margin:6px 0 10px 8px;padding-left:10px;border-left:3px solid var(--border)">` +
    `筆界特定とは、（ア）がある一筆の土地及びこれに（イ）する他の土地について、不動産登記法の定めるところにより、筆界の現地における（ウ）を特定すること（その（ウ）を特定することができないときは、その（ウ）の（エ）を特定すること）をいう。</blockquote>` +
    `<p><b>【問3】</b>${shiho}が申請した本件土地に関する登記の申請書を完成させなさい。必要な土地の表示に関する登記が複数ある場合は、一の申請情報により申請するものとする。` +
    `地積は座標法により求積し、その求積値と登記記録の地積の差が公差の範囲内であるときは、地積に関する表示の登記の申請は行わないものとする。</p>` +
    `<p><b>【問4】</b>問3の申請書に添付する<b>地積測量図</b>を、250分の1の縮尺で作図しなさい。（紙で作図し、採点後にチェック項目で確認する。）</p>` +
    `<p><b>【問5】</b>${shiho}は、${buyer}の兄である${brother}（以下「兄」という。）から、兄が所有権の登記名義人である二筆の土地について合筆の登記の申請手続の代理の依頼を受けたが、兄が申請情報と併せて提供すべき登記識別情報を失念していたため、兄と面談を行い、運転免許証の提示を受けたうえで、登記官に本人確認情報を提供することとした。` +
    `（${shiho}と兄は、依頼を受けるまで面識がなかったものとする。）次の文は、本人確認情報の作成に関する留意点である。（①）から（⑤）までに入る文言（（①）から（③）までは順不同）を答えなさい。</p>` +
    `<blockquote class="small" style="margin:6px 0 10px 8px;padding-left:10px;border-left:3px solid var(--border)">` +
    `本人確認情報は、${shiho}が兄と面談した（①）、（②）及び（③）を明らかにしなければならない。また、${shiho}と兄は面識がないことから、（④）を有する（⑤）であることを確認するために、兄から提示を受けた書類の内容及び兄が（④）を有する（⑤）であると認めた理由を明らかにしなければならない。</blockquote>` +
    `<p class="small" style="margin-top:10px">（注）</p>` +
    [
      "本問における行為は全て適法に行われており、法律上必要な書類は全て適法に作成されているものとする。",
      "登記の申請は、書面申請の方法によってするものとする。",
      "座標値は、計算結果の小数点以下第3位を四捨五入し、小数点以下第2位までとすること。",
      "地積測量図は、250分の1の縮尺により作成すること。距離は小数点以下第3位を四捨五入し、小数点以下第2位までとすること。",
      "地積測量図には、各筆界点の座標値、平面直角座標系の番号又は記号、地積及びその求積方法並びに測量年月日は、記載することを要しない。",
      "市基準点の各点は、地積測量図にその地点を明示して点名を付して記載すること（座標値は不要）。",
      `本件土地を分筆する場合の分筆後の地番は、分筆後の土地のうち最も東側の土地を${nMain}とし、その余の土地については新地番を${nWest}として付番すること。`,
    ]
      .map((t, i) => `<p class="small">${i + 1}　${t}</p>`)
      .join("") +
    `<p style="margin-top:14px"><b>【聴取結果の概要】</b></p>` +
    [
      `${addr}に住所を有する${owner}は、本件土地を所有している。`,
      `${buyer}は、本件土地の東側に隣接する土地を所有している。`,
      `${owner}は、本件土地上にあった建物を取り壊し、月極駐車場として利用している。`,
      `${buyer}は、${owner}に対し、本件土地のうち東側の部分（Ｃ、Ｄ、Ｉ、Ｊ及びＣの各点を順次直線で結んだ範囲。以下「東側部分」という。）を倉庫の敷地として使用したいと申し出た。そこで、${owner}は、${buyer}に対し、東側部分を売却することとした。`,
      `${owner}は、必要な立会い等を行ったうえで、${dSale.text}、本件土地上の柵を撤去し、Ｉ点とＪ点を結んだ直線上にブロック塀を設置して、${buyer}に東側部分を売却した。`,
      `${owner}は、東側部分についての所有権の移転の登記をする前提として必要となる表示に関する登記を行うことを希望している。`,
    ]
      .map((t, i) => `<p>${i + 1}　${t}</p>`)
      .join("") +
    `<p style="margin-top:12px"><b>【調査及び測量の結果の概要】</b></p>` +
    `<p>1　資料に関する調査の結果　⑴　登記記録（現在事項）</p>` +
    exTable(
      ["地番", "地目", "地積", "甲区（所有者）", "乙区"],
      [[nMain, "宅地", `${nb(rec)}㎡`, `${addr}　${owner}`, "（登記事項なし）"]],
    ) +
    `<p class="small" style="margin-top:6px">⑵　地図等　本件土地の地域には、不動産登記法第14条第1項の地図は備え付けられておらず、同条第4項の地図に準ずる図面が備え付けられている。本件土地の地域は、不動産登記規則第10条第2項第2号の<b>村落地域</b>に属する。</p>` +
    `<p class="small">⑶　図面等　本件土地については、過去の地積更正の登記の申請書に添付された地積測量図が備え付けられており、周辺の土地の分筆の地積測量図の辺長と、道路境界の用地実測図の辺長は一致している。` +
    `隣接地との筆界は、地積測量図の辺長の検証により、Ｅ、Ｆ及びＧの各点を順次結んだ線（西側）、Ｂ点・Ｇ点・Ｃ点を結んだ線（南側）、Ｃ点とＤ点を結んだ線（東側）、Ｅ点とＤ点を結んだ線（北側）と判断し、関係者の認識とも一致した。</p>` +
    `<p class="small">⑷　本件土地の地積測定の公差（登記記録上の地積 ${nb(rec)}㎡ に対する値。地域に応じた精度区分を選ぶ）</p>` +
    exTable(["区分"].concat(kosaRows), [["本件土地"].concat(kosaRows.map((q) => `${nb(wgKosaShown(rec, q))}㎡`))]) +
    `<p style="margin-top:8px">2　立会い及び測量の結果　⑴　${owner}と${buyer}は、東側部分の範囲を次のとおり決めた。` +
    `Ｐ点：Ｅ点とＤ点を結ぶ直線の北側の側溝の北側に、売却する部分を決める基準となる点を定め、ペンキで印を付けた。` +
    `Ｊ点：Ｂ点とＣ点を結ぶ直線と、Ｐ点を通りその直線に直交する直線との交点。` +
    `Ｉ点：Ｐ点とＪ点を結ぶ直線とＥ点とＤ点を結ぶ直線との交点。<br>` +
    `⑵　${shiho}は、${owner}と${buyer}の承諾を得て、Ｉ点にコンクリート杭を設置し、Ｊ点には金属標を設置した。Ｃ点には金属標が、Ｄ点にはコンクリート杭が設置されている。<br>` +
    `⑶　近傍の市基準点の点検測量を行い、許容誤差内にあることを確認した。成果表の値により測量を行い、観測値及び筆界点等の座標値を得た。</p>` +
    exTable(["点名", "Ｘ座標（ｍ）", "Ｙ座標（ｍ）"], [
      ["Ｔ1（市基準点）", nb(T1[0]), nb(T1[1])],
      ["Ｔ2（市基準点）", nb(T2[0]), nb(T2[1])],
    ]) +
    `<p class="small" style="margin-top:6px">〔測量によって得られた観測値〕</p>` +
    exTable(["器械点", "後視点", "測点", "観測角", "水平距離"], [
      ["Ｔ1", "Ｔ2", "Ｔ2", "0°00′00″", "―"],
      ["Ｔ1", "Ｔ2", "Ｐ", exDmsText(alphaSec), `${nb(dObs)}ｍ`],
    ]) +
    `<p class="small">（注）観測角は時計回りの角度を示す。北はＸ軸の正方向に一致する。</p>` +
    `<p class="small">〔測量によって得られた座標値〕（Ｉ点、Ｊ点、Ｐ点は省略）</p>` +
    exTable(["点名", "Ｘ座標（ｍ）", "Ｙ座標（ｍ）"],
      [["Ｂ", [xB, exRound(G[1] - exU(rng, 3, 6))]], ["Ｃ", C], ["Ｄ", D], ["Ｅ", E], ["Ｆ", F], ["Ｇ", G]].map(([n, p]) => [n, nb(p[0]), nb(p[1])]),
    );

  // 5. 設問の答え ----------------------------------------------------------------------
  const tol = 0.011;
  const tasks = [
    { label: "問1", q: `Ｉ点のＸ座標（Ｊを通る線とＥＤの交点）`, unit: "m", answer: I[0], tol: 0.02, pts: 4, expl: `まずＰ点を観測値から求める（Ｔ1→Ｔ2の方向角に観測角${exDmsText(alphaSec)}を加え、距離${nb(dObs)}ｍ）。Ｉ点はＰ点を通りＢＣに直交する直線（Ｙ＝${nb(P[1])}）と直線ＥＤの交点。X＝<b>${nb(I[0])}</b>。（丸めたＰで解くか否かで末位が動くため±0.02まで正解としている。）` },
    { label: "問1", q: `Ｉ点のＹ座標`, unit: "m", answer: I[1], tol, pts: 2, expl: `Ｉ点のＹはＰ点のＹと同じ<b>${nb(I[1])}</b>。` },
    { label: "問1", q: `Ｊ点のＸ座標`, unit: "m", answer: J[0], tol, pts: 2, expl: `ＪはＢＣ上の点で、ＢＣはＸ一定の線。Ｘ＝<b>${nb(J[0])}</b>。` },
    { label: "問1", q: `Ｊ点のＹ座標（Ｐ点のＹと同じ）`, unit: "m", answer: J[1], tol, pts: 4, expl: `ＪはＰから直線ＢＣに下ろした垂線の足なので、ＹはＰ点のＹ＝<b>${nb(J[1])}</b>。` },
    { label: "問3の前提", q: `分筆後の東側（${nMain}）の地積（㎡、座標法・0.01㎡未満切捨て）`, unit: "㎡", answer: east, tol: 0.05, pts: 3, expl: `Ｃ-Ｄ-Ｉ-Ｊの面積。宅地なので0.01㎡未満を切り捨てる（規則100条）。答え：<b>${nb(east)}㎡</b>。` },
    { label: "問3の前提", q: `分筆後の西側（${nWest}）の地積（㎡）`, unit: "㎡", answer: west, tol: 0.05, pts: 3, expl: `Ｅ-Ｉ-Ｊ-Ｇ-Ｆの面積。答え：<b>${nb(west)}㎡</b>。` },
  ];
  const mk = (sheetNo, f) => Object.assign({ sheetNo: sheetNo }, f);
  const yesAns = ["必要", "必要がある", "要", "あり"];
  const noAns = ["不要", "必要がない", "否", "なし"];
  const appForm = [
    mk(0, { label: "登記の目的", answer: needKousei ? ["土地地積更正・分筆登記", "土地地積更正分筆登記", "土地地積更正、分筆登記"] : ["土地分筆登記", "分筆登記"], hint: "必要な登記を一の申請情報でまとめる。手続の順に並べる", pts: 3 }),
    mk(0, { label: "添付情報（①）", slot: "attach", answer: ["地積測量図"], hint: "", pts: 2 }),
    mk(0, { label: "添付情報（②）", slot: "attach", answer: ["代理権限証明情報", "委任状"], hint: "", pts: 1 }),
    mk(0, { label: "申請人", answer: [owner, addr + owner], hint: "所有権の登記名義人", pts: 2 }),
    mk(0, { label: "登録免許税", answer: wgYenAccepts(2000), hint: "登録免許税法 別表第一 で課税の有無と個数を判断する。不要のときは「不要」と記載", pts: 3 }),
    ..._wTochiSheet(shozai, [
      { chiban: nMain, chimoku: "宅地", chiseki: east },
      { chiban: nWest, chimoku: "宅地", chiseki: west },
    ]).map((f) => mk(0, f)),
    mk(2, { label: "分筆と併せて地積更正の登記は（必要／不要）", answer: needKousei ? yesAns : noAns, hint: "登記記録の地積と分筆後の地積の合計の差を、地域に応じた精度区分の公差と比べる", pts: 3 }),
    mk(3, { label: "（ア）筆界特定の対象となる一筆の土地の状態", answer: ["表題登記", "表題登記がある"], hint: "法123条1号", pts: 1 }),
    mk(3, { label: "（イ）一筆の土地とどんな関係にある他の土地か", answer: ["隣接"], hint: "法123条1号", pts: 1 }),
    mk(3, { label: "（ウ）筆界の現地における何を特定するか", answer: ["位置"], hint: "法123条2号", pts: 1 }),
    mk(3, { label: "（エ）位置を特定できないときは、その位置の何を特定するか", answer: ["範囲"], hint: "法123条2号", pts: 1 }),
    mk(3, { label: "（①）〜（③）面談した…（順不同。「・」で区切る）", answer: ["日時・場所・状況", "日時、場所、状況", "日時、場所及び状況", "日時・状況・場所", "場所・日時・状況", "場所・状況・日時", "状況・日時・場所", "状況・場所・日時", "日時場所状況"], hint: "規則72条1項1号", pts: 3 }),
    mk(3, { label: "（④）確認する登記名義人の何を有するか", answer: ["申請の権限", "権限"], hint: "規則72条1項3号", pts: 2 }),
    mk(3, { label: "（⑤）申請の権限を有する者", answer: ["登記名義人"], hint: "規則72条1項3号", pts: 2 }),
  ];

  const figure = {
    points: { C: C, D: D, E: E, F: F, G: G, I: I, J: J, P: P, T1: T1, T2: T2 },
    polys: [["E", "D", "C", "G", "F"]],
    lines: [["I", "J"]],
    revealPoints: ["I", "J", "P"],
    areaLabels: [
      { at: [(C[0] + D[0] + I[0] + J[0]) / 4, (C[1] + D[1] + I[1] + J[1]) / 4], text: `${nMain} ${nb(east)}㎡` },
      { at: [(E[0] + G[0]) / 2, (E[1] + G[1] + F[1]) / 3 + 3], text: `${nWest} ${nb(west)}㎡` },
    ],
  };
  return {
    statement: html,
    coords: [],
    tasks: tasks,
    appForm: appForm,
    sheetTitles: { 0: "申請書（問3）", 2: "判断の設問", 3: "問2・問5（語句の空欄）" },
    figure: figure,
    figureChecks: wgFigChecks("chisekiSokuryo", [
      "分筆線ＩＪを記入し、Ｉ点・Ｊ点の符号を付した",
      `分筆後の地番（最も東側が${nMain}、西側が${nWest}）を記入した`,
      "Ｉ点のコンクリート杭・Ｊ点の金属標の種類を記入した",
      "基準点Ｔ1・Ｔ2の点名を記入した（座標値は不要）",
      "隣接地の地番を記入した",
    ]),
    articleFill: null,
    verify: {
      kind: "exam-r4-land",
      pts: { C, D, E, F, G, I, J, P, T1, T2, xB },
      obs: { alphaSec, dist: dObs },
      areas: { east, west, sumAfter, direct },
      rec: { rec, kRec },
      needKousei,
    },
  };
}

// ─────────── 令和4年度 第22問（建物）の型 ───────────
// 事案: 主である建物（平家）と附属建物（符号1、2階建）の間を増築して接続し、一体の建物にした。
// あわせて、同じ敷地に車庫を新築し、同じ登記記録に登記する。
// 設問: 申請書（主である建物の変更・符号1の抹消・車庫の新築）、建物の個数の基準（準則78条）の穴埋め、
//   民法242条（不動産の付合）の穴埋め、建物図面・各階平面図（紙）。
//
// 本試験の車庫は胴縁・被覆材の厚さから壁の位置を換算させるが、その換算の取扱いは条文で確認できないので、
// 本型の寸法は壁の中心線間の距離で与える。種類（用途）の変更も本型では扱わない。
//
// 根拠: 準則78条1項（効用上一体として利用される数棟の建物は所有者の意思に反しない限り1個の建物）、
//   準則95条（主たる建物と附属建物の合体の変更の登記の原因の書き方）、令別表十四の項ロ・ハ（添付情報）、
//   規則115条（床面積）、規則82条・83条（図面）、民法242条。
function exBuildR4Tatemono(rng) {
  // 1. 寸法（壁の中心線間。0.45mの倍数）-----------------------------------------
  const m = (a, b) => 0.45 * wgInt(rng, a, b);
  const dm = m(14, 18); // 主である建物の南北
  const wm = m(20, 26); // 同 東西
  const da = m(10, 12); // 符号1の附属建物の南北
  const wa = m(10, 13); // 同 東西
  const ge = m(4, 6); // 増築部分の東西（主と附属の間）
  const gd = m(8, Math.min(12, Math.floor(da / 0.45 + 1e-9))); // 同 南北（附属建物の南北以下）
  const has2F = rng() < 0.5; // 増築部分に2階があるか
  const cw = m(10, 13); // 車庫の東西
  const cd = m(8, 10); // 同 南北
  const main1 = exFloor2(dm * wm);
  const att1 = exFloor2(da * wa);
  const att2 = att1; // 附属建物の2階は1階と同形
  const add1 = exFloor2(ge * gd);
  const add2 = has2F ? add1 : 0;
  const after1 = exFloor2(dm * wm + ge * gd + da * wa); // 合体後の主である建物の1階
  const after2 = exFloor2(da * wa + (has2F ? ge * gd : 0)); // 同 2階
  const garage = exFloor2(cw * cd);
  // 土地と配置（建物は西から 主・増築・附属 の順に東西に並び、南の筆界から os の位置。車庫は北側に離して置く）
  const x0 = exU(rng, 40, 60);
  const y0 = exU(rng, 45, 55);
  const rowLen = wm + ge + wa;
  const ow = wgStep(rng, 1.5, 2.5, 0.5);
  const os = wgStep(rng, 1.5, 2.5, 0.5);
  const lw = wgStep(rng, Math.ceil((rowLen + ow + 2) * 2) / 2, Math.ceil((rowLen + ow + 5) * 2) / 2, 0.5);
  const ld = wgStep(rng, Math.ceil((dm + cd + os + 4) * 2) / 2, Math.ceil((dm + cd + os + 7) * 2) / 2, 0.5);
  if (cw + ow + 1 > lw) return null;
  const A = [x0, y0];
  const B = [exRound(x0 + ld), y0];
  const C = [B[0], exRound(y0 + lw)];
  const D = [x0, C[1]];

  // 2. 当事者・場所・日付 -----------------------------------------------------------
  const owner = wgPerson(rng, "f");
  const son = wgPerson(rng, "m");
  const builder = wgPick(rng, WG_SURNAME) + "建設株式会社";
  const shiho = wgPerson(rng);
  const city = wgPick(rng, EX_CITIES);
  const town = wgPick(rng, EX_TOWNS) + wgPick(rng, ["一丁目", "二丁目", "三丁目"]);
  const baseNo = wgInt(rng, 2, 30);
  const sub = wgInt(rng, 2, 9);
  const shozaiTown = city + town;
  const shozaiBld = `${shozaiTown}${baseNo}番地${sub}`;
  const kaoku = `${baseNo}番${sub}`;
  const dDone = wgDate(rng);
  const dApp = exAddDays(dDone, wgInt(rng, 14, 20));
  const yearOld = wgInt(rng, 15, 20);
  const nb = (v) => exNum(v);
  const struct = "木造スレートぶき2階建";
  const structGarage = "鉄骨造亜鉛メッキ鋼板ぶき平家建";
  const kindMain = "事務所";

  // 3. 問題文 -----------------------------------------------------------------------
  const html =
    `<p><b>【出題の趣旨】</b>${owner}は、${shozaiTown}${baseNo}番${sub}の土地（以下「本件土地」という。）及び本件土地上にある家屋番号${kaoku}の建物（以下「本件建物」という。）の所有者である。` +
    `${owner}は、本件建物の主である建物（以下「主である建物」という。）と符号1として登記されている附属建物（以下「本件附属建物」という。）の間を増築するなどの工事を行った結果、両建物は接続して一体として利用できる状態となった（当該工事で増築した部分を「本件増築部分」という。）。` +
    `また、${owner}は、本件土地上に車庫（以下「本件車庫」という。）を新築した。土地家屋調査士${shiho}は、【事実関係】のとおり${owner}から表示に関する登記の相談を受け、必要となる全ての表示に関する登記の申請手続の代理並びに調査及び測量の依頼を受け、` +
    `現地の測量及び【登記記録】のとおり登記記録等を調査したうえ、${dApp.text}に必要となる表示に関する登記の申請を行った。</p>` +
    `<p><b>【問1】</b>${shiho}が申請した本件建物及び本件車庫に関する登記の申請書を完成させなさい。</p>` +
    `<p><b>【問2】</b>${shiho}は、${owner}から、本件車庫の新築工事の前に、「仮に、${owner}が代表取締役を務める株式会社が本件車庫を新築し、所有者となった場合には、本件車庫はどのように登記されることになるか。」との質問を受けた。` +
    `次の説明の（ア）から（エ）までに入る文言を答えなさい。</p>` +
    `<blockquote class="small" style="margin:6px 0 10px 8px;padding-left:10px;border-left:3px solid var(--border)">` +
    `不動産登記事務取扱手続準則第78条第1項は、建物の個数の基準について、（ア）として利用される状態にある数棟の建物は、（イ）に反しない限り、（ウ）として取り扱うことを規定しています。` +
    `しかし、それぞれの建物の（エ）が異なる場合は、（ウ）として登記することはできないため、本件車庫は、本件建物とは別に表題登記をすることになります。</blockquote>` +
    `<p><b>【問3】</b>${shiho}は、${owner}から、本件建物の増築工事の前に、「仮に、${owner}の子である${son}が、主である建物と本件附属建物の間を自己の費用で増築する工事を行い、主である建物と本件附属建物が接続して一体として利用できる状態となった場合には、本件増築部分の所有権は誰が取得するか。」との質問を受けた。` +
    `次の文は、この質問に関係する民法の条文である。（①）から（④）までに入る文言を答えなさい。</p>` +
    `<blockquote class="small" style="margin:6px 0 10px 8px;padding-left:10px;border-left:3px solid var(--border)">` +
    `民法第242条　不動産の（①）は、その不動産に（②）として（③）した物の所有権を取得する。ただし、（④）によってその物を附属させた他人の権利を妨げない。</blockquote>` +
    `<p><b>【問4】</b>問1の申請書に添付する<b>建物図面（500分の1）及び各階平面図（250分の1）</b>を作図しなさい（主である建物の1階の平面形状・求積表は省略してよいが、他の階を示すときの1階の位置の表示は省略できない）。距離は、各階平面図は小数第2位まで、建物図面は小数第1位までとする。（紙で作図し、採点後にチェック項目で確認する。）</p>` +
    `<p class="small" style="margin-top:10px">（注）</p>` +
    [
      "本問における行為は全て適法に行われており、法律上必要な書類は全て適法に作成されているものとする。",
      "登記の申請は、書面申請の方法によってするものとする。",
      "建物図面は500分の1、各階平面図は250分の1の縮尺により作成すること。",
      "寸法は壁の中心線間の距離（単位：ｍ）である。各建物の隅部は全て直角で、天井までの高さは全て2.5ｍ以上である。",
      "床面積は壁その他の区画の中心線で囲まれた部分の面積により、0.01㎡未満を切り捨てる。",
    ]
      .map((t, i) => `<p class="small">${i + 1}　${t}</p>`)
      .join("") +
    `<p style="margin-top:14px"><b>【事実関係】</b></p>` +
    [
      `${owner}は、${shozaiBld}に住所を有し、本件土地及び本件建物を所有している。本件建物のうち主である建物は事務所として、本件附属建物は倉庫として、それぞれ利用されていた。`,
      `${owner}は、${builder}に対し、主である建物及び本件附属建物の全部の改装と、両建物の間の部分を増築して接続する工事（本件増築工事）を依頼した。本件増築工事は${dDone.text}に完了し、本件建物は${owner}に引き渡された。` +
        `本件増築工事の結果、本件増築部分（東西${nb(ge)}ｍ×南北${nb(gd)}ｍ、${has2F ? "1階及び2階" : "1階のみ"}）が増築されるとともに、主である建物と本件附属建物の相互の壁が取り払われ、両建物は接続して一体として利用できる状態となった。` +
        `本件増築部分の構成材料は主である建物と同様で、屋根はスレートぶきである。`,
      `また、${owner}は、${builder}に対し、本件増築工事の依頼と併せて、本件土地上に本件車庫（東西${nb(cw)}ｍ×南北${nb(cd)}ｍ、鉄骨造亜鉛メッキ鋼板ぶき平家建）を新築する工事を依頼した。本件新築工事は${dDone.text}に完了し、本件車庫は${owner}に引き渡された。`,
      `${owner}は、${dDone.text}、本件増築工事及び本件新築工事の材料費及び施工費等を${builder}に支払い、工事完了に伴う表示に関する登記に必要となる書類を受領した。`,
      `${owner}は、本件増築工事後の本件建物と新築した本件車庫を、同一の登記記録に登記することを希望している。`,
    ]
      .map((t, i) => `<p>${i + 1}　${t}</p>`)
      .join("") +
    `<p style="margin-top:12px"><b>【登記記録】</b></p>` +
    exTable(
      ["区分", "種類", "構造", "床面積", "原因及びその日付"],
      [
        [`主である建物（家屋番号${kaoku}）`, kindMain, "木造スレートぶき平家建", `${nb(main1)}㎡`, `平成${yearOld}年新築`],
        ["附属建物 符号1", "倉庫", "木造スレートぶき2階建", `1階 ${nb(att1)}㎡　2階 ${nb(att2)}㎡`, ""],
      ],
    ) +
    `<p class="small">所在：${shozaiBld}。所有者：${shozaiBld}　${owner}。</p>` +
    `<p style="margin-top:8px"><b>【調査図】</b>（単位：ｍ）</p>` +
    exTable(
      ["部分", "東西", "南北", "備考"],
      [
        ["主である建物（1階）", nb(wm), nb(dm), "西側に位置する"],
        ["本件増築部分", nb(ge), nb(gd), has2F ? "1階・2階" : "1階のみ"],
        ["本件附属建物（符号1）", nb(wa), nb(da), "1階・2階とも同形。東側に位置する"],
        ["本件車庫", nb(cw), nb(cd), "平家。本件建物の北側"],
      ],
    ) +
    `<p class="small">本件土地の筆界点の座標値（Ｘは北、Ｙは東）：Ａ(${nb(A[0])}, ${nb(A[1])})、Ｂ(${nb(B[0])}, ${nb(B[1])})、Ｃ(${nb(C[0])}, ${nb(C[1])})、Ｄ(${nb(D[0])}, ${nb(D[1])})。` +
    `建物（主・増築・附属を並べた外形）は、西側の筆界（ＡＢ）から${nb(ow)}ｍ、南側の筆界（ＡＤ）から${nb(os)}ｍの位置にある。</p>`;

  // 4. 設問の答え ----------------------------------------------------------------------
  const tasks = [
    { label: "問1", q: `増築後の主である建物の<b>1階</b>の床面積（㎡）。主である建物・増築部分・旧附属建物の1階を合わせた面積`, unit: "㎡", answer: after1, tol: 0.005, pts: 4, expl: `合体後は主である建物と附属建物が1個の主である建物になる。1階＝${nb(dm)}×${nb(wm)}＋増築${nb(ge)}×${nb(gd)}＋附属${nb(da)}×${nb(wa)}＝<b>${nb(after1)}㎡</b>（壁の中心線、規則115条）。` },
    { label: "問1", q: `増築後の主である建物の<b>2階</b>の床面積（㎡）`, unit: "㎡", answer: after2, tol: 0.005, pts: 4, expl: `2階＝旧附属建物の2階${nb(att2)}㎡` + (has2F ? `＋増築部分の2階${nb(add2)}㎡` : `（増築部分に2階はない）`) + `＝<b>${nb(after2)}㎡</b>。` },
    { label: "問1", q: `新築した本件車庫の床面積（㎡）`, unit: "㎡", answer: garage, tol: 0.005, pts: 3, expl: `${nb(cw)}×${nb(cd)}＝<b>${nb(garage)}㎡</b>。` },
  ];
  const mk = (sheetNo, f) => Object.assign({ sheetNo: sheetNo }, f);
  const causeMain = [`③${dDone.text}増築及び附属建物合体`, `②③${dDone.text}増築及び附属建物合体`];
  const appForm = [
    mk(0, { label: "登記の目的", answer: ["建物表題部変更登記", "建物表題部変更"], hint: "工事の結果に応じた登記の目的を書く", pts: 3 }),
    mk(0, { label: "申請人", answer: [owner, shozaiBld + owner], hint: "所有権の登記名義人", pts: 2 }),
    mk(0, { label: "添付情報（①）", slot: "attach", answer: ["建物図面及び各階平面図", "建物図面、各階平面図", "建物図面・各階平面図", "各階平面図及び建物図面", "各階平面図、建物図面"], hint: "", pts: 2 }),
    mk(0, { label: "添付情報（②）", slot: "attach", answer: ["所有権証明情報", "所有権を証する情報", "建築請負人の証明書"], hint: "", pts: 2 }),
    mk(0, { label: "添付情報（③）", slot: "attach", answer: ["代理権限証明情報", "委任状"], hint: "", pts: 1 }),
    mk(0, { label: "登録免許税", answer: ["不要", "非課税", "なし", "0円"], hint: "課税の有無を判断する。不要のときは「不要」と記載", pts: 1 }),
    mk(0, _wPre("tatemonoA", "所在", [shozaiBld], 1)),
    mk(0, _wPre("tatemonoA", "家屋番号", [kaoku], 1)),
    mk(0, _wCell("tatemonoA", 0, "shufuku", "1行目", ["主である建物", "主たる建物"], 1, "")),
    mk(0, _wCell("tatemonoA", 0, "shurui", "1行目の種類", [kindMain], 1, "")),
    mk(0, _wCell("tatemonoA", 0, "kozo", "1行目の構造", [struct], 2, "合体後は2階建")),
    mk(0, _wCell("tatemonoA", 0, "yuka", "1行目の床面積", wgFloorsAccepts([after1, after2]), 4, "各階ごと")),
    mk(0, _wCell("tatemonoA", 0, "gen", "1行目の登記原因及びその日付", causeMain, 3, "「令和何年何月何日増築及び附属建物合体」（準則95条）。床面積の変更なので③を冠記")),
    mk(0, _wCell("tatemonoA", 1, "shufuku", "2行目", ["符号1", "附属建物符号1", "1"], 1, "")),
    mk(0, _wCell("tatemonoA", 1, "gen", "2行目の登記原因及びその日付", [`${dDone.text}主たる建物に合体`, `${dDone.text}主である建物に合体`], 3, "合体により消える附属建物の原因（準則95条）")),
    mk(0, _wCell("tatemonoA", 2, "shufuku", "3行目", ["符号2", "附属建物符号2", "2"], 2, "新築した車庫は新たな附属建物。符号は従前の符号1に続ける")),
    mk(0, _wCell("tatemonoA", 2, "shurui", "3行目の種類", ["車庫"], 1, "")),
    mk(0, _wCell("tatemonoA", 2, "kozo", "3行目の構造", [structGarage], 2, "")),
    mk(0, _wCell("tatemonoA", 2, "yuka", "3行目の床面積", wgAreaAccepts(garage), 2, "")),
    mk(0, _wCell("tatemonoA", 2, "gen", "3行目の登記原因及びその日付", [`${dDone.text}新築`], 2, "")),
    mk(3, { label: "（ア）どのように利用される状態にある数棟の建物か", answer: ["効用上一体", "効用上一体として", "効用上"], hint: "準則78条1項", pts: 2 }),
    mk(3, { label: "（イ）何の意思に反しない限りか", answer: ["所有者の意思"], hint: "準則78条1項", pts: 2 }),
    mk(3, { label: "（ウ）数棟の建物はどう取り扱うか", answer: ["1個の建物", "一個の建物"], hint: "準則78条1項", pts: 2 }),
    mk(3, { label: "（エ）それぞれの建物の何が異なる場合か", answer: ["所有者"], hint: "所有者が異なれば1個の建物として登記できない", pts: 2 }),
    mk(3, { label: "（①）民法242条 不動産の何は", answer: ["所有者"], hint: "民法242条", pts: 1 }),
    mk(3, { label: "（②）その不動産に何として付合した物か", answer: ["従"], hint: "民法242条", pts: 1 }),
    mk(3, { label: "（③）従として何した物か", answer: ["付合"], hint: "民法242条", pts: 1 }),
    mk(3, { label: "（④）何によってその物を附属させた他人の権利を妨げないか", answer: ["権原"], hint: "民法242条ただし書", pts: 1 }),
  ];

  // 5. 図: 土地と建物（1階の外形。主・増築・附属を東西に並べる）、車庫
  const bx = exRound(x0 + os); // 建物の南側の外壁のX
  const by = exRound(y0 + ow);
  // 1階の外形: 主（南北dm×東西wm）・増築部分（gd×ge）・旧附属建物（da×wa）を西から東へ並べた形
  const R1 = [
    [bx, by],
    [exRound(bx + dm), by],
    [exRound(bx + dm), exRound(by + wm)],
    [exRound(bx + gd), exRound(by + wm)],
    [exRound(bx + gd), exRound(by + wm + ge)],
    [exRound(bx + da), exRound(by + wm + ge)],
    [exRound(bx + da), exRound(by + rowLen)],
    [bx, exRound(by + rowLen)],
  ];
  const gx = exRound(bx + dm + 1.5);
  const Gar = [[gx, by], [exRound(gx + cd), by], [exRound(gx + cd), exRound(by + cw)], [gx, exRound(by + cw)]];
  const figure = {
    points: { A: A, B: B, C: C, D: D },
    polys: [["A", "B", "C", "D"]],
    holes: [
      { poly: R1, label: "本件建物(1階)" },
      { poly: Gar, label: "本件車庫" },
    ],
    lines: [],
    revealPoints: [],
    areaLabels: [{ at: [bx + dm / 2, by + rowLen / 2], text: `1階 ${nb(after1)}㎡` }],
  };
  return {
    statement: html,
    coords: [],
    tasks: tasks,
    appForm: appForm,
    sheetTitles: { 0: "申請書（問1：本件建物及び本件車庫）", 3: "問2・問3（語句の空欄）" },
    figure: figure,
    figureChecks: [
      "建物図面は500分の1、各階平面図は250分の1で作図した（規則82条3項・83条2項）",
      "建物図面に方位、敷地の地番とその形状、隣接地の地番を記入した（規則82条2項）",
      "建物図面に、主である建物又は附属建物の別と附属建物の符号（車庫は符号2）を記入した",
      "建物の1階の位置・形状を、筆界からの距離（小数第1位まで）で示した",
      "各階平面図に各階の別、各階の平面の形状、1階の位置を記入した（規則83条1項）",
      "各階ごとの建物の周囲の長さを小数第2位まで記入し、床面積と求積方法を記入した",
      has2F ? "増築部分の2階を2階の床面積に含めた" : "増築部分には2階がないので、2階に含めていない",
      "合体後の主である建物（旧附属建物を含む）は、1個の建物として図示し、旧符号1の区画線を残していない",
    ],
    articleFill: null,
    verify: {
      kind: "exam-r4-tatemono",
      dims: { dm, wm, da, wa, ge, gd, has2F, cw, cd, ow, os },
      areas: { main1, att1, att2, add1, add2, after1, after2, garage },
      site: { A, B, C, D },
      figure: { R1, Gar },
    },
  };
}

// ─────────── 令和3年度 第21問（土地）の型 ───────────
// 事案: 相続した1筆（本件土地）を、遺産分割協議のとおり3筆（東の甲区画・中央の乙区画・西の丙区画）に分筆する。
// 道路境界は隅切りのある線で、南西の境界標Ｅが筆界線上にないため、筆界点Ｈ（直線ＡＢと直線ＦＥの交点）に移設する。
// 設問: Ａ・Ｃ・Ｈ・Ｌの座標値（観測値、隅切りの条件、直線の交点、平行の条件）、地図に準ずる図面の穴埋め、
//   分筆の申請書（相続人の一人が申請。地積更正が要るかは公差で判断）、地積測量図（紙）。
//
// 根拠: 法14条4項・5項（地図に準ずる図面）、規則28条2号（保存期間）、法30条（一般承継人による申請）、
//   令7条1項4号（一般承継を証する情報）、規則10条4項1号（市街地地域は甲二まで）、国土調査法施行令 別表第四（公差）、
//   登録免許税法 別表第一 一(十三)イ（分筆後の個数1個につき1,000円）、規則100条（地積）。
function exBuildR3Land(rng) {
  // 1. 道路境界線（A・H・I・K・B・Gは一直線）と、隅切り -----------------------------
  const m = exU(rng, -0.3, -0.22); // 道路線の傾き（Yが1増えるとXがm増える）
  const nr = Math.hypot(m, 1);
  const r = [m / nr, 1 / nr]; // 道路線に沿って東向き
  const ne = Math.hypot(1, -m);
  const e = [1 / ne, -m / ne]; // 道路線に直交して北向き（東側筆界の向き）
  const G = [exU(rng, 495, 500), exU(rng, 524, 528)];
  const s = 1.5 / Math.sin(Math.PI / 4); // 隅切長3.00m・直角のとき GB＝GC
  const at = (g) => [G[0] - g * r[0], G[1] - g * r[1]]; // Gから道路線に沿って西へgの点
  const mv = (p, v, d) => [p[0] + d * v[0], p[1] + d * v[1]];
  const B = at(s);
  const C = mv(G, e, s);
  const D = mv(G, e, exU(rng, 13, 15));
  const gK = s + exU(rng, 5.5, 7);
  const gI = gK + exU(rng, 8, 10);
  const gH = gI + exU(rng, 8, 10);
  const gA = gH + exU(rng, 3.5, 6);
  const H0 = at(gH);
  const A0 = at(gA);
  const Kp = at(gK);
  const Ip = at(gI);
  // 北側筆界FD（F・J・L・Dは一直線）
  const F = mv(H0, e, exU(rng, 13, 15));
  F[1] = exRound(F[1] + exU(rng, -0.4, 0.4));
  F[0] = exRound(F[0]);
  const lam = exU(rng, 0.3, 0.36);
  const J = [exRound(F[0] + (D[0] - F[0]) * lam), exRound(F[1] + (D[1] - F[1]) * lam)];
  const Bq = [exRound(B[0]), exRound(B[1])];
  const Dq = [exRound(D[0]), exRound(D[1])];
  const Gq = [exRound(G[0]), exRound(G[1])];
  const Iq = [exRound(Ip[0]), exRound(Ip[1])];
  const Kq = [exRound(Kp[0]), exRound(Kp[1])];
  // E: 直線FH上にあるが道路境界線上にはない杭（Hの位置に移設する）
  const uFH = (() => {
    const d = Math.hypot(F[0] - H0[0], F[1] - H0[1]);
    return [(F[0] - H0[0]) / d, (F[1] - H0[1]) / d];
  })();
  const eOff = exU(rng, 0.3, 0.9);
  const Eq = [exRound(H0[0] + eOff * uFH[0]), exRound(H0[1] + eOff * uFH[1])];
  // 観測: Aは基準点T1・T2から。真のA0を観測値に直し、丸めた観測値で再計算した値を正解にする。
  const T1 = [exRound(A0[0] - exU(rng, 3, 6)), exRound(A0[1] - exU(rng, 0.5, 2))];
  const T2 = [exRound(G[0] - exU(rng, 0.5, 1.5)), exRound(G[1] + exU(rng, 4.5, 6))];
  const bT = exBearing(T1, T2);
  const alphaSec = Math.round((((exBearing(T1, A0) - bT + 2 * Math.PI) % (2 * Math.PI)) * 180 * 3600) / Math.PI);
  const dA = exRound(exDist(T1, A0));
  const brA = bT + (alphaSec / 3600) * (Math.PI / 180);
  const A = [exRound(T1[0] + dA * Math.cos(brA)), exRound(T1[1] + dA * Math.sin(brA))];
  // Cは、Gを通る東側筆界上でGC＝GB（隅切剪除長が等しい）の点
  const lenGB = exDist(Gq, Bq);
  const uGD = (() => {
    const d = exDist(Gq, Dq);
    return [(Dq[0] - Gq[0]) / d, (Dq[1] - Gq[1]) / d];
  })();
  const Cx = [exRound(Gq[0] + lenGB * uGD[0]), exRound(Gq[1] + lenGB * uGD[1])];
  // H: 直線ABと直線FEの交点
  const inter = (p1, p2, p3, p4) => {
    const a1 = p2[1] - p1[1], b1 = p1[0] - p2[0], c1 = a1 * p1[0] + b1 * p1[1];
    const a2 = p4[1] - p3[1], b2 = p3[0] - p4[0], c2 = a2 * p3[0] + b2 * p3[1];
    const det = a1 * b2 - a2 * b1;
    return [(c1 * b2 - c2 * b1) / det, (a1 * c2 - a2 * c1) / det];
  };
  const Hx = inter(A, Bq, F, Eq);
  const H = [exRound(Hx[0]), exRound(Hx[1])];
  // L: Kを通りＩＪに平行な直線と、直線FDの交点
  const IJ = [J[0] - Iq[0], J[1] - Iq[1]];
  const Lx = inter(Kq, [Kq[0] + IJ[0], Kq[1] + IJ[1]], F, Dq);
  const L = [exRound(Lx[0]), exRound(Lx[1])];
  // 形状の健全性（道路線上の順序、各区画が正の面積）
  if (!(H[1] < Iq[1] - 3 && Iq[1] < Kq[1] - 3 && Kq[1] < Bq[1] - 3)) return null;
  if (!(F[1] < J[1] && J[1] < L[1] && L[1] < Dq[1])) return null;

  // 2. 面積・公差 ------------------------------------------------------------------
  const aHei = wgChiseki(wgArea([H, Iq, J, F]), "宅地"); // 丙（西）
  const aOtsu = wgChiseki(wgArea([Iq, Kq, L, J]), "宅地"); // 乙（中央）
  const aKou = wgChiseki(wgArea([Kq, Bq, Cx, Dq, L]), "宅地"); // 甲（東）
  const sumAfter = exRound(aHei + aOtsu + aKou);
  const whole = wgChiseki(wgArea([H, Bq, Cx, Dq, F]), "宅地");
  if (!(aHei > 20 && aOtsu > 20 && aKou > 20)) return null;
  const needKousei = rng() < 0.5;
  const seido = "甲二"; // 市街地地域
  let rec = sumAfter;
  for (let i = 0; i < 3; i++) {
    const k = wgKosaShown(rec, seido);
    const gap = needKousei ? k * exU(rng, 1.5, 2.8) : k * exU(rng, 0.1, 0.6);
    rec = exRound(sumAfter + (rng() < 0.5 ? -gap : gap));
  }
  const kRec = wgKosaShown(rec, seido);
  const d1 = Math.abs(rec - sumAfter);
  const d2 = Math.abs(rec - whole);
  if (needKousei ? Math.min(d1, d2) < kRec * 1.25 : Math.max(d1, d2) > kRec * 0.75) return null;

  // 3. 当事者・場所 -----------------------------------------------------------------
  const sur = wgPick(rng, WG_SURNAME);
  const gs = WG_GIVEN_M.slice();
  const take = () => {
    const g = gs.splice(wgInt(rng, 0, gs.length - 1), 1)[0];
    return sur + g;
  };
  const deceased = take();
  const heir1 = take();
  const heir2 = take(); // 申請人（乙区画を相続）
  const heir3 = take();
  const shiho = wgPerson(rng);
  const city = wgPick(rng, EX_CITIES);
  const town = wgPick(rng, EX_TOWNS) + wgPick(rng, ["一丁目", "二丁目", "三丁目"]);
  const shozai = city + town;
  const base = wgInt(rng, 5, 60);
  const k8 = wgInt(rng, 3, 8);
  const nKou = `${base}番${k8}`;
  const nOtsu = `${base}番1`;
  const nHei = `${base}番${k8 + 1}`;
  const addr2 = `${shozai}${base}番1号`;
  const dDeath = wgDate(rng);
  const dSplit = exAddDays(dDeath, wgInt(rng, 140, 160));
  const nb = (v) => exNum(v);

  // 4. 問題文 -------------------------------------------------------------------------
  const kosaRows = ["甲一", "甲二", "甲三", "乙一", "乙二", "乙三"];
  const html =
    `<p><b>【出題の趣旨】</b>土地家屋調査士${shiho}は、〔調査図素図〕に示す${shozai}${nOtsu}の土地（以下「本件土地」という。）の所有者亡${deceased}の相続人である${heir2}から、本件土地の表示に関する登記に関する相談を受け、` +
    `【聴取記録の概要】のとおり事情を聴取し、必要となる表示に関する登記の申請手続の代理並びに調査及び測量の依頼を受け、【調査及び測量の結果の概要】のとおり調査及び測量を行った。</p>` +
    `<p class="small">〔調査図素図の注〕Ｂ・Ｃ・Ｄ・Ｆ・Ｈ点は筆界点で、実線は筆界線。Ｉ点とＪ点を結ぶ直線とＫ点とＬ点を結ぶ直線は平行。Ｇ点は、Ａ点とＢ点を結ぶ直線の延長線とＤ点とＣ点を結ぶ直線の延長線の交点で、隅切長（Ｂ点とＣ点を結ぶ直線の長さ）は3.00ｍ、隅切剪除長（Ｇ点とＢ点を結ぶ直線の長さとＧ点とＣ点を結ぶ直線の長さ）は等しい。` +
    `道路境界は、Ａ点、Ｂ点、Ｃ点及びＤ点を順次結んだ線。南側の道路境界上にＡ・Ｈ・Ｉ・Ｋ・Ｂは一直線に並ぶ。</p>` +
    `<p><b>【問1】</b>【聴取記録の概要】及び【調査及び測量の結果の概要】から、図上の<b>Ａ点、Ｃ点、Ｈ点及びＬ点の座標値</b>を求めなさい。</p>` +
    `<p><b>【問2】</b>${shiho}は、${heir2}に対して「地図に準ずる図面」について説明した。（ア）から（カ）までに入る文言（（イ）から（エ）までは順不同）を答えなさい。</p>` +
    `<blockquote class="small" style="margin:6px 0 10px 8px;padding-left:10px;border-left:3px solid var(--border)">` +
    `地図に準ずる図面は、（ア）に地図が備え付けられるまでの間、これに代えて（ア）に備え付けることとされている図面で、一筆又は二筆以上の土地の（イ）、（ウ）及び（エ）が表示されています。` +
    `登記官が新たな地図を備え付けた場合には、従前の地図に準ずる図面の全部又は一部は（オ）されることになります。（オ）された地図に準ずる図面の保存期間は（カ）とされています。</blockquote>` +
    `<p><b>【問3】</b>依頼を受けた本件土地の登記の申請書を完成させなさい。必要な土地の表示に関する登記が複数ある場合は、一の申請情報により申請するものとする。` +
    `地積は、測量の結果である座標値を用いて座標法により求積するものとし、その求積値と登記記録の地積の差が公差の範囲内であるときは、地積に関する表示の登記の申請は行わないこととする。</p>` +
    `<p><b>【問4】</b>問3の申請書に添付する<b>地積測量図</b>を、250分の1の縮尺で作図しなさい。（紙で作図し、採点後にチェック項目で確認する。）</p>` +
    `<p class="small" style="margin-top:10px">（注）</p>` +
    [
      "本問における行為は全て適法に行われており、法律上必要な書類は全て適法に作成されているものとする。",
      "登記の申請は、書面申請の方法によってするものとする。",
      "座標値は、計算結果の小数点以下第3位を四捨五入し、小数点以下第2位まで記載すること。",
      "地積測量図は、250分の1の縮尺により作成すること。距離は小数点以下第3位を四捨五入し、小数点以下第2位まで記載すること。",
      "地積測量図には、各筆界点の座標値、平面直角座標系の番号又は記号、地積及びその求積方法並びに測量年月日は、記載することを要しない。",
      "市基準点の各点は、地積測量図にその地点を明示して点名を付して記載すること（座標値は不要）。",
    ]
      .map((t, i) => `<p class="small">${i + 1}　${t}</p>`)
      .join("") +
    `<p style="margin-top:14px"><b>【聴取記録の概要】</b></p>` +
    [
      `${addr2}に住所を有する${heir2}は、本件土地にある家屋番号${nOtsu}の建物（以下「本件建物」という。）に居住している。`,
      `本件土地は、周囲をブロック塀で囲まれており、本件建物より西側部分は庭として、東側部分は庭及び本件建物の居住者の駐車場として使用されている。`,
      `${deceased}は、${dDeath.text}に死亡した。${deceased}の相続人は、いずれも${deceased}の子である${heir1}、${heir2}及び${heir3}の3名のみである。`,
      `${heir1}の住所はＭ市Ｄ町五丁目2番2号であり、${heir3}の住所はＳ市Ｄ町一丁目3番5号である。`,
      `${heir1}、${heir2}及び${heir3}は、${dSplit.text}、遺産分割協議を行った結果、本件土地のうち東側部分（Ｂ、Ｃ、Ｄ、Ｌ、Ｋ及びＢの各点を順次直線で結んだ部分。「甲区画」）を${heir1}が、中央部分（Ｉ、Ｋ、Ｌ、Ｊ及びＩの各点を順次直線で結んだ部分。「乙区画」）を${heir2}が、西側部分（Ｈ、Ｉ、Ｊ、Ｆ及びＨの各点を順次直線で結んだ部分。「丙区画」）を${heir3}が、それぞれ相続することを決め、遺産分割協議書を作成した。`,
      `${heir2}は、乙区画に抵当権を設定して融資を受けるために、本件土地について必要となる表示に関する登記をすることを希望している。当該登記の申請は、${heir2}のみが申請人となってすることとなった。`,
    ]
      .map((t, i) => `<p>${i + 1}　${t}</p>`)
      .join("") +
    `<p style="margin-top:12px"><b>【調査及び測量の結果の概要】</b></p>` +
    `<p>1　資料に関する調査の結果　⑴　本件土地の登記記録（現在事項）</p>` +
    exTable(
      ["地番", "地目", "地積", "甲区（所有者）", "乙区"],
      [[nOtsu, "宅地", `${nb(rec)}㎡`, `${addr2}　${deceased}`, "（登記事項なし）"]],
    ) +
    `<p class="small" style="margin-top:6px">⑵　地図等　本件土地の地域には、不動産登記法第14条第1項の地図は備え付けられておらず、地図に準ずる図面が備え付けられている。本件土地の地域は、不動産登記規則第10条第2項第1号の<b>市街地地域</b>に属する。</p>` +
    `<p class="small">⑶　図面等　隣接地（${base}番2の土地）については、地積更正の際に提出された地積測量図が備え付けられている。</p>` +
    `<p class="small">⑷　道路境界　道路管理課に問い合わせたところ、本件土地と道路の境界は、Ａ点、Ｂ点、Ｃ点及びＤ点を順次結んだ直線と確認されていた（道路境界確認図）。</p>` +
    `<p class="small">⑸　分筆の予定地番　登記所において、甲区画を${nKou}、乙区画を${nOtsu}、丙区画を${nHei}とする予定地番の確認を行った。</p>` +
    `<p class="small">⑹　本件土地の地積測定の公差（登記記録上の地積 ${nb(rec)}㎡ に対する値。地域に応じた精度区分を選ぶ）</p>` +
    exTable(["区分"].concat(kosaRows), [["本件土地"].concat(kosaRows.map((q) => `${nb(wgKosaShown(rec, q))}㎡`))]) +
    `<p style="margin-top:8px">2　立会い等　⑴　Ｅ点にはコンクリート杭が設置されているが、本件土地と道路との境界線上に位置していなかった。` +
    `そこで、本件土地、隣接地及び道路の筆界点を、Ａ点とＢ点を結んだ直線とＦ点とＥ点を結んだ直線の延長線の交点（Ｈ点）とすると、隣接地の地積測量図の内容と一致するため、Ｈ点を筆界点と判断し、隣接地の所有者の合意のもと、Ｅ点の杭をＨ点の位置に移設した。` +
    `分割予定であるＩ点、Ｊ点、Ｋ点及びＬ点にコンクリート杭を設置した。<br>` +
    `⑵　測量の成果　市基準点Ｔ1、Ｔ2の点検測量を行い、許容誤差内であることを確認した。</p>` +
    exTable(["点名", "Ｘ座標（ｍ）", "Ｙ座標（ｍ）"], [
      ["Ｔ1（基準点）", nb(T1[0]), nb(T1[1])],
      ["Ｔ2（基準点）", nb(T2[0]), nb(T2[1])],
    ]) +
    `<p class="small" style="margin-top:6px">〔観測値〕</p>` +
    exTable(["器械点", "測点", "水平角", "水平距離（ｍ）"], [
      ["Ｔ1", "Ｔ2", "0°00′00″", "―"],
      ["Ｔ1", "Ａ", exDmsText(alphaSec), nb(dA)],
    ]) +
    `<p class="small">（注）観測角は時計回りの角度を示す。北はＸ軸の正方向に一致する。</p>` +
    `<p class="small">〔測量によって得られた座標値〕（Ａ点、Ｃ点、Ｈ点、Ｌ点は省略）</p>` +
    exTable(["名称", "Ｘ座標（ｍ）", "Ｙ座標（ｍ）"],
      [["Ｂ", Bq], ["Ｄ", Dq], ["Ｅ", Eq], ["Ｆ", F], ["Ｇ", Gq], ["Ｉ", Iq], ["Ｊ", J], ["Ｋ", Kq]].map(([n, p]) => [n, nb(p[0]), nb(p[1])]),
    );

  // 5. 設問の答え ----------------------------------------------------------------------
  const tol = 0.02;
  const tasks = [
    { label: "問1", q: `Ａ点のＸ座標（基準点Ｔ1の観測値から）`, unit: "m", answer: A[0], tol, pts: 3, expl: `Ｔ1→Ｔ2の方向角に観測角${exDmsText(alphaSec)}を加えた方向角と距離${nb(dA)}ｍから、X＝<b>${nb(A[0])}</b>。` },
    { label: "問1", q: `Ａ点のＹ座標`, unit: "m", answer: A[1], tol, pts: 3, expl: `Y＝<b>${nb(A[1])}</b>。` },
    { label: "問1", q: `Ｃ点のＸ座標（Ｇを通る東側筆界上で、ＧＣ＝ＧＢ）`, unit: "m", answer: Cx[0], tol, pts: 4, expl: `隅切剪除長が等しいのでＧＣ＝ＧＢ＝${nb(lenGB)}ｍ。Ｇ→Ｄの方向に${nb(lenGB)}ｍ進んだ点。X＝<b>${nb(Cx[0])}</b>。` },
    { label: "問1", q: `Ｃ点のＹ座標`, unit: "m", answer: Cx[1], tol, pts: 3, expl: `Y＝<b>${nb(Cx[1])}</b>。` },
    { label: "問1", q: `Ｈ点のＸ座標（直線ＡＢと直線ＦＥの交点）`, unit: "m", answer: H[0], tol, pts: 4, expl: `2直線の方程式を連立して解く。X＝<b>${nb(H[0])}</b>。（Ａを丸めて解くため±0.02まで正解としている。）` },
    { label: "問1", q: `Ｈ点のＹ座標`, unit: "m", answer: H[1], tol, pts: 3, expl: `連立方程式のY＝<b>${nb(H[1])}</b>。` },
    { label: "問1", q: `Ｌ点のＸ座標（ＫＬはＩＪと平行で、Ｌは直線ＦＤ上）`, unit: "m", answer: L[0], tol, pts: 4, expl: `Ｋを通りＩＪと同じ向きの直線と、直線ＦＤの交点。X＝<b>${nb(L[0])}</b>。` },
    { label: "問1", q: `Ｌ点のＹ座標`, unit: "m", answer: L[1], tol, pts: 3, expl: `Y＝<b>${nb(L[1])}</b>。` },
  ];
  const mk = (sheetNo, f) => Object.assign({ sheetNo: sheetNo }, f);
  const yesAns = ["必要", "必要がある", "要", "あり"];
  const noAns = ["不要", "必要がない", "否", "なし"];
  const appForm = [
    mk(0, { label: "登記の目的", answer: needKousei ? ["土地地積更正・分筆登記", "土地地積更正分筆登記", "土地地積更正、分筆登記"] : ["土地分筆登記", "分筆登記"], hint: "", pts: 3 }),
    mk(0, { label: "申請人", answer: [heir2, `亡${deceased}相続人${heir2}`, `${addr2}${heir2}`, `${addr2}亡${deceased}相続人${heir2}`], hint: "", pts: 3 }),
    mk(0, { label: "添付情報（①）", slot: "attach", answer: ["地積測量図"], hint: "", pts: 2 }),
    mk(0, { label: "添付情報（②）", slot: "attach", answer: ["相続証明情報", "相続を証する情報", "一般承継を証する情報", "戸籍謄本", "戸籍謄本等"], hint: "", pts: 2 }),
    mk(0, { label: "添付情報（③）", slot: "attach", answer: ["代理権限証明情報", "委任状"], hint: "", pts: 1 }),
    mk(0, { label: "登録免許税", answer: wgYenAccepts(3000), hint: "", pts: 3 }),
    ..._wTochiSheet(shozai, [
      { chiban: nOtsu, chimoku: "宅地", chiseki: aOtsu },
      { chiban: nKou, chimoku: "宅地", chiseki: aKou },
      { chiban: nHei, chimoku: "宅地", chiseki: aHei },
    ]).map((f) => mk(0, f)),
    mk(2, { label: "分筆と併せて地積更正の登記は（必要／不要）", answer: needKousei ? yesAns : noAns, hint: "登記記録の地積と分筆後の地積の合計の差を、地域に応じた精度区分の公差と比べる", pts: 3 }),
    mk(3, { label: "（ア）地図に準ずる図面を備え付ける場所", answer: ["登記所"], hint: "", pts: 1 }),
    mk(3, { label: "（イ）〜（エ）表示されるもの（順不同。「・」で区切る）", answer: ["位置・形状・地番", "位置、形状及び地番", "位置、形状、地番", "位置・地番・形状", "形状・位置・地番", "形状・地番・位置", "地番・位置・形状", "地番・形状・位置", "位置形状地番"], hint: "", pts: 3 }),
    mk(3, { label: "（オ）新たな地図を備え付けたとき、従前の図面はどうされるか", answer: ["閉鎖"], hint: "", pts: 2 }),
    mk(3, { label: "（カ）閉鎖された地図に準ずる図面の保存期間", answer: ["永久"], hint: "", pts: 2 }),
  ];

  const figure = {
    points: { A: A, B: Bq, C: Cx, D: Dq, E: Eq, F: F, G: Gq, H: H, I: Iq, J: J, K: Kq, L: L, T1: T1, T2: T2 },
    polys: [["H", "B", "C", "D", "F"]],
    lines: [["I", "J"], ["K", "L"]],
    revealPoints: ["A", "C", "H", "L"],
    areaLabels: [
      { at: [(H[0] + Iq[0] + J[0] + F[0]) / 4, (H[1] + Iq[1] + J[1] + F[1]) / 4], text: `${nHei} ${nb(aHei)}㎡` },
      { at: [(Iq[0] + Kq[0] + L[0] + J[0]) / 4, (Iq[1] + Kq[1] + L[1] + J[1]) / 4], text: `${nOtsu} ${nb(aOtsu)}㎡` },
      { at: [(Kq[0] + Bq[0] + Cx[0] + Dq[0] + L[0]) / 5, (Kq[1] + Bq[1] + Cx[1] + Dq[1] + L[1]) / 5], text: `${nKou} ${nb(aKou)}㎡` },
    ],
  };
  return {
    statement: html,
    coords: [],
    tasks: tasks,
    appForm: appForm,
    sheetTitles: { 0: "申請書（問3）", 2: "判断の設問", 3: "問2（地図に準ずる図面）" },
    figure: figure,
    figureChecks: wgFigChecks("chisekiSokuryo", [
      "分筆線ＩＪ・ＫＬを記入し、各点の符号を付した",
      `分筆後の地番（甲区画${nKou}、乙区画${nOtsu}、丙区画${nHei}）を記入した`,
      "隅切り（Ｂ点とＣ点を結ぶ線）を図示し、Ｃ点の位置を正しく記入した",
      "移設後のＨ点（旧Ｅ点の杭の移設先）を筆界点として記入した",
      "基準点Ｔ1・Ｔ2の点名を記入した（座標値は不要）",
    ]),
    articleFill: null,
    verify: {
      kind: "exam-r3-land",
      pts: { A, B: Bq, C: Cx, D: Dq, E: Eq, F, G: Gq, H, I: Iq, J, K: Kq, L, T1, T2 },
      obs: { alphaSec, dist: dA },
      lenGB,
      areas: { aHei, aOtsu, aKou, sumAfter, whole },
      rec: { rec, kRec },
      needKousei,
    },
  };
}

// ─────────── 令和3年度 第22問（建物）の型 ───────────
// 事案: 2階建の共同住宅（一棟の建物）を、構造上・利用上独立した東西2つの専有部分（イ・ロ）に区分する登記を申請する
// （建物の区分の登記）。（イ）は1階・2階の西半分、（ロ）は東半分。土地は同じ所有者の単独所有なので、区分後の各建物の敷地権は
// 敷地利用権が単独の所有権のとき（区分所有法22条3項）の割合＝専有部分の床面積（内側線）の割合になる。
// のち（ロ）を相続した者が、（ロ）の1階（あ）と2階（い）を別々の建物に区分するときの、登記の目的・敷地権の割合・添付情報を答える。
//
// 設問: 問1 （イ）の区分の登記の申請書（敷地権の表示を含む）、問2 後続の区分の登記についての3つの質問、問3 建物図面・各階平面図（紙）。
//
// 本型で設定する前提（本試験は図で示す）: 規約は設定されていない（分離処分を認める規約も、敷地権の割合を定める規約もない）。
//   （イ）と（ロ）の内側線の床面積は等しい（遺言で土地を2分の1ずつ引き継ぐ前提と矛盾しないようにするため）。
//   本試験の「Ⓐ部分」は出さない（附属建物の扱いの根拠を確認できなかったため）。
//
// 根拠: 法54条1項2号・同条3項（建物の区分の登記）、令別表十六の項（添付情報）、登録免許税法 別表第一 一(十三)イ（区分後の個数1個につき1,000円）、
//   規則115条（床面積は区分建物の専有部分は壁その他の区画の内側線）、準則90条（区分建物の構造の記録方法）、
//   区分所有法14条1〜3項・22条2項・3項（敷地権の割合）。
function exBuildR3Tatemono(rng) {
  const m = (a, b) => 0.5 * wgInt(rng, a, b);
  const xs = m(12, 15); // （イ）の東西（壁芯）。（ロ）も同じ
  const W = xs * 2;
  const D1 = m(18, 24); // 1階の南北
  const ov = m(0, 2); // 2階が南へ張り出す長さ
  const D2 = D1 + ov;
  const t2 = 0.2; // 柱の中心から内壁まで0.10mずつ（両側）
  const f1 = exFloor2(W * D1);
  const f2 = exFloor2(W * D2);
  const i1 = exFloor2((xs - t2) * (D1 - t2)); // （イ）1階（内側線）＝（あ）
  const i2 = exFloor2((xs - t2) * (D2 - t2)); // （イ）2階（内側線）＝（い）
  const A = Math.round(i1 * 100); // （あ）の面積（0.01㎡単位）
  const B = Math.round(i2 * 100); // （い）の面積
  const den = 2 * (A + B);
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const fracAcc = (n, d) => {
    const g = gcd(n, d);
    const out = [`${d}分の${n}`, `${n}/${d}`, `${n}／${d}`];
    if (g > 1) out.push(`${d / g}分の${n / g}`, `${n / g}/${d / g}`, `${n / g}／${d / g}`);
    return out;
  };

  // 土地と配置
  const x0 = exU(rng, 40, 60);
  const y0 = exU(rng, 70, 80);
  const ow = wgStep(rng, 1.5, 2.5, 0.5);
  const os = wgStep(rng, 1.5, 2.5, 0.5);
  const lw = wgStep(rng, Math.ceil((W + ow + 1.5) * 2) / 2, Math.ceil((W + ow + 4) * 2) / 2, 0.5);
  const ld = wgStep(rng, Math.ceil((D2 + os + 1.5) * 2) / 2, Math.ceil((D2 + os + 4) * 2) / 2, 0.5);
  if (W + ow + 1 > lw || D1 + os + 1 > ld || os - ov < 0.5) return null;
  const landArea = wgChiseki(lw * ld, "宅地");
  const LA = [x0, y0];
  const LB = [exRound(x0 + ld), y0];
  const LC = [LB[0], exRound(y0 + lw)];
  const LD = [x0, LC[1]];

  // 当事者・場所
  const sur = wgPick(rng, WG_SURNAME);
  const gs = WG_GIVEN_M.slice();
  const take = () => sur + gs.splice(wgInt(rng, 0, gs.length - 1), 1)[0];
  const owner = take();
  const heirW = take();
  const heirE = take();
  const shiho = wgPerson(rng);
  const city = wgPick(rng, EX_CITIES);
  const town = wgPick(rng, EX_TOWNS) + wgPick(rng, ["一丁目", "二丁目", "三丁目"]);
  const shozai = city + town;
  const base = wgInt(rng, 5, 60);
  const sub = wgInt(rng, 2, 4);
  const chiban = `${base}番${sub}`;
  const shozaiBld = `${shozai}${base}番地${sub}`;
  const kaoku = chiban;
  const kaokuI = `${base}番${sub}の1`;
  const ownerAddr = `${shozai}${base}番${sub - 1}号`;
  const dBuilt = wgDate(rng);
  const dApply = wgDate(rng);
  const nb = (v) => exNum(v);

  const html =
    `<p><b>【出題の趣旨】</b>土地家屋調査士${shiho}は、${owner}から、${chiban}の土地（以下「本件土地」という。）の上にある家屋番号${kaoku}の建物（以下「本件建物」という。）について、` +
    `【事実関係】のとおり事情を聴取し、必要となる表示に関する登記の申請手続の代理並びに調査及び測量の依頼を受け、【登記記録の内容】のとおり調査した上、${dApply.text}、申請をした。` +
    `以下、本件建物の（イ）部分・（ロ）部分・（あ）部分・（い）部分は、〔図1・分割計画図〕又は〔図2・専有部分（平面図）〕で示した部分をいう。</p>` +
    `<p><b>【問1】</b>${shiho}が${dApply.text}に申請した本件建物の（イ）部分に関する登記の申請書を完成させなさい（（ロ）部分に関しては記載を要しない。）。` +
    `家屋番号は（イ）部分を${kaokuI}と記載するものとし、敷地権の表示に関する登記の申請が不要である場合は「原因及びその日付」欄に「記載不要」と記載する（本型では、原因及びその日付の欄は採点しない）。</p>` +
    `<p><b>【問2】</b>【事実関係】5の下線部の${owner}の質問①から③までに対する${shiho}の回答を答えなさい。③について提供すべき情報がないときは「添付不要」と記載すること。</p>` +
    `<p><b>【問3】</b>問1の申請書に添付する（イ）部分に関する建物図面（500分の1）及び各階平面図（250分の1）を作図しなさい。（紙で作図し、採点後にチェック項目で確認する。）</p>` +
    `<p class="small" style="margin-top:8px">（注）1　本問における行為は全て適法に行われ、法律上必要な書類は全て適法に作成されているものとする。2　登記の申請は書面申請の方法による。` +
    `3　本件建物及び本件土地について、区分所有法に基づく規約は一切設定されていない。4　建物の測定値は鉄骨の柱又は壁の中心からの距離で、柱の中心から内壁までは0.10ｍである。` +
    `5　（イ）部分と（ロ）部分の各階の床面積は、区分建物の床面積の定めにより内側線で求め、小数第2位未満は切り捨てる。` +
    `6　敷地権の割合は、分数（「◯分の◯」）で書くこと。</p>` +
    `<p style="margin-top:12px"><b>【事実関係】</b></p>` +
    [
      `${owner}は、${ownerAddr}に住所を有し、本件土地及び本件建物を所有している。`,
      `本件建物は、${dBuilt.text}に${owner}が建築した、1階及び2階にそれぞれ構造上・利用上独立した2部屋を有する共同住宅である。` +
        `${owner}は、本件建物の1階の（イ）部分と2階の（イ）部分を、1個の構造上・利用上独立した建物（同じ玄関を使用する。）として賃貸するため、リフォーム工事を行った。` +
        `リフォーム工事後の現況は、登記記録及び登記所備付図面と一致することを確認した。平面は次の寸法表のとおり（壁芯）。`,
      `${owner}は、本件土地の共有持分2分の1と本件建物の（イ）部分を長男${heirW}に、本件土地の共有持分2分の1と本件建物の（ロ）部分を次男${heirE}に相続させる旨の遺言書を作成し、保管の申請をした。`,
      `${owner}は、遺言書の内容を踏まえ、本件建物の（イ）部分と（ロ）部分をそれぞれ独立した所有権の目的となる建物とするために必要な表示に関する登記を${shiho}に依頼し、${shiho}は${dApply.text}、その申請（以下「本件登記申請」という。）をした。`,
      `${owner}は${shiho}に、「本件登記申請に基づく登記の完了後、遺言に基づいて（ロ）部分が${heirE}に相続された後、（ロ）部分のうち1階の（あ）部分と2階の（い）部分をそれぞれ独立した所有権の目的となる建物にする登記を申請する場合、` +
        `<u>①申請すべき登記の目的はどうなるか、②${heirW}と${heirE}の間で敷地権について特段の話合いがないときは、（あ）部分と（い）部分の登記記録に記録されるそれぞれの敷地権の割合はどうなるか、` +
        `③（あ）部分と（い）部分の敷地権の割合を等しくするには、申請情報に併せてどのような情報を提供すべきか</u>」と質問した。`,
    ]
      .map((t, i) => `<p>${i + 1}　${t}</p>`)
      .join("") +
    exTable(
      ["部分", "階", "東西（ｍ）", "南北（ｍ）", "備考"],
      [
        ["一棟の建物（壁芯）", "1階", nb(W), nb(D1), "（イ）（ロ）は東西とも " + nb(xs)],
        ["一棟の建物（壁芯）", "2階", nb(W), nb(D2), ov > 0 ? `1階の南側へ ${nb(ov)}ｍ張り出している` : "1階と同じ外形"],
        ["（イ）部分", "1階・2階", nb(xs), "上記と同じ", "本件建物の西半分。（ロ）は東半分で、（ロ）の1階が（あ）、2階が（い）"],
      ],
    ) +
    `<p class="small" style="margin-top:6px">〔配置〕建物は、本件土地の西側の筆界から${nb(ow)}ｍ、南側の筆界から${nb(os)}ｍ（1階の外壁）の位置にあり、本件土地の東西は${nb(lw)}ｍ、南北は${nb(ld)}ｍの長方形である。` +
    `北は図面の上方で、土地・建物とも隅部は全て直角とする。</p>` +
    `<p style="margin-top:10px"><b>【登記記録の内容】</b></p>` +
    `<p class="small">1　本件土地（表題部）所在 ${shozai}、地番 ${chiban}、地目 宅地、地積 ${nb(landArea)}㎡。（甲区）1番　${ownerAddr}　${owner}。（乙区）登記事項なし。</p>` +
    `<p class="small">2　本件建物（表題部）所在 ${shozaiBld}、家屋番号 ${kaoku}、種類 共同住宅、構造 鉄骨造スレートぶき2階建、床面積 1階 ${nb(f1)}㎡、2階 ${nb(f2)}㎡、原因 ${dBuilt.text}新築。（甲区）1番　${ownerAddr}　${owner}。</p>`;

  const tasks = [
    { label: "問1", q: `（イ）部分の<b>1階</b>の床面積（㎡）`, unit: "㎡", answer: i1, tol: 0.005, pts: 4, expl: `専有部分は壁その他の区画の<b>内側線</b>（規則115条）。(${nb(xs)}−0.20)×(${nb(D1)}−0.20)＝<b>${nb(i1)}㎡</b>（小数第3位以下切捨て）。` },
    { label: "問1", q: `（イ）部分の<b>2階</b>の床面積（㎡）`, unit: "㎡", answer: i2, tol: 0.005, pts: 4, expl: `(${nb(xs)}−0.20)×(${nb(D2)}−0.20)＝<b>${nb(i2)}㎡</b>。` },
  ];
  const mk = (sheetNo, f) => Object.assign({ sheetNo: sheetNo }, f);
  const purpose = ["建物区分登記", "建物の区分登記", "建物区分の登記"];
  const apps = ["建物図面", "各階平面図", "代理権限証明情報", "建物図面及び各階平面図", "建物図面、各階平面図", "建物図面・各階平面図", "委任状"];
  const half = ["2分の1", "二分の一", "２分の１", "1/2", "1／2"];
  const appForm = [
    mk(0, { label: "登記の目的", answer: purpose, hint: "", pts: 3 }),
    mk(0, { label: "添付情報（①）", slot: "attach", answer: apps, hint: "", pts: 2 }),
    mk(0, { label: "添付情報（②）", slot: "attach", answer: apps, hint: "", pts: 2 }),
    mk(0, { label: "申請人", answer: [owner, `${ownerAddr}${owner}`, ownerAddr + "　" + owner], hint: "", pts: 2 }),
    mk(0, { label: "登録免許税", answer: wgYenAccepts(2000), hint: "", pts: 3 }),
    mk(0, _wPre("kubunTatemono", "所在", [shozaiBld], 1)),
    mk(0, _wCell("kubunTatemono", 0, "kaoku", "区分した建物の家屋番号", [kaokuI], 2, "")),
    mk(0, _wCell("kubunTatemono", 0, "shufuku", "主である建物又は附属建物", ["主である建物", "主"], 1, "")),
    mk(0, _wCell("kubunTatemono", 0, "shurui", "区分した建物の種類", ["居宅", "共同住宅"], 1, "")),
    mk(0, _wCell("kubunTatemono", 0, "kozo", "区分した建物の構造", ["鉄骨造スレートぶき2階建"], 3, "")),
    mk(0, _wCell("kubunTatemono", 0, "yuka", "区分した建物の床面積", wgFloorsAccepts([i1, i2]), 5, "")),
    mk(0, _wCell("ittou", 0, "kozo", "一棟の建物の構造", ["鉄骨造スレートぶき2階建"], 2, "")),
    mk(0, _wCell("ittou", 0, "yuka", "一棟の建物の床面積", wgFloorsAccepts([f1, f2]), 4, "")),
    mk(0, _wCell("kubunTochi", 0, "chiban", "敷地権の目的である土地の所在及び地番", [`${shozai}${chiban}`], 1, "")),
    mk(0, _wCell("kubunTochi", 0, "chimoku", "敷地権の目的である土地の地目", ["宅地"], 1, "")),
    mk(0, _wCell("kubunTochi", 0, "chiseki", "敷地権の目的である土地の地積", wgAreaAccepts(landArea), 2, "")),
    mk(0, _wCell("shikichi", 0, "shurui", "敷地権の種類", ["所有権"], 2, "")),
    mk(0, _wCell("shikichi", 0, "wariai", "敷地権の割合", half, 4, "")),
    mk(2, { label: "① 申請すべき登記の目的", answer: purpose, hint: "", pts: 3 }),
    mk(2, { label: "② （あ）部分の敷地権の割合", answer: fracAcc(A, den), hint: "", pts: 4 }),
    mk(2, { label: "② （い）部分の敷地権の割合", answer: fracAcc(B, den), hint: "", pts: 4 }),
    mk(2, { label: "③ 提供すべき情報", answer: ["規約証明書", "規約を設定したことを証する情報", "規約を証する情報", "敷地権の割合を定めた規約を設定したことを証する情報"], hint: "", pts: 4 }),
  ];

  // 図: 土地と、（イ）部分の1階（実線）・2階（張り出しを含む）
  const by = exRound(y0 + ow);
  const xS1 = exRound(x0 + os);
  const xN = exRound(x0 + os + D1);
  const xS2 = exRound(x0 + os - ov);
  const R1 = [[xS1, by], [xN, by], [xN, exRound(by + xs)], [xS1, exRound(by + xs)]];
  const R2 = [[xS2, by], [xN, by], [xN, exRound(by + xs)], [xS2, exRound(by + xs)]];
  const figure = {
    points: { A: LA, B: LB, C: LC, D: LD },
    polys: [["A", "B", "C", "D"]],
    holes: [
      { poly: R1, label: "（イ）1階" },
      { poly: R2, label: "（イ）2階" },
    ],
    lines: [],
    revealPoints: [],
    areaLabels: [{ at: [x0 + os + D1 / 2, by + xs / 2], text: `（イ）1階 ${nb(i1)}㎡ ／ 2階 ${nb(i2)}㎡` }],
  };
  return {
    statement: html,
    coords: [],
    tasks: tasks,
    appForm: appForm,
    sheetTitles: { 0: "申請書（問1：（イ）部分の区分の登記）", 2: "問2（後続の区分の登記）" },
    figure: figure,
    figureChecks: [
      "建物図面は500分の1、各階平面図は250分の1で作図した（規則82条3項・83条2項）",
      "建物図面に方位、敷地の地番とその形状、隣接地の地番を記入した（規則82条2項）",
      "建物図面に（イ）部分の1階の位置・形状を筆界からの距離で示し、家屋番号を記入した",
      "各階平面図に各階の別、（イ）部分の各階の形状、1階の位置を記入した（規則83条1項）",
      "（イ）部分の各階の床面積を内側線で求め、各階ごとに記入した（規則115条）",
      "2階の張り出し（ある場合）を含めて2階の形を描いた",
      "区分した建物の（ロ）部分を（イ）部分に含めていない",
    ],
    articleFill: null,
    verify: {
      kind: "exam-r3-tatemono",
      dims: { xs, W, D1, D2, ov, t2 },
      areas: { f1, f2, i1, i2, A, B, den },
      site: { A: LA, B: LB, C: LC, D: LD, ow, os, lw, ld },
      figure: { R1, R2 },
      landArea,
    },
  };
}

// ─────────── 令和2年度 第21問（土地）の型 ───────────
// 事案: 亡くなった所有者の2筆（本件土地1・本件土地2）の筆界はＢＥだが、建物は区画の別に建っている。登記記録を
//   「建物1のある甲区画（Ｂ・Ｃ・Ｄ・Ｅ・Ｇ・Ｈ）」と「他の建物のある乙区画（Ａ・Ｈ・Ｇ・Ｆ）」に一致させたい。
//   本件土地2から、ＢＥとＧＨ（平行）で挟まれた部分を分筆して本件土地1に合筆する。
// 設問: Ｂ（道路境界確認図の任意座標を平行移動で変換）・Ｇ・Ｈ（平行と甲区画の面積）の座標、
//   申請書（地積更正の要否は公差で判断、分筆・合筆を一の申請情報で）、登記識別情報の穴埋め、地積測量図（紙）。
//
// 根拠: 法39条1項・41条（分筆・合筆の申請人と合筆の制限）、法30条（相続人による申請）、法2条14号・規則61条（登記識別情報）、
//   規則63条1項2号（書面の交付）、令8条1項1号・3号（合筆・合併の登記識別情報の提供）、規則10条4項1号（市街地は甲二）、
//   国土調査法施行令 別表第四（公差）、登録免許税法 別表第一 一(十三)イ・ロ（分筆後・合筆後の個数×1,000円）、規則100条（地積）。
function exBuildR2Land(rng) {
  // 1. 形状（局所座標 p＝道路沿い、q＝奥行き → 世界座標）----------------------------------
  const phi = (exU(rng, 36, 44) * Math.PI) / 180;
  const u = [Math.cos(phi), Math.sin(phi)];
  const v = [-Math.sin(phi), Math.cos(phi)];
  const A0 = [exU(rng, 14, 19), exU(rng, -4, -2)];
  const wld = (p, q) => [exRound(A0[0] + p * u[0] + q * v[0]), exRound(A0[1] + p * u[1] + q * v[1])];
  const Lc = exU(rng, 20, 23);
  const tb = Lc * exU(rng, 0.5, 0.6);
  const pF = exU(rng, -0.5, 0.5);
  const qF = exU(rng, 12, 14);
  const pE = pF + exU(rng, 9, 11);
  const qE = qF + exU(rng, -0.4, 1.2);
  const pD = Lc - exU(rng, 1, 3);
  const qD = qE + exU(rng, -1.2, 0.3);
  if (!(pD > pE + 3)) return null;
  const A = wld(0, 0);
  const B = wld(tb, 0);
  const C = wld(Lc, 0);
  const D = wld(pD, qD);
  const E = wld(pE, qE);
  const F = wld(pF, qF);
  // 道路境界確認図の任意座標は、実座標を平行移動したもの（Ａ・Ｃは同一点）
  const off = [exRound(exU(rng, 88, 100)), exRound(exU(rng, 130, 140))];
  const arb = (P) => [exRound(P[0] + off[0]), exRound(P[1] + off[1])];

  // 2. Ｇ・Ｈ: ＨはＡＢ上、ＧはＥＦ上、ＧＨ∥ＢＥ。甲区画の面積から決める。
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const crs = (a, b) => a[0] * b[1] - a[1] * b[0];
  const aV = sub(A, B);
  const eV = sub(E, B);
  const fV = sub(F, E);
  const kk = crs(aV, eV) / crs(fV, eV);
  const sS = exU(rng, 0.3, 0.75);
  const Hx = [B[0] + sS * aV[0], B[1] + sS * aV[1]];
  const Gx = [E[0] + kk * sS * fV[0], E[1] + kk * sS * fV[1]];
  if (!(kk * sS > 0.08 && kk * sS < 0.95)) return null;
  const G = [exRound(Gx[0]), exRound(Gx[1])];
  const H = [exRound(Hx[0]), exRound(Hx[1])];
  const area1 = wgArea([B, C, D, E]); // 本件土地1の求積
  const area2 = wgArea([A, B, E, F]); // 本件土地2の求積
  const koArea = exRound(wgArea([B, C, D, E, G, H])); // 甲区画（問題文に与える）
  const partRaw = wgArea([B, E, G, H]); // 本件土地2から分筆する部分
  const otsuRaw = wgArea([A, H, G, F]);
  if (!(partRaw > 8 && otsuRaw > 30)) return null;
  // ＧＨ∥ＢＥ（丸め後）
  const gh = sub(G, H);
  if (Math.abs(crs(gh, eV)) / (exDist(G, H) * exDist(E, B)) > 0.003) return null;
  // 点検用の基準点
  const T1 = wld(pF - 5.5, qF + 1.5);
  const T2 = wld(pD + 1, qD + 5);

  // 3. 公差と更正の要否（本件土地1・2それぞれ。市街地＝甲二）---------------------------------------
  const seido = "甲二";
  const c1 = wgChiseki(area1, "宅地");
  const c2 = wgChiseki(area2, "宅地");
  const need1 = rng() < 0.4;
  const need2 = rng() < 0.4;
  const mkRec = (c, need) => {
    let rec = c;
    for (let i = 0; i < 3; i++) {
      const k = wgKosaShown(rec, seido);
      const gap = need ? k * exU(rng, 1.5, 2.8) : k * exU(rng, 0.1, 0.6);
      rec = exRound(c + (rng() < 0.5 ? -gap : gap));
    }
    return rec;
  };
  const rec1 = mkRec(c1, need1);
  const rec2 = mkRec(c2, need2);
  const k1 = wgKosaShown(rec1, seido);
  const k2 = wgKosaShown(rec2, seido);
  if (need1 ? Math.abs(rec1 - c1) < k1 * 1.25 : Math.abs(rec1 - c1) > k1 * 0.75) return null;
  if (need2 ? Math.abs(rec2 - c2) < k2 * 1.25 : Math.abs(rec2 - c2) > k2 * 0.75) return null;
  const part = wgChiseki(partRaw, "宅地");
  const base2 = need2 ? c2 : rec2; // 分筆前の本件土地2の地積（更正後）
  const base1 = need1 ? c1 : rec1; // 合筆前の本件土地1の地積（更正後）
  const remain = exRound(base2 - part); // 分筆後の本件土地2（乙区画）の残り
  const remainAlt = wgChiseki(otsuRaw, "宅地");
  const merged = exRound(base1 + part); // 合筆後の本件土地1（甲区画）
  if (!(remain > 20)) return null;

  // 4. 当事者・場所 -------------------------------------------------------------------------
  const sur1 = wgPick(rng, WG_SURNAME);
  const deceased = sur1 + wgPick(rng, WG_GIVEN_M);
  const son = sur1 + wgPick(rng, WG_GIVEN_M.filter((g) => deceased !== sur1 + g));
  const daughter = wgPerson(rng, "f");
  const shiho = wgPerson(rng);
  const city = wgPick(rng, EX_CITIES);
  const town = wgPick(rng, EX_TOWNS) + wgPick(rng, ["一丁目", "二丁目", "三丁目"]);
  const shozai = city + town;
  const base = wgInt(rng, 12, 60);
  const s1 = wgInt(rng, 2, 8);
  const n1 = `${base}番${s1}`;
  const n2 = `${base}番${s1 + 1}`;
  const n3 = `${base}番${s1 + 2}`;
  const addr2 = `${shozai}${base}番地${s1 + 1}`;
  const dDeath = wgDate(rng);
  const dApply = exAddDays(dDeath, wgInt(rng, 240, 260));
  const nb = (x) => exNum(x);
  const kosaRow = ["甲一", "甲二", "甲三", "乙一", "乙二", "乙三"];

  const html =
    `<p><b>【出題の趣旨】</b>土地家屋調査士${shiho}は、${son}及び${daughter}から、${shozai}${n1}の土地（以下「本件土地1」という。）及び同${n2}の土地（以下「本件土地2」といい、両方を合わせて「本件土地」という。）の表示に関する登記について相談を受け、` +
    `【聴取記録の概要】のとおり事情を聴取し、必要となる申請手続の代理並びに調査及び測量の依頼を受けて、【調査及び測量の結果の概要】のとおり調査及び測量を行った。</p>` +
    `<p class="small">〔調査図素図の注〕Ａ・Ｂ・Ｃ・Ｄ・Ｅ・Ｆは筆界点で、Ｂ点は道路境界（Ａ・Ｂ・Ｃは一直線）上にある。Ｇ点はＥ点とＦ点を結ぶ直線上、Ｈ点はＡ点とＢ点を結ぶ直線上の点。` +
    `本件土地1はＢ・Ｃ・Ｄ・Ｅを順次結んだ部分、本件土地2はＡ・Ｂ・Ｅ・Ｆを順次結んだ部分で、その筆界はＢ点とＥ点を結ぶ直線である（聴取時は不明）。</p>` +
    `<p><b>【問1】</b>〔調査図素図〕上の<b>Ｂ点、Ｇ点及びＨ点の座標値</b>を求めなさい。</p>` +
    `<p><b>【問2】</b>依頼を受けた本件土地の登記の申請書を完成させなさい。必要な土地の表示に関する登記が複数あるときは、一の申請情報により申請する。` +
    `地積は、測量の結果である座標値を用いて座標法により求積し、その求積値と登記記録の地積の差が公差の範囲内であるときは、地積に関する表示の登記の申請は行わないこととする。</p>` +
    `<p><b>【問3】</b>次の登記識別情報についての説明の（ア）から（オ）までに入る文言を答えなさい。</p>` +
    `<blockquote class="small" style="margin:6px 0 10px 8px;padding-left:10px;border-left:3px solid var(--border)">` +
    `登記識別情報は、アラビア数字その他の符号の組合せにより、（ア）及び（イ）となった申請人ごとに定められる。書面申請の場合の通知は、登記識別情報を記載した（ウ）の交付による。` +
    `表示に関する登記のうち、所有権の登記がある土地の（エ）の登記及び所有権の登記がある建物の合体による登記等並びに所有権の登記がある建物の（オ）の登記を申請するときは、（イ）の登記識別情報を提供しなければならない。</blockquote>` +
    `<p><b>【問4】</b>問2の申請書に添付する地積測量図を、250分の1の縮尺で作図しなさい。（紙で作図し、採点後にチェック項目で確認する。）</p>` +
    `<p class="small">（注）1　本問における行為は全て適法に行われ、法律上必要な書類は全て適法に作成されているものとする。2　登記の申請は書面申請の方法による。` +
    `3　座標値は小数点以下第3位を四捨五入して第2位まで記載する。4　地積測量図は250分の1で、筆界点間の距離を小数第2位まで記載する。` +
    `5　各筆界点の座標値、平面直角座標系の番号、地積及び求積方法並びに測量年月日は、地積測量図に記載しなくてよい。6　基準点は点名を付して記載し、座標値は不要。</p>` +
    `<p style="margin-top:12px"><b>【聴取記録の概要】</b></p>` +
    [
      `${son}（${shozai}${base}番地${s1}に居住）は本件土地1及び2にまたがる家屋番号${n1}の建物（本件建物1）に、${daughter}は本件土地2にある家屋番号${n2}の建物（本件建物2）に居住している。` +
        `家屋番号${n2}の2の建物（本件建物3）は本件土地2にあり、共同住宅として使われている。`,
      `${deceased}は${dDeath.text}に死亡した。${son}及び${daughter}は${deceased}の子で、他に相続人はいない。`,
      `${son}及び${daughter}は、今後の相続のため、本件土地の登記記録を、本件建物1のある区画（Ｂ・Ｃ・Ｄ・Ｅ・Ｇ・Ｈ・Ｂの各点を順次結んだ部分。「甲区画」）と、本件建物2・3のある区画（Ａ・Ｈ・Ｇ・Ｆ・Ａの各点を順次結んだ部分。「乙区画」）に一致させることを希望している。`,
      `甲区画と乙区画の間にブロック塀等はない。Ｂ点とＥ点を結ぶ直線とＧ点とＨ点を結ぶ直線が平行になり、かつ、甲区画の面積が座標値によると<b>${nb(koArea)}㎡</b>となるようにＧ点・Ｈ点を設定することを希望している。`,
      `申請件数が最も少なく、かつ、登録免許税の額が最も低額となるように申請することを希望している。分筆により生じる土地の予定地番は${n3}とする。`,
      `${deceased}名義の登記識別情報は保有していないが、両土地の登記済証を所持している。`,
    ]
      .map((t, i) => `<p>${i + 1}　${t}</p>`)
      .join("") +
    `<p style="margin-top:12px"><b>【調査及び測量の結果の概要】</b></p>` +
    `<p class="small">1　登記記録（現在事項）</p>` +
    exTable(
      ["", "地番", "地目", "地積", "甲区（所有者）", "乙区"],
      [
        ["本件土地1", n1, "宅地", `${nb(rec1)}㎡`, `${addr2}　${deceased}`, "（登記事項なし）"],
        ["本件土地2", n2, "宅地", `${nb(rec2)}㎡`, `${addr2}　${deceased}`, "（登記事項なし）"],
      ],
    ) +
    `<p class="small" style="margin-top:6px">地図等　本件土地の地域には、法14条1項の地図は備え付けられておらず、地図に準ずる図面が備え付けられている。本件土地の地域は規則10条2項1号の<b>市街地地域</b>に属する。` +
    `隣接地及び本件建物1〜3の図面は備え付けられており、道路境界は確認されている。</p>` +
    `<p class="small">地積測定の公差（精度区分を地域に応じて選ぶ）</p>` +
    exTable(["区分"].concat(kosaRow), [
      [`${nb(rec1)}㎡`].concat(kosaRow.map((q) => nb(wgKosaShown(rec1, q)))),
      [`${nb(rec2)}㎡`].concat(kosaRow.map((q) => nb(wgKosaShown(rec2, q)))),
    ]) +
    `<p class="small" style="margin-top:6px">2　現地・測量　現地の境界標と、備付図面・基準点・道路境界確認図は整合しており、本件土地1と2の筆界はＢ点とＥ点を結ぶ直線と確認した。` +
    `Ａ・Ｃ・Ｄ・Ｆ点にコンクリート杭が、Ｅ点に金属標がある。Ｂ点は、道路境界確認図の任意座標を実座標に変換して金属標を設置した。Ｇ点・Ｈ点にはコンクリート杭を設置した。</p>` +
    exTable(["名称", "Ｘ座標（ｍ）", "Ｙ座標（ｍ）"], [
      ["市基準点1", nb(T1[0]), nb(T1[1])],
      ["市基準点2", nb(T2[0]), nb(T2[1])],
    ]) +
    `<p class="small" style="margin-top:6px">〔測量で得た座標値〕（Ｂ・Ｇ・Ｈは省略）</p>` +
    exTable(["名称", "Ｘ", "Ｙ"], [["Ａ", A], ["Ｃ", C], ["Ｄ", D], ["Ｅ", E], ["Ｆ", F]].map(([n, q]) => [n, nb(q[0]), nb(q[1])])) +
    `<p class="small" style="margin-top:6px">〔道路境界確認図の座標値（任意座標）〕（Ａ'はＡ、Ｂ'はＢ、Ｃ'はＣと同一の点）</p>` +
    exTable(["名称", "Ｘ", "Ｙ"], [["Ａ'", arb(A)], ["Ｂ'", arb(B)], ["Ｃ'", arb(C)]].map(([n, q]) => [n, nb(q[0]), nb(q[1])]));

  const tol = 0.02;
  const tasks = [
    { label: "問1", q: `Ｂ点のＸ座標（任意座標から実座標へ）`, unit: "m", answer: B[0], tol, pts: 3, expl: `任意座標のＡ'・Ｃ'とＡ・Ｃは平行移動の関係（Ｘ差 ${nb(off[0])}）。Ｂ'のＸから差を引く。X＝<b>${nb(B[0])}</b>。` },
    { label: "問1", q: `Ｂ点のＹ座標`, unit: "m", answer: B[1], tol, pts: 3, expl: `Y＝<b>${nb(B[1])}</b>（Ｙ差 ${nb(off[1])} を引く）。` },
    { label: "問1", q: `Ｇ点のＸ座標（Ｇ点はＥＦ上、ＧＨ∥ＢＥ、甲区画の面積 ${nb(koArea)}㎡）`, unit: "m", answer: G[0], tol, pts: 4, expl: `ＨをＡＢ上、ＧをＥＦ上で動かし、ＧＨ∥ＢＥの条件と面積から解く。X＝<b>${nb(G[0])}</b>。` },
    { label: "問1", q: `Ｇ点のＹ座標`, unit: "m", answer: G[1], tol, pts: 3, expl: `Y＝<b>${nb(G[1])}</b>。` },
    { label: "問1", q: `Ｈ点のＸ座標`, unit: "m", answer: H[0], tol, pts: 4, expl: `X＝<b>${nb(H[0])}</b>。` },
    { label: "問1", q: `Ｈ点のＹ座標`, unit: "m", answer: H[1], tol, pts: 3, expl: `Y＝<b>${nb(H[1])}</b>。` },
  ];
  const mk = (sheetNo, f) => Object.assign({ sheetNo: sheetNo }, f);
  const needAny = need1 || need2;
  const purposes = needAny
    ? ["土地地積更正、土地分筆、土地合筆登記", "土地地積更正・土地分筆・土地合筆登記", "土地地積更正、土地分筆、土地合筆", "土地地積更正、分筆、合筆登記", "土地地積更正登記、土地分筆登記、土地合筆登記"]
    : ["土地分筆、土地合筆登記", "土地分筆・土地合筆登記", "土地分筆、土地合筆", "土地分筆登記、土地合筆登記", "分筆、合筆登記"];
  const pplAcc = [son, daughter, `${addr2}${son}`, `${addr2}${daughter}`, `亡${deceased}相続人${son}`, `亡${deceased}相続人${daughter}`, `${addr2}亡${deceased}相続人${son}`, `${addr2}亡${deceased}相続人${daughter}`];
  const attachAcc = ["地積測量図", "登記済証", "登記識別情報", "相続証明情報", "相続を証する情報", "一般承継を証する情報", "戸籍謄本", "戸籍謄本等", "代理権限証明情報", "委任状"];
  const remainAcc = wgChisekiAccepts(remain, "宅地").concat(remainAlt !== remain ? wgChisekiAccepts(remainAlt, "宅地") : []);
  const appForm = [
    mk(0, { label: "登記の目的", answer: purposes, hint: "", pts: 3 }),
    mk(0, { label: "申請人（①）", slot: "applicant", answer: pplAcc, hint: "", pts: 2 }),
    mk(0, { label: "申請人（②）", slot: "applicant", answer: pplAcc, hint: "", pts: 2 }),
    mk(0, { label: "添付情報（①）", slot: "attach", answer: attachAcc, hint: "", pts: 2 }),
    mk(0, { label: "添付情報（②）", slot: "attach", answer: attachAcc, hint: "", pts: 2 }),
    mk(0, { label: "添付情報（③）", slot: "attach", answer: attachAcc, hint: "", pts: 2 }),
    mk(0, { label: "添付情報（④）", slot: "attach", answer: attachAcc, hint: "", pts: 1 }),
    mk(0, { label: "登録免許税", answer: wgYenAccepts(3000), hint: "", pts: 3 }),
    mk(0, _wPre("tochiG", "所在", [shozai], 1)),
    mk(0, _wCell("tochiG", 0, "chiban", "1行目の地番", [n1], 1, "")),
    mk(0, _wCell("tochiG", 0, "chimoku", "1行目の地目", ["宅地"], 1, "")),
    mk(0, _wCell("tochiG", 0, "chiseki", "1行目の地積", wgChisekiAccepts(merged, "宅地"), 3, "")),
    mk(0, _wCell("tochiG", 1, "chiban", "2行目の地番", [n2], 1, "")),
    mk(0, _wCell("tochiG", 1, "chimoku", "2行目の地目", ["宅地"], 1, "")),
    mk(0, _wCell("tochiG", 1, "chiseki", "2行目の地積", remainAcc, 3, "")),
    mk(3, { label: "（ア）", answer: ["不動産"], hint: "", pts: 2 }),
    mk(3, { label: "（イ）", answer: ["登記名義人"], hint: "", pts: 2 }),
    mk(3, { label: "（ウ）", answer: ["書面"], hint: "", pts: 2 }),
    mk(3, { label: "（エ）", answer: ["合筆"], hint: "", pts: 2 }),
    mk(3, { label: "（オ）", answer: ["合併"], hint: "", pts: 2 }),
  ];
  const cx = (...P) => [P.reduce((a, q) => a + q[0], 0) / P.length, P.reduce((a, q) => a + q[1], 0) / P.length];
  const figure = {
    points: { A, B, C, D, E, F, G, H, T1, T2 },
    polys: [["A", "B", "C", "D", "E", "F"]],
    lines: [["B", "E"], ["G", "H"]],
    revealPoints: ["B", "G", "H"],
    areaLabels: [
      { at: cx(A, H, G, F), text: `${n2} ${nb(remain)}㎡` },
      { at: cx(B, E, G, H), text: `${n3}（合筆）${nb(part)}㎡` },
      { at: cx(B, C, D, E), text: `${n1} ${nb(merged)}㎡` },
    ],
  };
  return {
    statement: html,
    coords: [],
    tasks: tasks,
    appForm: appForm,
    sheetTitles: { 0: "申請書（問2）", 3: "問3（登記識別情報）" },
    figure: figure,
    figureChecks: wgFigChecks("chisekiSokuryo", [
      "分筆線（ＧＨ）と、分筆する部分（ＢＥＧＨ）を示し、各点の符号を付した",
      `分筆後の地番（本件土地2は${n2}、分筆した部分は${n3}）を記入した`,
      "Ｂ点・Ｇ点・Ｈ点の位置と、筆界点間の距離（小数第2位）を記入した",
      "市基準点1・2の点名を記入した（座標値は不要）",
    ]),
    articleFill: null,
    verify: {
      kind: "exam-r2-land",
      pts: { A, B, C, D, E, F, G, H },
      arb: { A: arb(A), B: arb(B), C: arb(C), off },
      koArea,
      areas: { c1, c2, rec1, rec2, part, remain, remainAlt, merged, base1, base2 },
      k: { k1, k2 },
      need: { need1, need2 },
    },
  };
}

// ─────────── 令和2年度 第22問（建物）の型 ───────────
// 事案: 所有者の土地に、取り壊した旧建物（登記記録のどれか）と、新築した3階建の新建物（1階は薬局、2階は共同住宅、3階は居宅）がある。
//   新建物の1階ポーチは、新築後に建具と壁を設けて外気分断性が備わった。
// 設問: 問1 旧建物の滅失の登記の申請書（家屋番号を登記記録から特定）、問2 別の建物を移すときの申請義務の有無
//   （解体移転・えい行移転）、問3 新建物の表題登記の申請書、問4 建物図面・各階平面図（紙）。
//
// 本型の設定: 移転先は同じ土地（地番）の上。測定値は外壁の隅角部で、壁の中心線は隅角部から5cm内側（各寸法−0.10m）。
//   外階段、バルコニーは外気分断性がなく床面積に算入しない。エレベーター室は各階の床面積に算入する。
//
// 根拠: 法44条1項（登記事項）、法47条・57条・51条（1月以内の申請義務）、準則85条（解体移転＝滅失＋新築、えい行移転＝所在の変更）、
//   令別表十二の項（表題登記の添付情報）、令別表（滅失の登記は通常の建物では添付情報の定めがない）、令7条1項2号（代理権限証明情報）、
//   規則113条2項（種類は二以上の用途で定める）、規則114条（構造）、規則115条（床面積は壁の中心線）、準則82条6号・7号（EV室・屋外階段）。
function exBuildR2Tatemono(rng) {
  const m = (a, b) => 0.5 * wgInt(rng, a, b);
  const W1 = m(18, 22);
  const D1 = m(14, 18);
  const W2 = W1 - m(0, 2);
  const D2 = D1 - m(0, 2);
  const W3 = W2 - m(0, 3);
  const D3 = D2 - m(0, 3);
  const t = 0.1; // 隅角部から壁の中心線までの両側分
  const A1 = exFloor2((W1 - t) * (D1 - t));
  const A2 = exFloor2((W2 - t) * (D2 - t));
  const A3 = exFloor2((W3 - t) * (D3 - t));
  const uses = [["店舗", A1], ["共同住宅", A2], ["居宅", A3]];
  const areas = uses.map((x) => x[1]);
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) if (Math.abs(areas[i] - areas[j]) < 2) return null;
  const sorted = uses.slice().sort((a, b) => b[1] - a[1]).map((x) => x[0]);
  const pw = m(5, 8);
  const pd = m(3, 5); // ポーチ
  if (!(pw < W1 - 1 && pd < D1 - 1)) return null;

  // 土地と配置（新建物は1階の外壁から筆界までの距離）
  const x0 = exU(rng, 40, 60);
  const y0 = exU(rng, 70, 80);
  const ow = wgStep(rng, 1.5, 2.5, 0.5);
  const os = wgStep(rng, 1.5, 2.5, 0.5);
  const lw = wgStep(rng, Math.ceil((W1 + ow + 1.5) * 2) / 2, Math.ceil((W1 + ow + 4) * 2) / 2, 0.5);
  const ld = wgStep(rng, Math.ceil((D1 + os + 1.5) * 2) / 2, Math.ceil((D1 + os + 4) * 2) / 2, 0.5);
  if (W1 + ow + 1 > lw || D1 + os + 1 > ld) return null;
  const LA = [x0, y0];
  const LB = [exRound(x0 + ld), y0];
  const LC = [LB[0], exRound(y0 + lw)];
  const LD = [x0, LC[1]];

  // 当事者・場所
  const owner = wgPerson(rng, "f");
  const son = wgPick(rng, WG_SURNAME) + wgPick(rng, WG_GIVEN_M);
  const shiho = wgPerson(rng);
  const city = wgPick(rng, EX_CITIES);
  const town = wgPick(rng, EX_TOWNS) + wgPick(rng, ["一丁目", "二丁目", "三丁目"]);
  const shozai = city + town;
  const b0 = wgInt(rng, 20, 60);
  const sOld = wgInt(rng, 2, 4);
  const nOldLand = `${b0}番${sOld}`; // 旧建物が建っていた土地
  const newLand = `${b0 + 3}番${wgInt(rng, 1, 3)}`;
  const [nbN, nbS] = newLand.split("番");
  const kaokuNew = newLand;
  const sx = shozai + newLand.replace("番", "番地");
  const oldA = exRound(wgInt(rng, 5500, 8000) / 100);
  // 登記記録の3つ（旧建物は1つ目）
  const recs = [
    { kaoku: nOldLand, shurui: "居宅", kozo: "木造瓦葺平家建", yuka: [oldA] },
    { kaoku: `${nOldLand}の2`, shurui: "居宅", kozo: "木造瓦葺2階建", yuka: [exRound(wgInt(rng, 5500, 7000) / 100), exRound(wgInt(rng, 2000, 3000) / 100)] },
    { kaoku: `${nOldLand}の4`, shurui: "居宅", kozo: "木造スレート葺2階建", yuka: [exRound(wgInt(rng, 7000, 9000) / 100), exRound(wgInt(rng, 2000, 3000) / 100)] },
  ];
  const kozoNew = "鉄骨造合金メッキ鋼板ぶき3階建";
  const dBuilt = wgDate(rng);
  const dPorch = exAddDays(dBuilt, wgInt(rng, 20, 28));
  const dDemol = dPorch;
  const dApply = exAddDays(dPorch, 4);
  const nb = (x) => exNum(x);
  const zeroSh = (v) => `${nb(v)}㎡`;

  const html =
    `<p><b>【出題の趣旨】</b>${nOldLand}の土地（以下「旧建物の土地」という。）には、登記記録のある建物が複数あり、そのうち1個は取り壊されて現存しない（以下「本件旧建物」という。）。` +
    `また、${newLand}の土地には、新築された建物（以下「本件新建物」という。）が現存している。土地家屋調査士${shiho}は、所有者${owner}から相談を受け、` +
    `【事実関係】のとおり事情を聴取し、必要となる全ての表示に関する登記の申請手続の代理並びに調査及び測量の依頼を受け、${dApply.text}、申請をした。</p>` +
    `<p><b>【問1】</b>本件旧建物に関する登記の申請書を完成させなさい（家屋番号は【登記記録】から特定する。申請件数は最も少なくなるようにする。）。</p>` +
    `<p><b>【問2】</b>${owner}から「今後、旧建物の土地の北側にある建物を、<b>解体移転</b>又は<b>えい行移転</b>の方法により、本件旧建物を取り壊した場所（同じ土地の中）に移動させようと考えているが、表示に関する登記ではそれぞれ手続が必要か」との質問を受けた。` +
    `解体移転の場合とえい行移転の場合のそれぞれについて、表示に関する登記の<b>申請義務の有無</b>と、義務があるときは<b>申請すべき登記の目的</b>を答えなさい。</p>` +
    `<p><b>【問3】</b>本件新建物に関する登記の申請書を完成させなさい。</p>` +
    `<p><b>【問4】</b>問3の申請書に添付する建物図面（500分の1）及び各階平面図（250分の1）を作図しなさい。（紙で作図し、採点後にチェック項目で確認する。）</p>` +
    `<p class="small">（注）1　本問における行為は全て適法に行われ、法律上必要な書類は全て適法に作成されているものとする。2　登記の申請は書面申請の方法による。` +
    `3　建物の測定値は、外壁等の隅角部を測定した距離で、隅角部は全て直角である。4　〔　〕内の距離は、敷地の筆界と建物の1階の外壁との距離である。` +
    `5　本件新建物は鉄骨造合金メッキ鋼板ぶきで、柱の外側に壁があり、壁の厚さは全ての部分で10センチメートル。壁の中心線は測定した隅角部から5センチメートル内側である。` +
    `6　各階の天井までの高さは全て2.7メートル以上である。7　外階段（1階から3階まで。2階で住戸A・Bの玄関に、3階で居宅の玄関に接続）並びに2階・3階のバルコニーは外気分断性を有しない。` +
    `エレベーター（2階の住戸B・3階の居宅への専用）の室は、各階の外形に含まれている。</p>` +
    `<p style="margin-top:12px"><b>【事実関係】</b></p>` +
    [
      `${owner}は、${shozai}${nOldLand}、${newLand}ほかの土地を所有し、${dBuilt.text}に本件新建物を新築して、建築業者から引渡しを受けた。その後、薬剤師である長男${son}に、1階と3階を賃貸した。`,
      `${owner}は${son}から、1階ポーチ（${nb(pw)}ｍ×${nb(pd)}ｍ。下の平面図の1階の外形に含まれる。）について、薬局への外気の吹込みを緩和するため新たに建具等を設置してほしいとの依頼を受け、` +
        `新築当初は外気分断性のなかったポーチに、外気分断性の備わった建具と壁を設置してエントランスとする工事を行い、${dPorch.text}に完成した。`,
      `現在、本件新建物の1階は薬局、2階は${owner}とその姉の共同住宅、3階は${son}の居宅として利用されている。${owner}は、本件新建物を区分建物でない建物として登記することを希望している。`,
      `本件旧建物の取壊し工事は${dDemol.text}に完了したが、${owner}は旧建物の家屋番号を失念していた。旧建物は木造瓦葺の平家建で、取壊し前の床面積は登記記録のとおり${zeroSh(oldA)}であった。その家屋番号の特定も依頼された。`,
      `${owner}は、申請件数が最も少なくなるように申請することを希望している。`,
    ]
      .map((t, i) => `<p>${i + 1}　${t}</p>`)
      .join("") +
    `<p class="small" style="margin-top:6px">〔本件新建物の平面（外壁の隅角部の測定値）〕</p>` +
    exTable(
      ["階", "東西（ｍ）", "南北（ｍ）", "用途"],
      [
        ["1階（ポーチ含む）", nb(W1), nb(D1), "薬局"],
        ["2階", nb(W2), nb(D2), "共同住宅（住戸A・B）"],
        ["3階", nb(W3), nb(D3), "居宅（住戸C）"],
      ],
    ) +
    `<p class="small" style="margin-top:4px">〔配置〕本件新建物は、土地の西側の筆界から${nb(ow)}ｍ、南側の筆界から${nb(os)}ｍの位置にある。土地は東西${nb(lw)}ｍ、南北${nb(ld)}ｍの長方形。</p>` +
    `<p style="margin-top:10px"><b>【登記記録（主である建物の表示・抜粋）】</b>所在はいずれも ${shozai}${nOldLand.replace("番", "番地")}。所有者はいずれも${owner}。</p>` +
    exTable(
      ["家屋番号", "種類", "構造", "床面積（㎡）"],
      recs.map((r) => [r.kaoku, r.shurui, r.kozo, r.yuka.length === 1 ? nb(r.yuka[0]) : `1階 ${nb(r.yuka[0])} ／ 2階 ${nb(r.yuka[1])}`]),
    );

  const tasks = [
    { label: "問3", q: `本件新建物の<b>1階</b>の床面積（㎡）（ポーチを含む）`, unit: "㎡", answer: A1, tol: 0.005, pts: 3, expl: `壁の中心線は隅角部から5cm内側なので各寸法−0.10ｍ。(${nb(W1)}−0.10)×(${nb(D1)}−0.10)＝<b>${nb(A1)}㎡</b>。外気分断性が備わったポーチは算入する。` },
    { label: "問3", q: `本件新建物の<b>2階</b>の床面積（㎡）`, unit: "㎡", answer: A2, tol: 0.005, pts: 3, expl: `(${nb(W2)}−0.10)×(${nb(D2)}−0.10)＝<b>${nb(A2)}㎡</b>。EV室は算入し、外階段・バルコニーは算入しない（準則82条6号・7号）。` },
    { label: "問3", q: `本件新建物の<b>3階</b>の床面積（㎡）`, unit: "㎡", answer: A3, tol: 0.005, pts: 3, expl: `(${nb(W3)}−0.10)×(${nb(D3)}−0.10)＝<b>${nb(A3)}㎡</b>。` },
  ];
  const mk = (sheetNo, f) => Object.assign({ sheetNo: sheetNo }, f);
  const none = ["不要", "金0円", "0円", "非課税", "課税なし"];
  const shurui = [sorted.join("・"), sorted.join("、"), sorted.join("，"), sorted.join("，")];
  const attAcc = ["建物図面", "各階平面図", "建物図面及び各階平面図", "建物図面、各階平面図", "建物図面・各階平面図", "所有権証明情報", "所有権を証する情報", "住所証明情報", "住所を証する情報", "住民票", "住民票の写し", "代理権限証明情報", "委任状"];
  const ownerAcc = [owner, `${shozai}${(newLand).replace("番", "番地")}${owner}`, `${shozai}${nOldLand.replace("番", "番地")}${owner}`];
  const kozoAcc = [kozoNew, "鉄骨造亜鉛メッキ鋼板ぶき3階建", "鉄骨造合金メッキ鋼板葺3階建", "鉄骨造亜鉛メッキ鋼板葺3階建"];
  const appForm = [
    mk(0, { label: "登記の目的", answer: ["建物滅失登記", "建物の滅失登記", "建物滅失の登記"], hint: "", pts: 3 }),
    mk(0, { label: "添付情報（①）", slot: "attach", answer: ["代理権限証明情報", "委任状"], hint: "", pts: 2 }),
    mk(0, { label: "申請人", answer: ownerAcc, hint: "", pts: 2 }),
    mk(0, { label: "登録免許税", answer: none, hint: "", pts: 2 }),
    mk(0, _wPre("tatemonoA", "所在", [shozai + nOldLand.replace("番", "番地")], 1)),
    mk(0, _wPre("tatemonoA", "家屋番号", [recs[0].kaoku], 5)),
    mk(0, _wCell("tatemonoA", 0, "gen", "原因及びその日付", [`${dDemol.text}取壊し`, `${dDemol.text}取り壊し`], 2, "")),
    mk(1, { label: "解体移転の場合：申請義務（有／無）", answer: ["有", "有り", "あり", "有る", "ある"], hint: "", pts: 3 }),
    mk(1, { label: "解体移転の場合：申請すべき登記の目的", answer: ["建物滅失登記、建物表題登記", "建物滅失登記・建物表題登記", "建物滅失、建物表題登記", "建物表題登記、建物滅失登記", "建物滅失の登記、建物の表題登記", "建物滅失登記及び建物表題登記"], hint: "", pts: 4 }),
    mk(1, { label: "えい行移転の場合：申請義務（有／無）", answer: ["無", "無し", "なし", "ない", "無い"], hint: "", pts: 3 }),
    mk(2, { label: "登記の目的", answer: ["建物表題登記", "建物の表題登記"], hint: "", pts: 3 }),
    mk(2, { label: "添付情報（①）", slot: "attach", answer: attAcc, hint: "", pts: 2 }),
    mk(2, { label: "添付情報（②）", slot: "attach", answer: attAcc, hint: "", pts: 2 }),
    mk(2, { label: "添付情報（③）", slot: "attach", answer: attAcc, hint: "", pts: 2 }),
    mk(2, { label: "添付情報（④）", slot: "attach", answer: attAcc, hint: "", pts: 2 }),
    mk(2, { label: "添付情報（⑤）", slot: "attach", answer: attAcc, hint: "", pts: 1 }),
    mk(2, { label: "申請人", answer: ownerAcc, hint: "", pts: 2 }),
    mk(2, { label: "登録免許税", answer: none, hint: "", pts: 2 }),
    mk(2, _wPre("tatemono", "所在", [sx], 1)),
    mk(2, _wPre("tatemono", "家屋番号", [kaokuNew], 2)),
    mk(2, _wCell("tatemono", 0, "shufuku", "主である建物又は附属建物", ["主である建物", "主"], 1, "")),
    mk(2, _wCell("tatemono", 0, "shurui", "種類", shurui, 4, "")),
    mk(2, _wCell("tatemono", 0, "kozo", "構造", kozoAcc, 3, "")),
    mk(2, _wCell("tatemono", 0, "yuka", "床面積", wgFloorsAccepts([A1, A2, A3]), 6, "")),
  ];

  const by = exRound(y0 + ow);
  const xS = exRound(x0 + os);
  const R1 = [[xS, by], [exRound(xS + D1), by], [exRound(xS + D1), exRound(by + W1)], [xS, exRound(by + W1)]];
  const R2 = [[xS, by], [exRound(xS + D2), by], [exRound(xS + D2), exRound(by + W2)], [xS, exRound(by + W2)]];
  const R3 = [[xS, by], [exRound(xS + D3), by], [exRound(xS + D3), exRound(by + W3)], [xS, exRound(by + W3)]];
  const figure = {
    points: { A: LA, B: LB, C: LC, D: LD },
    polys: [["A", "B", "C", "D"]],
    holes: [
      { poly: R1, label: "1階" },
      { poly: R2, label: "2階" },
      { poly: R3, label: "3階" },
    ],
    lines: [],
    revealPoints: [],
    areaLabels: [{ at: [x0 + os + D1 / 2, by + W1 / 2], text: `1階 ${nb(A1)}㎡` }],
  };
  return {
    statement: html,
    coords: [],
    tasks: tasks,
    appForm: appForm,
    sheetTitles: { 0: "申請書（問1：本件旧建物の滅失）", 1: "問2（建物の移転）", 2: "申請書（問3：本件新建物）" },
    figure: figure,
    figureChecks: [
      "建物図面は500分の1、各階平面図は250分の1で作図した（規則82条3項・83条2項）",
      "建物図面に方位、敷地の地番とその形状、隣接地の地番を記入した（規則82条2項）",
      "建物の1階の位置・形状を筆界からの距離（小数第1位まで）で示した",
      "各階平面図に各階の別、各階の形状、1階の位置を記入し、ポーチを1階の形状に含めた",
      "各階ごとに床面積と求積方法を壁の中心線で記入した",
      "外階段・バルコニーを床面積に含めていない（EV室は含めた）",
    ],
    articleFill: null,
    verify: {
      kind: "exam-r2-tatemono",
      dims: { W1, D1, W2, D2, W3, D3, t, pw, pd },
      areas: { A1, A2, A3 },
      order: sorted,
      recs: recs,
      oldA,
      site: { A: LA, B: LB, C: LC, D: LD, ow, os, lw, ld },
      figure: { R1, R2, R3 },
    },
  };
}

// ─────────── 令和1年度 第21問（土地）の型 ───────────
// 事案: 周囲を塀で囲まれた1筆の宅地（本件土地）の東側の庭が家庭菜園になっている。道路拡幅計画のため、南側の細長い部分（乙区画）を
//   道路用地として、東側（丙区画）を子の建築用地として、それぞれ分筆する。分割線ＥＧは道路側の分割線ＦＨに垂直にする。
//   実測した地積が登記記録の地積と公差を超えて違うかどうかで、地積更正が要るか決まる。
//   別の設問で、過去に北側の隣地の共有者の一人が単独で申請した筆界特定について、対象土地・関係土地・関係人を答える。
// 設問: 問1 Ｄ点（観測値）・Ｇ点（Ｅから分割線ＦＨへの垂線の足）の座標、問2 筆界特定の対象土地・関係土地・関係人、
//   問3 分筆（と、必要なら地積更正）の申請書、問4 地積測量図（紙）。
//
// 本型で設定する前提（本試験は図で示す）: 本件土地全体として宅地であり、家庭菜園は一時的な利用で丙区画には建物を新築する予定なので、
//   地目変更の登記は要しない（地目の認定は準則68条柱書で現況及び利用目的に重点を置き、部分的なわずかな差異は土地全体で見る、とあるのを根拠にした判断）。
//   筆界特定の隣接関係は、図ではなく文章で与える（点Ｐ・Ｑに接する土地を明記）。
//
// 根拠: 法123条3号・4号（対象土地・関係土地）、法133条1項（関係人＝対象土地の所有権登記名義人等のうち申請人以外、及び関係土地の所有権登記名義人等）、
//   法131条1項（共有者の一人でも所有権登記名義人等として申請できる）、規則10条4項1号（市街地は甲二）、国土調査法施行令 別表第四（公差）、
//   登録免許税法 別表第一 一(十三)イ（分筆後の個数×1,000円。地積更正は非課税）、規則100条（宅地の地積）、規則35条7号（更正と分筆は一の申請情報）。
function exEraText(date) {
  // 元号の境目: 令和＝2019-05-01以降、平成＝1989-01-08以降、それ以前は昭和（過去の日付の表記に使う）
  const ad = date.y + EX_REIWA_OFFSET;
  const key = ad * 10000 + date.m * 100 + date.d;
  const nen = (y) => (y === 1 ? "元" : y);
  if (key >= 20190501) return `令和${nen(ad - 2018)}年${date.m}月${date.d}日`;
  if (key >= 19890108) return `平成${nen(ad - 1988)}年${date.m}月${date.d}日`;
  return `昭和${nen(ad - 1925)}年${date.m}月${date.d}日`;
}

function exBuildR1Land(rng) {
  // 1. 形状（局所座標 p＝東、q＝北 → 世界座標）。南が道路 ----------------------------------------
  const phi = (exU(rng, -28, 28) * Math.PI) / 180;
  const X0 = exU(rng, 270, 300);
  const Y0 = exU(rng, 280, 310);
  const wld = (p, q) => [
    exRound(X0 + q * Math.cos(phi) - p * Math.sin(phi)),
    exRound(Y0 + p * Math.cos(phi) + q * Math.sin(phi)),
  ];
  const W = exU(rng, 16, 21);
  const qA = exU(rng, 10.2, 12);
  const qB = qA + exU(rng, 1.4, 2.6);
  const cj = exU(rng, 0.12, 0.38);
  const A = wld(0, qA);
  const B = wld(W, qB);
  const C = wld(W, cj);
  const D0 = wld(0, 0);
  const t1p = -exU(rng, 2.6, 4);
  const t1q = -exU(rng, 2.6, 3.8);
  const T1 = wld(t1p, t1q);
  const T2 = wld(t1p + exU(rng, 14, 16), t1q + exU(rng, -0.3, 0.4));
  // Ｄは観測値（器械点Ｔ1、後視Ｔ2）から求めさせる。観測値を丸めてから再計算した値を正解にする。
  const b1 = exBearing(T1, T2);
  const ang = (exBearing(T1, D0) - b1 + 2 * Math.PI) % (2 * Math.PI);
  const obsD = { sec: Math.round((ang * 180 * 3600) / Math.PI), dist: exRound(exDist(T1, D0)) };
  const brD = b1 + (obsD.sec / 3600) * (Math.PI / 180);
  const D = [exRound(T1[0] + obsD.dist * Math.cos(brD)), exRound(T1[1] + obsD.dist * Math.sin(brD))];
  // 2. Ｆ（ＡＤ上）・Ｈ（ＢＣ上）・Ｅ（ＡＢ上）・Ｇ（ＥからＦＨへの垂線の足）----------------------------
  const lerp = (P, Q, s) => [exRound(P[0] + (Q[0] - P[0]) * s), exRound(P[1] + (Q[1] - P[1]) * s)];
  const lenAD = exDist(A, D);
  const lenBC = exDist(B, C);
  const F = lerp(D, A, exU(rng, 0.9, 1.15) / lenAD);
  const H = lerp(C, B, exU(rng, 1.0, 1.45) / lenBC);
  const E = lerp(A, B, exU(rng, 0.55, 0.68));
  const fh = [H[0] - F[0], H[1] - F[1]];
  const tG = ((E[0] - F[0]) * fh[0] + (E[1] - F[1]) * fh[1]) / (fh[0] * fh[0] + fh[1] * fh[1]);
  if (!(tG > 0.25 && tG < 0.85)) return null;
  const G = [exRound(F[0] + tG * fh[0]), exRound(F[1] + tG * fh[1])];
  const polyKou = [A, E, G, F];
  const polyHei = [B, H, G, E];
  const polyOtsu = [C, D, F, G, H];
  const polyAll = [A, B, C, D];
  const rawKou = wgArea(polyKou);
  const rawHei = wgArea(polyHei);
  const rawOtsu = wgArea(polyOtsu);
  if (!(rawKou > 60 && rawHei > 15 && rawOtsu > 12)) return null;
  const aKou = wgChiseki(rawKou, "宅地");
  const aHei = wgChiseki(rawHei, "宅地");
  const aOtsu = wgChiseki(rawOtsu, "宅地");
  const whole = wgChiseki(wgArea(polyAll), "宅地");

  // 3. 公差と更正の要否（本件土地全体。市街地＝甲二）-------------------------------------------------
  const seido = "甲二";
  const needKousei = rng() < 0.65;
  let rec = whole;
  for (let i = 0; i < 3; i++) {
    const k = wgKosaShown(rec, seido);
    const gap = needKousei ? k * exU(rng, 1.5, 2.8) : k * exU(rng, 0.1, 0.6);
    rec = exRound(whole + (rng() < 0.5 ? -gap : gap));
  }
  const kRec = wgKosaShown(rec, seido);
  if (needKousei ? Math.abs(rec - whole) < kRec * 1.25 : Math.abs(rec - whole) > kRec * 0.75) return null;
  // 公差を超えないときの甲区画（原番に当たる土地）は、登記記録の地積から差し引いた値も正解にする。
  const aKouAlt = exRound(rec - aOtsu - aHei);

  // 4. 当事者・場所・隣接関係 ------------------------------------------------------------------
  const used = new Set();
  const person = (g) => {
    let p;
    do {
      p = g ? wgPerson(rng, g) : wgPerson(rng);
    } while (used.has(p));
    used.add(p);
    return p;
  };
  const owner = person();
  const daughter = person("f");
  const shiho = person();
  const city = wgPick(rng, EX_CITIES);
  const town = wgPick(rng, EX_TOWNS) + wgPick(rng, EX_CHOME);
  const shozai = city + town;
  const n = wgInt(rng, 12, 60);
  const nHonken = `${n}番`;
  const nKou = `${n}番1`;
  const nOtsu = `${n}番2`;
  const nHei = `${n}番3`;
  const addr = `${shozai}${n}番地1`;
  const dApply = wgDate(rng);
  const dVeg = exAddDays(dApply, -wgInt(rng, 1500, 2300));
  const dMeasure = exAddDays(dApply, -wgInt(rng, 25, 40));
  const nb = (v) => exNum(v);
  const kosaRows = ["甲一", "甲二", "甲三", "乙一", "乙二", "乙三"];

  // 筆界特定の事案（本件土地とＬ番の土地の筆界。Ｌ番は共有で、共有者の一人が単独で申請した）
  const nL = `${n + 1}番`;
  const nNP = `${n - 2}番${wgInt(rng, 20, 40)}`;
  const nNW = `${n - 3}番${wgInt(rng, 1, 9)}`;
  const nNE = `${n + 2}番`;
  const nRoad = `${wgInt(rng, 95, 130)}番`;
  const applicant = person();
  const coL = person("f");
  const ownerNP = rng() < 0.5 ? [person(), person("f")] : [person()];
  const ownerNW = rng() < 0.5 ? [person(), person("f")] : [person()];
  const ownerNE = [person()];
  const lots = [
    { no: nNW, owners: ownerNW, shared: ownerNW.length > 1 },
    { no: nNP, owners: ownerNP, shared: ownerNP.length > 1 },
    { no: nHonken, owners: [owner], shared: false },
    { no: nL, owners: [applicant, coL], shared: true },
    { no: nNE, owners: ownerNE, shared: false },
    { no: nRoad, owners: [city], shared: false },
  ];
  const touchP = [nNP]; // 点Ｐ（北端）で本件筆界の両側の土地と接する土地
  const touchQ = [nRoad]; // 点Ｑ（南端、道路との交点）
  const taisho = [nHonken, nL];
  const kankeiTochi = lots.map((l) => l.no).filter((x) => (touchP.includes(x) || touchQ.includes(x)) && !taisho.includes(x));
  const kankeinin = [];
  lots.forEach((l) => {
    const inTaisho = taisho.includes(l.no);
    const inKankei = kankeiTochi.includes(l.no);
    l.owners.forEach((o) => {
      if (inKankei || (inTaisho && o !== applicant)) kankeinin.push(o);
    });
  });
  const ownerRows = lots.map((l) => [l.no, l.owners.map((o, i) => `${o}${l.shared ? "　持分2分の1" : ""}`).join("<br>")]);

  const html =
    `<p><b>【出題の趣旨】</b>土地家屋調査士${shiho}は、${shozai}${nHonken}の土地（以下「本件土地」という。）の所有者である${owner}から、本件土地の表示に関する登記の相談を受け、` +
    `【聴取記録の概要】のとおり事情を聴取し、必要となる表示に関する登記の申請手続の代理並びに調査及び測量の依頼を受け、【調査及び測量の結果の概要】のとおり調査及び測量を行った。</p>` +
    `<p class="small">〔調査図素図の注〕Ａ・Ｂ・Ｃ・Ｄ・Ｆ・Ｈ点は筆界点で、本件土地はＡ・Ｂ・Ｃ・Ｄを順次結んだ範囲。Ｆ点はＡ点とＤ点を結ぶ直線上、Ｈ点はＢ点とＣ点を結ぶ直線上、Ｅ点はＡ点とＢ点を結ぶ直線上、Ｇ点はＦ点とＨ点を結ぶ直線上の点。` +
    `道路はＣ・Ｄを結ぶ側（南）にある。</p>` +
    `<p><b>【問1】</b>【聴取記録の概要】及び【調査及び測量の結果の概要】から、〔調査図素図〕上の<b>Ｄ点及びＧ点の座標値</b>を求めなさい。</p>` +
    `<p><b>【問2】</b>次の〔筆界特定の事案〕について、筆界特定の手続における⑴対象土地の地番、⑵関係土地の地番、⑶関係人の氏名又は名称を答えなさい（複数あるときは〔隣地所有者一覧〕の掲載順に1つずつ書く。地番は筆界特定の手続の時点のもの）。</p>` +
    `<p class="small" style="margin-top:6px"><b>〔筆界特定の事案〕</b>本件土地と${nL}の土地の筆界（北端を点Ｐ、南端を点Ｑとし、点Ｑは道路との交点。以下「本件筆界」という。）について、平成の頃、${nL}の土地の共有者の一人であった${applicant}が、単独で筆界特定を申請し、筆界が特定された。` +
    `点Ｐでは、本件土地・${nL}の土地・${nNP}の土地の3筆の筆界が集まっている。点Ｑでは、本件土地・${nL}の土地・${nRoad}の土地（道路）の3筆の筆界が集まっている。` +
    `${nNW}の土地は本件土地の北西側に接するが点Ｐには接しない。${nNE}の土地は${nL}の土地の東側に接するが点Ｐにも点Ｑにも接しない。</p>` +
    `<p class="small" style="margin-top:6px">〔隣地所有者一覧〕（筆界特定の手続の時点）</p>` +
    exTable(["地番", "所有権の登記名義人"], ownerRows) +
    `<p><b>【問3】</b>依頼を受けた本件土地の登記の申請書を完成させなさい。ただし、分筆の登記以外に必要な土地の表示に関する登記があるときは、一の申請情報により申請する。` +
    `また、地積は、測量の結果である座標値を用いて座標法により求積する。</p>` +
    `<p><b>【問4】</b>問3の申請書に添付する<b>地積測量図</b>を、250分の1の縮尺で作図しなさい。（紙で作図し、採点後にチェック項目で確認する。）</p>` +
    `<p class="small" style="margin-top:10px">（注）1　本問における行為は全て適法に行われ、法律上必要な書類は全て適法に作成されているものとする。2　登記の申請は書面申請の方法による。` +
    `3　座標値は小数第3位を四捨五入して第2位まで。4　地積測量図は250分の1で、筆界点間の距離を小数第2位まで記載する。` +
    `5　各筆界点の座標値、平面直角座標系の番号、地積及び求積方法並びに測量年月日は、地積測量図に記載しなくてよい。6　市基準点は点名を付して記載し、座標値は不要。</p>` +
    `<p style="margin-top:12px"><b>【聴取記録の概要】</b></p>` +
    [
      `${addr}に住所を有する${owner}は、本件土地にある家屋番号${n}番の建物（以下「本件建物」という。）に居住している。`,
      `本件土地は周囲をブロック塀に囲まれている。本件建物の東側の庭では、${owner}が${exEraText(dVeg)}から野菜などを栽培して家庭菜園として利用しているが、建物の敷地部分と家庭菜園の部分を区別する柵や囲いはない。`,
      `${city}の道路拡幅計画により、今後建物を新築するときは、隣接する土地と同様に、本件土地の南側の土地（Ｃ・Ｄ・Ｆ・Ｇ・Ｈ・Ｃの各点を順次結んだ部分。「乙区画」）を分筆して道路として使えるようにしなければならない。`,
      `${owner}は、娘の${daughter}に、道路拡幅工事が1年後に始まることを相談し、これを契機に、本件土地の東側の土地（Ｂ・Ｈ・Ｇ・Ｅ・Ｂの各点を順次結んだ部分。「丙区画」）を分筆し、丙区画に抵当権を設定して建築資金の融資を受け、${daughter}が丙区画に建物を新築することになった。` +
        `道路となる乙区画も同時に分筆し、西側の土地（Ａ・Ｅ・Ｇ・Ｆ・Ａの各点を順次結んだ部分。「甲区画」）に本件建物をそのまま残すこととした。丙区画の建物の新築は拡幅工事の完了後に行う予定で、それまでは${owner}が丙区画を家庭菜園として利用する。`,
      `${owner}は、甲区画と丙区画を分ける線（Ｅ点とＧ点を結ぶ直線）が、甲区画及び丙区画と乙区画を分ける線（Ｆ・Ｇ・Ｈ点を順次結ぶ線）の<b>垂線</b>になることを希望している。`,
    ]
      .map((t, i) => `<p>${i + 1}　${t}</p>`)
      .join("") +
    `<p style="margin-top:12px"><b>【調査及び測量の結果の概要】</b></p>` +
    `<p>1　資料に関する調査の結果</p>` +
    `<p class="small">⑴　登記記録（本件土地）　所在 ${shozai}、地番 ${nHonken}、地目 宅地、地積 ${nb(rec)}㎡。（甲区）${addr}　${owner}。（乙区）登記事項なし。　本件建物は居宅（所有者${owner}）で、建物図面が備え付けられている。</p>` +
    `<p class="small">⑵　地図等　本件土地の地域には、不動産登記法第14条第4項の地図に準ずる図面が備え付けられている。本件土地の地域は、不動産登記規則第10条第2項第1号の<b>市街地地域</b>に属する。</p>` +
    `<p class="small">⑶　図面等　隣接地の地積測量図が備え付けられている。${city}道路管理課で道路境界を調査したところ、本件土地については道路境界の確認がされていた。</p>` +
    `<p class="small">⑷　分筆の予定地番　登記所で、甲区画を${nKou}、乙区画を${nOtsu}、丙区画を${nHei}とする予定地番を確認した。</p>` +
    `<p class="small">⑸　地積測定の公差（登記記録上の地積 ${nb(rec)}㎡ に対する値。地域に応じた精度区分を選ぶ）</p>` +
    exTable(["区分"].concat(kosaRows), [["本件土地"].concat(kosaRows.map((q) => `${nb(wgKosaShown(rec, q))}㎡`))]) +
    `<p>2　利用状況、境界標の状況並びに立会い及び測量の結果</p>` +
    `<p class="small">⑴　本件土地の利用状況は【聴取記録の概要】のとおり。本件土地全体として建物の敷地及びその維持・効用に必要な土地であり、家庭菜園は一時的な利用で丙区画にも建物を新築する計画であるため、地目の変更の登記は要しない（地目は宅地のまま）。<br>` +
    `⑵　Ａ点・Ｂ点には石杭が、Ｃ・Ｄ・Ｆ・Ｈ点にはコンクリート杭が設置されている。<br>` +
    `⑶　${city}道路管理課職員及び隣接土地所有者から、道路及び隣接する境界の確認が得られた。今回の測量の結果と市備付の道路境界図は一致している。Ｅ点・Ｇ点は分筆点で、Ｅ点には金属標を、Ｇ点にはコンクリート杭を設置する。` +
    `現地の境界標と、登記所備付の地積測量図の成果は整合している。<br>` +
    `⑷　市基準点Ｔ1・Ｔ2の点検測量を行い、許容誤差内であることを確認した（${exEraText(dMeasure)}）。成果表の値で筆界点を観測し、観測値と座標値を得た。</p>` +
    `<p class="small">ア　〔市基準点成果表〕</p>` +
    exTable(["名称", "Ｘ座標（ｍ）", "Ｙ座標（ｍ）"], [["Ｔ1", T1], ["Ｔ2", T2]].map(([nm, p]) => [nm, nb(p[0]), nb(p[1])])) +
    `<p class="small" style="margin-top:6px">イ　〔測量によって得られた観測値〕</p>` +
    exTable(["器械点", "後視点", "測点", "観測角", "水平距離（ｍ）"], [
      ["Ｔ1", "Ｔ2", "Ｔ2", "0°00′00″", "－"],
      ["Ｔ1", "Ｔ2", "Ｄ", exDmsText(obsD.sec), nb(obsD.dist)],
    ]) +
    `<p class="small">（注）観測角は時計回りの角度を示す。北はＸ軸の正方向に一致する。</p>` +
    `<p class="small">ウ　〔測量によって得られた座標値〕（Ｄ点・Ｇ点は省略）</p>` +
    exTable(["名称", "Ｘ座標（ｍ）", "Ｙ座標（ｍ）"], [["Ａ", A], ["Ｂ", B], ["Ｃ", C], ["Ｅ", E], ["Ｆ", F], ["Ｈ", H]].map(([nm, p]) => [nm, nb(p[0]), nb(p[1])]));

  // 5. 設問の答え --------------------------------------------------------------------------------
  const tol = 0.011;
  const tasks = [
    { label: "問1", q: `Ｄ点のＸ座標（Ｔ1から後視Ｔ2の方向角に観測角を加え、距離から求める）`, unit: "m", answer: D[0], tol, pts: 3, expl: `Ｔ1→Ｔ2の方向角に観測角${exDmsText(obsD.sec)}を加えた方向角と距離${nb(obsD.dist)}ｍから、X＝Ｔ1のX＋距離×cos(方向角)＝<b>${nb(D[0])}</b>。` },
    { label: "問1", q: `Ｄ点のＹ座標`, unit: "m", answer: D[1], tol, pts: 3, expl: `Y＝Ｔ1のY＋距離×sin(方向角)＝<b>${nb(D[1])}</b>。` },
    { label: "問1", q: `Ｇ点のＸ座標（Ｇは直線ＦＨ上で、ＥＧ⊥ＦＨ）`, unit: "m", answer: G[0], tol: 0.02, pts: 4, expl: `ＦＨ上の点Ｇをパラメータで表し、ＥＧとＦＨの内積＝0から求める。X＝<b>${nb(G[0])}</b>。（丸めた値で解くため±0.02まで正解としている。）` },
    { label: "問1", q: `Ｇ点のＹ座標`, unit: "m", answer: G[1], tol: 0.02, pts: 4, expl: `Y＝<b>${nb(G[1])}</b>。` },
    { label: "問3の前提", q: `本件土地全体の地積（㎡、座標法・0.01㎡未満切捨て。多角形はＡ-Ｂ-Ｃ-Ｄ）`, unit: "㎡", answer: whole, tol: 0.05, pts: 3, expl: `Ａ-Ｂ-Ｃ-Ｄの面積。宅地は0.01㎡未満を切り捨てる（規則100条）。<b>${nb(whole)}㎡</b>。` },
    { label: "問3の前提", q: `登記記録の地積${nb(rec)}㎡に対する市街地地域（甲二）の公差（㎡）`, unit: "㎡", answer: kRec, tol: 0.005, pts: 3, expl: `市街地地域は精度区分甲二まで（規則10条4項1号）。公差は<b>${nb(kRec)}㎡</b>。実測との差${nb(exRound(Math.abs(rec - whole)))}㎡は公差${needKousei ? "を超える" : "の範囲内"}。` },
  ];
  const mk = (sheetNo, f) => Object.assign({ sheetNo: sheetNo }, f);
  const yesAns = ["必要", "必要がある", "要", "あり"];
  const noAns = ["不要", "必要がない", "否", "なし"];
  const attachAcc = ["地積測量図", "代理権限証明情報", "委任状"];
  const kouAcc = wgChisekiAccepts(aKou, "宅地").concat(!needKousei && aKouAlt !== aKou ? wgChisekiAccepts(aKouAlt, "宅地") : []);
  const appForm = [
    mk(0, { label: "登記の目的", answer: needKousei ? ["土地分筆、土地地積更正登記", "土地分筆・土地地積更正登記", "土地地積更正、土地分筆登記", "土地地積更正・分筆登記", "土地地積更正、分筆登記", "土地分筆、地積更正登記", "土地地積更正分筆登記"] : ["土地分筆登記", "分筆登記"], hint: "", pts: 3 }),
    mk(0, { label: "申請人", answer: [owner, `${addr}${owner}`, `${addr}　${owner}`], hint: "", pts: 3 }),
    mk(0, { label: "添付情報（①）", slot: "attach", answer: attachAcc, hint: "", pts: 2 }),
    mk(0, { label: "添付情報（②）", slot: "attach", answer: attachAcc, hint: "", pts: 2 }),
    mk(0, { label: "登録免許税", answer: wgYenAccepts(3000), hint: "", pts: 3 }),
    mk(0, _wPre("tochi", "所在", [shozai], 1)),
    mk(0, _wCell("tochi", 0, "chiban", "1行目の地番", [nKou], 1, "")),
    mk(0, _wCell("tochi", 0, "chimoku", "1行目の地目", ["宅地"], 1, "")),
    mk(0, _wCell("tochi", 0, "chiseki", "1行目の地積", kouAcc, 3, "")),
    mk(0, _wCell("tochi", 1, "chiban", "2行目の地番", [nOtsu], 1, "")),
    mk(0, _wCell("tochi", 1, "chimoku", "2行目の地目", ["宅地"], 1, "")),
    mk(0, _wCell("tochi", 1, "chiseki", "2行目の地積", wgChisekiAccepts(aOtsu, "宅地"), 3, "")),
    mk(0, _wCell("tochi", 2, "chiban", "3行目の地番", [nHei], 1, "")),
    mk(0, _wCell("tochi", 2, "chimoku", "3行目の地目", ["宅地"], 1, "")),
    mk(0, _wCell("tochi", 2, "chiseki", "3行目の地積", wgChisekiAccepts(aHei, "宅地"), 3, "")),
  ];
  taisho.forEach((x, i) => appForm.push(mk(1, { label: `⑴ 対象土地の地番（${i + 1}つ目）`, answer: [x], hint: "隣地所有者一覧の掲載順", pts: 3 })));
  kankeiTochi.forEach((x, i) => appForm.push(mk(1, { label: `⑵ 関係土地の地番（${i + 1}つ目）`, answer: [x], hint: "隣地所有者一覧の掲載順", pts: 3 })));
  kankeinin.forEach((x, i) => appForm.push(mk(1, { label: `⑶ 関係人の氏名又は名称（${i + 1}人目）`, answer: [x], hint: "隣地所有者一覧の掲載順（申請人は除く）", pts: 2 })));
  appForm.push(mk(2, { label: "分筆と併せて地積更正の登記は（必要／不要）", answer: needKousei ? yesAns : noAns, hint: "登記記録の地積と実測の地積の差を、地域に応じた精度区分の公差と比べる", pts: 3 }));

  const cx = (...P) => [P.reduce((a, q) => a + q[0], 0) / P.length, P.reduce((a, q) => a + q[1], 0) / P.length];
  const figure = {
    points: { A, B, C, D, E, F, G, H, T1, T2 },
    polys: [["A", "B", "C", "D"]],
    lines: [["E", "G"], ["F", "H"]],
    revealPoints: ["D", "G"],
    areaLabels: [
      { at: cx(A, E, G, F), text: `${nKou} ${nb(aKou)}㎡` },
      { at: cx(B, H, G, E), text: `${nHei} ${nb(aHei)}㎡` },
      { at: cx(C, D, F, G, H), text: `${nOtsu} ${nb(aOtsu)}㎡` },
    ],
  };
  return {
    statement: html,
    coords: [],
    tasks: tasks,
    appForm: appForm,
    sheetTitles: { 0: "申請書（問3）", 1: "問2（筆界特定）", 2: "判断の設問" },
    figure: figure,
    figureChecks: wgFigChecks("chisekiSokuryo", [
      "分筆線ＥＧ・ＦＨ（Ｆ・Ｇ・Ｈ）を記入し、ＥＧがＦＨに垂直になるようにＧ点を取った",
      `分筆後の地番（甲区画${nKou}、乙区画${nOtsu}、丙区画${nHei}）を記入した`,
      "Ｄ点・Ｇ点の位置と、筆界点間の距離（小数第2位）を記入した",
      "市基準点Ｔ1・Ｔ2の点名を記入した（座標値は不要）",
      "隣接地の地番と、道路を記入した",
    ]),
    articleFill: null,
    verify: {
      kind: "exam-r1-land",
      pts: { A, B, C, D, E, F, G, H, T1, T2 },
      obs: { sec: obsD.sec, dist: obsD.dist },
      areas: { aKou, aOtsu, aHei, whole, aKouAlt },
      rec: { rec, kRec },
      needKousei,
      owner,
      applicant,
      lots,
      touchP,
      touchQ,
      taisho,
      honken: nHonken,
    },
  };
}

// ─────────── 令和1年度 第22問（建物）の型 ───────────
// 事案: 2筆（23番1は他人所有で地上権の設定を受け、23番2は自社所有）にまたがる、1・2階が広く3階以上が細くなる鉄筋コンクリート造の
//   一棟の建物（3個の区分建物：甲＝1・2階の中央部分、乙＝1・2階の東側、丙＝3階以上）と、機械式の立体駐車場（甲の附属建物）が新築された。
//   原始規約で、各専有部分の敷地利用権の割合を2筆それぞれについて定めている。
// 設問: 問1 甲区分建物の表題登記の申請書（一棟の建物の表示・敷地権の目的である土地・敷地権の表示を含む）、
//   問2 一棟の建物の名称を変更したときの登記の目的・期間・罰則、問3 建物図面・各階平面図（紙）。
//
// 本型で設定する前提（本試験は図で示す）: 寸法は壁の中心間の距離で壁の厚さは20cm。専有部分は壁の内側線（規則115条）で、
//   階段室は共用部分で、専有部分から除く（階段室の欠け込みは6m前後×3m前後）。屋上の塔屋は本型では出さない（階数・床面積の扱いを
//   条文で確認できなかったため）。駐車場は、格納部分に床がなく、階数1の建物（平家建）として扱う前提を問題文に書く。
//   一棟の建物の床面積は壁の中心線で測る（規則115条は区分建物の専有部分のみを内側線とする書き方で、一棟全体の測り方を明示した条文は確認していない。令和3年度型と同じ扱い）。
//   敷地権の原因及びその日付、区分した建物・一棟の建物の原因欄、駐車場の所在は、根拠を確認できないか表が持たないので採点しない。
//
// 根拠: 法44条1項7〜9号、法48条1項（区分建物の表題登記は同じ一棟の建物の全区分建物と併せて申請）、令別表十二の項（添付情報。ホ・ヘ（2）規約証明情報）、
//   規則36条1項1号（会社法人等番号を用いないときは資格証明の登記事項証明書）、規則112条・準則79条（家屋番号。2筆にまたがる一棟の建物の一部は
//   床面積の多い部分の存する敷地の地番に支号）、規則113条（種類は車庫・事務所など。2以上の用途は2以上）、規則114条（構造）、
//   規則115条（区分建物の床面積は内側線）、準則82条6号・7号（階段室は算入・屋外階段は算入しない）、準則90条（区分建物の階数）、準則93条（原因欄の記録を要しない場合）、
//   法51条1項・5項・44条1項8号・法164条1項（一棟の建物の名称の変更の登記は1月以内、過料は10万円以下）。
function exBuildR1Tatemono(rng) {
  const t10 = (a, b) => wgInt(rng, a, b) / 10;
  const r1 = (v) => Math.round(v * 10) / 10;
  const wl = t10(45, 60); // 1・2階の西側の廊下の幅（壁芯）
  const wA = t10(175, 220); // 甲（中央部分）の東西
  const hA = t10(170, 210); // 甲・乙の南北
  const hb = t10(30, 40); // 南側のホールの幅
  const ht = t10(30, 40); // 北側のホール・EV・PSの帯の幅
  const g = t10(10, 20); // 乙の階段室の西側の余り
  const ns = t10(54, 64); // 階段室の東西（乙・丙とも）
  const nh = t10(30, 38); // 階段室の南北
  const wH = t10(100, 130); // 3階以上の北側のホールの東西
  const N = wgInt(rng, 5, 9); // 階数
  const wI = r1(g + ns); // 乙の東西
  const Wl = r1(wl + wA + wI); // 1・2階の東西
  const Hc = r1(hb + hA + ht); // 南北
  const Wu = r1(wH + ns); // 3階以上の東西（東端にそろう）
  if (!(Wu < Wl - 4)) return null;
  const A1 = exFloor2(Wl * Hc);
  const Au = exFloor2(Wu * Hc);
  const aKou = exFloor2((wA - 0.2) * (hA - 0.2));
  const aOtsu = exFloor2((wI - 0.2) * (hA - 0.2) - ns * nh);
  const aHei = exFloor2((Wu - 0.2) * (Hc - ht - 0.2) - ns * nh);
  const tw = t10(65, 85);
  const td = t10(55, 70);
  const At = exFloor2(tw * td);

  // 敷地（2筆。23番1が西、23番2が東）と配置 -------------------------------------------------------
  const ox = t10(80, 140); // 建物の西端と西側の筆界の距離
  const oy = t10(30, 50); // 建物の南端と南側の筆界の距離
  const nm = t10(30, 60);
  const ld = Math.ceil((oy + Hc + nm) * 2) / 2;
  const bEast = r1(ox + Wl);
  const w1 = Math.round((ox + Wl * exU(rng, 0.55, 0.85)) * 2) / 2;
  if (!(w1 > ox + 3 && w1 < bEast - 3)) return null;
  const gE = 1.5; // 駐車場と東側の筆界の距離
  const w2min = bEast - w1 + 1 + tw + gE;
  const w2 = Math.ceil((w2min + exU(rng, 0, 3)) * 2) / 2;
  const landA1 = exFloor2(w1 * ld);
  const landA2 = exFloor2(w2 * ld);
  // 家屋番号は、床面積の多い部分の存する敷地の地番（準則79条6号）。各階の水平投影で比べる。
  const clip1F = Math.min(Wl, w1 - ox);
  const upW0 = bEast - Wu;
  const clipU = Math.max(0, Math.min(Wu, w1 - upW0));
  const s1 = Hc * (2 * clip1F + (N - 2) * clipU);
  const s2 = Hc * (2 * (Wl - clip1F) + (N - 2) * (Wu - clipU));
  // 1階だけで見ても全階で見ても西の土地（23番1）の方が床面積の多い部分になる組に限る。
  // 準則79条6号（家屋番号）と準則88条2項（所在の地番の順）の読み方が割れないようにするため。
  if (!(clip1F > Wl - clip1F) || (s1 - s2) / (s1 + s2) < 0.08) return null;
  const bigLot = 1;

  // 当事者・場所 ---------------------------------------------------------------------------------
  const rep = wgPerson(rng, "m");
  const shiho = wgPerson(rng, "f");
  const city = wgPick(rng, EX_CITIES);
  const town = wgPick(rng, EX_TOWNS);
  const shozai = `${city}${town}一丁目`;
  const nb = wgInt(rng, 10, 60);
  const lot1 = `${nb}番1`;
  const lot2 = `${nb}番2`;
  const corpCore = wgPick(rng, ["未来", "北斗", "大和", "瑞穂", "朝日", "青葉", "白鷺", "桜台"]) + wgPick(rng, ["高速鉄道", "開発", "興業", "不動産", "商事"]);
  const corp = `株式会社${corpCore}`;
  const hq = `${city}${wgPick(rng, EX_TOWNS)}二丁目${wgInt(rng, 10, 40)}番${wgInt(rng, 1, 9)}号`;
  const koosha = `${city}土地開発公社`;
  const bname = wgPick(rng, ["ランドマークタウン", "セントラルタワー", "グランスクエア", "リバーサイドプラザ"]);
  const nmKou = `${town}行政センター`;
  const nmOtsu = `${wgPick(rng, ["みらい", "あおぞら", "さくら"])}トラベル`;
  const nmHei = `${wgPick(rng, ["AB", "KT", "NS"])}レジデンス`;
  const dBuilt = wgDate(rng);
  const dKiyaku = exAddDays(dBuilt, -3);
  const dApply = exAddDays(dBuilt, 5);
  const dSetting = exAddDays(dBuilt, -wgInt(rng, 200, 260));
  const dOld = exAddDays(dBuilt, -wgInt(rng, 9000, 15000));

  // 敷地権の割合（甲の分） -------------------------------------------------------------------------
  const split = (den) => {
    const a = wgInt(rng, 2, Math.floor(den / 2));
    const b = wgInt(rng, 1, den - a - 1);
    return [a, b, den - a - b];
  };
  const den1 = wgPick(rng, [9, 10, 12]);
  const parts1 = split(den1);
  const den2 = wgPick(rng, [3, 4, 6]);
  const parts2 = den2 === 3 ? [1, 1, 1] : split(den2);
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const fracAcc = (n, d) => {
    const gg = gcd(n, d);
    const out = [`${d}分の${n}`, `${n}/${d}`, `${n}／${d}`];
    if (gg > 1) out.push(`${d / gg}分の${n / gg}`, `${n / gg}/${d / gg}`, `${n / gg}／${d / gg}`);
    return out;
  };
  const nbr = (x) => exNum(x);
  const kozoBld = `鉄筋コンクリート造陸屋根${N}階建`;
  const kozoKou = "鉄筋コンクリート造陸屋根2階建";
  const kozoTw = ["鉄骨造亜鉛メッキ鋼板ぶき平家建", "鉄骨造合金メッキ鋼板ぶき平家建", "鉄骨造亜鉛メッキ鋼板ぶき1階建", "鉄骨造合金メッキ鋼板ぶき1階建"];
  const kaoku = `${bigLot === 1 ? lot1 : lot2}の1`;
  const addrOf = (n) => `${shozai}${n.replace("番", "番地")}`;

  const html =
    `<p><b>【出題の趣旨】</b>${lot1}及び${lot2}の2筆の土地（${shozai}）の上に、3個の区分建物からなる一棟の建物（以下「本件建物」という。）及び機械式の立体駐車場（以下「本件駐車場」という。）が新築された。` +
    `土地家屋調査士${shiho}は、${hq}に本店を置く${corp}の代表取締役${rep}から、【事実関係】のとおり相談を受けて事情を聴取し、必要となる全ての表示に関する登記の申請手続の代理並びに調査及び測量の依頼を受け、` +
    `現地を測量して【登記記録の内容】のとおり登記記録を調査した上、必要となる登記の申請をした。</p>` +
    `<p><b>【問1】</b>【事実関係】8で${shiho}が行った登記の申請に係る申請書のうち、<b>甲区分建物</b>についての申請書を完成させなさい。ただし、会社法人等番号は用いないものとする。` +
    `（区分した建物の表示の2行目は、附属建物を記載する。家屋番号の支号は、甲区分建物を1、乙を2、丙を3とする。）</p>` +
    `<p><b>【問2】</b>${rep}から「数年後に予定されている市の名称変更により本件建物の名称を変更する予定ですが、一棟の建物の名称を変更した場合には、どのような登記を、いつからいつまでに申請する必要がありますか。申請を怠った場合に処罰を受ける可能性があるなら、その罰則の内容も教えてください。」との質問を受けた。` +
    `適当な内容として、①申請すべき登記の目的、②申請すべき期間、③罰則の有無及びその内容を答えなさい。</p>` +
    `<p><b>【問3】</b>問1の申請書に添付する建物図面（500分の1）及び各階平面図（250分の1）を作図しなさい。（紙で作図し、採点後にチェック項目で確認する。）</p>` +
    `<p class="small">（注）1　本問における行為は全て適法に行われ、法律上必要な書類は全て適法に作成されているものとする。2　登記の申請は書面申請の方法による。` +
    `3　建物図面は500分の1、各階平面図は250分の1の縮尺で作成する。</p>` +
    `<p class="small" style="margin-top:6px"><b>〔寸法（距離の単位はメートル。建物の数値は壁の中心間の距離。敷地と建物の距離は、筆界線から建物の外壁まで）〕</b></p>` +
    exTable(
      ["部分", "東西", "南北", "備考"],
      [
        [`敷地（${lot1}）`, nbr(w1), nbr(ld), `西側の土地。${lot2}と南北の長さは同じ`],
        [`敷地（${lot2}）`, nbr(w2), nbr(ld), `東側の土地。${lot1}の東隣`],
        ["本件建物 1・2階（外形）", nbr(Wl), nbr(Hc), `西端は${lot1}の西側の筆界から${nbr(ox)}、南端は南側の筆界から${nbr(oy)}。隅部は全て直角`],
        [`本件建物 3〜${N}階（各階同型、外形）`, nbr(Wu), nbr(Hc), "東端・南端は1・2階にそろう（東南の隅が重なる）"],
        ["（あ）専有部分（甲）1・2階", nbr(wA), nbr(hA), `西側に幅${nbr(wl)}の共用廊下（エスカレーターあり）、南側に幅${nbr(hb)}のホール`],
        ["（い）専有部分（乙）1・2階", nbr(wI), nbr(hA), `（あ）の東隣。北東の隅に階段室（共用、東西${nbr(ns)}×南北${nbr(nh)}）がある`],
        ["（う）専有部分（丙）3〜" + N + "階", nbr(Wu), nbr(r1(Hc - ht)), `北側に幅${nbr(ht)}のホール・EV室・PSがある帯。北東の隅に階段室（東西${nbr(ns)}×南北${nbr(nh)}）がある`],
        ["本件駐車場", nbr(tw), nbr(td), `東側の筆界から${nbr(gE)}、北側の筆界から${nbr(gE)}の位置（${lot2}の上）`],
      ],
    ) +
    `<p class="small" style="margin-top:6px">本件建物は鉄筋コンクリート造陸屋根で、壁の厚さは全て20センチメートル。外階段（北側に突き出る）は床面積に算入しない。` +
    `本件駐車場は、内部に車を格納する回転式のパーキング機械を設置したタワー状の立体式の駐車場で、鉄骨造合金メッキ鋼板ぶき、鉄骨の柱の外側に被覆材ではない軽量気泡コンクリートパネルの壁（厚さ10センチメートル）がある。` +
    `機械の格納部分は車を載せる機械で床ではなく、駐車場は階数1の建物（平家建）として扱うものとする。` +
    `PS・EV室・階段室・ホール（廊下）・エスカレーターは全て共用部分である。</p>` +
    `<p style="margin-top:12px"><b>【事実関係】</b></p>` +
    [
      `${corp}は、${lot2}の土地を所有していたが、${lot1}の土地を所有している${koosha}から、${exEraText(dSetting)}に地上権の設定を受け、これらの土地上に本件建物及び本件駐車場を新築することを計画した。`,
      `本件建物は3つの区分建物、すなわち、1階及び2階の（あ）専有部分（以下「甲区分建物」）、1階及び2階の（い）専有部分（以下「乙区分建物」）並びに3階から${N}階までの（う）専有部分（以下「丙区分建物」）からなるものとする。`,
      `一棟の建物の名称は「${bname}」、区分建物の名称は、甲を「${nmKou}」、乙を「${nmOtsu}」、丙を「${nmHei}」とする。`,
      `甲区分建物は、${town}における${city}の行政サービスを行う事務所とするため、${corp}が所有権の保存の登記をした後、${city}に売却する予定である。` +
        `本件駐車場は、${nmKou}を利用する市民のための駐車場であり、甲区分建物の附属建物として、甲区分建物とともに${city}に売却する予定である。`,
      `最初に本件建物の専有部分の全部を所有することとなる${corp}は、${exEraText(dKiyaku)}、公正証書により規約（以下「本件原始規約」）を設定した。本件原始規約では、各専有部分に係る敷地利用権の割合を、次のとおりとする旨が定められている。`,
    ]
      .map((t, i) => `<p>${i + 1}　${t}</p>`)
      .join("") +
    exTable(
      ["建物の名称", `${lot1}の土地`, `${lot2}の土地`],
      [
        [`${nmKou}（甲区分建物）`, `${den1}分の${parts1[0]}`, `${den2}分の${parts2[0]}`],
        [`${nmOtsu}（乙区分建物）`, `${den1}分の${parts1[1]}`, `${den2}分の${parts2[1]}`],
        [`${nmHei}（丙区分建物）`, `${den1}分の${parts1[2]}`, `${den2}分の${parts2[2]}`],
        ["敷地利用権の割合の合計", `${den1}分の${den1}`, `${den2}分の${den2}`],
      ],
    ) +
    [
      `本件建物及び本件駐車場は、${exEraText(dBuilt)}に完成し、同日、引渡しが完了した。`,
      `各区分建物の種類は、${shiho}の調査の結果、甲区分建物は「事務所」、乙区分建物は「店舗・事務所」、丙区分建物は「共同住宅」と確認した。`,
      `${shiho}は、${rep}から、本件建物に属する全ての区分建物及び本件駐車場について必要となる全ての表示に関する登記の申請手続の代理並びに調査及び測量の依頼を受け、${dApply.text}、申請を行った。`,
    ]
      .map((t, i) => `<p>${i + 6}　${t}</p>`)
      .join("") +
    `<p style="margin-top:10px"><b>【登記記録の内容】</b></p>` +
    exTable(
      ["所在", "地番", "地目", "地積", "甲区（所有権）", "乙区"],
      [
        [shozai, lot1, "宅地", `${nbr(landA1)}㎡`, `${exEraText(dOld)}所有権移転　${koosha}`, `地上権設定　${exEraText(dSetting)}受付　原因　${exEraText(dSetting)}設定　存続期間50年　地上権者 ${hq}　${corp}`],
        [shozai, lot2, "宅地", `${nbr(landA2)}㎡`, `所有権移転　${hq}　${corp}`, "（登記事項なし）"],
      ],
    );

  const tol = 0.005;
  const tasks = [
    { label: "問1", q: `一棟の建物の<b>1階</b>の床面積（㎡）（壁の中心線で囲まれた部分。外階段は含めない）`, unit: "㎡", answer: A1, tol, pts: 3, expl: `${nbr(Wl)}×${nbr(Hc)}＝<b>${nbr(A1)}㎡</b>。` },
    { label: "問1", q: `一棟の建物の<b>3階</b>の床面積（㎡）`, unit: "㎡", answer: Au, tol, pts: 3, expl: `${nbr(Wu)}×${nbr(Hc)}＝<b>${nbr(Au)}㎡</b>。（3〜${N}階は各階同じ。）` },
    { label: "問1", q: `甲区分建物の<b>1階</b>の床面積（㎡）（専有部分は壁その他の区画の内側線。規則115条）`, unit: "㎡", answer: aKou, tol, pts: 4, expl: `(${nbr(wA)}−0.20)×(${nbr(hA)}−0.20)＝<b>${nbr(aKou)}㎡</b>。2階も同じ。` },
    { label: "問1", q: `本件駐車場の床面積（㎡）（壁の中心線）`, unit: "㎡", answer: At, tol, pts: 3, expl: `${nbr(tw)}×${nbr(td)}＝<b>${nbr(At)}㎡</b>。` },
  ];
  const mk = (sheetNo, f) => Object.assign({ sheetNo: sheetNo }, f);
  const attPool = [
    "建物図面", "各階平面図", "建物図面及び各階平面図", "建物図面、各階平面図", "建物図面・各階平面図",
    "所有権証明情報", "所有権を証する情報", "住所証明情報", "住所を証する情報", "登記事項証明書", "資格証明情報",
    "代表者資格証明情報", "代表者の資格を証する情報", "会社の登記事項証明書", "規約証明情報", "規約を設定したことを証する情報", "規約を証する情報",
    "代理権限証明情報", "委任状",
  ];
  const none = ["不要", "金0円", "0円", "非課税", "課税なし"];
  const lotsAcc = (sep) => `${shozai}${nb}番地1${sep}${nb}番地2`;
  const appForm = [
    mk(0, { label: "登記の目的", answer: ["建物表題登記", "建物の表題登記", "区分建物表題登記"], hint: "", pts: 3 }),
    mk(0, { label: "添付情報（①）", slot: "attach", answer: attPool, hint: "", pts: 1 }),
    mk(0, { label: "添付情報（②）", slot: "attach", answer: attPool, hint: "", pts: 1 }),
    mk(0, { label: "添付情報（③）", slot: "attach", answer: attPool, hint: "", pts: 1 }),
    mk(0, { label: "添付情報（④）", slot: "attach", answer: attPool, hint: "", pts: 1 }),
    mk(0, { label: "添付情報（⑤）", slot: "attach", answer: attPool, hint: "", pts: 1 }),
    mk(0, { label: "添付情報（⑥）", slot: "attach", answer: attPool, hint: "", pts: 1 }),
    mk(0, { label: "申請人", answer: [corp, `${hq}${corp}`, `${hq}${corp}代表取締役${rep}`, `${corp}代表取締役${rep}`], hint: "", pts: 2 }),
    mk(0, { label: "登録免許税", answer: none, hint: "", pts: 2 }),
    mk(0, _wPre("ittou", "所在", ["、", "・", "及び", " ", ""].map((s) => lotsAcc(s)).concat([`${shozai}${lot1}、${lot2}`, `${shozai}${lot1}・${lot2}`]), 3)),
    mk(0, _wPre("ittou", "建物の名称", [bname], 2)),
    mk(0, _wCell("ittou", 0, "kozo", "一棟の建物の構造", [kozoBld], 3, "")),
    mk(0, _wCell("ittou", 0, "yuka", "一棟の建物の床面積", wgFloorsAccepts([A1, A1].concat(Array(N - 2).fill(Au))), 5, "")),
    mk(0, _wCell("kubunTochi", 0, "fugo", "敷地権の目的である土地 1行目の符号", ["ア", "1", "a"], 1, "")),
    mk(0, _wCell("kubunTochi", 0, "chiban", "敷地権の目的である土地 1行目の所在及び地番", [`${shozai}${lot1}`], 1, "")),
    mk(0, _wCell("kubunTochi", 0, "chimoku", "敷地権の目的である土地 1行目の地目", ["宅地"], 1, "")),
    mk(0, _wCell("kubunTochi", 0, "chiseki", "敷地権の目的である土地 1行目の地積", wgAreaAccepts(landA1), 2, "")),
    mk(0, _wCell("kubunTochi", 1, "fugo", "敷地権の目的である土地 2行目の符号", ["イ", "2", "b"], 1, "")),
    mk(0, _wCell("kubunTochi", 1, "chiban", "敷地権の目的である土地 2行目の所在及び地番", [`${shozai}${lot2}`], 1, "")),
    mk(0, _wCell("kubunTochi", 1, "chimoku", "敷地権の目的である土地 2行目の地目", ["宅地"], 1, "")),
    mk(0, _wCell("kubunTochi", 1, "chiseki", "敷地権の目的である土地 2行目の地積", wgAreaAccepts(landA2), 2, "")),
    mk(0, _wCell("kubunTatemono", 0, "kaoku", "区分した建物 1行目の家屋番号", [kaoku], 3, "")),
    mk(0, _wCell("kubunTatemono", 0, "meisho", "区分した建物 1行目の建物の名称", [nmKou], 2, "")),
    mk(0, _wCell("kubunTatemono", 0, "shufuku", "区分した建物 1行目の主である建物又は附属建物", ["主である建物", "主"], 1, "")),
    mk(0, _wCell("kubunTatemono", 0, "shurui", "区分した建物 1行目の種類", ["事務所"], 2, "")),
    mk(0, _wCell("kubunTatemono", 0, "kozo", "区分した建物 1行目の構造", [kozoKou], 3, "")),
    mk(0, _wCell("kubunTatemono", 0, "yuka", "区分した建物 1行目の床面積", wgFloorsAccepts([aKou, aKou]), 5, "")),
    mk(0, _wCell("kubunTatemono", 1, "shufuku", "区分した建物 2行目の主である建物又は附属建物", ["附属建物", "附属"], 2, "")),
    mk(0, _wCell("kubunTatemono", 1, "shurui", "区分した建物 2行目の種類", ["車庫", "駐車場"], 3, "")),
    mk(0, _wCell("kubunTatemono", 1, "kozo", "区分した建物 2行目の構造", kozoTw, 3, "")),
    mk(0, _wCell("kubunTatemono", 1, "yuka", "区分した建物 2行目の床面積", wgFloorsAccepts([At]), 3, "")),
    mk(0, _wCell("shikichi", 0, "fugo", "敷地権 1行目の土地の符号", ["ア", "1", "a"], 1, "")),
    mk(0, _wCell("shikichi", 0, "shurui", "敷地権 1行目の種類", ["地上権"], 3, "")),
    mk(0, _wCell("shikichi", 0, "wariai", "敷地権 1行目の割合", fracAcc(parts1[0], den1), 4, "")),
    mk(0, _wCell("shikichi", 1, "fugo", "敷地権 2行目の土地の符号", ["イ", "2", "b"], 1, "")),
    mk(0, _wCell("shikichi", 1, "shurui", "敷地権 2行目の種類", ["所有権"], 3, "")),
    mk(0, _wCell("shikichi", 1, "wariai", "敷地権 2行目の割合", fracAcc(parts2[0], den2), 4, "")),
  ];
  const preList = ["", "変更の日から", "変更があった日から", "名称変更の日から", "名称を変更した日から", "名称の変更があった日から"];
  const sufList = ["1か月以内", "1ヶ月以内", "1月以内", "一月以内", "一か月以内", "1箇月以内", "一箇月以内"];
  const periodAcc = [];
  preList.forEach((p) => sufList.forEach((s) => periodAcc.push(p + s)));
  const penaltyAcc = [];
  ["", "あり", "あり、", "有り", "有", "ある。"].forEach((p) => ["10万円以下の過料", "十万円以下の過料", "10万円以下の過料に処せられる"].forEach((s) => penaltyAcc.push(p + s)));
  penaltyAcc.push("あり（10万円以下の過料）", "有り（10万円以下の過料）");
  appForm.push(
    mk(1, { label: "① 申請すべき登記の目的", answer: ["建物表題部変更登記", "建物表題部変更", "表題部変更登記", "建物の表題部の変更の登記", "建物表題部変更の登記", "区分建物表題部変更登記"], hint: "", pts: 4 }),
    mk(1, { label: "② 申請すべき期間", answer: periodAcc, hint: "いつからいつまでか", pts: 4 }),
    mk(1, { label: "③ 罰則の有無及び内容", answer: penaltyAcc, hint: "", pts: 4 }),
  );

  // 図: 土地2筆と、1・2階（外形）・3階以上（東南にそろう）・駐車場 ----------------------------------
  const x0 = exU(rng, 40, 60);
  const y0 = exU(rng, 70, 80);
  const P1 = [x0, y0];
  const P2 = [exRound(x0 + ld), y0];
  const P3 = [P2[0], exRound(y0 + w1)];
  const P4 = [x0, P3[1]];
  const P5 = [P2[0], exRound(y0 + w1 + w2)];
  const P6 = [x0, P5[1]];
  const bx0 = exRound(x0 + oy);
  const by0 = exRound(y0 + ox);
  const R1 = [[bx0, by0], [exRound(bx0 + Hc), by0], [exRound(bx0 + Hc), exRound(by0 + Wl)], [bx0, exRound(by0 + Wl)]];
  const byU = exRound(by0 + Wl - Wu);
  const RU = [[bx0, byU], [exRound(bx0 + Hc), byU], [exRound(bx0 + Hc), exRound(by0 + Wl)], [bx0, exRound(by0 + Wl)]];
  const ty1 = exRound(y0 + w1 + w2 - gE);
  const ty0 = exRound(ty1 - tw);
  const tx1 = exRound(x0 + ld - gE);
  const tx0 = exRound(tx1 - td);
  const RT = [[tx0, ty0], [tx1, ty0], [tx1, ty1], [tx0, ty1]];
  const figure = {
    points: { A: P1, B: P2, C: P3, D: P4, E: P5, F: P6 },
    polys: [["A", "B", "C", "D"], ["D", "C", "E", "F"]],
    holes: [
      { poly: R1, label: "1・2階" },
      { poly: RU, label: `3〜${N}階` },
      { poly: RT, label: "駐車場" },
    ],
    lines: [],
    revealPoints: [],
    areaLabels: [{ at: [bx0 + Hc / 2, by0 + Wl / 2 - 6], text: `1・2階 各${nbr(A1)}㎡ ／ 3〜${N}階 各${nbr(Au)}㎡` }],
  };
  return {
    statement: html,
    coords: [],
    tasks: tasks,
    appForm: appForm,
    sheetTitles: { 0: "申請書（問1：甲区分建物）", 1: "問2（一棟の建物の名称の変更）" },
    figure: figure,
    figureChecks: [
      "建物図面は500分の1、各階平面図は250分の1で作図した（規則82条3項・83条2項）",
      `建物図面に方位、敷地の地番（${lot1}・${lot2}）とその形状、隣接地の地番を記入した（規則82条2項）`,
      "建物図面に1階の位置・形状を筆界からの距離で示し、本件駐車場は附属建物として別の符号を付して示した（規則82条1項・2項）",
      "各階平面図に縮尺、各階の別、各階の平面の形状、1階の位置を記入した（規則83条1項）",
      "各階ごとの建物の周囲の長さ、床面積と求積方法を記入した（規則83条1項）。専有部分は内側線、一棟の建物は壁の中心線で求めた",
      "外階段を床面積に含めていない。階段室・EV室は各階の床面積に含めた（準則82条6号・7号）",
    ],
    articleFill: null,
    verify: {
      kind: "exam-r1-tatemono",
      dims: { wl, wA, hA, hb, ht, g, ns, nh, wH, N, wI, Wl, Hc, Wu, tw, td },
      areas: { A1, Au, aKou, aOtsu, aHei, At },
      site: { w1, w2, ld, ox, oy, gE, landA1, landA2 },
      big: { s1, s2, bigLot, kaoku, lot1, lot2 },
      frac: { den1, parts1, den2, parts2 },
      figure: { P1, P2, P3, P4, P5, P6, R1, RU, RT },
    },
  };
}

// ─────────── 登録 ───────────
// WRITTEN に追加する。本試験の型は level を「本試験」とし、一覧の絞り込みに使う。
WRITTEN.push({
  id: "X21-R7",
  level: "本試験",
  type: "土地",
  title: "本試験形式（令和7年度型）土地：相続した2筆の分筆・公差・交換",
  target: "目標50分",
  combo: ["分筆", "地積更正の要否", "交換"],
  build: exBuildR7Land,
});

WRITTEN.push({
  id: "X22-R7",
  level: "本試験",
  type: "建物",
  title: "本試験形式（令和7年度型）建物：建替え・改築を2期に分けた表題部変更",
  target: "目標50分",
  combo: ["表題部変更", "主従の入れ替わり", "再築"],
  build: exBuildR7Tatemono,
});

WRITTEN.push({
  id: "X22-R6",
  level: "本試験",
  type: "建物",
  title: "本試験形式（令和6年度型）建物：共有の新築居宅・出窓と外気分断性",
  target: "目標50分",
  combo: ["建物表題登記", "共有持分", "独立性"],
  build: exBuildR6Tatemono,
});

WRITTEN.push({
  id: "X21-R6",
  level: "本試験",
  type: "土地",
  title: "本試験形式（令和6年度型）土地：筆界点の座標・地積と公差・地積更正",
  target: "目標50分",
  combo: ["地積更正の要否", "座標の算出"],
  build: exBuildR6Land,
});

WRITTEN.push({
  id: "X21-R5",
  level: "本試験",
  type: "土地",
  title: "本試験形式（令和5年度型）土地：分筆と、地目変更・合筆",
  target: "目標50分",
  combo: ["分筆", "地目変更", "合筆"],
  build: exBuildR5Land,
});

WRITTEN.push({
  id: "X22-R5",
  level: "本試験",
  type: "区分建物",
  title: "本試験形式（令和5年度型）区分建物：区分合併と表題部変更",
  target: "目標50分",
  combo: ["表題部変更", "区分合併"],
  build: exBuildR5Tatemono,
});

WRITTEN.push({
  id: "X21-R4",
  level: "本試験",
  type: "土地",
  title: "本試験形式（令和4年度型）土地：基準点からの観測で決めた分筆線と公差",
  target: "目標50分",
  combo: ["分筆", "地積更正の要否", "筆界特定"],
  build: exBuildR4Land,
});

WRITTEN.push({
  id: "X22-R4",
  level: "本試験",
  type: "建物",
  title: "本試験形式（令和4年度型）建物：増築による附属建物の合体と車庫の新築",
  target: "目標50分",
  combo: ["表題部変更", "附属建物合体", "附属建物の新築"],
  build: exBuildR4Tatemono,
});

WRITTEN.push({
  id: "X21-R3",
  level: "本試験",
  type: "土地",
  title: "本試験形式（令和3年度型）土地：隅切りのある道路境界と、相続した土地の3筆への分筆",
  target: "目標50分",
  combo: ["分筆", "地積更正の要否", "隅切り"],
  build: exBuildR3Land,
});

WRITTEN.push({
  id: "X22-R3",
  level: "本試験",
  type: "区分建物",
  title: "本試験形式（令和3年度型）建物：共同住宅の区分と敷地権の割合",
  target: "目標50分",
  combo: ["建物の区分", "敷地権", "内側線"],
  build: exBuildR3Tatemono,
});

WRITTEN.push({
  id: "X21-R2",
  level: "本試験",
  type: "土地",
  title: "本試験形式（令和2年度型）土地：筆界の外にある建物に合わせた分筆・合筆",
  target: "目標50分",
  combo: ["分筆", "合筆", "地積更正の要否", "登記識別情報"],
  build: exBuildR2Land,
});

WRITTEN.push({
  id: "X22-R2",
  level: "本試験",
  type: "建物",
  title: "本試験形式（令和2年度型）建物：旧建物の滅失と、3階建の新築（ポーチの外気分断）",
  target: "目標50分",
  combo: ["建物滅失", "建物表題", "床面積の認定", "建物の移転"],
  build: exBuildR2Tatemono,
});

WRITTEN.push({
  id: "X21-R1",
  level: "本試験",
  type: "土地",
  title: "本試験形式（令和1年度型）土地：垂線で3筆に分筆・公差・筆界特定",
  target: "目標50分",
  combo: ["分筆", "地積更正の要否", "筆界特定"],
  build: exBuildR1Land,
});

WRITTEN.push({
  id: "X22-R1",
  level: "本試験",
  type: "建物",
  title: "本試験形式（令和1年度型）建物：区分建物の表題登記と、立体駐車場（附属建物）",
  target: "目標50分",
  combo: ["区分建物の表題登記", "敷地権", "附属建物"],
  build: exBuildR1Tatemono,
});
