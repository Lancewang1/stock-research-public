# 取数与核验

静态看板可以使用制作时获取的真实资料。浏览器离线运行，API凭据与网络调用仅用于构建侧。

## 来源路由

| 问题 | 优先来源 | 核验重点 |
|---|---|---|
| 近期价格和回撤 | EODHD日线、Wind日线 | 相同交易日、原始收盘/复权口径、OHLC有效性、独立源容差 |
| 财务与EPS | SEC companyfacts、10-Q/10-K、公司IR | 季度/累计、持续经营/合并、普通股分子、股息、摊薄股数 |
| 公司指引和业绩 | 业绩发布/电话会原文，Wind公告与新闻定位 | 实际值/指引分离、发布日期、适用期间、原文位置 |
| 客户与供应链 | 客户/供应商官网披露、SEC文件，Wind检索 | 合同主体、金额期限、已投产时间、多云份额、收入定义 |
| 宏观背景 | FRED DGS10/VIXCLS/DTWEXBGS | 单位和各自截止日；贸易加权美元并非DXY |

本地`API 整合.txt`是配置清单，按Markdown表格解析所需值，不打印整个文件。仅把对应凭据发给它所属服务。异常只记录HTTP状态与错误类型，避免异常字符串暴露带token的URL。API服务的“Active”描述不证明当前调用成功，必须保留本次结果。

Wind使用现有`wind-mcp-skill`的CLI及参数定义。给子进程传环境变量和参数数组，避免PowerShell拼接JSON或把密钥写到命令行。新闻走financial_docs.get_financial_news，公告走get_company_announcements，美股行情走global_stock_data。

## 构建侧脚本

- `scripts/research_recent.py`：近期行情、公司披露及回撤材料。
- `scripts/research_chain.py`：客户、供应商与竞争对手材料。
- `scripts/research_anthropic.py`：Anthropic申报记录、财务与合同检索；分别保存SEC元数据、原始网页及Wind摘录，原始表格缺失时保持待核。
- `scripts/research_contracts.py`：Google、Broadcom、AWS、Microsoft的交易对手披露；区分服务采购、设备租赁、容量、融资和担保，记录同一承诺的重复公告。
- `scripts/fetch_financials.py --source-dir <材料目录>`：SEC公司事实与申报元数据。
- `scripts/verify_financials.py`：从本地SEC响应构建财务核验与披露日期表。
- `scripts/fetch_macro.py --source-dir <材料目录>`：FRED宏观序列。
- `scripts/build_research.py`：合并回撤、产业链、宏观与财务核验快照，检查来源引用后生成`assets/research.json`。
- `scripts/research_local_models.py`与`research_local_reports.py`：对用户批量ZIP材料做目录盘点及相关原件读取，生成本地模型与研报证据；运行前先看参数及已存盘点。

`research-local-models.json`、`research-local-reports.json`、`research-anthropic.json`与`research-contracts.json`存在时由`build_research.py`一同合并。按原始文件SHA256去重，保留压缩包和内部路径；已阅读页/单元格与仅盘点条目分别记载，不宣称所有报告均已精读。卖方数字保持其版本日期与预测身份，不能把旧预测直接当当前实际或共识。缓存值不证明原工作簿所有公式无误，也不代表本轮已在Excel重算。

SEC submissions中的申报日期、accession及文件名只验证申报记录，不证明正文财务数字。companyfacts只返回注册费`ffd`标签时，不把注册发行金额当已完成融资。Wind返回的英文披露摘录与中文摘要分别标注；正文表格缺失、节选中金额留空时不能据此升级新闻数字。提取到TPU销售会计政策，也不等于取得特定客户合同及季度履约表。

先读各脚本参数或`--help`再重跑；有可复用的成功响应时不为格式调整重复请求。原始响应保存在`outputs/research/`，交付看板只嵌入必要摘要、引用和规范数据。成功接口响应与解析结果分别保存。

`build_case.py`在存在`assets/financial-verification.json`和`market-update.json`时合并这些固定快照。财务核验只覆盖列出的字段，不能把整个历史模型都改标“SEC已核实”。Q4没有独立季度XBRL事实时不把年度值当Q4值。

## 历史可得性

`publication_dates.json`以SEC的8-K Item 2.02提交日期匹配相关财报期；未匹配时保守采用定期报告提交日期。没有逐项确认公告时刻时，从下一交易日起生效。尚无原始披露日期的早期年份要保留“日期估计”说明。

公司事实的后续重述可能与首报不同。历史回看使用当时信息集；最新复盘可展示后续重述，但不得倒填为当时已知。未来年度EPS只用于当前时点前瞻估值，不能画成历史投资者当时知道的预测曲线。

回撤以统一价格口径计算，与基准比较必须起止日期相同。超额收益是相对差值，不是事件因果贡献。宏观序列终点不同则单独列期间，不能前填后宣称有该日观测。
