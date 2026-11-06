"""Inventory local broker report archives and retain reproducible, page-based evidence.

Read-only for original PDFs/ZIPs. Outputs stay in outputs/research/local_reports.
No API, credential, network, or browser access.
"""
from __future__ import annotations

import argparse
from collections import Counter
from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path
import re
import zipfile

import fitz

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "outputs" / "research" / "local_reports"
PATTERNS = {
    "anthropic": r"\bAnthropic\b|\bClaude\b",
    "tpu": r"\bTPUs?\b|Tensor Processing",
    "broadcom": r"\bBroadcom\b|\bAVGO\b",
    "google": r"\bGoogle\b|\bAlphabet\b|\bGOOGL\b|\bGCP\b",
    "nvidia": r"\bNVIDIA\b|\bNVDA\b",
    "aws": r"\bAWS\b|Amazon Web Services",
    "azure": r"\bAzure\b",
    "capex": r"\bcapex\b|capital expenditure|capital spending|hyperscal",
}
COMPILED = {k: re.compile(v, re.I) for k, v in PATTERNS.items()}


def dump(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def archives(path: Path, chain=()):
    """Yield every leaf entry; nested ZIP bytes never become filesystem paths."""
    payload = path.read_bytes() if not chain else path
    with zipfile.ZipFile(BytesIO(payload)) as z:
        for info in z.infolist():
            if info.is_dir():
                continue
            name = info.filename
            location = (*chain, name)
            if name.lower().endswith(".zip"):
                yield {"member": " ! ".join(location), "size": info.file_size, "nestedZip": True}, None
                yield from archives(z.read(info), location)
            else:
                yield {"member": " ! ".join(location), "size": info.file_size, "nestedZip": False}, z.read(info)


def scan(source_dir: Path):
    OUT.mkdir(parents=True, exist_ok=True)
    inventory, documents, errors = [], [], []
    for path in sorted(source_dir.glob("*.zip")):
        for entry, payload in archives(path):
            entry.update(archive=str(path.resolve()), archiveName=path.name)
            if payload is None:
                inventory.append(entry)
                continue
            entry["sha256"] = sha256(payload).hexdigest()
            entry["id"] = "report-" + entry["sha256"][:16]
            entry["extension"] = Path(entry["member"]).suffix.lower()
            inventory.append(entry)
            # Other sectors are inventoried, then title-screened for this research.
            title_relevant = re.search(r"goog|alphabet|anthropic|nvidia|broadcom|TPU|cloud|hyperscal|AI.capex", entry["member"], re.I)
            if entry["extension"] != ".pdf" or not (path.name.startswith("互联网") or title_relevant):
                continue
            try:
                with fitz.open(stream=payload, filetype="pdf") as pdf:
                    pages, counts = [], Counter()
                    first_page = ""
                    for number, page in enumerate(pdf, 1):
                        text = page.get_text("text")
                        if number == 1:
                            first_page = text
                        hits = {k: len(pattern.findall(text)) for k, pattern in COMPILED.items()}
                        counts.update(hits)
                        if any(hits.values()):
                            pages.append({"page": number, "hits": hits, "text": text})
                    documents.append({**entry, "pageCount": len(pdf), "firstPage": first_page, "counts": dict(counts), "hitPages": pages})
            except Exception as exc:
                errors.append({"id": entry["id"], "type": type(exc).__name__})
    summary = {"archives": len(list(source_dir.glob("*.zip"))), "leafEntries": sum(not i["nestedZip"] for i in inventory),
               "nestedArchives": sum(i["nestedZip"] for i in inventory), "pdfs": sum(i.get("extension") == ".pdf" for i in inventory),
               "uniquePDFs": len({i["sha256"] for i in inventory if i.get("extension") == ".pdf"}),
               "scannedPDFs": len(documents), "scannedPages": sum(d["pageCount"] for d in documents), "errors": errors}
    dump(OUT / "inventory.json", {"summary": summary, "entries": inventory})
    dump(OUT / "text-index.json", documents)
    print(json.dumps(summary, ensure_ascii=False))
    ranked = sorted(documents, key=lambda d: (d["counts"]["tpu"] * 8 + d["counts"]["anthropic"] * 4 + d["counts"]["broadcom"] * 4, d["counts"]["google"]), reverse=True)
    for item in ranked[:35]:
        print(json.dumps({k: item[k] for k in ["id", "archiveName", "member", "pageCount", "counts"]}, ensure_ascii=False))


def extract(ids, render_pages):
    inventory = json.loads((OUT / "inventory.json").read_text(encoding="utf-8"))["entries"]
    seen = set()
    for entry in inventory:
        if entry.get("id") not in ids or entry["id"] in seen:
            continue
        seen.add(entry["id"])
        payload = Path(entry["archive"]).read_bytes()
        for member in entry["member"].split(" ! "):
            with zipfile.ZipFile(BytesIO(payload)) as z:
                payload = z.read(member)
        target = OUT / (entry["id"] + ".pdf")
        if not target.exists():
            target.write_bytes(payload)
        with fitz.open(target) as pdf:
            page_text = [{"page": i + 1, "text": page.get_text("text")} for i, page in enumerate(pdf)]
            dump(OUT / (entry["id"] + "-pages.json"), page_text)
            for page in render_pages:
                if 1 <= page <= len(pdf):
                    pdf[page - 1].get_pixmap(matrix=fitz.Matrix(1.4, 1.4)).save(str(OUT / f"{entry['id']}-p{page}.png"))
        print(json.dumps({"id": entry["id"], "file": str(target), "pages": len(page_text)}, ensure_ascii=False))


def build_evidence():
    """Curated only from complete pages read and visually verified in this session."""
    inv = json.loads((OUT / "inventory.json").read_text(encoding="utf-8"))
    by_id = {x.get("id"): x for x in inv["entries"]}
    summary = {**inv["summary"], "uniquePDFs": len({x["sha256"] for x in inv["entries"] if x.get("extension") == ".pdf"})}
    specs = [
        ("local-jpm-us-internet-202607", "report-1656c599b80a37bc", "J.P. Morgan", "US Internet: 2Q 2026 Preview", "2026-07", [1, 4, 5, 7, 8],
         "封面只写July 2026，没有可确认的具体发布日期；保持月度精度。p5单位USD million；p7/8分别列Mgmt Guide、Consensus、JPMe、Buyside Bar，不能混为同一来源。p1说明买方情绪源自JPM访谈/产业调研；p5来源Company reports/Bloomberg/JPM estimates，p7/8来源JPM estimates/Bloomberg。p7在2Q业绩预览内同时写end of 2Q backlog，应视为原件内部时点提示，不据此认定每条数据的具体公开日。"),
        ("local-gs-cloud-conversion-20260917", "report-7012f09b0c545072", "Goldman Sachs", "Navigating China Internet & AI models: What to do from here; key themes & refreshed ideas into year-end", "2026-09-17", [1, 13],
         "原件印刷日17 September 2026，封面1:18AM HKT；ZIP文件名20260916不是最终采用日期。p13 Exhibit19定义滚动12月增量Cloud收入/滞后一季的滚动12月capex，脚注称Alibaba external cloud与Google/Amazon以约2年错位作比较。图形柱无逐柱精确标签，不据截图强读精确数值；不是Google专属合同或容量模型。"),
        ("local-gs-tpu-supply-20251216", "report-01a50507bf698b17", "Goldman Sachs", "The 720: US Semis 2026 Outlook, Asia Tech Tour", "2025-12-16", [1],
         "原件封面16 December 2025 7:18AM HKT，文件名20251215需与印刷日期区分。p1为GS自家研究摘要：亚洲科技调研覆盖25家台湾/韩国/日本供应链公司；其中TPU反馈是供应链方向观点，不是Google订单或验收数量。"),
    ]
    sources = []
    for sid, rid, broker, title, date, pages, note in specs:
        entry = by_id[rid]
        file = f"outputs/research/local_reports/{rid}.pdf"
        if not (ROOT / file).exists():
            raise FileNotFoundError(file)
        sources.append({"id": sid, "title": f"{broker}: {title}", "broker": broker, "date": date,
                        "datePrecision": "month" if len(date) == 7 else "day", "file": file,
                        "page": "PDF页码 " + ", ".join(map(str, pages)), "pages": pages,
                        "kind": "broker_report_original", "note": note, "archive": entry["archiveName"],
                        "member": entry["member"], "sha256": entry["sha256"], "reviewedAt": "2026-11-05",
                        "useScope": "用户提供的内部研究材料；卖方原件，不等同公司事实"})
    sources[1]["publishedAt"] = "2026-09-17T01:18:00+08:00"
    sources[2]["publishedAt"] = "2025-12-16T07:18:00+08:00"
    jpm, gs_conversion, gs_supply = [s["id"] for s in sources]
    cards = [
        {"company": "Alphabet / Google Cloud", "relationship": "JPM原始研报：旧时点Cloud、资本开支与资金回报假设",
         "claim": "JPM July 2026原件p7预计TPU sales在2H26开始贡献；p5预计Google 2027 capex为293.443bn美元、FCF为−16.691bn；p7的2027 GAAP EPS预测为14.34美元。其当时展示的Consensus、JPMe和Buyside Bar分列，不能改称11月同日共识。",
         "implication": "把外售TPU系统与持续云服务分开研究，并将资本开支、折旧与现金回收列为约束。它是可追溯的历史机构假设，不能据此自动改写当前季度Cloud增长或判定本轮下跌原因。",
         "publicationDate": "2026-07", "applicablePeriod": "2H2026与2027E；报告仅有月度发布日期",
         "factors": ["cloud", "capex", "profit"], "sourceRefs": [jpm],
         "strength": "卖方原件与表格可核；时点较早，非公司指引",
         "limitations": ["封面没有具体发布日期；不用于日级历史可得性或预测准确率计算。", "TPU sales没有逐季台数、Google/Anthropic分配或收入金额。", "p5资金与利润预测为券商估计；FCF、GAAP EPS口径仍需与当前模型桥接。", "p7把2Q预览与end of 2Q backlog写在同页，不能从该页推定所有数字都在同一精确时点可得。"],
         "numericGrowthOverride": None},
        {"company": "Alibaba / Amazon / Google", "relationship": "GS跨云比较方法：资本开支到增量收入的时滞",
         "claim": "GS 2026-09-17原件p13 Exhibit19定义capex-to-revenue conversion为滚动12月Cloud收入增量除以滞后一季的滚动12月capex；脚注用Alibaba外部云收入与Google、Amazon约错位2年比较。",
         "implication": "可增加资本开支转化的观察指标，并显式保留收入范围、窗口与时滞。该图用于跨公司方法检验，不直接提供Google未来季度收入或Anthropic份额。",
         "publicationDate": "2026-09-17", "applicablePeriod": "图表滚动窗口；跨公司对比带约2年错位，不能读成同日2027共识",
         "factors": ["cloud", "capex", "gm", "ox"], "sourceRefs": [gs_conversion],
         "strength": "公式及脚注原件已核；Google数量预测不支持",
         "limitations": ["Capex并非仅Cloud投入，跨公司资产用途与融资租赁范围可能不同。", "图中的Google/Amazon历史比较有约2年错位，不得将横轴年份直接视为Google对应年度预测。", "未由图形提取缺少精确标注的柱值；未将中国云增长率套入Google。", "硬件/服务收入组合及设备确认可能改变比率，不能据该比率机械外推。"],
         "numericGrowthOverride": None},
        {"company": "Broadcom / NVIDIA / Google", "relationship": "GS供应链调研摘要：TPU与GPU供给方向",
         "claim": "GS 2025-12-16原件p1的亚洲科技调研摘要覆盖25家供应链公司，称Broadcom向Google的TPU动能很强；预计2026机架出货可翻倍以上、ASIC出货增速可能更快，并称Rubin当时预计2026年中生产、下半年放量。",
         "implication": "提供此前供应链景气的方向证据，可与后来实际交付核对；不能把机架总增速或半导体出货直接转成Google Cloud可计费收入。",
         "publicationDate": "2025-12-16", "applicablePeriod": "报告当时对2026年的预期；不包含2027逐季验收",
         "factors": ["cloud", "capex", "gm"], "sourceRefs": [gs_supply],
         "strength": "原件可核，供应链样本25家；属于旧时点方向性观点",
         "limitations": ["25家是总调研样本，不代表25家独立确认Google TPU订单。", "未披露Google/Anthropic数量、价格、2027批次或电力验收表。", "该报告早于2026实际交付披露，不替代最新公司原文。", "全机架出货可能翻倍不是Google专属数量预测。"],
         "numericGrowthOverride": None},
    ]
    metrics = []
    for suffix, metric, value, unit, period, page in [
        ("google-capex-2026", "JPM Google capex forecast", 190024, "USD mn", "2026E", 5),
        ("google-capex-2027", "JPM Google capex forecast", 293443, "USD mn", "2027E", 5),
        ("google-fcf-2027", "JPM Google FCF forecast", -16691, "USD mn", "2027E", 5),
        ("google-eps-2027", "JPM Alphabet GAAP EPS forecast", 14.34, "USD/share", "2027E", 7),
    ]:
        metrics.append({"id": "local-jpm-" + suffix, "company": "Alphabet", "metric": metric,
                        "value": value, "unit": unit, "period": period, "status": "broker_forecast_original",
                        "observationDate": "2026-07", "sourceRefs": [jpm], "page": page,
                        "notEquivalentTo": "company guidance, November consensus, or an executable forecast override"})
    payload = {"asOf": "2026-11-05", "scope": "全部研报ZIP目录盘点；互联网全文关键词检索；选定原件关键页人工阅读及视觉核对。不是708份研报逐页深读。",
               "reportInventory": {**summary, "categories": {"互联网": {"archives": 21, "pdfEntries": 316}, "消费": {"archives": 15, "pdfEntries": 237}, "有色": {"archives": 10, "pdfEntries": 155}},
                                   "inventoryFile": "outputs/research/local_reports/inventory.json", "searchIndexFile": "outputs/research/local_reports/text-index.json",
                                   "method": "ZIP目录含嵌套检查；互联网316份PDF共6282页文本检索，消费/有色只按文件名筛交叉主题；相关表格用PNG复核。关键词包括Google/Alphabet/GCP、Anthropic/Claude、TPU、Broadcom/AVGO、NVIDIA/NVDA、AWS、Azure与capex。",
                                   "deepReadScope": "保留来源3份：JPM p1/4/5/7/8；GS 2026-09-17 p1/13；GS 2025-12-16 p1。另阅读全部7份TPU命中报告的相关页作排除检查，未把弱关联中国互联网材料补成Google数字。"},
               "sources": sources, "crossCompanyEvidence": cards, "evidenceMetrics": metrics,
               "materialGaps": [{"name": name, "value": None, "reason": reason} for name, reason in [
                   ("Anthropic算力采购中Google可归属份额", "本轮研报没有可核实分配比例或逐季Google服务采购额；需合同/招股书及对应模型假设。"),
                   ("2027 TPU逐季交付、验收和计费数量", "TPU命中页仅有方向、较早放量预期或产业链进展，没有可转季度收入的数量表。"),
                   ("Google净单价与服务/设备合同拆分", "不能将第三方芯片出货或客户总融资转换为Google收入。"),
                   ("现有Google基准已含相关收入", "需对照已有MS/GS等具体假设，防止重复加上已纳入的订单。")]],
               "retrievalAudit": {"networkCalls": 0, "originalsModified": False, "fullTextExtractionErrors": summary["errors"],
                                  "visualVerification": ["JPM p5/7/8表格列、单位与来源脚注", "GS 2026-09-17 p13 Exhibit19及错位脚注", "GS 2025-12-16 p1样本与时间"]},
               "limitations": ["文档检索不等于全部资料逐项事实核验；图像内关键词或不可提取内容可能遗漏。", "没有发现可量化Google/Anthropic分配与2027季度交付的证据，并不代表该信息从未公开。", "所有新增数值都是注明月份的券商预测，不自动覆盖当前模型；未知桥接输入继续为空。"]}
    dump(ROOT / "assets" / "research-local-reports.json", payload)
    print(json.dumps({"sources": len(sources), "cards": len(cards), "metrics": len(metrics), "inventory": summary}, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, default=ROOT.parent / "外资研报")
    parser.add_argument("--scan", action="store_true")
    parser.add_argument("--extract", nargs="*", default=[])
    parser.add_argument("--render-pages", nargs="*", type=int, default=[])
    parser.add_argument("--build-evidence", action="store_true")
    args = parser.parse_args()
    if args.scan:
        scan(args.source_dir)
    if args.extract:
        extract(set(args.extract), args.render_pages)
    if args.build_evidence:
        build_evidence()
    if not args.scan and not args.extract and not args.build_evidence:
        parser.print_help()


if __name__ == "__main__":
    main()
