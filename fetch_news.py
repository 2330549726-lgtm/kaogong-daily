"""
广东考公热点资讯抓取脚本
每日运行以获取最新广东新闻并生成考点分析

用法: python fetch_news.py

新闻来源:
  - 中国政府网政策栏目 (www.gov.cn)
  - 人民网观点频道 (opinion.people.com.cn)
  - 广东省人民政府官网 (www.gd.gov.cn)
  - 人民网广东频道 (gd.people.com.cn)
  - 南方网 (www.southcn.com)

输出: news_data.json (更新)
"""

import json
import re
import hashlib
import datetime
import os
from typing import Optional

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("请先安装依赖: pip install -r requirements.txt")
    exit(1)

# ===== 配置 =====
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}


def safe_print(s: str) -> str:
    """将字符串中的特殊字符替换为安全字符，避免终端编码错误"""
    return s.encode("gbk", errors="replace").decode("gbk", errors="replace")

NEWS_SOURCES = [
    {
        "name": "中国政府网",
        "type": "html",
        "url": "https://www.gov.cn/zhengce/zuixin/",
        "base": "https://www.gov.cn",
        "selector": ".news_box a, .list li a, h4 a",
    },
    {
        "name": "人民网观点",
        "type": "html",
        "url": "http://opinion.people.com.cn/",
        "base": "http://opinion.people.com.cn",
        "selector": ".list_16 li a, h3 a, h4 a",
    },
    {
        "name": "广东省人民政府",
        "type": "json_api",  # 使用 JSON API 接口
        "api_url": "https://www.gd.gov.cn/postmeta/i/240.json",
        "base": "https://www.gd.gov.cn",
        "article_base": "https://www.gd.gov.cn/gdywdt/gdyw/content/",
    },
    {
        "name": "人民网广东",
        "type": "html",  # 传统 HTML 抓取
        "url": "http://gd.people.com.cn/",
        "base": "http://gd.people.com.cn",
        "selector": "h4 a, .list_16 li a, .swiper-slide a",  # 更新选择器
    },
    {
        "name": "南方网",
        "type": "html",
        "url": "https://www.southcn.com/",
        "base": "https://www.southcn.com",
        "selector": ".news-list a, .list-box a, h3 a, .headline a",
    },
]


def classify_source(source: str, url: str = "") -> dict:
    """按申论学习价值对来源分级，并说明内容用途。"""
    text = f"{source} {url}"
    if any(word in text for word in ["中国政府", "国务院", "gov.cn/zhengce"]):
        return {"type": "中央政策", "level": 5, "learning_use": "政策背景与权威依据", "why_learn": "中央权威政策，可用于把握国家部署和规范政治表述。"}
    if "广东省人民政府" in text or "gd.gov.cn" in text:
        return {"type": "广东政策", "level": 5, "learning_use": "广东特色考点", "why_learn": "广东省级权威信息，适合积累本省政策部署、工作重点和典型数据。"}
    if any(word in text for word in ["求是", "评论", "观点", "人民时评", "人民日报评论"]):
        return {"type": "权威评论", "level": 5, "learning_use": "申论论证与规范表达", "why_learn": "权威评论重在观点和论证结构，适合学习申论分论点与表达方式。"}
    if any(word in text for word in ["新华社", "人民网", "人民日报"]):
        return {"type": "权威报道", "level": 4, "learning_use": "热点背景与事实素材", "why_learn": "中央主流媒体报道，可用于理解政策背景并积累权威事实。"}
    if any(word in text for word in ["广东", "南方", "广州", "深圳", "羊城"]):
        return {"type": "广东案例", "level": 4, "learning_use": "本地治理案例", "why_learn": "广东本地实践，可作为申论举例和面试分析中的具体案例。"}
    return {"type": "拓展阅读", "level": 3, "learning_use": "拓宽知识面", "why_learn": "用于了解社会议题和实践动态，建议结合权威政策文件交叉学习。"}

# ===== 政策术语库（用于关键词匹配和分类） =====
POLICY_TERMS = {
    "政策": [
        "粤港澳大湾区", "高质量发展", "改革开放", "百千万工程", "乡村振兴",
        "数字政府", "放管服", "营商环境", "法治", "治理现代化", "基层治理",
        "共同富裕", "区域协调", "省委", "省政府", "人大常委会", "政协",
        "条例", "规划", "方案", "意见", "通知", "部署", "推进", "贯彻"
    ],
    "经济": [
        "民营经济", "制造业", "产业升级", "招商引资", "数字经济", "实体经济",
        "GDP", "消费", "投资", "出口", "外贸", "供应链", "产业链",
        "减税降费", "市场主体", "创新创业", "中小企业", "金融", "信贷"
    ],
    "民生": [
        "教育", "医疗", "养老", "住房", "就业", "社保", "交通",
        "城市更新", "老旧小区", "加装电梯", "公共服务", "食品安全",
        "托育", "家政", "社区", "便民", "民生实事"
    ],
    "生态": [
        "绿美广东", "生态文明", "双碳", "碳达峰", "碳中和", "碧道",
        "污染", "空气质量", "水质", "绿化", "环保", "节能减排",
        "新能源", "绿色转型", "可持续发展", "生态修复"
    ],
    "科技": [
        "人工智能", "AI", "大数据", "5G", "芯片", "半导体", "新能源",
        "科技创新", "新质生产力", "专利", "研发", "实验室", "孵化器",
        "数字经济", "数字化转型", "智能制造", "生物医药"
    ],
    "文化": [
        "文化强省", "岭南文化", "非遗", "文旅融合", "公共文化",
        "文化产业", "文艺", "博物馆", "图书馆", "传统", "英歌舞",
        "龙舟", "粤剧", "文化自信", "双创", "精神文明"
    ]
}

# 考公关键词（用于评估考试相关度）
EXAM_KEYWORDS = [
    "政策", "改革", "发展", "治理", "民生", "创新", "生态", "乡村",
    "大湾区", "高质量", "数字", "营商", "法治", "基层", "共同富裕"
]


def classify_article(title: str, summary: str) -> str:
    """基于政策术语库对新闻进行分类"""
    text = title + summary
    scores = {}
    for cat, terms in POLICY_TERMS.items():
        scores[cat] = sum(1 for t in terms if t in text)
    if max(scores.values()) == 0:
        return "政策"  # 默认分类
    return max(scores, key=scores.get)


def extract_keywords(title: str, summary: str) -> list:
    """从标题和摘要中提取政策关键词"""
    text = title + summary
    found = set()
    for terms in POLICY_TERMS.values():
        for term in terms:
            if len(term) >= 2 and term in text:
                found.add(term)
    # 最多返回6个关键词
    return list(found)[:6]


def assess_relevance(title: str, summary: str) -> str:
    """评估考试相关度"""
    text = title + summary
    score = sum(1 for kw in EXAM_KEYWORDS if kw in text)
    if score >= 4:
        return "高"
    elif score >= 2:
        return "中"
    else:
        return "低"


def generate_key_points(title: str, summary: str, keywords: list) -> list:
    """基于规则生成考点要点"""
    points = []
    text = title + summary

    # 规则1: 涉及具体政策措施
    if any(t in text for t in ["方案", "措施", "意见", "条例", "通知"]):
        points.append(f"本文涉及具体政策措施，可作为申论对策题的参考框架")

    # 规则2: 涉及数据
    numbers = re.findall(r'[\d.]+(?:%|万|亿|公里|个)', text)
    if numbers:
        points.append(f"文中包含关键数据（{', '.join(numbers[:3])}），可用于论证增强说服力")

    # 规则3: 涉及大湾区
    if "粤港澳大湾区" in text or "大湾区" in text:
        points.append("涉及粤港澳大湾区建设，是广东考公最核心的政策热点之一，建议深入掌握相关背景")

    # 规则4: 涉及百千万工程
    if "百千万" in text:
        points.append("百千万工程是广东推动区域协调发展的头号工程，面试和申论都极可能涉及")

    # 规则5: 涉及民生
    if any(t in text for t in ["教育", "医疗", "养老", "就业", "住房"]):
        points.append("涉及民生领域，可联系'以人民为中心'的发展思想作答")

    # 确保至少2条
    if len(points) < 2:
        points.append("可作为了解广东当前政策导向的素材，积累相关背景知识")
        points.append("建议关注其中体现的政府工作思路和方法论")

    return points[:4]


def build_writing_lab(title: str, category: str) -> dict:
    """生成申论表达训练；示范句均为平台整理，不冒充媒体原文。"""
    templates = {
        "政策": ("制度的生命力在于执行，政策的含金量要靠落实来检验。", "如何让好政策从纸面走进现实？关键在于细化责任、强化协同、跟踪问效。"),
        "经济": ("产业兴则经济兴，产业强则发展强。", "以创新之力激活产业动能，以改革之举优化发展环境，才能不断塑造高质量发展新优势。"),
        "民生": ("民生无小事，枝叶总关情。", "把群众的关键小事当作治理的大事，才能让发展更有温度、幸福更有质感。"),
        "生态": ("生态是发展的底色，绿色是未来的成色。", "以高水平保护支撑高质量发展，方能让生态优势源源不断转化为发展优势。"),
        "科技": ("创新是引领发展的第一动力。", "向科技创新要动力、向成果转化要效益，才能把创新变量转化为发展增量。"),
        "文化": ("文脉赓续，方能弦歌不辍。", "在保护中传承、在创新中发展，才能让优秀传统文化焕发新的时代光彩。"),
    }
    pattern, model = templates.get(category, templates["政策"])
    return {
        "argument_structure": ["开篇点明主题与现实价值", "结合材料分析问题或发展条件", "从机制、协同、落实等角度提出路径", "回扣群众获得感或高质量发展升华主题"],
        "sentence_pattern": pattern,
        "model_sentence": model,
        "imitation_prompt": f"围绕“{title}”，仿照示范表达写一句40—80字的申论句子。",
        "provenance": "平台整理表达，非新闻媒体原文",
    }


def build_knowledge_card(title: str, summary: str, category: str,
                         keywords: list, key_points: list) -> dict:
    """把资讯加工为可复习、可用于申论和面试的结构化知识卡。"""
    text = re.sub(r"\s+", " ", summary).strip()
    sentences = [s.strip() for s in re.split(r"[。！？；]", text) if len(s.strip()) >= 8]

    def pick(markers, limit=2):
        return [sentence for sentence in sentences
                if any(marker in sentence for marker in markers)][:limit]

    problems = pick(["问题", "短板", "不足", "困难", "压力", "挑战", "痛点", "堵点", "瓶颈"])
    measures = pick(["提出", "推动", "推进", "加强", "完善", "建立", "实施", "建设", "健全", "优化"], 3)
    significance = pick(["有利于", "有助于", "促进", "提升", "增强", "保障", "意义", "体现"], 2)
    evidence = [sentence for sentence in sentences if re.search(r"\d", sentence)][:3]

    category_background = {
        "政策": "推进治理体系和治理能力现代化，需要把政策部署转化为可感可及的治理成效。",
        "经济": "经济发展正由要素驱动向创新驱动、由规模速度向质量效益加快转变。",
        "民生": "人民群众对美好生活的需要日益增长，公共服务的均衡性和可及性仍需提升。",
        "生态": "高质量发展必须正确处理发展与保护的关系，持续改善生态环境质量。",
        "科技": "新一轮科技革命和产业变革深入发展，科技创新成为塑造发展新优势的关键变量。",
        "文化": "文化是城市和区域发展的深层力量，需要在保护传承中实现创造性转化、创新性发展。",
    }
    category_thesis = {
        "政策": "以系统思维推动政策落地，把制度优势更好转化为治理效能。",
        "经济": "以改革优化发展环境，以创新增强内生动力，推动经济实现质的有效提升和量的合理增长。",
        "民生": "坚持以人民为中心，在发展中保障和改善民生，让改革发展成果更多更公平惠及群众。",
        "生态": "坚定不移走生态优先、绿色发展之路，以高品质生态环境支撑高质量发展。",
        "科技": "强化科技创新引领，加快培育新质生产力，为高质量发展注入持久动能。",
        "文化": "赓续历史文脉、激发文化活力，以文化自信凝聚奋进力量。",
    }

    overview = sentences[0] if sentences else title
    if len(overview) > 90:
        overview = overview[:88] + "……"
    background = problems or [category_background.get(category, "在推进中国式现代化的新征程上，需要以改革创新破解发展难题。")] 
    if not significance:
        significance = key_points[:2] or [f"该实践为推进{category}领域高质量发展提供了有益参考。"]
    if not measures:
        measures = ["坚持问题导向和目标导向相统一，细化任务、压实责任。",
                    "强化协同联动和要素保障，推动各项部署落地见效。"]

    return {
        "overview": overview,
        "background_and_problem": background,
        "significance": significance,
        "measures": measures,
        "evidence": evidence,
        "essay_thesis": category_thesis.get(category, "坚持系统观念和问题导向，以务实举措推动高质量发展。"),
        "interview_outline": [
            f"怎么看：从{category}领域高质量发展和群众实际需求理解事件意义。",
            "怎么办：坚持问题导向，做到科学谋划、协同推进、精准施策。",
            "怎么落实：压实责任、完善机制、强化监督，并以群众满意度检验成效。",
        ],
        "keywords": keywords[:6],
        "writing_lab": build_writing_lab(title, category),
    }


def analyze_article(title: str, summary: str) -> dict:
    """对单篇文章进行考点分析"""
    category = classify_article(title, summary)
    keywords = extract_keywords(title, summary)
    relevance = assess_relevance(title, summary)
    key_points = generate_key_points(title, summary, keywords)
    idioms = extract_idioms(title, summary, key_points)
    knowledge_card = build_knowledge_card(title, summary, category, keywords, key_points)

    # 适用题型判断
    topics = ["申论大作文"]
    if any(t in title + summary for t in ["方案", "措施", "问题", "对策"]):
        topics.append("申论对策题")
    if any(t in title + summary for t in ["数据", "增长", "同比", "占比"]):
        topics.append("申论归纳概括")
    if relevance == "高":
        topics.append("面试综合分析")

    return {
        "keywords": keywords,
        "exam_relevance": relevance,
        "applicable_topics": topics,
        "key_points": key_points,
        "suggested_usage": f"适用于{category}类话题的素材积累，建议熟记关键词和核心要点，在答{topics[0]}时可灵活运用。",
        "idioms": idioms,
        "knowledge_card": knowledge_card,
    }


# ===== 广东省考言语理解·逻辑填空成语库 =====
# 只收录可用于逻辑填空辨析的规范成语，不收录政策术语、固定搭配和普通四字短语。
# 例如：“高质量发展”“营商环境”“减税降费”“走在前列”均不属于成语。
COMMON_IDIOMS = {
    "举足轻重": "地位重要，足以影响全局。辨析：侧重影响力大；‘至关重要’侧重重要程度。",
    "任重道远": "责任重大，道路遥远，需要长期奋斗。辨析：侧重任务重且时间长；‘负重前行’侧重承受压力继续前进。",
    "立竿见影": "比喻立即见效。辨析：侧重见效速度快；‘卓有成效’侧重已经取得显著效果。",
    "雪中送炭": "在他人急需时给予帮助。辨析：强调困境中的及时帮助；‘锦上添花’是在已有好基础上进一步增益。",
    "锦上添花": "比喻使美好的事物更加美好。辨析：以原有基础较好为前提；反义为‘雪中送炭’所对应的不同语境。",
    "因地制宜": "根据当地实际情况制定适宜办法。辨析：侧重地点和客观条件；‘因势利导’侧重顺应趋势加以引导。",
    "循序渐进": "按照一定次序逐步深入或提高。辨析：侧重步骤有序；‘潜移默化’侧重不知不觉受到影响。",
    "持之以恒": "长久坚持而不松懈。辨析：侧重有恒心；‘锲而不舍’侧重坚持到底、不轻言放弃。",
    "相得益彰": "彼此配合，双方的长处更加显现。辨析：强调互相促进并使优势更突出；‘相辅相成’强调相互辅助、缺一不可。",
    "保驾护航": "比喻为某项工作或事物发展提供保护。辨析：适用于保障、支持语境，不等同于直接推动发展。",
    "日新月异": "每天都有更新，形容变化发展很快。辨析：侧重不断出现新变化；‘突飞猛进’侧重发展速度迅猛。",
    "方兴未艾": "事物正在兴起，尚未停止。辨析：只能用于正在蓬勃发展的事物；‘如火如荼’侧重气势旺盛、场面热烈。",
    "前所未有": "以前从未有过。辨析：侧重历史上没有出现过；‘空前绝后’还含以后也不会再有之意，语义更重。",
    "统筹兼顾": "统一筹划，同时照顾各个方面。辨析：侧重全面协调；‘齐头并进’侧重多个方面同时推进。",
    "源远流长": "源头很远，流程很长，比喻历史悠久。辨析：多形容文化、传统、历史；‘根深蒂固’侧重基础牢固且难以改变。",
    "博大精深": "形容思想、学说等广博而深奥。辨析：兼具范围广与程度深，不能只表示历史悠久。",
    "薪火相传": "比喻学问、技艺或精神代代传承。辨析：强调精神文化的延续；‘一脉相承’还强调同一血统或体系。",
    "突飞猛进": "形容进步和发展特别迅速。辨析：侧重速度与幅度；‘日新月异’侧重新事物、新变化不断出现。",
    "事半功倍": "用较少的精力取得较大的成效。辨析：强调投入少、收效大；反义为‘事倍功半’。",
    "久久为功": "持续用力、长期积累才能取得成效。辨析：侧重长期积累后的成效；‘持之以恒’侧重坚持的态度。",
}


def extract_idioms(title: str, summary: str, key_points: list) -> list:
    """严格提取省考逻辑填空成语；普通四字短语和政策术语不进入结果。"""
    full_text = title + summary + " ".join(key_points)
    found = []
    seen = set()

    for word, explanation in COMMON_IDIOMS.items():
        if word in full_text and word not in seen:
            seen.add(word)
            # 找到成语在文中的具体语境
            context = ""
            for text in [summary] + key_points:
                if word in text:
                    # 截取包含成语的句子片段
                    idx = text.find(word)
                    start = max(0, idx - 15)
                    end = min(len(text), idx + len(word) + 15)
                    context = text[start:end].strip()
                    if start > 0:
                        context = "..." + context
                    if end < len(text):
                        context = context + "..."
                    break
            found.append({
                "word": word,
                "explanation": explanation,
                "context": context or f"文中出现：{word}",
            })

    return found[:6]  # 最多6个成语


def fetch_source(source: dict) -> list:
    """从单个新闻源抓取新闻，支持 JSON API 和 HTML 两种模式"""
    source_type = source.get("type", "html")
    if source_type == "json_api":
        return fetch_json_api(source)
    else:
        return fetch_html_source(source)


def fetch_json_api(source: dict) -> list:
    """从 JSON API 接口抓取新闻（用于广东省政府等 NFCMS 站点）"""
    articles = []
    try:
        resp = requests.get(source["api_url"], headers=HEADERS, timeout=15)
        resp.encoding = "utf-8"
        data = resp.json()
        items = data.get("articles", [])
        for item in items[:10]:  # 取前 10 篇
            title = item.get("title", "").strip()
            # 清理 HTML 标签
            title = re.sub(r"<br\s*/?>", " ", title)
            title = re.sub(r"<[^>]+>", "", title)
            title = re.sub(r"\s+", " ", title).strip()

            if not title or len(title) < 8:
                continue

            url = item.get("url", "")
            if not url:
                url = f"{source['article_base']}post_{item['id']}.html"

            summary = item.get("abstract", "").strip()
            # 如果摘要为空，尝试从详情页获取内容
            if not summary:
                summary = fetch_article_content(url) or title

            articles.append({
                "title": title,
                "source": source["name"],
                "url": url,
                "summary": summary,
            })
    except Exception as e:
        print(f"  [警告] 抓取 {source['name']} API 失败: {e}")

    return articles


def clean_content(text: str) -> str:
    """清理文章正文，去除导航面包屑和元数据"""
    # 去除 "首页 > 要闻动态 > 要闻" 等面包屑导航
    text = re.sub(r'首页\s*>\s*(要闻动态\s*>\s*)?(要闻|政务公开|互动交流|走进广东)\s*', '', text)
    # 去除 "时间 : 2026-05-28 16:04:30" 等元数据行
    text = re.sub(r'时间\s*:\s*\d{4}[-/]\d{2}[-/]\d{2}\s*[\d:]*', '', text)
    # 去除 "来源 : xxx"
    text = re.sub(r'来源\s*:\s*\S+', '', text)
    # 去除 "【打印】 【字体: ...】" "我的收藏 收藏" 等
    text = re.sub(r'【[^】]*】', '', text)
    text = re.sub(r'我的收藏\s*收藏', '', text)
    # 清理多余空白
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def fetch_article_content(url: str) -> str:
    """尝试从文章详情页提取正文内容"""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        resp.encoding = resp.apparent_encoding or "utf-8"
        soup = BeautifulSoup(resp.text, "lxml")
        # 尝试多个常见正文容器
        for selector in [".con", ".zw", ".article-content", ".content", "article", ".news-content"]:
            elem = soup.select_one(selector)
            if elem:
                text = elem.get_text(separator=" ", strip=True)
                text = clean_content(text)
                if len(text) > 50:
                    return text[:500]
        # 尝试从 meta description 获取
        meta = soup.select_one('meta[name="description"]')
        if meta:
            desc = meta.get("content", "")
            if desc:
                return clean_content(desc)[:500]
    except Exception:
        pass
    return ""


def fetch_html_source(source: dict) -> list:
    """从 HTML 页面抓取新闻（传统 BeautifulSoup 方式）"""
    articles = []
    try:
        resp = requests.get(source["url"], headers=HEADERS, timeout=15)
        resp.encoding = resp.apparent_encoding or "utf-8"
        soup = BeautifulSoup(resp.text, "lxml")

        # 先尝试用配置的 CSS 选择器
        items = soup.select(source["selector"])
        seen_titles = set()

        for item in items:
            link = item if item.name == "a" else item.find("a")
            if not link:
                continue

            title = link.get("title") or link.get_text(strip=True)
            href = link.get("href", "")
            if not title or len(title) < 8:
                continue
            if title in seen_titles:
                continue
            seen_titles.add(title)

            # 补全 URL
            if href and not href.startswith("http"):
                if href.startswith("//"):
                    href = "https:" + href
                elif href.startswith("/"):
                    href = source["base"].rstrip("/") + href
                else:
                    href = source["base"].rstrip("/") + "/" + href.lstrip("/")

            # 尝试获取摘要
            summary = title  # 默认用标题
            parent = item.parent
            if parent:
                summary_elem = parent.find(["p", "span", "div"])
                if summary_elem:
                    s = summary_elem.get_text(strip=True)
                    if len(s) > 10:
                        summary = s

            articles.append({
                "title": title,
                "source": source["name"],
                "url": href,
                "summary": summary,
            })
            if len(articles) >= 8:
                break

    except Exception as e:
        print(f"  [警告] 抓取 {source['name']} 失败: {e}")

    return articles


# ===== 收藏持久化 =====
def load_collections() -> dict:
    """从 collections.json 加载收藏数据，兼容数组和字典两种格式"""
    try:
        with open("collections.json", "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list):
                return {id: True for id in data}
            if isinstance(data, dict) and "collections" in data:
                return {id: True for id in data["collections"]}
            return data if isinstance(data, dict) else {}
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def save_collections(collections: dict):
    """保存收藏数据到 collections.json"""
    with open("collections.json", "w", encoding="utf-8") as f:
        json.dump(collections, f, ensure_ascii=False, indent=2)


def generate_sample_data() -> list:
    """生成示例数据（当网络抓取不可用时），标记为 is_sample 避免归档重复"""
    samples = [
        {
            "title": "广东省委召开全省高质量发展大会 部署新一年重点工作",
            "source": "南方日报",
            "url": "https://www.gd.gov.cn/",
            "summary": "全省高质量发展大会在广州召开，会议深入学习贯彻习近平总书记视察广东重要讲话精神，聚焦制造业当家、科技创新、百千万工程等重点任务，为广东在推进中国式现代化建设中走在前列作出部署。",
        },
        {
            "title": "广东发布优化营商环境三年行动方案 提出30项改革举措",
            "source": "广东省人民政府",
            "url": "https://www.gd.gov.cn/",
            "summary": "省政府印发优化营商环境三年行动方案，围绕市场准入、政务服务、监管执法等领域推出30项改革举措，力争到2028年广东营商环境达到国际一流水平。",
        },
        {
            "title": "珠三角九市联动推进大气污染防治 空气优良天数持续提升",
            "source": "人民网广东",
            "url": "http://gd.people.com.cn/",
            "summary": "珠三角九市生态环境部门签署联防联控协议，协同推进臭氧和PM2.5治理，今年一季度珠三角空气质量优良天数比例达94.6%，同比提升2.3个百分点。",
        },
        {
            "title": "广东持续推进'粤菜师傅''广东技工''南粤家政'三项工程",
            "source": "南方网",
            "url": "https://www.southcn.com/",
            "summary": "省人社厅通报三项工程最新进展：累计培训'粤菜师傅'15万人次、'广东技工'200万人次、'南粤家政'80万人次，有力促进了城乡劳动者技能就业和收入增长。",
        },
        {
            "title": "广东省数字经济发展指数位居全国首位",
            "source": "南方日报",
            "url": "https://www.gd.gov.cn/",
            "summary": "中国信通院发布《中国数字经济发展指数报告》，广东以87.3分位居全国第一。数据显示，广东数字经济规模占GDP比重已超过50%，成为推动高质量发展的核心引擎。",
        },
    ]

    today = datetime.date.today().isoformat()
    result = []
    for i, sample in enumerate(samples):
        title = sample["title"]
        summary = sample["summary"]
        analysis = analyze_article(title, summary)
        result.append({
            "id": hashlib.md5(title.encode()).hexdigest()[:8],
            "title": title,
            "source": sample["source"],
            "url": sample["url"],
            "date": today,
            "category": classify_article(title, summary),
            "summary": summary,
            "analysis": analysis,
            "is_sample": True,  # 标记为示例数据，不会被归档到历史
        })

    return result


def archive_old_auto_articles(old_data: dict) -> list:
    """将旧的自动文章归档到 history/ 目录，返回归档的日期列表"""
    os.makedirs("history", exist_ok=True)
    archived_dates = []

    auto_articles = [a for a in old_data.get("articles", [])
                     if a.get("source_type") == "auto"
                     and not a.get("is_sample")
                     and a.get("analysis", {}).get("exam_relevance") in {"高", "中"}]
    if not auto_articles:
        return archived_dates

    # 按日期分组
    by_date = {}
    for a in auto_articles:
        d = a.get("date", "unknown")
        by_date.setdefault(d, []).append(a)

    for date_str, articles in by_date.items():
        # 跳过今天的（还没过完）
        if date_str == datetime.date.today().isoformat():
            continue
        history_file = f"history/{date_str}.js"
        if os.path.exists(history_file):
            continue  # 已归档，跳过
        js_var = f"HISTORY_{date_str.replace('-', '')}"
        content = f"var {js_var} = " + json.dumps({
            "date": date_str,
            "articles": articles,
        }, ensure_ascii=False, indent=2) + ";"
        with open(history_file, "w", encoding="utf-8") as f:
            f.write(content)
        archived_dates.append(date_str)
        print(f"  [归档] {date_str} -> {history_file} ({len(articles)} 篇)")

    return archived_dates


def update_history_index():
    """更新历史日期索引文件"""
    os.makedirs("history", exist_ok=True)
    dates = []
    if os.path.exists("history"):
        for fname in os.listdir("history"):
            if fname.endswith(".js") and fname[:10].count("-") == 2:
                d = fname[:10]
                dates.append(d)
    dates.sort(reverse=True)

    with open("js/history_index.js", "w", encoding="utf-8") as f:
        f.write("var HISTORY_DATES = " + json.dumps(dates, ensure_ascii=False) + ";")
    return dates


def main():
    print("=" * 60)
    print("  广东考公热点资讯抓取工具")
    print(f"  运行时间: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    today = datetime.date.today().isoformat()
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # 读取已有数据
    existing_articles = []
    old_auto_dates = []
    try:
        with open("news_data.json", "r", encoding="utf-8") as f:
            old_data = json.load(f)
            for a in old_data.get("articles", []):
                if a.get("source_type") == "manual":
                    existing_articles.append(a)
        if existing_articles:
            print(f"\n[0] 保留了 {len(existing_articles)} 篇手工编写文章")

        # 归档旧的自动文章
        print("[归档] 检查是否有旧数据需要归档...")
        old_auto_dates = archive_old_auto_articles(old_data)
        if not old_auto_dates:
            print("  无需归档")
    except (FileNotFoundError, json.JSONDecodeError):
        pass

    # 尝试从各新闻源抓取
    all_articles = []
    print("\n[1] 正在抓取新闻...")
    for source in NEWS_SOURCES:
        url = source.get("url") or source.get("api_url", "")
        print(f"  -> {source['name']} ({url})")
        articles = fetch_source(source)
        print(f"     获取到 {len(articles)} 篇")
        all_articles.extend(articles)

    # 分析并标记为 auto
    new_auto_articles = []
    if len(all_articles) >= 3:
        print(f"\n[2] 正在分析考点 (共{len(all_articles)}篇)...")
        for i, article in enumerate(all_articles):
            analysis = analyze_article(article["title"], article["summary"])
            new_auto_articles.append({
                "id": hashlib.md5(article["title"].encode()).hexdigest()[:8],
                "title": article["title"],
                "source": article["source"],
                "url": article["url"],
                "date": today,
                "category": classify_article(article["title"], article["summary"]),
                "content": article["summary"],
                "analysis": analysis,
                "source_type": "auto",
                "source_profile": classify_source(article["source"], article["url"]),
            })
            print(f"  [{i+1}/{len(all_articles)}] {safe_print(article['title'][:40])}... => {analysis['exam_relevance']}相关")
    else:
        print("\n[!] 抓取数量不足，使用示例数据补充...")
        samples = generate_sample_data()
        for i, article in enumerate(samples):
            analysis = analyze_article(article["title"], article["summary"])
            new_auto_articles.append({
                "id": hashlib.md5(article["title"].encode()).hexdigest()[:8],
                "title": article["title"],
                "source": article["source"],
                "url": article["url"],
                "date": today,
                "category": classify_article(article["title"], article["summary"]),
                "content": article["summary"],
                "analysis": analysis,
                "source_type": "auto",
                "is_sample": True,  # 示例数据，不会被归档
                "source_profile": classify_source(article["source"], article["url"]),
            })
            print(f"  [{i+1}/{len(samples)}] {article['title'][:40]}... => {analysis['exam_relevance']}相关")

    # 只保留高/中相关资讯，低相关新闻既不展示也不写入文件。
    existing_articles = [
        article for article in existing_articles
        if article.get("analysis", {}).get("exam_relevance") in {"高", "中"}
    ]
    for article in existing_articles:
        article["source_profile"] = classify_source(article.get("source", ""), article.get("url", ""))
    new_auto_articles = [
        article for article in new_auto_articles
        if article.get("analysis", {}).get("exam_relevance") in {"高", "中"}
    ]

    # 合并：手工文章在前，自动文章在后
    manual_titles = {a["title"] for a in existing_articles}
    deduped_auto = [a for a in new_auto_articles if a["title"] not in manual_titles]

    final_articles = existing_articles + deduped_auto[:12]

    # 更新历史索引
    history_dates = update_history_index()

    # 加载收藏数据
    collections = load_collections()
    collection_ids = list(collections.keys()) if collections else []

    output = {
        "update_time": now_str,
        "update_date": today,
        "history_dates": history_dates,
        "articles": final_articles,
        "collections": collection_ids,
    }

    with open("news_data.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    # 同步生成 JS
    js_content = "var EMBEDDED_NEWS_DATA = " + json.dumps(output, ensure_ascii=False, indent=2) + ";"
    with open("js/news_data.js", "w", encoding="utf-8") as f:
        f.write(js_content)

    print(f"\n[3] 已保存: {len(existing_articles)} 篇手工 + {len(deduped_auto[:12])} 篇自动 = {len(final_articles)} 篇")
    if history_dates:
        print(f"    历史归档: {len(history_dates)} 天可用")
    print("=" * 60)
    print("  完成! 在浏览器中打开 index.html 查看最新资讯")
    print("  手工编写文章已自动保护，不会被覆盖")
    print("=" * 60)


if __name__ == "__main__":
    main()
