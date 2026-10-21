// 記述式 問題ジェネレーター。
//
// ねらい: 同じ問題を二度解かせない。written.js の各テンプレートにシード付き乱数を渡し、
// 座標値・地目・地番・当事者・日付を毎回振り直した「その回かぎりの問題」を組み立てる。
// 出力は従来の固定問題とまったく同じ形（statement / coords / tasks / appForm / figure）なので、
// app.js 側の採点ロジックと作図ロジックは無改修で動く。
//
// 座標系: X=北(+), Y=東(+)。方向角は北から時計回り。
// 端数処理・登録免許税・登記の目的の根拠は .claude/rules/ ではなく本ファイル内のコメントに明記する
// （答え合わせのとき条文までさかのぼれるようにするため）。

// ─────────── シード付き乱数（mulberry32） ───────────
// 同じシードなら必ず同じ問題が再現される。画面には「問題番号 #123456」として表示し、
// 復習のときに同じ問題をもう一度引けるようにする。
function wgRng(seed) {
  let a = seed >>> 0 || 1;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wgNewSeed() {
  return (1 + Math.floor(Math.random() * 0xfffffe)) >>> 0;
}

// ─────────── 乱数ユーティリティ ───────────
function wgInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

function wgPick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// min〜max を step 刻みで返す（寸法を 0.5m 刻みにしたいときに使う）
function wgStep(rng, min, max, step) {
  const n = Math.round((max - min) / step);
  return +(min + wgInt(rng, 0, n) * step).toFixed(2);
}

// ─────────── 幾何 ───────────
// 座標法の面積。原点を第1点に平行移動してから計算する（世界測地系の大座標でも桁落ちしない）。
function wgArea(pts) {
  const ox = pts[0][0],
    oy = pts[0][1];
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i],
      b = pts[(i + 1) % pts.length];
    s += (a[0] - ox) * (b[1] - oy) - (b[0] - ox) * (a[1] - oy);
  }
  return Math.abs(s) / 2;
}

// 倍面積（座標法の途中値）。ΣX(Yi+1−Yi-1) と同値で、解説に出す検算用。
function wgDoubleArea(pts) {
  return wgArea(pts) * 2;
}

function wgDist(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

// 直線KLと X=xc の交点。媒介変数 t=(xc−Kx)/(Lx−Kx)。
// 分筆線と、X座標が一定の筆界線との交点を求める定番計算。
function wgCrossAtX(K, L, xc) {
  const t = (xc - K[0]) / (L[0] - K[0]);
  return { t: t, p: [xc, K[1] + (L[1] - K[1]) * t] };
}

// 分数を「4/34=0.117647」のような解説文字列にする
function wgFracText(num, den) {
  return `${num}/${den}=${(num / den).toFixed(6)}`;
}

// 分数を約分して「5分の3」の形にする。合体後の持分や敷地権の割合で使う。
function wgReduceFrac(num, den) {
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const g = gcd(Math.abs(num), Math.abs(den)) || 1;
  const n = num / g;
  const d = den / g;
  return {
    num: n,
    den: d,
    // 登記実務の表記は「分母分の分子」（例: 5分の3）
    text: `${d}分の${n}`,
    // 「5分の3」「3/5」どちらの入力でも正解にする
    accepts: [`${d}分の${n}`, `${n}/${d}`],
  };
}

// ─────────── 不動産登記法令 ───────────
// 規則100条の端数処理。
//   宅地・鉱泉地 … 常に 0.01㎡未満を切捨て
//   それ以外の地目 … 10㎡を超えるときは 1㎡未満を切捨て（10㎡以下は 0.01㎡未満切捨て）
const WG_FINE_CHIMOKU = ["宅地", "鉱泉地"];

function wgIsFineChimoku(chimoku) {
  return WG_FINE_CHIMOKU.indexOf(chimoku) >= 0;
}

function wgChiseki(area, chimoku) {
  // 切り捨てる前に小数第6位で丸める。
  // 世界測地系の大座標では座標法の途中で 1e-8 程度の誤差が出るため、真の値がちょうど
  // 0.01の境目にある地積（例 365.25）が 365.2499999… となって1銭下に落ちるのを防ぐ。
  // 丸めは 1e-8 ㎡ 未満しか動かさないので、本物の端数（365.2499）を食うことはない。
  const safe = (v) => +v.toFixed(6);
  if (wgIsFineChimoku(chimoku) || area <= 10) {
    return Math.floor(safe(area * 100)) / 100;
  }
  return Math.floor(safe(area));
}

// ─────────── 地積測定の公差（国土調査法施行令 別表第四・第15条関係） ───────────
// 公差 =（a ＋ b×⁴√F）×√F     F は一筆地の地積を平方メートル単位で示した数。
// 出典は国土交通省が公開する参照条文集。答練2022第12回の記載（市街地地域・甲二・
// 地積281㎡ ⟹ 1.52㎡）と一致することを確認済み。
const WG_KOSA_COEF = {
  甲一: [0.025, 0.003],
  甲二: [0.05, 0.01],
  甲三: [0.1, 0.02],
  乙一: [0.1, 0.04],
  乙二: [0.25, 0.07],
  乙三: [0.5, 0.14],
};

// 地域区分ごとに使える精度区分の上限（不動産登記規則10条4項）。
// 実務・答練では上限の区分がそのまま使われることが多いので、それを既定とする。
const WG_CHIIKI = [
  { name: "市街地地域", seido: "甲二", ref: "規則10条4項1号" },
  { name: "村落・農耕地域", seido: "乙一", ref: "規則10条4項2号" },
  { name: "山林・原野地域", seido: "乙三", ref: "規則10条4項3号" },
];

// 地積 F ㎡・精度区分 seido のときの地積測定の公差（㎡）。
function wgKosa(F, seido) {
  const c = WG_KOSA_COEF[seido];
  if (!c || !(F > 0)) return null;
  return (c[0] + c[1] * Math.pow(F, 0.25)) * Math.sqrt(F);
}

// 公差は答練でも小数第2位までで示されるので、表示用に丸める。
// 判定は丸めた値で行う（受験生が問題文の数値で判断するのと同じにするため）。
function wgKosaShown(F, seido) {
  const v = wgKosa(F, seido);
  return v == null ? null : Math.round(v * 100) / 100;
}

// 規則100条の根拠文。地目によって切捨ての桁が変わるところが最大の失点源なので毎回出す。
function wgChisekiRule(chimoku) {
  return wgIsFineChimoku(chimoku)
    ? `<b>${chimoku}</b>は地積の大小にかかわらず<b>0.01㎡未満を切捨て</b>（規則100条）。`
    : `<b>${chimoku}</b>で10㎡を超えるので<b>1㎡未満を切捨て</b>（規則100条。宅地・鉱泉地なら0.01㎡未満切捨てになる点に注意）。`;
}

// 地積の表記。切捨ての桁に合わせて小数第2位まで／整数を使い分ける。
function wgChisekiText(chiseki, chimoku) {
  return wgIsFineChimoku(chimoku) || chiseki < 10
    ? chiseki.toFixed(2)
    : String(chiseki);
}

// 地積の許容解。「303㎡」「303」「303.00㎡」のどれで入力しても正解にする。
function wgChisekiAccepts(chiseki, chimoku) {
  const t = wgChisekiText(chiseki, chimoku);
  const set = [t + "㎡", t, chiseki.toFixed(2) + "㎡", String(chiseki) + "㎡"];
  return set.filter((v, i) => set.indexOf(v) === i);
}

// 分筆の登録免許税。分筆後の土地1個につき1,000円
// （登録免許税法別表第一・一・(十三)イ、規則189条1項）。
function wgBunpitsuTax(count) {
  return count * 1000;
}

// 合筆の登録免許税。合筆後の土地1個につき1,000円。
function wgGappitsuTax(count) {
  return count * 1000;
}

function wgYenText(yen) {
  return "金" + yen.toLocaleString("en-US") + "円";
}

// 登録免許税の許容解。app.js の norm() がカンマと「金」を落とすので表記ゆれは吸収されるが、
// 「なし」「非課税」のような別表現もここで受ける。
function wgYenAccepts(yen) {
  return [wgYenText(yen), String(yen) + "円", String(yen)];
}

const WG_NONTAX_ACCEPTS = ["なし", "非課税", "課税されない", "0円"];

// ─────────── パラメータの素（毎回振り直す部分） ───────────
// 地目は規則99条の23種類から、出題価値の高いものを抜き出して使う。
const WG_CHIMOKU_FINE = ["宅地"];
const WG_CHIMOKU_COARSE = [
  "田",
  "畑",
  "山林",
  "原野",
  "雑種地",
  "牧場",
  "池沼",
];

// 一部地目変更で「変更後の地目」に使う組み合わせ（現況の変化として自然なものだけ）
const WG_CHIMOKU_CHANGE = [
  { from: "田", to: "宅地", cause: "宅地への造成工事が完了した" },
  { from: "畑", to: "宅地", cause: "宅地への造成工事が完了した" },
  { from: "山林", to: "雑種地", cause: "資材置場として整地された" },
  { from: "原野", to: "雑種地", cause: "駐車場として整地された" },
  { from: "畑", to: "雑種地", cause: "耕作をやめて資材置場となった" },
  { from: "田", to: "畑", cause: "水田から畑地に転換された" },
];

const WG_SURNAME = [
  "法務",
  "山田",
  "甲野",
  "乙川",
  "山岡",
  "村山",
  "川野",
  "海山",
  "北原",
  "南田",
  "西沢",
  "東雲",
];
const WG_GIVEN_M = [
  "太郎",
  "一郎",
  "二郎",
  "三郎",
  "五郎",
  "法男",
  "海斗",
  "健一",
];
const WG_GIVEN_F = ["花子", "令子", "準子", "則子", "美咲", "彩香"];
const WG_CITY = ["A市B町", "K市D町", "Q市R町", "S市T町", "M市N町", "P市U町"];
const WG_CHOME = ["一丁目", "二丁目", "三丁目", "四丁目", "五丁目"];

function wgPerson(rng, sex) {
  const g =
    sex === "f"
      ? wgPick(rng, WG_GIVEN_F)
      : sex === "m"
        ? wgPick(rng, WG_GIVEN_M)
        : wgPick(rng, WG_GIVEN_M.concat(WG_GIVEN_F));
  return wgPick(rng, WG_SURNAME) + g;
}

// 所在。丁目を付ける／付けないを混ぜる（本試験もどちらも出る）。
function wgShozai(rng) {
  const city = wgPick(rng, WG_CITY);
  return rng() < 0.6 ? city + wgPick(rng, WG_CHOME) : city;
}

// 令和の日付。2026年＝令和8年を基準に、直近の日付を作る。
function wgDate(rng) {
  const y = wgPick(rng, [7, 8, 8, 8]);
  const m = wgInt(rng, 1, 12);
  const d = wgInt(rng, 1, 28);
  return { y: y, m: m, d: d, text: `令和${y}年${m}月${d}日` };
}

// 地番。支号あり／なしを混ぜる。分筆後の予定地番の付け方が変わる（準則67条）。
//   支号なし 5番   → 分筆後 5番1・5番2（分筆前の地番に支号を付す）
//   支号あり 12番3 → 分筆後 12番3（残地）・12番4（最終支号の次の数）
function wgChiban(rng) {
  const base = wgInt(rng, 3, 98);
  if (rng() < 0.5) {
    return {
      text: base + "番",
      base: base,
      shigo: null,
      // 分筆後: 支号を新たに設ける
      split: [base + "番1", base + "番2"],
      // 残地に使うのは split[0]
    };
  }
  const s = wgInt(rng, 1, 5);
  return {
    text: base + "番" + s,
    base: base,
    shigo: s,
    split: [base + "番" + s, base + "番" + (s + 1)],
  };
}

// 世界測地系（平面直角座標系）の原点オフセット。整数で持つので座標法の値は厳密なまま。
function wgGeoOffset(rng) {
  return {
    x: -wgInt(rng, 12, 58) * 1000 - wgInt(rng, 0, 999),
    y: wgInt(rng, 5, 89) * 1000 + wgInt(rng, 0, 999),
  };
}


// ─────────── 事実関係の文章部品（問題文の長文化） ───────────
// 本試験の〔事実関係〕は8〜12項目・600〜800字ほどあり、計算に使う情報のほかに、
// 取得の経緯・現況・立会い・測量の経過といった「読んで拾う」情報が混ざる。
// 部品は生成済みの値（所有者・所在・地目・日付）からだけ文を作る。数値を直書きすると
// 座標や地積と食い違うため、答えに効く数値は一切ここでは作らない。
// 地目と食い違う現況（山林を駐車場とする等）は地目変更の論点を勝手に生むので出さない。
const WG_LAND_USE = {
  宅地: "居宅の敷地として利用されている",
  田: "水田として耕作されている",
  畑: "野菜畑として耕作されている",
  山林: "杉が植栽された山林として管理されている",
  原野: "雑草が生い茂り、特に利用されていない",
  雑種地: "月極駐車場として利用されている",
  牧場: "放牧地として利用されている",
  池沼: "ため池として水をたたえている",
};

// d の days 日後の令和日付。月末・年末の繰り上がりは Date に任せる。
function wgDateAfter(d, days) {
  const t = new Date(2018 + d.y, d.m - 1, d.d + days);
  const y = t.getFullYear() - 2018;
  return {
    y: y,
    m: t.getMonth() + 1,
    d: t.getDate(),
    text: `令和${y}年${t.getMonth() + 1}月${t.getDate()}日`,
  };
}

// 取得の経緯。売買・相続・贈与から選ぶ。登記名義人が変わった日付は依頼日より前に置く。
function wgAcquireFact(rng, owner, date, landName) {
  const when = wgDateAfter(date, -wgInt(rng, 400, 1800)).text;
  const other = wgPerson(rng);
  const kind = wgInt(rng, 0, 2);
  if (kind === 0)
    return `${owner}は、${when}に${other}から${landName}を買い受け、同日、所有権の移転の登記を了している。`;
  if (kind === 1)
    return `${owner}は、${other}の死亡により、${when}に${landName}を相続し、相続による所有権の移転の登記を了している。`;
  return `${owner}は、${when}に${other}から${landName}の贈与を受け、所有権の移転の登記を了している。`;
}

// 土地の事実関係を、番号を振る前の文の配列で返す。
// o: { owner, shozai, chimoku, date, geo, landName, noUse }
// 必ず入る4項目（取得・現況・立会い・測量日）に、任意の2〜3項目を足す。
function wgLandFacts(rng, o) {
  const land = o.landName || "甲土地";
  const must = [wgAcquireFact(rng, o.owner, o.date, land)];
  if (!o.noUse && WG_LAND_USE[o.chimoku])
    must.push(`${land}は、現在、${WG_LAND_USE[o.chimoku]}。`);
  const north = wgPerson(rng);
  const south = wgPerson(rng);
  must.push(
    `北側の隣地の所有者は${north}、南側の隣地の所有者は${south}であり、両名とも現地の立会いに応じ、` +
      `${land}との筆界の位置について異議を述べなかった。`,
  );
  must.push(
    `測量は${wgDateAfter(o.date, wgInt(rng, 3, 20)).text}に実施した。` +
      `各筆界点には、いずれもコンクリート杭の境界標が設置されている。`,
  );

  const optional = [
    `${o.owner}は、${o.shozai}に所在する${land}の登記記録上の所有権登記名義人であり、` +
      `所有権以外の権利に関する登記はされていない。`,
    `${land}の東側は、幅員${wgPick(rng, [4, 5, 6])}メートルの公道に接している。`,
    `${land}の西側の隣地は、${wgPerson(rng)}が所有する土地であり、筆界について争いはない。`,
    `${o.owner}は、測量及び登記の申請に要する費用を自ら負担することとしている。`,
  ];
  if (o.geo)
    optional.push(
      `測量は、近傍の電子基準点に基づく世界測地系（平面直角座標系第${wgInt(rng, 1, 19)}系）によって行った。`,
    );
  // 任意項目はシードから2〜3個を選ぶ（順序もシャッフルされる）
  const extra = [];
  const want = wgInt(rng, 2, 3);
  while (extra.length < want && optional.length)
    extra.push(optional.splice(wgInt(rng, 0, optional.length - 1), 1)[0]);
  // 取得 → 現況 → 任意 → 立会い → 測量日 の順に並べると、時系列として自然に読める
  return [must[0]].concat(must.slice(1, -2), extra, must.slice(-2));
}

// 末尾の（注）。距離・座標の扱いと、法律上の前提を本試験と同じ言い回しで置く。
function wgNoteBlock() {
  const items = [
    "本問における行為は全て適法に行われており、法律上必要な書類は全て適法に作成されているものとする。",
    "距離の単位はメートルである。",
    "登記の申請は、書面申請の方法によってするものとする。",
  ];
  return (
    `<p class="small" style="margin-top:10px">（注）</p>` +
    items
      .map((t, i) => `<p class="small">${i + 1}　${t}</p>`)
      .join("")
  );
}


// ─────────── 土地以外・合筆・更正の事実関係（補足） ───────────
// 建物・区分建物・合筆・地積更正のテンプレートは、事案の文と図表だけで短い。
// ここでは答えに効かない事実（施工者・登記記録の確認・現地調査・費用負担など）を足して、
// 本試験のように「必要な情報を読んで拾う」長さにする。答えに効く事実は各テンプレートが持つ。
// 値（所有者・日付・地目）はテンプレートが返したものだけを使い、食い違いを作らない。
const WG_BUILDER = [
  "青葉建設株式会社",
  "ひので工務店",
  "有限会社みなと建設",
  "株式会社あけぼのホーム",
  "桜台工業株式会社",
];
const WG_DEMOLISHER = [
  "丸石解体工業株式会社",
  "有限会社西風解体",
  "株式会社クリーンワークス",
];

function wgWideNo(k) {
  return String(k).replace(/\d/g, (c) => "０１２３４５６７８９"[c]);
}

// 補足の事実を、番号を振る前の文の配列で返す。作れない種類なら空配列。
function wgSupplementFacts(tpl, b, rng) {
  const id = tpl.id;
  const owner = b.owner;
  const shiho = b.shiho;
  const hasDate = b.date && b.date.y;
  const survey = hasDate
    ? `土地家屋調査士${shiho}は、${wgDateAfter(b.date, wgInt(rng, 3, 20)).text}に現地を調査した。`
    : null;
  const pickN = (arr, n) => {
    const pool = arr.slice();
    const out = [];
    while (out.length < n && pool.length)
      out.push(pool.splice(wgInt(rng, 0, pool.length - 1), 1)[0]);
    return out;
  };
  const baseDate = hasDate ? b.date : wgDate(rng);
  const items = [];

  // 座標つきの土地（地積更正）は分筆と同じ部品を使う
  if (id === "W02" || id === "W11") {
    return wgLandFacts(rng, {
      owner: owner,
      shozai: b.shozai,
      chimoku: b.chimoku,
      date: baseDate,
      geo: id === "W11",
      landName: id === "W02" ? "乙土地" : "丙土地",
    });
  }
  if (id === "W17") {
    return wgLandFacts(rng, {
      owner: owner,
      shozai: b.shozai,
      chimoku: b.chimoku,
      date: baseDate,
      geo: false,
      landName: "甲土地",
    });
  }

  // 合筆（2〜3筆）
  if (id === "W07" || id === "W19" || id === "W18") {
    items.push(wgAcquireFact(rng, owner, baseDate, "甲土地"));
    items.push(wgAcquireFact(rng, owner, baseDate, "乙土地"));
    if (WG_LAND_USE[b.chimoku])
      items.push(
        `甲土地及び乙土地は、現在、いずれも${WG_LAND_USE[b.chimoku]}。`,
      );
    items.push(
      `土地家屋調査士${shiho}は、甲土地及び乙土地の登記記録を調査し、表題部及び権利部の記録が上記のとおりであることを確認した。`,
    );
    items.push(
      `土地家屋調査士${shiho}は、${owner}から、表示に関する登記の申請手続の代理及びこれに必要な調査の依頼を受けた。`,
      `${owner}は、登記の申請に要する費用を自ら負担することとしている。`,
    );
    return items;
  }

  // 公有水面埋立地の土地表題登記
  if (id === "W22") {
    items.push(
      `埋立工事は${wgPick(rng, WG_BUILDER)}が施工し、工事の完了後、新たに生じた土地の周囲にコンクリート杭の境界標を設置した。`,
    );
    if (WG_LAND_USE[b.chimoku])
      items.push(`新たに生じた土地は、現在、${WG_LAND_USE[b.chimoku]}。`);
    items.push(
      `土地家屋調査士${shiho}は、新たに生じた土地の現地を調査し、境界標の位置を測量した。`,
    );
    items.push(
      `${owner}は、登記の申請に要する費用を自ら負担することとしている。`,
    );
    return items;
  }

  // 建物・区分建物
  const builder = wgPick(rng, WG_BUILDER);
  const common = [];
  if (owner && shiho)
    common.push(
      `土地家屋調査士${shiho}は、${owner}から、表示に関する登記の申請手続の代理及びこれに必要な調査の依頼を受けた。`,
    );
  if (survey) common.push(survey);
  common.push(
    `建物の敷地は、幅員${wgPick(rng, [4, 5, 6])}メートルの公道に接している。`,
  );
  if (owner)
    common.push(`${owner}は、登記の申請に要する費用を自ら負担することとしている。`);
  const existing = ["W06", "W09", "W12", "W20", "W14", "W24", "W26", "W28"];
  const registry = owner
    ? `登記記録を調査したところ、表題部に記録された事項は上記のとおりであり、権利部（甲区）の所有権の登記名義人は${owner}であった。`
    : `登記記録を調査したところ、表題部に記録された事項は上記のとおりであった。`;
  if (existing.indexOf(id) >= 0) items.push(registry);
  if (id === "W03")
    items.push(
      `${owner}は、建築基準法に基づく確認済証及び検査済証の交付を受けており、建物は確認を受けた内容のとおりに建築されている。`,
      `建物の敷地は${owner}が所有する土地であり、建物の所有者と敷地の所有者は同一である。`,
      `工事は${builder}が請け負って施工した。`,
    );
  else if (id === "W06" || id === "W20")
    items.push(`増築工事は${builder}が請け負って施工した。`);
  else if (id === "W12" || id === "W28")
    items.push(`取壊し工事は${wgPick(rng, WG_DEMOLISHER)}が行い、建築資材は全て搬出されている。`);
  else if (id === "W21")
    items.push(`接続部分の増築工事は${builder}が請け負って施工した。`);
  else if (id === "W04" || id === "W10" || id === "W27" || id === "W29")
    items.push(
      `工事は${builder}が施工し、建築基準法に基づく検査済証の交付を受けている。`,
      `各専有部分の出入口は、いずれも共用の廊下又は階段に面している。`,
      `土地家屋調査士${shiho}は、現地で各専有部分の位置を確認し、壁の厚さを実測した。`,
    );
  else if (id === "W23")
    items.push(
      `甲建物、乙建物及び丙建物は、いずれも現地で壁によって接続していることを確認した。`,
    );
  else if (id === "W14" || id === "W24" || id === "W26")
    items.push(
      `土地家屋調査士${shiho}は、現地で各専有部分の位置と壁の厚さを確認した。`,
    );
  return items.concat(common.slice(0, 3));
}

// 事実関係の補足を問題文の末尾に足す。〔事実関係〕の番号つき項目が既にあれば続き番号にする。
// すでに（注）まで揃っている問題（分筆系）には足さない。
function wgLengthen(tpl, built, seed) {
  const st = built.statement;
  if (/（注）/.test(st)) return st;
  const rng = wgRng((seed ^ 0x2c9277b5) >>> 0);
  const items = wgSupplementFacts(tpl, built, rng);
  if (!items.length) return st;
  // 番号つきの項目が既にあれば続き番号にし、無ければ見出しから始める
  const nums = [...st.matchAll(/<p>([０-９]+)　/g)];
  let start = 1;
  if (nums.length) {
    const last = nums[nums.length - 1][1];
    start =
      Number(last.replace(/[０-９]/g, (c) => "０１２３４５６７８９".indexOf(c))) + 1;
  }
  const head = nums.length ? "" : `<p><b>〔事実関係（補足）〕</b></p>`;
  return (
    st +
    head +
    items.map((t, i) => `<p>${wgWideNo(start + i)}　${t}</p>`).join("") +
    wgNoteBlock()
  );
}

// ─────────── 土地: 分筆の定番形状 ───────────
// 北側筆界AB（X=xN の直線）と南側筆界DC（X=xS の直線）で挟まれた四角形に、
// 現地の境界標K・Lを結ぶ直線KLで分筆線PQを入れ、交点P・Qを求めさせる本試験の標準形。
//
// mode で解の出方を切り替える。
//   "clean" … 交点P・Qが整数になるよう、分筆線PQを 1/d だけ外へ延長した点をK・Lにする。
//             学習者の計算は t=1/(d+2) というきれいな分数になり、方法の習得に向く。
//   "real"  … 境界標K・Lを先に整数で置き、交点を素直に計算する。t=4/34 のような割り切れない
//             分数になり、答えが小数第3位まで出る本試験そのままの手触りになる。
//
// opt: { mode, geo: 世界測地系にするか, minArea, maxArea }
function wgBunpitsuShape(rng, opt) {
  opt = opt || {};
  const mode = opt.mode === "real" ? "real" : "clean";

  for (let attempt = 0; attempt < 500; attempt++) {
    // 奥行 H。clean モードでは延長比の分母 d で割り切れる必要がある。
    const H = wgPick(rng, [20, 24, 26, 30, 32, 34, 36, 40]);
    const wN = wgPick(rng, [22, 24, 26, 28, 30, 32]);
    const skew = wgPick(rng, [-4, -2, 0, 0, 2, 4, 6]);
    const wS = wN + wgPick(rng, [-4, -2, 0, 0, 2, 4]);
    if (wS < 16) continue;

    const yA = wgInt(rng, 0, 60);
    const xN = wgInt(rng, 80, 140);
    const xS = xN - H;
    const yD = yA + skew;

    let K, L, P, Q, tPnum, tPden, d;

    if (mode === "clean") {
      const divs = [3, 4, 5, 6].filter((v) => H % v === 0);
      if (!divs.length) continue;
      d = wgPick(rng, divs);
      // 交点Pを北辺上の整数点に置く（両端から8m以上離す）
      const pOff = wgInt(rng, 8, wN - 8);
      if (pOff < 8) continue;
      // 分筆線のY方向の伸び D は d の倍数（K・Lを整数座標にするため）
      const dY = d * wgPick(rng, [1, 2, 3, 4]) * (rng() < 0.5 ? 1 : -1);
      P = [xN, yA + pOff];
      Q = [xS, P[1] + dY];
      K = [xN + H / d, P[1] - dY / d];
      L = [xS - H / d, Q[1] + dY / d];
      if (!Number.isInteger(K[1]) || !Number.isInteger(L[1])) continue;
      tPnum = H / d;
      tPden = H + (2 * H) / d;
    } else {
      // 境界標を筆界の外側 a・b メートルに置く（本試験の「現地に設置された境界標」）
      const a = wgInt(rng, 3, 6);
      const b = wgInt(rng, 3, 6);
      const span = H + a + b;
      const dY = wgInt(rng, 8, 18) * (rng() < 0.5 ? 1 : -1);
      const yK = wgInt(rng, 0, 60);
      K = [xN + a, yK];
      L = [xS - b, yK + dY];
      // 割り切れてしまうと clean モードと同じ手触りになるので、小数が出る組合せだけ採用する
      if ((a * dY) % span === 0) continue;
      P = wgCrossAtX(K, L, xN).p;
      Q = wgCrossAtX(K, L, xS).p;
      tPnum = a;
      tPden = span;
      d = null;
    }

    // 交点が筆界の内側（両端から6m以上）に収まっていること
    if (P[1] < yA + 6 || P[1] > yA + wN - 6) continue;
    if (Q[1] < yD + 6 || Q[1] > yD + wS - 6) continue;

    const A = [xN, yA];
    const B = [xN, yA + wN];
    const D_ = [xS, yD];
    const C = [xS, yD + wS];

    const areaW = wgArea([A, P, Q, D_]);
    const areaE = wgArea([P, B, C, Q]);
    const minA = opt.minArea || 140;
    const maxA = opt.maxArea || 760;
    if (areaW < minA || areaW > maxA || areaE < minA || areaE > maxA) continue;
    // 面積が偏りすぎている形は問題として不自然なので避ける
    if (Math.min(areaW, areaE) / Math.max(areaW, areaE) < 0.35) continue;

    const off = opt.geo ? wgGeoOffset(rng) : { x: 0, y: 0 };
    const mv = (p) => [p[0] + off.x, p[1] + off.y];

    return {
      mode: mode,
      geo: !!opt.geo,
      H: H,
      A: mv(A),
      B: mv(B),
      C: mv(C),
      D_: mv(D_),
      K: mv(K),
      L: mv(L),
      P: mv(P),
      Q: mv(Q),
      xN: xN + off.x,
      xS: xS + off.x,
      areaW: areaW,
      areaE: areaE,
      lenPQ: wgDist(P, Q),
      // 学習者がたどる交点計算の道筋（解説にそのまま出す）
      tPnum: tPnum,
      tPden: tPden,
      tQnum: tPnum + H,
      dxKL: mv(L)[0] - mv(K)[0],
      dyKL: mv(L)[1] - mv(K)[1],
    };
  }
  return null;
}

// ─────────── 土地: 隣接2筆（合筆用） ───────────
// 南北に接続する2筆。合筆の可否判定と合筆後の地積を問うのに使う。
function wgGappitsuShape(rng, opt) {
  opt = opt || {};
  const w = wgPick(rng, [18, 20, 22, 24, 26]);
  const h1 = wgPick(rng, [10, 12, 14, 16, 18]);
  const h2 = wgPick(rng, [10, 12, 14, 16, 18]);
  const xTop = wgInt(rng, 90, 130);
  const yL = wgInt(rng, 0, 60);
  const off = opt.geo ? wgGeoOffset(rng) : { x: 0, y: 0 };
  const mv = (p) => [p[0] + off.x, p[1] + off.y];

  // 甲: 北側（X が大きい側）／乙: 南側
  const A = [xTop, yL];
  const B = [xTop, yL + w];
  const C = [xTop - h1, yL + w];
  const D = [xTop - h1, yL];
  const E = [xTop - h1 - h2, yL + w];
  const F = [xTop - h1 - h2, yL];

  return {
    A: mv(A),
    B: mv(B),
    C: mv(C),
    D: mv(D),
    E: mv(E),
    F: mv(F),
    areaKou: w * h1,
    areaOtsu: w * h2,
    w: w,
    h1: h1,
    h2: h2,
  };
}

// ─────────── 土地: 単独の一筆（表題登記・地積更正用） ───────────
// 北側筆界（X一定）と南側筆界（X一定）に挟まれた四角形。東西の辺を傾けて
// 長方形にならないようにするので、面積は座標法でしか出せない。
function wgTanpitsuShape(rng, opt) {
  opt = opt || {};
  const H = wgPick(rng, [18, 20, 22, 24, 26, 28, 30]);
  const wN = wgPick(rng, [16, 18, 20, 22, 24, 26]);
  const skew = wgPick(rng, [-5, -3, -2, 2, 3, 5]); // 0を除き必ず台形にする
  const wS = wN + wgPick(rng, [-4, -2, 2, 4]);
  if (wS < 12) return null;

  const yA = wgInt(rng, 0, 60);
  const xN = wgInt(rng, 80, 140);
  const xS = xN - H;
  const yD = yA + skew;

  const off = opt.geo ? wgGeoOffset(rng) : { x: 0, y: 0 };
  // 実測の座標は小数第2位まで出る。整数のままだと面積も整数になり、
  // 規則100条の端数処理を問う意味がなくなるので cm 単位のずれを与える。
  // ただし北側筆界ＡＢ・南側筆界ＤＣはそれぞれ X 一定の直線でなければならないので、
  // X のずれは辺ごとに1つ、Y のずれは点ごとに与える。
  const cm = () => wgInt(rng, 1, 99) / 100;
  const dxN = cm();
  const dxS = cm();
  const pt = (x, y, dx) => [
    +(x + off.x + dx).toFixed(2),
    +(y + off.y + cm()).toFixed(2),
  ];

  const A = pt(xN, yA, dxN);
  const B = pt(xN, yA + wN, dxN);
  const C = pt(xS, yD + wS, dxS);
  const D = pt(xS, yD, dxS);
  const area = wgArea([A, B, C, D]);
  if (area < 150 || area > 900) return null;
  // 端数が出ていることを確認する（整数ちょうどでは端数処理の設問にならない）
  if (Math.abs(area - Math.round(area)) < 0.02) return null;

  return { A: A, B: B, C: C, D: D, area: area, geo: !!opt.geo, H: H };
}

// ─────────── 建物: 矩形の頂点 ───────────
// 建物図面は X=北を上、Y=東を右に描く。南西の角を (0, yOff) に置いた矩形を返す。
// depth=奥行(南北)、width=間口(東西)。
function wgRect(nameBase, depth, width, yOff, xOff) {
  const y = yOff || 0;
  const x = xOff || 0;
  const o = {};
  o[nameBase + "1"] = [x, y];
  o[nameBase + "2"] = [x, y + width];
  o[nameBase + "3"] = [x - depth, y + width];
  o[nameBase + "4"] = [x - depth, y];
  return o;
}

// 矩形の polys 用の頂点名リスト
function wgRectPoly(nameBase) {
  return [nameBase + "1", nameBase + "2", nameBase + "3", nameBase + "4"];
}

// ─────────── 申請書の共通項目ビルダー ───────────
// 複合登記では「一の申請情報でまとめられるか／連件になるか」が最大の得点源なので、
// 申請件数と各件の登記の目的を必ず聞く。
function wgRenkenForm(count, purposes, note) {
  const rows = [
    {
      label: "申請件数（一の申請情報で足りるなら「1件」）",
      answer: [count + "件", String(count)],
      hint: note || "規則35条でまとめられるか、連件になるかを判断する",
      pts: 2,
    },
  ];
  purposes.forEach((p, i) => {
    rows.push({
      label:
        purposes.length === 1
          ? "登記の目的"
          : `${i + 1}件目の登記の目的（申請の順序どおりに）`,
      answer: p.answer,
      hint: p.hint || "",
      pts: 2,
    });
  });
  return rows;
}

// ─────────── 作図の自己チェック項目 ───────────
// 手描き図面は機械採点できないので、準則が定める「記載しなければならない事項」を
// 項目に落として自己申告させる。本試験の減点は記載漏れで起きることが多い。
// 図面の種類ごとに共通項目を返し、テンプレート側で個別項目を足す。
function wgFigChecks(kind, extra) {
  const common = {
    // 地積測量図（規則77条）
    chisekiSokuryo: [
      "方位を記入した",
      "縮尺を記入した",
      "地番（隣接地の地番を含む）を記入した",
      "各筆界点の座標値を記入した",
      "平面直角座標系の番号又は記号を記入した",
      "各筆界点間の距離（辺長）を記入した",
      "地積及びその求積方法を記入した",
      "基本三角点等の位置を記入した",
      "境界標があるときはその種類を記入した",
      "測量の年月日を記入した",
    ],
    // 建物図面（規則82条）
    tatemonoZumen: [
      "方位を記入した",
      "縮尺（原則500分の1）で作図した",
      "敷地の地番及びその形状を記入した",
      "隣接地の地番を記入した（形状は不要）",
      "建物の位置を敷地の境界からの距離で示した",
      "附属建物があるときは符号を付した",
    ],
    // 各階平面図（規則83条）
    kakukaiHeimen: [
      "縮尺（原則250分の1）で作図した",
      "各階の別を記入した",
      "各階の平面の形状を記入した",
      "1階の位置を記入した",
      "各階ごとの建物の周囲の長さを記入した",
      "各階の床面積及びその求積方法を記入した",
    ],
  };
  return (common[kind] || []).concat(extra || []);
}

// テンプレートが figureChecks を明示しないときの既定値。
// 土地の登記なら地積測量図、建物・区分建物なら建物図面＋各階平面図が添付図面になる。
// 滅失の登記のように図面を要しない登記だけは、テンプレート側で [] を明示して打ち消す。
function wgDefaultFigChecks(type) {
  if (type === "土地") return wgFigChecks("chisekiSokuryo");
  return wgFigChecks("tatemonoZumen").concat(wgFigChecks("kakukaiHeimen"));
}

// ─────────── 座標表の組み立て ───────────
function wgCoordRows(pairs) {
  return pairs.map((p) => ({
    name: p[0],
    x: p[1][0],
    y: p[1][1],
    note: p[2] || "",
  }));
}

// ─────────── 交点計算タスクの組み立て（分筆の定番） ───────────
// 「PのY座標」「QのY座標」を問う2問を、桁数指定つきで作る。
function wgCrossTasks(sh, digits) {
  const dg = digits === undefined ? 2 : digits;
  const dgTxt = dg === 3 ? "３" : "２";
  const sign = (v) => (v < 0 ? "−" : "+");
  const kl =
    `直線ＫＬを媒介変数で表すと ` +
    `X=${sh.K[0].toFixed(dg)}${sign(sh.dxKL)}${Math.abs(sh.dxKL)}t, ` +
    `Y=${sh.K[1].toFixed(dg)}${sign(sh.dyKL)}${Math.abs(sh.dyKL)}t`;
  return [
    {
      q: `交点ＰのＹ座標を求めよ（小数第${dgTxt}位まで）。`,
      unit: "m",
      answer: +sh.P[1].toFixed(dg),
      tol: 0.01,
      pts: 3,
      expl:
        `北側筆界ＡＢはＡ・Ｂともに X=${sh.xN.toFixed(dg)} の直線。<br>${kl}。<br>` +
        `X=${sh.xN.toFixed(dg)} より t=${wgFracText(sh.tPnum, sh.tPden)}。<br>` +
        `これを代入して Y=<b>${sh.P[1].toFixed(dg)}</b>`,
    },
    {
      q: `交点ＱのＹ座標を求めよ（小数第${dgTxt}位まで）。`,
      unit: "m",
      answer: +sh.Q[1].toFixed(dg),
      tol: 0.01,
      pts: 3,
      expl:
        `南側筆界ＤＣは X=${sh.xS.toFixed(dg)} の直線。<br>` +
        `t=${wgFracText(sh.tQnum, sh.tPden)} を代入して Y=<b>${sh.Q[1].toFixed(dg)}</b>。<br>` +
        `分筆線ＰＱの長さは √(ΔX²+ΔY²)＝<b>${sh.lenPQ.toFixed(dg)}m</b>（地積測量図に辺長として記入する）。`,
    },
  ];
}

// ─────────── 面積・地積タスクの組み立て ───────────
// 座標法で面積を出し、規則100条で地積に丸めるまでの2段階を問う。
// 従前の登記地積は「分筆後の各地積の合計」で定義するので、検算が必ず成立する。
function wgAreaTasks(o) {
  // o: { label1, pts1(座標法用の点列), chimoku1, label2, pts2, chimoku2, digits }
  const dg = o.digits === undefined ? 2 : o.digits;
  const a1 = wgArea(o.pts1),
    a2 = wgArea(o.pts2);
  const g1 = wgChiseki(a1, o.chimoku1),
    g2 = wgChiseki(a2, o.chimoku2);
  return {
    a1: a1,
    a2: a2,
    g1: g1,
    g2: g2,
    total: +(g1 + g2).toFixed(2),
    tasks: [
      {
        q: `${o.label1}の面積を座標法で求めよ（小数第${dg === 3 ? "３" : "２"}位まで）。`,
        unit: "㎡",
        answer: +a1.toFixed(dg),
        tol: 0.05,
        pts: 4,
        expl: `倍面積＝ΣXᵢ(Yᵢ₊₁−Yᵢ₋₁) の絶対値＝${wgDoubleArea(o.pts1).toFixed(dg)} ⟹ 面積＝<b>${a1.toFixed(dg)}㎡</b>`,
      },
      {
        q: `${o.label1}の登記すべき地積を答えよ（規則100条）。`,
        unit: "㎡",
        answer: g1,
        tol: 0,
        pts: 3,
        expl: `${wgChisekiRule(o.chimoku1)}⟹ <b>${wgChisekiText(g1, o.chimoku1)}㎡</b>`,
      },
      {
        q: `${o.label2}の登記すべき地積を答えよ。`,
        unit: "㎡",
        answer: g2,
        tol: 0,
        pts: 3,
        expl:
          `面積＝${a2.toFixed(dg)}㎡。${wgChisekiRule(o.chimoku2)}⟹ <b>${wgChisekiText(g2, o.chimoku2)}㎡</b><br>` +
          `<b>検算</b>: ${wgChisekiText(g1, o.chimoku1)}＋${wgChisekiText(g2, o.chimoku2)}＝${(g1 + g2).toFixed(2).replace(/\.00$/, "")} ＝ 従前の地積 ✓`,
      },
    ],
  };
}

// ─────────── 条文の穴埋め（本試験の記述式 問2 形式） ───────────
// 本試験の記述式は、問1で計算、問2で条文の穴埋め、問3で申請書、問4で作図を問う。
// articles.js の条文本文には重要語句が <em class="art-hl"> で囲われているので、
// そこを（ア）（イ）…に置き換えるだけで、本試験と同じ形式の設問が作れる。
const WG_KANA = ["ア", "イ", "ウ", "エ", "オ", "カ", "キ", "ク"];

// 登記の種類ごとに、記述式で問われやすい条文を割り当てる。
const WG_ARTICLE_BY_TYPE = {
  土地: ["準則68", "規則100", "不登法39", "不登法41", "規則77", "不登法37"],
  建物: ["不登法51", "不登法57", "規則111", "不登法44"],
  区分建物: ["規則111", "不登法44", "区分所有法22"],
};

// 条文テキストから art-hl の語句を抜き出し、n個を空欄にした設問を作る。
// 戻り値は appForm と同じ形（label/answer/hint/pts）なので採点処理を共用できる。
function wgArticleFill(rng, key, n) {
  const raw = typeof ARTICLES !== "undefined" ? ARTICLES[key] : null;
  if (!raw) return null;
  // art-note は条文そのものではなく学習用の要約メモで、答えを丸ごと書いていることがある。
  // 穴埋めに使うと設問が成立しないので落とす。
  const src = {
    ...raw,
    text: raw.text
      .replace(/<span class="art-note">[\s\S]*?<\/span>/g, "")
      .trim(),
  };
  // まず強調タグを外して素の条文にする。強調のまま残すと、どこが答えかが見えてしまう。
  const bare = src.text.replace(/<em class="art-hl">([^<]*)<\/em>/g, "$1");

  // 空欄の候補は art-hl で囲われた語句。同じ語句が複数箇所にある条文があるので、
  // 語句そのもので一意化し、採用したら「全ての出現箇所」を同じ記号で空欄にする。
  // 一箇所だけ空けると他の号に答えが残ってしまうため。
  const uniq = [];
  const seen = {};
  let m;
  const re = /<em class="art-hl">([^<]+)<\/em>/g;
  while ((m = re.exec(src.text))) {
    const t = m[1];
    if (t.length < 3 || t.length > 40 || seen[t]) continue;
    seen[t] = true;
    uniq.push(t);
  }
  if (uniq.length < 2) return null;

  // シードから空欄にする語句を選ぶ
  const pool = uniq.slice();
  const picked = [];
  const want = Math.min(n, pool.length);
  while (picked.length < want) {
    picked.push(pool.splice(wgInt(rng, 0, pool.length - 1), 1)[0]);
  }

  // 長い語句から先に置換する。短い語句が長い語句の一部を食うのを防ぐため。
  const order = picked.slice().sort((a, b) => b.length - a.length);
  const token = (t) => ` ${picked.indexOf(t)} `;
  let html = bare;
  order.forEach((t) => (html = html.split(t).join(token(t))));

  // 記号（ア・イ・…）は本文に現れる順に振り直す。設問として自然な並びにするため。
  const appear = picked
    .map((t) => ({ t, at: html.indexOf(token(t)) }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at);
  if (appear.length < 2) return null;

  appear.forEach((x, i) => {
    html = html
      .split(token(x.t))
      .join(`<b class="art-blank">（${WG_KANA[i]}）</b>`);
  });

  return {
    key,
    lawLabel: `${src.law}${src.no}（${src.title}）`,
    html,
    fields: appear.map((x, i) => ({
      label: `（${WG_KANA[i]}）`,
      // 括弧書きの補足（例「百分の一（0.01㎡）未満…」）は省いた解答も正解とする
      answer: [x.t, x.t.replace(/[（(][^）)]*[）)]/g, "")].filter(
        (v, j, a) => v && a.indexOf(v) === j,
      ),
      pts: 2,
    })),
  };
}

// テンプレートの type から条文を1つ選んで穴埋めを作る。
// 収録のない条文を指していても null を返すだけで、問題の生成自体は壊さない。
function wgArticleFillFor(rng, type) {
  const keys = WG_ARTICLE_BY_TYPE[type] || [];
  if (!keys.length) return null;
  // ランダムな位置から一巡し、収録があって穴埋めにできる条文を最初に見つけた時点で採用する
  const start = wgInt(rng, 0, keys.length - 1);
  for (let i = 0; i < keys.length; i++) {
    const built = wgArticleFill(
      rng,
      keys[(start + i) % keys.length],
      wgInt(rng, 3, 4),
    );
    if (built) return built;
  }
  return null;
}


// ─────────── 申請書の表セルの後付け ───────────
// 表のセルの正答は、テンプレートが先に作った設問（tasks）の答えや既存の申請書項目と同じ値になる。
// そこで、テンプレート側は tpl.sheet に「どの項目をどの表のどのセルに置くか」だけを宣言し、
// 値は生成後にここで引く（同じ数値を二度計算して食い違うのを防ぐため）。
//   { match: 正規表現, cell }          既存の申請書項目をセルに移す
//   { matchAll: 正規表現, table, col } 該当する項目すべてを同じ列の上から順に移す
//   { cell, label, task: 添字, fmt }   設問 tasks[添字] の答えからセルを作る
//   { cell, label, value: fn(built) }  built から正答（文字列または配列）を返す
//   { build: fn(built) }               申請書項目（セル）の配列を直接返す
// cell は { table, row, col } か { table, pre }。fmt は "area"（既定）か "floors"。
function wgAreaAccepts(v) {
  const a = [v.toFixed(2), String(v), v.toFixed(2) + "㎡", String(v) + "㎡"];
  return a.filter((x, i) => a.indexOf(x) === i);
}

// 複数階の床面積は「1階85.00㎡ 2階69.50㎡」の形。空白は採点側で無視される。
function wgFloorsAccepts(areas) {
  const out = [];
  [(v) => v.toFixed(2), (v) => String(v)].forEach((f) =>
    ["㎡", ""].forEach((unit) => {
      out.push(areas.map((a, i) => `${i + 1}階${f(a)}${unit}`).join(""));
      if (areas.length === 1) out.push(`${f(areas[0])}${unit}`);
    }),
  );
  return out.filter((x, i) => out.indexOf(x) === i);
}

function wgApplySheet(tpl, built) {
  if (!tpl.sheet) return;
  tpl.sheet.forEach((d) => {
    if (d.build) {
      // built から申請書項目（表のセル）の配列を直接作る
      d.build(built).forEach((e) => built.appForm.push(e));
      return;
    }
    if (d.matchAll) {
      // 該当する項目すべてを、表の同じ列の上から順の行に置く
      built.appForm
        .filter((x) => d.matchAll.test(x.label))
        .forEach((f, r) => {
          f.cell = { table: d.table, row: r, col: d.col };
        });
      return;
    }
    if (d.match) {
      const f = built.appForm.find((x) => d.match.test(x.label));
      if (f) f.cell = d.cell;
      return;
    }
    let answer;
    if (d.value) answer = d.value(built);
    else {
      const v = built.tasks[d.task].answer;
      answer = d.fmt === "floors" ? wgFloorsAccepts([].concat(v)) : wgAreaAccepts(v);
    }
    built.appForm.push({
      cell: d.cell,
      label: d.label,
      answer: Array.isArray(answer) ? answer : [answer],
      hint: d.hint || "",
      pts: d.pts || 2,
    });
  });
}

// ─────────── テンプレートから1問を組み立てる ───────────
// written.js の WRITTEN は「メタ情報 + build(rng)」のテンプレート配列。
// ここでシードから乱数を作り、テンプレートに具体的な問題を吐かせる。
function buildWritten(id, seed) {
  const tpl = (typeof WRITTEN !== "undefined" ? WRITTEN : []).find(
    (w) => w.id === id,
  );
  if (!tpl) return null;
  const s = seed >>> 0 || wgNewSeed();
  const rng = wgRng(s);
  let inst = null;
  // 形状生成は棄却法を使うため、まれに条件を満たさず null が返る。シードをずらして再挑戦する。
  for (let i = 0; i < 12 && !inst; i++) {
    inst = tpl.build(wgRng((s + i * 7919) >>> 0));
  }
  if (!inst) return null;
  const built = Object.assign(
    {
      id: tpl.id,
      type: tpl.type,
      title: tpl.title,
      target: tpl.target,
      combo: tpl.combo || null,
    },
    inst,
    { seed: s },
  );
  // 申請書の表のセル（建物の表示・敷地権の表示など）。tpl.sheet の宣言から後付けする。
  built.appForm = built.appForm.slice();
  wgApplySheet(tpl, built);
  // 事案の短いテンプレートには、答えに効かない事実関係を足して本試験の長さに近づける
  built.statement = wgLengthen(tpl, built, s);
  // 作図チェックはテンプレートが明示していなければ図面の種類から補う
  if (built.figureChecks === undefined)
    built.figureChecks = wgDefaultFigChecks(tpl.type);
  // 条文の穴埋め（本試験の問2）もテンプレートが指定していなければ種別から補う。
  // 条文データが読み込まれていない環境では null になるだけで問題は成立する。
  if (built.articleFill === undefined)
    built.articleFill = wgArticleFillFor(
      wgRng((s ^ 0x5bf03635) >>> 0),
      tpl.type,
    );
  return built;
}
