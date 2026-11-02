import { createAttempt, isValidAttempt, gradeAttempt, chooseAnswer, canVisit } from './exam.js';
import { examView } from './exam-view.js';

const $ = selector => document.querySelector(selector);
const escape = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const lines = s => escape(s).replace(/\n/g, '<br>');
const STORAGE = 'wfdf-rules-lab-v1';
let bank, rules, questionMap, ruleMap, attempt = null, history = [], resultFilter = 'wrong', ruleChapter = 'all', ruleSearch = '', pendingConfirm;
let saveWarningShown = false;

function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').classList.remove('visible'), 3800); }
function persist() {
  try { localStorage.setItem(STORAGE, JSON.stringify({ attempt, history: history.slice(0, 30) })); }
  catch { if (!saveWarningShown) { toast('浏览器未允许保存记录；本次答题仍可正常完成。'); saveWarningShown = true; } }
}
function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE) || '{}');
    if (isValidAttempt(saved.attempt, bank)) attempt = saved.attempt;
    history = Array.isArray(saved.history) ? saved.history.filter(a => isValidAttempt(a, bank) && a.completedAt !== null).slice(0, 30) : [];
  } catch { /* A broken or unavailable browser store must not prevent a new exam. */ }
}
function chapterName(id) { return rules.chapters.find(c => c.id === id)?.title || ''; }
function countAnswered(a = attempt) { return a?.items.filter(i => i.answer !== null).length || 0; }
function dateText(t) { return new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(t); }
function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
function button(action, text, klass = 'primary', extra = '') { return `<button class="button ${klass}" data-action="${action}" ${extra}>${text}</button>`; }
function title(eyebrow, heading, description = '') { return `<div class="page-heading"><p class="eyebrow">${eyebrow}</p><h1>${heading}</h1>${description ? `<p class="page-description">${description}</p>` : ''}</div>`; }

function home() {
  const unfinished = attempt && attempt.completedAt === null;
  return `<section class="hero"><div class="hero-copy"><p class="eyebrow"><span class="live-dot"></span> RULES IN PLAY / 规则在场</p><h1>上场之前，<br>检验你的<span>规则判断。</span></h1><p class="hero-description">从接盘边界到犯规处理，从一次争议到飞盘精神。<br class="desktop-only">用真实比赛情境，检验你会如何让比赛继续。</p><div class="hero-links"><a class="text-link" href="#rules">查阅全部规则 <span>↗</span></a><a class="text-link muted" href="./assets/wfdf-2025-2028-zh.pdf" download>下载中文规则书 ↓</a></div><div class="hero-note">依据 WFDF 2025–2028 主规则 · 中文题目 · 保留英文喊话</div></div><aside class="start-card"><div class="start-top"><span>比赛情境测试</span><span class="pill">单选题</span></div><div class="field-art" aria-hidden="true"><div class="field-line one"></div><div class="field-line two"></div><span class="brick left">+</span><span class="brick right">+</span><span class="disc-flight"></span><span class="flight-path"></span></div><div class="exam-spec"><div><strong>25<small>题</small></strong><span>每次随机组卷</span></div><div><strong>100<small>分</small></strong><span>每题 4 分</span></div><div><strong>20<small>章</small></strong><span>每卷覆盖全部章节</span></div></div>${button(unfinished ? 'resume' : 'start', unfinished ? `继续答题 · 已答 ${countAnswered()} / 25 <span>→</span>` : '开始随机考试 <span>→</span>', 'lime full')}${unfinished ? button('new', '重新抽一份试卷', 'plain full') : '<p class="start-note">不限时 · 无需登录 · 进度自动保存在本机</p>'}</aside></section><section class="study-strip"><div class="strip-number">01—20</div><div><h2>先理解规则，再作出判断。</h2><p>${bank.questions.length} 道情境题，涵盖飞盘精神、位置与盘权、示意与比赛恢复。每卷至少 2 道飞盘精神题，题目与选项都会打乱。</p></div><a class="button secondary" href="#rules">打开完整规则书 ↗</a></section><section class="home-details"><div><span class="detail-index">01 / 场上判断</span><h3>考怎样处理，而非只记术语</h3><p>辨别谁能示意、结果是否有效、飞盘回到哪里，以及如何恢复读秒。</p></div><div><span class="detail-index">02 / 有据可查</span><h3>每一个答案，都回到条文</h3><p>选完立即查看解析与原始编号，展开对应条文核对判断条件。</p></div><div><span class="detail-index">03 / 持续练习</span><h3>看见还需要补强的章节</h3><p>分章查看本次表现，复盘错题；历史试卷仅保存在当前浏览器中。</p></div></section>`;
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
  const a = history.find(x => x.id === id) || (attempt?.id === id && attempt.completedAt !== null ? attempt : null);
  if (!a) return `${title('EXAM REVIEW', '没有找到这份试卷', '考试记录保存在当前浏览器。')}<a href="#home" class="button primary">开始新的考试</a>`;
  const g = gradeAttempt(a, bank), wrong = g.total - g.correct;
  const filtered = g.results.map((r, index) => ({ r, index })).filter(({ r }) => resultFilter === 'all' || !r.correct);
  return `${title('EXAM REVIEW / 本次复盘', g.score === 100 ? '规则判断，全部正确。' : '每一次复盘，都为下一次上场。', `${dateText(a.completedAt)} · 25 道单选题 · WFDF 2025–2028`)}<section class="result-summary"><div class="score-ring" style="--score:${g.score}%"><div><strong>${g.score}</strong><span>/ 100 分</span></div></div><div class="result-stats"><h2>${g.correct} 题答对，${wrong} 题待巩固</h2><p>${g.unanswered ? `其中 ${g.unanswered} 题未作答，计 0 分。` : '所有题目已作答。'}每题 4 分，按首次提交的正确题数计分。</p><div class="result-actions">${button('new', '再考一次 →')}<a class="button secondary" href="#rules">查阅完整规则</a></div></div></section><details class="chapter-performance"><summary>查看各章表现 <span>20 章</span></summary><div>${rules.chapters.map(c => { const rows = g.results.filter(r => r.question.chapter === c.id); return `<p><span>${c.id}. ${escape(c.title)}</span><strong class="${rows.every(r => r.correct) ? 'good' : ''}">${rows.filter(r => r.correct).length} / ${rows.length}</strong></p>`; }).join('')}</div></details><div class="review-toolbar"><h2>题目解析</h2><div class="segmented" aria-label="筛选复盘题目"><button data-filter="wrong" aria-pressed="${resultFilter === 'wrong'}">错题与未答 ${wrong}</button><button data-filter="all" aria-pressed="${resultFilter === 'all'}">全部 ${g.total}</button></div></div><div class="review-list">${filtered.length ? filtered.map(({ r, index }) => reviewCard(r, index)).join('') : `<div class="empty-state"><span>✓</span><h3>本次没有错题</h3><p>切换到“全部”，可以继续核对每一题的解析与原文。</p></div>`}</div>`;
}

function historyPage() {
  return `${title('YOUR PRACTICE / 练习轨迹', '考试记录', '最近 30 次考试保存在本机浏览器，可重新查看完整试卷和解析。')}<div class="history-list">${history.length ? history.map(a => { const g = gradeAttempt(a, bank); return `<a class="history-row" href="#results/${a.id}"><span class="history-score">${g.score}<small>分</small></span><div><h2>${dateText(a.completedAt)}</h2><p>${g.correct} / 25 题答对 · ${g.unanswered ? `${g.unanswered} 题未答` : '全部已答'}</p></div><span class="history-arrow">复盘 →</span></a>`; }).join('') : '<div class="empty-state"><span>↗</span><h2>从第一份试卷开始</h2><p>完成考试后，你的得分和解析会出现在这里。</p><a class="button primary" href="#home">去考试</a></div>'}</div>${history.length ? button('clear-history', '清除本机考试记录', 'plain') : ''}`;
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
  return `${title('THE RULEBOOK / 规则在手', '完整规则书', '2025–2028 主规则全文，保留原始编号。可按条款、中文关键词或英文术语查阅。')}<div class="library-tools"><label class="search-box"><span aria-hidden="true">⌕</span><input id="rule-search" type="search" placeholder="搜索，如 17.2.2、读秒、Pick" value="${escape(ruleSearch)}" aria-label="搜索规则"><kbd>/</kbd></label><a class="button secondary" href="./assets/wfdf-2025-2028-zh.pdf" download>下载中文 PDF ↓</a></div><div class="library-layout"><aside class="chapter-nav"><label class="sr-only" for="chapter-select">选择规则章节</label><select id="chapter-select"><option value="all" ${ruleChapter === 'all' ? 'selected' : ''}>全部规则与定义</option><option value="intro" ${ruleChapter === 'intro' ? 'selected' : ''}>介绍</option>${rules.chapters.map(c => `<option value="${c.id}" ${ruleChapter === String(c.id) ? 'selected' : ''}>${c.id}. ${escape(c.title)}</option>`).join('')}<option value="definitions" ${ruleChapter === 'definitions' ? 'selected' : ''}>定义 · 40 个</option><option value="license" ${ruleChapter === 'license' ? 'selected' : ''}>法律许可</option></select><div class="desktop-chapters">${[['all','全部规则与定义'],['intro','介绍'],...rules.chapters.map(c => [String(c.id),`${c.id}. ${c.title}`]),['definitions','定义 · 40 个'],['license','法律许可']].map(([id, label]) => `<button data-chapter="${id}" ${ruleChapter === id ? 'aria-current="true"' : ''}>${escape(label)}</button>`).join('')}</div></aside><section id="rule-results" class="rule-content" aria-label="规则正文">${ruleResults()}</section></div>`;
}

function about() {
  return `${title('EDITION & SOURCES', '版本与来源')}<article class="prose-card"><h2>统一采用 2025–2028 主规则</h2><p>本网站依据 WFDF Rules of Ultimate 2025–2028（2025 年 1 月 1 日生效）编制，收录介绍、20 章共 368 个编号条目、40 个定义及法律许可。题库不混入旧版、Appendix、Annotations 或其他规则体系。</p><h2>译文与编校</h2><p>中文以 WFDF 官网刊载、由全国飞盘运动推广委员会组织翻译的同版中文规则为底本，对照英文原文校订缺漏、句法与术语。翻译人员：王哲、戴华、尧牧野、路佳、孟明、郭铮铮、李岩、张新光、薛志行。本站重新编校并排版，保留英文喊话与条款编号；并非官方认证译本。</p><p>条文中的“英文原文”来自官方主规则 PDF，可能保留原文的列表连接词。规则正文与情境题解析分别展示。题库为独立编写的学习材料，不是 WFDF 官方认证考试。</p><h2>抽题与计分</h2><p>每卷先从 20 章各抽 1 题，再补 1 道不重复的飞盘精神题，其余 4 题从剩余题库随机抽取。题目和选项分别随机排序；每题仅一个正确答案，选择后立即判题且不可修改。答对得 4 分，答错得 0 分，满分 100 分。不限时，无负分，不设置官方合格线。</p><h2>本机记录</h2><p>未完成试卷和最近 30 次考试保存在当前浏览器中，不上传答题记录。清除浏览器数据会删除记录；不同设备之间不自动同步。</p><h2>原文与许可</h2><p>规则原作者及许可人：World Flying Disc Federation。规则及衍生译文依据 CC BY 4.0 许可使用。本网站代码使用 MIT 许可，题目与解析使用 CC BY 4.0。编校日期：2026-11-02。</p><div class="source-links"><a href="${escape(rules.source)}" target="_blank" rel="noopener">WFDF 官方英文主规则 ↗</a><a href="${escape(rules.translationSource)}" target="_blank" rel="noopener">WFDF 官网中文译本 ↗</a><a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0 许可 ↗</a><a href="./data/coverage.json" target="_blank" rel="noopener">题库条款覆盖清单 ↗</a><a href="https://github.com/wch1007/WFDF-examination" target="_blank" rel="noopener">项目源码与问题反馈 ↗</a></div></article>`;
}

function render({ keepScroll = false } = {}) {
  if (!bank) return;
  const hash = location.hash.slice(1) || 'home';
  const [route, param] = hash.split('/');
  $('#main').innerHTML = route === 'exam' ? exam() : route === 'results' ? results(param) : route === 'rules' ? library(param) : route === 'history' ? historyPage() : route === 'about' ? about() : home();
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
  const unanswered = 25 - countAnswered(), flagged = attempt.items.filter(i => i.flagged).length;
  ask('准备提交这份试卷？', `${unanswered ? `还有 ${unanswered} 题未作答，提交后按 0 分计。` : '25 题已全部作答。'}${flagged ? `你标记了 ${flagged} 题待复习。` : ''}完成后可集中复盘所有答案与解析。`, '确认交卷', () => {
    attempt.completedAt = Date.now(); history = [attempt, ...history.filter(a => a.id !== attempt.id)].slice(0, 30); persist(); resultFilter = 'wrong'; go('#results/' + attempt.id);
  }, '继续答题');
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
    if (attempt && attempt.completedAt === null) ask('重新抽取 25 道题？', '当前未完成试卷会被替换。已提交的考试记录会保留。', '重新抽题', startNew);
    else startNew();
  } else if (action === 'flag' && attempt?.completedAt === null) { attempt.items[attempt.current].flagged = !attempt.items[attempt.current].flagged; persist(); render({ keepScroll: true }); $('[data-action="flag"]').focus(); }
  else if (action === 'prev' || action === 'next') { if (attempt?.completedAt !== null || action === 'next' && attempt.items[attempt.current].answer === null) return; attempt.current = Math.max(0, Math.min(24, attempt.current + (action === 'next' ? 1 : -1))); persist(); render(); $('#question-stem')?.setAttribute('tabindex', '-1'); $('#question-stem')?.focus({ preventScroll: true }); }
  else if (action === 'submit' && attempt?.completedAt === null) submit();
  else if (action === 'clear-history') ask('清除本机考试记录？', '这会删除已完成试卷与解析记录，无法撤销。未完成的试卷会保留。', '确认清除', () => { history = []; if (attempt?.completedAt !== null) attempt = null; persist(); render(); });
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
window.addEventListener('hashchange', () => render());

try {
  const responses = await Promise.all([fetch('./data/questions.json'), fetch('./data/rules.json')]);
  if (responses.some(r => !r.ok)) throw new Error('加载失败');
  [bank, rules] = await Promise.all(responses.map(r => r.json()));
  questionMap = new Map(bank.questions.map(q => [q.id, q])); ruleMap = new Map(rules.rules.map(r => [r.id, r]));
  restore(); render();
} catch {
  $('#main').innerHTML = '<div class="empty-state"><h1>暂时无法加载题库</h1><p>请检查网络后刷新页面。如果在本地使用，请通过 npm run dev 启动网站。</p><button class="button primary" id="retry-load">重新加载</button></div>';
  $('#retry-load').addEventListener('click', () => location.reload());
}
