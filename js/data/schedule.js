// 学習スケジュール定義（docs/chousashi/STUDY_PLAN.md と同期）
// 本試験: 2027-10-17（令和9年度・予想日。例年10月第3日曜。法務省の公示が出たら確定日に直す）
//
// 令和8年度（2026-10-18）の試験を終え、令和9年度に向けて約1年の計画へ組み直した（2026-10-21）。
// 日付はすべて予想。公示が出たら examDate・フェーズ境界・milestones を直す。
// 記述式が50点を占め足切りもあるため、択一より記述に重心を置く配分にしている。
const SCHEDULE = {
  examDate: "2027-10-17", // 予想日（未公示）
  fullStartDate: "2026-10-21", // 令和9年度計画の開始日
  phases: [
    {
      id: "S1",
      name: "Phase 1: 土台づくり（知識・計算・記述の型）",
      // 過去日から始めておく。計画開始前に開いた日でもフェーズ未定にならないようにするため
      from: "2020-01-01",
      to: "2027-02-28",
      goal: "民法・不動産登記法・測量計算の基礎を固め、土地・建物の申請書を「迷わず書ける」状態にする。",
      daily: [
        { task: "記述式を1問（土地→建物→区分の順で回す）", tab: "written" },
        { task: "計算道場20分（交点・面積を中心に）", tab: "calc" },
        { task: "択一10問＋間違えた分野の講義を読み直す", tab: "quiz" },
      ],
    },
    {
      id: "S2",
      name: "Phase 2: 択一の底上げ＋記述の速度",
      from: "2027-03-01",
      to: "2027-06-30",
      goal: "択一を基準点以上で安定させる。記述は1問50分以内へ。",
      daily: [
        { task: "択一20問を50分計測（本試験形式の模試）", tab: "quiz" },
        { task: "記述式を1問・時間を計って解く", tab: "written" },
        { task: "間違えた分野の講義を読み直す", tab: "lecture" },
      ],
    },
    {
      id: "S3",
      name: "Phase 3: 通し演習で本番に慣れる",
      from: "2027-07-01",
      to: "2027-09-30",
      goal: "午後2時間30分の通し演習。時間配分（択一50分・記述100分）を固める。",
      daily: [
        { task: "フル模試（択一20＋記述2）を週2回", tab: "quiz" },
        { task: "間違いノートとSRSで穴を潰す", tab: "quiz" },
        { task: "申請書の雛形を1つ白紙再現", tab: "written" },
      ],
    },
    {
      id: "S4",
      name: "Phase 4: 直前期（新しいことはしない）",
      from: "2027-10-01",
      to: "2027-10-17",
      goal: "計算手順と申請書雛形の最終確認。新規問題には手を出さない。",
      daily: [
        { task: "計算道場を15分だけ（手を鈍らせない）", tab: "calc" },
        { task: "間違いノートを読み返す", tab: "quiz" },
        { task: "作図の手順とチェック項目を確認", tab: "written" },
      ],
    },
  ],
  // 受験手続きリマインダー（日付は予想。公示で確認すること）
  milestones: [
    {
      date: "2027-05-16",
      label: "測量士補試験（予想日）— 午前の部免除には合格証書の写しが必要。公示を確認",
    },
    {
      date: "2027-07-26",
      label:
        "🚨 受験申請の受付開始（予想: 7月下旬〜8月上旬・法務省）— 公示で締切を必ず確認",
    },
    {
      date: "2027-09-19",
      label: "受験票の到着を確認（届かなければ法務局へ連絡）",
    },
    {
      date: "2027-10-10",
      label: "会場までの経路・持ち物（電卓・三角定規）の最終確認",
    },
    { date: "2027-10-17", label: "🎯 本試験（予想日・筆記・午後の部 13:00〜15:30）" },
  ],
};

function currentPhase(now) {
  const d = now || new Date();
  const ymd = d.toISOString().slice(0, 10);
  for (const p of SCHEDULE.phases) {
    if (ymd >= p.from && ymd <= p.to) return p;
  }
  return SCHEDULE.phases[SCHEDULE.phases.length - 1];
}

// 試験年度の和暦ラベル。examDate を変えたら表示も自動で追随させるため計算で出す。
// 令和は2019年が元年（2019 − 2018 = 1）。
function examYearLabel() {
  const y = Number(SCHEDULE.examDate.slice(0, 4));
  return `令和${y - 2018}年度`;
}

function daysToExam(now) {
  const d = now || new Date();
  const exam = new Date(SCHEDULE.examDate + "T00:00:00");
  return Math.max(0, Math.ceil((exam - d) / 86400000));
}
