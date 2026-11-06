# Single Stock Workbench · 个股研究工作台

完整技能源码及固定GOOGL案例。盈利模型置顶；合同收入与客户经济性分别显示证据、可编辑假设和计算结果。Cloud情景可应用到盈利表。研究快照2026-11-05，费用证据更新2026-11-06；不是实时数据。

## 安装与打开

将本目录复制到你的技能目录，如`~/.codex/skills/single-stock-workbench`，通过`$single-stock-workbench`调用。直接使用页面无需安装技能：打开仓库中的`demos/googl-workbench/index.html`或GitHub Pages。

## 离线重建

需要Python 3.10+；重建固定案例只使用Python标准库，不需要API或原始研报。

```bash
python -X utf8 scripts/build_dashboard.py --case assets/example-googl-case.json --output outputs/googl-dashboard.html --public
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
```

这些是非视觉测试，不能替代浏览器截图验收。最近一次浏览器工具被网址校验阻断，尚未完成视觉验收。

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

主表接入Workspace/传统GCP/AI云服务/独立TPU交付的成本、毛利、营业利润，分类资产年限驱动折旧，并提供税后SBC调整与EPS桥。明细参数可编辑并随情景保存。方法和限制见[profit-model-method.md](references/profit-model-method.md)：初始与MS校准，存在显著未分配收益；非Cloud仍为合并成本残余；2028不提供业务明细。浏览器视觉验收尚未完成。

新增验证：`node tests/test_profit_model.mjs`。

# 复盘与迁移更新

新增：非Cloud可识别成本与集团利润变化桥；可调涨跌阈值/观察窗口/区间；同版本口径的EPS与PE拆分；按可获得日期分组的证据；FRED历史相关性与技术指标；研报驱动识别实验；Amazon分部模型迁移测试。方法、数据时效及边界见[review-lab-method.md](references/review-lab-method.md)。视觉验收已按用户要求取消，保留非视觉功能检查。

验证入口增加 `node tests/test_review_analysis.mjs`。离线重建仍使用固定案例，无需原工作簿或API。

# MS 隐含假设基准更新（2026-11-06）

默认以MS收入及Cloud营业利润反推企业增长和现金成本倍率，保留全部用户假设编辑、保存和恢复入口。原研究输入保留；修改后不会自动对齐MS。方法、局限和重建顺序见 [MS隐含假设基准](references/ms-implied-baseline.md)。额外Cloud校准收益默认0；集团非Cloud共享成本仍有未识别分配。

