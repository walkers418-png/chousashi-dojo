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

  // 今日の目標（解答数）。目標は設定（進捗タブ）で変更可・既定20問。
  const dailyGoal = Number(localStorage.getItem("dailyGoal")) || 20;
  const todayRec = Store.load().daily[today] || { ok: 0, ng: 0 };
  const todayCount = todayRec.ok + todayRec.ng;
  const goalPct = Math.min(100, Math.round((todayCount / dailyGoal) * 100));
  const goalDone = todayCount >= dailyGoal;

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

  const srs = Store.srsCounts();
  const srsTodo = srs.due + srs.newAvail;
  const mistakes = Store.mistakeItems().length;
  // 実データから「今やると効く順」のおすすめを動的生成
  const actions = [];
  if (srsTodo > 0)
    actions.push({
      icon: "🧠",
      label: `SRS復習 ${srsTodo}枚`,
      sub: `期日${srs.due}・新規${srs.newAvail} — 忘れかけた頃に再出題`,
      act: "srs",
    });
  if (mistakes > 0)
    actions.push({
      icon: "📓",
      label: `間違いノート ${mistakes}件`,
      sub: "弱点・過信をまとめて復習",
      act: "note",
    });
  actions.push({
    icon: "🔀",
    label: "ミックス演習 20問",
    sub: "分野・形式をまぜて得点力を鍛える",
    act: "mix",
  });
  const recoCard = `
    <div class="card" style="border:1px solid var(--accent-deep)">
      <b style="color:var(--accent)">🎯 今日のおすすめ</b>
      <div class="muted small">あなたの記録から、今やると効く順に。</div>
      ${actions
        .map(
          (a) => `<div class="reco" data-act="${a.act}">
        <span class="reco-ico">${a.icon}</span>
        <div style="flex:1"><b>${esc(a.label)}</b><div class="muted small">${esc(a.sub)}</div></div>
        <span class="reco-go">▶</span>
      </div>`,
        )
        .join("")}
      ${srsTodo === 0 ? '<div class="muted small" style="margin-top:8px">🧠 SRSは今日の分が完了 🎉・習得 ' + srs.learned + "/" + srs.total + "</div>" : ""}
    </div>`;

  view.innerHTML = `
    <div class="card">
      <div class="kicker">本試験まで</div>
      <div style="font-size:34px;font-weight:800" class="mono">${dte}<span style="font-size:15px;font-weight:400"> 日</span></div>
      <div class="muted small">令和9年度 筆記試験（${SCHEDULE.examDate}・午前の部は測量士補で免除申請）</div>
      <div class="progressbar"><div style="width:${pct}%"></div></div>
      <div class="kicker" style="margin-top:8px">${esc(phase.name)}（${phase.from} 〜 ${phase.to}）</div>
      <p class="small">${esc(phase.goal)}</p>
    </div>
    <div class="card" style="padding:13px 14px">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <b>📅 今日の目標</b>
        <span class="${goalDone ? "ok-text" : "muted"}" style="font-size:13px">${todayCount} / ${dailyGoal}問${goalDone ? " 達成 🎉" : ""}</span>
      </div>
      <div class="progressbar" style="margin-top:6px"><div style="width:${goalPct}%"></div></div>
    </div>
    ${recoCard}
    <h2 style="font-size:15px;margin:14px 4px 8px">今日のメニュー</h2>
    ${tasks}
    <div class="card">
      <h2>直近の手続き・マイルストーン</h2>
      <ul class="small" style="margin-left:18px">${upcoming || "<li>なし</li>"}</ul>
    </div>`;

  view.querySelectorAll("[data-act]").forEach((el) =>
    el.addEventListener("click", () => {
      const a = el.dataset.act;
      if (a === "srs") startSrs();
      else if (a === "note") renderMistakeNotebook();
      else if (a === "mix") {
        gotoTab("quiz");
        startMix(buildMixDeck(20));
      }
    }),
  );
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
  const has = (k) => typeof ARTICLES !== "undefined" && !!ARTICLES[k];
  const suffix = num + (sub ? "の" + sub : "");
  // 接頭辞ありはその法令で厳密に判定
  if (prefix) {
    const k = LAW_ALIAS[prefix] + suffix;
    return has(k) ? k : null;
  }
  if (!defLaw) return null;
  // 接頭辞なし: 既定法令→民法→不登法 の順でフォールバック。
  // 「不登法の章で 177条」のような取り違え参照を、実在する条文（民法177）へ救済する。
  for (const code of [defLaw, "民法", "不登法"]) {
    const k = code + suffix;
    if (has(k)) return k;
  }
  return null;
}

// 要素内のテキストノードを走査し、辞書にある条文参照だけをタップ可能spanに変換
function linkArticlesInElement(root, defLaw) {
  if (!root || typeof ARTICLES === "undefined") return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const targets = [];
  let node;
  while ((node = walker.nextNode())) {
    if (node.parentElement && node.parentElement.closest(".artlink")) continue;
    // SVG図解内のテキストは条文リンク化しない（spanを入れると壊れて文字が消える）
    if (node.parentElement && node.parentElement.closest("svg")) continue;
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

// SVG図解内の <text> はspan挿入で壊れるため、要素自体をタップ可能にする（属性のみ付与）。
// 1つの <text> が複数条文を含む場合は最初の参照の吹き出しを開く。
function linkArticlesInSvg(root, defLaw) {
  if (!root || typeof ARTICLES === "undefined") return;
  root.querySelectorAll("svg text").forEach((t) => {
    if (t.dataset.art) return;
    ARTICLE_RE.lastIndex = 0;
    let m;
    while ((m = ARTICLE_RE.exec(t.textContent))) {
      const key = artKey(m[1], m[2], m[3], defLaw);
      if (key) {
        t.classList.add("artlink");
        t.dataset.art = key;
        break;
      }
    }
    ARTICLE_RE.lastIndex = 0;
  });
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
  // text は信頼できる法令データ（外部入力なし）。試験重要部分の <em class="art-hl"> 強調を
  // 活かすため esc せずHTMLとして描画する（law/no/title は素のテキストなので esc する）。
  ov.innerHTML = `<div class="art-pop">
      <div class="art-head"><b>${esc(a.law)}　${esc(a.no)}</b><div style="display:flex;gap:6px">${TTS.supported ? '<button class="art-close" id="artSpk" aria-label="読み上げ">🔊</button>' : ""}<button class="art-close" aria-label="閉じる">×</button></div></div>
      <div class="art-pop-title">${esc(a.title)}</div>
      <div class="art-pop-text">${a.text.replace(/\n/g, "<br>")}</div>
    </div>`;
  ov.style.display = "flex";
  ov.querySelector(".art-close[aria-label='閉じる']").addEventListener(
    "click",
    () => {
      TTS.stop();
      ov.style.display = "none";
    },
  );
  const spk = document.getElementById("artSpk");
  if (spk)
    spk.addEventListener("click", () =>
      TTS.play([
        { text: a.no + "。" + a.title, label: a.no },
        ...splitForSpeech(a.text, a.no),
      ]),
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

// パターン図解のタグ（例「民法 96条／177条」「不登法規則 115条」）から既定法令を推定
function defLawForTag(tag) {
  const t = String(tag || "");
  if (t.startsWith("不登法規則") || t.startsWith("規則")) return "規則";
  if (t.startsWith("不登法")) return "不登法";
  if (t.startsWith("民法")) return "民法";
  if (t.startsWith("区分所有法")) return "区分所有法";
  if (t.startsWith("調査士法")) return "調査士法";
  return null;
}

function renderPattern(id) {
  const p = PATTERNS.find((x) => x.id === id);
  if (!p) return renderPatternList();
  const maxStep = p.steps.length - 1;
  const patLaw = defLawForTag(p.tag);
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
  linkArticlesInElement(view.querySelector(".lecture-body"), patLaw);
  linkArticlesInSvg(view, patLaw);
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
    linkArticlesInElement(narr, patLaw);
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

// ─────────── 横断検索 ───────────
// 講義・図解・記述・択一・一問一答・条文を1つのインデックスで横断検索する。
let _searchIndex = null;
function buildSearchIndex() {
  if (_searchIndex) return _searchIndex;
  const idx = [];
  if (typeof LECTURES !== "undefined")
    LECTURES.forEach((l) =>
      idx.push({
        type: "講義",
        cat: l.cat,
        label: l.title,
        text: l.title + " " + stripHtml(l.body || ""),
        open: () => renderLecture(l.id),
      }),
    );
  if (typeof PATTERNS !== "undefined")
    PATTERNS.forEach((p) =>
      idx.push({
        type: "図解",
        cat: p.tag,
        label: p.title,
        text:
          p.title +
          " " +
          (p.short || "") +
          " " +
          stripHtml(p.intro || "") +
          " " +
          (p.steps || []).join(" "),
        open: () => renderPattern(p.id),
      }),
    );
  if (typeof WRITTEN !== "undefined")
    WRITTEN.forEach((w) =>
      idx.push({
        type: "記述",
        cat: w.type,
        label: w.title,
        text: w.title + " " + stripHtml(w.statement || ""),
        open: () => renderWritten(w.id),
      }),
    );
  if (typeof QUESTIONS !== "undefined")
    QUESTIONS.forEach((q) => {
      const ans =
        Array.isArray(q.choices) && typeof q.answer === "number"
          ? q.choices[q.answer]
          : "";
      idx.push({
        type: "択一",
        cat: q.cat,
        label: q.q,
        text:
          q.q +
          " " +
          (q.choices || []).join(" ") +
          " " +
          (q.stmts || []).join(" ") +
          " " +
          (q.expl || ""),
        detail: `正解: <b>${esc(ans)}</b>${q.expl ? "<br>" + esc(q.expl) : ""}`,
      });
    });
  if (typeof FLASH !== "undefined")
    FLASH.forEach((f) =>
      idx.push({
        type: "一問一答",
        cat: f.cat,
        label: f.s,
        text: f.s + " " + (f.expl || ""),
        detail: `<b>${f.a ? "○ 正しい" : "✕ 誤り"}</b>　${esc(f.expl || "")}`,
      }),
    );
  if (typeof ARTICLES !== "undefined")
    Object.keys(ARTICLES).forEach((key) => {
      const a = ARTICLES[key];
      idx.push({
        type: "条文",
        cat: a.law,
        label: a.law + " " + a.no + (a.title ? "（" + a.title + "）" : ""),
        text: a.law + " " + a.no + " " + (a.title || "") + " " + (a.text || ""),
        open: () => showArticlePopup(key),
      });
    });
  _searchIndex = idx;
  return idx;
}
function _hlight(s, terms) {
  let out = esc(s);
  terms.forEach((t) => {
    if (!t) return;
    const re = new RegExp(
      "(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")",
      "gi",
    );
    out = out.replace(re, "<mark>$1</mark>");
  });
  return out;
}
function renderSearchResults(query) {
  const cont = document.getElementById("searchResults");
  const browse = document.getElementById("lecBrowse");
  if (!cont) return;
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) {
    cont.innerHTML = "";
    if (browse) browse.style.display = "";
    return;
  }
  if (browse) browse.style.display = "none";
  const matches = buildSearchIndex().filter((e) => {
    const hay = e.text.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
  if (!matches.length) {
    cont.innerHTML = `<p class="muted small" style="margin:14px 4px">「${esc(query)}」に一致する項目はありません。別の言葉でお試しください。</p>`;
    return;
  }
  const order = ["講義", "図解", "記述", "択一", "一問一答", "条文"];
  const byType = {};
  matches.forEach((m) => (byType[m.type] = byType[m.type] || []).push(m));
  const openable = [];
  let html = `<p class="muted small" style="margin:10px 4px 2px">${matches.length}件ヒット</p>`;
  order.forEach((type) => {
    const list = byType[type];
    if (!list) return;
    const shown = list.slice(0, 25);
    html += `<div class="srch-gh">${type}（${list.length}）</div>`;
    shown.forEach((m) => {
      if (m.open) {
        const oi = openable.push(m) - 1;
        html += `<div class="card clickable srch-item" data-so="${oi}"><span class="tag">${esc(m.cat || "")}</span> ${_hlight(m.label, terms)}</div>`;
      } else {
        html += `<details class="card srch-item"><summary><span class="tag">${esc(m.cat || "")}</span> ${_hlight(m.label, terms)}</summary><div class="expl">${m.detail}</div></details>`;
      }
    });
    if (list.length > shown.length)
      html += `<p class="muted small" style="margin:2px 4px 8px">他 ${list.length - shown.length} 件…（語を足すと絞り込めます）</p>`;
  });
  cont.innerHTML = html;
  cont
    .querySelectorAll("[data-so]")
    .forEach((el) =>
      el.addEventListener("click", () => openable[+el.dataset.so].open()),
    );
  // 択一の解説中の条文をタップ可能に
  cont
    .querySelectorAll("details .expl")
    .forEach((el) => linkArticlesInElement(el));
}

function renderLectureList() {
  const cats = [...new Set(LECTURES.map((l) => l.cat))];
  const browseHtml =
    `<div class="card clickable" data-patopen="1" style="border:1px solid var(--accent-deep)">
      <b style="color:var(--accent)">🎬 パターン図解（動く図解）</b>
      <div class="muted small">取消し/解除/時効と登記・94条2項… 答えが分かれる論点をアニメで。勘違い型は大きな✕で警告</div>
    </div>` +
    cats
      .map((cat) =>
        LECTURES.filter((l) => l.cat === cat)
          .map(
            (l) =>
              `<div class="card clickable" data-lec="${l.id}" style="padding:13px 14px">
          <span class="tag">${esc(l.cat)}</span>${impBadge(LECTURE_IMP[l.id])}
          <div style="margin-top:5px">${esc(l.title)}</div>
        </div>`,
          )
          .join(""),
      )
      .join("");
  view.innerHTML = `<h2 style="font-size:15px;margin:4px">講義ノート（全${LECTURES.length}ユニット）</h2>
    <input type="search" id="globalSearch" class="search-box" placeholder="🔍 講義・条文・問題・図解を横断検索" autocomplete="off">
    <div id="searchResults"></div>
    <p class="muted small" style="margin:6px 4px 12px">${impBadge(5)} は重要度（過去問ウェイト・★5が最優先）。本文中の<span class="artlink">青い条文</span>をタップすると全文が吹き出しで出ます。</p>
    <div id="lecBrowse">${browseHtml}</div>`;
  const si = document.getElementById("globalSearch");
  si.addEventListener("input", () => renderSearchResults(si.value));
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
      <span class="tag">${esc(l.cat)}</span>${impBadge(LECTURE_IMP[l.id])}${TTS.supported ? '<button class="spk" id="lecSpk" title="講義を音声で聴く">🔊</button>' : ""}
      <h2 style="margin-top:6px">${esc(l.title)}</h2>
      <div class="lecture-body">${l.body}</div>
      <button class="btn secondary" id="toQuiz">この分野の択一を解く →</button>
    </div>`;
  const body = view.querySelector(".lecture-body");
  linkArticlesInElement(body, defLawForCat(l.cat));
  linkArticlesInSvg(body, defLawForCat(l.cat));
  if (TTS.supported) {
    const ls = document.getElementById("lecSpk");
    // 講義タイトル＋本文を文ごとに分割して「音楽プレーヤー」風に聴ける
    const segs = [
      { text: l.title, label: "タイトル" },
      ...splitForSpeech(body.textContent, "講義"),
    ];
    if (ls) ls.addEventListener("click", () => TTS.play(segs));
  }
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
  const srs = Store.srsCounts();
  const over = Store.overconfidentItems();
  view.innerHTML = `
    <div class="card">
      <h2>本試験形式 模試</h2>
      <p class="small muted">全分野から20問・50分計測（本試験の択一と同形式・全${QUESTIONS.length}問収録）</p>
      <button class="btn" id="mockBtn">20問模試を開始する</button>
      ${weak.length ? `<button class="btn secondary" id="weakBtn">択一の弱点復習（${weak.length}問）</button>` : ""}
      <hr class="sep">
      <div class="muted small">📝 本番フル模試 — 午後形式（択一20＋記述2）を <b>2時間30分</b> 通しで計測</div>
      <button class="btn secondary" id="fullMockBtn">フル模試を開始する</button>
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
      <hr class="sep">
      <div class="muted small">🧠 間隔反復（SRS）— 期日 ${srs.due}枚・新規 ${srs.newAvail}枚</div>
      <button class="btn secondary" id="srsMenuBtn">SRSで復習する</button>
    </div>
    <div class="card" style="border:1px solid var(--accent-deep)">
      <h2>🔀 ミックス演習（インターリービング）</h2>
      <p class="small muted">択一＋一問一答を全分野からまぜて20問。「どの知識を使うか見抜く力」＝本試験の得点力を鍛える</p>
      <button class="btn" id="mixBtn">ミックス20問スタート</button>
      ${over.length ? `<button class="btn secondary" id="overBtn">過信の復習（自信あり×不正解 ${over.length}件）</button>` : ""}
    </div>
    <div class="card">
      <h2>🧪 学習法モード（科学的強化）</h2>
      <p class="small muted">研究で効果が示された手法をオンにできます（手数は少し増えますが定着が上がります）。</p>
      <label class="modetog"><input type="checkbox" data-mode="recall" ${MODE("recall") ? "checked" : ""}><span><b>アクティブリコール</b><br><span class="muted small">一問一答で先に答えと理由を思い出してからめくる（生成効果）</span></span></label>
      <label class="modetog"><input type="checkbox" data-mode="explain" ${MODE("explain") ? "checked" : ""}><span><b>自己説明</b><br><span class="muted small">解説の前に「なぜ？」を自分の言葉で説明（精緻化）</span></span></label>
      <label class="modetog"><input type="checkbox" data-mode="conf" ${MODE("conf") ? "checked" : ""}><span><b>自信度の記録</b><br><span class="muted small">答え合わせ前に自信を申告→「過信（自信あり×不正解）」を優先復習（較正）</span></span></label>
      ${TTS.supported ? `<label class="modetog"><input type="checkbox" data-mode="tts" ${MODE("tts") ? "checked" : ""}><span><b>🔊 自動読み上げ</b><br><span class="muted small">問題・解説を音声で自動再生（ハンズフリー）。各問・講義・条文の🔊でも再生でき、前/次/一時停止/速度(1〜2倍)を操作できます</span></span></label>` : ""}
      ${TTS.supported ? `<label class="modetog"><input type="checkbox" data-mode="zunda" ${localStorage.getItem("mode_zunda") !== "0" ? "checked" : ""}><span><b>🫛 ずんだもん口調</b><br><span class="muted small">読み上げの語尾を「〜のだ」調・高めの声に（端末内蔵の声を使うため、VOICEVOXのずんだもん本人の声ではありません）</span></span></label>` : ""}
    </div>
    <h2 style="font-size:15px;margin:14px 4px 8px">択一・分野別演習</h2>
    ${catBtns}`;
  document
    .getElementById("mockBtn")
    .addEventListener("click", () => startQuiz(pickQuestions(null, 20), true));
  const wb = document.getElementById("weakBtn");
  if (wb)
    wb.addEventListener("click", () => startQuiz(weak.slice(0, 20), false));
  document
    .getElementById("fullMockBtn")
    .addEventListener("click", startFullMock);
  document.getElementById("flashBtn").addEventListener("click", () => {
    const cat = document.getElementById("flashCat").value || null;
    startFlash(pickFlash(cat, 20));
  });
  const fwb = document.getElementById("flashWeakBtn");
  if (fwb) fwb.addEventListener("click", () => startFlash(weakF.slice(0, 20)));
  document.getElementById("srsMenuBtn").addEventListener("click", startSrs);
  document
    .getElementById("mixBtn")
    .addEventListener("click", () => startMix(buildMixDeck(20)));
  const ob = document.getElementById("overBtn");
  if (ob) ob.addEventListener("click", () => startMix(over.slice(0, 20)));
  view.querySelectorAll("[data-mode]").forEach((cb) =>
    cb.addEventListener("change", () => {
      localStorage.setItem("mode_" + cb.dataset.mode, cb.checked ? "1" : "0");
    }),
  );
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

// ─────────── 学習法モード（科学的強化） ───────────
// localStorage フラグ: mode_recall(アクティブリコール) / mode_explain(自己説明) / mode_conf(自信度) / mode_tts(自動読み上げ)
const MODE = (k) => localStorage.getItem("mode_" + k) === "1";

// ─────────── 音声プレイヤー（ブラウザ内蔵TTS・オフライン可） ───────────
const stripHtml = (s) =>
  String(s)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const TTS_RATES = [1, 1.25, 1.5, 2];

// テキストを文（。！？）ごとのセグメントに分割（前/次で移動する単位）。
// iOS互換のため後読み正規表現は使わない。
function splitForSpeech(html, label) {
  const text = stripHtml(html);
  const segs = [];
  let cur = "";
  for (const ch of text) {
    cur += ch;
    if (ch === "。" || ch === "！" || ch === "？") {
      if (cur.trim()) segs.push({ text: cur.trim(), label });
      cur = "";
    }
  }
  if (cur.trim()) segs.push({ text: cur.trim(), label });
  return segs;
}

// ずんだもん口調（読み上げ用の語尾変換。画面表示テキストは変えない）。
function zundaStyle(t) {
  if (localStorage.getItem("mode_zunda") === "0") return t;
  return String(t).replace(/([^。！？]*?)([。！？])/g, (m, body, end) => {
    let b = body.trim();
    if (!b) return m;
    if (/(のだ|なのだ)$/.test(b)) return b + end;
    const r = b.replace(/(です|である|だ)$/, "なのだ");
    if (r !== b) return r + end;
    // 末尾が動詞・形容詞などなら「のだ」、それ以外は「なのだ」
    if (/(る|い|た|ない|う|く|ぐ|す|つ|ぬ|む|ん|よ)$/.test(b)) b += "のだ";
    else b += "なのだ";
    return b + end;
  });
}

const TTS = {
  q: [], // セグメント配列 [{text,label}]
  i: -1,
  rate: TTS_RATES.includes(Number(localStorage.getItem("ttsRate")))
    ? Number(localStorage.getItem("ttsRate"))
    : 1,
  paused: false,
  seq: 0,
  get supported() {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  },
  _jaVoice() {
    const vs = window.speechSynthesis.getVoices();
    return vs.find((v) => /ja(-|_)?JP|Japanese/i.test(v.lang + v.name));
  },
  // 後方互換: 単発読み上げ（1セグメント再生）
  speak(text) {
    this.play([{ text: String(text || "") }]);
  },
  play(segments) {
    if (!this.supported) return;
    const q = (segments || []).filter((s) => s && stripHtml(s.text));
    if (!q.length) return;
    this.q = q;
    this.i = 0;
    this.paused = false;
    this._bar();
    this._speak();
  },
  _speak() {
    if (this.i < 0 || this.i >= this.q.length) return this.stop();
    const seq = ++this.seq;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(
      zundaStyle(stripHtml(this.q[this.i].text)),
    );
    u.lang = "ja-JP";
    u.rate = this.rate;
    u.pitch = 1.5; // ずんだもん風に高め
    const v = this._jaVoice();
    if (v) u.voice = v;
    u.onend = () => {
      if (seq !== this.seq || this.paused) return; // 中断・速度変更時は自動送りしない
      if (this.i < this.q.length - 1) {
        this.i++;
        this._speak();
      } else this.stop();
    };
    this.paused = false;
    window.speechSynthesis.speak(u);
    this._update();
  },
  next() {
    if (this.i < this.q.length - 1) {
      this.i++;
      this.paused = false;
      this._speak();
    }
  },
  prev() {
    if (this.i > 0) this.i--;
    this.paused = false;
    this._speak();
  },
  toggle() {
    // iOS互換のため pause/resume ではなく「停止／現在の文を再生」で実装
    if (this.paused) {
      this.paused = false;
      this._speak();
    } else {
      this.paused = true;
      this.seq++;
      window.speechSynthesis.cancel();
      this._update();
    }
  },
  cycleRate() {
    this.rate =
      TTS_RATES[(TTS_RATES.indexOf(this.rate) + 1) % TTS_RATES.length];
    localStorage.setItem("ttsRate", String(this.rate));
    this._update();
    if (!this.paused) this._speak(); // 現在の文を新しい速度で再生
  },
  stop() {
    this.q = [];
    this.i = -1;
    this.paused = false;
    if (this.supported) {
      this.seq++;
      window.speechSynthesis.cancel();
    }
    const b = document.getElementById("playerBar");
    if (b) b.style.display = "none";
  },
  _bar() {
    let b = document.getElementById("playerBar");
    if (!b) {
      b = document.createElement("div");
      b.id = "playerBar";
      b.innerHTML = `
        <button id="plPrev" aria-label="前へ">⏮</button>
        <button id="plToggle" aria-label="再生／一時停止">⏸</button>
        <button id="plNext" aria-label="次へ">⏭</button>
        <span id="plLabel"></span>
        <button id="plRate" aria-label="再生速度">1×</button>
        <button id="plClose" aria-label="閉じる">✕</button>`;
      document.body.appendChild(b);
      b.querySelector("#plPrev").onclick = () => this.prev();
      b.querySelector("#plToggle").onclick = () => this.toggle();
      b.querySelector("#plNext").onclick = () => this.next();
      b.querySelector("#plRate").onclick = () => this.cycleRate();
      b.querySelector("#plClose").onclick = () => this.stop();
    }
    b.style.display = "flex";
  },
  _update() {
    const b = document.getElementById("playerBar");
    if (!b) return;
    b.querySelector("#plToggle").textContent = this.paused ? "▶️" : "⏸";
    b.querySelector("#plRate").textContent = this.rate + "×";
    const seg = this.q[this.i];
    b.querySelector("#plLabel").textContent =
      (seg && seg.label ? seg.label : "読み上げ") +
      ` ${this.i + 1}/${this.q.length}`;
    b.querySelector("#plPrev").disabled = this.i <= 0;
    b.querySelector("#plNext").disabled = this.i >= this.q.length - 1;
  },
};

// 解答後の共通フロー: (自信度→) 正誤開示+記録 (→自己説明) → 解説 → 次へ
// o: { box, kind, id, ok, defLaw, explHtml, reveal(), record(), onNext() }
function answerFlow(o) {
  const box = o.box;
  const showExpl = () => {
    box.innerHTML = o.explHtml;
    linkArticlesInElement(box, o.defLaw);
    if (MODE("tts")) TTS.play(splitForSpeech(box.textContent, "解説"));
    o.onNext();
  };
  const afterReveal = () => {
    if (MODE("explain")) {
      box.innerHTML = `<div class="se-prompt">🤔 <b>なぜこの答えになる？</b><br>条文・理由を<u>自分の言葉で</u>頭の中で説明してから開こう（精緻化）。</div>
        <button class="btn secondary" id="seGo">解説を見る →</button>`;
      document.getElementById("seGo").addEventListener("click", showExpl);
    } else showExpl();
  };
  const reveal = (confident) => {
    o.reveal();
    o.record();
    if (confident !== null)
      Store.recordConfidence(o.kind, o.id, confident, o.ok);
    updateStreak();
    afterReveal();
  };
  if (MODE("conf")) {
    // フィードバック前に自信を申告（較正のため正誤はまだ見せない）
    box.innerHTML = `<div class="conf-ask">答え合わせの前に — この答え、<b>自信は？</b></div>
      <div class="conf-row">
        <button class="btn conf-yes" id="cYes">自信あり</button>
        <button class="btn conf-no" id="cNo">自信なし</button>
      </div>`;
    document
      .getElementById("cYes")
      .addEventListener("click", () => reveal(true));
    document
      .getElementById("cNo")
      .addEventListener("click", () => reveal(false));
  } else reveal(null);
}

// 一問一答1問の描画（通常セッション・ミックス共用）。ctx で見出し・採点・次への遷移を注入。
function renderOneFlash(f, ctx) {
  const recall = MODE("recall");
  view.innerHTML = `
    <div class="card">
      <div class="qhead"><span>${ctx.label}</span><span class="tag">${esc(f.cat)}</span>${ctx.kindTag || ""}${TTS.supported ? '<button class="spk" id="spkBtn" title="読み上げ">🔊</button>' : ""}</div>
      <p class="statement" style="min-height:72px"><b>${esc(f.s)}</b></p>
      ${recall ? `<button class="btn ghost" id="recallBtn">🧠 ○か×か・理由まで思い出した → めくる</button>` : ""}
      <div class="btn-row" id="oxRow"${recall ? ' style="display:none"' : ""}>
        <button class="btn" id="oxO" style="font-size:24px;background:var(--surface2);border:1px solid var(--border);color:var(--ok)">○</button>
        <button class="btn" id="oxX" style="font-size:24px;background:var(--surface2);border:1px solid var(--border);color:var(--ng)">×</button>
      </div>
      <div id="explBox"></div>
      <button class="btn" id="nextBtn" style="display:none">次へ →</button>
    </div>
    ${ctx.footHtml || ""}`;
  if (recall)
    document.getElementById("recallBtn").addEventListener("click", () => {
      document.getElementById("recallBtn").style.display = "none";
      document.getElementById("oxRow").style.display = "flex";
    });
  if (TTS.supported) {
    const sb = document.getElementById("spkBtn");
    if (sb)
      sb.addEventListener("click", () =>
        TTS.play([{ text: f.s, label: "問題" }]),
      );
    if (MODE("tts")) TTS.play([{ text: f.s, label: "問題" }]); // 自動読み上げ
  }
  const box = document.getElementById("explBox");
  const answer = (userSaysTrue) => {
    const ok = userSaysTrue === f.a;
    document.getElementById("oxO").disabled = true;
    document.getElementById("oxX").disabled = true;
    answerFlow({
      box,
      kind: "flash",
      id: f.id,
      ok,
      defLaw: defLawForCat(f.cat),
      explHtml: `<div class="expl"><b>${ok ? "正解！" : "不正解"}</b> 答えは <b>${f.a ? "○" : "×"}</b><br>${f.expl}</div>`,
      reveal: () => {
        document.getElementById(f.a ? "oxO" : "oxX").style.borderColor =
          "var(--ok)";
        if (!ok)
          document.getElementById(
            userSaysTrue ? "oxO" : "oxX",
          ).style.borderColor = "var(--ng)";
      },
      record: () => {
        Store.recordFlash(f.id, ok);
        ctx.onScored(ok);
      },
      onNext: () =>
        (document.getElementById("nextBtn").style.display = "block"),
    });
  };
  document.getElementById("oxO").addEventListener("click", () => answer(true));
  document.getElementById("oxX").addEventListener("click", () => answer(false));
  document.getElementById("nextBtn").addEventListener("click", ctx.next);
}

// 択一1問の描画（通常・ミックス共用）。組み合わせ問題(stmts)・自信度・自己説明に対応。
function renderOneQuiz(q, ctx) {
  const nums = ["1", "2", "3", "4", "5"];
  const KANA = ["ア", "イ", "ウ", "エ", "オ"];
  const stmtsHtml = q.stmts
    ? `<div class="stmts">${q.stmts
        .map(
          (s, i) =>
            `<div class="stmt"><span class="stmt-mark">${KANA[i]}</span><span>${esc(s)}</span></div>`,
        )
        .join("")}</div>`
    : "";
  view.innerHTML = `
    ${ctx.topHtml || ""}
    <div class="card">
      <div class="qhead"><span>${ctx.label}</span><span class="tag">${esc(q.cat)}</span>${ctx.kindTag || ""}${TTS.supported ? '<button class="spk" id="spkBtn" title="読み上げ">🔊</button>' : ""}</div>
      <p class="statement"><b>${esc(q.q)}</b></p>
      ${stmtsHtml}
      <div id="choices">
        ${q.choices.map((c, i) => `<button class="choice" data-i="${i}"><span class="cnum">${nums[i]}</span>${esc(c)}</button>`).join("")}
      </div>
      <div id="explBox"></div>
      <button class="btn" id="nextBtn" style="display:none">次へ →</button>
    </div>
    ${ctx.footHtml || ""}`;
  if (q.stmts)
    linkArticlesInElement(view.querySelector(".stmts"), defLawForCat(q.cat));
  // 読み上げ: 設問・ア〜オ・選択肢を「前/次」で移動できるセグメントに
  const readSegs = [
    { text: q.q, label: "設問" },
    ...(q.stmts
      ? q.stmts.map((s, i) => ({ text: KANA[i] + "、" + s, label: KANA[i] }))
      : []),
    ...q.choices.map((c, i) => ({
      text: nums[i] + "、" + c,
      label: "選択肢" + nums[i],
    })),
  ];
  if (TTS.supported) {
    const sb = document.getElementById("spkBtn");
    if (sb) sb.addEventListener("click", () => TTS.play(readSegs));
    if (MODE("tts")) TTS.play(readSegs);
  }
  const box = document.getElementById("explBox");
  view.querySelectorAll(".choice").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.i);
      const ok = i === q.answer;
      view.querySelectorAll(".choice").forEach((b) => (b.disabled = true));
      answerFlow({
        box,
        kind: "quiz",
        id: q.id,
        ok,
        defLaw: defLawForCat(q.cat),
        explHtml: `<div class="expl"><b>${ok ? "正解！" : "不正解"}</b> 正答は ${q.answer + 1}。<br>${q.expl}</div>`,
        reveal: () => {
          view.querySelectorAll(".choice").forEach((b, bi) => {
            if (bi === q.answer) b.classList.add("correct");
            else if (bi === i && !ok) b.classList.add("wrong");
          });
        },
        record: () => {
          Store.recordQuiz(q.id, ok);
          ctx.onScored(ok);
        },
        onNext: () =>
          (document.getElementById("nextBtn").style.display = "block"),
      });
    });
  });
  document.getElementById("nextBtn").addEventListener("click", ctx.next);
}

function startFlash(items) {
  if (!items.length) return;
  flashState = { fs: items, idx: 0, ok: 0 };
  renderFlashQuestion();
}

function renderFlashQuestion() {
  const st = flashState;
  renderOneFlash(st.fs[st.idx], {
    label: `一問一答 ${st.idx + 1} / ${st.fs.length}`,
    footHtml: `<p class="muted small" style="text-align:center">正答: ${st.ok} / ${st.idx}</p>`,
    onScored: (ok) => {
      if (ok) st.ok++;
    },
    next: () => {
      st.idx++;
      if (st.idx >= st.fs.length) renderFlashResult();
      else renderFlashQuestion();
    },
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

// ─────────── 間隔反復（SRS） ───────────
let srsState = null;

function startSrs() {
  const { due, newCards } = Store.srsDueDeck();
  const deck = [...due, ...newCards];
  if (!deck.length) return renderSrsEmpty();
  srsState = {
    deck,
    idx: 0,
    good: 0,
    again: 0,
    total: deck.length,
    newCount: newCards.length,
  };
  renderSrsCard();
}

function renderSrsEmpty() {
  const next = Store.srsNextDue();
  const c = Store.srsCounts();
  view.innerHTML = `
    <div class="card" style="text-align:center">
      <div style="font-size:34px">🎉</div>
      <h2 style="margin:6px 0">今日の復習は完了！</h2>
      <p class="muted small">期日の来たカードはすべて消化しました。間隔をあけて再出題されます。</p>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:10px">
        <span class="tag ok">習得 ${c.learned}/${c.total}</span>
        ${next ? `<span class="tag">次の期日 ${next}</span>` : ""}
      </div>
      <button class="btn secondary" id="srsBack" style="margin-top:14px">戻る</button>
    </div>`;
  document
    .getElementById("srsBack")
    .addEventListener("click", () => gotoTab("today"));
}

function renderSrsCard() {
  const st = srsState;
  const entry = st.deck[st.idx];
  const item = entry.item;
  const isNew = !Store.srsCard(entry.id);
  const left = st.total - st.idx;
  const head = `<div class="qhead">
        <span>🧠 復習 ${st.idx + 1} / ${st.total}</span>
        <span class="tag">${esc(item.cat)}</span>${entry.kind === "quiz" ? '<span class="tag">択一</span>' : ""}${isNew ? '<span class="tag warn">NEW</span>' : ""}
      </div>`;
  const foot = `<p class="muted small" style="text-align:center">残り ${left}枚（うち正解 ${st.good}・要再復習 ${st.again}）</p>`;

  if (entry.kind === "quiz") {
    const nums = ["1", "2", "3", "4", "5"];
    const KANA = ["ア", "イ", "ウ", "エ", "オ"];
    const stmtsHtml = item.stmts
      ? `<div class="stmts">${item.stmts.map((s, i) => `<div class="stmt"><span class="stmt-mark">${KANA[i]}</span><span>${esc(s)}</span></div>`).join("")}</div>`
      : "";
    view.innerHTML = `
    <button class="back" id="backBtn">← 復習をやめる</button>
    <div class="card">
      ${head}
      <p class="statement"><b>${esc(item.q)}</b></p>
      ${stmtsHtml}
      <div id="choices">
        ${item.choices.map((c, i) => `<button class="choice" data-i="${i}"><span class="cnum">${nums[i]}</span>${esc(c)}</button>`).join("")}
      </div>
      <div id="explBox"></div>
      <div id="gradeBox"></div>
    </div>
    ${foot}`;
    if (item.stmts)
      linkArticlesInElement(
        view.querySelector(".stmts"),
        defLawForCat(item.cat),
      );
    view.querySelectorAll(".choice").forEach((btn) =>
      btn.addEventListener("click", () => {
        const i = Number(btn.dataset.i);
        const ok = i === item.answer;
        view.querySelectorAll(".choice").forEach((b, bi) => {
          b.disabled = true;
          if (bi === item.answer) b.classList.add("correct");
          else if (bi === i && !ok) b.classList.add("wrong");
        });
        const box = document.getElementById("explBox");
        box.innerHTML = `<div class="expl"><b>${ok ? "正解！" : "不正解"}</b> 正答は ${item.answer + 1}。<br>${item.expl}</div>`;
        linkArticlesInElement(box, defLawForCat(item.cat));
        renderSrsGrade(entry, ok);
      }),
    );
  } else {
    view.innerHTML = `
    <button class="back" id="backBtn">← 復習をやめる</button>
    <div class="card">
      ${head}
      <p class="statement" style="min-height:72px"><b>${esc(item.s)}</b></p>
      <div class="btn-row" id="oxRow">
        <button class="btn" id="oxO" style="font-size:24px;background:var(--surface2);border:1px solid var(--border);color:var(--ok)">○</button>
        <button class="btn" id="oxX" style="font-size:24px;background:var(--surface2);border:1px solid var(--border);color:var(--ng)">×</button>
      </div>
      <div id="explBox"></div>
      <div id="gradeBox"></div>
    </div>
    ${foot}`;
    const answer = (userSaysTrue) => {
      const ok = userSaysTrue === item.a;
      document.getElementById("oxO").disabled = true;
      document.getElementById("oxX").disabled = true;
      document.getElementById(item.a ? "oxO" : "oxX").style.borderColor =
        "var(--ok)";
      document.getElementById("explBox").innerHTML =
        `<div class="expl"><b>${ok ? "正解！" : "不正解"}</b> 答えは <b>${item.a ? "○" : "×"}</b><br>${item.expl}</div>`;
      linkArticlesInElement(
        document.getElementById("explBox"),
        defLawForCat(item.cat),
      );
      renderSrsGrade(entry, ok);
    };
    document
      .getElementById("oxO")
      .addEventListener("click", () => answer(true));
    document
      .getElementById("oxX")
      .addEventListener("click", () => answer(false));
  }
  document.getElementById("backBtn").addEventListener("click", () => {
    srsState = null;
    gotoTab("today");
  });
}

// 解答後の自己評価。間違いは自動でラプス、正解なら難易度を3段階で自己申告して次回間隔を決める。
function renderSrsGrade(entry, ok) {
  const box = document.getElementById("gradeBox");
  const dayLabel = (n) => (n === 1 ? "明日" : `${n}日後`);
  if (!ok) {
    box.innerHTML = `
      <p class="srs-next">❌ ${dayLabel(1)}にもう一度出題されます</p>
      <button class="btn" id="srsNext">次へ →</button>`;
    document.getElementById("srsNext").addEventListener("click", () => {
      Store.srsReview(entry.id, 1);
      advanceSrs(false);
    });
    return;
  }
  const grades = [
    { q: 3, label: "むずかしい", cls: "grade-hard" },
    { q: 4, label: "ふつう", cls: "grade-good" },
    { q: 5, label: "かんたん", cls: "grade-easy" },
  ];
  box.innerHTML = `
    <p class="srs-next">記憶の手応えで次回の間隔が決まります</p>
    <div class="grade-row">
      ${grades
        .map(
          (g) =>
            `<button class="btn ${g.cls}" data-q="${g.q}">${g.label}<small>${dayLabel(Store.srsPreview(entry.id, g.q))}</small></button>`,
        )
        .join("")}
    </div>`;
  box.querySelectorAll("[data-q]").forEach((btn) =>
    btn.addEventListener("click", () => {
      Store.srsReview(entry.id, Number(btn.dataset.q));
      advanceSrs(true);
    }),
  );
}

function advanceSrs(ok) {
  const st = srsState;
  ok ? st.good++ : st.again++;
  updateStreak();
  st.idx++;
  if (st.idx >= st.deck.length) renderSrsResult();
  else renderSrsCard();
}

function renderSrsResult() {
  const st = srsState;
  srsState = null;
  const c = Store.srsCounts();
  const next = Store.srsNextDue();
  view.innerHTML = `
    <div class="card" style="text-align:center">
      <div class="kicker">復習セッション完了</div>
      <div style="font-size:40px;font-weight:800">${st.good} <span style="font-size:16px;font-weight:400">/ ${st.total}枚</span></div>
      <p class="muted small">一発正解 ${st.good}枚・要再復習 ${st.again}枚（新規 ${st.newCount}枚を導入）</p>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:8px">
        <span class="tag ${c.due ? "warn" : "ok"}">残り期日 ${c.due}枚</span>
        ${next ? `<span class="tag">次の期日 ${next}</span>` : ""}
      </div>
      ${c.due + c.newAvail ? '<button class="btn" id="srsMore">続けて復習する</button>' : ""}
      <button class="btn secondary" id="srsHome">今日のメニューへ</button>
    </div>`;
  const more = document.getElementById("srsMore");
  if (more) more.addEventListener("click", startSrs);
  document
    .getElementById("srsHome")
    .addEventListener("click", () => gotoTab("today"));
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
  renderOneQuiz(q, {
    label: `第${st.idx + 1}問 / ${st.qs.length}問`,
    topHtml: st.timed ? '<div class="timer" id="quizTimer">⏱ 50:00</div>' : "",
    onScored: (ok) => {
      st.answers.push({ id: q.id, ok });
      if (ok) st.ok++;
    },
    next: () => {
      st.idx++;
      if (st.idx >= st.qs.length) renderQuizResult();
      else renderQuizQuestion();
    },
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

// ─────────── ミックス演習（インターリービング） ───────────
// 択一と一問一答を全分野からまぜて出題し、「どの知識を使うか」を選ぶ力を鍛える。
let mixState = null;

function buildMixDeck(n) {
  const pool = [
    ...QUESTIONS.map((q) => ({ kind: "quiz", item: q })),
    ...FLASH.map((f) => ({ kind: "flash", item: f })),
  ];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

function startMix(deck) {
  if (!deck || !deck.length) return;
  mixState = { deck, idx: 0, ok: 0 };
  renderMixItem();
}

function renderMixItem() {
  const st = mixState;
  const cur = st.deck[st.idx];
  const ctx = {
    label: `🔀 ミックス ${st.idx + 1} / ${st.deck.length}`,
    kindTag:
      cur.kind === "flash"
        ? '<span class="tag warn">一問一答</span>'
        : '<span class="tag">択一</span>',
    footHtml: `<p class="muted small" style="text-align:center">正答: ${st.ok} / ${st.idx}</p>`,
    onScored: (ok) => {
      if (ok) st.ok++;
    },
    next: () => {
      st.idx++;
      if (st.idx >= st.deck.length) renderMixResult();
      else renderMixItem();
    },
  };
  if (cur.kind === "flash") renderOneFlash(cur.item, ctx);
  else renderOneQuiz(cur.item, ctx);
}

function renderMixResult() {
  const st = mixState;
  mixState = null;
  const n = st.deck.length;
  const rate = Math.round((st.ok / n) * 100);
  view.innerHTML = `
    <div class="card" style="text-align:center">
      <div class="kicker">🔀 ミックス演習 結果</div>
      <div style="font-size:40px;font-weight:800">${st.ok} <span style="font-size:16px;font-weight:400">/ ${n}問</span></div>
      <p>正答率 ${rate}%</p>
      <p class="muted small">分野・形式をまぜる練習は、本試験で問われる「どの知識を使うか見抜く力」を鍛えます（インターリービング）。</p>
      <button class="btn" id="againBtn">もう20問</button>
      <button class="btn secondary" id="menuBtn">メニューへ戻る</button>
    </div>`;
  document
    .getElementById("againBtn")
    .addEventListener("click", () => startMix(buildMixDeck(20)));
  document.getElementById("menuBtn").addEventListener("click", renderQuizMenu);
}

// ─────────── 本番フル模試（午後形式：択一20＋記述2を通し計測） ───────────
let fullMockState = null;

function startFullMock() {
  const tochi = WRITTEN.filter((w) => w.type === "土地");
  const tatemono = WRITTEN.filter((w) => w.type === "建物");
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const wIds = [];
  if (tochi.length) wIds.push(pick(tochi).id);
  if (tatemono.length) wIds.push(pick(tatemono).id);
  fullMockState = {
    qs: pickQuestions(null, 20),
    qIdx: 0,
    qOk: 0,
    wIds,
    wIdx: 0,
    wScores: [],
    start: Date.now(),
    limit: 150 * 60, // 午後の部 2時間30分
  };
  // 全フェーズに浮かぶ固定タイマー
  let tm = document.getElementById("mockTimer");
  if (!tm) {
    tm = document.createElement("div");
    tm.id = "mockTimer";
    tm.className = "timer mock-timer";
    document.body.appendChild(tm);
  }
  renderMockQuiz();
  mockTick();
}

function mockTick() {
  if (!fullMockState) return;
  const remain =
    fullMockState.limit - Math.floor((Date.now() - fullMockState.start) / 1000);
  if (remain <= 0) return renderFullMockResult();
  const el = document.getElementById("mockTimer");
  if (el) {
    const h = Math.floor(remain / 3600);
    const m = Math.floor((remain % 3600) / 60);
    const s = remain % 60;
    el.textContent = `⏱ ${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  setTimeout(mockTick, 1000);
}

function abortFullMock() {
  fullMockState = null;
  const tm = document.getElementById("mockTimer");
  if (tm) tm.remove();
  renderQuizMenu();
}

function renderMockQuiz() {
  const st = fullMockState;
  const q = st.qs[st.qIdx];
  renderOneQuiz(q, {
    label: `📝 フル模試 択一 ${st.qIdx + 1}/${st.qs.length}`,
    onScored: (ok) => {
      if (ok) st.qOk++;
    },
    next: () => {
      st.qIdx++;
      if (st.qIdx >= st.qs.length) renderMockWritten();
      else renderMockQuiz();
    },
  });
}

function renderMockWritten() {
  const st = fullMockState;
  if (st.wIdx >= st.wIds.length) return renderFullMockResult();
  renderWritten(st.wIds[st.wIdx], {
    mock: true,
    onDone: (score, total) => {
      st.wScores.push({ score, total });
      st.wIdx++;
      renderMockWritten();
    },
  });
}

function renderFullMockResult() {
  const st = fullMockState;
  fullMockState = null;
  const tm = document.getElementById("mockTimer");
  if (tm) tm.remove();
  const qPts = (st.qOk * 2.5).toFixed(1);
  const wScore = st.wScores.reduce((a, b) => a + b.score, 0);
  const wMax = st.wScores.reduce((a, b) => a + b.total, 0);
  const usedMin = Math.round((Date.now() - st.start) / 60000);
  view.innerHTML = `
    <div class="card" style="text-align:center">
      <div class="kicker">📝 本番フル模試 結果</div>
      <div style="font-size:15px;margin:6px 0">所要 約${usedMin}分 / 150分</div>
      <div class="statgrid">
        <div class="stat"><div class="v">${st.qOk}<span style="font-size:14px;font-weight:400">/20</span></div><div class="l">択一（${qPts}点換算）</div></div>
        <div class="stat"><div class="v">${wScore}<span style="font-size:14px;font-weight:400">/${wMax}</span></div><div class="l">記述（配点換算）</div></div>
      </div>
      <p class="muted small" style="margin-top:8px">択一は1問2.5点（基準点の目安32.5点）。記述は申請書・計算の穴埋め正答数です（作図・記述の質は本番採点と異なります）。</p>
      <button class="btn" id="againBtn">もう一度フル模試</button>
      <button class="btn secondary" id="menuBtn">メニューへ戻る</button>
    </div>`;
  document.getElementById("againBtn").addEventListener("click", startFullMock);
  document.getElementById("menuBtn").addEventListener("click", renderQuizMenu);
}

// ─────────── 計算道場 ───────────
// 関数電卓の安全な式評価。ボタンで組んだ式（÷×−√π・sin/cos/tan）だけを受け付ける。
// 三角関数は度。許可文字以外が混じる式は null（評価しない）。
function evalCalc(disp) {
  let e = disp
    .replace(/÷/g, "/")
    .replace(/×/g, "*")
    .replace(/−/g, "-")
    .replace(/√/g, "SQRT")
    .replace(/π/g, "PI")
    .replace(/sin/g, "SIN")
    .replace(/cos/g, "COS")
    .replace(/tan/g, "TAN");
  if (!e.trim()) return null;
  // 数字・小数点・四則・括弧・空白と、置換後の関数名の文字(SINCOTAQRP)のみ許可
  if (/[^0-9.+\-*/()\sSINCOTAQRP]/.test(e)) return null;
  try {
    const f = new Function(
      "SIN",
      "COS",
      "TAN",
      "SQRT",
      "PI",
      '"use strict";return (' + e + ");",
    );
    const r = f(
      (x) => Math.sin((x * Math.PI) / 180),
      (x) => Math.cos((x * Math.PI) / 180),
      (x) => Math.tan((x * Math.PI) / 180),
      Math.sqrt,
      Math.PI,
    );
    return typeof r === "number" && isFinite(r) ? r : null;
  } catch (_) {
    return null;
  }
}
function fmtNum(r) {
  // 浮動小数の誤差を丸めて、整数はそのまま・小数は最大8桁で表示
  const v = parseFloat(r.toPrecision(12));
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 1e8) / 1e8);
}

// 度→度分秒の分解と整形（秒は小数2桁・繰り上げ処理つき）
function dmsPartsOf(x) {
  const sign = x < 0 ? "-" : "";
  const v = Math.abs(x);
  let d = Math.floor(v);
  let m = Math.floor((v - d) * 60);
  let s = Math.round(((v - d) * 60 - m) * 60 * 100) / 100;
  if (s >= 60) {
    s -= 60;
    m += 1;
  }
  if (m >= 60) {
    m -= 60;
    d += 1;
  }
  return { sign, d, m, s };
}
function degToDms(x) {
  const p = dmsPartsOf(x);
  return `${p.sign}${p.d}° ${p.m}′ ${p.s}″`;
}

// ── 複素数（カシオ fx-JP500 複素数モード相当）。X=実部・Y=虚部、∠は度。──
function Cx(re, im) {
  return { re: re, im: im || 0 };
}
const CxOps = {
  add: (a, b) => Cx(a.re + b.re, a.im + b.im),
  sub: (a, b) => Cx(a.re - b.re, a.im - b.im),
  mul: (a, b) => Cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re),
  div: (a, b) => {
    const d = b.re * b.re + b.im * b.im;
    return Cx((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
  },
};
// 複素数式を再帰下降で評価。i・∠（極形式）・四則・括弧・暗黙の乗算に対応。
function evalCx(str) {
  const s = str
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/π/g, String(Math.PI));
  const toks = s.match(/Conjg|Re|Im|\d+\.?\d*|\.\d+|[+\-*/()i∠]/g);
  if (!toks) return null;
  let pos = 0;
  const peek = () => toks[pos];
  const isNum = (t) => t && /[\d.]/.test(t[0]);
  function expr() {
    let v = term();
    while (peek() === "+" || peek() === "-") {
      const op = toks[pos++];
      const t = term();
      v = op === "+" ? CxOps.add(v, t) : CxOps.sub(v, t);
    }
    return v;
  }
  function term() {
    let v = unary();
    while (true) {
      const p = peek();
      if (p === "*" || p === "/") {
        pos++;
        const u = unary();
        v = p === "*" ? CxOps.mul(v, u) : CxOps.div(v, u);
      } else if (p === "(" || p === "i" || isNum(p)) {
        v = CxOps.mul(v, unary()); // 暗黙の乗算（例: 4i, 2(3+i)）
      } else break;
    }
    return v;
  }
  function unary() {
    if (peek() === "-") {
      pos++;
      return CxOps.mul(Cx(-1, 0), unary());
    }
    if (peek() === "+") {
      pos++;
      return unary();
    }
    return polar();
  }
  function polar() {
    const v = primary();
    if (peek() === "∠") {
      pos++;
      const ang = primary();
      const t = (ang.re * Math.PI) / 180;
      return Cx(v.re * Math.cos(t), v.re * Math.sin(t));
    }
    return v;
  }
  function primary() {
    const p = peek();
    if (p === "(") {
      pos++;
      const v = expr();
      if (peek() === ")") pos++;
      return v;
    }
    if (p === "i") {
      pos++;
      return Cx(0, 1);
    }
    if (p === "∠") {
      pos++;
      const ang = primary();
      const t = (ang.re * Math.PI) / 180;
      return Cx(Math.cos(t), Math.sin(t));
    }
    if (p === "Conjg" || p === "Re" || p === "Im") {
      pos++;
      let arg;
      if (peek() === "(") {
        pos++;
        arg = expr();
        if (peek() === ")") pos++;
      } else arg = primary();
      if (p === "Conjg") return Cx(arg.re, -arg.im);
      if (p === "Re") return Cx(arg.re, 0);
      return Cx(arg.im, 0); // Im: 虚部を実数として返す
    }
    if (isNum(p)) {
      pos++;
      return Cx(parseFloat(p), 0);
    }
    throw new Error("parse");
  }
  try {
    const r = expr();
    if (pos < toks.length) return null;
    if (!isFinite(r.re) || !isFinite(r.im)) return null;
    return r;
  } catch (_) {
    return null;
  }
}
// 複素数の直交形式・極形式（方向角は0〜360度）を整形
function fmtCx(z) {
  const reZ = Math.abs(z.re) < 1e-9,
    imZ = Math.abs(z.im) < 1e-9;
  let rect;
  if (imZ) rect = fmtNum(z.re);
  else if (reZ) rect = fmtNum(z.im) + "i";
  else
    rect =
      fmtNum(z.re) + (z.im >= 0 ? " + " : " - ") + fmtNum(Math.abs(z.im)) + "i";
  const r = Math.hypot(z.re, z.im);
  const az = ((((Math.atan2(z.im, z.re) * 180) / Math.PI) % 360) + 360) % 360;
  return { rect, r: fmtNum(r), theta: fmtNum(az), dms: degToDms(az) };
}

// 連立一次方程式（n=2,3）。ガウス・ジョルダン消去。一意でなければ null。
function solveLinear(A, b) {
  const n = b.length;
  const M = A.map((row, i) => row.concat([b[i]]));
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++)
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-10) return null;
    [M[col], M[piv]] = [M[piv], M[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

// 電卓の描画先（フルページの view か、計算問題に重ねるオーバーレイ）。
// calcBody* / wireKeypad はこの calcHost を基準に DOM を引く。
let calcHost = null;
function renderCalculator(mode, host, embedded) {
  calcHost = host || view;
  mode = mode || "std";
  calcHost.innerHTML = `
    ${embedded ? "" : '<button class="back" id="backBtn">← 計算道場メニュー</button>'}
    <h2 style="font-size:15px;margin:4px">関数電卓</h2>
    <div class="seg seg-wide" id="calcModeSeg" style="margin:2px 4px 10px">
      <button data-mode="std" class="${mode === "std" ? "active" : ""}">標準</button>
      <button data-mode="cmplx" class="${mode === "cmplx" ? "active" : ""}">複素数</button>
      <button data-mode="eqn" class="${mode === "eqn" ? "active" : ""}">連立方程式</button>
    </div>
    <div id="calcBody"></div>`;
  if (!embedded)
    document
      .getElementById("backBtn")
      .addEventListener("click", renderCalcMenu);
  calcHost
    .querySelectorAll("#calcModeSeg button")
    .forEach((b) =>
      b.addEventListener("click", () =>
        renderCalculator(b.dataset.mode, calcHost, embedded),
      ),
    );
  if (mode === "cmplx") calcBodyCmplx();
  else if (mode === "eqn") calcBodyEqn(2);
  else calcBodyStd();
}

// 電卓をオーバーレイで開く（計算問題・記述式を解きながら使える）
function openCalcOverlay() {
  let ov = document.getElementById("calcOverlay");
  if (!ov) {
    ov = document.createElement("div");
    ov.id = "calcOverlay";
    ov.innerHTML = `<div class="calc-modal"><button class="calc-modal-close" id="calcOvClose" aria-label="閉じる">×</button><div id="calcModalBody"></div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener("click", (e) => {
      if (e.target === ov) ov.style.display = "none";
    });
    document
      .getElementById("calcOvClose")
      .addEventListener("click", () => (ov.style.display = "none"));
  }
  ov.style.display = "flex";
  renderCalculator("std", document.getElementById("calcModalBody"), true);
}

// 共通: 表示式を組み立てるキーパッドの配線（評価関数は呼び出し側が渡す）
function wireKeypad(onEquals) {
  const disp = document.getElementById("calcDisp");
  const res = document.getElementById("calcRes");
  document.querySelectorAll("#calcBody .calc-key").forEach((b) =>
    b.addEventListener("click", () => {
      const k = b.dataset.k;
      if (k === "AC") {
        disp.value = "";
        res.innerHTML = "";
      } else if (k === "←") {
        disp.value = disp.value.slice(0, -1);
      } else if (k === "=") {
        onEquals(disp, res);
      } else {
        disp.value += ["sin", "cos", "tan", "√"].includes(k) ? k + "(" : k;
      }
    }),
  );
}

function calcBodyStd() {
  const KEYS = [
    "AC",
    "←",
    "(",
    ")",
    "sin",
    "cos",
    "tan",
    "√",
    "7",
    "8",
    "9",
    "÷",
    "4",
    "5",
    "6",
    "×",
    "1",
    "2",
    "3",
    "−",
    "0",
    ".",
    "π",
    "+",
    "=",
  ];
  const ops = ["÷", "×", "−", "+"];
  document.getElementById("calcBody").innerHTML = `
    <p class="muted small" style="margin:0 4px 10px"><b>三角関数は度(°)</b>で計算します（例: sin(30) = 0.5）。</p>
    <div class="card">
      <input type="text" id="calcDisp" class="calc-disp" readonly value="" aria-label="式">
      <div id="calcRes" class="calc-res"></div>
      <div class="calc-pad">
        ${KEYS.map((k) => `<button class="calc-key${k === "=" ? " eq" : ""}${ops.includes(k) ? " op" : ""}${["sin", "cos", "tan", "√", "π"].includes(k) ? " fn" : ""}" data-k="${k}">${k}</button>`).join("")}
      </div>
      <button class="btn ghost" id="ansToDms" style="margin-top:9px">答え（度）を度分秒に変換</button>
    </div>
    <div class="card">
      <h2>度分秒 ⇄ 十進度</h2>
      <p class="muted small">測量の角度は度分秒。計算では十進度に直して使います。</p>
      <div class="set-row"><span>度 / 分 / 秒</span>
        <span><input id="dmsD" class="dms-in" inputmode="numeric" placeholder="度"><input id="dmsM" class="dms-in" inputmode="numeric" placeholder="分"><input id="dmsS" class="dms-in" inputmode="decimal" placeholder="秒"></span>
      </div>
      <button class="btn secondary" id="toDec" style="margin-top:2px">度分秒 → 十進度</button>
      <div class="set-row" style="margin-top:12px"><span>十進度</span><input id="decDeg" class="dms-in wide" inputmode="decimal" placeholder="例: 123.456789"></div>
      <button class="btn secondary" id="toDms" style="margin-top:2px">十進度 → 度分秒</button>
      <div id="dmsOut" class="expl" style="display:none"></div>
    </div>`;
  wireKeypad((disp, res) => {
    const r = evalCalc(disp.value);
    if (r === null) {
      res.textContent = "式を確認してください";
    } else {
      res.textContent = "= " + fmtNum(r);
      disp.value = fmtNum(r);
    }
  });
  document.getElementById("ansToDms").addEventListener("click", () => {
    const disp = document.getElementById("calcDisp");
    const res = document.getElementById("calcRes");
    const v = evalCalc(disp.value);
    if (v === null) {
      res.textContent = "数値を確認してください";
      return;
    }
    res.innerHTML = `<b>${fmtNum(v)}°</b> ＝ <b>${degToDms(v)}</b>`;
  });
  const out = document.getElementById("dmsOut");
  const showOut = (html) => {
    out.style.display = "";
    out.innerHTML = html;
  };
  document.getElementById("toDec").addEventListener("click", () => {
    const D = Number(document.getElementById("dmsD").value) || 0;
    const M = Number(document.getElementById("dmsM").value) || 0;
    const S = Number(document.getElementById("dmsS").value) || 0;
    const dec = (D < 0 ? -1 : 1) * (Math.abs(D) + M / 60 + S / 3600);
    document.getElementById("decDeg").value = fmtNum(dec);
    showOut(`${D}° ${M}′ ${S}″ ＝ <b>${fmtNum(dec)}°</b>（十進度）`);
  });
  document.getElementById("toDms").addEventListener("click", () => {
    const x = Number(document.getElementById("decDeg").value);
    if (!isFinite(x)) {
      showOut("十進度の数値を入力してください。");
      return;
    }
    const p = dmsPartsOf(x);
    document.getElementById("dmsD").value = p.sign + p.d;
    document.getElementById("dmsM").value = p.m;
    document.getElementById("dmsS").value = p.s;
    showOut(`<b>${fmtNum(x)}°</b> ＝ ${degToDms(x)}`);
  });
}

function calcBodyCmplx() {
  const KEYS = [
    "AC",
    "←",
    "(",
    ")",
    "7",
    "8",
    "9",
    "÷",
    "4",
    "5",
    "6",
    "×",
    "1",
    "2",
    "3",
    "−",
    "0",
    ".",
    "i",
    "+",
    "∠",
    "=",
  ];
  const ops = ["÷", "×", "−", "+"];
  document.getElementById("calcBody").innerHTML = `
    <p class="muted small" style="margin:0 4px 10px">カシオ複素数モード相当。<b>X=実部・Y=虚部</b>、<b>∠＝方向角(度)</b>。<br>放射計算: <code>既知点 ＋ 距離∠方向角</code>　逆計算: <code>(新点−既知点)</code> を = して極形式 r∠θ を読む。</p>
    <div class="card">
      <input type="text" id="calcDisp" class="calc-disp" readonly value="" aria-label="複素数式" placeholder="例: 100+200i + 50∠30">
      <div id="calcRes" class="calc-res"></div>
      <div class="optn-row">
        <button class="chip" data-fn="Conjg(">Conjg(</button>
        <button class="chip" data-fn="Re(">Re(</button>
        <button class="chip" data-fn="Im(">Im(</button>
        <button class="chip" data-conv="polar">▸r∠θ</button>
        <button class="chip" data-conv="rect">▸a+bi</button>
        <button class="chip" data-conv="dms">→度分秒</button>
      </div>
      <div class="calc-pad">
        ${KEYS.map((k) => `<button class="calc-key${k === "=" ? " eq3" : ""}${ops.includes(k) ? " op" : ""}${["i", "∠"].includes(k) ? " fn" : ""}" data-k="${k}">${k}</button>`).join("")}
      </div>
    </div>`;
  wireKeypad((disp, res) => {
    const z = evalCx(disp.value);
    if (!z) {
      res.innerHTML = "式を確認してください";
      return;
    }
    const f = fmtCx(z);
    res.innerHTML = `直交 X,Y: <b>${f.rect}</b><br>極 r∠θ: <b>${f.r} ∠ ${f.theta}°</b>　<span class="muted">(${f.dms})</span>`;
    disp.value = f.rect;
  });
  calcHost.querySelectorAll(".optn-row [data-fn]").forEach((b) =>
    b.addEventListener("click", () => {
      document.getElementById("calcDisp").value += b.dataset.fn;
    }),
  );
  calcHost
    .querySelectorAll(".optn-row [data-conv]")
    .forEach((b) =>
      b.addEventListener("click", () => cmplxConvert(b.dataset.conv)),
    );
}

// 複素数モードの表示変換（▸r∠θ / ▸a+bi / →度分秒）。現在の式を評価して整形する。
function cmplxConvert(form) {
  const disp = document.getElementById("calcDisp");
  const res = document.getElementById("calcRes");
  if (!disp) return;
  const z = evalCx(disp.value);
  if (!z) {
    res.innerHTML = "式を確認してください";
    return;
  }
  const f = fmtCx(z);
  if (form === "polar") {
    disp.value = f.r + "∠" + f.theta;
    res.innerHTML = `極 r∠θ: <b>${f.r} ∠ ${f.theta}°</b>　<span class="muted">(${f.dms})</span>`;
  } else if (form === "rect") {
    disp.value = f.rect;
    res.innerHTML = `直交 X,Y: <b>${f.rect}</b>`;
  } else {
    res.innerHTML = `方向角 θ = <b>${f.theta}°</b> ＝ <b>${f.dms}</b>`;
  }
}

function calcBodyEqn(n) {
  n = n || 2;
  const vars = ["x", "y", "z"].slice(0, n);
  let rows = "";
  for (let r = 0; r < n; r++) {
    let cells = "";
    for (let c = 0; c < n; c++)
      cells += `<input class="eqn-in" id="eq_${r}_${c}" autocomplete="off"><span class="eqn-var">${vars[c]}</span>${c < n - 1 ? '<span class="eqn-op">+</span>' : ""}`;
    rows += `<div class="eqn-row">${cells}<span class="eqn-op">=</span><input class="eqn-in" id="eq_${r}_${n}" autocomplete="off"></div>`;
  }
  document.getElementById("calcBody").innerHTML = `
    <div class="seg" id="eqnNSeg" style="margin:0 4px 10px">
      <button data-n="2" class="${n === 2 ? "active" : ""}">2元</button>
      <button data-n="3" class="${n === 3 ? "active" : ""}">3元</button>
    </div>
    <div class="card">
      <p class="muted small">各係数を入力して解きます（一次・実数）。空欄は0。係数に <code>sin(30)</code> などの式も入力できます。</p>
      ${rows}
      <button class="btn" id="eqnSolve">解く</button>
      <div id="eqnOut" class="expl" style="display:none"></div>
      <button class="btn ghost" id="eqnToDms" style="display:none;margin-top:8px">答えを度分秒に変換</button>
    </div>`;
  calcHost
    .querySelectorAll("#eqnNSeg button")
    .forEach((b) =>
      b.addEventListener("click", () => calcBodyEqn(+b.dataset.n)),
    );
  const coef = (id) => {
    const raw = document.getElementById(id).value.trim();
    if (!raw) return 0;
    const v = evalCalc(raw); // sin(30) などの式も可
    return v === null ? Number(raw) || 0 : v;
  };
  document.getElementById("eqnSolve").addEventListener("click", () => {
    const A = [],
      bb = [];
    for (let r = 0; r < n; r++) {
      const row = [];
      for (let c = 0; c < n; c++) row.push(coef(`eq_${r}_${c}`));
      A.push(row);
      bb.push(coef(`eq_${r}_${n}`));
    }
    const out = document.getElementById("eqnOut");
    const dmsBtn = document.getElementById("eqnToDms");
    out.style.display = "";
    const sol = solveLinear(A, bb);
    if (sol) {
      out.innerHTML = sol
        .map((v, i) => `<b>${vars[i]} = ${fmtNum(v)}</b>`)
        .join("　");
      dmsBtn.style.display = "";
      dmsBtn.onclick = () => {
        out.innerHTML = sol
          .map(
            (v, i) =>
              `<b>${vars[i]} = ${fmtNum(v)}</b> <span class="muted">(${degToDms(v)})</span>`,
          )
          .join("<br>");
      };
    } else {
      out.innerHTML = "解が一意に定まりません（係数行列が特異）。";
      dmsBtn.style.display = "none";
    }
  });
}

function renderCalcMenu() {
  const d = Store.load();
  view.innerHTML =
    `<h2 style="font-size:15px;margin:4px">計算道場（無限自動生成）</h2>
    <p class="muted small" style="margin:0 4px 10px">毎日30分。問題は無限に自動生成される。関数電卓の <b>Pol/Rec</b>（または複素数モード）を使って解くこと（→ガイド「関数電卓の必須機能」）。</p>
    <div class="card clickable" data-guide-open="1" style="border:1px solid var(--accent-deep)">
      <b style="color:var(--accent)">📚 計算手法ガイド</b>
      <div class="muted small">各計算を「複素数／関数電卓／手計算」の3通りで詳解（公式・図解つき）</div>
    </div>
    <div class="card clickable" data-calc-mix="1" style="border:1px solid var(--accent-deep)">
      <b style="color:var(--accent)">🔀 種目ごちゃ混ぜ（インターリービング）</b>
      <div class="muted small">毎問ランダムに別の種目を出題。「どの解法を使うか」を見抜く力が鍛わり、本試験に直結（研究で効果実証）</div>
    </div>
    <div class="card clickable" data-calc-tool="1" style="border:1px solid var(--accent-deep)">
      <b style="color:var(--accent)">🔢 関数電卓・度分秒変換</b>
      <div class="muted small">三角関数(度)・√の計算と、度分秒⇄十進度の相互変換。スキマ計算に。</div>
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
  view
    .querySelector("[data-calc-mix]")
    .addEventListener("click", () => renderCalcProblem("__mix__"));
  view
    .querySelector("[data-calc-tool]")
    .addEventListener("click", renderCalculator);
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
      (c, ci) => `
      <h3>${/^例題/.test(c.title) ? "" : `📝 例題${ci + 1}　`}${esc(c.title)}</h3>
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
  // "__mix__" は種目をまぜるインターリービング: 毎問ランダムに別種目を出す
  const isMix = type === "__mix__";
  const realType = isMix
    ? CALC_TYPES[Math.floor(Math.random() * CALC_TYPES.length)]
    : type;
  const gen = CalcGen[realType];
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
      ${isMix ? '<span class="tag">🔀 ごちゃ混ぜ</span>' : ""}
      <h2>${esc(gen.name)}</h2>
      ${prob.html}
      ${fieldsHtml}
      <button class="btn" id="checkBtn">答え合わせ</button>
      <div id="resultBox"></div>
      <div class="btn-row">
        <button class="btn secondary" id="nextProb">次の問題</button>
      </div>
    </div>
    <button class="calc-fab" id="calcFab" title="電卓を開く">🔢</button>`;
  document.getElementById("backBtn").addEventListener("click", renderCalcMenu);
  document.getElementById("calcFab").addEventListener("click", openCalcOverlay);
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
    Store.recordCalc(realType, allOk);
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

function renderWritten(id, opts) {
  opts = opts || {};
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
    <button class="back" id="backBtn">${opts.mock ? "← 模試を中断" : "← 記述式一覧"}</button>
    <div class="card">
      <span class="tag">${esc(w.type)}</span><span class="muted small">${esc(w.target)}</span>
      ${opts.mock ? "" : `<span class="w-timer" id="wTimer">⏱ 00:00</span>`}
      <h2 style="margin-top:6px">${esc(w.title)}</h2>
      ${w.statement}
      ${coordsTable}
      <canvas class="fig" id="figCanvas" width="640" height="480"></canvas>
      <p class="muted small">▲ 問題図。紙と三角定規・電卓で作図してから採点してください（採点後に「作図ステップ」で段階確認できます）。</p>
      <hr class="sep">
      <h3>計算問題</h3>
      ${tasksHtml}
      <hr class="sep">
      <h3>登記申請書（穴埋め）</h3>
      ${formHtml}
      <button class="btn" id="gradeBtn">採点する</button>
      <div id="wResult"></div>
    </div>
    <button class="calc-fab" id="calcFab" title="電卓を開く">🔢</button>`;

  document.getElementById("calcFab").addEventListener("click", openCalcOverlay);
  drawFigure(w.figure, 0);
  // 問題文・申請書ヒント中の条文をタップ可能に（土地/建物/区分建物→不登法を既定法令とする）
  linkArticlesInElement(view, defLawForCat(w.type));

  // 経過時間タイマー（標準記述式のみ・フル模試は専用タイマーがあるため省略）
  const targetMin = Number((w.target.match(/(\d+)\s*分/) || [])[1]) || 0;
  const wStart = Date.now();
  const fmtMMSS = (sec) => {
    const m = Math.floor(sec / 60),
      s = sec % 60;
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  };
  let wTimerInt = null;
  if (document.getElementById("wTimer")) {
    wTimerInt = setInterval(() => {
      const el = document.getElementById("wTimer");
      if (!el) {
        clearInterval(wTimerInt);
        return;
      }
      const sec = Math.floor((Date.now() - wStart) / 1000);
      el.textContent = "⏱ " + fmtMMSS(sec);
      if (targetMin && sec > targetMin * 60) el.classList.add("over");
    }, 1000);
  }

  document.getElementById("backBtn").addEventListener("click", () => {
    if (wTimerInt) clearInterval(wTimerInt);
    if (opts.mock) {
      if (confirm("フル模試を中断しますか？")) abortFullMock();
    } else renderWrittenList();
  });
  document.getElementById("gradeBtn").addEventListener("click", () => {
    if (wTimerInt) {
      clearInterval(wTimerInt);
      wTimerInt = null;
    }
    const finalSec = Math.floor((Date.now() - wStart) / 1000);
    // 項目別配点（ルーブリック）: 計算は既定2点・申請書は既定1点。データで pts を上書き可。
    let calcGot = 0,
      calcMax = 0,
      formGot = 0,
      formMax = 0;
    w.tasks.forEach((t, i) => {
      const pts = t.pts || 2;
      calcMax += pts;
      const el = document.getElementById(`wt${i}`);
      const v = Number(el.value);
      const ok = el.value !== "" && Math.abs(v - t.answer) <= t.tol;
      if (ok) calcGot += pts;
      el.classList.remove("fld-ok", "fld-ng");
      el.classList.add(ok ? "fld-ok" : "fld-ng");
      document.getElementById(`wtExpl${i}`).innerHTML =
        `<div class="expl">${ok ? "✅ 正解 (+" + pts + "点)" : "❌ 正答: <b>" + t.answer + (t.unit || "") + "</b>"}<br>${t.expl}</div>`;
    });
    // 表記ゆれを許容: 空白・読点・カンマ・「金」を無視、全角英数を半角化。
    const norm = (s) =>
      String(s)
        .replace(/[\s,，、。･・金]/g, "")
        .replace(/[０-９Ａ-Ｚａ-ｚ]/g, (ch) =>
          String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
        )
        .toLowerCase();
    w.appForm.forEach((f, i) => {
      const pts = f.pts || 1;
      formMax += pts;
      const el = document.getElementById(`wf${i}`);
      // answer は文字列または「許容解の配列」。いずれかに一致すれば正解。
      const accepts = Array.isArray(f.answer) ? f.answer : [f.answer];
      const ok = accepts.some((a) => norm(el.value) === norm(a));
      if (ok) formGot += pts;
      el.classList.remove("fld-ok", "fld-ng");
      el.classList.add(ok ? "fld-ok" : "fld-ng");
      document.getElementById(`wfExpl${i}`).innerHTML = ok
        ? ""
        : `<div class="expl">正答: <b>${esc(accepts[0])}</b>${accepts.length > 1 ? `（他に「${accepts.slice(1).map(esc).join("」「")}」も可）` : ""}</div>`;
    });
    const score = calcGot + formGot;
    const total = calcMax + formMax;
    Store.recordWritten(w.id, score, total, { sec: finalSec });
    updateStreak();
    drawFigure(w.figure, 3);
    const pct = total ? Math.round((score / total) * 100) : 0;
    let timeNote;
    if (targetMin) {
      const over = finalSec - targetMin * 60;
      timeNote =
        over <= 0
          ? `<span class="ok-text">⏱ ${fmtMMSS(finalSec)}（目標${targetMin}分以内 ✓）</span>`
          : `<span class="ng-text">⏱ ${fmtMMSS(finalSec)}（目標${targetMin}分を ${Math.ceil(over / 60)}分 超過）</span>`;
    } else {
      timeNote = `⏱ ${fmtMMSS(finalSec)}`;
    }
    const pctBar = (g, m) => (m ? Math.round((g / m) * 100) : 0);
    document.getElementById("wResult").innerHTML = `
      <div class="card" style="margin-top:12px;background:var(--surface2)">
        <div style="text-align:center">
          <div style="font-size:28px;font-weight:800">${score} / ${total}点 <span class="muted" style="font-size:16px">(${pct}%)</span></div>
          <div style="margin-top:2px">${timeNote}</div>
        </div>
        <div class="score-breakdown">
          <div class="sb-row"><span>計算・求積</span><span>${calcGot} / ${calcMax}点</span></div>
          <div class="sb-bar"><div style="width:${pctBar(calcGot, calcMax)}%"></div></div>
          <div class="sb-row"><span>申請書</span><span>${formGot} / ${formMax}点</span></div>
          <div class="sb-bar"><div style="width:${pctBar(formGot, formMax)}%"></div></div>
        </div>
        <div class="fig-steps" id="figSteps">
          <span class="muted small">作図ステップ:</span>
          <button class="chip" data-fl="0">①問題図</button>
          <button class="chip" data-fl="1">②測点</button>
          <button class="chip" data-fl="2">③分筆線</button>
          <button class="chip active" data-fl="3">④求積</button>
        </div>
        <p class="muted small">自分の紙の作図とステップで見比べてください。${opts.mock ? "" : "配点は本番に近づけた目安（計算重視）です。"}</p>
        ${opts.mock ? '<button class="btn" id="mockWNext">記述採点を記録して次へ ▶</button>' : ""}
      </div>`;
    // 作図ステップ切替
    view.querySelectorAll("#figSteps .chip").forEach((b) =>
      b.addEventListener("click", () => {
        view
          .querySelectorAll("#figSteps .chip")
          .forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        drawFigure(w.figure, Number(b.dataset.fl));
        document
          .getElementById("figCanvas")
          .scrollIntoView({ block: "center" });
      }),
    );
    // 解説中の条文もタップ可能に
    view
      .querySelectorAll('[id^="wtExpl"], [id^="wfExpl"]')
      .forEach((el) => linkArticlesInElement(el, defLawForCat(w.type)));
    if (opts.mock)
      document
        .getElementById("mockWNext")
        .addEventListener("click", () => opts.onDone(score, total));
  });
}

// 作図レンダラー（X=北を上、Y=東を右に描画）
// level: 0=問題図(筆界+既知点) / 1=+交点(測点プロット) / 2=+分筆線 / 3=完成(求積ラベル)
// 後方互換: reveal===false→0, reveal===true→3
function drawFigure(fig, reveal) {
  const level = reveal === true ? 3 : reveal === false ? 0 : reveal || 0;
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

  // 補助線（分筆線等）— level2以降
  if (level >= 2) {
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
  }
  // 求積（面積ラベル）— level3（完成）のみ
  if (level >= 3) {
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

  // 点（交点等の revealPoints は level1 以降で表示）
  for (const n of names) {
    const hidden = level < 1 && (fig.revealPoints || []).includes(n);
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
// ─────────── 間違いノート ───────────
function renderMistakeNotebook() {
  const items = Store.mistakeItems();
  const reasonTag = (r) =>
    `<span class="tag ${r === "過信" ? "ng" : r === "SRSで苦戦" ? "warn" : ""}">${esc(r)}</span>`;
  const rows = items
    .map((m) => {
      const it = m.item;
      const stmt = m.kind === "flash" ? it.s : it.q;
      const ans =
        m.kind === "flash"
          ? `答え: <b>${it.a ? "○" : "×"}</b><br>${it.expl}`
          : `正答: <b>${it.answer + 1}</b><br>${it.expl}`;
      return `<div class="card" style="padding:13px 14px">
        <div>${m.kind === "flash" ? '<span class="tag warn">一問一答</span>' : '<span class="tag">択一</span>'}<span class="tag">${esc(it.cat)}</span>${m.reasons.map(reasonTag).join("")}</div>
        <div style="margin-top:6px;font-size:14px">${esc(stmt)}</div>
        <details style="margin-top:6px"><summary class="muted small">答え・解説を見る</summary><div class="expl" data-deflaw="${esc(it.cat)}">${ans}</div></details>
        <textarea class="memo" data-kind="${m.kind}" data-id="${it.id}" placeholder="📝 メモ（なぜ間違えた？覚え方は？）">${esc(m.memo)}</textarea>
      </div>`;
    })
    .join("");
  view.innerHTML = `
    <button class="back" id="backBtn">← 進捗へ</button>
    <h2 style="font-size:15px;margin:4px">📓 間違いノート（${items.length}件）</h2>
    <p class="muted small" style="margin:0 4px 10px">弱点（不正解先行）・過信（自信あり×不正解）・SRSで苦戦中の問題を集約。メモを残し、まとめて復習できます。</p>
    ${
      items.length
        ? `<button class="btn" id="reviewAllBtn">この${Math.min(items.length, 20)}件をまとめて復習</button>` +
          rows
        : '<div class="card"><p class="muted small">まだ間違いはありません 🎉 演習を進めると、弱点や「自信あったのに外した」問題がここに集まります。</p></div>'
    }`;
  document
    .getElementById("backBtn")
    .addEventListener("click", () => gotoTab("progress"));
  const rb = document.getElementById("reviewAllBtn");
  if (rb)
    rb.addEventListener("click", () =>
      startMix(items.slice(0, 20).map((m) => ({ kind: m.kind, item: m.item }))),
    );
  view
    .querySelectorAll(".expl[data-deflaw]")
    .forEach((el) =>
      linkArticlesInElement(el, defLawForCat(el.dataset.deflaw)),
    );
  view
    .querySelectorAll("textarea.memo")
    .forEach((t) =>
      t.addEventListener("change", () =>
        Store.setMemo(t.dataset.kind, t.dataset.id, t.value),
      ),
    );
}

// ─────────── バックアップUI ───────────
function doExportBackup(area) {
  const json = Store.exportJSON();
  area.innerHTML = `
    <p class="muted small" style="margin-top:10px">下のテキストをコピーするか、ファイルに保存して保管してください。</p>
    <textarea class="memo" id="bkText" readonly style="height:110px">${esc(json)}</textarea>
    <div class="btn-row">
      <button class="btn secondary" id="bkCopy" style="margin-top:8px">コピー</button>
      <button class="btn secondary" id="bkDownload" style="margin-top:8px">ファイルで保存</button>
    </div>`;
  document.getElementById("bkCopy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(json);
    } catch (e) {
      const ta = document.getElementById("bkText");
      ta.select();
      document.execCommand("copy");
    }
    document.getElementById("bkCopy").textContent = "コピーしました ✓";
  });
  document.getElementById("bkDownload").addEventListener("click", () => {
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `chousashi-dojo-backup-${Store.today()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}

function doImportBackup(area) {
  area.innerHTML = `
    <p class="muted small" style="margin-top:10px">⚠️ 復元すると今の進捗は<b>上書き</b>されます。バックアップのJSONを貼り付けるか、ファイルを選んでください。</p>
    <input type="file" id="bkFile" accept="application/json,.json" style="margin:6px 0">
    <textarea class="memo" id="bkImportText" placeholder="ここにバックアップJSONを貼り付け" style="height:100px"></textarea>
    <button class="btn" id="bkRestore" style="margin-top:8px">復元する</button>
    <div id="bkMsg" class="small" style="margin-top:6px"></div>`;
  const fileEl = document.getElementById("bkFile");
  fileEl.addEventListener("change", () => {
    const f = fileEl.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      document.getElementById("bkImportText").value = r.result;
    };
    r.readAsText(f);
  });
  document.getElementById("bkRestore").addEventListener("click", () => {
    const txt = document.getElementById("bkImportText").value;
    const msg = document.getElementById("bkMsg");
    if (!txt.trim()) {
      msg.innerHTML = '<span style="color:var(--ng)">JSONが空です。</span>';
      return;
    }
    if (!confirm("今の進捗を上書きして復元します。よろしいですか？")) return;
    const res = Store.importJSON(txt);
    if (res.ok) {
      msg.innerHTML =
        '<span style="color:var(--ok)">復元しました。再読み込みします…</span>';
      setTimeout(() => location.reload(), 600);
    } else {
      msg.innerHTML = `<span style="color:var(--ng)">${esc(res.error)}</span>`;
    }
  });
}

// 学習推移のミニ棒グラフ（日別・正答=緑/不正解=赤を積み上げ）
function miniTrendChart(series) {
  const W = 320,
    H = 96,
    padX = 2,
    baseY = H - 16,
    top = 6;
  const max = Math.max(1, ...series.map((s) => s.ok + s.ng));
  const bw = (W - padX * 2) / series.length;
  let bars = "";
  series.forEach((s, i) => {
    const tot = s.ok + s.ng;
    const x = padX + i * bw;
    const bh = (tot / max) * (baseY - top);
    const okh = tot ? (s.ok / tot) * bh : 0;
    if (tot) {
      bars += `<rect x="${(x + 1).toFixed(1)}" y="${(baseY - bh).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${(bh - okh).toFixed(1)}" fill="#ef5350"/>`;
      bars += `<rect x="${(x + 1).toFixed(1)}" y="${(baseY - okh).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${okh.toFixed(1)}" fill="#66bb6a"/>`;
    }
    if (i === 0 || i === series.length - 1)
      bars += `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 3}" text-anchor="middle" fill="#8fa0ae" font-size="9">${s.date.slice(5)}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" class="trend-svg"><line x1="0" y1="${baseY}" x2="${W}" y2="${baseY}" stroke="#2e3942"/>${bars}</svg>`;
}

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
  const srs = Store.srsCounts();
  const srsNext = Store.srsNextDue();
  const calib = Store.calibStats();
  const over = Store.overconfidentItems();
  const confTot = calib.co + calib.cx;
  const calibPct = confTot ? Math.round((calib.co / confTot) * 100) : null;
  const mistakeCount = Store.mistakeItems().length;
  // 表示設定
  const fz = localStorage.getItem("fontScale") || "m";
  const theme = localStorage.getItem("theme") || "dark";
  const dailyGoal = Number(localStorage.getItem("dailyGoal")) || 20;
  // 学習推移（直近14日）
  const series = Store.dailySeries(14);
  const seriesTotal = series.reduce((a, s) => a + s.ok + s.ng, 0);
  // 記述式トラッカー（前回得点・ベスト所要時間）
  const fmtSec = (s) =>
    s == null
      ? "—"
      : Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  const writtenDone = WRITTEN.filter((w) => d.written[w.id]).length;
  const writtenRows = WRITTEN.map((w) => {
    const r = d.written[w.id];
    if (!r)
      return `<tr><td>${esc(w.type)}</td><td>${esc(w.title)}</td><td class="num muted">—</td><td class="num muted">—</td></tr>`;
    const pct = r.total ? Math.round((r.score / r.total) * 100) : 0;
    return `<tr><td>${esc(w.type)}</td><td>${esc(w.title)}</td><td class="num">${r.score}/${r.total}<span class="muted" style="font-size:11px">（${pct}%）</span></td><td class="num">${fmtSec(r.bestSec)}</td></tr>`;
  }).join("");
  // 合格予測（択一の実測正答率を 20問×2.5＝50点満点に換算した概算）
  const ansN = totalOk + totalNg;
  const estScore = ansN ? Math.round((totalOk / ansN) * 50 * 10) / 10 : 0;
  const targetScore = 32.5;
  let weakest = null;
  for (const c of QUIZ_CATS) {
    const s = stats[c] || { ok: 0, ng: 0 };
    const t = s.ok + s.ng;
    if (t >= 3) {
      const r = s.ok / t;
      if (!weakest || r < weakest.r) weakest = { c, r };
    }
  }
  const dteP = daysToExam();
  view.innerHTML = `
    <div class="card" style="border:1px solid var(--accent-deep)">
      <h2>🎯 合格予測（択一・実測ベースの概算）</h2>
      <div class="statgrid">
        <div class="stat"><div class="v">${ansN ? estScore : "—"}<span style="font-size:14px;font-weight:400">/50</span></div><div class="l">想定択一得点</div></div>
        <div class="stat"><div class="v">${dteP}</div><div class="l">本試験まで(日)</div></div>
      </div>
      <p class="muted small" style="margin-top:8px">
        ${ansN ? `基準点の目安(${targetScore}点)まで <b style="color:${estScore >= targetScore ? "var(--ok)" : "var(--warn)"}">${estScore >= targetScore ? "到達圏内 🎉" : "あと" + (targetScore - estScore).toFixed(1) + "点"}</b>。` : "択一を解くと予測が表示されます。"}
        ${weakest ? ` 要強化: <b>${esc(weakest.c)}</b>（正答率${Math.round(weakest.r * 100)}%）` : ""}
      </p>
      <p class="muted" style="font-size:11px;margin-top:4px">※ 直近の実測正答率を換算した概算で、合否を保証するものではありません。</p>
    </div>
    <div class="statgrid">
      <div class="stat"><div class="v">${Store.streak()}</div><div class="l">連続学習日数</div></div>
      <div class="stat"><div class="v">${d.days.length}</div><div class="l">累計学習日数</div></div>
      <div class="stat"><div class="v">${totalOk + totalNg}</div><div class="l">択一 解答数</div></div>
      <div class="stat"><div class="v">${totalOk + totalNg ? Math.round((totalOk / (totalOk + totalNg)) * 100) : 0}%</div><div class="l">択一 正答率</div></div>
      <div class="stat"><div class="v">${fOk + fNg}</div><div class="l">一問一答 解答数</div></div>
      <div class="stat"><div class="v">${fOk + fNg ? Math.round((fOk / (fOk + fNg)) * 100) : 0}%</div><div class="l">一問一答 正答率</div></div>
    </div>
    <div class="card" style="margin-top:12px">
      <h2>🧠 間隔反復（SRS）</h2>
      <div class="statgrid">
        <div class="stat"><div class="v">${srs.learned}<span style="font-size:14px;font-weight:400">/${srs.total}</span></div><div class="l">習得カード</div></div>
        <div class="stat"><div class="v">${srs.due}</div><div class="l">今日の期日</div></div>
      </div>
      <p class="muted small" style="margin-top:8px">未学習 ${srs.fresh}枚${srsNext ? `・次の期日 ${srsNext}` : ""}</p>
      ${srs.due + srs.newAvail ? `<button class="btn" id="srsProgGo">今日の${srs.due + srs.newAvail}枚を復習する</button>` : ""}
    </div>
    ${
      confTot + calib.uo + calib.ux > 0 || over.length
        ? `<div class="card" style="margin-top:12px">
      <h2>🎯 自信度キャリブレーション</h2>
      <div class="statgrid">
        <div class="stat"><div class="v">${calibPct === null ? "—" : calibPct + "%"}</div><div class="l">「自信あり」の的中率</div></div>
        <div class="stat"><div class="v">${over.length}</div><div class="l">過信（自信あり×不正解）</div></div>
      </div>
      <p class="muted small" style="margin-top:8px">自信あり ○${calib.co}/×${calib.cx}・自信なし ○${calib.uo}/×${calib.ux}。「自信あったのに外した」項目こそ最大の伸びしろ。</p>
      ${over.length ? `<button class="btn" id="overProgGo">過信の${Math.min(over.length, 20)}問を復習する</button>` : ""}
    </div>`
        : ""
    }
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
      <h2>📈 学習の推移（直近14日）</h2>
      ${
        seriesTotal
          ? miniTrendChart(series) +
            `<p class="muted small" style="text-align:center;margin-top:2px"><span style="color:var(--ok)">■</span> 正答　<span style="color:var(--ng)">■</span> 不正解　／　バーの高さ＝解答数</p>`
          : `<p class="muted small">択一・一問一答・計算を解くと、ここに日別の学習量と正答内訳が積み上がります。</p>`
      }
    </div>
    <div class="card">
      <h2>📝 記述式トラッカー（${writtenDone}/${WRITTEN.length} 着手）</h2>
      <p class="muted small">前回の得点と、自己ベストの所要時間。本番の時間配分づくりに。</p>
      <table class="simple"><tr><th>区分</th><th>問題</th><th>前回</th><th>ベスト</th></tr>${writtenRows}</table>
    </div>
    <div class="card">
      <h2>📓 間違いノート（${mistakeCount}件）</h2>
      <p class="muted small">弱点・過信・SRSで苦戦中の問題を集約。メモを残してまとめて復習できます。</p>
      <button class="btn" id="notebookBtn">${mistakeCount ? "間違いノートを開く" : "間違いノート（まだ空）"}</button>
    </div>
    <div class="card">
      <h2>⚙️ 表示設定</h2>
      <div class="set-row">
        <span>テーマ</span>
        <div class="seg" id="themeSeg">
          <button data-theme="dark" class="${theme === "dark" ? "active" : ""}">🌙 ダーク</button>
          <button data-theme="light" class="${theme === "light" ? "active" : ""}">☀️ ライト</button>
        </div>
      </div>
      <div class="set-row">
        <span>文字サイズ</span>
        <div class="seg" id="fzSeg">
          <button data-fz="s" class="${fz === "s" ? "active" : ""}">小</button>
          <button data-fz="m" class="${fz === "m" ? "active" : ""}">標準</button>
          <button data-fz="l" class="${fz === "l" ? "active" : ""}">大</button>
          <button data-fz="xl" class="${fz === "xl" ? "active" : ""}">特大</button>
        </div>
      </div>
      <div class="set-row">
        <span>1日の目標（問題数）</span>
        <input type="number" id="goalInput" min="1" max="500" value="${dailyGoal}" inputmode="numeric">
      </div>
      <p class="muted small" style="margin-top:4px">今日タブの「今日の目標」バーに反映されます。</p>
    </div>
    <div class="card">
      <h2>💾 データのバックアップ</h2>
      <p class="muted small">学習記録（SRS・連続日数・統計）は<b>この端末内だけ</b>に保存されます。端末変更・データ削除で消えるので、定期的に書き出して保管してください。</p>
      <div class="btn-row">
        <button class="btn" id="bkExportBtn" style="margin-top:0">書き出す</button>
        <button class="btn secondary" id="bkImportBtn" style="margin-top:0">復元する</button>
      </div>
      <div id="bkArea"></div>
      <button class="btn ghost" id="howtoBtn" style="margin-top:10px">📖 アプリの使い方をもう一度見る</button>
    </div>`;
  document
    .getElementById("notebookBtn")
    .addEventListener("click", renderMistakeNotebook);
  document
    .getElementById("bkExportBtn")
    .addEventListener("click", () =>
      doExportBackup(document.getElementById("bkArea")),
    );
  document
    .getElementById("bkImportBtn")
    .addEventListener("click", () =>
      doImportBackup(document.getElementById("bkArea")),
    );
  document.getElementById("howtoBtn").addEventListener("click", showOnboarding);
  view.querySelectorAll("#themeSeg button").forEach((b) =>
    b.addEventListener("click", () => {
      localStorage.setItem("theme", b.dataset.theme);
      applyDisplayPrefs();
      renderProgress();
    }),
  );
  view.querySelectorAll("#fzSeg button").forEach((b) =>
    b.addEventListener("click", () => {
      localStorage.setItem("fontScale", b.dataset.fz);
      applyDisplayPrefs();
      renderProgress();
    }),
  );
  const gi = document.getElementById("goalInput");
  if (gi)
    gi.addEventListener("change", () => {
      const v = Math.max(1, Math.min(500, Number(gi.value) || 20));
      localStorage.setItem("dailyGoal", v);
      gi.value = v;
    });
  const spg = document.getElementById("srsProgGo");
  if (spg) spg.addEventListener("click", startSrs);
  const opg = document.getElementById("overProgGo");
  if (opg)
    opg.addEventListener("click", () => {
      gotoTab("quiz");
      startMix(over.slice(0, 20));
    });
}

// ─────────── スワイプ操作（右で戻る・左で進む） ───────────
// 詳細画面では右スワイプで「戻る」(#backBtn)、左スワイプで「進む」(次の手順/次の問題)。
// ─────────── スワイプ操作 ───────────
// トップレベルのタブ画面 → 左右で下タブを移動 / 詳細画面 → 右=戻る・左=進む。
const TAB_ORDER = ["today", "lecture", "quiz", "calc", "written", "progress"];
function switchTabBy(delta) {
  const active = document.querySelector("#tabBar button.active");
  const cur = active ? TAB_ORDER.indexOf(active.dataset.tab) : 0;
  const next = cur + delta;
  if (next < 0 || next >= TAB_ORDER.length) return; // 端ではラップしない
  gotoTab(TAB_ORDER[next]);
  // スワイプ方向に軽くスライドさせて操作を視覚化
  const v = document.getElementById("view");
  if (v) {
    v.classList.remove("slide-l", "slide-r");
    void v.offsetWidth; // reflow でアニメ再生をリセット
    v.classList.add(delta > 0 ? "slide-l" : "slide-r");
  }
}

(function setupSwipeNav() {
  let sx = 0,
    sy = 0,
    st = 0,
    tracking = false;
  const TH = 50; // 横移動のしきい値(px)
  const isFormEl = (el) =>
    el && el.closest && el.closest("input,textarea,select");
  const tap = (sel) => {
    const el = document.querySelector(sel);
    if (el && !el.disabled && el.offsetParent !== null) {
      el.click();
      return true;
    }
    return false;
  };
  document.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length !== 1 || isFormEl(e.touches[0].target)) {
        tracking = false;
        return;
      }
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      st = Date.now();
      tracking = true;
    },
    { passive: true },
  );
  document.addEventListener(
    "touchend",
    (e) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx,
        dy = t.clientY - sy;
      if (Date.now() - st > 800) return; // ゆっくりは無視
      if (Math.abs(dx) < TH || Math.abs(dx) < Math.abs(dy) * 1.5) return; // 横方向が明確なときだけ
      // 条文ポップアップが開いていれば、スワイプは「閉じる」に充てる
      const ov = document.getElementById("artOverlay");
      if (ov && ov.style.display === "flex") {
        ov.style.display = "none";
        return;
      }
      const right = dx > 0;
      const hasBack = !!document.querySelector("#backBtn");
      const inSession =
        quizState || flashState || mixState || fullMockState || srsState;
      if (hasBack) {
        // 詳細画面: 右=戻る / 左=進む
        if (right) tap("#backBtn") || tap("#patPrev");
        else
          tap("#patNext") ||
            tap("#nextBtn") ||
            tap("#srsNext") ||
            tap("#nextProb");
      } else if (inSession) {
        // 演習中（戻るボタンなし）: 左=次へのみ。右でのタブ移動は誤操作防止のため無効
        if (!right)
          tap("#nextBtn") ||
            tap("#patNext") ||
            tap("#srsNext") ||
            tap("#nextProb");
      } else {
        // トップレベルのタブ画面: 左右で下タブを移動（右=前のタブ / 左=次のタブ）
        switchTabBy(right ? -1 : 1);
      }
    },
    { passive: true },
  );
})();

// ─────────── 初回ガイド（オンボーディング） ───────────
function showOnboarding() {
  const ov = document.createElement("div");
  ov.id = "obOverlay";
  ov.innerHTML = `<div class="ob-card">
      <h2>調査士道場へようこそ 🎉</h2>
      <ul class="ob-list">
        <li>📅 <b>今日</b>タブの「今日のおすすめ」から、いま効く演習に直行できます。</li>
        <li>👉 画面を<b>右スワイプで戻る</b>・左スワイプで次へ進めます。</li>
        <li>🧠 <b>SRS（間隔反復）</b>が、忘れた頃に自動で再出題して記憶を定着させます。</li>
        <li>🔀 <b>ミックス演習</b>で分野・形式をまぜると、本番の得点力が鍛えられます。</li>
        <li>🧪 択一タブの<b>学習法モード</b>で、科学的な強化（アクティブリコール等）と🔊読み上げをオンにできます。</li>
        <li>💾 進捗タブで<b>バックアップ</b>を忘れずに（記録はこの端末内だけに保存されます）。</li>
      </ul>
      <button class="btn" id="obStart">はじめる</button>
    </div>`;
  document.body.appendChild(ov);
  document.getElementById("obStart").addEventListener("click", () => {
    localStorage.setItem("onboarded", "1");
    ov.remove();
  });
}

// 表示設定（文字サイズ・テーマ）を <html> の data 属性に適用する。CSSで切替。
function applyDisplayPrefs() {
  const el = document.documentElement;
  el.dataset.fz = localStorage.getItem("fontScale") || "m";
  el.dataset.theme = localStorage.getItem("theme") || "dark";
}

// 座標系の設定を復元
CalcUtil.coordMode = localStorage.getItem("calcCoordMode") || "local";
applyDisplayPrefs();

// 初期表示
render("today");
if (localStorage.getItem("onboarded") !== "1") showOnboarding();
