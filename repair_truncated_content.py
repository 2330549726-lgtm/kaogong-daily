"""修复旧数据中被历史 500 字符限制截断的新闻正文。"""

import json
import pathlib
import time

from fetch_news import analyze_article, fetch_article_content


ROOT = pathlib.Path(__file__).resolve().parent
NEWS_JSON = ROOT / "news_data.json"
NEWS_JS = ROOT / "js" / "news_data.js"
HISTORY_DIR = ROOT / "history"


def load_history(path: pathlib.Path) -> dict:
    raw = path.read_text(encoding="utf-8")
    payload = raw.split("=", 1)[1].rsplit(";", 1)[0]
    return json.loads(payload)


def write_history(path: pathlib.Path, data: dict) -> None:
    variable = f"HISTORY_{data['date'].replace('-', '')}"
    path.write_text(
        f"var {variable} = " + json.dumps(data, ensure_ascii=False, indent=2) + ";",
        encoding="utf-8",
    )


def existing_text(article: dict) -> str:
    return (article.get("content") or article.get("summary") or "").strip()


def needs_repair(article: dict) -> bool:
    text = existing_text(article)
    return bool(article.get("url")) and (len(text) == 500 or len(text) <= 100 or "相关文章" in text)


def is_better_content(content: str, old_text: str) -> bool:
    """更长正文优先；旧内容混入推荐列表时，较短但干净的正文也应替换。"""
    old_cut_mid_sentence = len(old_text) == 500 and old_text[-1:] not in "。！？；”’）)"
    clean_complete = len(content) >= 120 and content[-1:] in "。！？；”’）)"
    return (len(content) > len(old_text)
            or ("相关文章" in old_text and len(content) >= 120)
            or (old_cut_mid_sentence and clean_complete))


def apply_content(article: dict, content: str) -> None:
    article["content"] = content
    article.pop("summary", None)
    article["analysis"] = analyze_article(article.get("title", ""), content)


def main() -> None:
    news = json.loads(NEWS_JSON.read_text(encoding="utf-8"))
    history_files = sorted(HISTORY_DIR.glob("*.js"))
    histories = {path: load_history(path) for path in history_files}

    def usable_article(article: dict) -> bool:
        title = article.get("title", "")
        text = existing_text(article)
        is_textless_infographic = (title.startswith("图解：") or title.startswith("图解:")) and "相关文章" in text
        return not is_textless_infographic

    before_count = len(news.get("articles", [])) + sum(len(data.get("articles", [])) for data in histories.values())
    news["articles"] = [article for article in news.get("articles", []) if usable_article(article)]
    for data in histories.values():
        data["articles"] = [article for article in data.get("articles", []) if usable_article(article)]
    after_count = len(news.get("articles", [])) + sum(len(data.get("articles", [])) for data in histories.values())
    removed_unusable = before_count - after_count
    all_articles = list(news.get("articles", []))
    for data in histories.values():
        all_articles.extend(data.get("articles", []))

    candidates = {}
    for article in all_articles:
        if needs_repair(article):
            candidates.setdefault(article.get("url", ""), existing_text(article))

    print(f"发现 {len(candidates)} 个需要补全的原文链接")
    repaired = {}
    failed = []
    for index, (url, old_text) in enumerate(candidates.items(), 1):
        content = fetch_article_content(url)
        if is_better_content(content, old_text):
            repaired[url] = content
            print(f"[{index}/{len(candidates)}] 已补全 {len(old_text)} -> {len(content)} 字")
        else:
            failed.append(url)
            print(f"[{index}/{len(candidates)}] 未取得更完整正文")
        time.sleep(0.15)

    changed = 0
    for article in all_articles:
        content = repaired.get(article.get("url", ""))
        if content and is_better_content(content, existing_text(article)):
            apply_content(article, content)
            changed += 1

    NEWS_JSON.write_text(json.dumps(news, ensure_ascii=False, indent=2), encoding="utf-8")
    NEWS_JS.write_text(
        "var EMBEDDED_NEWS_DATA = " + json.dumps(news, ensure_ascii=False, indent=2) + ";",
        encoding="utf-8",
    )
    write_failures = []
    for path, data in histories.items():
        try:
            write_history(path, data)
        except OSError as error:
            write_failures.append((path, str(error)))
            print(f"历史文件写入失败，将继续处理其他日期：{path.name} ({error})")

    print(f"完成：更新 {changed} 条数据记录，移除无文字图解 {removed_unusable} 条，成功链接 {len(repaired)} 个，抓取失败 {len(failed)} 个，写入失败 {len(write_failures)} 个")
    if failed:
        print("未修复链接：")
        print("\n".join(failed))
    if write_failures:
        print("未写入历史文件：")
        print("\n".join(path.name for path, _ in write_failures))


if __name__ == "__main__":
    main()
