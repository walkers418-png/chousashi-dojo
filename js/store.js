// localStorage による進捗管理
const Store = {
  KEY: "chousashi_dojo_v1",
  _cache: null,

  load() {
    if (this._cache) return this._cache;
    try {
      this._cache = JSON.parse(localStorage.getItem(this.KEY)) || {};
    } catch (e) {
      this._cache = {};
    }
    this._cache.quiz = this._cache.quiz || {}; // {qid: {ok, ng, last}}
    this._cache.flash = this._cache.flash || {}; // {fid: {ok, ng}} 一問一答
    this._cache.calc = this._cache.calc || {}; // {type: {ok, ng}}
    this._cache.written = this._cache.written || {}; // {wid: {done, score}}
    this._cache.days = this._cache.days || []; // ["YYYY-MM-DD", ...] 学習した日
    this._cache.checks = this._cache.checks || {}; // 今日のタスクチェック {date: [bool]}
    this._cache.srs = this._cache.srs || {}; // {fid: {ef, intv, reps, lapses, due, last}} 間隔反復(SM-2)
    this._cache.srsDaily = this._cache.srsDaily || {}; // {date: 今日導入した新規カード数} 新規キャップ用
    this._cache.calib = this._cache.calib || { co: 0, cx: 0, uo: 0, ux: 0 }; // 自信度×正誤の集計
    this._cache.overconf = this._cache.overconf || {}; // {"quiz:M01": true} 過信（自信あり×不正解）項目
    this._cache.memos = this._cache.memos || {}; // {"quiz:M01": "自分メモ"} 間違いノートのメモ
    return this._cache;
  },

  save() {
    localStorage.setItem(this.KEY, JSON.stringify(this._cache));
  },

  today() {
    return new Date().toISOString().slice(0, 10);
  },

  touchToday() {
    const d = this.load();
    const t = this.today();
    if (!d.days.includes(t)) {
      d.days.push(t);
      this.save();
    }
  },

  streak() {
    const days = new Set(this.load().days);
    let n = 0;
    const cur = new Date();
    // 今日まだ学習していなくても昨日までの連続は維持して表示
    if (!days.has(cur.toISOString().slice(0, 10)))
      cur.setDate(cur.getDate() - 1);
    while (days.has(cur.toISOString().slice(0, 10))) {
      n++;
      cur.setDate(cur.getDate() - 1);
    }
    return n;
  },

  recordQuiz(qid, ok) {
    const d = this.load();
    const r = d.quiz[qid] || { ok: 0, ng: 0 };
    ok ? r.ok++ : r.ng++;
    r.last = this.today();
    d.quiz[qid] = r;
    this.touchToday();
    this.save();
  },

  recordFlash(fid, ok) {
    const d = this.load();
    const r = d.flash[fid] || { ok: 0, ng: 0 };
    ok ? r.ok++ : r.ng++;
    d.flash[fid] = r;
    this.touchToday();
    this.save();
  },

  flashCatStats() {
    const d = this.load();
    const stats = {};
    for (const f of FLASH) {
      const c = f.cat;
      stats[c] = stats[c] || { ok: 0, ng: 0, total: 0 };
      stats[c].total++;
      const r = d.flash[f.id];
      if (r) {
        stats[c].ok += r.ok;
        stats[c].ng += r.ng;
      }
    }
    return stats;
  },

  weakFlash() {
    const d = this.load();
    return FLASH.filter((f) => {
      const r = d.flash[f.id];
      return r && r.ng > 0 && r.ng >= r.ok;
    });
  },

  recordCalc(type, ok) {
    const d = this.load();
    const r = d.calc[type] || { ok: 0, ng: 0 };
    ok ? r.ok++ : r.ng++;
    d.calc[type] = r;
    this.touchToday();
    this.save();
  },

  recordWritten(wid, score, total) {
    const d = this.load();
    d.written[wid] = { done: true, score, total, last: this.today() };
    this.touchToday();
    this.save();
  },

  catStats() {
    const d = this.load();
    const stats = {};
    for (const q of QUESTIONS) {
      const c = q.cat;
      stats[c] = stats[c] || { ok: 0, ng: 0, total: 0 };
      stats[c].total++;
      const r = d.quiz[q.id];
      if (r) {
        stats[c].ok += r.ok;
        stats[c].ng += r.ng;
      }
    }
    return stats;
  },

  weakQuestions() {
    const d = this.load();
    return QUESTIONS.filter((q) => {
      const r = d.quiz[q.id];
      return r && r.ng > 0 && r.ng >= r.ok;
    });
  },

  taskChecks(date) {
    const d = this.load();
    return d.checks[date] || [];
  },

  setTaskCheck(date, idx, val) {
    const d = this.load();
    d.checks[date] = d.checks[date] || [];
    d.checks[date][idx] = val;
    if (val) this.touchToday();
    this.save();
  },

  // ─────────── 間隔反復（SRS / SM-2アルゴリズム） ───────────
  // 一問一答（FLASH）カードを「忘れかけた頃」に再出題し長期記憶へ定着させる。
  // 各カードの状態: ef=易しさ係数(2.5起点・下限1.3) / intv=次回までの日数 /
  // reps=連続正解回数 / lapses=失敗回数 / due=次回出題日(YYYY-MM-DD)。
  SRS_NEW_PER_DAY: 15, // 1日に新たに導入するカードの上限（詰め込み防止）
  SRS_MIN_EF: 1.3, // 易しさ係数の下限（SM-2標準）
  SRS_EASY_FIRST_INTV: 4, // 新規カードを「かんたん」で覚えたときの初回間隔(日)

  // 日付文字列に n 日加算（today() と同じく UTC 基準の YYYY-MM-DD で扱う）
  addDays(dateStr, n) {
    const dt = new Date(dateStr + "T00:00:00Z");
    dt.setUTCDate(dt.getUTCDate() + n);
    return dt.toISOString().slice(0, 10);
  },

  srsCard(fid) {
    return this.load().srs[fid] || null;
  },

  // 期日が来たカード（due<=today）と、まだ未学習の新規カード（日次上限まで）を返す
  srsDueDeck() {
    const d = this.load();
    const today = this.today();
    const due = [];
    const fresh = [];
    for (const f of FLASH) {
      const c = d.srs[f.id];
      if (!c) fresh.push(f);
      else if (c.due <= today) due.push(f);
    }
    // 期日カードはシャッフル（同じ順序での丸暗記を防ぐ）
    for (let i = due.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [due[i], due[j]] = [due[j], due[i]];
    }
    const introduced = d.srsDaily[today] || 0;
    const room = Math.max(0, this.SRS_NEW_PER_DAY - introduced);
    return { due, newCards: fresh.slice(0, room) };
  },

  srsCounts() {
    const d = this.load();
    const today = this.today();
    let due = 0;
    let fresh = 0;
    let learned = 0;
    for (const f of FLASH) {
      const c = d.srs[f.id];
      if (!c) {
        fresh++;
        continue;
      }
      learned++;
      if (c.due <= today) due++;
    }
    const introduced = d.srsDaily[today] || 0;
    const newAvail = Math.min(
      Math.max(0, this.SRS_NEW_PER_DAY - introduced),
      fresh,
    );
    return { due, fresh, learned, newAvail, total: FLASH.length };
  },

  // 直近で期日が来る日付（次の復習がいつかの表示用）
  srsNextDue() {
    const d = this.load();
    let min = null;
    for (const f of FLASH) {
      const c = d.srs[f.id];
      if (c && (!min || c.due < min)) min = c.due;
    }
    return min;
  },

  // SM-2で「もし quality で評価したら次回が何日後になるか」を保存せず試算（ボタン表示用）
  srsPreview(fid, quality) {
    const c = this.load().srs[fid] || { ef: 2.5, intv: 0, reps: 0 };
    if (quality < 3) return 1;
    if (c.reps === 0) return quality === 5 ? this.SRS_EASY_FIRST_INTV : 1;
    if (c.reps === 1) return 6;
    return Math.max(1, Math.round(c.intv * c.ef));
  },

  // SM-2でカードを更新。quality 0..5（3未満=失敗=ラプス→翌日に再出題）。
  // 戻り値は更新後の状態（呼び出し側で「次回○日後」を表示するのに使う）。
  srsReview(fid, quality) {
    const d = this.load();
    const today = this.today();
    let c = d.srs[fid];
    const isNew = !c;
    if (!c)
      c = { ef: 2.5, intv: 0, reps: 0, lapses: 0, due: today, last: null };

    if (quality < 3) {
      c.reps = 0;
      c.intv = 1; // 翌日に再出題して取りこぼしを回収
      c.lapses++;
    } else {
      if (c.reps === 0) c.intv = quality === 5 ? this.SRS_EASY_FIRST_INTV : 1;
      else if (c.reps === 1) c.intv = 6;
      else c.intv = Math.max(1, Math.round(c.intv * c.ef));
      c.reps++;
    }
    // 易しさ係数の更新（SM-2標準式）。質が低いほどefが下がり間隔が縮む。
    c.ef = c.ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (c.ef < this.SRS_MIN_EF) c.ef = this.SRS_MIN_EF;
    c.due = this.addDays(today, c.intv);
    c.last = today;
    d.srs[fid] = c;

    if (isNew) d.srsDaily[today] = (d.srsDaily[today] || 0) + 1;
    // 既存の一問一答統計にも反映（進捗ページ・弱点抽出との整合）。recordFlashがsave()まで行う。
    this.recordFlash(fid, quality >= 3);
    return c;
  },

  // ─────────── 自信度キャリブレーション（メタ認知） ───────────
  // 解答前に申告した自信（confident=true/false）と正誤(ok)を記録。
  // 「自信あり×不正解（過信）」は最優先の復習対象として保持する（Bjork: 較正の伸びしろ）。
  recordConfidence(kind, id, confident, ok) {
    const d = this.load();
    if (confident) ok ? d.calib.co++ : d.calib.cx++;
    else ok ? d.calib.uo++ : d.calib.ux++;
    const key = kind + ":" + id;
    if (confident && !ok) d.overconf[key] = true; // 過信を記録
    if (ok) delete d.overconf[key]; // 正解できたら過信リストから外す
    this.save();
  },

  calibStats() {
    return this.load().calib;
  },

  // 過信（自信あり×不正解）の項目を {kind, item} の配列に解決して返す
  overconfidentItems() {
    const d = this.load();
    const items = [];
    for (const key of Object.keys(d.overconf)) {
      const sep = key.indexOf(":");
      const kind = key.slice(0, sep);
      const id = key.slice(sep + 1);
      if (kind === "quiz") {
        const q = QUESTIONS.find((x) => x.id === id);
        if (q) items.push({ kind, item: q });
      } else if (kind === "flash") {
        const f = FLASH.find((x) => x.id === id);
        if (f) items.push({ kind, item: f });
      }
    }
    return items;
  },

  // ─────────── 間違いノート ───────────
  getMemo(kind, id) {
    return this.load().memos[kind + ":" + id] || "";
  },

  setMemo(kind, id, text) {
    const d = this.load();
    const key = kind + ":" + id;
    if (text && text.trim()) d.memos[key] = text;
    else delete d.memos[key];
    this.save();
  },

  // 弱点（不正解先行）・過信・SRSで苦戦中 を統合して {kind, item, reasons[], memo} で返す
  mistakeItems() {
    const map = new Map(); // key -> {kind, item, reasons:Set}
    const add = (kind, item, reason) => {
      const key = kind + ":" + item.id;
      if (!map.has(key)) map.set(key, { kind, item, reasons: new Set() });
      map.get(key).reasons.add(reason);
    };
    for (const q of this.weakQuestions()) add("quiz", q, "弱点");
    for (const f of this.weakFlash()) add("flash", f, "弱点");
    for (const o of this.overconfidentItems()) add(o.kind, o.item, "過信");
    const d = this.load();
    for (const f of FLASH) {
      const c = d.srs[f.id];
      if (c && c.lapses > 0) add("flash", f, "SRSで苦戦");
    }
    return [...map.values()].map((m) => ({
      kind: m.kind,
      item: m.item,
      reasons: [...m.reasons],
      memo: this.getMemo(m.kind, m.item.id),
    }));
  },

  // ─────────── データのバックアップ／復元 ───────────
  // 進捗本体(this.KEY)に加え、別キーで持つ設定も一緒に書き出す。
  PREF_KEYS: [
    "calcCoordMode",
    "mode_recall",
    "mode_explain",
    "mode_conf",
    "mode_tts",
    "onboarded",
  ],

  exportJSON() {
    const prefs = {};
    for (const k of this.PREF_KEYS) {
      const v = localStorage.getItem(k);
      if (v !== null) prefs[k] = v;
    }
    return JSON.stringify(
      {
        app: "chousashi-dojo",
        version: 1,
        exportedAt: new Date().toISOString(),
        data: this.load(),
        prefs,
      },
      null,
      2,
    );
  },

  // バックアップ文字列から復元（既存の進捗を上書き）。{ok, error} を返す。
  importJSON(str) {
    let obj;
    try {
      obj = JSON.parse(str);
    } catch (e) {
      return { ok: false, error: "JSONとして読み取れませんでした。" };
    }
    if (!obj || obj.app !== "chousashi-dojo" || typeof obj.data !== "object") {
      return {
        ok: false,
        error: "調査士道場のバックアップファイルではありません。",
      };
    }
    localStorage.setItem(this.KEY, JSON.stringify(obj.data));
    if (obj.prefs) {
      for (const k of this.PREF_KEYS) {
        if (k in obj.prefs) localStorage.setItem(k, obj.prefs[k]);
      }
    }
    this._cache = null; // 次の load() で復元データを読み直す
    return { ok: true };
  },
};
