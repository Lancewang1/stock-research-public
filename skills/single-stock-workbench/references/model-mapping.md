# GOOGL 本地模型映射

本映射针对当前提供的三份模型版本，不自动猜测其他公司的行号。金额为 USD million，股数为 million，EPS 为 USD/share。所有值均为文件保存时的缓存，不触发外链或 Excel 重算。

`scripts/build_case.py` 只需 Python 3.10+ 标准库，无第三方依赖。直接读取原ZIP和工作簿，不依赖预先解压目录。

## 来源及日期

|来源|文件/包内路径|日期及证据|已扫描结构|
|---|---|---|---|
|Morgan Stanley|`stock-dashboard-demo_v9_2026-11-04.zip` 内 `stock-dashboard-demo/ms-model/clean.xlsx`|2026-10-29，`IndexInformation!B2`、`ModPubIndex!A2`|18 sheets；10 外链；manual 计算；clean 删除了全部 definedNames|
|Goldman Sachs|`GOOGL_GS_analyst_model_20260804.xlsx`|文件名及 core modified 元数据为 2026-08-04；封面没有明确报告日期，发布日期待原报告核实|12 sheets；无外链；默认计算设置|
|Barclays|`GOOGL_BARC_analyst_model_20260724.xlsx`|`ModelCover!F2` 为 24-Jul-2026；core modified 为 2026-07-23|15 sheets；14 外链；autoNoTable；iterate=1、iterateCount=1|

日期不同，不能把三份模型称为同一时点的市场一致预期，也不能按数据差异直接推断上调或下调。报告日期不能证明工作簿内部所有数值都是当日可得的版本。卖方预测仅为参考快照。

## 年度映射

|来源|2025A / 2026E / 2027E / 2028E 列|毛收入|扣 TAC 收入|TAC|GAAP 净利|GAAP EPS|
|---|---|---|---|---|---|---|
|MS `Model`|EP / EQ / ER / ES|16|按毛收入减第22行TAC计算|22|86|90|
|GS `Income Statement`|DB / DC / DD / DE|64|85|68（原表为负费用，展示取负）|267|278|
|BARC `Publishing IS`|EA / EF / EK / EP|6|5|9|51|52|

MS 的第86/90行明确标为持续经营净利/EPS；GS与BARC对应行为总GAAP净利/EPS。案例保留这个定义差异。若涉及终止经营项目，不得不加调整直接比较。

GS `P&L Summary!AA5:AC5` 链接毛收入，与旧 demo 中写死的“GS ex-TAC 券商记录”不是相同数据。不得因券商名称将本次 GS 毛收入错误剔除。BARC 报表首先展示净收入，但有单独毛收入行，必须读取第6行再与 MS / GS 毛收入对比。

MS 2022–2028 年度列为 EM:ES。GS 2022–2028 年度列为 CY:DE。BARC 2022–2028 年度列为 DL,DQ,DV,EA,EF,EK,EP（每年四季及年合计）。构建程序必须校验期间表头和关键行标签，布局不一致时报错。

## 驱动与来源

MS 年度分部：`Rev Roll-up` 第26、33、58、93、99、105行依次为搜索、YouTube广告、网络、Cloud、订阅/平台/设备、Other Bets；111行为套保。费用为 `Expense Drivers` 第167–169行。`Model` 第18行营业成本、第54行营业利润、第64行其他收益、第84行税率、第94行摊薄股数、第220行Capex。

MS 季度：`Model` 第5行是期间结束日，M:DL有季度数值；DM:DP有2028年/季度标题但关键收入、利润和分部数值为空，不生成2028季度预测。2028年度仍可做情景延展。Cloud来自 `Non-Core Losses` 第56行，订阅来自 `Other Drivers` 第31行。各sheet日期列应单独识别；不得把年度列与季度列混用。

GAAP研发/销售/管理费用取`Expense Drivers`第167/168/169行，不误用`Model`第41/42/43行ex-SBC费用。`Model`第44行SBC包括COGS部分；第46行折旧、第47行摊销均已计入成本/费用，是备查项目，不能再扣一次。

制作时新增SEC companyfacts核验：`assets/financial-verification.json`保存按期间/字段的原始tag与accession。9个季度可直接取到部分事实，35项收入/营业利润/净利/股数核对一致；2024Q4、2025Q4缺独立季度事实，未将年度数冒充Q4。公告EPS优先取SEC披露，MS原EPS保留在`msOriginalEps`。

2026Q3例外：MS `DG90`用净利26,468/股数12,368得约2.14；SEC披露优先股股息298、普通股摊薄分子26,170、摊薄EPS2.12。2026Q2优先股股息86。各期间的if-converted稀释测试不能简单跨季加总复原；年度情景EPS明确为简化桥接口径。

`Rev Roll-up` 第86行是 Cloud+订阅旧口径合计，不是额外分部。Cloud已拆分时禁止再次加总该行。早期分部缺失为null，不补零、不倒推分摊。

年度历史直接从 MS 年度列读取，禁止用上市后的2004Q3/Q4拼接为完整2004年，也禁止把季度EPS简单相加为年度EPS。

## 引用与验证边界

每条模型输出保存来源ID、sheet及单元格映射。原始文件SHA-256记录在案例元数据中。已保存缓存可用于本地分析，不代表公式在当前Excel环境中可可靠重算。

ZIP中的 `fc.json` 电话会与研报摘录原文/音频未随包提供。新研究中已另取的公司披露/API证据按新来源引用，其余摘录仍是未核验材料，不能整包改称已核实。旧demo的综合情景加减点规则不作为新默认值。

ZIP中的 `raw/GOOGL.json` 为离线行情快照。新取EODHD/Wind已核对近期重叠价格，并将GOOGL/QQQ/XLC更新至2026-11-04；该验证不覆盖原包全部历史和所有指数。采用价格收益，不自动等同含分红再投资收益。每条序列标真实截止日期。
