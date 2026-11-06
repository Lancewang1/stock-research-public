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
