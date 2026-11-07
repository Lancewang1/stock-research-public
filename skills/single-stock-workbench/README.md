# Single Stock Workbench · 个股研究工作台

完整技能源码及固定GOOGL案例。首页展示40行完整盈利模型；每个预测数字标明“假设”或“计算结果”。计算结果只读，点击直接看公式、代入值和真实输入；例如Search收入由上年同季收入与同比假设计算，只修改同比，不直接填收入金额。假设首层展示采用理由、数值依据和证据边界，详细分析与原文记录折叠。窗口只显示当前条目，保留逐级依赖及返回导航。Cloud按企业服务、AI客户和独立TPU组织，情景须显式应用到盈利表。研究快照2026-11-05，费用证据更新2026-11-06；不是实时数据。

本次发布包含全模型的公式、假设依据与来源说明更新，规则见[公式与假设工作流](references/formula-assumption-workflow.md)。[打开在线模型](https://lancewang1.github.io/stock-research-public/demos/googl-workbench/)；部署状态以仓库的 GitHub Pages 工作流为准。

假设说明按客户展示口径组织：先写来源机构、日期与数值，再说明我们的分析。已有原文链接可直接打开；本地版还可查看已取得的MS、巴克莱原始模型。便携版保留来源记录，不附原始工作簿；未取得对应研报链接时不会用机构首页代替。单元格等信息收在“模型取数明细”中。

## 安装与打开

将本目录复制到你的技能目录，如`~/.codex/skills/single-stock-workbench`，通过`$single-stock-workbench`调用。直接使用页面无需安装技能：打开`outputs/googl-dashboard.html`或仓库中的`demos/googl-workbench/index.html`，也可访问上方在线模型。公开包可离线重建相同页面。

## 离线重建

需要Python 3.10+；重建固定案例只使用Python标准库，不需要API或原始研报。

```bash
python -X utf8 scripts/build_dashboard.py --case assets/example-googl-case.json --output outputs/googl-dashboard.html
```

## 验证

计算测试需要Node.js 20+：

```bash
node tests/test_model.mjs assets/example-googl-case.json
node tests/test_cloud_model.mjs
```

DOM测试另需jsdom。用npm在自选工具目录安装`jsdom@26`，将`STOCK_DASHBOARD_QA_MODULES`环境变量设为该目录下`node_modules`的绝对路径，再运行：

```bash
node tests/dom-cloud.cjs outputs/googl-dashboard.html
node tests/dom-smoke.cjs outputs/googl-dashboard.html
node tests/dom-model-details.cjs outputs/googl-dashboard.html
node tests/dom-number-provenance.cjs outputs/googl-dashboard.html
node tests/dom-formula-assumptions.cjs outputs/googl-dashboard.html
node tests/dom-client-language.cjs outputs/googl-dashboard.html
```

新增公式/假设检查针对计算结果只读、真实驱动编辑、首层叙述依据和详细证据折叠；命令应对本地最新构建执行，旧HTML的通过记录不代表本轮通过。这些是非视觉测试，不能替代浏览器截图验收。此前浏览器工具被网址校验阻断的记录保留。

测试便携包内的HTML或不带本地原件链接的重建页面时，`dom-formula-assumptions.cjs` 命令加上 `--portable`；它检验真实来源记录入口，而本地模式还会检查MS原始模型文件链接存在。全量文字与来源检查见 [客户用语与来源检查](references/client-language-audit.md)。

## 内容与数据边界

- `SKILL.md`、`agents/`：技能说明与入口。
- `assets/`、`scripts/`：全部界面、计算、取数及构建源码，包含可离线重建的固定案例。
- `references/`：研究方法、来源口径、历史费用检查与局限。
- `tests/`：计算和交互检查。
- `outputs/research/report-distribution-audit.json`：原始研报分发检查目录；不含报告正文。
- `outputs/research/customer_evidence_20261106/historical-checks.json`：已计算的历史检查结果。

API凭据、个人机器路径、原始API响应、受限研报及卖方工作簿未分发。取数与重新校准脚本需要用户自己的数据权限、原始资料及本地配置；本包不声称能在没有这些资料时重新获取或验证原件。`check_customer_evidence.py`的逐行来源复核也需要本地保存的Wind原始响应，公开包只附计算结果与来源说明。

研报分发清单只检查各PDF首2页和末5页可提取文字；未发现限制不等于获得许可。公司公告与外部材料通过来源链接访问。已有结构化数字、摘要和情景分别标明来源，不把研报原件改名后混入技能包。
# 2026-11-06 盈利模型更新

早期实现接入Workspace/传统GCP/AI云服务/独立TPU交付的成本、毛利、营业利润，分类资产年限驱动折旧，并提供税后SBC调整与EPS桥。方法和限制见[profit-model-method.md](references/profit-model-method.md)：早期曾以未分配收益校准，后续已改为现金成本倍率反推、额外Cloud校准收益默认0。2028不提供业务明细；当前只有真实假设可编辑并随情景保存，计算结果不提供填值框。

新增验证：`node tests/test_profit_model.mjs`。

# 复盘与迁移更新

新增：非Cloud可识别成本与集团利润变化桥；可调涨跌阈值/观察窗口/区间；同版本口径的EPS与PE拆分；按可获得日期分组的证据；FRED历史相关性与技术指标；研报驱动识别实验；Amazon分部模型迁移测试。方法、数据时效及边界见[review-lab-method.md](references/review-lab-method.md)。视觉验收已按用户要求取消，保留非视觉功能检查。

验证入口增加 `node tests/test_review_analysis.mjs`。离线重建仍使用固定案例，无需原工作簿或API。

# MS 隐含假设基准更新（2026-11-06）

完整模型保留MS为底稿的40行、实际/预测季度及年度，详细模块不铺满首页。当前以本文件开头的只读公式与真实假设编辑规则为准；完整模型背景见[完整模型与行内明细](references/full-model-drilldown.md)。

2026-11-07早期版本新增十业务盈利拆分、GAAP与SBC税后调整桥，以及融合QQQ/XLC、历史EPS版本和事件证据的分阶段复盘。方法和已知分摊限制见[主表与阶段复盘](references/business-statement-and-phases.md)。其直接修改收入金额或默认计算毛利率的旧交互已由真实驱动编辑替代。

默认以MS收入及Cloud营业利润反推企业增长和现金成本倍率，保留全部用户假设编辑、保存和恢复入口。原研究输入保留；修改后不会自动对齐MS。方法、局限和重建顺序见 [MS隐含假设基准](references/ms-implied-baseline.md)。额外Cloud校准收益默认0；集团非Cloud共享成本仍有未识别分配。

