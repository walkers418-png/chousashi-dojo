// 調査士道場 メインアプリ
const view = document.getElementById("view");
const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function updateStreak() {
  document.getElementById("streakBadge").textContent = `🔥 ${Store.streak()}日`;
}

// ─────────── タブ切替 ───────────
document.querySelectorAll("#tabBar button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll("#tabBar button")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    render(btn.dataset.tab);
  });
});

function render(tab) {
  window.scrollTo(0, 0);
  if (tab === "today") renderToday();
  else if (tab === "lecture") renderLectureList();
  else if (tab === "quiz") renderQuizMenu();
  else if (tab === "calc") renderCalcMenu();
  else if (tab === "written") renderWrittenList();
  else if (tab === "progress") renderProgress();
  updateStreak();
}

function gotoTab(tab) {
  document
    .querySelectorAll("#tabBar button")
    .forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  render(tab);
}

// ─────────── 今日の学習 ───────────
function renderToday() {
  const phase = currentPhase();
  const dte = daysToExam();
  const today = Store.today();
  const checks = Store.taskChecks(today);
  const phaseIdx = SCHEDULE.phases.indexOf(phase);
  const pct = Math.round((phaseIdx / (SCHEDULE.phases.length - 1)) * 100);

  const upcoming = SCHEDULE.milestones
    .filter((m) => m.date >= today)
    .slice(0, 3)
    .map((m) => `<li><b>${m.date}</b> — ${m.label}</li>`)
    .join("");

  const tasks = phase.daily
    .map(
      (t, i) => `
    <div class="card clickable" style="display:flex;align-items:center;gap:12px;padding:13px 14px">
      <input type="checkbox" data-task="${i}" ${checks[i] ? "checked" : ""} style="width:22px;height:22px;accent-color:#0288d1">
      <div style="flex:1" data-goto="${t.tab}">${esc(t.task)}<div class="muted small">タップで${t.tab === "quiz" ? "択一" : t.tab === "calc" ? "計算道場" : t.tab === "written" ? "記述式" : "講義"}へ →</div></div>
    </div>`,
    )
    .join("");

  view.innerHTML = `
    <div class="card">
      <div class="kicker">本試験まで</div>
      <div style="font-size:34px;font-weight:800" class="mono">${dte}<span style="font-size:15px;font-weight:400"> 日</span></div>
      <div class="muted small">令和9年度 筆記試験（${SCHEDULE.examDate}・午前の部は測量士補で免除申請）</div>
      <div class="progressbar"><div style="width:${pct}%"></div></div>
      <div class="kicker" style="margin-top:8px">${esc(phase.name)}（${phase.from} 〜 ${phase.to}）</div>
      <p class="small">${esc(phase.goal)}</p>
    </div>
    <h2 style="font-size:15px;margin:14px 4px 8px">今日のメニュー</h2>
    ${tasks}
    <div class="card">
      <h2>直近の手続き・マイルストーン</h2>
      <ul class="small" style="margin-left:18px">${upcoming || "<li>なし</li>"}</ul>
    </div>`;

  view.querySelectorAll("input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", () => {
      Store.setTaskCheck(today, Number(cb.dataset.task), cb.checked);
      updateStreak();
    });
  });
  view.querySelectorAll("[data-goto]").forEach((el) => {
    el.addEventListener("click", () => gotoTab(el.dataset.goto));
  });
}

// ─────────── 講義 ───────────
// ─────────── 重要度★ ───────────
function impBadge(n) {
  n = Math.max(1, Math.min(5, n || 3));
  return `<span class="imp" title="重要度 ${n}/5">${"★".repeat(n)}<span class="imp-off">${"☆".repeat(5 - n)}</span></span>`;
}

// ─────────── 条文リンク（タップで全文ポップアップ） ───────────
const LAW_ALIAS = {
  民法: "民法",
  不動産登記法: "不登法",
  不登法: "不登法",
  不動産登記規則: "規則",
  規則: "規則",
  準則: "準則",
  登記準則: "準則",
  建物の区分所有等に関する法律: "区分所有法",
  区分所有法: "区分所有法",
  土地家屋調査士法: "調査士法",
  調査士法: "調査士法",
  借地借家法: "借地借家法",
};
const ARTICLE_RE =
  /(民法|不動産登記法|不登法|不動産登記規則|規則|登記準則|準則|建物の区分所有等に関する法律|区分所有法|土地家屋調査士法|調査士法|借地借家法)?\s*第?(\d+)条(?:の(\d+))?/g;

// 択一カテゴリ・講義カテゴリ → 既定の法令（接頭辞のない「○条」をどの法令と解釈するか）
function defLawForCat(cat) {
  if (cat === "民法") return "民法";
  if (cat === "調査士法") return "調査士法";
  if (
    ["総論", "土地", "建物", "区分建物", "筆界特定", "不登法総論"].includes(cat)
  )
    return "不登法";
  return null;
}

function artKey(prefix, num, sub, defLaw) {
  const code = prefix ? LAW_ALIAS[prefix] : defLaw;
  if (!code) return null;
  const key = code + num + (sub ? "の" + sub : "");
  return typeof ARTICLES !== "undefined" && ARTICLES[key] ? key : null;
}

// 要素内のテキストノードを走査し、辞書にある条文参照だけをタップ可能spanに変換
function linkArticlesInElement(root, defLaw) {
  if (!root || typeof ARTICLES === "undefined") return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const targets = [];
  let node;
  while ((node = walker.nextNode())) {
    if (node.parentElement && node.parentElement.closest(".artlink")) continue;
    if (ARTICLE_RE.test(node.nodeValue)) targets.push(node);
    ARTICLE_RE.lastIndex = 0;
  }
  for (const textNode of targets) {
    const text = textNode.nodeValue;
    const frag = document.createDocumentFragment();
    let last = 0;
    let m;
    ARTICLE_RE.lastIndex = 0;
    while ((m = ARTICLE_RE.exec(text))) {
      const key = artKey(m[1], m[2], m[3], defLaw);
      if (!key) continue;
      if (m.index > last)
        frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      const span = document.createElement("span");
      span.className = "artlink";
      span.dataset.art = key;
      span.textContent = m[0];
      frag.appendChild(span);
      last = m.index + m[0].length;
    }
    if (last > 0) {
      if (last < text.length)
        frag.appendChild(document.createTextNode(text.slice(last)));
      textNode.parentNode.replaceChild(frag, textNode);
    }
  }
}

function showArticlePopup(key) {
  const a = typeof ARTICLES !== "undefined" && ARTICLES[key];
  if (!a) return;
  let ov = document.getElementById("artOverlay");
  if (!ov) {
    ov = document.createElement("div");
    ov.id = "artOverlay";
    document.body.appendChild(ov);
    ov.addEventListener("click", (e) => {
      if (e.target === ov) ov.style.display = "none";
    });
  }
  ov.innerHTML = `<div class="art-pop">
      <div class="art-head"><b>${esc(a.law)}　${esc(a.no)}</b><button class="art-close" aria-label="閉じる">×</button></div>
      <div class="art-pop-title">${esc(a.title)}</div>
      <div class="art-pop-text">${esc(a.text).replace(/\n/g, "<br>")}</div>
    </div>`;
  ov.style.display = "flex";
  ov.querySelector(".art-close").addEventListener(
    "click",
    () => (ov.style.display = "none"),
  );
}

// 条文リンクのタップを一括処理（動的生成のため委譲）
document.addEventListener("click", (e) => {
  const a = e.target.closest && e.target.closest(".artlink");
  if (a) showArticlePopup(a.dataset.art);
});

// ─────────── パターン図解（動く図解） ───────────
function renderPatternList() {
  view.innerHTML =
    `<button class="back" id="backBtn">← 講義一覧へ</button>
    <h2 style="font-size:15px;margin:4px">パターン図解（動く図解）</h2>
    <p class="muted small" style="margin:0 4px 10px">答えがパターンで分かれる論点を、順番に動く図で確認。勘違いしやすい型は最後に大きな <span style="color:var(--ng);font-weight:700">✕</span> で警告。</p>` +
    PATTERNS.map(
      (
        p,
      ) => `<div class="card clickable" data-pat="${p.id}" style="padding:13px 14px">
        <span class="tag">${esc(p.tag)}</span>
        <div style="margin-top:4px"><b>${esc(p.title)}</b></div>
        <div class="muted small">${esc(p.short || "")}</div>
      </div>`,
    ).join("");
  document
    .getElementById("backBtn")
    .addEventListener("click", renderLectureList);
  view
    .querySelectorAll("[data-pat]")
    .forEach((el) =>
      el.addEventListener("click", () => renderPattern(el.dataset.pat)),
    );
}

function renderPattern(id) {
  const p = PATTERNS.find((x) => x.id === id);
  if (!p) return renderPatternList();
  const maxStep = p.steps.length - 1;
  let step = 0;
  let timer = null;
  Store.touchToday();
  updateStreak();
  view.innerHTML = `
    <button class="back" id="backBtn">← パターン図解一覧</button>
    <div class="card">
      <span class="tag">${esc(p.tag)}</span>
      <h2 style="margin-top:6px">${esc(p.title)}</h2>
      <div class="lecture-body">${p.intro}</div>
      <div class="pat-stage">${p.scene}</div>
      <div class="pat-progress"><div id="patBar"></div></div>
      <div class="pat-narr" id="patNarr"></div>
      <div class="btn-row">
        <button class="btn secondary" id="patPrev">◀ 戻る</button>
        <button class="btn" id="patNext">次へ ▶</button>
      </div>
      <button class="btn ghost" id="patAuto">▶ 自動再生</button>
    </div>`;
  const svg = view.querySelector(".pat-stage svg");
  const narr = document.getElementById("patNarr");
  const bar = document.getElementById("patBar");
  const autoBtn = document.getElementById("patAuto");
  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
      autoBtn.textContent = "▶ 自動再生";
    }
  }
  function draw() {
    svg.querySelectorAll("[data-from]").forEach((el) => {
      const from = +el.dataset.from;
      const until = el.dataset.until !== undefined ? +el.dataset.until : 99;
      el.style.transition = "opacity .45s";
      el.style.opacity = step >= from && step <= until ? "1" : "0";
    });
    narr.innerHTML = `<span class="pat-step">手順 ${step + 1} / ${maxStep + 1}</span>${esc(p.steps[step])}`;
    bar.style.width = (step / maxStep) * 100 + "%";
    document.getElementById("patPrev").disabled = step === 0;
    document.getElementById("patNext").disabled = step === maxStep;
  }
  document.getElementById("patNext").addEventListener("click", () => {
    stop();
    if (step < maxStep) step++;
    draw();
  });
  document.getElementById("patPrev").addEventListener("click", () => {
    stop();
    if (step > 0) step--;
    draw();
  });
  autoBtn.addEventListener("click", () => {
    if (timer) return stop();
    if (step === maxStep) step = 0;
    autoBtn.textContent = "⏸ 停止";
    draw();
    timer = setInterval(() => {
      if (step >= maxStep) return stop();
      step++;
      draw();
    }, 2400);
  });
  document.getElementById("backBtn").addEventListener("click", () => {
    stop();
    renderPatternList();
  });
  draw();
}

function renderLectureList() {
  const cats = [...new Set(LECTURES.map((l) => l.cat))];
  view.innerHTML =
    `<h2 style="font-size:15px;margin:4px">講義ノート（全${LECTURES.length}ユニット）</h2>
    <p class="muted small" style="margin:0 4px 12px">${impBadge(5)} は重要度（過去問ウェイト・★5が最優先）。本文中の<span class="artlink">青い条文</span>をタップすると全文が吹き出しで出ます。</p>
    <div class="card clickable" data-patopen="1" style="border:1px solid var(--accent-deep)">
      <b style="color:var(--accent)">🎬 パターン図解（動く図解）</b>
      <div class="muted small">取消し/解除/時効と登記・94条2項… 答えが分かれる論点をアニメで。勘違い型は大きな✕で警告</div>
    </div>` +
    cats
      .map((cat) => {
        const items = LECTURES.filter((l) => l.cat === cat)
          .map(
            (l) =>
              `<div class="card clickable" data-lec="${l.id}" style="padding:13px 14px">
          <span class="tag">${esc(l.cat)}</span>${impBadge(LECTURE_IMP[l.id])}
          <div style="margin-top:5px">${esc(l.title)}</div>
        </div>`,
          )
          .join("");
        return items;
      })
      .join("");
  view
    .querySelector("[data-patopen]")
    .addEventListener("click", renderPatternList);
  view
    .querySelectorAll("[data-lec]")
    .forEach((el) =>
      el.addEventListener("click", () => renderLecture(el.dataset.lec)),
    );
}

function renderLecture(id) {
  const l = LECTURES.find((x) => x.id === id);
  Store.touchToday();
  updateStreak();
  view.innerHTML = `
    <button class="back" id="backBtn">← 講義一覧へ</button>
    <div class="card">
      <span class="tag">${esc(l.cat)}</span>${impBadge(LECTURE_IMP[l.id])}
      <h2 style="margin-top:6px">${esc(l.title)}</h2>
      <div class="lecture-body">${l.body}</div>
      <button class="btn secondary" id="toQuiz">この分野の択一を解く →</button>
    </div>`;
  linkArticlesInElement(
    view.querySelector(".lecture-body"),
    defLawForCat(l.cat),
  );
  document
    .getElementById("backBtn")
    .addEventListener("click", renderLectureList);
  document
    .getElementById("toQuiz")
    .addEventListener("click", () => gotoTab("quiz"));
}

// ─────────── 択一演習 ───────────
let quizState = null;

function renderQuizMenu() {
  quizState = null;
  const stats = Store.catStats();
  const catBtns = QUIZ_CATS.map((c) => {
    const s = stats[c] || { ok: 0, ng: 0, total: 0 };
    const tot = s.ok + s.ng;
    const rate = tot ? Math.round((s.ok / tot) * 100) + "%" : "—";
    return `<div class="card clickable" data-cat="${c}" style="display:flex;justify-content:space-between;align-items:center;padding:13px 14px">
      <div>${esc(c)} <span class="muted small">(${s.total}問収録)</span><div style="margin-top:3px">${impBadge(CAT_IMP[c])}</div></div>
      <span class="tag ${tot && s.ok / tot >= 0.7 ? "ok" : tot ? "warn" : ""}">${rate}</span>
    </div>`;
  }).join("");
  const weak = Store.weakQuestions();
  const weakF = Store.weakFlash();
  view.innerHTML = `
    <div class="card">
      <h2>本試験形式 模試</h2>
      <p class="small muted">全分野から20問・50分計測（本試験の択一と同形式・全${QUESTIONS.length}問収録）</p>
      <button class="btn" id="mockBtn">20問模試を開始する</button>
      ${weak.length ? `<button class="btn secondary" id="weakBtn">択一の弱点復習（${weak.length}問）</button>` : ""}
    </div>
    <div class="card">
      <h2>一問一答（○×スピード演習）</h2>
      <p class="small muted">スキマ時間用。知識の穴を高速で潰す（全${FLASH.length}問収録）</p>
      <select id="flashCat">
        <option value="">全分野ミックス</option>
        ${FLASH_CATS.map((c) => `<option value="${c}">${esc(c)}</option>`).join("")}
      </select>
      <button class="btn" id="flashBtn">20問スタート</button>
      ${weakF.length ? `<button class="btn secondary" id="flashWeakBtn">一問一答の弱点復習（${weakF.length}問）</button>` : ""}
    </div>
    <h2 style="font-size:15px;margin:14px 4px 8px">択一・分野別演習</h2>
    ${catBtns}`;
  document
    .getElementById("mockBtn")
    .addEventListener("click", () => startQuiz(pickQuestions(null, 20), true));
  const wb = document.getElementById("weakBtn");
  if (wb)
    wb.addEventListener("click", () => startQuiz(weak.slice(0, 20), false));
  document.getElementById("flashBtn").addEventListener("click", () => {
    const cat = document.getElementById("flashCat").value || null;
    startFlash(pickFlash(cat, 20));
  });
  const fwb = document.getElementById("flashWeakBtn");
  if (fwb) fwb.addEventListener("click", () => startFlash(weakF.slice(0, 20)));
  view
    .querySelectorAll("[data-cat]")
    .forEach((el) =>
      el.addEventListener("click", () =>
        startQuiz(pickQuestions(el.dataset.cat, 10), false),
      ),
    );
}

function pickQuestions(cat, n) {
  const pool = cat ? QUESTIONS.filter((q) => q.cat === cat) : [...QUESTIONS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

// ─────────── 一問一答（○×） ───────────
let flashState = null;

function pickFlash(cat, n) {
  const pool = cat ? FLASH.filter((f) => f.cat === cat) : [...FLASH];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

function startFlash(items) {
  if (!items.length) return;
  flashState = { fs: items, idx: 0, ok: 0 };
  renderFlashQuestion();
}

function renderFlashQuestion() {
  const st = flashState;
  const f = st.fs[st.idx];
  view.innerHTML = `
    <div class="card">
      <div class="qhead"><span>一問一答 ${st.idx + 1} / ${st.fs.length}</span><span class="tag">${esc(f.cat)}</span></div>
      <p class="statement" style="min-height:72px"><b>${esc(f.s)}</b></p>
      <div class="btn-row" id="oxRow">
        <button class="btn" id="oxO" style="font-size:24px;background:var(--surface2);border:1px solid var(--border);color:var(--ok)">○</button>
        <button class="btn" id="oxX" style="font-size:24px;background:var(--surface2);border:1px solid var(--border);color:var(--ng)">×</button>
      </div>
      <div id="explBox"></div>
      <button class="btn" id="nextBtn" style="display:none">次へ →</button>
    </div>
    <p class="muted small" style="text-align:center">正答: ${st.ok} / ${st.idx}</p>`;
  const answer = (userSaysTrue) => {
    const ok = userSaysTrue === f.a;
    if (ok) st.ok++;
    Store.recordFlash(f.id, ok);
    updateStreak();
    document.getElementById("oxO").disabled = true;
    document.getElementById("oxX").disabled = true;
    document.getElementById(f.a ? "oxO" : "oxX").style.borderColor =
      "var(--ok)";
    document.getElementById("explBox").innerHTML =
      `<div class="expl"><b>${ok ? "正解！" : "不正解"}</b> 答えは <b>${f.a ? "○" : "×"}</b><br>${f.expl}</div>`;
    linkArticlesInElement(
      document.getElementById("explBox"),
      defLawForCat(f.cat),
    );
    document.getElementById("nextBtn").style.display = "block";
  };
  document.getElementById("oxO").addEventListener("click", () => answer(true));
  document.getElementById("oxX").addEventListener("click", () => answer(false));
  document.getElementById("nextBtn").addEventListener("click", () => {
    st.idx++;
    if (st.idx >= st.fs.length) renderFlashResult();
    else renderFlashQuestion();
  });
}

function renderFlashResult() {
  const st = flashState;
  flashState = null;
  const n = st.fs.length;
  const rate = Math.round((st.ok / n) * 100);
  view.innerHTML = `
    <div class="card" style="text-align:center">
      <div class="kicker">一問一答 結果</div>
      <div style="font-size:40px;font-weight:800">${st.ok} <span style="font-size:16px;font-weight:400">/ ${n}問</span></div>
      <p>正答率 ${rate}%${rate >= 90 ? " — 仕上がってきた 🎉" : rate >= 70 ? " — もう一周で定着" : " — 講義に戻って基礎から"}</p>
      <button class="btn" id="againBtn">もう20問</button>
      <button class="btn secondary" id="menuBtn">メニューへ戻る</button>
    </div>`;
  document
    .getElementById("againBtn")
    .addEventListener("click", () => startFlash(pickFlash(null, 20)));
  document.getElementById("menuBtn").addEventListener("click", renderQuizMenu);
}

function startQuiz(questions, timed) {
  if (!questions.length) return;
  quizState = {
    qs: questions,
    idx: 0,
    ok: 0,
    answers: [],
    timed,
    start: Date.now(),
    limit: 50 * 60,
  };
  renderQuizQuestion();
  if (timed) tickTimer();
}

function tickTimer() {
  if (!quizState || !quizState.timed) return;
  const el = document.getElementById("quizTimer");
  if (el) {
    const remain =
      quizState.limit - Math.floor((Date.now() - quizState.start) / 1000);
    if (remain <= 0) {
      renderQuizResult();
      return;
    }
    const mm = String(Math.floor(remain / 60)).padStart(2, "0");
    const ss = String(remain % 60).padStart(2, "0");
    el.textContent = `⏱ ${mm}:${ss}`;
  }
  setTimeout(tickTimer, 1000);
}

function renderQuizQuestion() {
  const st = quizState;
  const q = st.qs[st.idx];
  const nums = ["1", "2", "3", "4", "5"];
  view.innerHTML = `
    ${st.timed ? '<div class="timer" id="quizTimer">⏱ 50:00</div>' : ""}
    <div class="card">
      <div class="qhead"><span>第${st.idx + 1}問 / ${st.qs.length}問</span><span class="tag">${esc(q.cat)}</span></div>
      <p class="statement"><b>${esc(q.q)}</b></p>
      <div id="choices">
        ${q.choices.map((c, i) => `<button class="choice" data-i="${i}"><span class="cnum">${nums[i]}</span>${esc(c)}</button>`).join("")}
      </div>
      <div id="explBox"></div>
      <button class="btn" id="nextBtn" style="display:none">次へ →</button>
    </div>`;
  view.querySelectorAll(".choice").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.i);
      const ok = i === q.answer;
      if (ok) st.ok++;
      st.answers.push({ id: q.id, ok });
      Store.recordQuiz(q.id, ok);
      view.querySelectorAll(".choice").forEach((b, bi) => {
        b.disabled = true;
        if (bi === q.answer) b.classList.add("correct");
        else if (bi === i && !ok) b.classList.add("wrong");
      });
      document.getElementById("explBox").innerHTML =
        `<div class="expl"><b>${ok ? "正解！" : "不正解"}</b> 正答は ${q.answer + 1}。<br>${q.expl}</div>`;
      linkArticlesInElement(
        document.getElementById("explBox"),
        defLawForCat(q.cat),
      );
      document.getElementById("nextBtn").style.display = "block";
      updateStreak();
    });
  });
  document.getElementById("nextBtn").addEventListener("click", () => {
    st.idx++;
    if (st.idx >= st.qs.length) renderQuizResult();
    else renderQuizQuestion();
  });
}

function renderQuizResult() {
  const st = quizState;
  quizState = null;
  const n = st.answers.length;
  const rate = n ? Math.round((st.ok / n) * 100) : 0;
  const pts = (st.ok * 2.5).toFixed(1);
  const passed =
    st.timed && n === 20
      ? st.ok * 2.5 >= 32.5
        ? "基準点クリア圏内 🎉"
        : "基準点（目安32.5点）まであと一歩"
      : "";
  view.innerHTML = `
    <div class="card" style="text-align:center">
      <div class="kicker">結果</div>
      <div style="font-size:40px;font-weight:800">${st.ok} <span style="font-size:16px;font-weight:400">/ ${n}問</span></div>
      <p>正答率 ${rate}%${st.timed && n === 20 ? `（${pts}点換算）` : ""}</p>
      ${passed ? `<p class="small" style="color:var(--warn)">${passed}</p>` : ""}
      <button class="btn" id="againBtn">もう一度</button>
      <button class="btn secondary" id="menuBtn">メニューへ戻る</button>
    </div>`;
  document.getElementById("againBtn").addEventListener("click", renderQuizMenu);
  document.getElementById("menuBtn").addEventListener("click", renderQuizMenu);
}

// ─────────── 計算道場 ───────────
function renderCalcMenu() {
  const d = Store.load();
  view.innerHTML =
    `<h2 style="font-size:15px;margin:4px">計算道場（無限自動生成）</h2>
    <p class="muted small" style="margin:0 4px 10px">毎日30分。問題は無限に自動生成される。関数電卓の <b>Pol/Rec</b>（または複素数モード）を使って解くこと（→ガイド「関数電卓の必須機能」）。</p>
    <div class="card clickable" data-guide-open="1" style="border:1px solid var(--accent-deep)">
      <b style="color:var(--accent)">📚 計算手法ガイド</b>
      <div class="muted small">各計算を「複素数／関数電卓／手計算」の3通りで詳解（公式・図解つき）</div>
    </div>
    <div class="card" style="padding:11px 14px">
      <div class="muted small" style="margin-bottom:7px">座標系（小数第3位・mm表示）</div>
      <div class="btn-row">
        <button class="btn ${CalcUtil.coordMode === "local" ? "" : "ghost"}" data-coord="local" style="margin-top:0">任意座標</button>
        <button class="btn ${CalcUtil.coordMode === "jgd" ? "" : "ghost"}" data-coord="jgd" style="margin-top:0">世界測地系</button>
      </div>
      <div class="muted small" style="margin-top:6px">${CalcUtil.coordMode === "jgd" ? "平面直角座標系（原点から±数千〜数万m・符号つき）で出題中" : "扱いやすい任意座標（100前後）で出題中"}</div>
    </div>` +
    (typeof CALC_GROUPS !== "undefined"
      ? CALC_GROUPS
      : [{ label: "", types: CALC_TYPES }]
    )
      .map((grp) => {
        const head = grp.label
          ? `<h3 style="margin:16px 4px 6px;font-size:12.5px;color:var(--muted);letter-spacing:.04em">${esc(grp.label)}</h3>`
          : "";
        return (
          head +
          grp.types
            .map((t) => {
              const g = CalcGen[t];
              const s = d.calc[t] || { ok: 0, ng: 0 };
              return `<div class="card clickable" data-calc="${t}" style="padding:13px 14px">
        <b>${esc(g.name)}</b>
        <div class="muted small">${esc(g.desc)}</div>
        <div class="small" style="margin-top:4px"><span class="tag ok">正解 ${s.ok}</span><span class="tag ng">不正解 ${s.ng}</span></div>
      </div>`;
            })
            .join("")
        );
      })
      .join("");
  view
    .querySelector("[data-guide-open]")
    .addEventListener("click", renderCalcGuideList);
  view.querySelectorAll("[data-coord]").forEach((el) =>
    el.addEventListener("click", () => {
      CalcUtil.coordMode = el.dataset.coord;
      localStorage.setItem("calcCoordMode", CalcUtil.coordMode);
      renderCalcMenu();
    }),
  );
  view
    .querySelectorAll("[data-calc]")
    .forEach((el) =>
      el.addEventListener("click", () => renderCalcProblem(el.dataset.calc)),
    );
}

// ─────────── 計算手法ガイド ───────────
function renderCalcGuideList() {
  view.innerHTML =
    `<button class="back" id="backBtn">← 計算道場メニュー</button>
    <h2 style="font-size:15px;margin:4px">計算手法ガイド</h2>
    <p class="muted small" style="margin:0 4px 10px">各テーマを「複素数モード／関数電卓（複素数なし）／手計算」の3通りで、途中式を省略せず図解。公式も併記。</p>` +
    CALC_GUIDE.map(
      (
        g,
      ) => `<div class="card clickable" data-guide="${g.id}" style="padding:13px 14px">
        <span class="tag">${esc(g.tag)}</span>
        <div style="margin-top:4px"><b>${esc(g.name)}</b></div>
        <div class="muted small">${esc(g.short || "")}</div>
      </div>`,
    ).join("");
  document.getElementById("backBtn").addEventListener("click", renderCalcMenu);
  view
    .querySelectorAll("[data-guide]")
    .forEach((el) =>
      el.addEventListener("click", () => renderCalcGuide(el.dataset.guide)),
    );
}

function renderCalcGuide(id) {
  const g = CALC_GUIDE.find((x) => x.id === id);
  if (!g) return renderCalcGuideList();
  const casesHtml = g.cases
    .map(
      (c) => `
      <h3>${esc(c.title)}</h3>
      <div class="lecture-body">${c.setup}</div>
      ${c.methods
        .map(
          (m) =>
            `<div class="method ${m.cls}"><h4 class="mh">${esc(m.name)}</h4><div class="lecture-body">${m.body}</div></div>`,
        )
        .join("")}`,
    )
    .join('<hr class="sep">');
  view.innerHTML = `
    <button class="back" id="backBtn">← 計算手法ガイド一覧</button>
    <div class="card">
      <span class="tag">${esc(g.tag)}</span>
      <h2>${esc(g.name)}</h2>
      <div class="lecture-body">${g.intro}</div>
      ${g.figure ? `<canvas class="fig" id="figCanvas" width="640" height="480"></canvas><p class="muted small" style="text-align:center;margin-top:-4px">${esc(g.figCaption || "")}</p>` : ""}
      <div class="formula">${g.formula}</div>
      ${casesHtml}
    </div>`;
  document
    .getElementById("backBtn")
    .addEventListener("click", renderCalcGuideList);
  view
    .querySelectorAll(".lecture-body, .formula")
    .forEach((el) => linkArticlesInElement(el, null));
  if (g.figure) drawFigure(g.figure, true);
}

function renderCalcProblem(type) {
  const gen = CalcGen[type];
  const prob = gen.gen();
  const fieldsHtml = prob.fields
    .map((f, i) => {
      if (f.kind === "dms") {
        return `<label class="fld">${esc(f.label)}（度・分・秒）</label>
        <div style="display:flex;gap:6px">
          <input type="number" id="f${i}d" placeholder="度" inputmode="numeric">
          <input type="number" id="f${i}m" placeholder="分" inputmode="numeric">
          <input type="number" id="f${i}s" placeholder="秒" inputmode="numeric">
        </div>`;
      }
      return `<label class="fld">${esc(f.label)}</label><input type="number" step="0.01" id="f${i}" inputmode="decimal">`;
    })
    .join("");

  view.innerHTML = `
    <button class="back" id="backBtn">← 計算道場メニュー</button>
    <div class="card">
      <h2>${esc(gen.name)}</h2>
      ${prob.html}
      ${fieldsHtml}
      <button class="btn" id="checkBtn">答え合わせ</button>
      <div id="resultBox"></div>
      <div class="btn-row">
        <button class="btn secondary" id="nextProb">次の問題</button>
      </div>
    </div>`;
  document.getElementById("backBtn").addEventListener("click", renderCalcMenu);
  document
    .getElementById("nextProb")
    .addEventListener("click", () => renderCalcProblem(type));
  document.getElementById("checkBtn").addEventListener("click", () => {
    let allOk = true;
    prob.fields.forEach((f, i) => {
      let ok;
      if (f.kind === "dms") {
        const dv = Number(document.getElementById(`f${i}d`).value);
        const mv = Number(document.getElementById(`f${i}m`).value);
        const sv = Number(document.getElementById(`f${i}s`).value);
        const userSec = dv * 3600 + mv * 60 + sv;
        const ansSec = f.answer.d * 3600 + f.answer.m * 60 + f.answer.s;
        let diff = Math.abs(userSec - ansSec);
        diff = Math.min(diff, 360 * 3600 - diff);
        ok = diff <= f.tolSec;
        ["d", "m", "s"].forEach((k) => {
          const el = document.getElementById(`f${i}${k}`);
          el.classList.remove("fld-ok", "fld-ng");
          el.classList.add(ok ? "fld-ok" : "fld-ng");
        });
      } else {
        const v = Number(document.getElementById(`f${i}`).value);
        ok =
          document.getElementById(`f${i}`).value !== "" &&
          Math.abs(v - f.answer) <= f.tol;
        const el = document.getElementById(`f${i}`);
        el.classList.remove("fld-ok", "fld-ng");
        el.classList.add(ok ? "fld-ok" : "fld-ng");
      }
      if (!ok) allOk = false;
    });
    Store.recordCalc(type, allOk);
    updateStreak();
    const ansList = prob.fields
      .map(
        (f) =>
          `<li>${esc(f.label)}: <b>${f.kind === "dms" ? CalcUtil.dmsStr(f.answer) : f.answer}</b></li>`,
      )
      .join("");
    document.getElementById("resultBox").innerHTML = `
      <div class="expl">
        <b>${allOk ? "✅ 全問正解！" : "❌ 不正解あり"}</b>
        <ul style="margin:6px 0 10px 18px">${ansList}</ul>
        <b>解法</b>${prob.solution}
      </div>`;
  });
}

// ─────────── 記述式 ───────────
function renderWrittenList() {
  const d = Store.load();
  view.innerHTML =
    `<h2 style="font-size:15px;margin:4px">記述式（書式）実践問題</h2>
    <p class="muted small" style="margin:0 4px 10px">紙と電卓と三角定規を用意して、実際に作図・申請書を書いてから答え合わせすること。</p>` +
    WRITTEN.map((w) => {
      const r = d.written[w.id];
      return `<div class="card clickable" data-w="${w.id}" style="padding:13px 14px">
        <span class="tag">${esc(w.type)}</span><span class="muted small">${esc(w.target)}</span>
        <div style="margin-top:4px"><b>${esc(w.title)}</b></div>
        ${r ? `<span class="tag ${r.score / r.total >= 0.8 ? "ok" : "warn"}">前回 ${r.score}/${r.total}</span>` : ""}
      </div>`;
    }).join("");
  view
    .querySelectorAll("[data-w]")
    .forEach((el) =>
      el.addEventListener("click", () => renderWritten(el.dataset.w)),
    );
}

function renderWritten(id) {
  const w = WRITTEN.find((x) => x.id === id);
  const coordsTable = w.coords.length
    ? `
    <table class="simple"><tr><th>点</th><th>X座標(m)</th><th>Y座標(m)</th><th>備考</th></tr>
    ${w.coords.map((c) => `<tr><td>${c.name}</td><td class="num">${c.x.toFixed(2)}</td><td class="num">${c.y.toFixed(2)}</td><td>${esc(c.note || "")}</td></tr>`).join("")}
    </table>`
    : "";

  const tasksHtml = w.tasks
    .map(
      (t, i) => `
    <div style="margin-top:14px">
      <b>問${i + 1}</b> ${esc(t.q)}
      <div style="display:flex;gap:8px;align-items:center">
        <input type="number" step="0.01" id="wt${i}" inputmode="decimal" style="flex:1">
        <span class="muted">${esc(t.unit || "")}</span>
      </div>
      <div id="wtExpl${i}"></div>
    </div>`,
    )
    .join("");

  const formHtml = w.appForm
    .map(
      (f, i) => `
    <label class="fld">${esc(f.label)} <span class="muted">${f.hint ? "（" + esc(f.hint) + "）" : ""}</span></label>
    <input type="text" id="wf${i}" autocomplete="off">
    <div id="wfExpl${i}"></div>`,
    )
    .join("");

  view.innerHTML = `
    <button class="back" id="backBtn">← 記述式一覧</button>
    <div class="card">
      <span class="tag">${esc(w.type)}</span><span class="muted small">${esc(w.target)}</span>
      <h2 style="margin-top:6px">${esc(w.title)}</h2>
      ${w.statement}
      ${coordsTable}
      <canvas class="fig" id="figCanvas" width="640" height="480"></canvas>
      <p class="muted small">▲ 問題図（解答前は交点等は非表示）。作図は必ず紙でも行うこと。</p>
      <hr class="sep">
      <h3>計算問題</h3>
      ${tasksHtml}
      <hr class="sep">
      <h3>登記申請書（穴埋め）</h3>
      ${formHtml}
      <button class="btn" id="gradeBtn">採点する</button>
      <div id="wResult"></div>
    </div>`;

  drawFigure(w.figure, false);
  document
    .getElementById("backBtn")
    .addEventListener("click", renderWrittenList);
  document.getElementById("gradeBtn").addEventListener("click", () => {
    let score = 0;
    const total = w.tasks.length + w.appForm.length;
    w.tasks.forEach((t, i) => {
      const el = document.getElementById(`wt${i}`);
      const v = Number(el.value);
      const ok = el.value !== "" && Math.abs(v - t.answer) <= t.tol;
      if (ok) score++;
      el.classList.remove("fld-ok", "fld-ng");
      el.classList.add(ok ? "fld-ok" : "fld-ng");
      document.getElementById(`wtExpl${i}`).innerHTML =
        `<div class="expl">${ok ? "✅ 正解" : "❌ 正答: <b>" + t.answer + (t.unit || "") + "</b>"}<br>${t.expl}</div>`;
    });
    const norm = (s) =>
      String(s)
        .replace(/[\s,，、。･・]/g, "")
        .replace(/[０-９Ａ-Ｚａ-ｚ]/g, (ch) =>
          String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
        )
        .toLowerCase();
    w.appForm.forEach((f, i) => {
      const el = document.getElementById(`wf${i}`);
      const ok = norm(el.value) === norm(f.answer);
      if (ok) score++;
      el.classList.remove("fld-ok", "fld-ng");
      el.classList.add(ok ? "fld-ok" : "fld-ng");
      document.getElementById(`wfExpl${i}`).innerHTML = ok
        ? ""
        : `<div class="expl">正答: <b>${esc(f.answer)}</b></div>`;
    });
    Store.recordWritten(w.id, score, total);
    updateStreak();
    drawFigure(w.figure, true);
    document.getElementById("wResult").innerHTML = `
      <div class="card" style="margin-top:12px;text-align:center;background:var(--surface2)">
        <div style="font-size:28px;font-weight:800">${score} / ${total}</div>
        <p class="muted small">図に解答（分筆線・交点）を表示しました。自分の作図と見比べること。</p>
      </div>`;
  });
}

// 作図レンダラー（X=北を上、Y=東を右に描画）
function drawFigure(fig, reveal) {
  const canvas = document.getElementById("figCanvas");
  if (!canvas || !fig) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const pts = fig.points;
  const names = Object.keys(pts);
  const xs = names.map((n) => pts[n][0]),
    ys = names.map((n) => pts[n][1]);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs);
  const minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const pad = 50;
  const sx = (canvas.width - pad * 2) / Math.max(maxY - minY, 1);
  const sy = (canvas.height - pad * 2) / Math.max(maxX - minX, 1);
  const s = Math.min(sx, sy);
  const px = (n) => pad + (pts[n][1] - minY) * s;
  const py = (n) => pad + (maxX - pts[n][0]) * s;

  // グリッド
  ctx.strokeStyle = "#e3e8ee";
  ctx.lineWidth = 1;
  for (let gx = Math.ceil(minY / 5) * 5; gx <= maxY; gx += 5) {
    ctx.beginPath();
    ctx.moveTo(pad + (gx - minY) * s, pad - 20);
    ctx.lineTo(pad + (gx - minY) * s, canvas.height - pad + 20);
    ctx.stroke();
  }
  for (let gy = Math.ceil(minX / 5) * 5; gy <= maxX; gy += 5) {
    ctx.beginPath();
    ctx.moveTo(pad - 20, pad + (maxX - gy) * s);
    ctx.lineTo(canvas.width - pad + 20, pad + (maxX - gy) * s);
    ctx.stroke();
  }

  // 北矢印
  ctx.fillStyle = "#555";
  ctx.font = "14px sans-serif";
  ctx.fillText("N ↑", 12, 22);

  // 筆界（ポリゴン）
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 2.5;
  for (const poly of fig.polys) {
    ctx.beginPath();
    poly.forEach((n, i) =>
      i === 0 ? ctx.moveTo(px(n), py(n)) : ctx.lineTo(px(n), py(n)),
    );
    ctx.closePath();
    ctx.stroke();
  }

  // 穴（吹抜け等）
  if (fig.holes) {
    for (const h of fig.holes) {
      ctx.strokeStyle = "#888";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      h.poly.forEach((p, i) => {
        const X = pad + (p[1] - minY) * s,
          Y = pad + (maxX - p[0]) * s;
        i === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y);
      });
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
      const c = h.poly[0];
      ctx.fillStyle = "#888";
      ctx.fillText(
        h.label,
        pad + (c[1] - minY) * s + 4,
        pad + (maxX - c[0]) * s - 6,
      );
    }
  }

  // 補助線（分筆線等）— revealがtrueのときのみ
  if (reveal) {
    ctx.strokeStyle = "#d32f2f";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 5]);
    for (const ln of fig.lines) {
      ctx.beginPath();
      ctx.moveTo(px(ln[0]), py(ln[0]));
      ctx.lineTo(px(ln[1]), py(ln[1]));
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.fillStyle = "#d32f2f";
    ctx.font = "13px sans-serif";
    for (const al of fig.areaLabels || []) {
      ctx.fillText(
        al.text,
        pad + (al.at[1] - minY) * s - 30,
        pad + (maxX - al.at[0]) * s,
      );
    }
  }

  // 点
  for (const n of names) {
    const hidden = !reveal && (fig.revealPoints || []).includes(n);
    if (hidden) continue;
    const isAnswer = (fig.revealPoints || []).includes(n);
    ctx.fillStyle = isAnswer ? "#d32f2f" : "#1565c0";
    ctx.beginPath();
    ctx.arc(px(n), py(n), 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "bold 14px sans-serif";
    ctx.fillText(n, px(n) + 7, py(n) - 7);
  }
}

// ─────────── 進捗 ───────────
function renderProgress() {
  const d = Store.load();
  const stats = Store.catStats();
  let totalOk = 0,
    totalNg = 0;
  const rows = QUIZ_CATS.map((c) => {
    const s = stats[c] || { ok: 0, ng: 0, total: 0 };
    totalOk += s.ok;
    totalNg += s.ng;
    const tot = s.ok + s.ng;
    const rate = tot ? Math.round((s.ok / tot) * 100) : 0;
    return `<tr><td>${esc(c)}</td><td class="num">${tot}</td><td class="num">${rate}%</td>
      <td><div class="progressbar" style="margin:0"><div style="width:${rate}%"></div></div></td></tr>`;
  }).join("");
  const calcRows = CALC_TYPES.map((t) => {
    const s = d.calc[t] || { ok: 0, ng: 0 };
    const tot = s.ok + s.ng;
    return `<tr><td>${esc(CalcGen[t].name)}</td><td class="num">${tot}</td><td class="num">${tot ? Math.round((s.ok / tot) * 100) + "%" : "—"}</td></tr>`;
  }).join("");
  const fstats = Store.flashCatStats();
  let fOk = 0,
    fNg = 0;
  const flashRows = FLASH_CATS.map((c) => {
    const s = fstats[c] || { ok: 0, ng: 0, total: 0 };
    fOk += s.ok;
    fNg += s.ng;
    const tot = s.ok + s.ng;
    const rate = tot ? Math.round((s.ok / tot) * 100) : 0;
    return `<tr><td>${esc(c)}</td><td class="num">${tot}</td><td class="num">${tot ? rate + "%" : "—"}</td>
      <td><div class="progressbar" style="margin:0"><div style="width:${rate}%"></div></div></td></tr>`;
  }).join("");
  const weak = Store.weakQuestions();
  const weakF = Store.weakFlash();
  view.innerHTML = `
    <div class="statgrid">
      <div class="stat"><div class="v">${Store.streak()}</div><div class="l">連続学習日数</div></div>
      <div class="stat"><div class="v">${d.days.length}</div><div class="l">累計学習日数</div></div>
      <div class="stat"><div class="v">${totalOk + totalNg}</div><div class="l">択一 解答数</div></div>
      <div class="stat"><div class="v">${totalOk + totalNg ? Math.round((totalOk / (totalOk + totalNg)) * 100) : 0}%</div><div class="l">択一 正答率</div></div>
      <div class="stat"><div class="v">${fOk + fNg}</div><div class="l">一問一答 解答数</div></div>
      <div class="stat"><div class="v">${fOk + fNg ? Math.round((fOk / (fOk + fNg)) * 100) : 0}%</div><div class="l">一問一答 正答率</div></div>
    </div>
    <div class="card" style="margin-top:12px">
      <h2>択一・分野別正答率</h2>
      <table class="simple"><tr><th>分野</th><th>解答数</th><th>正答率</th><th></th></tr>${rows}</table>
    </div>
    <div class="card">
      <h2>一問一答・分野別正答率</h2>
      <table class="simple"><tr><th>分野</th><th>解答数</th><th>正答率</th><th></th></tr>${flashRows}</table>
    </div>
    <div class="card">
      <h2>計算道場</h2>
      <table class="simple"><tr><th>種目</th><th>解答数</th><th>正答率</th></tr>${calcRows}</table>
    </div>
    <div class="card">
      <h2>弱点（択一${weak.length}問・一問一答${weakF.length}問）</h2>
      ${
        weak.length || weakF.length
          ? `${weak.length ? `<button class="btn secondary" id="weakGo">択一の弱点復習</button>` : ""}
             ${weakF.length ? `<button class="btn secondary" id="weakFlashGo">一問一答の弱点復習</button>` : ""}`
          : '<p class="muted small">不正解が先行している問題はありません。</p>'
      }
    </div>`;
  const wg = document.getElementById("weakGo");
  if (wg)
    wg.addEventListener("click", () => {
      gotoTab("quiz");
      startQuiz(Store.weakQuestions().slice(0, 20), false);
    });
  const wfg = document.getElementById("weakFlashGo");
  if (wfg)
    wfg.addEventListener("click", () => {
      gotoTab("quiz");
      startFlash(Store.weakFlash().slice(0, 20));
    });
}

// 座標系の設定を復元
CalcUtil.coordMode = localStorage.getItem("calcCoordMode") || "local";

// 初期表示
render("today");
