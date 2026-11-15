# 技能下载

[single-stock-workbench.zip](single-stock-workbench.zip)：完整个股研究技能，包含源码、参考方法、测试和可离线重建的GOOGL案例。

[安装与重建说明](../skills/single-stock-workbench/README.md) · [逐文件SHA256清单](../skills/single-stock-workbench/MANIFEST.json) · [在线看板](https://lancewang1.github.io/stock-research-public/demos/googl-workbench/)

压缩包不包含凭据、原始API响应、受限研报原件或卖方工作簿。

## Bloomberg 数据刷新工作簿

[WENDAO_BBG_Refresh_Template_20261115.xlsx](WENDAO_BBG_Refresh_Template_20261115.xlsx)：WENDAO Rates 的 Bloomberg 数据刷新模板，102 个 BDH() 公式块，只含 ticker 与公式，不含任何数据。

- `EUR_ESTR`：EUR €STR OIS 1Y–10Y（EESWE1…EESWE10 Curncy）
- `FX_SPOT_FWD`：USDHKD、USDCNH 即期与 1M/2M/3M/6M/9M/12M 远期点（BGN）
- `RATES_LONG`：USD SOFR、HKD、SGD SORA、CNY FR007、CNH CCS、KRW、TWD、CNY NDIRS、SHIBOR 九条互换曲线
- `README` 页有操作步骤：在装有 Bloomberg 插件的 Excel 中打开，等公式填满，另存为数值版，再用包内 `wendao/import_bbg_workbook.py` 导入

使用者需自行具备 Bloomberg 终端权限；数据的再分发受 Bloomberg 协议约束。

[FX_History_Refresh_Bloomberg_20261110.xlsx](FX_History_Refresh_Bloomberg_20261110.xlsx)：早先的 FX 历史刷新工作簿（USDCNH、USDHKD 即期与 1W–1Y 远期）。
