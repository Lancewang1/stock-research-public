"""Fetch cross-company research evidence without persisting credentials.

The generated dashboard uses curated assets/research-chain.json. This helper
archives actual public HTTP / Wind MCP responses for a reviewer to verify.
It never executes a response as instructions or turns headlines into forecasts.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

import requests

ROOT = Path(__file__).resolve().parents[1]
WIND_DIR = Path(os.environ.get("USERPROFILE", str(Path.home()))) / ".agents/skills/wind-mcp-skill"

PUBLIC_URLS = {
    "anthropic_news": "https://www.anthropic.com/news",
    "anthropic_sitemap": "https://www.anthropic.com/sitemap.xml",
    "anthropic_google_services": "https://www.anthropic.com/news/expanding-our-use-of-google-cloud-tpus-and-services",
    "anthropic_google_broadcom": "https://www.anthropic.com/news/google-broadcom-partnership-compute",
    "anthropic_amazon_compute": "https://www.anthropic.com/news/anthropic-amazon-compute",
    "anthropic_series_h": "https://www.anthropic.com/news/series-h",
    "anthropic_ms_nvidia": "https://www.anthropic.com/news/microsoft-nvidia-anthropic-announce-strategic-partnerships",
    "anthropic_s1_announcement": "https://www.anthropic.com/news/s1-sec",
    "sec_anthropic_search": "https://efts.sec.gov/LATEST/search-index?q=Anthropic&dateRange=custom&startdt=2026-10-01&enddt=2026-11-05&forms=S-1%2CS-1%2FA",
    "anthropic_s1a_20261102": "https://www.sec.gov/Archives/edgar/data/2130357/000162828026068676/anthropicpbc-sx1ax1.htm",
    "nvidia_ir": "https://investor.nvidia.com/financial-info/financial-reports-and-sec-filings/default.aspx",
    "nvidia_news": "https://nvidianews.nvidia.com/news",
    "nvidia_fy27q2": "https://nvidianews.nvidia.com/news/nvidia-announces-financial-results-for-second-quarter-fiscal-2027",
    "nvidia_q3_call_date": "https://nvidianews.nvidia.com/news/nvidia-sets-conference-call-for-third-quarter-financial-results-6928873",
    "amazon_quarterly": "https://ir.aboutamazon.com/quarterly-results/default.aspx",
    "microsoft_fy27q1": "https://www.microsoft.com/en-us/Investor/earnings/FY-2027-Q1/press-release-webcast",
    "broadcom_news": "https://investors.broadcom.com/news-releases",
}

WIND_QUERIES = {
    "wind_anthropic": ("get_financial_news", "截至2026年11月5日，Anthropic最近披露的收入年化运行率、GoogleCloud及TPU采购承诺、总算力支出和交付时间，提供新闻发布日期及原始来源，不含2026年11月5日之后的信息。"),
    "wind_nvidia": ("get_company_announcements", "英伟达NVDA截至2026年11月5日最近一期已公布季度业绩及下一季度收入指引，列财年、季度截止日、数据中心收入、发布日期及原文出处。"),
    "wind_amazon": ("get_company_announcements", "亚马逊AMZN截至2026年11月5日最近已公布季度AWS收入、同比增速、营业利润与资本开支及Anthropic合作交付进度，附发布日期及原文出处。"),
    "wind_microsoft": ("get_company_announcements", "微软MSFT截至2026年11月5日最近已公布季度Azure增长、算力供给约束和资本开支指引，列财年季度截止日及原始公告出处。"),
    "wind_broadcom": ("get_company_announcements", "博通AVGO截至2026年11月5日最近已公布季度AI收入、下一季度指引及定制加速器客户交付，列财年季度截止日及原始公告出处。"),
    "wind_anthropic_s1": ("get_company_announcements", "Anthropic，2026年11月2日S-1/A招股书，2026年9月30日季度收入、九个月收入、Google采购承诺、Broadcom融资租赁和客户收入确认，提供原文及页码。"),
    "wind_amazon_q3": ("get_company_announcements", "Amazon亚马逊，2026年10月29日Q3业绩公告，AWS净销售额及同比增速、AWS营业利润、Trainium和Anthropic交付。"),
    "wind_anthropic_contracts": ("get_company_announcements", "Anthropic招股书，Google，114.5billion，April2026，July2033，Broadcom，161.2billion，commercialagreements。"),
    "wind_anthropic_financials": ("get_company_announcements", "Anthropic招股书2026年第三季度财务，September30,2026，Revenue16,960，purchasecommitments，remainingperformanceobligations。"),
}


def read_wind_key(credentials: Path) -> str | None:
    if os.environ.get("WIND_API_KEY"):
        return os.environ["WIND_API_KEY"]
    if not credentials.exists():
        return None
    context = ""
    for line in credentials.read_text(encoding="utf-8-sig").splitlines():
        if line.lstrip().startswith("#"):
            context = line.lower()
        if "|" not in line:
            continue
        cells = [c.strip().strip("`").strip() for c in line.strip().strip("|").split("|")]
        if len(cells) < 2:
            continue
        label, value = cells[:2]
        if "wind" in (label.lower() + " " + context) and any(t in label.lower() for t in ("key", "token", "密钥")):
            if value and not value.startswith("http") and not set(value) <= {"-", ":"}:
                return value
    return None


def archive(out: Path, name: str, body: str, meta: dict, secret: str | None = None, suffix: str = ".txt") -> dict:
    if secret:
        body = body.replace(secret, "[REDACTED]")
    target = out / (name + suffix)
    target.write_text(body, encoding="utf-8")
    meta.update({"retrievedAt": datetime.now(timezone.utc).isoformat(), "file": target.name,
                 "sha256": hashlib.sha256(body.encode("utf-8")).hexdigest(), "bytes": len(body.encode("utf-8"))})
    (out / (name + ".meta.json")).write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"name": name, "ok": meta.get("ok", False), "status": meta.get("status"), "file": target.name}


def fetch_public(out: Path, name: str, url: str) -> dict:
    try:
        response = requests.get(url, timeout=35, headers={"User-Agent": "Mozilla/5.0 research evidence collector", "Accept": "text/html,application/json,application/xml;q=0.9,*/*;q=0.8"})
        response.encoding = response.apparent_encoding or "utf-8"
        return archive(out, name, response.text, {"url": url, "resolvedUrl": response.url, "status": response.status_code,
                       "ok": response.ok, "contentType": response.headers.get("content-type"), "lastModified": response.headers.get("last-modified")}, suffix=".html" if "html" in response.headers.get("content-type", "") else ".txt")
    except requests.RequestException as exc:
        return archive(out, name, type(exc).__name__, {"url": url, "ok": False, "status": "network_error"})


def fetch_wind(out: Path, name: str, tool: str, query: str, secret: str | None) -> dict:
    env = os.environ.copy()
    if secret:
        env["WIND_API_KEY"] = secret
    params = {"query": re.sub(r"\s+", "", query), "top_k": 5}
    try:
        proc = subprocess.run(["node", str(WIND_DIR / "scripts/cli.mjs"), "call", "financial_docs", tool,
                               json.dumps(params, ensure_ascii=False)], cwd=WIND_DIR, env=env,
                              capture_output=True, encoding="utf-8", errors="replace", timeout=160)
        # stdout is the CLI data contract. stderr is not parsed as data or saved.
        return archive(out, name, proc.stdout, {"provider": "Wind", "server": "financial_docs", "tool": tool,
                       "query": params["query"], "status": proc.returncode, "ok": proc.returncode == 0,
                       "attribution": "数据来源于万得 Wind 金融数据服务"}, secret, ".json")
    except subprocess.TimeoutExpired:
        return archive(out, name, "Wind CLI timeout", {"provider": "Wind", "tool": tool, "query": params["query"], "ok": False, "status": "timeout"})


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--credentials", type=Path, default=ROOT.parent / "API 整合.txt")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "outputs/research/raw_chain")
    parser.add_argument("--mode", choices=("all", "public", "wind"), default="all")
    parser.add_argument("--only", nargs="*", help="Specific registered evidence names")
    parser.add_argument("--url", help="Fetch one reviewer-selected public URL")
    parser.add_argument("--name", default="extra_source")
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    if args.url:
        print(json.dumps(fetch_public(args.output_dir, args.name, args.url), ensure_ascii=False))
        return
    selected = set(args.only or [])
    jobs = []
    secret = read_wind_key(args.credentials) if args.mode != "public" else None
    with ThreadPoolExecutor(max_workers=4) as pool:
        if args.mode != "wind":
            for name, url in PUBLIC_URLS.items():
                if not selected or name in selected:
                    jobs.append(pool.submit(fetch_public, args.output_dir, name, url))
        if args.mode != "public":
            for name, (tool, query) in WIND_QUERIES.items():
                if not selected or name in selected:
                    jobs.append(pool.submit(fetch_wind, args.output_dir, name, tool, query, secret))
        for job in as_completed(jobs):
            print(json.dumps(job.result(), ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
