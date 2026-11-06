#!/usr/bin/env python3
"""Build the dated GOOGL review from archived evidence; no network or credentials.

Prices are observations, never a causal decomposition. A later filing can verify
an earlier release only through verificationRefs, not the event's sourceRefs.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def build(root=ROOT):
    research = read(root / "assets/research.json")
    market = read(root / "assets/market-update.json")
    legacy = next(x for x in research["drawdowns"] if x["id"] == "googl-2026-q3-drawdown")
    sources = {x["id"]: dict(x) for x in research["sources"]}
    prices = {s: {r["date"]: r for r in rows} for s, rows in market["series"].items()}
    days = sorted(prices["GOOGL"])
    selected_news = []

    def news(sid, filename, index, kind="media_report", note=""):
        path = root / "outputs/research/raw_review" / filename
        envelope = read(path)
        row = envelope["data"][index]
        sources[sid] = {
            "id": sid, "title": row["title"], "date": row["date"],
            "publishedAt": row["date"], "retrievedAt": envelope["retrievedAt"],
            "file": path.relative_to(root).as_posix(), "page": f"data[{index}]",
            "url": row["link"], "kind": kind,
            "note": note or "EODHD 保存的有时间戳媒体全文；非机构原始模型或一致预期数据库。",
        }
        selected_news.append(sid)
        return sid

    news("review-tpu-delay", "eod_news_2026-10-19.json", 22, "media_reported_analyst",
         "Insider Monkey 转述 GF Securities；未取得供应链报告原件，报道内部时间线也不能替代公司交付计划。只作待验证风险线索。")
    news("review-cloud-outage", "eod_news_2026-10-20.json", 9)
    news("review-zacks-preview", "eod_news_2026-10-23.json", 28,
         note="Zacks 10/23 盘前预期样本。业务收入可逐项对比；总收入111.64bn疑似扣TAC口径，EPS2.94未明GAAP/调整后，二者不计算预期差。")
    news("review-anthropic-direct", "eod_news_2026-10-26.json", 19,
         note="Yahoo 引述 Anthropic S-1 的混合算力采购；此条为媒体转述，不能从自建模式推导 Google 订单流失比例。")
    news("review-anthropic-channels", "eod_news_2026-10-26.json", 17)
    news("review-da-preview", "eod_news_2026-10-26.json", 2, "media_reported_analyst")
    news("review-oracle-tpu", "eod_news_pre_earnings.json", 25, "company_release_republished",
         "Oracle / Google 联合新闻稿，经 PR Newswire / Yahoo 分发；原文明确2027年可用、多年爬坡，无交付数量、价格或Google收入确认额。")
    news("review-yahoo-preview", "eod_news_pre_earnings.json", 11)
    sources["review-demo-call"] = {
        "id": "review-demo-call", "title": "旧 Demo：Alphabet Q3 2026 业绩会摘录",
        "date": "2026-10-28", "file": "assets/v9-snapshot.json", "page": "FC.gd.call / FC.gd.factors",
        "kind": "unverified_transcript_excerpt", "publicationVerified": False,
        "note": "旧包标注进门路演 docId 7951075485432821，并附00:31:01等回听位置；本地未找到完整转录、音频或可核验发布时间。只展示为待核对摘录，不提升为已验证的当时公开证据。",
    }
    sources["review-demo-expert"] = {
        "id": "review-demo-expert", "title": "旧 Demo：10/18 广告行业专家交流摘录",
        "date": "2026-10-18", "file": "assets/v9-snapshot.json", "page": "FC.gd.views[type=专家交流]",
        "kind": "unverified_expert_excerpt", "publicationVerified": False,
        "note": "只有匿名专家的国内广告行业摘要，没有完整纪要/录音、样本、提问背景或Google专属经营数据。不能用作GOOGL本轮下跌或精确收入预测的证据。",
    }

    def window(start, end, label="", volume=True):
        returns = {s: prices[s][end]["close"] / prices[s][start]["close"] - 1 for s in ("GOOGL", "QQQ", "XLC")}
        result = {
            "label": label, "startDate": start, "endDate": end, "returns": returns,
            "startClose": prices["GOOGL"][start]["close"], "endClose": prices["GOOGL"][end]["close"],
            "excessVsQQQPctPoints": 100 * (returns["GOOGL"] - returns["QQQ"]),
            "excessVsXLCPctPoints": 100 * (returns["GOOGL"] - returns["XLC"]),
            "basis": "同日未复权收盘价，不含分红；相对收益为简单百分点差，不是alpha或事件贡献。",
        }
        if volume:
            i = days.index(end)
            prior = days[max(0, i - 20):i]
            avg = sum(prices["GOOGL"][d]["volume"] for d in prior) / len(prior)
            result["volume"] = {
                "date": end, "shares": prices["GOOGL"][end]["volume"], "multiple": prices["GOOGL"][end]["volume"] / avg,
                "baselineAverage": avg, "baselineStart": prior[0], "baselineEnd": prior[-1], "baselineSessions": len(prior),
                "note": "终点交易日成交量 / 此前20个交易日均量；没有使用事件之后的量作为基线。",
            }
        return result

    def day_window(day):
        return window(days[days.index(day) - 1], day, "当日完整交易日")

    events = []

    def event(eid, date, session, title, information, expectation, start, end, source_refs=(),
              brokers=(), details=(), verification_refs=(), published_at=None, price_note="", supplemental_refs=()):
        events.append({
            "id": eid, "date": date, "session": session, "title": title,
            "publishedAt": published_at, "newInformation": information, "expectationChange": expectation,
            "priceObservation": window(start, end), "priceNote": price_note,
            "brokerResponses": list(brokers), "details": list(details),
            "sourceRefs": list(source_refs), "verificationRefs": list(verification_refs),
            "supplementalRefs": list(supplemental_refs),
        })

    event("oct13-baseline", "2026-10-13", "起点", "股价仍在十月高位，旧模型已含AI增长预期",
          "10/13收盘353.78美元，是本次十月观察窗的事后局部高点。7–9月本地研报和模型可重建投资背景，但不能代表10/13实时一致预期。",
          "应追问搜索变现、TPU交付和资本回报能否兑现。尚未识别能解释随后每一天跌幅的单一负面催化。",
          "2026-10-12", "2026-10-13",
          ("local-jpm-us-internet-202607", "local-gs-cloud-conversion-20260917", "local-googl-barc-20260724", "local-googl-ms-20260824"),
          brokers=("7月JPM原件把管理层指引、Consensus、JPMe和Buyside Bar分列；只作旧预期结构。8月MS和7月Barclays模型也不是10月更新版。",),
          details=("GS 9/17原件p13讨论滚动12月增量Cloud收入相对滞后Capex；用于提出回报问题，不能直接推导GOOGL季度增速。",))
    event("oct19-supply", "2026-10-19", "盘中", "供应链延迟报道提供风险线索，尚非公司确认",
          "09:38美东，媒体转述GF对下一代TPU部分设计延迟的判断，同时称需求仍强。未取得原始供应链报告。",
          "需要区分需求和交付：若量产延迟，收入确认可能后移；报道没有可核对的Google收入影响，不据此下调模型。",
          "2026-10-16", "2026-10-19", ("review-tpu-delay",),
          brokers=("GF观点经二手转述；没有已验证的GOOGL EPS或目标价修订。",),
          published_at=sources["review-tpu-delay"]["date"],
          price_note="报道在开盘后；收盘收益包含消息发布前行情，且当日GOOGL上涨，不能把报道直接写成下跌原因。")
    event("oct20-outage", "2026-10-20", "盘中", "伦敦Cloud故障把服务可靠性带入讨论",
          "14:28美东报道：伦敦电力事件影响Cloud及多家英国银行；英国监管机构与Google接触，Google称问题已解决。",
          "新增服务中断、赔付与监管成本的可能性；尚无可量化的收入流失、罚款或全年盈利修订。",
          "2026-10-19", "2026-10-20", ("review-cloud-outage",),
          brokers=("本次归档未找到将故障量化为GOOGL利润下修的完整卖方模型。",),
          published_at=sources["review-cloud-outage"]["date"],
          price_note="报道在14:28才发布，日收益不是纯事件窗口；不能倒推当天全部跌幅来自故障。")
    event("oct23-preview", "2026-10-23", "盘前", "财报前预期样本已可定位：Cloud高增，搜索仍有门槛",
          "08:15美东，Zacks列Q3预期：Search64.99bn、YouTube11.34bn、Cloud29.16bn；报道还称近30天EPS样本上修1.4%。",
          "截至这份样本，市场并非一致下修盈利；真正待验的是搜索和Cloud能否越过预期。总收入及EPS口径不明，保留不比较。",
          "2026-10-22", "2026-10-23", ("review-zacks-preview",),
          brokers=("这是有发布时间的媒体预期样本，不是完整券商预测分布，也不是10/13起点预期。",),
          published_at=sources["review-zacks-preview"]["date"],
          details=("Zacks总收入111.64bn与公司含TAC收入不可直接比较；EPS2.94未说明GAAP/调整后。业务段名称相同的预期单列在下方对照。",))
    event("oct26-customer", "2026-10-26", "盘中 / 盘后", "客户算力采购更复杂，资本回报分歧提前出现",
          "13:38美东，Yahoo引述Anthropic招股书：云租赁之外增加自采加速器与专属数据中心。17:03的D.A. Davidson报道则认为Google已预告资本开支上升，关注Anthropic带动的Cloud增长。",
          "客户需求旺盛与自建并存：硬件销量、持续服务收入、渠道收费及投资关系不能当作同一项收入。此前已知的2027投入上升也不全是本次财报的新消息。",
          "2026-10-23", "2026-10-26", ("review-anthropic-direct", "review-anthropic-channels", "review-da-preview"),
          brokers=("D.A. Davidson的盘后观点属于后续解读；对应首个日线观察窗为10/26→10/27，不能解释10/26收盘前走势。",),
          published_at=sources["review-anthropic-direct"]["date"],
          price_note="主窗口仅观察盘中客户消息所在交易日；盘后卖方评论对应次日，两个时点分开。",
          details=("没有客户侧向Google分配的新增采购量、付款时间和确认节奏，因此不计算Google营收增量。",))
    event("oct27-tpu-preview", "2026-10-27", "盘中", "TPU扩张与搜索变现担忧同时进入财报预期",
          "12:07美东，Oracle/Google新闻稿称TPU于2027年进入OCI并多年爬坡。15:16 Yahoo财报预览列总收入127.8bn、Cloud28.9bn，并讨论Meta Muse对搜索商业化的潜在竞争。",
          "Cloud硬件外售存在上行机会，但不能把2027可用写成Q3已确认收入。搜索需要兼顾查询增长与单位变现；这项担忧在财报前已有公开记录。",
          "2026-10-26", "2026-10-27", ("review-oracle-tpu", "review-yahoo-preview"),
          brokers=("Yahoo转述BofA看好TPU、Gemini催化，同时关注搜索迁移；TD Cowen的TPU销售预测属于机构情景，非公司指引。",),
          published_at=sources["review-oracle-tpu"]["date"],
          price_note="两条消息均在盘中；只有日线，不能分离Oracle发布与晚些时候预览的各自价格贡献。")
    event("oct28-before", "2026-10-28", "盘前", "最后一个财报前交易日：现金回报仍是明确问题",
          "09:27美东，Yahoo预览关注上一季FCF转负后的投资回报，列YouTube预期11.34bn。当天收盘324.89，较10/13已跌8.17%。",
          "财报前跌幅与XLC的−8.14%接近、弱于QQQ；说明背景不同，不能证明公司因素不存在，也不能用晚间Q3结果解释此前下跌。",
          "2026-10-27", "2026-10-28", ("recent-pre-earnings",),
          brokers=("已有10/23与10/27媒体预期样本，仍缺10/13当日完整卖方版本和逐日修订路径。",),
          published_at=sources["recent-pre-earnings"]["date"],
          details=("10/13→10/28区间比较见下方；起点选择是事后观察，不是当时的交易信号。",))
    event("oct28-release", "2026-10-28", "盘后", "增长结构和现金回报成为财报冲击的中心",
          "16:44美东AFP已报道：搜索约+12%、YouTube约+9%、Cloud约+103%；季度Capex约51.4bn，FCF约−9.1bn。云高增长含TPU贡献，广告增速放缓与现金消耗并存。",
          "相较财报前Zacks业务样本，Search低约2.52%、YouTube低约1.17%、Cloud高约5.31%。这支持讨论增长组合，不能只看收入总量或把GAAP EPS下降等同经营崩塌。",
          "2026-10-28", "2026-10-29", ("recent-afp-results", "recent-earnings-8k", "review-zacks-preview", "review-yahoo-preview"),
          brokers=("10/29的目标价和模型修订放在下一节点；没有原件可证明这些更新在10/28收盘前已知。",),
          verification_refs=("recent-10q-income", "recent-10q-business", "recent-10q-cash", "recent-10q-investments"),
          supplemental_refs=("review-demo-call",), published_at=sources["recent-afp-results"]["date"],
          price_note="下列10/29收盘结果是后续观察，不是10/28发布时已知。10-Q于10/29提交，只用来核对数值。",
          details=("10-Q核实：收入127.577bn、营业利润40.576bn同比+29.93%；投资损益波动拖累净利，普通股摊薄EPS为2.12。", "电话会旧摘录：00:31:01汇率与基数；00:31:28第三方算力及TPU爬坡；00:31:59折旧与Capex。完整转录/音频未核实，摘录不单独构成事实。", "2026 Capex 195–205bn维持；2027显著增加无数值指引。350.4bn是之后高盛估计。"))
    event("oct29-reprice", "2026-10-29", "财报后首日", "放量下跌，机构转向搜索变现、现金和估值质量",
          "首个完整交易日收盘283.82，较前收跌12.64%；相对QQQ/XLC分别少11.23/10.77个百分点，成交量为此前20日均量5.46倍。",
          "机构分歧由‘Cloud能长多快’延伸到‘收入来自持续服务还是硬件、搜索增量能否变现、现金何时回收’。价格表现显示重估显著，但不是对每个解释的因果证明。",
          "2026-10-28", "2026-10-29", ("recent-citizens", "recent-gs-jpm", "recent-ms-view", "recent-citi-first", "recent-10q-business"),
          brokers=("GS目标价435→385；JPM425→375。缺同版完整盈利及估值表，不能把目标价跌幅全部算成EPS下修。", "Citizens下调至Market Perform，10:16美东报道已在开盘之后；MS仍Overweight/375，讨论TPU组合及2028 EPS倍数；Citi初评保留447。"),
          details=("付费点击+8%、CPC+4%并不支持‘所有广告单价都下降’。高价值查询流失仍是待证伪的机构解释。", "高盛媒体文中2027 FCF前后数字重复，不能量化其下修幅度。MS所述16倍使用2028 EPS，不与2026/2027 PE直接相比。"),
          price_note="隔夜财报、盘中机构点评与市场波动重叠；无盘中事件回归，不拆分贡献。")
    event("oct30-revisions", "2026-10-30", "后续修订", "目标价下调不等于所有年份盈利一起下修",
          "Citi把前一日保留的447目标价更新为375，仍Buy；招银国际GOOG目标价428→421，2026净利预测−5%，2027–2028反而+2%至+4%。",
          "盈利年份、现金和倍数变化必须分开。两天Citi版本有先后；招银的跨年方向不同，不能写成‘卖方全面下修盈利’。",
          "2026-10-29", "2026-10-30", ("recent-citi-revision", "recent-cmbi-view"),
          brokers=("Citi：搜索变现不确定性盖过Cloud超预期的部分利好。招银：Cloud长期贡献仍上修，TPU存货拖累现金；其目标是GOOG C类股。",),
          price_note="两条来源只有可核对日期，没有统一美东发布时间；当日日线仅作相邻观察，不假定都在开盘前发布。",
          details=("C类GOOG目标价不能直接混入A类GOOGL目标价平均值；没有同版原始模型仍不拆分目标价的盈利和倍数贡献。",))
    event("nov02-low", "2026-11-02", "收盘低点", "回撤到达观察窗低点，后续公司与市场表现已分化",
          "收盘278.99，较10/13跌21.14%。但10/29→11/02仅再跌1.70%，同期QQQ跌4.79%、XLC跌0.94%。本次归档未识别解释11/02低点的新增公司披露。",
          "财报首日冲击最集中，后段不能照搬同样的单因子叙事。买入评级尚在、长期Cloud上修与短期现金担忧可以同时存在。",
          "2026-10-29", "2026-11-02", (),
          brokers=("观察窗内可定位的主要修订仍是10/29–30；11/02未取得新同口径原始盈利模型。",),
          details=("同期10年美债收益率从5.21%降到4.91%，VIX从15.27升到21.15；不能写成‘利率上升解释整段下跌’。宏观为共同背景，不是贡献归因。",),
          verification_refs=("recent-fred",),
          price_note="11/02是截至11/04事后识别的收盘低点；不代表当日已可确认底部。")
    event("nov04-rebound", "2026-11-04", "窗口后", "反弹出现，经营争议尚未被新季度数据解决",
          "11/02→11/04反弹3.56%至288.93，QQQ同期+1.59%、XLC+4.69%。这是价格修复，未取得新的季度实际值来确认搜索和现金问题逆转。",
          "下一步验证搜索商业化、剔除硬件后的Cloud消费、应收存货及FCF；不能仅凭两天反弹上调经营预测。",
          "2026-11-02", "2026-11-04", (),
          brokers=("截至本版资料，没有新的完整卖方修订链可把这两日反弹拆成盈利或估值改善。",))

    # Ex-ante samples stay separate. No GAAP/adjusted EPS or TAC mismatch.
    expectations = []
    for label, exp, actual, sid in (
        ("Search收入", 64990, 63350, "review-zacks-preview"),
        ("YouTube广告收入", 11340, 11207, "review-zacks-preview"),
        ("Cloud收入", 29160, 30709, "review-zacks-preview"),
        ("总收入（含TAC）", 127800, 127577, "review-yahoo-preview"),
        ("Cloud收入", 28900, 30709, "review-yahoo-preview"),
    ):
        expectations.append({"metric": label, "unit": "USD mn", "expectation": exp, "actual": actual,
                             "surprisePct": (actual / exp - 1) * 100,
                             "forecastPublishedAt": sources[sid]["date"], "sourceRefs": [sid],
                             "verificationRefs": ["recent-10q-income" if "总收入" in label else "recent-10q-business"]})

    materials = [
        {"label": "本地卖方原件与模型", "status": "可作历史背景", "body": "JPM 7月预览p1/5/7/8、GS 9/17 p13及7–8月Alphabet模型均早于窗口；提供预期结构与资本回报框架。不是本轮财报后机构修订，也不是10月实时一致预期。",
         "sourceRefs": ["local-jpm-us-internet-202607", "local-gs-cloud-conversion-20260917", "local-googl-barc-20260724", "local-googl-ms-20260824"]},
        {"label": "公司电话会", "status": "有摘录，缺完整原文核验", "body": "旧包保留10/28电话会摘要与回听位置。已把它关联到财报节点，但精确表述仍需完整转录/录音；已披露财务数字优先按10-Q核对。", "sourceRefs": ["review-demo-call"]},
        {"label": "专家交流与产业访谈", "status": "没有可直接验证本次争议的专家原文", "body": "10/18匿名广告专家只有国内行业摘要，未提供Google专属样本；JPM买方情绪访谈与GS 2025年供应链调研是卖方研究，不能冒充本次独立专家纪要。", "sourceRefs": ["review-demo-expert", "local-gs-tpu-supply-20251216"]},
    ]
    controversies = [
        {"title": "搜索：周期放缓，还是AI改变变现？", "evidence": "Search仍增12%，但低于10/23样本2.52%；查询增长不等于高价值商业查询增长。", "test": "跟踪商业意图、渠道、付费点击/CPC和AI Mode收入；无拆分时保留结构性解释的不确定性。"},
        {"title": "Cloud：高增速能否变成持续现金？", "evidence": "收入+103%超预期，TPU硬件外售是贡献；2027 OCI扩张不等于当季已实现订单。", "test": "区分硬件交付与服务消费，验证客户分配、持续用量、应收、存货及回款。"},
        {"title": "估值：盈利下修，还是现金和倍数重估？", "evidence": "OI同比+29.93%，FCF为负；CMBI短年下修、远年上修，目标价仍下降。", "test": "统一预测年份/股类，拆经营利润、投资损益、Capex与折旧；取得同版模型再分解目标价。"},
    ]
    windows = [window(x["startDate"], x["endDate"], x["label"], False) for x in legacy["priceStats"]["windows"]]
    used = set()
    for item in events + materials + expectations + legacy["brokerComparisons"]:
        for key in ("sourceRefs", "verificationRefs", "supplementalRefs"):
            used.update(item.get(key, []))
    used.update(("recent-eod-googl", "recent-eod-qqq", "recent-eod-xlc"))
    manifest = []
    for path in sorted((root / "outputs/research/raw_review").glob("eod_news*.json")):
        envelope = read(path)
        rows = envelope.get("data", [])
        manifest.append({"file": path.relative_to(root).as_posix(), "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                         "retrievedAt": envelope.get("retrievedAt"), "request": envelope.get("request"),
                         "rows": len(rows), "responseCapped": len(rows) >= 100})
    result = {
        "schemaVersion": 1, "id": "googl-2026-q3-drawdown", "asOf": "2026-11-05",
        "marketAsOf": market["asOf"], "supplementRetrievedOn": "2026-11-06",
        "title": "近期回撤：从财报前分歧，到财报后的现金与估值重估",
        "summary": "这轮回撤分两段：财报前GOOGL已跌8.17%，与XLC接近，已知搜索竞争、Cloud交付和投资回报分歧，尚无证据把全部跌幅归于单一催化。10/28盘后搜索低于事前媒体样本、Cloud高增却伴随负FCF，次日放量跌12.64%，机构随后重估搜索变现与现金回报。11/02触及低点后反弹，经营争议仍待数据验证。",
        "controversies": controversies, "events": events, "windows": windows,
        "expectationComparisons": expectations, "brokerComparisons": legacy["brokerComparisons"],
        "materials": materials, "sources": [sources[s] for s in sorted(used)], "newsArchive": manifest,
        "limitations": [
            "财报前补查覆盖10/13–27公开新闻；此后取得的档案只用其原始发布时间定位，不假定当天投资者已阅读全部材料。信息记录不等于价格因果证明。",
            "10/23及10/27事前样本已有证据，10/13完整一致预期和逐日机构修订仍缺；不把新样本倒填到起点。",
            "日线只能显示相邻交易窗口；盘中消息前的价格也在当天收益中。日期不含时分的研报不默认盘前已知。",
            "10/28盘后发布与10/29价格反应分开；次日10-Q只核对数值。媒体转述与本地卖方原件分列，完整电话会及相关专家原文仍缺。",
            "新闻补查日期晚于研究截至日，原始文章发布日期均不晚于被分析节点；截至日期仍为2026-11-05，行情仅至11/04。",
        ],
        "priceBasis": "未复权收盘价、不含现金分红；成交量倍数采用终点此前20个交易日均量。",
        "expandedWindow": legacy["priceStats"]["expandedWindow"],
    }
    validate(result, prices, sources)
    return result


def validate(data, prices, sources):
    assert len(data["controversies"]) == 3
    assert [e["date"] for e in data["events"]] == sorted(e["date"] for e in data["events"])
    assert len({e["id"] for e in data["events"]}) == len(data["events"])
    for event in data["events"]:
        for ref in event["sourceRefs"]:
            source = sources[ref]
            assert source.get("publicationVerified", True), (event["id"], ref)
            # Month-only July sources are safely before October, not assigned a day.
            assert source["date"][:10] <= event["date"], (event["id"], ref)
        obs = event["priceObservation"]
        for symbol, value in obs["returns"].items():
            expected = prices[symbol][obs["endDate"]]["close"] / prices[symbol][obs["startDate"]]["close"] - 1
            assert abs(value - expected) < 1e-12
        assert obs["volume"]["baselineEnd"] < obs["volume"]["date"]
    release = next(e for e in data["events"] if e["id"] == "oct28-release")
    assert release["priceObservation"]["endDate"] == "2026-10-29"
    assert release["publishedAt"].startswith("2026-10-28T20:")
    for row in data["expectationComparisons"]:
        assert row["forecastPublishedAt"] < "2026-10-28T20:00"
        assert abs(row["surprisePct"] - (row["actual"] / row["expectation"] - 1) * 100) < 1e-10
    assert next(x for x in data["brokerComparisons"] if x["broker"] == "CMB International")["security"] == "GOOG / Class C"
    used = {s["id"] for s in data["sources"]}
    for row in data["events"] + data["materials"] + data["expectationComparisons"] + data["brokerComparisons"]:
        for key in ("sourceRefs", "verificationRefs", "supplementalRefs"):
            assert set(row.get(key, [])) <= used


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    data = build(args.root)
    output = args.output or args.root / "assets/review-events.json"
    output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Review built: {len(data['events'])} events, {len(data['sources'])} sources, {len(data['expectationComparisons'])} ex-ante comparisons; chronology and returns verified.")


if __name__ == "__main__":
    main()
