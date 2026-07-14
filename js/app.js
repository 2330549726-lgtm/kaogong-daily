const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const STORAGE_KEY = 'gd_exam_collections';
const MATERIAL_STORAGE_KEY = 'gd_exam_materials';
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
const VERBAL_IDIOM_DISTRACTORS = {
  举足轻重: ['至关重要', '不可或缺', '举重若轻'], 任重道远: ['负重前行', '道阻且长', '一蹴而就'],
  立竿见影: ['卓有成效', '行之有效', '事半功倍'], 雪中送炭: ['锦上添花', '济困扶危', '投桃报李'],
  锦上添花: ['雪中送炭', '精益求精', '画龙点睛'], 因地制宜: ['因势利导', '因材施教', '对症下药'],
  循序渐进: ['按部就班', '潜移默化', '稳扎稳打'], 持之以恒: ['锲而不舍', '久久为功', '孜孜不倦'],
  相得益彰: ['相辅相成', '珠联璧合', '并行不悖'], 保驾护航: ['添砖加瓦', '推波助澜', '越俎代庖'],
  日新月异: ['突飞猛进', '瞬息万变', '一日千里'], 方兴未艾: ['如火如荼', '蔚然成风', '雨后春笋'],
  前所未有: ['史无前例', '空前绝后', '绝无仅有'], 统筹兼顾: ['齐头并进', '相辅相成', '面面俱到'],
  源远流长: ['博大精深', '薪火相传', '历久弥新'], 博大精深: ['源远流长', '兼容并蓄', '蔚为大观'],
  薪火相传: ['一脉相承', '代代相传', '继往开来'], 突飞猛进: ['日新月异', '一日千里', '翻天覆地'],
  事半功倍: ['一举两得', '卓有成效', '行之有效'], 久久为功: ['持之以恒', '锲而不舍', '循序渐进']
};
const VERBAL_WORD_RULES = [
  ['完善', ['健全', '优化', '完备'], '“完善”强调在已有基础上补充改进，使制度、机制或体系更加完备。'],
  ['提升', ['提高', '扩大', '提拔'], '“提升”强调层次、水平或能力向上，常与水平、效能、质量搭配。'],
  ['促进', ['推动', '促使', '催促'], '“促进”强调推动事物向好发展，常与发展、合作、交流、就业搭配。'],
  ['推进', ['推行', '推动', '促进'], '“推进”强调工作、改革或建设按进程向前开展。'],
  ['加强', ['强化', '加深', '增添'], '“加强”强调在原有基础上增进力度，常与监管、保障、合作、治理搭配。'],
  ['优化', ['改善', '完善', '改良'], '“优化”强调调整结构或配置，使整体状态达到更优。'],
  ['保障', ['保证', '保护', '维护'], '“保障”强调提供必要条件，确保民生、权益、供给或安全得到实现。'],
  ['构建', ['建立', '建设', '创设'], '“构建”强调有系统地搭建结构、体系、机制或格局。'],
  ['推动', ['推进', '驱动', '促使'], '“推动”强调施加力量，使事业、改革或发展向前。'],
  ['激活', ['激发', '释放', '唤醒'], '“激活”强调使原本潜在或沉寂的活力、动能发挥作用。'],
  ['支持', ['支撑', '扶持', '维持'], '“支持”表示给予帮助、条件或力量，适用对象范围较广。'],
  ['发展', ['发扬', '扩展', '演变'], '“发展”强调事物向前变化，常与经济、产业、事业等对象搭配。']
];
const VERBAL_TERM_NOTES = {
  至关重要: '强调重要程度极高，但不突出其行动足以影响全局。', 不可或缺: '强调不能缺少，侧重必要性。', 举重若轻: '指处理重大问题轻松自如，侧重能力。',
  负重前行: '强调承受压力继续前进，不突出路程长。', 道阻且长: '强调道路艰险漫长，不突出责任重大。', 一蹴而就: '指一下子就成功，多用于否定句。',
  卓有成效: '强调已经取得显著成绩。', 行之有效: '强调方法实行起来确有成效。', 事半功倍: '强调投入较少而收效较大。',
  锦上添花: '比喻在已有良好基础上进一步增益。', 济困扶危: '泛指救济贫困、扶助危难。', 投桃报李: '强调友好往来或相互赠答。',
  因势利导: '顺着事物发展趋势加以引导。', 因材施教: '根据学习者特点采用不同教育方法。', 对症下药: '针对具体问题采取相应办法。',
  按部就班: '按条理和步骤办事，也可含缺乏创新意味。', 潜移默化: '强调不知不觉受到影响。', 稳扎稳打: '强调做事稳妥、有把握。',
  锲而不舍: '强调坚持到底、不轻言放弃。', 孜孜不倦: '强调勤奋努力、不知疲倦。', 相辅相成: '强调双方相互辅助、缺一不可。',
  珠联璧合: '比喻优秀的人或事物美好结合。', 并行不悖: '强调同时进行而互不冲突。', 添砖加瓦: '比喻为一项事业贡献力量。',
  推波助澜: '比喻助长事物声势，多用于贬义。', 越俎代庖: '比喻超越权限代替别人办事。', 瞬息万变: '强调在极短时间内变化很多。',
  一日千里: '强调进展速度极快。', 如火如荼: '强调气势旺盛、场面热烈。', 蔚然成风: '强调一种良好事物逐渐形成风气。',
  雨后春笋: '比喻新事物大量迅速涌现。', 史无前例: '历史上从来没有过，与前所未有高度近义。', 空前绝后: '既前所未有又后无来者，语义过重。',
  绝无仅有: '极其少有，强调稀缺而非首次出现。', 齐头并进: '强调多个方面同时向前。', 面面俱到: '强调各方面都照顾到，常指处理周全。',
  历久弥新: '强调经历长久时间仍显新意和活力。', 兼容并蓄: '强调包容吸收不同内容。', 蔚为大观: '形容事物丰富多彩，形成盛大景象。',
  一脉相承: '强调同一体系或派别前后承接。', 代代相传: '泛指一代一代传下去。', 继往开来: '强调继承前人事业并开辟未来。',
  一举两得: '强调一个行动同时得到两种好处。', 翻天覆地: '强调变化幅度巨大。', 循序渐进: '强调按照步骤逐步推进。',
  健全: '强调使体系完整并能正常发挥作用。', 完备: '侧重状态完整齐备，多作形容词。', 提高: '常指数量、质量、水平由低到高。',
  扩大: '强调范围、规模增大。', 提拔: '用于选拔人员到更高职位。', 促使: '强调外力使对象产生某种行为或变化。', 催促: '强调促使对方加快行动。',
  推行: '强调推广实行制度、政策或办法。', 强化: '强调进一步增强某种作用或特征。', 加深: '常与认识、印象、感情等搭配。', 增添: '强调增加原来没有或不足的事物。',
  改善: '强调改变原有情况使之较好。', 改良: '多指在原有基础上改进具体品种或方法。', 保证: '强调担保达到或不出问题。', 保护: '强调使对象免受损害。', 维护: '强调保持权益、秩序或稳定。',
  建立: '强调从无到有地形成。', 建设: '强调创建并持续发展，多用于事业或设施。', 创设: '强调创造条件、情境或环境。', 驱动: '强调成为内在动力。',
  激发: '强调刺激而产生活力、动力或热情。', 释放: '强调把原有潜力、红利或活力放出来。', 唤醒: '多指从沉睡状态恢复，也可作比喻。', 支撑: '强调承受并维持整体。',
  扶持: '强调帮助处于成长或弱势阶段的对象。', 维持: '强调保持现状不变。', 发扬: '常与精神、作风、传统搭配。', 扩展: '强调范围或空间向外伸展。', 演变: '强调经过较长过程发生变化。'
};
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
  sourceArticles: [],
  todayArticles: [],
  exploreArticles: [],
  importantArticles: [],
  updateDate: '',
  articleIndex: new Map(),
  category: 'all',
  mode: 'today',
  keyword: '',
  collectionOnly: false,
  currentTopic: '',
  collections: loadCollections(),
  materials: loadMaterials(),
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
  const quizOption = event.target.closest('.verbal-option');
  if (quizOption) {
    event.stopPropagation();
    const quiz = quizOption.closest('.verbal-quiz');
    $$('.verbal-option', quiz).forEach(option => option.classList.toggle('selected', option === quizOption));
    return;
  }
  const answerButton = event.target.closest('.verbal-answer-btn');
  if (answerButton) {
    event.stopPropagation();
    revealVerbalAnswer(answerButton.closest('.verbal-quiz'), answerButton);
    return;
  }
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
    state.sourceArticles = data.articles || [];
    state.updateDate = data.update_date || state.sourceArticles.map(article => article.date).sort().at(-1) || '';
    state.todayArticles = state.sourceArticles
      .filter(article => article.date === state.updateDate)
      .sort(compareNewsPriority);
    state.articles = state.todayArticles;
    indexArticles(state.sourceArticles);
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
  $('#newsList').innerHTML = articles.map((article, index) => renderCard(article, index)).join('');
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

function renderCard(article, index = -1) {
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
        ${state.mode === 'today' && index >= 0 && index < 3 ? `<span class="today-rank">今日重点 ${index + 1}</span>` : ''}
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
      ${renderVerbalQuestion(article)}
      <div class="why-learn"><strong>为什么值得学：</strong>${escapeHtml(sourceProfile.why_learn)}</div>
      ${state.mode === 'important' ? renderFeaturedReason(article) : ''}
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
    ${section('面试答题框架', card.interview_outline, 'interview-outline')}
    <div class="knowledge-keywords">${(card.keywords || article.analysis?.keywords || []).map(keyword => `<span>${escapeHtml(keyword)}</span>`).join('')}</div>
  </div>`;
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

function renderVerbalQuestion(article) {
  const question = article.analysis?.verbal_question || deriveVerbalQuestion(article);
  if (!question?.stem || question.options?.length !== 4 || !question.answer) return '';
  const letters = ['A', 'B', 'C', 'D'];
  const options = question.options.map((option, index) => `
    <button type="button" class="verbal-option" data-value="${escapeHtml(option)}">
      <span>${letters[index]}</span>${escapeHtml(option)}
    </button>`).join('');
  const optionAnalysis = (question.option_analysis || []).map(item => `
    <li class="${item.correct ? 'is-answer' : ''}"><strong>${escapeHtml(item.option)}</strong><span>${escapeHtml(item.note)}</span></li>`).join('');
  return `<section class="verbal-quiz" data-answer="${escapeHtml(question.answer)}">
    <div class="verbal-heading"><div><small>新闻原句自动出题</small><h3>${escapeHtml(question.type || '逻辑填空')}</h3></div><span>单选题</span></div>
    <p class="verbal-stem">${escapeHtml(question.stem)}</p>
    <div class="verbal-options">${options}</div>
    <div class="verbal-footer">
      <button type="button" class="verbal-answer-btn" aria-expanded="false">查看答案与解析</button>
      <span>先选一项，再核对答案</span>
    </div>
    <div class="verbal-explanation" hidden>
      <div class="verbal-answer-line"><strong>答案：${escapeHtml(question.answer)}</strong><span>${escapeHtml(question.context_relation || '搭配对应')}</span></div>
      <section><h4>① 找语境</h4><p>${escapeHtml(question.context_clue || '定位空格前后的搭配对象和关联词，推导所需含义。')}</p></section>
      <section><h4>② 辨词义</h4><p>${escapeHtml(question.explanation || `“${question.answer}”最符合原句语义和搭配。`)}</p>${optionAnalysis ? `<ul class="verbal-option-analysis">${optionAnalysis}</ul>` : ''}</section>
      <section><h4>③ 代入验证</h4><p>${escapeHtml(question.method || '将答案代回原句，核对语义、搭配、程度和感情色彩。')}</p></section>
      <div class="verbal-error-point"><strong>易错点：</strong>${escapeHtml(question.error_point || '不要只凭语感，要同时核对语境对应和固定搭配。')}</div>
    </div>
  </section>`;
}

function deriveVerbalQuestion(article) {
  const text = String(article.content || article.summary || '').replace(/\s+/g, ' ').trim();
  const sentences = text.match(/[^。！？；]+[。！？；]?/g)?.map(item => item.trim()).filter(item => item.length >= 12) || [];
  let answer = '';
  let sentence = '';
  let distractors = [];
  let explanation = '';
  let type = '逻辑填空 · 实词辨析';

  for (const item of getExamIdioms(article.analysis?.idioms)) {
    const matched = sentences.find(candidate => candidate.includes(item.word));
    if (!matched || !VERBAL_IDIOM_DISTRACTORS[item.word]) continue;
    answer = item.word;
    sentence = matched;
    distractors = VERBAL_IDIOM_DISTRACTORS[item.word];
    explanation = item.explanation || '该成语最符合原句的语义、程度和适用对象。';
    type = '逻辑填空 · 成语辨析';
    break;
  }
  if (!answer) {
    for (const [word, alternatives, note] of VERBAL_WORD_RULES) {
      const matched = sentences.find(candidate => candidate.includes(word));
      if (!matched) continue;
      answer = word;
      sentence = matched;
      distractors = alternatives;
      explanation = note;
      break;
    }
  }
  if (!answer) return null;

  const stem = sentence.replace(answer, '______');
  const options = [answer, ...distractors.slice(0, 3)];
  const shift = stableQuizIndex(`${article.title}|${answer}`) % 4;
  const shuffledOptions = [...options.slice(shift), ...options.slice(0, shift)];
  const context = detectVerbalContext(sentence, answer);
  return {
    type, stem, options: shuffledOptions, answer, explanation,
    context_relation: context.relation,
    context_clue: context.clue,
    method: '先找空格前后的关联词和搭配对象，推导所需含义；再比较选项的适用对象、语义侧重、程度和感情色彩，最后代入验证。',
    option_analysis: shuffledOptions.map(option => ({
      option,
      correct: option === answer,
      note: option === answer ? explanation : (VERBAL_TERM_NOTES[option] || '与正确项意思相近，但适用对象、语义侧重或固定搭配不同。')
    })),
    error_point: '不要凭语感或只看近义关系；本题要同时核对语境对应和固定搭配。'
  };
}

function detectVerbalContext(sentence, answer) {
  const rules = [
    ['转折对应', ['但是', '但', '然而', '却', '虽然', '尽管']],
    ['递进对应', ['不仅', '而且', '甚至', '更', '还']],
    ['因果对应', ['因此', '所以', '从而', '因而', '由于']],
    ['条件对应', ['只有', '只要', '必须', '需要', '才能']],
    ['并列对应', ['同时', '以及', '既', '又', '与', '和']]
  ];
  for (const [relation, markers] of rules) {
    const found = markers.filter(marker => sentence.includes(marker));
    if (found.length) return { relation, clue: `定位词“${found.slice(0, 2).join('、')}”提示${relation}；结合空格前后对象判断词义侧重。` };
  }
  const index = sentence.indexOf(answer);
  const objectHint = sentence.slice(index + answer.length, index + answer.length + 10).replace(/[，。；：、\s]/g, '').slice(0, 6) || '后文对象';
  return { relation: '搭配对应', clue: `重点观察“______＋${objectHint}”的动宾或修饰搭配，再比较选项适用对象。` };
}

function stableQuizIndex(text) {
  let value = 0;
  for (const char of text) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return value;
}

function revealVerbalAnswer(quiz, button) {
  if (!quiz) return;
  const answer = quiz.dataset.answer;
  const selected = $('.verbal-option.selected', quiz);
  $$('.verbal-option', quiz).forEach(option => {
    option.classList.toggle('correct', option.dataset.value === answer);
    option.classList.toggle('incorrect', option === selected && option.dataset.value !== answer);
  });
  $('.verbal-explanation', quiz).hidden = false;
  button.textContent = '答案已展开';
  button.setAttribute('aria-expanded', 'true');
  quiz.classList.add('answered');
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
  const importantMode = mode === 'important';
  $('#filterPanel').hidden = historyMode || exploreMode || importantMode;
  $('#historyBar').hidden = !historyMode;
  $('#learningDesk').hidden = historyMode || exploreMode || importantMode || state.collectionOnly;
  $('#explorePanel').hidden = !exploreMode;
  $('#importantPanel').hidden = !importantMode;
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
  } else if (importantMode) {
    $('#newsList').innerHTML = '<div class="empty-state"><strong>正在整理重点新闻</strong><span>汇总往期高相关资讯与成语素材……</span></div>';
    await loadExploreArticles();
    state.importantArticles = state.exploreArticles
      .filter(article => article.date !== state.updateDate && isImportantArticle(article))
      .sort(compareNewsPriority);
    state.articles = state.importantArticles;
    $('#importantCount').textContent = state.importantArticles.length;
    renderNews();
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

function newsPriorityScore(article) {
  const relevance = article.analysis?.exam_relevance === '高' ? 100 : 50;
  const authority = getSourceProfile(article).level * 8;
  const idioms = getExamIdioms(article.analysis?.idioms).length * 12;
  const evidence = article.analysis?.knowledge_card?.evidence?.length || 0;
  return relevance + authority + idioms + evidence * 3;
}

function compareNewsPriority(a, b) {
  return newsPriorityScore(b) - newsPriorityScore(a)
    || String(b.date).localeCompare(String(a.date));
}

function isImportantArticle(article) {
  return article.analysis?.exam_relevance === '高'
    || getExamIdioms(article.analysis?.idioms).length >= 2;
}

function renderFeaturedReason(article) {
  const reasons = [];
  if (article.analysis?.exam_relevance === '高') reasons.push('高相关重点');
  const idiomCount = getExamIdioms(article.analysis?.idioms).length;
  if (idiomCount >= 2) reasons.push(`${idiomCount} 个重要成语`);
  if (getSourceProfile(article).level >= 5) reasons.push('权威政策来源');
  return `<div class="featured-reason">${reasons.map(reason => `<span>${reason}</span>`).join('')}</div>`;
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
  $('#listTitle').textContent = state.collectionOnly ? '我的收藏' : state.mode === 'explore' ? `专题 · ${state.currentTopic}` : state.mode === 'important' ? '重点新闻' : '今日权威资讯';
  $('#listHint').textContent = state.collectionOnly ? `共 ${getFilteredArticles().length} 篇收藏素材，再次点击可退出` : state.mode === 'explore' ? `汇总今日与往期 ${getFilteredArticles().length} 篇资料` : state.mode === 'important' ? `按重要性排序，共 ${getFilteredArticles().length} 篇` : `${state.updateDate} · 当天新闻优先排序`;
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
  const all = [...state.sourceArticles, ...histories.flatMap(data => data?.articles || [])];
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
  const backup = { version: 4, collections: Object.keys(state.collections), materials: state.materials };
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
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.collections));
        localStorage.setItem(MATERIAL_STORAGE_KEY, JSON.stringify(state.materials));
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
