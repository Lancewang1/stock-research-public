#!/usr/bin/env python3
"""Build the public macro-news feed from publisher-labelled Google News RSS."""

import email.utils
import json
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "reports/2026-09-10/freeride-macro-intelligence/news-feed.json"
PUBLISHERS = {"Reuters", "Financial Times", "Bloomberg.com"}
QUERIES = (
    "US CPI Federal Reserve Reuters",
    "US inflation Federal Reserve Financial Times",
    "US CPI Federal Reserve Bloomberg",
    "US payrolls Federal Reserve Reuters",
)
KEYWORDS = ("cpi", "inflation", "fed", "federal reserve", "payroll", "jobs", "treasur", "rate")
HKT = ZoneInfo("Asia/Hong_Kong")


def fetch(query):
    params = urllib.parse.urlencode({"q": query, "hl": "en-US", "gl": "US", "ceid": "US:en"})
    request = urllib.request.Request(
        f"https://news.google.com/rss/search?{params}",
        headers={"User-Agent": "FreeRide-Macro-Calendar/1.0"},
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        return ET.fromstring(response.read())


def clean_text(value):
    value = value.strip()
    try:
        value = value.encode("cp1252").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        pass
    if "â" in value:
        try:
            value = value.encode("cp1252").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            pass
    return value


def event_id(title):
    value = title.lower()
    if "payroll" in value or "jobs" in value or "job growth" in value:
        return "us-payrolls-aug"
    if "cpi" in value or "inflation" in value:
        return "us-cpi-aug"
    return "us-fomc-sep"


def main():
    items = {}
    for query in QUERIES:
        for node in fetch(query).findall("./channel/item"):
            source_node = node.find("source")
            source = source_node.text.strip() if source_node is not None and source_node.text else ""
            if source not in PUBLISHERS:
                continue
            raw_title = clean_text(node.findtext("title") or "")
            title = re.sub(r"\s+-\s+(Reuters|Financial Times|Bloomberg\.com)$", "", raw_title)
            if not any(keyword in title.lower() for keyword in KEYWORDS):
                continue
            published = email.utils.parsedate_to_datetime(node.findtext("pubDate")).astimezone(HKT)
            link = (node.findtext("link") or "").strip()
            key = re.sub(r"\W+", " ", title.lower()).strip()
            items[key] = {
                "date": published.strftime("%d %b"),
                "time": published.strftime("%H:%M HKT"),
                "publishedAt": published.isoformat(),
                "kind": "NEWS",
                "source": "Bloomberg" if source == "Bloomberg.com" else source,
                "eventId": event_id(title),
                "title": title,
                "summary": "Public headline monitored for its read-through to the US inflation, labor and Federal Reserve event path.",
                "access": "Open original article",
                "url": link,
            }
    ordered = sorted(items.values(), key=lambda item: item["publishedAt"], reverse=True)[:18]
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "displayTimeZone": "Asia/Hong_Kong",
        "method": "Publisher-labelled Google News RSS; public headline metadata only",
        "items": ordered,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
