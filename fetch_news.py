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
import subprocess
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
    }


def analyze_article(title: str, summary: str) -> dict:
    """对单篇文章进行考点分析"""
    category = classify_article(title, summary)
    keywords = extract_keywords(title, summary)
    relevance = assess_relevance(title, summary)
    key_points = generate_key_points(title, summary, keywords)
    idioms = extract_idioms(title, summary, key_points)
    knowledge_card = build_knowledge_card(title, summary, category, keywords, key_points)
    verbal_question = build_verbal_question(title, summary, idioms)

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
        "verbal_question": verbal_question,
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

# 逻辑填空干扰项只从固定辨析组中产生，避免把无关词语随机塞进选项。
IDIOM_DISTRACTORS = {
    "举足轻重": ["至关重要", "不可或缺", "举重若轻"],
    "任重道远": ["负重前行", "道阻且长", "一蹴而就"],
    "立竿见影": ["卓有成效", "行之有效", "事半功倍"],
    "雪中送炭": ["锦上添花", "济困扶危", "投桃报李"],
    "锦上添花": ["雪中送炭", "精益求精", "画龙点睛"],
    "因地制宜": ["因势利导", "因材施教", "对症下药"],
    "循序渐进": ["按部就班", "潜移默化", "稳扎稳打"],
    "持之以恒": ["锲而不舍", "久久为功", "孜孜不倦"],
    "相得益彰": ["相辅相成", "珠联璧合", "并行不悖"],
    "保驾护航": ["添砖加瓦", "推波助澜", "越俎代庖"],
    "日新月异": ["突飞猛进", "瞬息万变", "一日千里"],
    "方兴未艾": ["如火如荼", "蔚然成风", "雨后春笋"],
    "前所未有": ["史无前例", "空前绝后", "绝无仅有"],
    "统筹兼顾": ["齐头并进", "相辅相成", "面面俱到"],
    "源远流长": ["博大精深", "薪火相传", "历久弥新"],
    "博大精深": ["源远流长", "兼容并蓄", "蔚为大观"],
    "薪火相传": ["一脉相承", "代代相传", "继往开来"],
    "突飞猛进": ["日新月异", "一日千里", "翻天覆地"],
    "事半功倍": ["一举两得", "卓有成效", "行之有效"],
    "久久为功": ["持之以恒", "锲而不舍", "循序渐进"],
}

# 没有规范成语的新闻，改考政策新闻中的高频实词搭配，确保每篇新闻都有一题。
WORD_QUESTION_RULES = [
    ("完善", ["健全", "优化", "完备"], "‘完善’强调在已有基础上补充改进，使制度、机制或体系更加完备。"),
    ("提升", ["提高", "扩大", "提拔"], "‘提升’强调层次、水平或能力向上，常与水平、效能、质量搭配。"),
    ("促进", ["推动", "促使", "催促"], "‘促进’强调推动事物向好发展，常与发展、合作、交流、就业搭配。"),
    ("推进", ["推行", "推动", "促进"], "‘推进’强调工作、改革或建设按进程向前开展。"),
    ("加强", ["强化", "加深", "增添"], "‘加强’强调在原有基础上增进力度，常与监管、保障、合作、治理搭配。"),
    ("优化", ["改善", "完善", "改良"], "‘优化’强调调整结构或配置，使整体状态达到更优。"),
    ("保障", ["保证", "保护", "维护"], "‘保障’强调提供必要条件，确保民生、权益、供给或安全得到实现。"),
    ("构建", ["建立", "建设", "创设"], "‘构建’强调有系统地搭建结构、体系、机制或格局。"),
    ("推动", ["推进", "驱动", "促使"], "‘推动’强调施加力量，使事业、改革或发展向前。"),
    ("激活", ["激发", "释放", "唤醒"], "‘激活’强调使原本潜在或沉寂的活力、动能发挥作用。"),
    ("支持", ["支撑", "扶持", "维持"], "‘支持’表示给予帮助、条件或力量，适用对象范围较广。"),
    ("发展", ["发扬", "扩展", "演变"], "‘发展’强调事物向前变化，常与经济、产业、事业等对象搭配。"),
]

TERM_NOTES = {
    "至关重要": "强调重要程度极高，但不突出其行动足以影响全局。", "不可或缺": "强调不能缺少，侧重必要性。", "举重若轻": "指处理重大问题轻松自如，侧重能力。",
    "负重前行": "强调承受压力继续前进，不突出路程长。", "道阻且长": "强调道路艰险漫长，不突出责任重大。", "一蹴而就": "指一下子就成功，多用于否定句。",
    "卓有成效": "强调已经取得显著成绩。", "行之有效": "强调方法实行起来确有成效。", "事半功倍": "强调投入较少而收效较大。",
    "锦上添花": "比喻在已有良好基础上进一步增益。", "济困扶危": "泛指救济贫困、扶助危难。", "投桃报李": "强调友好往来或相互赠答。",
    "因势利导": "顺着事物发展趋势加以引导。", "因材施教": "根据学习者特点采用不同教育方法。", "对症下药": "针对具体问题采取相应办法。",
    "按部就班": "按条理和步骤办事，也可含缺乏创新意味。", "潜移默化": "强调不知不觉受到影响。", "稳扎稳打": "强调做事稳妥、有把握。",
    "锲而不舍": "强调坚持到底、不轻言放弃。", "孜孜不倦": "强调勤奋努力、不知疲倦。", "相辅相成": "强调双方相互辅助、缺一不可。",
    "珠联璧合": "比喻优秀的人或事物美好结合。", "并行不悖": "强调同时进行而互不冲突。", "添砖加瓦": "比喻为一项事业贡献力量。",
    "推波助澜": "比喻助长事物声势，多用于贬义。", "越俎代庖": "比喻超越权限代替别人办事。", "瞬息万变": "强调在极短时间内变化很多。",
    "一日千里": "强调进展速度极快。", "如火如荼": "强调气势旺盛、场面热烈。", "蔚然成风": "强调一种良好事物逐渐形成风气。",
    "雨后春笋": "比喻新事物大量迅速涌现。", "史无前例": "历史上从来没有过，与前所未有高度近义。", "空前绝后": "既前所未有又后无来者，语义过重。",
    "绝无仅有": "极其少有，强调稀缺而非首次出现。", "齐头并进": "强调多个方面同时向前。", "面面俱到": "强调各方面都照顾到，常指处理周全。",
    "历久弥新": "强调经历长久时间仍显新意和活力。", "兼容并蓄": "强调包容吸收不同内容。", "蔚为大观": "形容事物丰富多彩，形成盛大景象。",
    "一脉相承": "强调同一体系或派别前后承接。", "代代相传": "泛指一代一代传下去。", "继往开来": "强调继承前人事业并开辟未来。",
    "一举两得": "强调一个行动同时得到两种好处。", "翻天覆地": "强调变化幅度巨大。", "循序渐进": "强调按照步骤逐步推进。",
    "健全": "强调使体系完整并能正常发挥作用。", "完备": "侧重状态完整齐备，多作形容词。", "提高": "常指数量、质量、水平由低到高。",
    "扩大": "强调范围、规模增大。", "提拔": "用于选拔人员到更高职位。", "促使": "强调外力使对象产生某种行为或变化。", "催促": "强调促使对方加快行动。",
    "推行": "强调推广实行制度、政策或办法。", "强化": "强调进一步增强某种作用或特征。", "加深": "常与认识、印象、感情等搭配。", "增添": "强调增加原来没有或不足的事物。",
    "改善": "强调改变原有情况使之较好。", "改良": "多指在原有基础上改进具体品种或方法。", "保证": "强调担保达到或不出问题。", "保护": "强调使对象免受损害。", "维护": "强调保持权益、秩序或稳定。",
    "建立": "强调从无到有地形成。", "建设": "强调创建并持续发展，多用于事业或设施。", "创设": "强调创造条件、情境或环境。", "驱动": "强调成为内在动力。",
    "激发": "强调刺激而产生活力、动力或热情。", "释放": "强调把原有潜力、红利或活力放出来。", "唤醒": "多指从沉睡状态恢复，也可作比喻。", "支撑": "强调承受并维持整体。",
    "扶持": "强调帮助处于成长或弱势阶段的对象。", "维持": "强调保持现状不变。", "发扬": "常与精神、作风、传统搭配。", "扩展": "强调范围或空间向外伸展。", "演变": "强调经过较长过程发生变化。",
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


def build_verbal_question(title: str, summary: str, idioms: list) -> Optional[dict]:
    """从新闻原句生成一道四选一逻辑填空题，答案位置按标题稳定打散。"""
    text = re.sub(r"\s+", " ", summary).strip()
    sentences = [s.strip() for s in re.split(r"(?<=[。！？；])", text) if len(s.strip()) >= 12]

    answer = ""
    explanation = ""
    distractors = []
    focus = "逻辑填空 · 实词辨析"
    sentence = ""

    for item in idioms:
        word = item.get("word", "")
        matched = next((s for s in sentences if word in s), "")
        if matched and word in IDIOM_DISTRACTORS:
            answer = word
            sentence = matched
            distractors = IDIOM_DISTRACTORS[word]
            explanation = COMMON_IDIOMS[word]
            focus = "逻辑填空 · 成语辨析"
            break

    if not answer:
        for word, alternatives, note in WORD_QUESTION_RULES:
            matched = next((s for s in sentences if word in s), "")
            if matched:
                answer = word
                sentence = matched
                distractors = alternatives
                explanation = note
                break

    if not answer or not sentence:
        return None

    stem = sentence.replace(answer, "______", 1)

    options = [answer] + distractors[:3]
    shift = int(hashlib.md5(f"{title}|{answer}".encode()).hexdigest()[:2], 16) % 4
    options = options[shift:] + options[:shift]
    relation, clue = detect_verbal_context(sentence, answer)
    option_analysis = []
    for option in options:
        if option == answer:
            option_analysis.append({"option": option, "correct": True, "note": explanation})
        else:
            note = TERM_NOTES.get(option, "与正确项意思相近，但适用对象、语义侧重或固定搭配不同。")
            option_analysis.append({"option": option, "correct": False, "note": note})
    return {
        "type": focus,
        "stem": stem,
        "options": options,
        "answer": answer,
        "answer_index": options.index(answer),
        "explanation": explanation,
        "context_relation": relation,
        "context_clue": clue,
        "method": "先找空格前后的关联词和搭配对象，推导所需含义；再比较四个选项的适用对象、语义侧重、程度和感情色彩，最后代入验证。",
        "option_analysis": option_analysis,
        "error_point": "不要凭语感或只看近义关系；本题要同时核对语境对应和固定搭配。",
        "source_based": True,
    }


def detect_verbal_context(sentence: str, answer: str) -> tuple[str, str]:
    """按言语理解语境分析法标注最主要的对应关系和定位线索。"""
    rules = [
        ("转折对应", ["但是", "但", "然而", "却", "虽然", "尽管"]),
        ("递进对应", ["不仅", "而且", "甚至", "更", "还"]),
        ("因果对应", ["因此", "所以", "从而", "因而", "由于"]),
        ("条件对应", ["只有", "只要", "必须", "需要", "才能"]),
        ("并列对应", ["同时", "以及", "既", "又", "与", "和"]),
    ]
    for relation, markers in rules:
        found = [marker for marker in markers if marker in sentence]
        if found:
            return relation, f"定位词“{'、'.join(found[:2])}”提示{relation}；结合空格前后对象判断词义侧重。"
    idx = sentence.find(answer)
    following = sentence[idx + len(answer):idx + len(answer) + 10].strip("，。；：、 ")
    object_hint = following[:6] or "后文对象"
    return "搭配对应", f"重点观察“______＋{object_hint}”的动宾或修饰搭配，再比较选项适用对象。"


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
            # 纯图片“图解”页没有可靠文字正文，不能据此生成材料题。
            if title.startswith("图解：") or title.startswith("图解:"):
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
    # 正文容器有时把“相关文章”列表一并包入，必须在推荐区之前截断。
    text = re.split(r'\s*相关文章\s*', text, maxsplit=1)[0]
    # 去除 "首页 > 要闻动态 > 要闻" 等面包屑导航
    text = re.sub(r'首页\s*>\s*(要闻动态\s*>\s*)?(要闻|政务公开|互动交流|走进广东)\s*', '', text)
    # 去除 "时间 : 2026-05-28 16:04:30" 等元数据行
    text = re.sub(r'时间\s*:\s*\d{4}[-/]\d{2}[-/]\d{2}\s*[\d:]*', '', text)
    # 去除 "来源 : xxx"
    text = re.sub(r'来源\s*:\s*\S+', '', text)
    # 去除 "【打印】 【字体: ...】" "我的收藏 收藏" 等
    text = re.sub(r'【[^】]*】', '', text)
    text = re.sub(r'我的收藏\s*收藏', '', text)
    text = re.sub(r'分享(?:到)?\s*[：:]?', '', text)
    # 清理多余空白
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def fetch_article_content(url: str) -> str:
    """尝试从文章详情页提取正文内容"""
    html = b""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        resp.raise_for_status()
        html = resp.content
    except Exception:
        # 广东政府站点偶尔会提前关闭 Python TLS 连接，curl 的 HTTP/1.1 兼容性更好。
        try:
            result = subprocess.run(
                ["curl.exe", "--http1.1", "--tlsv1.2", "--retry", "2",
                 "--retry-all-errors", "-L", "-sS", "-A", HEADERS["User-Agent"], url],
                capture_output=True,
                check=False,
                timeout=35,
            )
            if result.returncode == 0:
                html = result.stdout
        except Exception:
            html = b""

    if not html:
        return ""

    try:
        soup = BeautifulSoup(html, "lxml")
        # 尝试多个常见正文容器
        # 具体正文选择器优先，避免先命中包裹导航和分享按钮的外层容器。
        for selector in [".zw", "#rm_txt_zw", ".rm_txt_con", ".article-content", ".view-content", ".TRS_Editor", "article", ".news-content", ".con", ".content"]:
            elem = soup.select_one(selector)
            if elem:
                text = elem.get_text(separator=" ", strip=True)
                text = clean_content(text)
                if len(text) > 50:
                    return text
        # 尝试从 meta description 获取
        meta = soup.select_one('meta[name="description"]')
        if meta:
            desc = meta.get("content", "")
            if desc:
                return clean_content(desc)
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
            if title.startswith("图解：") or title.startswith("图解:"):
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
    # 数据文件也保持“当天优先、重要性优先”，避免旧的手工文章排在今日资讯之前。
    final_articles.sort(key=lambda article: (
        article.get("date") == today,
        article.get("analysis", {}).get("exam_relevance") == "高",
        article.get("source_profile", {}).get("level", 0),
        len(article.get("analysis", {}).get("idioms", [])),
    ), reverse=True)

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
