#!/usr/bin/env python3
"""Build the offline GOOGL case from supplied files, without Excel or network access.

Reads saved OOXML values directly. Does not evaluate formulas, refresh external
links, run macros, modify workbooks, or rely on a previous extraction directory.
"""
from __future__ import annotations

import argparse
import calendar
import hashlib
import io
import json
import math
from pathlib import Path
import re
import sys
from datetime import datetime, timedelta, timezone
import xml.etree.ElementTree as ET
import zipfile

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
ROOT = Path(__file__).resolve().parents[1]
SEGMENTS = [
    {"key": "search", "label": "搜索及其他"},
    {"key": "youtube", "label": "YouTube 广告"},
    {"key": "network", "label": "网络"},
    {"key": "cloud", "label": "Google Cloud"},
    {"key": "subs", "label": "订阅 / 平台 / 设备"},
    {"key": "bets", "label": "Other Bets"},
]
MS_ROWS = {"revenue": 16, "cogs": 18, "operatingIncome": 54,
           "otherIncome": 64, "taxRate": 84, "netIncome": 86,
           "eps": 90, "dilutedShares": 94, "capex": 220, "cfo": 322,
           "sbc": 44, "depreciation": 46, "amortization": 47}
SEG_ROWS = {"search": 26, "youtube": 33, "network": 58,
            "cloud": 93, "subs": 99, "bets": 105}


def col_number(letters):
    result = 0
    for char in letters:
        result = result * 26 + ord(char) - 64
    return result


def col_name(number):
    result = ""
    while number:
        number, remainder = divmod(number - 1, 26)
        result = chr(65 + remainder) + result
    return result


def number(value):
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) else None


def excel_date(value):
    value = number(value)
    if value is None or not 35000 <= value <= 55000:
        return None
    return (datetime(1899, 12, 30) + timedelta(days=value)).date()


class CachedWorkbook:
    """Small read-only OOXML adapter preserving missing values and source cells."""
    def __init__(self, content, label):
        self.label = label
        self.sha256 = hashlib.sha256(content).hexdigest()
        self.zip = zipfile.ZipFile(io.BytesIO(content))
        self.cache = {}
        self.strings = []
        if "xl/sharedStrings.xml" in self.zip.namelist():
            self.strings = ["".join(x.itertext()) for x in ET.fromstring(self.zip.read("xl/sharedStrings.xml"))]
        book = ET.fromstring(self.zip.read("xl/workbook.xml"))
        rels = {x.get("Id"): x.get("Target") for x in ET.fromstring(self.zip.read("xl/_rels/workbook.xml.rels"))}
        self.sheets = {}
        for item in book.find("m:sheets", NS):
            target = rels[item.get(REL)]
            self.sheets[item.get("name")] = target.lstrip("/") if target.startswith("/") else "xl/" + target
        calc = book.find("m:calcPr", NS)
        names = book.find("m:definedNames", NS)
        self.structure = {
            "sheets": list(self.sheets),
            "externalLinkCount": len([n for n in self.zip.namelist() if re.fullmatch(r"xl/externalLinks/externalLink\d+\.xml", n)]),
            "definedNameCount": 0 if names is None else len(names),
            "calculationSettings": {} if calc is None else calc.attrib,
            "hasVbaProject": any(n.lower().endswith("vbaproject.bin") for n in self.zip.namelist()),
        }

    def sheet(self, sheet):
        if sheet not in self.cache:
            if sheet not in self.sheets:
                raise ValueError(f"{self.label}: missing sheet {sheet}")
            root = ET.fromstring(self.zip.read(self.sheets[sheet]))
            cells = {}
            for cell in root.findall(".//m:sheetData/m:row/m:c", NS):
                raw = cell.find("m:v", NS)
                value = None if raw is None else raw.text
                kind = cell.get("t")
                if kind == "s" and value is not None:
                    value = self.strings[int(value)]
                elif kind == "inlineStr":
                    inline = cell.find("m:is", NS)
                    value = "" if inline is None else "".join(inline.itertext())
                elif value is not None and kind not in ("str", "e"):
                    try:
                        value = float(value)
                    except ValueError:
                        pass
                formula = cell.find("m:f", NS)
                if value is not None or formula is not None:
                    cells[cell.get("r")] = {"value": value, "formula": formula is not None, "error": kind == "e"}
            self.cache[sheet] = cells
        return self.cache[sheet]

    def value(self, sheet, address):
        return self.sheet(sheet).get(address, {}).get("value")

    def numeric(self, sheet, address, required=True):
        value = number(self.value(sheet, address))
        if required and value is None:
            raise ValueError(f"{self.label}: missing/non-numeric cached value {sheet}!{address}")
        return value

    def expect_label(self, sheet, cell, text):
        actual = str(self.value(sheet, cell) or "").strip()
        if actual.casefold() != text.casefold():
            raise ValueError(f"{self.label}: mapping changed at {sheet}!{cell}; expected {text!r}, got {actual!r}")


class DemoSource:
    def __init__(self, source_dir):
        self.root = source_dir
        archives = sorted(source_dir.glob("stock-dashboard-demo*.zip"))
        self.zip = None
        if archives:
            if len(archives) != 1:
                raise ValueError("Multiple demo ZIP files found; provide a source directory with exactly one version.")
            self.archive = archives[0]
            self.zip = zipfile.ZipFile(self.archive)
        else:
            roots = [source_dir / "stock-dashboard-demo", source_dir]
            self.root = next((p for p in roots if (p / "fc.json").is_file()), source_dir)
            self.archive = None

    def read(self, relative):
        if self.zip is not None:
            matches = [n for n in self.zip.namelist() if n.endswith("/" + relative) or n == relative]
            if len(matches) != 1:
                raise ValueError(f"Expected one {relative} inside {self.archive.name}, found {len(matches)}")
            return self.zip.read(matches[0]), f"{self.archive.name}::{matches[0]}"
        path = self.root / relative
        if not path.is_file():
            raise FileNotFoundError(f"Missing source: {path}")
        return path.read_bytes(), str(path.relative_to(self.root))


def quarter_map(wb, sheet):
    cells = wb.sheet(sheet)
    max_col = max(col_number(re.match(r"[A-Z]+", address)[0]) for address in cells)
    result = {}
    year = None
    for index in range(1, max_col + 1):
        col = col_name(index)
        q = wb.value(sheet, f"{col}7")
        if q not in (1, 2, 3, 4):
            continue
        anchor = excel_date(wb.value(sheet, f"{col}6"))
        if anchor:
            year = anchor.year
        end = excel_date(wb.value(sheet, f"{col}5"))
        if end:
            year = end.year
            if (end.month - 1) // 3 + 1 != int(q):
                raise ValueError(f"Period conflict: {sheet}!{col}5:{col}7")
        if year is not None:
            result[f"{year}Q{int(q)}"] = col
    return result


def annual_map(wb, sheet):
    result = {}
    for address, item in wb.sheet(sheet).items():
        if not re.fullmatch(r"[A-Z]+7", address):
            continue
        end = excel_date(item["value"])
        if end and end.month == 12:
            result[str(end.year)] = address[:-1]
    return result


def period_days(period):
    if "Q" not in period:
        return 366 if calendar.isleap(int(period)) else 365
    y, q = map(int, period.split("Q"))
    return sum(calendar.monthrange(y, m)[1] for m in range(q * 3 - 2, q * 3 + 1))


def ms_period(wb, period, model_col, maps, annual=False):
    row = {"period": period, "kind": "actual" if period <= ("2025" if annual else "2026Q3") else "estimate"}
    refs = []
    for key, index in MS_ROWS.items():
        address = f"{model_col}{index}"
        row[key] = wb.numeric("Model", address)
        refs.append(f"ms:Model!{address}")
    row["opex"] = row["revenue"] - row["cogs"] - row["operatingIncome"]
    for key, index in {"rd": 167, "sm": 168, "ga": 169}.items():
        address = f"{maps['Expense Drivers'][period]}{index}"
        row[key] = wb.numeric("Expense Drivers", address)
        refs.append(f"ms:Expense Drivers!{address}")
    row["expenseBasis"] = "GAAP; SBC and depreciation are already included in costs/expenses; memo rows must not be deducted again"
    row["segments"] = {}
    for segment in SEGMENTS:
        key = segment["key"]
        sheet, index = "Rev Roll-up", SEG_ROWS[key]
        if not annual and key == "cloud":
            sheet, index = "Non-Core Losses", 56
        elif not annual and key == "subs":
            sheet, index = "Other Drivers", 31
        if period not in maps[sheet]:
            raise ValueError(f"Missing period {period} in {sheet}")
        address = f"{maps[sheet][period]}{index}"
        row["segments"][key] = wb.numeric(sheet, address)
        refs.append(f"ms:{sheet}!{address}")
    hedge_cell = f"{maps['Rev Roll-up'][period]}111"
    row["hedge"] = wb.numeric("Rev Roll-up", hedge_cell)
    refs.append(f"ms:Rev Roll-up!{hedge_cell}")
    row["days"] = period_days(period)
    row["sourceRefs"] = refs
    return row


def source_record(source_id, label, file, as_of, kind, note, wb=None, content=None):
    record = {"id": source_id, "label": label, "file": file, "sheet": None,
              "asOf": as_of, "kind": kind, "note": note}
    if wb:
        record.update(sha256=wb.sha256, workbookStructure=wb.structure)
    elif content is not None:
        record["sha256"] = hashlib.sha256(content).hexdigest()
    return record


def broker_rows(wb, source_id, sheet, columns, mapping):
    rows = []
    for period, col in columns.items():
        result = {"period": period, "netIncomeBasis": "GAAP", "epsBasis": "GAAP diluted (saved broker model)", "sourceRefs": []}
        for key, index in mapping.items():
            result[key] = wb.numeric(sheet, f"{col}{index}")
            result["sourceRefs"].append(f"{source_id}:{sheet}!{col}{index}")
        rows.append(result)
    return rows


def find_model(source_dir, broker):
    matches = sorted(source_dir.glob(f"GOOGL_{broker}_analyst_model_*.xlsx"))
    if len(matches) != 1:
        raise ValueError(f"Expected one GOOGL {broker} model in source directory; found {len(matches)}")
    return matches[0]


def check_model_date(filename):
    match = re.search(r"_(\d{8})\.xlsx$", filename)
    if not match:
        raise ValueError(f"Model filename has no YYYYMMDD version: {filename}")
    return datetime.strptime(match[1], "%Y%m%d").date().isoformat()


def build(source_dir):
    demo = DemoSource(source_dir)
    ms_bytes, ms_file = demo.read("ms-model/clean.xlsx")
    fc_bytes, fc_file = demo.read("fc.json")
    price_bytes, price_file = demo.read("raw/GOOGL.json")
    pivot_bytes, pivot_file = demo.read("pivnotes.json")
    ms = CachedWorkbook(ms_bytes, "MS")
    fc = json.loads(fc_bytes)
    ms.expect_label("Model", "I6", "Morgan Stanley | Google Model")
    ms.expect_label("Model", "I7", "(USD millions)")
    ms.expect_label("Model", "I16", "Total Gross revenue (GAAP)")
    ms.expect_label("Model", "I84", "Tax rate (GAAP)")
    ms.expect_label("Model", "I86", "Net income (GAAP), continuing ops")
    ms.expect_label("Model", "I90", "EPS (GAAP), from continuing ops")
    ms.expect_label("Model", "I322", "Operating Cash Flow")
    ms_date_text = str(ms.value("IndexInformation", "B2"))
    ms_date = datetime.strptime(ms_date_text.split()[0], "%m/%d/%y").date().isoformat()
    maps = {s: quarter_map(ms, s) for s in ("Model", "Rev Roll-up", "Non-Core Losses", "Other Drivers", "Expense Drivers")}
    quarters = []
    omitted = []
    for year in range(2024, 2029):
        for q in range(1, 5):
            period = f"{year}Q{q}"
            col = maps["Model"].get(period)
            if not col or ms.numeric("Model", f"{col}16", required=False) is None:
                omitted.append(period)
                continue
            quarters.append(ms_period(ms, period, col, maps))
    annual_maps = {s: annual_map(ms, s) for s in ("Model", "Rev Roll-up", "Expense Drivers")}
    annual = [ms_period(ms, str(y), annual_maps["Model"][str(y)], annual_maps, True) for y in range(2022, 2029)]
    sources = [source_record("ms", "Morgan Stanley 模型快照", ms_file, ms_date, "broker_model",
                            "直接读取保存缓存；不是公司公告原件或已重算模型。原年度EPS独立保留。", ms)]
    comparisons = [{"broker": "Morgan Stanley", "date": ms_date, "dateBasis": "IndexInformation!B2 / ModPubIndex!A2",
                    "file": ms_file, "revenueBasis": "gross consolidated revenue, including hedging",
                    "periods": [{k: r[k] for k in ("period", "revenue", "netIncome", "eps", "sourceRefs")} | {"netIncomeBasis": "GAAP continuing operations", "epsBasis": "GAAP continuing operations diluted (saved broker model)"} for r in annual if r["period"] >= "2026"],
                    "warnings": ["与 GS / Barclays 的标记日期不同，不构成同期一致预期。", "净利/EPS为GAAP持续经营口径；尚未与GS/BARC总GAAP口径做调整桥接。", "含10个外链、手动计算、clean版无definedNames；未重算。"]}]
    for broker in ("GS", "BARC"):
        path = find_model(source_dir, broker)
        wb = CachedWorkbook(path.read_bytes(), broker)
        model_date = check_model_date(path.name)
        if broker == "GS":
            sheet, header = "Income Statement", 1
            cols = {"2026": "DC", "2027": "DD", "2028": "DE"}
            mapping = {"revenue": 64, "netIncome": 267, "eps": 278, "revenueExTac": 85, "tac": 68}
            wb.expect_label(sheet, "A64", "Consolidated Revenues (Gross)")
            wb.expect_label(sheet, "A85", "Consolidated Revenues (Net)")
            wb.expect_label(sheet, "A278", "GAAP EPS (Diluted)")
            basis = "文件名20260804；core modified亦为2026-08-04，报告发布日期未独立证实"
            warnings = ["本次模型收入读取gross行；不得沿用旧demo把GS统一归为ex-TAC。", "文件名和修改时间不保证全部模型输入具有同一可得日期。"]
            label = "Goldman Sachs"
        else:
            sheet, header = "Publishing IS", 4
            cols = {"2026": "EF", "2027": "EK", "2028": "EP"}
            mapping = {"revenue": 6, "netIncome": 51, "eps": 52, "revenueExTac": 5, "tac": 9}
            wb.expect_label(sheet, "A6", "Gross Revenue")
            wb.expect_label(sheet, "A5", "Consolidated Net Revenue")
            wb.expect_label(sheet, "A51", "Net Income (GAAP)")
            cover = str(wb.value("ModelCover", "F2"))
            stamp = re.search(r"\d{2}-[A-Za-z]{3}-\d{4}", cover)
            if not stamp:
                raise ValueError("BARC ModelCover!F2 is missing its date")
            model_date = datetime.strptime(stamp[0], "%d-%b-%Y").date().isoformat()
            basis = "ModelCover!F2（core modified为前一日）"
            warnings = ["首行净收入已扣TAC；比较采用单独Gross Revenue行。", "含14个外链并开启迭代计算；只读保存缓存，未验证收敛。"]
            label = "Barclays"
        for year, col in cols.items():
            expected = f"FY{year}E" if broker == "BARC" else f"{year}E"
            wb.expect_label(sheet, f"{col}{header}", expected)
        periods = broker_rows(wb, broker.lower(), sheet, cols, mapping)
        if broker == "GS":
            for row in periods:
                row["tac"] = -row["tac"]
        comparisons.append({"broker": label, "date": model_date, "dateBasis": basis, "file": path.name,
                            "revenueBasis": "gross consolidated revenue, including hedging",
                            "periods": periods, "warnings": warnings + ["日期早于MS快照，不构成同期一致预期。"]})
        sources.append(source_record(broker.lower(), label + " 模型快照", path.name, model_date, "broker_model", "；".join(warnings), wb))
    raw_price = json.loads(price_bytes)
    history = []
    for row in raw_price["data"]["tradesTable"]["rows"]:
        close = float(row["close"].replace("$", "").replace(",", ""))
        if not math.isfinite(close) or close <= 0:
            raise ValueError("Invalid close in raw/GOOGL.json")
        history.append({"date": datetime.strptime(row["date"], "%m/%d/%Y").date().isoformat(), "close": close})
    history.sort(key=lambda x: x["date"])
    if len({x["date"] for x in history}) != len(history):
        raise ValueError("Duplicate daily prices in raw/GOOGL.json")
    last = history[-1]
    sources.extend([
        source_record("nasdaq-googl", "原包GOOGL行情缓存", price_file, last["date"], "price_cache", "离线Close/Last；复权、数据商与下载时间未独立验证。", content=price_bytes),
        source_record("demo", "原Demo摘录及券商样本", fc_file, "2026-11-04", "unverified_excerpt", "仅保留原包材料；无电话会、研报原件，未核实外部真实性。", content=fc_bytes),
        source_record("pivnotes-20240710", "2024-07-10 复盘摘录", pivot_file + "::[d=2024-07-10]", "2024-07-10", "unverified_excerpt", "原包event/view/src二手摘录；原研报未附，记录日期不等于证据可得日期。", content=pivot_bytes),
        source_record("pivnotes-20240910", "2024-09-10 复盘摘录", pivot_file + "::[d=2024-09-10]", "2024-09-10", "unverified_excerpt", "原包event/view/src二手摘录；原研报未附，记录日期不等于证据可得日期。", content=pivot_bytes),
    ])
    checks = []
    for title, rows in (("quarter", quarters), ("annual", annual)):
        for row in rows:
            p = row["period"]
            expense_diff = row["rd"] + row["sm"] + row["ga"] - row["opex"]
            checks.append({"id": f"{title}-{p}-expenses", "status": "pass" if abs(expense_diff) < .01 else "fail",
                           "message": f"{p} GAAP研发+销售+管理费用−营业费用={expense_diff:.6f} USD mn；SBC与折旧为内含备查项。"})
            segment_diff = sum(row["segments"].values()) + row["hedge"] - row["revenue"]
            checks.append({"id": f"{title}-{p}-segments", "status": "pass" if abs(segment_diff) < .01 else "fail",
                           "message": f"{p} 六分部+套保−收入={segment_diff:.6f} USD mn（缓存内部勾稽）。"})
            ni_diff = (row["operatingIncome"] + row["otherIncome"]) * (1 - row["taxRate"]) - row["netIncome"]
            checks.append({"id": f"{title}-{p}-netincome", "status": "pass" if abs(ni_diff) < .1 else "warning",
                           "message": f"{p} 按营业利润+其他收益及原税率计算的净利与原净利差{ni_diff:.6f} USD mn；保留原值。"})
            eps_diff = row["netIncome"] / row["dilutedShares"] - row["eps"]
            checks.append({"id": f"{title}-{p}-eps", "status": "pass" if abs(eps_diff) < .005 else "warning",
                           "message": f"{p} 净利/摊薄股数与原EPS差{eps_diff:.6f} USD/share；年度EPS不从季度简单相加。"})
    for broker in comparisons[1:]:
        for row in broker["periods"]:
            diff = row["revenue"] - row["tac"] - row["revenueExTac"]
            checks.append({"id": f"{broker['broker']}-{row['period']}-tac", "status": "pass" if abs(diff) < .01 else "fail",
                           "message": f"{broker['broker']} {row['period']} gross−TAC−net={diff:.6f} USD mn。"})
    checks.extend([
        {"id": "source-dates", "status": "warning", "message": "三份卖方文件标记日期不同；来源日期不是独立真实性证明，也不代表同期一致预期。"},
        {"id": "quarter-coverage", "status": "warning" if omitted else "pass", "message": "未生成缺少收入/利润数值的季度：" + ", ".join(omitted)},
        {"id": "price-dates", "status": "pass", "message": f"{len(history)}条价格日期唯一且升序；截止{last['date']}。"},
        {"id": "cached-values", "status": "warning", "message": "所有工作簿只读保存缓存；内部勾稽不证明公告真实性、公式重算或外链刷新成功。"},
    ])
    qmap = {r["period"]: r for r in quarters}
    baseline = qmap["2026Q4"]
    prior = qmap["2025Q4"]
    cloud_growth = baseline["segments"]["cloud"] / prior["segments"]["cloud"] - 1
    review_path = ROOT / "assets" / "review-case.json"
    if not review_path.is_file():
        raise FileNotFoundError(f"Missing review case: {review_path}")
    review = json.loads(review_path.read_text(encoding="utf-8"))
    prices_by_date = {row["date"]: row["close"] for row in history}
    for edge in ("start", "end"):
        review_date, review_price = review[edge + "Date"], review[edge + "Price"]
        if review_date not in prices_by_date or abs(prices_by_date[review_date] - review_price) > 1e-8:
            raise ValueError(f"Review {edge} price/date does not match raw/GOOGL.json")
    if review["startDate"] >= review["endDate"]:
        raise ValueError("Review startDate must precede endDate")
    review_return = prices_by_date[review["endDate"]] / prices_by_date[review["startDate"]] - 1
    if abs(review_return - review["priceReturn"]) > 1e-10:
        raise ValueError("Review priceReturn does not match its raw price endpoints")
    source_ids = {source["id"] for source in sources}
    for stage in review.get("stages", []):
        for source_id in stage.get("sourceRefs", []):
            if source_id not in source_ids:
                raise ValueError(f"Unresolved review sourceRef: {source_id}")
        if stage["stage"] == "known_at_start" and stage["date"] > review["startDate"]:
            raise ValueError("Review look-ahead: a known-at-start item is dated after the start")
        if stage["stage"] == "during_period" and not review["startDate"] <= stage["date"] <= review["endDate"]:
            raise ValueError("Review during-period item is outside its window")
        if stage["stage"] == "after_period" and stage["date"] <= review["endDate"]:
            raise ValueError("Review after-period item is not after the window")
    checks.append({"id": "review-prices-and-dates", "status": "pass", "message": "复盘两端日期、价格与原始行情一致；简单价格收益及分期标签通过校验。"})
    case = {
        "schemaVersion": 1,
        "meta": {"ticker": "GOOGL", "name": "Alphabet", "asOf": "2026-11-05", "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"), "price": last["close"], "priceDate": last["date"],
                 "currency": "USD", "unit": "USD mn", "mode": "static", "lastActualPeriod": "2026Q3",
                 "sourceNote": "本地文件案例。实际值是卖方模型转录缓存；未与公司公告独立验证。文件日期不保证内部数值当日可得。"},
        "segments": SEGMENTS, "quarters": quarters, "annualBaselines": annual, "sources": sources,
        "brokerComparisons": comparisons,
        "consensus": {"asOf": "2026-11-03", "label": "原Demo券商样本", "observations": fc["cons"]["brokers"],
                      "notes": ["仅展示原样本，不将新提供三份异日模型合成一致预期。", "原样本含Bernstein两条记录，各净利年份非空样本数不同。", "原demo计算2027净利时剔除广发；本案例不沿用该中位数或假定剔除合理。", "原接口返回未提供，收入gross/ex-TAC及报告去重需原始证据核验。"]},
        "priceHistory": history, "reviewCase": review,
        "exampleScenario": {"id": "cloud-up-margin-down", "title": "Cloud 增长更快、毛利率下降", "description": "交互演示假设：2026Q4 Cloud同比增速比原MS高5个百分点，同时集团毛利率低1个百分点。",
                            "overrides": {"2026Q4": {"segmentGrowthYoY": {"cloud": cloud_growth + .05}, "grossMargin": 1 - baseline["cogs"] / baseline["revenue"] - .01}},
                            "notes": ["这是用户可修改的假设示例，不是公司指引或研究结论。", "其余驱动从原MS快照起步；年度原始参考单独保留。", "毛利率改动只作用于指定季度；后续季度保留MS毛利率与同比增速，因此2026Q4的收入基数变化会传导至2027Q4。"]},
        "checks": checks,
        "limitations": [
            "季度可调整2026Q4及2027四季；2028可做年度延展情景。原表2028季度只有标题、缺少数值，未虚构季度拆分。",
            "三家卖方仅提供异日参考与建模结构，不能视为正确答案或同一时点一致预期。",
            "实际值按字段标明SEC核验范围；未核验的历史细分业务及卖方预测仍保留模型来源。",
            "MS模型包含重大非经营其他收益；GAAP净利/EPS变化不能直接解释为经营盈利变化。",
            "opex定义为收入−营业成本−营业利润；包含该模型的全部营业费用，不另加一次SBC。",
            "年度原EPS直接读年度行；交互模型若按季度利润及天数加权股数重建，可能与原年度EPS不同。",
            "当前情景只重算利润表。Capex和经营现金流保留原模型参考值，尚未建立收入、折旧、营运资金与现金流的完整联动。",
            "行情缓存截止2026-11-02，复权口径未独立确认；不用于自动交易。",
        ],
    }
    verification_path = ROOT / "assets" / "financial-verification.json"
    if verification_path.exists():
        verification = json.loads(verification_path.read_text(encoding="utf-8"))
        for row in quarters:
            row["preferredDividends"] = 0
            row["preferredDividendsBasis"] = "MS原模型未单列，预测默认0；可按情景调整，并非公司股息指引。"
            public = verification["quarters"].get(row["period"], {})
            if row["kind"] == "actual" and public.get("facts"):
                row["msOriginalEps"] = row["eps"]
                for key in ("reportedEps", "netIncomeAvailableToCommon", "dilutedEarnings", "dilutedEarningsBasis", "preferredDividends", "preferredDividendsBasis"):
                    if key in public:
                        row[key] = public[key]
                if "reportedEps" in public:
                    row["eps"] = public["reportedEps"]
                    row["epsBasis"] = "SEC reported diluted EPS"
                row["verifiedFields"] = list(public["facts"])
                row["sourceRefs"].extend(public["sourceRefs"])
        case["financialVerification"] = verification
        case["sources"].append({"id": "sec-companyfacts", "label": "Alphabet SEC XBRL原始财务", "file": "assets/financial-verification.json", "asOf": verification["asOf"], "kind": "company_filing", "url": verification["source"]["url"], "note": "已核对的字段逐季标记；Q4部分指标无直接季度XBRL，保留模型转录。"})
        case["meta"]["sourceNote"] = "MS季度模型与SEC公开事实按字段核对。季度公告EPS优先使用公司披露；原MS EPS保留对照。预测为可编辑假设。"
        case["limitations"].append(verification["epsNote"])
        for check in verification["checks"]:
            case["checks"].append({"id": f"sec-{check['period']}-{check['field']}", "status": "pass" if check["status"] == "match" else "warning", "message": f"{check['period']} {check['field']} 模型与SEC差额={check['difference']:.6f}；已核对相同季度和单位。"})
    market_path = ROOT / "assets" / "market-update.json"
    if market_path.exists():
        update = json.loads(market_path.read_text(encoding="utf-8"))
        by_date = {x["date"]: x for x in case["priceHistory"]}
        for row in update.get("series", {}).get("GOOGL", []):
            by_date[row["date"]] = {"date": row["date"], "close": row["close"]}
        case["priceHistory"] = sorted(by_date.values(), key=lambda x: x["date"])
        newest = case["priceHistory"][-1]
        case["meta"].update(price=newest["close"], priceDate=newest["date"])
        case["limitations"] = [x for x in case["limitations"] if not x.startswith("行情缓存截止")]
        case["limitations"].append(f"行情补充至{newest['date']}；采用收盘价格收益，分红再投资收益需另算。")
    # A snapshot identity includes source values, mappings and research content,
    # but not the time a byte-identical snapshot was rebuilt.
    identity = dict(case)
    identity["meta"] = {k: v for k, v in case["meta"].items() if k != "generatedAt"}
    case["meta"]["caseId"] = hashlib.sha256(
        json.dumps(identity, ensure_ascii=False, sort_keys=True, allow_nan=False).encode("utf-8")
    ).hexdigest()
    profit_path = ROOT / "assets/profit-inputs.json"
    if profit_path.exists():
        from build_profit_inputs import attach
        attach(case, json.loads(profit_path.read_text(encoding="utf-8")))
    return case


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, default=ROOT.parent, help="Directory containing original demo ZIP and GS/BARC workbooks")
    parser.add_argument("--output", type=Path, default=ROOT / "outputs" / "googl-case.json")
    args = parser.parse_args(argv)
    case = build(args.source_dir.resolve())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(case, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(f"Saved {args.output}: {len(case['quarters'])} quarters, {len(case['annualBaselines'])} annual baselines, {len(case['brokerComparisons'])} broker snapshots.")
    failures = [c for c in case["checks"] if c["status"] == "fail"]
    if failures:
        print(f"WARNING: {len(failures)} failed internal checks remain visible in the case.", file=sys.stderr)
    return 1 if failures else 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, KeyError, FileNotFoundError, zipfile.BadZipFile) as error:
        print(f"Cannot build case: {error}", file=sys.stderr)
        raise SystemExit(2)
