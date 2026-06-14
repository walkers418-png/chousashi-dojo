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
};
