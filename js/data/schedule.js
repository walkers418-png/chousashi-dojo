// 学習スケジュール定義（docs/chousashi/STUDY_PLAN.md と同期）
// 本試験: 2027-10-17（令和9年度・10月第3日曜想定）
const SCHEDULE = {
  examDate: "2027-10-17",
  fullStartDate: "2026-11-09", // 行政書士本試験(11/8)翌日から本格始動
  phases: [
    {
      id: "P0",
      name: "助走期間（行政書士優先）",
      from: "2026-01-01",
      to: "2026-11-08",
      goal: "電卓操作と座標計算を体に入れる。本格学習は11/9から。",
      daily: [
        { task: "計算道場を20分（交点計算・面積計算を各2問）", tab: "calc" },
        {
          task: "余力があれば講義「計算の基礎・複素数電卓」を読む",
          tab: "lecture",
        },
      ],
    },
    {
      id: "P1",
      name: "Phase 1: 基礎インプット",
      from: "2026-11-09",
      to: "2027-01-31",
      goal: "民法・不登法総論・土地・建物のインプット完了。択一過去問1周。",
      daily: [
        {
          task: "講義ユニットを1つ精読（民法→総論→土地→建物の順）",
          tab: "lecture",
        },
        { task: "読んだ分野の択一演習10問", tab: "quiz" },
        { task: "計算道場30分（交点・面積・放射を毎日）", tab: "calc" },
      ],
    },
    {
      id: "P2",
      name: "Phase 2: 択一完成＋計算マスター",
      from: "2027-02-01",
      to: "2027-04-30",
      goal: "択一の正答率7割→9割へ。計算は1問5分以内。答練申込（4月）。",
      daily: [
        { task: "択一演習20問（本試験形式・50分計測）", tab: "quiz" },
        { task: "間違えた分野の講義を読み直す", tab: "lecture" },
        { task: "計算道場30分（全種目ローテーション）", tab: "calc" },
      ],
    },
    {
      id: "P3",
      name: "Phase 3: 記述式（書式）本格化",
      from: "2027-05-01",
      to: "2027-07-31",
      goal: "土地・建物の記述式を時間内に完答。7月末〜8月上旬に受験申請！",
      daily: [
        { task: "記述式を1問（土地と建物を交互に）", tab: "written" },
        { task: "択一20問でメンテナンス", tab: "quiz" },
        { task: "申請書の雛形を1つ白紙再現", tab: "written" },
      ],
    },
    {
      id: "P4",
      name: "Phase 4: 仕上げ・直前期",
      from: "2027-08-01",
      to: "2027-10-17",
      goal: "本試験形式の通し演習。総合75点以上を安定させる。模試受験。",
      daily: [
        { task: "択一模試20問（50分以内厳守）", tab: "quiz" },
        { task: "記述式 土地・建物セットを通しで（週2回）", tab: "written" },
        { task: "計算手順・申請書雛形の最終確認", tab: "calc" },
      ],
    },
  ],
  // 受験手続きリマインダー
  milestones: [
    { date: "2027-04-01", label: "答練（答案練習会）申込・開始" },
    {
      date: "2027-07-20",
      label: "⚠️ 受験申請の準備（午前免除: 測量士補合格証書の写しを用意）",
    },
    {
      date: "2027-08-05",
      label: "⚠️ 受験申請締切目安（法務省サイトで正式日程を確認）",
    },
    { date: "2027-09-01", label: "公開模試の受験（2〜3回）" },
    { date: "2027-10-17", label: "🎯 本試験（筆記・午後の部）" },
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
