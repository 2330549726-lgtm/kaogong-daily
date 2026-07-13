const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const STORAGE_KEY = 'gd_exam_collections';
const MATERIAL_STORAGE_KEY = 'gd_exam_materials';
const WRITING_STORAGE_KEY = 'gd_exam_writing_practice';
const EXAM_ANSWER_STORAGE_KEY = 'gd_exam_exam_answers';
const CATEGORIES = {
  政策: 'Policy', 经济: 'Economy', 民生: 'Livelihood',
  生态: 'Ecology', 科技: 'Tech', 文化: 'Culture'
};
// 与采集端保持一致：只展示逻辑填空中可辨析的规范成语，过滤政策术语和普通四字短语。
const EXAM_IDIOMS = new Set([
  '举足轻重', '任重道远', '立竿见影', '雪中送炭', '锦上添花',
  '因地制宜', '循序渐进', '持之以恒', '相得益彰', '保驾护航',
  '日新月异', '方兴未艾', '前所未有', '统筹兼顾', '源远流长',
  '博大精深', '薪火相传', '突飞猛进', '事半功倍', '久久为功'
]);
const TOPICS = {
  '粤港澳大湾区': { description: '区域协同、规则衔接与湾区建设', keywords: ['粤港澳', '大湾区', '横琴', '前海', '南沙', '河套'] },
  '百千万工程': { description: '县镇村高质量发展与城乡融合', keywords: ['百千万', '强县', '兴村', '县域', '镇村'] },
  '制造业当家': { description: '产业升级、实体经济与现代化产业体系', keywords: ['制造业', '产业链', '供应链', '实体经济', '智能制造'] },
  '基层治理': { description: '社区治理、公共服务与治理现代化', keywords: ['基层治理', '社区', '网格', '治理现代化', '共建共治'] },
  '乡村振兴': { description: '农业农村现代化与和美乡村建设', keywords: ['乡村振兴', '三农', '农村', '农业', '农民'] },
  '新质生产力': { description: '科技创新、数字经济与发展新动能', keywords: ['新质生产力', '科技创新', '人工智能', '数字经济', '研发'] },
  '绿美广东': { description: '生态文明、绿色发展与美丽广东', keywords: ['绿美广东', '生态文明', '绿色发展', '碳达峰', '碳中和', '环保'] },
  '数字政府': { description: '政务服务、数据治理与效能提升', keywords: ['数字政府', '政务服务', '一网通办', '数字化', '数据治理'] },
  '民生保障': { description: '就业、教育、医疗、养老与住房', keywords: ['民生', '就业', '教育', '医疗', '养老', '住房', '托育'] },
  '营商环境': { description: '政府服务、市场活力与民营经济', keywords: ['营商环境', '民营经济', '市场主体', '放管服', '政商关系'] },
  '文化传承': { description: '岭南文化、文化自信与文旅融合', keywords: ['岭南文化', '文化传承', '非遗', '文旅', '文化自信', '粤剧'] },
  '区域协调': { description: '城乡区域协调与共同富裕', keywords: ['区域协调', '城乡融合', '共同富裕', '东西部协作', '对口帮扶'] }
};

const state = {
  articles: [],
  todayArticles: [],
  exploreArticles: [],
  articleIndex: new Map(),
  category: 'all',
  mode: 'today',
  keyword: '',
  collectionOnly: false,
  currentTopic: '',
  collections: loadCollections(),
  materials: loadMaterials(),
  writingPractice: loadWritingPractice(),
  examAnswers: loadExamAnswers(),
  materialFilters: { status: 'all', priority: 'all', tag: '' },
  backupTimer: null
};

document.addEventListener('DOMContentLoaded', init);

function init() {
  setCurrentDate();
  bindEvents();
  renderHistoryDates(false);
  loadNewsData();
}

function bindEvents() {
  let searchTimer;
  $('#searchInput').addEventListener('input', event => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.keyword = event.target.value.trim().toLowerCase();
      renderNews();
    }, 180);
  });

  $('#categoryTabs').addEventListener('click', event => {
    const button = event.target.closest('[data-cat]');
    if (!button) return;
    state.category = button.dataset.cat;
    setCollectionFilter(false);
    $$('.cat-tab').forEach(tab => tab.classList.toggle('active', tab === button));
    renderNews();
  });

  $('#modeTabs').addEventListener('click', event => {
    const button = event.target.closest('[data-mode]');
    if (!button || button.dataset.mode === state.mode) return;
    switchMode(button.dataset.mode);
  });

  $('#collectionFilter').addEventListener('click', () => {
    if (state.mode !== 'today') switchMode('today');
    setCollectionFilter(!state.collectionOnly);
    renderNews();
  });

  $('#materialTools').addEventListener('input', event => {
    const filterMap = {
      materialStatusFilter: 'status', materialPriorityFilter: 'priority', materialTagFilter: 'tag'
    };
    const key = filterMap[event.target.id];
    if (!key) return;
    state.materialFilters[key] = event.target.value.trim().toLowerCase();
    renderNews();
  });
  $('#resetMaterialFilters').addEventListener('click', resetMaterialFilters);
  $('#materialForm').addEventListener('submit', saveMaterial);
  $('#topicGrid').addEventListener('click', event => {
    const button = event.target.closest('[data-topic]');
    if (button) selectTopic(button.dataset.topic);
  });
  $('#randomTopic').addEventListener('click', selectRandomTopic);
  document.addEventListener('input', event => {
    if (!event.target.matches('.writing-input, .exam-answer-input')) return;
    const counter = event.target.closest('.writing-practice, .exam-answer-box')?.querySelector('.writing-count, .exam-answer-count');
    if (counter) counter.textContent = `${event.target.value.length} 字`;
  });

  document.addEventListener('click', event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'export') exportCollections();
    if (action === 'import') importCollections();
    if (action === 'close-material') $('#materialDialog').close();
    const focusButton = event.target.closest('[data-focus-article]');
    if (focusButton) focusArticle(focusButton.dataset.focusArticle);
  });

  $('#newsList').addEventListener('click', handleNewsClick);
  $('#historyDates').addEventListener('click', event => {
    const button = event.target.closest('[data-date]');
    if (!button) return;
    highlightHistoryDate(button.dataset.date);
    loadHistoryDate(button.dataset.date);
  });
}

function handleNewsClick(event) {
  const card = event.target.closest('.news-card');
  if (!card) return;
  const collectButton = event.target.closest('.collect-btn');
  if (collectButton) {
    event.stopPropagation();
    toggleCollect(collectButton.dataset.id, collectButton);
    return;
  }
  const editButton = event.target.closest('.edit-material-btn');
  if (editButton) {
    event.stopPropagation();
    openMaterialEditor(editButton.dataset.id);
    return;
  }
  const copyButton = event.target.closest('.knowledge-copy-btn');
  if (copyButton) {
    event.stopPropagation();
    copyKnowledgeCard(copyButton.dataset.id);
    return;
  }
  const writingButton = event.target.closest('.save-writing-btn');
  if (writingButton) {
    event.stopPropagation();
    saveWritingPractice(writingButton.dataset.id);
    return;
  }
  const examAnswerButton = event.target.closest('.save-exam-answer-btn');
  if (examAnswerButton) {
    event.stopPropagation();
    saveExamAnswer(examAnswerButton.dataset.id);
    return;
  }
  if (!event.target.closest('.action-btn')) card.classList.toggle('expanded');
}

function setCurrentDate() {
  $('#currentDate').textContent = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
  }).format(new Date());
}

async function loadNewsData() {
  try {
    const data = typeof EMBEDDED_NEWS_DATA !== 'undefined'
      ? EMBEDDED_NEWS_DATA
      : await fetch('news_data.json').then(response => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        });
    state.articles = data.articles || [];
    state.todayArticles = state.articles;
    indexArticles(state.articles);
    $('#updateInfo').textContent = data.update_time ? `更新于 ${data.update_time.slice(-8)}` : '今日资讯';
    updateOverview();
    renderLearningDesk();
    renderNews();
  } catch (error) {
    console.error('加载新闻数据失败:', error);
    showEmpty('数据加载失败', '请确认 news_data.json 文件存在');
  }
}

function updateOverview() {
  $('#statHigh').textContent = state.articles.filter(article => article.analysis?.exam_relevance === '高').length;
  $('#statTotal').textContent = state.articles.length;
  $('#statCollected').textContent = Object.keys(state.collections).length;
  $('#countAll').textContent = state.articles.length;
  Object.entries(CATEGORIES).forEach(([category, key]) => {
    $(`#count${key}`).textContent = state.articles.filter(article => article.category === category).length;
  });
}

function getFilteredArticles() {
  return state.articles.filter(article => {
    if (state.mode === 'explore' && state.currentTopic && !articleMatchesTopic(article, state.currentTopic)) return false;
    if (state.collectionOnly && !state.collections[article.id]) return false;
    const inCategory = state.category === 'all' || article.category === state.category;
    if (state.collectionOnly && !matchesMaterialFilters(article.id)) return false;
    if (!inCategory || !state.keyword) return inCategory;
    const analysis = article.analysis || {};
    const searchable = [article.title, article.content, article.summary, ...(analysis.keywords || [])]
      .filter(Boolean).join(' ').toLowerCase();
    return searchable.includes(state.keyword);
  });
}

function renderNews() {
  const articles = getFilteredArticles();
  if (state.collectionOnly) updateMaterialProgress();
  updateListHeading();
  if (!articles.length) {
    return state.collectionOnly
      ? showEmpty('还没有收藏素材', '在资讯卡片底部点击“收藏”，内容就会出现在这里')
      : showEmpty(state.mode === 'explore' ? '该专题暂无资料' : '暂无匹配资讯', state.mode === 'explore' ? '后续更新会继续补充这一专题' : '请尝试其他关键词或分类');
  }
  $('#emptyState').hidden = true;
  $('#newsList').innerHTML = articles.map(renderCard).join('');
}

function updateMaterialProgress() {
  const counts = { unread: 0, learning: 0, mastered: 0 };
  state.articles.filter(article => state.collections[article.id]).forEach(article => {
    const status = getMaterial(article.id).status;
    if (status in counts) counts[status] += 1;
  });
  $('#progressUnread').textContent = counts.unread;
  $('#progressLearning').textContent = counts.learning;
  $('#progressMastered').textContent = counts.mastered;
}

function renderCard(article) {
  state.articleIndex.set(String(article.id), article);
  const analysis = article.analysis || {};
  const relevance = analysis.exam_relevance || '低';
  const relevanceClass = { 高: 'high', 中: 'medium' }[relevance] || 'low';
  const collected = Boolean(state.collections[article.id]);
  const material = getMaterial(article.id);
  const sourceProfile = getSourceProfile(article);
  return `
    <article class="news-card" id="article-${escapeHtml(article.id)}" data-id="${escapeHtml(article.id)}">
      <div class="news-card-header">
        <h2 class="news-title">${escapeHtml(article.title)}</h2>
        <span class="relevance-badge ${relevanceClass}">${relevance}相关</span>
      </div>
      <div class="news-meta">
        <span class="news-source">${escapeHtml(article.source)}</span>
        <span class="source-profile-badge level-${sourceProfile.level}">${escapeHtml(sourceProfile.type)}</span>
        <span>${escapeHtml(sourceProfile.learning_use)}</span>
        <time>${escapeHtml(article.date)}</time>
        <span class="cat-badge">${escapeHtml(article.category)}</span>
      </div>
      <div class="news-content">${renderContent(article)}</div>
      <div class="why-learn"><strong>为什么值得学：</strong>${escapeHtml(sourceProfile.why_learn)}</div>
      ${collected ? renderMaterialMeta(material) : ''}
      <div class="news-actions">
        <button type="button" class="action-btn collect-btn ${collected ? 'collected' : ''}" data-id="${escapeHtml(article.id)}">${collected ? '★ 已收藏' : '☆ 收藏'}</button>
        <a href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer" class="action-btn source-link">阅读原文 ↗</a>
        ${collected ? `<button type="button" class="action-btn edit-material-btn" data-id="${escapeHtml(article.id)}">整理素材</button>` : ''}
        <span class="expand-hint">展开考点分析 ↓</span>
      </div>
      <div class="news-detail">
        ${renderKnowledgeCard(article)}
        ${renderIdiomsBlock(analysis.idioms)}
      </div>
    </article>`;
}

function renderKnowledgeCard(article) {
  const card = article.analysis?.knowledge_card || deriveKnowledgeCard(article);
  const section = (title, values, className = '') => {
    const items = Array.isArray(values) ? values : [values];
    if (!items.filter(Boolean).length) return '';
    return `<section class="knowledge-section ${className}"><h3>${title}</h3><ul>${items.filter(Boolean).map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>`;
  };
  return `<div class="knowledge-card">
    <div class="knowledge-heading"><div><small>结构化学习卡</small><h3>这篇资讯怎么考、怎么用</h3></div><button type="button" class="knowledge-copy-btn" data-id="${escapeHtml(article.id)}">复制答题卡</button></div>
    <div class="knowledge-overview"><span>一句话概括</span><strong>${escapeHtml(card.overview)}</strong></div>
    <div class="knowledge-grid">
      ${section('背景与问题', card.background_and_problem, 'problem')}
      ${section('意义价值', card.significance, 'meaning')}
      ${section('对策路径', card.measures, 'measure')}
      ${section('关键数据与事实', card.evidence, 'evidence')}
    </div>
    <section class="answer-expression"><h3>申论分论点</h3><blockquote>${escapeHtml(card.essay_thesis)}</blockquote></section>
    ${renderExamMapping(article, card)}
    ${renderWritingLab(article, card.writing_lab)}
    ${section('面试答题框架', card.interview_outline, 'interview-outline')}
    <div class="knowledge-keywords">${(card.keywords || article.analysis?.keywords || []).map(keyword => `<span>${escapeHtml(keyword)}</span>`).join('')}</div>
  </div>`;
}

function getExamMapping(article, card) {
  const matchedTopics = Object.keys(TOPICS).filter(topic => articleMatchesTopic(article, topic));
  const text = `${article.title}${article.content || article.summary || ''}`;
  const rural = matchedTopics.some(topic => ['百千万工程', '基层治理', '乡村振兴'].includes(topic));
  const questionTypes = ['归纳概括'];
  if (/问题|困难|短板|痛点|挑战/.test(text)) questionTypes.push('提出对策');
  if (article.analysis?.exam_relevance === '高') questionTypes.push('综合分析');
  questionTypes.push('申发论述');
  const theme = matchedTopics[0] || article.category || '社会治理';
  return {
    status: '主题相近能力训练（非历年原题）',
    paperDirection: rural ? '更适合乡镇岗位方向训练' : '更适合县级以上综合管理方向训练',
    themes: matchedTopics.slice(0, 3).length ? matchedTopics.slice(0, 3) : [article.category],
    questionTypes: [...new Set(questionTypes)],
    question: `请根据给定材料，概括${theme}相关工作的主要做法，并分析其对推动高质量发展的意义。`,
    requirements: ['紧扣材料，概括准确', '要点全面，层次清晰', '使用规范政策语言', '建议控制在250字以内'],
    answerHints: [...(card.measures || []).slice(0, 2), ...(card.significance || []).slice(0, 2)]
  };
}

function renderExamMapping(article, card) {
  const mapping = getExamMapping(article, card);
  const saved = state.examAnswers[article.id] || '';
  return `<section class="exam-mapping">
    <div class="exam-mapping-heading"><div><small>广东申论真题能力映射</small><h3>这篇材料可以怎么练</h3></div><span>${mapping.status}</span></div>
    <div class="exam-meta"><strong>${mapping.paperDirection}</strong>${mapping.themes.map(theme => `<span>${escapeHtml(theme)}</span>`).join('')}${mapping.questionTypes.map(type => `<span>${escapeHtml(type)}</span>`).join('')}</div>
    <div class="exam-question"><small>模拟训练题</small><p>${escapeHtml(mapping.question)}</p><ul>${mapping.requirements.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>
    <details class="exam-hints"><summary>查看参考要点</summary><ol>${mapping.answerHints.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ol></details>
    <div class="exam-answer-box"><label for="exam-answer-${escapeHtml(article.id)}">我的作答</label><textarea class="exam-answer-input" id="exam-answer-${escapeHtml(article.id)}" rows="5" maxlength="800" placeholder="先独立作答，再展开参考要点对照……">${escapeHtml(saved)}</textarea><div><span class="exam-answer-count">${saved.length} 字</span><button type="button" class="save-exam-answer-btn" data-id="${escapeHtml(article.id)}">保存作答</button></div></div>
  </section>`;
}

function loadExamAnswers() {
  try { return JSON.parse(localStorage.getItem(EXAM_ANSWER_STORAGE_KEY)) || {}; }
  catch (_) { return {}; }
}

function saveExamAnswer(id) {
  const input = $(`#exam-answer-${CSS.escape(String(id))}`);
  if (!input) return;
  const value = input.value.trim();
  if (value) state.examAnswers[id] = value;
  else delete state.examAnswers[id];
  localStorage.setItem(EXAM_ANSWER_STORAGE_KEY, JSON.stringify(state.examAnswers));
  showToast(value ? '模拟作答已保存' : '已清空这次作答');
}

function getWritingLab(article, writingLab) {
  if (writingLab) return writingLab;
  const templates = {
    政策: ['制度的生命力在于执行，政策的含金量要靠落实来检验。', '如何让好政策从纸面走进现实？关键在于细化责任、强化协同、跟踪问效。'],
    经济: ['产业兴则经济兴，产业强则发展强。', '以创新之力激活产业动能，以改革之举优化发展环境，才能不断塑造高质量发展新优势。'],
    民生: ['民生无小事，枝叶总关情。', '把群众的关键小事当作治理的大事，才能让发展更有温度、幸福更有质感。'],
    生态: ['生态是发展的底色，绿色是未来的成色。', '以高水平保护支撑高质量发展，方能让生态优势源源不断转化为发展优势。'],
    科技: ['创新是引领发展的第一动力。', '向科技创新要动力、向成果转化要效益，才能把创新变量转化为发展增量。'],
    文化: ['文脉赓续，方能弦歌不辍。', '在保护中传承、在创新中发展，才能让优秀传统文化焕发新的时代光彩。']
  };
  const [pattern, model] = templates[article.category] || templates.政策;
  return { argument_structure: ['开篇点明主题与现实价值', '结合材料分析问题或发展条件', '从机制、协同、落实等角度提出路径', '回扣群众获得感或高质量发展升华主题'], sentence_pattern: pattern, model_sentence: model, imitation_prompt: `围绕“${article.title}”，仿照示范表达写一句40—80字的申论句子。`, provenance: '平台整理表达，非新闻媒体原文' };
}

function renderWritingLab(article, writingLab) {
  const lab = getWritingLab(article, writingLab);
  const saved = state.writingPractice[article.id] || '';
  const commentary = getSourceProfile(article).type === '权威评论';
  return `<section class="writing-lab">
    <div class="writing-lab-heading"><div><small>${commentary ? '权威评论拆解' : '申论表达训练'}</small><h3>从读懂观点到写出观点</h3></div><span>${escapeHtml(lab.provenance)}</span></div>
    <div class="argument-flow">${lab.argument_structure.map((item, index) => `<div><b>${index + 1}</b><span>${escapeHtml(item)}</span></div>`).join('')}</div>
    <div class="sentence-study"><div><small>句式模板</small><p>${escapeHtml(lab.sentence_pattern)}</p></div><div><small>平台示范</small><p>${escapeHtml(lab.model_sentence)}</p></div></div>
    <div class="writing-practice"><label for="writing-${escapeHtml(article.id)}">仿写练习</label><p>${escapeHtml(lab.imitation_prompt)}</p><textarea class="writing-input" id="writing-${escapeHtml(article.id)}" rows="3" placeholder="在这里写下你的申论表达……">${escapeHtml(saved)}</textarea><div><span class="writing-count">${saved.length} 字</span><button type="button" class="save-writing-btn" data-id="${escapeHtml(article.id)}">保存仿写</button></div></div>
  </section>`;
}

function loadWritingPractice() {
  try { return JSON.parse(localStorage.getItem(WRITING_STORAGE_KEY)) || {}; }
  catch (_) { return {}; }
}

function saveWritingPractice(id) {
  const input = $(`#writing-${CSS.escape(String(id))}`);
  if (!input) return;
  const value = input.value.trim();
  if (value) state.writingPractice[id] = value;
  else delete state.writingPractice[id];
  localStorage.setItem(WRITING_STORAGE_KEY, JSON.stringify(state.writingPractice));
  showToast(value ? '仿写练习已保存' : '已清空这条仿写');
}

function deriveKnowledgeCard(article) {
  const analysis = article.analysis || {};
  const text = article.content || article.summary || '';
  const sentences = text.split(/[。！？；]/).map(item => item.trim()).filter(item => item.length > 8);
  const pick = markers => sentences.filter(sentence => markers.some(marker => sentence.includes(marker))).slice(0, 2);
  return {
    overview: sentences[0] || article.title,
    background_and_problem: pick(['问题', '短板', '挑战', '困难', '压力', '痛点']).length ? pick(['问题', '短板', '挑战', '困难', '压力', '痛点']) : ['结合当前发展阶段，相关领域仍需补齐短板、提升治理效能。'],
    significance: pick(['促进', '提升', '增强', '保障', '意义']).length ? pick(['促进', '提升', '增强', '保障', '意义']) : (analysis.key_points || []).slice(0, 2),
    measures: pick(['提出', '推动', '加强', '完善', '建立', '建设']).length ? pick(['提出', '推动', '加强', '完善', '建立', '建设']) : ['坚持问题导向，细化任务措施并压实工作责任。', '强化协同联动和跟踪问效，推动部署落地见效。'],
    evidence: sentences.filter(sentence => /\d/.test(sentence)).slice(0, 3),
    essay_thesis: `以系统思维和务实举措推动${article.category || '相关领域'}高质量发展。`,
    interview_outline: ['怎么看：结合发展大局和群众需求分析现实意义。', '怎么办：坚持问题导向，做到科学谋划、精准施策。', '怎么落实：压实责任、完善机制，并以实际成效接受检验。'],
    keywords: analysis.keywords || []
  };
}

function knowledgeCardText(article) {
  const card = article.analysis?.knowledge_card || deriveKnowledgeCard(article);
  const line = (title, value) => `${title}\n${(Array.isArray(value) ? value : [value]).filter(Boolean).map(item => `- ${item}`).join('\n')}`;
  return [`【${article.title}】`, line('一句话概括', card.overview), line('背景与问题', card.background_and_problem), line('意义价值', card.significance), line('对策路径', card.measures), line('关键数据与事实', card.evidence), line('申论分论点', card.essay_thesis), line('面试答题框架', card.interview_outline)].join('\n\n');
}

async function copyKnowledgeCard(id) {
  const article = findArticle(id);
  if (!article) return showToast('未找到这篇知识卡');
  const text = knowledgeCardText(article);
  try {
    await navigator.clipboard.writeText(text);
  } catch (_) {
    const input = document.createElement('textarea');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    input.remove();
  }
  showToast('答题卡已复制');
}

function renderContent(article) {
  const paragraphs = escapeHtml(article.content || article.summary || '')
    .split(/\n\s*\n/).map(text => text.trim()).filter(Boolean)
    .map(text => `<p>${text.replace(/\n/g, '<br>')}</p>`).join('');
  return highlightIdioms(paragraphs, getExamIdioms(article.analysis?.idioms));
}

function renderIdiomsBlock(idioms = []) {
  idioms = getExamIdioms(idioms);
  if (!idioms.length) return '';
  const cards = idioms.map(({ word, explanation, context }) => `
    <article class="idiom-card">
      <div class="idiom-word">${escapeHtml(word)}</div>
      <div class="idiom-context">语境：${escapeHtml(context)}</div>
      <div class="idiom-explanation">${escapeHtml(explanation)}</div>
    </article>`).join('');
  return `<section class="idioms-section"><div class="analysis-label">逻辑填空 · 成语辨析</div><div class="idioms-grid">${cards}</div></section>`;
}

function getExamIdioms(idioms = []) {
  return idioms.filter(item => item?.word && EXAM_IDIOMS.has(item.word));
}

function highlightIdioms(html, idioms) {
  return idioms.reduce((result, { word }) => {
    const escapedWord = escapeHtml(word);
    const pattern = escapedWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return result.replace(new RegExp(`(${pattern})`, 'g'), '<span class="idiom-hl">$1</span>');
  }, html);
}

async function switchMode(mode) {
  state.mode = mode;
  setCollectionFilter(false);
  $$('.mode-tab').forEach(tab => {
    const active = tab.dataset.mode === mode;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', active);
  });
  const historyMode = mode === 'history';
  const exploreMode = mode === 'explore';
  $('#filterPanel').hidden = historyMode || exploreMode;
  $('#historyBar').hidden = !historyMode;
  $('#learningDesk').hidden = historyMode || exploreMode || state.collectionOnly;
  $('#explorePanel').hidden = !exploreMode;
  if (historyMode) {
    state.category = 'all';
    state.keyword = '';
    $('#searchInput').value = '';
    renderHistoryDates(true);
  } else if (exploreMode) {
    $('#newsList').innerHTML = '<div class="empty-state"><strong>正在汇总专题资料</strong><span>读取今日与往期知识卡……</span></div>';
    await loadExploreArticles();
    renderTopicGrid();
    const firstTopic = getTopicsWithArticles()[0] || Object.keys(TOPICS)[0];
    selectTopic(state.currentTopic || firstTopic);
  } else {
    state.articles = state.todayArticles;
    state.currentTopic = '';
    updateOverview();
    renderNews();
  }
}

function setCollectionFilter(active) {
  state.collectionOnly = active;
  const button = $('#collectionFilter');
  button.classList.toggle('active', active);
  button.setAttribute('aria-pressed', String(active));
  button.title = active ? '退出收藏素材视图' : '查看已收藏素材';
  $('#materialTools').hidden = !active;
  $('#learningDesk').hidden = active || state.mode !== 'today';
}

function getSourceProfile(article) {
  if (article.source_profile) return article.source_profile;
  const source = `${article.source || ''} ${article.url || ''}`;
  if (/中国政府|国务院|gov\.cn\/zhengce/.test(source)) return { type: '中央政策', level: 5, learning_use: '政策背景与权威依据', why_learn: '中央权威政策，可用于把握国家部署和规范政治表述。' };
  if (/广东省人民政府|gd\.gov\.cn/.test(source)) return { type: '广东政策', level: 5, learning_use: '广东特色考点', why_learn: '广东省级权威信息，适合积累本省政策部署、工作重点和典型数据。' };
  if (/求是|评论|观点|人民时评/.test(source)) return { type: '权威评论', level: 5, learning_use: '申论论证与规范表达', why_learn: '权威评论适合学习申论分论点、论证结构与规范表达。' };
  if (/新华社|人民网|人民日报/.test(source)) return { type: '权威报道', level: 4, learning_use: '热点背景与事实素材', why_learn: '中央主流媒体报道，可用于理解政策背景并积累权威事实。' };
  if (/广东|南方|广州|深圳|羊城/.test(source)) return { type: '广东案例', level: 4, learning_use: '本地治理案例', why_learn: '广东本地实践，可作为申论举例和面试分析中的具体案例。' };
  return { type: '拓展阅读', level: 3, learning_use: '拓宽知识面', why_learn: '用于了解社会议题和实践动态，建议结合权威政策文件交叉学习。' };
}

function renderLearningDesk() {
  const pick = predicate => state.articles.find(predicate);
  const central = pick(article => getSourceProfile(article).type === '中央政策');
  const guangdong = pick(article => ['广东政策', '广东案例'].includes(getSourceProfile(article).type));
  const commentary = pick(article => getSourceProfile(article).type === '权威评论');
  const focus = state.articles.find(article => article.analysis?.exam_relevance === '高') || state.articles[0];
  const articleCard = (label, article, className) => article
    ? `<article class="desk-card ${className}"><span class="desk-card-label">${label}</span><h3>${escapeHtml(article.title)}</h3><p>${escapeHtml(getSourceProfile(article).learning_use)}</p><button type="button" data-focus-article="${escapeHtml(article.id)}">进入学习 ↓</button></article>`
    : `<article class="desk-card ${className} desk-empty"><span class="desk-card-label">${label}</span><h3>今日暂无匹配内容</h3><p>后续更新将从对应权威来源补充该学习模块。</p></article>`;
  const practice = focus ? `<article class="desk-card practice"><span class="desk-card-label">今日练习</span><h3>请根据材料，概括“${escapeHtml(focus.title)}”体现的主要做法及其意义。</h3><p>建议用时：12分钟 · 参考字数：200字</p><details class="practice-hint"><summary>查看作答提示</summary><p>从背景、措施、成效三个层次组织答案，注意使用材料中的政策关键词。</p></details><button type="button" data-focus-article="${escapeHtml(focus.id)}">查看相关知识卡 ↓</button></article>` : '';
  $('#learningDeskGrid').innerHTML = [articleCard('中央政策', central, 'central'), articleCard('广东实践', guangdong, 'guangdong'), articleCard('权威评论', commentary, 'commentary'), practice].join('');
}

function focusArticle(id) {
  const card = document.getElementById(`article-${id}`);
  if (!card) return;
  card.classList.add('expanded');
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updateListHeading() {
  $('#listTitle').textContent = state.collectionOnly ? '我的收藏' : state.mode === 'explore' ? `专题 · ${state.currentTopic}` : '权威资讯';
  $('#listHint').textContent = state.collectionOnly ? `共 ${getFilteredArticles().length} 篇收藏素材，再次点击可退出` : state.mode === 'explore' ? `汇总今日与往期 ${getFilteredArticles().length} 篇资料` : '点击文章可展开考点分析';
}

function articleMatchesTopic(article, topic) {
  const text = [article.title, article.content, article.summary, ...(article.analysis?.keywords || [])].filter(Boolean).join('');
  return TOPICS[topic].keywords.some(keyword => text.includes(keyword));
}

function getTopicsWithArticles() {
  return Object.keys(TOPICS).filter(topic => state.exploreArticles.some(article => articleMatchesTopic(article, topic)));
}

function renderTopicGrid() {
  $('#topicGrid').innerHTML = Object.entries(TOPICS).map(([name, config]) => {
    const count = state.exploreArticles.filter(article => articleMatchesTopic(article, name)).length;
    return `<button type="button" class="topic-card ${state.currentTopic === name ? 'active' : ''}" data-topic="${name}"><strong>${name}</strong><span>${config.description}</span><small>${count} 篇资料</small></button>`;
  }).join('');
}

function selectTopic(topic) {
  state.currentTopic = topic;
  state.articles = state.exploreArticles;
  $$('.topic-card').forEach(button => button.classList.toggle('active', button.dataset.topic === topic));
  const count = state.exploreArticles.filter(article => articleMatchesTopic(article, topic)).length;
  $('#topicCurrent').hidden = false;
  $('#topicCurrent').innerHTML = `<strong>${topic}</strong><span>${escapeHtml(TOPICS[topic].description)} · 共 ${count} 篇资料</span>`;
  renderNews();
  $('#topicCurrent').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function selectRandomTopic() {
  const topics = getTopicsWithArticles().filter(topic => topic !== state.currentTopic);
  if (!topics.length) return;
  selectTopic(topics[Math.floor(Math.random() * topics.length)]);
}

async function loadExploreArticles() {
  if (state.exploreArticles.length) {
    state.articles = state.exploreArticles;
    return;
  }
  const dates = typeof HISTORY_DATES !== 'undefined' ? HISTORY_DATES : [];
  const histories = await Promise.all(dates.map(ensureHistoryData));
  const all = [...state.todayArticles, ...histories.flatMap(data => data?.articles || [])];
  const seen = new Set();
  state.exploreArticles = all.filter(article => {
    const key = article.id || article.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.analysis?.exam_relevance === '高') - (a.analysis?.exam_relevance === '高'));
  indexArticles(state.exploreArticles);
  state.articles = state.exploreArticles;
}

function ensureHistoryData(date) {
  const variable = `HISTORY_${date.replace(/-/g, '')}`;
  if (window[variable]) return Promise.resolve(window[variable]);
  return new Promise(resolve => {
    const script = document.createElement('script');
    script.src = `history/${date}.js`;
    script.onload = () => resolve(window[variable] || null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
}

function renderHistoryDates(loadLatest) {
  const dates = typeof HISTORY_DATES !== 'undefined' ? HISTORY_DATES : [];
  $('#historyDates').innerHTML = dates.length
    ? dates.map(date => `<button type="button" class="history-date-btn" data-date="${date}">${date.slice(5)}</button>`).join('')
    : '<span>暂无历史数据，每日更新后这里会出现可回溯日期。</span>';
  if (loadLatest && dates.length) {
    highlightHistoryDate(dates[0]);
    loadHistoryDate(dates[0]);
  }
}

function highlightHistoryDate(date) {
  $$('.history-date-btn').forEach(button => button.classList.toggle('active', button.dataset.date === date));
}

function loadHistoryDate(date) {
  const variable = `HISTORY_${date.replace(/-/g, '')}`;
  if (window[variable]) return showHistoryArticles(date, window[variable].articles || []);
  const script = document.createElement('script');
  script.src = `history/${date}.js`;
  script.onload = () => showHistoryArticles(date, window[variable]?.articles || []);
  script.onerror = () => showEmpty('历史数据加载失败', `${date} 的记录不存在`);
  document.head.appendChild(script);
}

function showHistoryArticles(date, articles) {
  indexArticles(articles);
  $('#emptyState').hidden = true;
  $('#newsList').innerHTML = `<div class="history-date-title">${date} · 共 ${articles.length} 篇</div>${articles.map(renderCard).join('')}`;
}

function loadCollections() {
  try {
    const local = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (local && typeof local === 'object') return local;
  } catch (_) { /* 使用内嵌备份 */ }
  const saved = {};
  if (typeof EMBEDDED_NEWS_DATA !== 'undefined') {
    (EMBEDDED_NEWS_DATA.collections || []).forEach(id => { saved[id] = true; });
  }
  return saved;
}

function loadMaterials() {
  try { return JSON.parse(localStorage.getItem(MATERIAL_STORAGE_KEY)) || {}; }
  catch (_) { return {}; }
}

function getMaterial(id) {
  return state.materials[id] || { status: 'unread', priority: 'medium', tags: [], note: '' };
}

function renderMaterialMeta(material) {
  const statuses = { unread: '未学习', learning: '学习中', mastered: '已掌握' };
  const priorities = { high: '重点', medium: '常规', low: '拓展' };
  const tags = (material.tags || []).map(tag => `<span class="material-chip"># ${escapeHtml(tag)}</span>`).join('');
  return `<div class="material-meta"><span class="material-chip status-${material.status}">${statuses[material.status] || '未学习'}</span><span class="material-chip priority-${material.priority}">${priorities[material.priority] || '常规'}</span>${tags}</div>${material.note ? `<div class="material-note-preview">我的笔记：${escapeHtml(material.note)}</div>` : ''}`;
}

function matchesMaterialFilters(id) {
  const material = getMaterial(id);
  const { status, priority, tag } = state.materialFilters;
  return (status === 'all' || material.status === status)
    && (priority === 'all' || material.priority === priority)
    && (!tag || (material.tags || []).some(item => item.toLowerCase().includes(tag)));
}

function resetMaterialFilters() {
  state.materialFilters = { status: 'all', priority: 'all', tag: '' };
  $('#materialStatusFilter').value = 'all';
  $('#materialPriorityFilter').value = 'all';
  $('#materialTagFilter').value = '';
  renderNews();
}

function findArticle(id) {
  return state.articleIndex.get(String(id));
}

function indexArticles(articles) {
  articles.forEach(article => state.articleIndex.set(String(article.id), article));
}

function openMaterialEditor(id) {
  const article = findArticle(id);
  if (!article) return showToast('未找到这篇素材');
  const material = getMaterial(id);
  $('#materialArticleId').value = id;
  $('#materialArticleTitle').textContent = article.title;
  $('#materialStatus').value = material.status;
  $('#materialPriority').value = material.priority;
  $('#materialTags').value = (material.tags || []).join('，');
  $('#materialNote').value = material.note || '';
  $('#materialDialog').showModal();
}

function saveMaterial(event) {
  event.preventDefault();
  const id = $('#materialArticleId').value;
  state.materials[id] = {
    status: $('#materialStatus').value,
    priority: $('#materialPriority').value,
    tags: [...new Set($('#materialTags').value.split(/[,，]/).map(tag => tag.trim()).filter(Boolean))].slice(0, 12),
    note: $('#materialNote').value.trim(),
    updatedAt: new Date().toISOString()
  };
  localStorage.setItem(MATERIAL_STORAGE_KEY, JSON.stringify(state.materials));
  $('#materialDialog').close();
  renderNews();
  showToast('素材整理已保存');
}

function toggleCollect(id, button) {
  if (state.collections[id]) delete state.collections[id];
  else {
    state.collections[id] = true;
    if (!state.materials[id]) state.materials[id] = getMaterial(id);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.collections));
  const collected = Boolean(state.collections[id]);
  button.classList.toggle('collected', collected);
  button.textContent = collected ? '★ 已收藏' : '☆ 收藏';
  $('#statCollected').textContent = Object.keys(state.collections).length;
  if (state.collectionOnly && !collected) renderNews();
  showBackupHint();
}

function exportCollections() {
  const backup = { version: 4, collections: Object.keys(state.collections), materials: state.materials, writingPractice: state.writingPractice, examAnswers: state.examAnswers };
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: 'collections.json' });
  link.click();
  URL.revokeObjectURL(url);
  showToast(`已导出 ${Object.keys(state.collections).length} 条收藏`);
}

function importCollections() {
  const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.json,application/json' });
  input.onchange = event => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ({ target }) => {
      try {
        const data = JSON.parse(target.result);
        const ids = Array.isArray(data.collections)
          ? data.collections
          : Object.keys(data).filter(id => data[id] === true);
        ids.forEach(id => { state.collections[id] = true; });
        if (data.materials && typeof data.materials === 'object') state.materials = { ...state.materials, ...data.materials };
        if (data.writingPractice && typeof data.writingPractice === 'object') state.writingPractice = { ...state.writingPractice, ...data.writingPractice };
        if (data.examAnswers && typeof data.examAnswers === 'object') state.examAnswers = { ...state.examAnswers, ...data.examAnswers };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.collections));
        localStorage.setItem(MATERIAL_STORAGE_KEY, JSON.stringify(state.materials));
        localStorage.setItem(WRITING_STORAGE_KEY, JSON.stringify(state.writingPractice));
        localStorage.setItem(EXAM_ANSWER_STORAGE_KEY, JSON.stringify(state.examAnswers));
        $('#statCollected').textContent = Object.keys(state.collections).length;
        showToast(`成功导入 ${ids.length} 条收藏`);
        state.mode === 'today' ? renderNews() : null;
      } catch (_) { showToast('文件格式错误，请选择正确的收藏备份'); }
    };
    reader.readAsText(file);
  };
  input.click();
}

function showBackupHint() {
  const hint = $('#backupHint');
  hint.hidden = false;
  clearTimeout(state.backupTimer);
  state.backupTimer = setTimeout(() => { hint.hidden = true; }, 5000);
}

function showToast(message) {
  $('.toast-msg')?.remove();
  const toast = document.createElement('div');
  toast.className = 'toast-msg';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2800);
}

function showEmpty(title, detail) {
  $('#newsList').innerHTML = '';
  $('#emptyState').hidden = false;
  $('#emptyState').innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span>`;
}

function escapeHtml(value = '') {
  const element = document.createElement('div');
  element.textContent = String(value);
  return element.innerHTML;
}
