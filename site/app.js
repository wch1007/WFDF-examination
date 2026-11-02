import { createAttempt, isValidAttempt, gradeAttempt, chooseAnswer, canVisit } from './exam.js';
import { examView } from './exam-view.js';

const $ = selector => document.querySelector(selector);
const escape = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const lines = s => escape(s).replace(/\n/g, '<br>');
const STORAGE = 'wfdf-rules-lab-v1';
let bank, rules, questionMap, ruleMap, attempt = null, resultFilter = 'wrong', ruleChapter = 'all', ruleSearch = '', pendingConfirm;
let saveWarningShown = false;

function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').classList.remove('visible'), 3800); }
function persist() {
  try { localStorage.setItem(STORAGE, JSON.stringify({ attempt })); }
  catch { if (!saveWarningShown) { toast('无法保存进度，本次仍可正常答题。'); saveWarningShown = true; } }
}
function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE) || '{}');
    if (isValidAttempt(saved.attempt, bank)) attempt = saved.attempt;
  } catch { /* A broken or unavailable browser store must not prevent a new exam. */ }
}
function chapterName(id) { return rules.chapters.find(c => c.id === id)?.title || ''; }
function countAnswered(a = attempt) { return a?.items.filter(i => i.answer !== null).length || 0; }
function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
function button(action, text, klass = 'primary', extra = '') { return `<button class="button ${klass}" data-action="${action}" ${extra}>${text}</button>`; }
function title(eyebrow, heading, description = '') { return `<div class="page-heading"><p class="eyebrow">${eyebrow}</p><h1>${heading}</h1>${description ? `<p class="page-description">${description}</p>` : ''}</div>`; }

function home() {
  const unfinished = attempt && attempt.completedAt === null;
  return `<section class="hero"><div class="hero-copy"><p class="eyebrow">WFDF 2025–2028</p><h1>飞盘规则考试</h1><p class="hero-description">25 道比赛情境题，选完即看答案。</p><div class="hero-links"><a class="text-link" href="#rules">查阅全部规则 ↗</a><a class="text-link muted" href="./assets/wfdf-2025-2028-zh.pdf" download>中文规则 PDF ↓</a></div></div><aside class="start-card"><div class="start-top"><span>随机考试</span><span class="pill">单选题</span></div><div class="field-art" aria-hidden="true"><div class="field-line one"></div><div class="field-line two"></div><span class="brick left">+</span><span class="brick right">+</span><span class="disc-flight"></span><span class="flight-path"></span></div><div class="exam-spec"><div><strong>25<small>题</small></strong><span>随机抽题</span></div><div><strong>100<small>分</small></strong><span>每题 4 分</span></div><div><strong>20<small>章</small></strong><span>覆盖全部章节</span></div></div>${button(unfinished ? 'resume' : 'start', unfinished ? `继续答题 · ${countAnswered()} / 25 →` : '开始考试 →', 'lime full')}${unfinished ? button('new', '重新抽题', 'plain full') : attempt?.completedAt !== null && attempt ? `<a class="button plain full" href="#results/${attempt.id}">查看本次错题</a>` : '<p class="start-note">不限时 · 无需登录</p>'}</aside></section>`;
}

function exam() {
  if (!attempt || attempt.completedAt !== null) { go('#home'); return ''; }
  return examView({ attempt, questionMap, chapterName, button, escape, ruleQuote });
}

function ruleQuote(id, english = true) {
  const r = ruleMap.get(id);
  if (!r) return '';
  return `<div class="rule-quote"><div class="rule-quote-number">${escape(r.id)}</div><p>${lines(r.text)}</p>${english ? `<details class="original"><summary>核对 WFDF 英文原文</summary><p lang="en">${escape(r.original)}</p></details>` : ''}</div>`;
}
function reviewCard(r, index) {
  return `<article class="review-card"><div class="review-kicker"><span class="result-label ${r.correct ? 'right' : 'wrong'}">${r.correct ? '✓ 答对' : r.answer === null ? '— 未答' : '× 答错'}</span><span>第 ${index + 1} 题 · ${escape(chapterName(r.question.chapter))}</span></div><h3>${escape(r.question.stem)}</h3><div class="review-options">${r.order.map((n, i) => `<div class="review-option ${n === r.question.answer ? 'correct' : n === r.answer ? 'incorrect' : ''}"><span>${String.fromCharCode(65 + i)}</span><p>${escape(r.question.options[n])}</p>${n === r.question.answer ? '<b>正确答案</b>' : n === r.answer ? '<b>你的选择</b>' : ''}</div>`).join('')}</div><div class="explanation"><span class="eyebrow">判断依据</span><p>${escape(r.question.explanation)}</p><div class="ref-tags">${r.question.refs.map(ref => `<button data-ref="${escape(ref)}">§ ${escape(ref)} ↗</button>`).join('')}</div></div><details class="quoted-rules" ${!r.correct ? 'open' : ''}><summary>查看对应条文 · 含原始编号</summary>${r.question.refs.map(ref => ruleQuote(ref)).join('')}<a class="text-link small" href="#rules/${encodeURIComponent(r.question.refs[0])}">在完整规则书中阅读 →</a></details></article>`;
}
function results(id) {
  const a = attempt?.id === id && attempt.completedAt !== null ? attempt : null;
  if (!a) return `${title('WFDF 2025–2028', '没有可回顾的试卷')}<a href="#home" class="button primary">开始新的考试</a>`;
  const g = gradeAttempt(a, bank), wrong = g.total - g.correct;
  const filtered = g.results.map((r, index) => ({ r, index })).filter(({ r }) => resultFilter === 'all' || !r.correct);
  return `${title('WFDF 2025–2028', '本次成绩')}<section class="result-summary"><div class="score-ring" style="--score:${g.score}%"><div><strong>${g.score}</strong><span>/ 100 分</span></div></div><div class="result-stats"><h2>答对 ${g.correct} 题 · 答错 ${wrong} 题</h2><div class="result-actions">${button('new', '再考一次 →')}<a class="button secondary" href="#rules">查阅规则</a></div></div></section><div class="review-toolbar"><h2>错题回顾</h2><div class="segmented" aria-label="筛选复盘题目"><button data-filter="wrong" aria-pressed="${resultFilter === 'wrong'}">错题 ${wrong}</button><button data-filter="all" aria-pressed="${resultFilter === 'all'}">全部 ${g.total}</button></div></div><div class="review-list">${filtered.length ? filtered.map(({ r, index }) => reviewCard(r, index)).join('') : `<div class="empty-state"><span>✓</span><h3>本次没有错题</h3><p>全部答对！可切换“全部”查看解析。</p></div>`}</div>`;
}


function ruleResults() {
  const term = ruleSearch.trim().toLowerCase();
  const list = rules.rules.filter(r => (ruleChapter === 'all' || String(r.chapter) === ruleChapter) && (!term || r.id === term || r.id.startsWith(term + '.') || (r.text + ' ' + r.original).toLowerCase().includes(term)));
  const defs = rules.definitions.filter(d => (ruleChapter === 'all' || ruleChapter === 'definitions') && (!term || (d.title + d.term + d.text).toLowerCase().includes(term)));
  if (ruleChapter === 'definitions') list.length = 0;
  if (ruleChapter === 'intro') return `<h2>介绍</h2>${rules.introduction.map(p => `<p class="intro-paragraph">${lines(p)}</p>`).join('')}`;
  if (ruleChapter === 'license') return `<h2>法律许可</h2>${rules.legalLicense.map(p => `<p class="intro-paragraph">${lines(p)}</p>`).join('')}<a class="text-link" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0 ↗</a>`;
  let prev = null;
  return `<p class="search-count" role="status">${list.length} 条编号条文${defs.length ? ` · ${defs.length} 个定义` : ''}</p>${list.map(r => { const head = prev !== r.chapter ? `<h2 class="rule-section-heading">${r.chapter}. ${escape(chapterName(r.chapter))}</h2>` : ''; prev = r.chapter; return `${head}<article class="rule-row" id="rule-${r.id}"><a class="rule-number" href="#rules/${r.id}">${r.id}</a><div><p>${lines(r.text)}</p>${r.id === '2.1' ? '<figure class="field-figure"><img src="./assets/field.svg" alt="比赛场地全长100米，宽37米；中心区长64米，两端得分区各长18米。砖点距相邻得分线18米。"><figcaption>图 1 · 比赛场地（按官方原图重绘）</figcaption></figure>' : ''}<details class="original"><summary>英文原文</summary><p lang="en">${escape(r.original)}</p></details></div></article>`; }).join('')}${defs.length ? `<h2 class="rule-section-heading">定义</h2>${defs.map(d => `<article class="definition-row"><h3>${escape(d.title)}<small>${escape(d.term)}</small></h3><p>${lines(d.text)}</p></article>`).join('')}` : ''}${!list.length && !defs.length ? '<div class="empty-state"><h3>没有找到相应条文</h3><p>可尝试规则编号、中文关键词或英文喊话。</p></div>' : ''}`;
}
function library(ref) {
  if (ref && ruleMap.has(ref)) { ruleChapter = String(ruleMap.get(ref).chapter); ruleSearch = ''; }
  return `${title('WFDF 2025–2028', '规则全文')}<div class="library-tools"><label class="search-box"><span aria-hidden="true">⌕</span><input id="rule-search" type="search" placeholder="搜索，如 17.2.2、读秒、Pick" value="${escape(ruleSearch)}" aria-label="搜索规则"><kbd>/</kbd></label><a class="button secondary" href="./assets/wfdf-2025-2028-zh.pdf" download>下载中文 PDF ↓</a></div><div class="library-layout"><aside class="chapter-nav"><label class="sr-only" for="chapter-select">选择规则章节</label><select id="chapter-select"><option value="all" ${ruleChapter === 'all' ? 'selected' : ''}>全部规则与定义</option><option value="intro" ${ruleChapter === 'intro' ? 'selected' : ''}>介绍</option>${rules.chapters.map(c => `<option value="${c.id}" ${ruleChapter === String(c.id) ? 'selected' : ''}>${c.id}. ${escape(c.title)}</option>`).join('')}<option value="definitions" ${ruleChapter === 'definitions' ? 'selected' : ''}>定义 · 40 个</option><option value="license" ${ruleChapter === 'license' ? 'selected' : ''}>法律许可</option></select><div class="desktop-chapters">${[['all','全部规则与定义'],['intro','介绍'],...rules.chapters.map(c => [String(c.id),`${c.id}. ${c.title}`]),['definitions','定义 · 40 个'],['license','法律许可']].map(([id, label]) => `<button data-chapter="${id}" ${ruleChapter === id ? 'aria-current="true"' : ''}>${escape(label)}</button>`).join('')}</div></aside><section id="rule-results" class="rule-content" aria-label="规则正文">${ruleResults()}</section></div>`;
}

function about() {
  return `${title('WFDF 2025–2028', '版本与来源')}<article class="prose-card"><h2>规则与译文</h2><p>采用 WFDF 2025–2028 主规则，收录介绍、20 章正文、40 个定义及法律许可。中文依据 WFDF 官网同版译本，对照英文校订、重新排版。</p><p>中文底本由全国飞盘运动推广委员会组织翻译。翻译人员：王哲、戴华、尧牧野、路佳、孟明、郭铮铮、李岩、张新光、薛志行。</p><h2>考试</h2><p>每卷 25 道单选题，覆盖 20 章，至少包含 2 道飞盘精神题。题目和选项随机排列，每题 4 分，首次选择后锁定。本站为独立学习工具，非 WFDF 官方认证考试。</p><h2>许可</h2><p>规则原作者：World Flying Disc Federation。规则、译文及本站原创题目与解析采用 CC BY 4.0，网站代码采用 MIT 许可。编校日期：2026-11-02。</p><div class="source-links"><a href="${escape(rules.source)}" target="_blank" rel="noopener">官方英文主规则 ↗</a><a href="${escape(rules.translationSource)}" target="_blank" rel="noopener">官方刊载中文译本 ↗</a><a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0 许可 ↗</a><a href="https://github.com/wch1007/WFDF-examination" target="_blank" rel="noopener">项目源码 ↗</a></div></article>`;
}

function render({ keepScroll = false } = {}) {
  if (!bank) return;
  const hash = location.hash.slice(1) || 'home';
  const [route, param] = hash.split('/');
  $('#main').innerHTML = route === 'exam' ? exam() : route === 'results' ? results(param) : route === 'rules' ? library(param) : route === 'about' ? about() : home();
  document.body.classList.toggle('exam-mode', route === 'exam');
  document.querySelectorAll('[data-nav]').forEach(el => { const selected = el.dataset.nav === route || (el.dataset.nav === 'home' && route === 'exam'); if (selected) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current'); });
  if (!keepScroll) window.scrollTo({ top: 0, behavior: 'instant' });
  if (route === 'rules' && param && ruleMap.has(param)) requestAnimationFrame(() => { const node = document.getElementById('rule-' + param); node?.scrollIntoView({ block: 'center' }); node?.classList.add('highlight'); });
}
function refreshRuleResults() { $('#rule-results').innerHTML = ruleResults(); }
function ask(titleText, text, confirmText, action, cancelText = '取消') {
  $('#dialog-title').textContent = titleText; $('#dialog-text').textContent = text; $('#dialog-confirm').textContent = confirmText; $('#dialog-cancel').textContent = cancelText; pendingConfirm = action; $('#confirm-dialog').showModal(); $('#dialog-cancel').focus();
}
function startNew() { attempt = createAttempt(bank); persist(); go('#exam'); }
function submit() {
  if (countAnswered() !== 25) { toast('请先完成全部 25 题。'); return; }
  attempt.completedAt = Date.now(); persist(); resultFilter = 'wrong'; go('#results/' + attempt.id);
}

document.addEventListener('click', event => {
  const target = event.target.closest('button');
  if (!target || !bank) return;
  if (target.dataset.jump !== undefined && attempt?.completedAt === null && canVisit(attempt, Number(target.dataset.jump))) { attempt.current = Number(target.dataset.jump); persist(); render(); return; }
  if (target.dataset.filter) { resultFilter = target.dataset.filter; render({ keepScroll: true }); return; }
  if (target.dataset.chapter) { ruleChapter = target.dataset.chapter; go('#rules'); render({ keepScroll: true }); $('#rule-results').scrollIntoView({ block: 'start' }); return; }
  if (target.dataset.ref) { $('#rule-dialog-title').textContent = `规则 ${target.dataset.ref}`; $('#rule-dialog-content').innerHTML = ruleQuote(target.dataset.ref) + `<a class="text-link" href="#rules/${target.dataset.ref}" data-close-rule>在完整规则中阅读 →</a>`; $('#rule-dialog').showModal(); return; }
  const action = target.dataset.action;
  if (action === 'start') startNew();
  else if (action === 'resume') go('#exam');
  else if (action === 'new') {
    if (attempt && attempt.completedAt === null) ask('重新抽取 25 道题？', '当前答题进度会被替换。', '重新抽题', startNew);
    else startNew();
  } else if (action === 'flag' && attempt?.completedAt === null) { attempt.items[attempt.current].flagged = !attempt.items[attempt.current].flagged; persist(); render({ keepScroll: true }); $('[data-action="flag"]').focus(); }
  else if (action === 'prev' || action === 'next') { if (attempt?.completedAt !== null || action === 'next' && attempt.items[attempt.current].answer === null) return; attempt.current = Math.max(0, Math.min(24, attempt.current + (action === 'next' ? 1 : -1))); persist(); render(); $('#question-stem')?.setAttribute('tabindex', '-1'); $('#question-stem')?.focus({ preventScroll: true }); }
  else if (action === 'submit' && attempt?.completedAt === null) submit();
});
document.addEventListener('change', event => {
  if (event.target.name === 'answer' && chooseAnswer(attempt, Number(event.target.value))) { persist(); render({ keepScroll: true }); const feedback = document.querySelector('.instant-feedback'); feedback?.setAttribute('tabindex', '-1'); feedback?.focus({ preventScroll: true }); feedback?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
  if (event.target.id === 'chapter-select') { ruleChapter = event.target.value; refreshRuleResults(); document.querySelectorAll('[data-chapter]').forEach(e => { if (e.dataset.chapter === ruleChapter) e.setAttribute('aria-current', 'true'); else e.removeAttribute('aria-current'); }); }
});
document.addEventListener('input', event => { if (event.target.id === 'rule-search') { ruleSearch = event.target.value; refreshRuleResults(); } });
document.addEventListener('keydown', event => { if (event.key === '/' && $('#rule-search') && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) { event.preventDefault(); $('#rule-search').focus(); } });
$('#dialog-cancel').addEventListener('click', () => { pendingConfirm = null; $('#confirm-dialog').close(); });
$('#confirm-dialog').addEventListener('cancel', () => { pendingConfirm = null; });
$('#dialog-confirm').addEventListener('click', () => { $('#confirm-dialog').close(); const action = pendingConfirm; pendingConfirm = null; action?.(); });
$('#close-rule').addEventListener('click', () => $('#rule-dialog').close());
document.addEventListener('click', event => { if (event.target.closest('[data-close-rule]')) $('#rule-dialog').close(); });
window.addEventListener('hashchange', () => { resultFilter = 'wrong'; render(); });

try {
  const responses = await Promise.all([fetch('./data/questions.json'), fetch('./data/rules.json')]);
  if (responses.some(r => !r.ok)) throw new Error('加载失败');
  [bank, rules] = await Promise.all(responses.map(r => r.json()));
  questionMap = new Map(bank.questions.map(q => [q.id, q])); ruleMap = new Map(rules.rules.map(r => [r.id, r]));
  restore(); render();
} catch {
  $('#main').innerHTML = '<div class="empty-state"><h1>暂时无法加载题库</h1><p>请检查网络后重试。</p><button class="button primary" id="retry-load">重新加载</button></div>';
  $('#retry-load').addEventListener('click', () => location.reload());
}
