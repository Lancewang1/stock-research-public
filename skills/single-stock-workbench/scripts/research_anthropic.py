"""Anthropic public filing research, with credentials kept only in memory."""
from __future__ import annotations
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import requests

from research_chain import fetch_wind, read_wind_key

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "outputs/research/raw_anthropic"
AS_OF = "2026-11-05"


def user_agent():
    note = ROOT.parent / "API 整合.txt"
    if note.exists():
        for line in note.read_text(encoding="utf-8-sig").splitlines():
            cells = [x.strip().strip("`") for x in line.split("|")]
            if len(cells) > 3 and cells[1] == "SEC_USER_AGENT":
                return cells[2]
    return "Research evidence collector"


def fetch(name, url):
    """No repeated requests to a blocked document, no alternate blocked host tricks."""
    OUT.mkdir(parents=True, exist_ok=True)
    meta_path = OUT / f"{name}.meta.json"
    if meta_path.exists():
        old = json.loads(meta_path.read_text(encoding="utf-8"))
        return {"id": name, "httpStatus": old.get("httpStatus"), "reused": True, "file": old.get("file")}
    meta = {"id": name, "url": url, "retrievedAt": datetime.now(timezone.utc).isoformat(), "researchAsOf": AS_OF}
    try:
        response = requests.get(url, headers={"User-Agent": user_agent() if "sec.gov/" in url else "Research evidence collector", "Accept": "application/json,text/html,application/pdf,*/*"}, timeout=40)
        suffix = ".pdf" if "application/pdf" in response.headers.get("content-type", "") else ".json" if "json" in response.headers.get("content-type", "") else ".html"
        path = OUT / (name + suffix)
        path.write_bytes(response.content)
        meta.update(httpStatus=response.status_code, ok=response.ok, contentType=response.headers.get("content-type"), file=path.name,
                    bytes=len(response.content), sha256=hashlib.sha256(response.content).hexdigest(), resolvedUrl=response.url)
    except requests.RequestException as exc:
        meta.update(ok=False, errorType=type(exc).__name__)
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    return {k: meta.get(k) for k in ("id", "httpStatus", "ok", "file", "bytes", "errorType")}


def wind_items(name):
    raw = json.loads((OUT / f"{name}.json").read_text(encoding="utf-8"))
    return json.loads(raw["content"][0]["text"])["data"]["items"]


def build():
    """Build a dated evidence snapshot; missing original financials stay unknown."""
    chain = json.loads((ROOT / "assets/research-chain.json").read_text(encoding="utf-8"))
    sources = {s["id"]: s for s in chain["sources"]}
    reused = ["chain-anthropic-series-h-20260528", "chain-anthropic-financial-news-20261103",
              "chain-sec-anthropic-20261102", "chain-anthropic-google-20251023",
              "chain-anthropic-google-20260406", "chain-anthropic-aws-20260420",
              "chain-anthropic-ms-nv-20251118"]
    source_list = [sources[s] for s in reused]
    for name, title, page in [
        ("anthropic-submissions", "SEC Anthropic submissions：S-1及S-1/A提交记录", "filings.recent，accession 0001628280-26-067168 / 0001628280-26-068676"),
        ("anthropic-companyfacts", "SEC Anthropic companyfacts：本次快照只有发行费标签", "facts.ffd；未返回收入、成本、现金或现金流财务标签"),
    ]:
        meta = json.loads((OUT / f"{name}.meta.json").read_text(encoding="utf-8"))
        source_list.append({"id": name, "title": title, "date": AS_OF,
            "file": f"outputs/research/raw_anthropic/{meta['file']}", "page": page,
            "url": meta["url"], "kind": "regulatory_api", "retrievedAt": meta["retrievedAt"],
            "note": "直接取得SEC JSON；其可验证范围不包括完整招股书正文。"})
    excerpt_ids = []
    for name, page in [
        ("wind_s1a_statement", "data.items[0]：S-1 p133 Our Financial Model；F-14 Note 1费用重分类；F-7及现金流表为摘要"),
        ("wind_s1_commitment_note13", "data.items[0]：S-1 p137–138 Compute Investments / Anthropic Direct；合同义务表数值未取得"),
    ]:
        item = next(x for x in wind_items(name) if x["date"] == "2026-10-26" and "Form S-1 " in x["title"])
        sid = "anthropic-" + name.replace("_", "-")
        excerpt_ids.append(sid)
        source_list.append({"id": sid, "title": item["title"] + "（Wind摘录）", "date": item["date"],
            "file": f"outputs/research/raw_anthropic/{name}.json", "page": page, "url": item["url"],
            "kind": "wind_filing_excerpt", "originalBodyVerified": False,
            "note": "数据来源于万得Wind金融数据服务。返回文本混合英文摘录和中文表格摘要；只保留可定位的英文叙述，不把摘要当原始财表，也不将10-26版本当11-02修订版。"})
    original_card = next(c for c in chain["crossCompanyEvidence"] if c.get("company") == "Anthropic" and c.get("relationship") == "客户商业化、融资与信用质量")
    updated_card = {
        "company": "Anthropic", "relationship": "客户商业化、融资与信用质量",
        "claim": "2026-05-28公司公告称当月年化收入运行率超过47bn美元，Series H融资65bn美元，其中包括此前15bn已承诺投资。SEC记录确认10-26提交S-1、11-02提交S-1/A；本轮仍未取得修订版确认收入、现金和现金流原始表。",
        "implication": "把客户需求增长、融资公告与可用于支付算力的现金分开研究。尚不能据此计算现金跑道、Google采购覆盖率或可归属Cloud收入。",
        "sourceRefs": ["chain-anthropic-series-h-20260528", "chain-anthropic-financial-news-20261103", "anthropic-submissions", "anthropic-companyfacts", excerpt_ids[0]],
        "limitations": [
            "47bn是2026年5月run-rate revenue，不是11月ARR或全年确认收入；官方未将其定义为经常性订阅ARR。",
            "65bn融资包含15bn先前承诺，公告金额不等同于期末可用现金；不能与投资方公告再次相加。",
            "Wind新闻所报Q3收入16.96bn、前九个月33.24bn未获原始表核验，value继续为空，不能进入自动预测。",
            "SEC companyfacts仅返回五个ffd发行费标签；其中TtlOfferingAmt的1bn不是融资到账或财务报表数据。",
            "Wind取得的是10-26 S-1摘录，表格多被摘要替代；11-02 S-1/A原始表仍缺，不能由旧版或摘要补齐。"
        ],
        "strength": "5月官方运行率与融资：强；当期确认收入、现金及成本：未核验",
        "factors": ["客户需求", "回款与信用", "多云采购预算"], "publicationDate": "2026-11-03"
    }
    accounting_card = {
        "company": "Anthropic", "relationship": "客户算力成本、现金消耗与采购结构",
        "claim": "Wind转录的10-26 S-1叙述称算力先承诺、上线后计入可供研究、模型开发、客户服务和内部使用的资源池；费用表改按compute and infrastructure等性质分类。p137–138另描述Anthropic Direct把芯片租赁与机房托管分别采购。",
        "implication": "支付能力需同时检查客户确认收入、全口径算力费用、现金流、已支付预付款及未来承诺；向Google、Broadcom与托管商的支付要按合同范围去重。",
        "sourceRefs": excerpt_ids,
        "limitations": [
            "这是有页码的Wind英文摘录，未取得或目视核对SEC原始正文；中文表格摘要未作为数值来源。",
            "compute and infrastructure覆盖多种工作负载，不等于cost of revenue，也不能据此直接计算推理毛利率。",
            "芯片租赁、数据中心托管、云服务、资本开支、费用确认和现金付款是不同口径；114.5bn与161.2bn仍未完成原始合同范围及重叠核验。",
            "摘录中的总承诺、现金、授信余额金额缺失；不能通过run-rate、融资公告或个别应付款反推。",
            "合同期限、容量、实际验收、Google可归属份额、季度履约和基准已含继续为空；2027承诺不前移至2026Q4。"
        ],
        "strength": "费用分类与采购结构：Wind披露摘录；金额与季度桥接：缺证据",
        "factors": ["回款与信用", "算力成本", "Cloud收入增速", "收入确认节奏"], "publicationDate": "2026-10-26"
    }
    specs = [
        ("anthropic-recognized-revenue-q3", "GAAP确认收入", "2026Q3", 16.96, "chain-anthropic-financial-news-20261103", "新闻线索未获11-02修订版原始财表核验。"),
        ("anthropic-recognized-revenue-9m", "GAAP确认收入", "2026前九个月", 33.24, "chain-anthropic-financial-news-20261103", "新闻线索未获原始财表核验；不与5月run-rate直接比较。"),
        ("anthropic-compute-infrastructure-expense", "Compute and infrastructure费用", "2026当期", None, excerpt_ids[0], "费用表按性质分类；覆盖研究、训练、推理等，不直接等同于cost of revenue。"),
        ("anthropic-cost-of-revenue", "收入成本", "2026当期", None, excerpt_ids[0], "主表不再单列；需核对补充按功能分类附注原表，不能用算力费用替代。"),
        ("anthropic-cash-equivalents", "现金及现金等价物", "2026-09-30", None, excerpt_ids[1], "现金余额原始表未取得；融资65bn与注册费基数1bn均不得代入。"),
        ("anthropic-operating-cash-flow", "经营现金流净额", "2026前九个月", None, excerpt_ids[0], "现金流原始表未取得，无法核验现金消耗或预付算力现金流分类。"),
        ("anthropic-actual-cloud-payments", "已支付云服务/算力采购现金", "2026当期", None, excerpt_ids[1], "年度/多年度采购承诺不是当期现金付款；供应商分拆、账期和预付款不足。"),
        ("anthropic-available-liquidity", "可用流动性", "2026-09-30", None, excerpt_ids[1], "需分别核验非受限现金、短期投资、可提款授信、条件融资和近期到期付款。")
    ]
    metrics = []
    for sid, metric, period, reported, ref, note in specs:
        row = {"id": sid, "company": "Anthropic", "metric": metric, "period": period, "value": None,
            "unit": "USD bn", "status": "pending_original_financials", "sourceRefs": [ref], "note": note,
            "automaticForecastEligible": False}
        if reported is not None:
            row["reportedValue"] = reported
            row["status"] = "secondary_report_unverified"
        metrics.append(row)
    gap_specs = [
        ("Anthropic最新确认收入、成本、现金及现金流", "11-02 S-1/A原始财务表及MD&A；10-26摘录不能代替修订版数值。"),
        ("Google 114.5bn与Broadcom 161.2bn合同范围及重叠", "需原始服务采购/设备租赁条款、期限、付款表、已含金额及相互关系；二手新闻数字不进入量化。"),
        ("算力交付与收入确认季度安排", "2026既有扩容与2027新5GW分开；需实际交付、验收和计费条件，不以合同总额除年数平均分配。"),
        ("多云采购中的Google可归属份额", "AWS、Azure、Google/Broadcom及Anthropic Direct口径不同；可能更新同一承诺，不能按公告数字简单累加。"),
        ("客户短期付款能力与现金跑道", "需到期付款与现金余额、现金流、授信可提款额及条件融资逐项对应，融资公告不足以证明。"),
        ("现有Google预测基准已含收入", "对照MS/GS季度Cloud模型假设；新增证据不代表净新增，基准已含不得默认0。")
    ]
    query_audit = []
    for path in sorted(OUT.glob("wind_*.json")):
        if path.name.endswith(".meta.json"):
            continue
        items = wind_items(path.stem)
        query_audit.append({"file": str(path.relative_to(ROOT)).replace("\\", "/"), "returnedItems": len(items),
            "anthropicItems": sum("ANTHROPIC" in x.get("title", "").upper() for x in items),
            "originalFinancialTablesVerified": False})
    sec = json.loads((OUT / "anthropic-submissions.json").read_text(encoding="utf-8"))["filings"]["recent"]
    recent_filings = [{k: sec[k][i] for k in ["form", "filingDate", "accessionNumber", "primaryDocument", "isXBRL"]}
                      for i in range(len(sec["form"])) if sec["form"][i] in ("S-1", "S-1/A")]
    facts = json.loads((OUT / "anthropic-companyfacts.json").read_text(encoding="utf-8"))["facts"]
    result = {
        "asOf": AS_OF, "scope": "Anthropic客户收入、现金与多云采购的公开资料核验；非可执行预测输入",
        "sources": source_list, "crossCompanyEvidence": [updated_card, accounting_card], "evidenceMetrics": metrics,
        "supersedesEvidence": [{"company": original_card["company"], "claim": original_card["claim"],
            "replacementCompany": updated_card["company"], "replacementClaim": updated_card["claim"],
            "reason": "更新检索状态与费用口径，未将任何待核数字升级为原文已核验。"}],
        "materialGaps": [{"name": name, "value": None, "reason": reason} for name, reason in gap_specs],
        "audit": {"publicSourcesOnly": True, "secSubmissionsVerified": recent_filings,
            "companyfactsTaxonomies": list(facts), "companyfactsTags": {k: list(v) for k,v in facts.items()},
            "financialFactsPresent": False, "originalS1aBodyVerified": False,
            "blockedOriginal": "已存档SEC Archives S-1/A请求403；本轮未重试该被拒正文，也未绕过访问限制。",
            "browserOrVisualToolsUsed": False, "windQueries": query_audit,
            "quantitativePendingClaimsUpgraded": 0},
        "generatedAt": datetime.now(timezone.utc).isoformat()
    }
    ids = {s["id"] for s in source_list}
    for card in result["crossCompanyEvidence"] + metrics:
        assert all(ref in ids for ref in card["sourceRefs"])
    for source in source_list:
        assert (ROOT / source["file"]).exists(), source["file"]
        assert source["date"] <= AS_OF, source["date"]
    assert all(m["value"] is None for m in metrics)
    path = ROOT / "assets/research-anthropic.json"
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8")
    return {"file": str(path), "sources": len(source_list), "cards": 2, "metrics": len(metrics),
            "gaps": len(gap_specs), "quantitativePendingClaimsUpgraded": 0}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--probe", action="store_true")
    parser.add_argument("--url")
    parser.add_argument("--name", default="selected_public_source")
    parser.add_argument("--wind-query")
    parser.add_argument("--build", action="store_true")
    args = parser.parse_args()
    if args.probe:
        jobs = [("anthropic-submissions", "https://data.sec.gov/submissions/CIK0002130357.json"),
                ("anthropic-companyfacts", "https://data.sec.gov/api/xbrl/companyfacts/CIK0002130357.json")]
        with ThreadPoolExecutor(max_workers=2) as pool:
            for result in pool.map(lambda pair: fetch(*pair), jobs):
                print(json.dumps(result, ensure_ascii=False), flush=True)
    if args.url:
        print(json.dumps(fetch(args.name, args.url), ensure_ascii=False))
    if args.wind_query:
        OUT.mkdir(parents=True, exist_ok=True)
        key = read_wind_key(ROOT.parent / "API 整合.txt")
        print(json.dumps(fetch_wind(OUT, args.name, "get_company_announcements", args.wind_query, key), ensure_ascii=False))
    if args.build:
        print(json.dumps(build(), ensure_ascii=False))


if __name__ == "__main__":
    main()
