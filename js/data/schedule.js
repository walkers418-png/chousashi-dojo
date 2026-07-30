// 学習スケジュール定義（docs/chousashi/STUDY_PLAN.md と同期）
// 本試験: 2026-10-18（令和8年度・法務省公示）
//
// 2026-07-30 に方針変更。行政書士の受験を取りやめ、令和8年度の調査士試験を受ける
// ことになったため、12ヶ月計画から「残り80日のスプリント」へ全面的に組み直した。
// 記述式が50点を占め足切りもあるため、択一より記述に重心を置く配分にしている。
const SCHEDULE = {
  examDate: "2026-10-18",
  fullStartDate: "2026-07-30", // 方針変更の日。ここから本気モード
  phases: [
    {
      id: "S1",
      name: "Sprint 1: 記述の型を体に入れる",
      from: "2026-01-01",
      to: "2026-08-24",
      goal: "土地・建物の申請書と作図の手順を「迷わず書ける」状態にする。計算は毎日。",
      daily: [
        { task: "記述式を1問（土地→建物→区分の順で回す）", tab: "written" },
        { task: "計算道場20分（交点・面積を中心に）", tab: "calc" },
        { task: "択一20問（ミックス演習でよい）", tab: "quiz" },
      ],
    },
    {
      id: "S2",
      name: "Sprint 2: 択一の底上げ＋記述の速度",
      from: "2026-08-25",
      to: "2026-09-20",
      goal: "択一を基準点（32.5点）以上で安定させる。記述は1問50分以内へ。",
      daily: [
        { task: "択一20問を50分計測（本試験形式の模試）", tab: "quiz" },
        { task: "記述式を1問・時間を計って解く", tab: "written" },
        { task: "間違えた分野の講義を読み直す", tab: "lecture" },
      ],
    },
    {
      id: "S3",
      name: "Sprint 3: 通し演習で本番に慣れる",
      from: "2026-09-21",
      to: "2026-10-11",
      goal: "午後2時間30分の通し演習。時間配分（択一50分・記述100分）を固める。",
      daily: [
        { task: "フル模試（択一20＋記述2）を週2回", tab: "quiz" },
        { task: "間違いノートとSRSで穴を潰す", tab: "quiz" },
        { task: "申請書の雛形を1つ白紙再現", tab: "written" },
      ],
    },
    {
      id: "S4",
      name: "Sprint 4: 直前期（新しいことはしない）",
      from: "2026-10-12",
      to: "2026-10-18",
      goal: "計算手順と申請書雛形の最終確認。新規問題には手を出さない。",
      daily: [
        { task: "計算道場を15分だけ（手を鈍らせない）", tab: "calc" },
        { task: "間違いノートを読み返す", tab: "quiz" },
        { task: "作図の手順とチェック項目を確認", tab: "written" },
      ],
    },
  ],
  // 受験手続きリマインダー
  milestones: [
    {
      date: "2026-08-07",
      label:
        "🚨 受験申請の締切（7/27〜8/7・法務省）— 午前免除は測量士補合格証書の写しが必要",
    },
    {
      date: "2026-09-20",
      label: "受験票の到着を確認（届かなければ法務局へ連絡）",
    },
    {
      date: "2026-10-11",
      label: "会場までの経路・持ち物（電卓・三角定規）の最終確認",
    },
    { date: "2026-10-18", label: "🎯 本試験（筆記・午後の部 13:00〜15:30）" },
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

function daysToExam(now) {
  const d = now || new Date();
  const exam = new Date(SCHEDULE.examDate + "T00:00:00");
  return Math.max(0, Math.ceil((exam - d) / 86400000));
}
