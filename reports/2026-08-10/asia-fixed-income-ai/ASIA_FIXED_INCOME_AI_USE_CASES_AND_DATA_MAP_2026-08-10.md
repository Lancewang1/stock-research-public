# 亚洲固定收益金融垂类 AI：应用场景与数据源蓝图

日期：2026-08-10  
范围：Asia Fixed Income，覆盖亚洲离岸信用债、主要本币债券、利率衍生品、相关外汇市场，以及 Private Credit / Asset-Backed Financing<br>
目标用户：资产管理人、保险资管、银行自营与交易台、对冲基金、私人银行/财富管理机构的专业团队  

## 0. 先说结论

这个产品不应被定义为“会回答债券问题的聊天机器人”，而应被拆成三个相互连接的工作台：

1. **Asia Credit Copilot**：连接信用主体、研究观点、债券与贷款条款、风险事件、市场行为和组合暴露，回答“信用发生了什么变化，风险如何传导，我应关注哪项资产”。
2. **Asia Rates Copilot**：追踪央行反应函数、曲线、供给与资金面，回答“利率为何变化，下一步有哪些可检验的情景”。
3. **Asia FX & Hedging Copilot**：把汇率、远期点、基差、波动率与债券现金流连接起来，回答“外汇风险来自哪里，怎样以可解释的成本对冲”。

最合适的技术形态不是把实时价格、财务数字和政策事实训练进模型参数，而是：

- 大模型负责意图理解、跨语言文档阅读、信息归纳、假设生成和解释；
- 检索系统负责返回带时间戳、来源和权限控制的事实；
- 确定性引擎负责收益率、OAS、DV01、carry/roll、远期点、对冲比例和情景 P&L；
- 每个关键结论显示 `as-of time`、原始出处、计算口径、置信度和缺失数据；
- 初期定位为“决策支持”，而不是自主下单或无人工复核的信用审批。

### 场景优先级定义

- **P0**：数据较容易获得，能快速证明模型在研究效率和事实准确性上的价值。
- **P1**：需要机构级行情、组合持仓或风险系统，价值高，适合付费客户试点。
- **P2**：需要交易场所、经纪商、内部通信或高频数据，壁垒最高，但接入和合规成本也最高。

---

## 1. Credit 场景清单

本章保留 11 个场景。原 C8“主权—银行—企业信用传导图”不再作为独立产品场景；所需的关联关系和风险传导能力并入 C3 与 C6。为保持既有讨论和引用稳定，C9—C12 暂不重新编号。

### C1. 信用研究整合、横截面对标与观点演化（P0/P1）

- **谁**：买方信用分析师、行业研究员、信用 PM、投资委员会成员。
- **什么时候**：首次覆盖、财报或重大事件发布后、月度/季度复核前，以及需要形成或挑战信用观点时。
- **要解决什么**：在公司披露、评级报告、卖方研究和内部历史判断之间建立统一的信用研究视图。横截面上，一方面比较不同卖方机构对同一主体的预测、评级、公允利差、催化剂和风险判断，识别共识与真正分歧；另一方面将该主体与合适的行业 peers 比较，判断其业务质量、杠杆、流动性、再融资能力、债券结构和市场估值处于什么位置。时序上，追踪同一主体及各家机构的观点如何随财报、融资、评级和其他事件变化，判断哪些假设得到验证、哪些机构领先或滞后于事实与市场。
- **现在怎么解决**：分析师分别下载多期财报、公告、评级和卖方报告，在 Excel 更新指标，在不同文档中寻找同业口径和历史观点；报告版本、数据截止日、预测口径和 peer 选择经常不一致，跨中文、英文、日文、韩文材料时还需人工翻译。
- **AI 应如何介入**：整合多语言、多版本研究材料，把“公司已披露事实、外部机构观点、内部判断和市场定价”分开；生成同一主体的跨机构观点比较、主体对 peers 的横截面对标，以及按事件组织的观点演化时间线；解释 peer 的纳入/排除理由和各家观点分歧的来源，并为事实与观点保留原文引用和 as-of time。
- **关键数据**：审计财报、临时公告、业绩会材料、评级报告、卖方研究及其历史版本、债务到期表、债券价格/利差、行业与同业指标、内部信用备忘录和历史投资判断。
- **成功指标**：研究首稿和例行更新用时、关键数字与观点的可追溯率、重要分歧和观点变化的遗漏率、peer 对标的人工接受率、分析师对整合结果的修改量。

**重要边界**：不同卖方报告的发布时间、预测期、评级体系和估值口径不可直接混为“市场共识”；受版权或合同限制的研究材料只能在获准范围内检索、引用和展示。

### C2. 新券定价、相对价值与下单建议包（P1/P2）

- **谁**：信用 PM、信用交易员、新券分析师、银行 DCM/销售支持团队。
- **什么时候**：新券宣布、IPT、价格指引收窄到最终定价的数小时内。
- **要解决什么**：估计合理发行利差、新券溢价、合适的订单规模，以及新券相对存量曲线、同评级同业和不同币种融资的性价比。
- **现在怎么解决**：从承销团邮件或聊天中抄录条款，在 Bloomberg/LSEG 找可比券，用 Excel 调整久期、评级、优先级和流动性，再通过交易员和卖方 sales 获取市场颜色。
- **AI 应如何介入**：实时抽取 term sheet；自动生成可比券集合并说明纳入/排除理由；给出曲线插值、新券溢价区间、carry/roll 和压力情景 P&L；将“模型公允值”“交易员颜色”“内部持仓约束”明确分栏，避免伪精确。
- **关键数据**：新券条款与 book updates、存量券/同业价格、无风险及 swap 曲线、内部 RFQ/axes、投资者订单和组合限额。
- **成功指标**：从条款到初版建议小于 5 分钟；公允利差区间有稳定校准度；最终下单理由可以事后复盘。

### C3. 信用负面新闻、关联风险与市场异动雷达（P0/P1）

- **谁**：信用分析师、PM、交易员、风险经理、CIO 值班人员。
- **什么时候**：持续监控；在主体或关联方出现负面新闻、评级行动、监管或法律事件，以及债券、股票、CDS、FX 等市场价格异常时重点触发。
- **要解决什么**：从五个层面尽早发现可能损害信用质量的变化：当前主体的经营、治理、融资和法律事件；母公司、子公司、担保人、SPV、股东和合资方等关联公司风险；主要客户、供应商、承包商、竞争者及行业上下游冲击；债券利差、CDS、股票、FX、成交量和 dealer 报价等市场异动；利率、汇率、商品、主权、监管、制裁和地缘政治等宏观负面新闻。告警需要说明风险通过什么路径影响主体、哪些债券和账户受影响、市场是否已经确认或定价，以及应立即复核还是继续观察。
- **现在怎么解决**：团队分别盯新闻终端、评级邮件、公司公告、微信群/聊天、行业数据和价格告警；再人工去重、核实来源、关联发行主体与持仓。信息散落、噪声大，集团关系和产业链影响容易遗漏，夜间及跨语言市场尤其依赖人工值班。
- **AI 应如何介入**：对多语言新闻、公告和市场信号聚类去重并区分首发来源、转载和传闻；把事件映射到主体、关联公司、产业链、具体债券和内部持仓；结合市场异动判断事件是否获得价格或交易行为确认；按影响路径、证据强度、持仓暴露和时间紧迫性生成带反证的分级告警。
- **关键数据**：官方公告、评级行动、可信新闻与行业信息、公司关系及供应链数据、债券主数据、债券/CDS/股票/FX/商品行情、成交和 dealer 报价、宏观与政策事件、内部持仓和预设风险规则。
- **成功指标**：重大负面事件召回率、有效告警精确率、关联主体和持仓映射覆盖率、从首个可信来源到告警的延迟、对市场异动的解释覆盖率、夜间人工值班负担。

**重要边界**：负面新闻不等于信用恶化，市场异动也不证明单一因果；系统必须区分已确认事实、可信报道、市场传闻和模型推断，并显示尚未得到支持的传导环节。

### C4. 募集说明书、契约与资本结构条款解析（P0）

- **谁**：信用分析师、法律/合规、PM、特殊机会投资者。
- **什么时候**：首次覆盖、新券评审、交换要约、违约或重组前。
- **要解决什么**：确认担保范围、抵押物、结构性次级、cross-default、change of control、restricted payments、资产出售、财务维持条款、适用法律及债权人表决机制。
- **现在怎么解决**：在数百页 PDF 中 Ctrl+F，手工抄到 covenant matrix；复杂结构交给律师，多个版本之间的条款变化难以及时比较。
- **AI 应如何介入**：做版面感知 OCR、条款分类、定义回链和 clause-level 引用；生成“债务层级—担保—资产—法人”结构图；逐条比较新旧债券或交换前后条款；对无法确认的法律结论明确拒答并提交人工复核。
- **关键数据**：offering circular、indenture、trust deed、supplement、担保文件、交易所公告、公司组织架构和债务清单。
- **成功指标**：条款抽取准确率、引用命中率、律师复核修改率、单只债券建档时间。

### C5. 二级市场相对价值、换券与流动性筛选（P1）

- **谁**：信用 PM、交易员、相对价值策略团队。
- **什么时候**：每日开盘前、价格异常时、组合再平衡或有资金申赎时。
- **要解决什么**：识别同一发行人曲线、母子公司、不同优先级、不同币种或同业之间的便宜/昂贵券，并判断价差是否足以覆盖流动性和交易成本。
- **现在怎么解决**：终端筛券、手工维护 issuer curve、Excel z-score、询价和阅读 dealer runs；不同数据源的 evaluated price、可成交价和陈旧报价经常混在一起。
- **AI 应如何介入**：先区分 firm quote、indicative quote、evaluated price 和 last trade；再做 OAS/曲线残差、carry/roll、可选性和流动性调整；生成“买 A/卖 B”的可执行检查表和盈亏平衡交易成本，而不是只报一个 z-score。
- **关键数据**：双边报价、TRACE/场所成交、evaluated pricing、收益率/掉期曲线、债券现金流和嵌入期权、dealer axes、内部成交历史。
- **成功指标**：候选券人工接受率、成交后滑点、价格陈旧误报率、扣除成本后的换券收益。

### C6. 组合多因子风险、动态相关性与压力测试（P1）

- **谁**：信用 PM、独立风险、CIO、保险资管 ALM 团队、跨资产风险团队。
- **什么时候**：每日风险检查、周会和组合再平衡前；在利率、汇率、权益、商品或信用市场发生显著变化，以及评级迁移、赎回压力和流动性冲击时。
- **要解决什么**：在组合层面同时看清 issuer、集团、行业、国家、担保链和流动性集中度，以及组合对 USD/本币利率、FX、equity、信用利差、商品和波动率等大类风险的敏感度；通过 dynamic correlation、factor VaR/Expected Shortfall、历史情景和自定义联合压力测试，识别相关性上升、分散化失效、降级/违约、回收率变化和被迫出售可能造成的损失。
- **现在怎么解决**：正式风险系统提供部分静态敏感度和 VaR，分析师再用 Excel 补充主体映射、跨资产 beta 和情景；信用、利率、FX、equity 与流动性风险经常分散在不同系统，“同一风险通过不同 SPV、担保人或共同因子重复出现”的识别不完整。
- **AI 应如何介入**：统一 ultimate parent、issuer、guarantor 和 security 暴露；整合正式风险引擎的 DV01/KRD、CS01、spread duration、FX 和其他因子结果；监测相关性和因子暴露随市场状态的变化；把自然语言情景转换为经批准的确定性压力参数，并解释组合损失来自哪些风险因子、持仓和传导路径，列出最脆弱头寸、潜在对冲方向与数据缺口。
- **关键数据**：完整持仓和历史权重、benchmark、现金流、债券及衍生品风险指标、利率曲线、FX、equity、信用指数、商品和波动率数据、评级迁移矩阵、PD/LGD、价格与流动性指标、集团关系、基金申赎或保险负债信息。
- **成功指标**：风险归因覆盖率、法人和因子映射错误率、VaR/Expected Shortfall 回溯表现、压力情景生成时间、相关性突变和集中风险的有效发现数、与正式风险引擎结果的一致性。

**重要边界**：亚洲信用债的非同步收盘、evaluated price 和低成交频率会扭曲相关性与 VaR；产品必须显示数据新鲜度、估计稳定性和模型适用范围，且不得用 AI 计算替代机构正式风险引擎。

### C7. Private Credit 与 Asset-Backed Financing 分析（P1/P2）

- **谁**：private credit、private lending、基础设施债务和特殊机会团队，保险资管、银行信贷与投资委员会，以及法律、技术和风险顾问。
- **什么时候**：项目筛选、尽职调查、条款谈判、信用委员会审批、投后监控、再融资，以及 amendment、waiver、workout 或资产处置阶段。
- **要解决什么**：在信息不标准、资产缺少公开价格且交易结构高度定制的情况下，判断借款人、sponsor、担保人、承租人或 off-taker 的信用质量，穿透抵押品、担保、现金流 waterfall、covenant 和 intercreditor 安排，并比较不同结构和下行情景的风险回报。重点覆盖增长较快的 data center asset-backed financing/private lending：电力接入和容量、建设进度与 CAPEX、tenant/hyperscaler 集中度、合同期限、利用率、设备与技术迭代、再融资及残值风险。
- **现在怎么解决**：投资团队、律师、技术顾问和估值机构分别阅读 teaser、CIM、data room、合同、工程报告和模型，再通过 Excel、邮件及会议人工合并假设；文件版本多、口径不一，条款例外、模型假设和投后 covenant 变化难以持续追踪。
- **AI 应如何介入**：整合 data room 中的财务、法律、商业和技术材料，重建交易参与方、债权层级、抵押品和现金流结构；比较市场条款与同类交易，识别关键假设、缺失材料和相互矛盾的信息；协助生成可追溯的信用委员会材料和下行情景，并在投后持续比较 borrower reporting、经营指标、项目里程碑和 covenant，支持 amendment、waiver 与 workout/recovery 分析。
- **关键数据**：teaser/CIM、data room、历史和预测财务、sponsor model、term sheet、贷款与担保文件、intercreditor agreement、资产评估和技术报告、运营及 covenant 报告、可比交易与市场条款；数据中心项目还包括土地和许可、电力合同、建设预算与进度、tenant/offtake 合同、容量和利用率数据。
- **成功指标**：从 data room 到初版信用材料的时间、关键条款与风险遗漏率、模型假设和结论的可追溯率、尽调问题和条款例外的人工接受率、投后 covenant/经营异常的发现时效、外部顾问复核修改率。

**重要边界**：Private Credit 数据高度保密且不同交易之间可比性有限；AI 只能协助整理、比较和情景分析，不能替代法律意见、工程尽调、资产评估、正式授信审批或受托责任人的判断。

### C9. OTC 报价、sell-side axe 与做市商行为盯盘（P1/P2）

- **谁**：信用交易员、信用 PM、交易助理、市场风险团队；也适用于现金国债/利率产品的 OTC 交易台。
- **什么时候**：每日开盘前、盘中 dealer runs/axes 到达时、重大事件后、询价或交易决策前后。
- **要解决什么**：把散落在 dealer 邮件、聊天、CSV、电子平台和 broker runs 中的 `BID AXE`、`OFFER AXE`、indicative quote、firm quote 与 RFQ 回应整合成连续的报价状态；观察不同 market maker 报价的边际变化，从报价广度、持续性、方向和更新速度判断真实买卖压力、流动性与市场强弱。
- **现在怎么解决**：交易员和助理人工阅读 Bloomberg IB/合规聊天、邮件、Excel runs 及平台报价，手工统一债券代码、价格/收益率/利差和报价方向；报价更新频繁、格式不一，同一券跨 dealer 的历史变化很难留存，最终判断高度依赖个人记忆。
- **AI 应如何介入**：在获准渠道内解析原始消息，映射 `security—dealer—side`，统一 clean price/yield/spread、size、firm/indicative 和有效期；为每条报价标记 `NEW`、`REFRESH`、`IMPROVE`、`WORSEN`、`SIZE_UP/DOWN`、`WITHDRAW`、`EXPIRE`、`LIKELY_HIT/LIFTED`；按债券、发行人、行业和国家聚合 quote breadth、dealer dispersion、bid/offer persistence、axe churn、报价半衰期和价格改善，并生成带证据的强弱告警。
- **关键数据**：带原始时间戳和版本的 sell-side axes/runs、broker markets、indicative/firm quotes、dealer identity、side、price/yield/spread、size/minimum piece、有效期；内部 RFQ/quote response/fill、TRACE/场所成交、内部持仓与 dealer 历史行为。
- **成功指标**：债券与报价字段解析准确率、stale quote 识别率、跨 dealer 覆盖率、疑似 hit/lift 判断精度、告警误报率、从原始消息到可用市场图的延迟、人工整理时间下降。

**可产品化的信号示例**：如果某只券的 `BID AXE` 连续多日基本不变，而多个 dealer 的 `OFFER AXE` 频繁消失并在相同或更紧的 spread 重新补出，同时 RFQ/fill/成交记录显示 buy-side 主动 lift offer，则可推断 offer inventory 被持续消化，市场偏强。反之，如果 offer 只是被撤回、没有成交佐证，随后在更宽 spread 重现，更可能是 dealer 撤风险或流动性恶化，不能简单判为买盘强。

### C10. Realized Duration：单券与组合的经验 USD 利率敏感度（P1）

- **谁**：亚洲信用债交易员、信用 PM、组合风险经理、利率对冲交易员。
- **什么时候**：每日风险检查、美国利率大幅变化后、组合调仓或决定 Treasury/IRS hedge ratio 前。
- **要解决什么**：即使两只信用债拥有相同的 analytical modified duration，它们对 USD rates 的实际价格反应也可能因流动性、供需、dealer inventory、spread-rate correlation、票息/价格和可赎回性而明显不同。模型需要估计每只券过去 30/60/90 个交易日的 realized sensitivity，识别相对 analytical duration 的 outlier，并汇总组合层面的 realized duration 与 hedge gap。
- **现在怎么解决**：前台和风险通常使用静态 analytical duration/key-rate duration，再按名义 DV01 配 Treasury 或 IRS hedge；交易员凭经验修正“这只券不跟 rates”或“这只券 beta 特别大”，但这种判断很少被系统保存、回测或组合化。
- **AI 应如何介入**：对齐债券 total return/经票息与应计调整的价格变化和 USD Treasury key-rate/主成分变化；滚动计算 30/60/90 日 robust beta、置信区间、R²、稳定性和 stale-price 诊断；同时控制市场信用 spread、行业/评级 beta 和事件日，区分纯 rates sensitivity 与 flow/liquidity residual；输出单券 `realized duration gap = empirical duration - analytical duration`、同类 outlier、组合 bottom-up 与直接回归两套 realized duration，以及不同 hedge ratio 下的历史和压力情景误差。
- **关键数据**：同一收盘时点或可对齐的可执行/evaluated bond prices、coupon/accrual/call/corporate actions、UST par/zero/key-rate curves 或 IRS、OAS/市场信用指数、成交/quote freshness、组合权重和现有 Treasury/IRS hedge。
- **成功指标**：下一期 out-of-sample rates hedge error、30/60/90 日估计稳定性、相对 analytical duration 的增量解释力、outlier 命中率、组合 residual DV01、重大 rate move 下的对冲偏差。

**重要口径**：这里的 Realized Duration 本质上是经验 USD rates beta，不是债券合同现金流决定的传统久期。若不控制信用 spread、流动性和非同步报价，它会把“利率变化时恰好发生的买卖流”错误归因给 rates；产品必须并列展示 analytical KRD、empirical rates beta、置信区间和 unexplained residual，不能用一个黑箱数字替换正式风险指标。

### C11. Client Flow 与对冲行为监控（P2）

- **谁**：sell-side credit market maker、sales trader、desk strategist、inventory/risk manager。
- **什么时候**：盘中观察客户交易、美国利率大幅变化、desk inventory 偏离、制定 axes/报价或预判下一阶段买卖压力时。
- **要解决什么**：不同客户群对信用债利率风险的处理方式不同。部分 hedge fund 会快速用 Treasury/IRS/CDX 对冲，部分银行、保险和 long-only 账户可能保留更多 outright duration；这些结构性差异使同一 rates shock 下各类投资者产生不同的买卖方向、时滞和期限偏好。模型要总结历史 flow 与 hedge propensity，帮助 market maker 预判可能的现金债供需和 inventory duration transfer。
- **现在怎么解决**：sales 和交易员依赖个人记忆、聊天和日终 flow recap；CRM 客户标签、RFQ、现金债成交、对冲腿和 desk inventory 分散在不同系统。类似 convertible bond desk 会持续统计 delta，信用 desk 却很少形成可复算的 client rate-hedge ratio 或 flow beta。
- **AI 应如何介入**：在合规批准的客户 cohort 层面连接 RFQ/order/fill 与邻近时间窗口内的 Treasury future、IRS、CDS/CDX 或其他 hedge legs；学习不同 cohort、评级、久期、行业和 rate regime 下的 hedge ratio、hedge lag、cash-bond flow beta、net duration transfer 和后续 flow persistence；输出聚合 heatmap、情景化预期流和 desk inventory 风险，而不预测或展示单一客户下一笔交易。
- **关键数据**：合规维护的 client type/cohort、RFQ 与成交方向/规模/时间、可能的配套 hedge trades、sales notes、desk inventory/DV01、axes/quote response、rates/credit 市场变化、客户 mandate 和历史标签修正。
- **成功指标**：client/cohort 与 trade-side 映射覆盖率、paired-hedge 识别精度、hedge ratio 校准误差、rate shock 后聚合净 flow 方向命中率、inventory/DV01 预测改善、最小 cohort 和隐私规则违规数。

**重要边界**：`HF fully hedged`、`bank unhedged`只能作为待验证假设，不应成为硬编码规则；同一机构会因 mandate、会计、资金、basis 和仓位变化而改变行为。模型只能基于 sell-side 自有且获准使用的数据做聚合统计，并设置最小 cohort、匿名化、用途限制和完整审计，防止反推出客户身份或交易意图。

### C12. Fund Flow / Bond Maturity / Primary Pipeline 资金日历（P1/P2）

- **谁**：亚洲信用 PM、信用交易员、sell-side market maker、syndicate/new issue 团队、CIO。
- **什么时候**：每日/每周技术面判断、月末季末、集中到期/付息期、指数再平衡以及大型新券宣布和交割前。
- **要解决什么**：亚洲信用市场短期定价经常由投资人申赎和净供给主导。模型需要系统追踪大型 mutual fund/ETF inflow/outflow，与公开债券 maturity/coupon/call/tender profile、已宣布 primary pipeline 和 settlement date 对齐，形成按日期、国家、行业、评级、币种和久期分桶的净资金日历。
- **现在怎么解决**：团队分别查看 EPFR/Lipper/Morningstar、ETF shares outstanding、基金公告、Bloomberg/Dealogic new issue 页面和债券 maturity 表，再手工在 Excel 估算“有多少 cash 要 reinvest、多少 primary 要吸收”；数据频率、覆盖范围和到账/交割时间经常不一致。
- **AI 应如何介入**：建立 point-in-time cash-event ledger，计算 `预计净技术面 = fund inflow + maturity/coupon/call cash × reinvestment probability - fund redemption sale need - primary settlement - 其他已知供给`；将基金 flow 按最新可得持仓映射到 Asia credit bucket，对 announced deal 使用 settlement date，对未定价 pipeline 使用概率和规模区间；输出未来 1/5/20 个交易日的资金缺口、再投资高峰、供给拥堵和情景区间。
- **关键数据**：大型 mutual fund/ETF flow、AUM/shares outstanding、creation/redemption 与持仓；完整 bond master、maturity/coupon/call/tender/exchange offer；已宣布 primary deal、IPT/pricing/size/settlement、内部获准 pipeline；指数再平衡、基金分红/申赎规则、dealer inventory 和历史 reinvestment behavior。
- **成功指标**：maturity/coupon/call 覆盖率、fund-flow 覆盖和时滞、announced pipeline recall、净供给预测误差、reinvestment probability 校准、资金拥堵告警精确率、技术面信号对 spread/成交方向的增量解释力。

**重要边界**：债券到期现金不一定重新投入亚洲信用，ETF shares 变化也不等于所有最终投资者 flow；大型 mutual fund 的实时申赎通常不是公开数据，未宣布 primary pipeline 还可能包含 MNPI。产品必须显示数据覆盖率、公布时滞和概率区间，并把公开/商业数据与内部受限 pipeline 严格分层。

---

## 2. Rates 场景清单

### R1. 亚洲利率晨报与隔夜市场归因（P0/P1）

- **谁**：利率 PM、宏观策略师、交易员、机构销售。
- **什么时候**：亚洲各市场开盘前，以及伦敦/纽约向亚洲交接时。
- **要解决什么**：在 10 分钟内掌握隔夜美债、美元、商品和风险资产变化，区分真正驱动因素与事后叙事，并映射到 JGB、CGB、KTB、IGB、MGS 等本地曲线。
- **现在怎么解决**：依次查看终端图表、卖方晨报、新闻和聊天，手工截取关键价格；不同市场时区和休市日常导致错误比较。
- **AI 应如何介入**：按共同时间窗口重建价格路径；把已知事件、数据公布和价格反应对齐；输出“事实—可能解释—待验证证据”，并生成当天关键事件与风险清单。
- **关键数据**：全球及亚洲国债/OIS/IRS/期货、FX、商品、经济日历、新闻、央行操作和本地假日历。
- **成功指标**：晨报生成时间、价格/时间戳错误率、PM 对驱动归因的采纳率、引用覆盖率。

### R2. 央行反应函数与议息会议 Copilot（P0/P1）

- **谁**：宏观策略师、利率/FX 交易员、经济学家、资产配置团队。
- **什么时候**：议息会前一至两周、决定发布瞬间、记者会和会议纪要发布后。
- **要解决什么**：理解每家亚洲央行当前最重视的增长、通胀、汇率、金融稳定变量；区分基准情景与尾部情景；判断声明措辞和政策工具发生了什么变化。
- **现在怎么解决**：人工读声明、演讲和纪要，维护政策表格并参考卖方预测；语言差异和政策框架差异使跨国比较非常耗时。
- **AI 应如何介入**：逐句比较历次声明；建立可更新的 reaction-function card；结合 point-in-time 宏观数据和市场定价生成条件概率树；会后立即区分“决定、措辞、预测、操作工具”四类 surprise。
- **关键数据**：央行声明/纪要/演讲、官方预测、宏观 vintage、调查预期、OIS/IRS/FX 定价和历史会议反应。
- **成功指标**：声明变化召回率、发布时间到首版解读的延迟、情景概率校准、错误引用率。

### R3. 宏观数据发布的即时拆解与曲线影响（P1）

- **谁**：利率交易员、宏观 PM、销售交易、风险值班人员。
- **什么时候**：CPI、就业、PMI、GDP、贸易、信贷、预算等数据发布后的数秒到数分钟。
- **要解决什么**：区分 headline surprise、内部构成、前值修订和季节性噪声，并判断前端、长端、breakeven、swap spread 或 FX 哪个方向最敏感。
- **现在怎么解决**：依靠终端 headline、经济学家即时消息和人工 Excel；最初反应常只看 headline，之后才发现构成或修订相反。
- **AI 应如何介入**：解析原始表格而非转述新闻；与逐家调查分布、前值及历史 vintage 比较；调用事件研究返回相似情景；生成可证伪的曲线影响假设，不在数据不足时声称单一因果。
- **关键数据**：官方 release、调查分布、历史 vintage、分钟级曲线/FX/商品、事件日历和仓位代理。
- **成功指标**：结构化解析延迟、数字准确率、修订识别率、对历史反应分布的覆盖。

### R4. 曲线、蝴蝶、swap spread 的相对价值与 carry/roll（P1）

- **谁**：本币债 PM、利率 RV 交易员、银行自营盘。
- **什么时候**：每日筛选、曲线异常、政策预期变化或再平衡前。
- **要解决什么**：识别 2s5s10s、5s10s30s、现券—IRS、国债—准主权等结构的偏离；判断偏离是否有足够 carry、roll 和均值回归空间。
- **现在怎么解决**：每个市场维护独立 Excel/Python 模型；day count、假日、交割、最便宜交割券和 fixing 规则不一致，模型难复用。
- **AI 应如何介入**：自然语言生成筛选条件，但所有定价由统一曲线库执行；输出历史分位、carry/roll、风险中性盈亏平衡、止损触发和结构性解释；自动检查 convention 与 stale data。
- **关键数据**：可交易现券、OIS/IRS、期货及 CTD、repo、发行计划、曲线历史、合约和市场惯例。
- **成功指标**：计算与交易台基准一致性、错误 convention 告警、候选采纳率、扣成本后表现。

### R5. 国债供给、拍卖与财政融资冲击（P0/P1）

- **谁**：国债 PM、primary dealer、利率策略师、银行流动性团队。
- **什么时候**：财政预算、季度借款计划、拍卖公告、投标和结果发布前后。
- **要解决什么**：估算净供给、期限结构、到期再融资、央行持有变化和 dealer capacity；判断 auction tail、间接投标需求及对曲线的影响。
- **现在怎么解决**：从财政部/债务管理办公室网站抄日历，在 Excel 维护发行与到期，再结合 dealer survey 和历史拍卖表格判断。
- **AI 应如何介入**：自动维护逐券供给数据库；区分 gross issuance、redemption、coupon 和央行操作；生成拍卖预览/复盘 scorecard，并对异常结果寻找可验证解释。
- **关键数据**：官方发行和到期日历、拍卖结果、持有人结构、央行购债/回购、dealer 仓位代理、收益率曲线。
- **成功指标**：供给表准确率、公告到更新延迟、拍卖异常识别率、手工维护时间。

### R6. 组合久期、关键期限风险与宏观情景对冲（P1）

- **谁**：利率/信用 PM、保险 ALM、独立风险、CIO。
- **什么时候**：建仓、组合再平衡、事件前降风险、赎回或资本约束变化时。
- **要解决什么**：把自然语言风险观点转换为 DV01、key-rate duration、convexity、spread duration、curve beta 和 hedge ratio；比较现券、期货、IRS、OIS 的成本和基差风险。
- **现在怎么解决**：风险系统导出敏感度，PM 在 Excel 试算，再由交易员选择工具；意图、约束和最终交易之间缺乏可审计链。
- **AI 应如何介入**：把“降低中国 5 年端风险但保留韩国 carry”等意图转换为明确约束；调用已批准优化器；解释剩余风险、保证金、流动性和模型失配；输出人可审批的 hedge ticket 草案。
- **关键数据**：逐券持仓与现金流、曲线和波动率、衍生品合约、保证金/融资、交易成本、组合和监管限额。
- **成功指标**：与正式风险引擎一致性、对冲后残余风险、审批时间、约束违规次数。

### R7. 跨市场、汇率对冲后收益与 cross-currency basis 比较（P1）

- **谁**：全球债券配置 PM、保险公司、银行 ALM、宏观 RV 团队。
- **什么时候**：国家/币种配置、替代资产比较、季度再平衡或基差剧烈变化时。
- **要解决什么**：在同一基准币种下比较不同亚洲国债/准主权的 fully hedged yield、carry、roll、basis、保证金和流动性，而不是只比较名义收益率。
- **现在怎么解决**：从多个终端页面抄现券收益率、FX forward 和 basis，在复杂 Excel 中统一 day count 与 tenor；滚动对冲成本和节假日错配容易算错。
- **AI 应如何介入**：调用确定性跨币种收益引擎；列出所有现金流和 hedge roll 假设；分解 local duration、FX hedge、basis 和 funding 对总回报的贡献；给出可交易性过滤。
- **关键数据**：国债/掉期曲线、FX spot/forward、cross-currency basis、融资和保证金、税务/预提税、市场准入和资本限制。
- **成功指标**：与交易台独立模型误差、漏计成本次数、配置分析时间、事后归因完整度。

### R8. 资金面、回购与抵押品压力监控（P1/P2）

- **谁**：银行资金交易员、利率 PM、杠杆基金、风险与 treasury。
- **什么时候**：月末/季末、税期、长假前后、央行公开市场操作、国债结算高峰或市场压力期。
- **要解决什么**：发现 repo specialness、资金利率跳升、抵押品短缺、haircut/保证金变化和跨币种美元融资压力，并判断会影响哪些曲线和持仓。
- **现在怎么解决**：查看本地货币市场屏幕、经纪商颜色、央行操作和内部 treasury 表；很多真正可交易信息只存在于内部成交和聊天中。
- **AI 应如何介入**：把公开操作、市场 rates、内部融资与结算日历合并；识别异常但不把月末季节性当危机；把 funding shock 映射到杠杆、margin call 和被迫卖出风险。
- **关键数据**：repo/拆借/OIS、央行操作、抵押品和 haircut、内部融资成交、保证金、结算失败、FX swap/basis。
- **成功指标**：资金异常提前量、误报率、潜在 margin shortfall 覆盖率、人工监控时间。

---

## 3. FX 场景清单

### F1. 亚洲 FX 晨报、驱动因子与 regime 识别（P0/P1）

- **谁**：FX PM/交易员、宏观 PM、亚洲债券 PM、机构销售。
- **什么时候**：亚洲开盘前、主要市场交接时，以及美元/人民币/日元出现大幅波动时。
- **要解决什么**：回答各货币变化主要来自美元 beta、利差、风险偏好、商品、人民币联动、本地政策还是技术性流量，并识别驱动结构是否改变。
- **现在怎么解决**：终端图表、卖方晨报、交易员聊天和手工回归；解释往往是“看图讲故事”，变量发布时间和价格窗口不一致。
- **AI 应如何介入**：先给精确价格事实，再展示多因子归因及不确定性；区分短期 flow 与中期宏观 regime；把结论映射到相关本币债和美元债持仓。
- **关键数据**：spot、forward/NDF、利差、美元指数、商品、权益、宏观 surprise、资金流和事件新闻。
- **成功指标**：事实错误率、驱动稳定性、错误因果表述率、用户追问减少。

### F2. 央行/宏观事件前后的 FX playbook（P1）

- **谁**：FX spot/forward 交易员、宏观 PM、options trader。
- **什么时候**：央行会议、CPI、就业、选举、预算、评级事件或资本管制政策发布前后。
- **要解决什么**：定义不同结果下 spot、forward points、curve、vol/skew 的可能反应，以及哪些价位/时间窗口会证伪原判断。
- **现在怎么解决**：交易员手工翻历史图、问策略师、参考卖方 event preview；案例选择容易受记忆偏差影响。
- **AI 应如何介入**：用 point-in-time 数据检索相似事件；输出条件情景而非确定预测；把预期差、仓位、流动性和政策反应分开；自动生成事件后复盘。
- **关键数据**：事件日历、调查分布、历史 spot/forward/options 分钟数据、央行文本、positioning/flow proxy、内部交易日志。
- **成功指标**：playbook 覆盖率、情景校准、事件后复盘完成率、事前/事后叙事漂移。

### F3. 亚洲债券组合的动态汇率对冲（P1）

- **谁**：全球债券 PM、保险/养老金 ALM、基金 treasury、风险团队。
- **什么时候**：买入外币债、对冲到期滚动、申赎、FX 波动或 basis/forward points 变化时。
- **要解决什么**：确定按净资产、现金流、duration 或风险预算对冲多少；选择 deliverable forward、NDF、FX swap 或 option；平衡 carry、tail risk、流动性和会计要求。
- **现在怎么解决**：按月用固定 hedge ratio 批量滚动，Excel 汇总各币种现金流；PM 观点、投资者基准和 treasury 执行常彼此脱节。
- **AI 应如何介入**：读取逐笔债券现金流与基准币种；生成静态/动态/尾部三类方案；确定性计算 hedge cost、roll schedule、basis 和情景 P&L；解释会计、准入和 liquidity 约束并交由人工审批。
- **关键数据**：持仓和现金流、spot/forward/NDF/swap、basis、vol surface、基金申赎、会计/监管规则、内部限额和历史执行成本。
- **成功指标**：未解释 FX P&L、对冲成本、现金流错配、滚动失败和超限次数。

### F4. Carry、估值、动量与拥挤度的机会筛选（P1）

- **谁**：宏观/FX PM、系统化策略团队、研究员。
- **什么时候**：每日/每周组合构建、regime 切换或跨货币比较时。
- **要解决什么**：在亚洲可交易货币中寻找经波动、尾部、交易成本和资本管制调整后的 carry/RV 机会，并避免把高 carry 误当免费收益。
- **现在怎么解决**：Excel/Python 因子表、卖方 scorecard 和人工主观覆盖；数据修订、NDF convention 和不可交易时期常处理不一致。
- **AI 应如何介入**：允许用户自然语言组合因子，但用版本化研究引擎回测；显示每个信号的经济逻辑、历史失效期、成本敏感性和当前数据质量；不根据一次回测自动建议实盘。
- **关键数据**：spot/forward/NDF、利率曲线、CPI/REER、外部平衡、vol、positioning、交易成本、资本流动和可交易性标签。
- **成功指标**：数据泄漏为零、成本后稳定性、信号解释覆盖率、研究到审批周期。

### F5. FX options 波动率、偏斜与尾部保护（P1/P2）

- **谁**：options trader、宏观 PM、风险经理、结构化产品团队。
- **什么时候**：重大事件前、隐含波动率异常、组合需要尾部保护或卖出波动率时。
- **要解决什么**：理解 ATM vol、risk reversal、butterfly、term structure 与 realized vol 的关系；比较不同 strike/tenor 的保护效率和 Greeks 风险。
- **现在怎么解决**：交易台专用 vol surface、broker runs 和定价表；非期权团队很难把报价 convention 转为组合层面的直观损益。
- **AI 应如何介入**：把自然语言风险转成经批准的期权结构候选；调用定价引擎生成 Greeks、情景和 breakeven；解释 smile、barrier 和流动性风险；报价缺失时不插值出伪流动性。
- **关键数据**：可成交 vol surface、spot/forward、利率曲线、交易 convention、历史 realized vol、内部 RFQ 和交易成本。
- **成功指标**：与前台定价误差、结构解释正确率、遗漏风险条款数、单位保护成本。

### F6. 干预、资本管制与可兑换性风险监测（P0/P1）

- **谁**：EM FX PM、亚洲债券 PM、treasury、风险与合规。
- **什么时候**：汇率接近政策敏感区、外储快速变化、NDF/在岸价差扩大、监管调整或流动性骤降时。
- **要解决什么**：识别口头/实际干预概率、结算与资金汇出风险、在岸离岸分割及政策工具变化，并评估对债券回报和对冲可执行性的影响。
- **现在怎么解决**：阅读央行声明、当地新闻和 dealer color，手工跟踪外储、fixing、onshore/offshore basis；不同国家规则散落在多份通知中。
- **AI 应如何介入**：维护逐国 policy playbook 和规则变更时间线；区分已确认干预、推测干预和季节性官方流量；把政策变化映射到可交易产品、结算路径和持仓。
- **关键数据**：央行/监管公告、fixing、外储、国际收支、spot/NDF/basis、成交量、custodian/银行操作通知。
- **成功指标**：规则更新及时性、错误告警率、受影响持仓识别率、结算事件减少。

### F7. FX 执行前流动性选择与交易后 TCA（P2）

- **谁**：FX execution trader、treasury、交易主管、合规。
- **什么时候**：大额 spot/forward/NDF/roll 下单前，以及日终/月度 best-execution 复盘时。
- **要解决什么**：选择 venue、dealer、算法、时段和拆单方式；解释滑点来自市场冲击、延迟、spread、last look 还是错误 benchmark。
- **现在怎么解决**：EMS/多银行平台提供基础 TCA，团队再用 Excel 对比报价；dealer 响应质量与币种/时段关系没有充分利用。
- **AI 应如何介入**：基于历史 RFQ 和成交构建条件化 liquidity map；下单前预测可执行区间并建议人工批准的执行计划；成交后自动生成可审计 TCA 叙述，严格隔离敏感 dealer 数据。
- **关键数据**：逐笔 quote/RFQ、order、fill、timestamp、venue/dealer、benchmark、市场 tick、拒单/last-look、内部交易规则。
- **成功指标**：implementation shortfall、fill ratio、信息泄露代理、TCA 解释覆盖率、合规例外。

### F8. 企业外币错配与“FX 到信用”传导（P0/P1）

- **谁**：信用分析师、信用 PM、主权/银行研究员。
- **什么时候**：本币大幅贬值、美元融资成本上升、企业发布债务或套保披露时。
- **要解决什么**：识别收入、成本、债务、现金和 hedge 的币种错配；估算汇率变化如何影响 EBITDA、利息覆盖、契约空间和再融资能力。
- **现在怎么解决**：从财报附注手工抄外币债务和敏感性，很多公司只给净敞口或定性披露；之后在 Excel 做粗略冲击。
- **AI 应如何介入**：跨期抽取币种暴露和套保政策；区分交易、折算和经济敞口；生成透明的 FX-to-credit bridge 及缺失假设；与同业和主权情景联动。
- **关键数据**：财报附注、债务明细、衍生品披露、分地区收入/成本、FX 曲线、商品价格、信用指标和持仓。
- **成功指标**：披露抽取准确率、未说明假设数、情景复算一致性、信用预警提前量。

---

## 4. 数据可获取性：先统一判断标准

“能在终端或网页上看到”不等于“能批量下载”，更不等于“允许用于模型训练、RAG、生成派生数据或向客户再分发”。建议把每个数据集同时标记技术可得性与法律权利。

| 等级 | 可获取性判断 | 典型情况 | 对产品的含义 |
|---|---|---|---|
| A | 公开、较容易批量获取 | 官方 API、CSV、稳定下载页、开放许可数据 | 可立即做 POC；仍需保存许可条款和抓取时间 |
| B | 公开但有摩擦 | PDF/网页、注册、限流、当地语言、格式频繁变化 | 可做 POC/RAG，但需要 OCR、解析、缓存和人工质检 |
| C | 商业可得 | Bloomberg、LSEG、ICE、评级/指数/宏观商业库 | 机构版通常必需；逐项谈 API、历史深度、派生权和 AI 使用权 |
| D | 机构或客户内部可得 | 持仓、RFQ、dealer axes、OMS、风险、研究和通信 | 最具差异化；必须做租户隔离、权限继承、脱敏和用途限制 |
| E | 不稳定或不可可靠获得 | 完整 OTC order book、全部 dealer inventory、未披露套保、真实干预流量 | 不应作为产品承诺；只能用代理变量并明确不确定性 |

### 建议的数据权利字段

每个数据源至少记录：`owner`、`contract`、`permitted_users`、`raw_storage`、`RAG_allowed`、`fine_tuning_allowed`、`derived_data_allowed`、`display_allowed`、`redistribution_allowed`、`retention`、`region`、`PII/MNPI classification`。

---

## 5. 数据源清单：跨市场与商业数据

以下“可获取性”是产品规划判断，不替代供应商合同审查；商业产品的模块、地域和 AI 使用许可需要逐项确认。

| 数据源 | 主要内容 | Credit | Rates | FX | 可获取性 | 关键限制/判断 |
|---|---|---:|---:|---:|---|---|
| Bloomberg Terminal / Data License / B-PIPE / BVAL | 实时与历史行情、债券主数据、曲线、evaluated price、新券、新闻、财务与分析工具 | 高 | 高 | 高 | C | 亚洲机构覆盖广；终端席位不自动包含服务器 API、训练、缓存或再分发权 |
| LSEG Workspace / Real-Time / Tick History | 跨资产实时与历史、Refinitiv instrument master、新闻、交易与宏观 | 高 | 高 | 高 | C | 适合 Bloomberg 冗余或替代；需分别确认 tick、server、derived data 和 AI 权利 |
| ICE Data Services | 债券主数据、evaluated pricing、固定收益指数与部分实时/历史数据 | 高 | 中 | 低 | C | 适合估值和组合；evaluated price 不是可成交报价，派生/展示权需谈判 |
| S&P Global Market Intelligence / Capital IQ / iBoxx / Markit 模块 | 公司财务、债券/指数、CDS、经济与行业数据，具体取决于模块 | 高 | 高 | 中 | C | 产品线分散；不能假设一个合同覆盖全部内容 |
| Moody's CreditView / S&P RatingsDirect / Fitch Connect | 评级、评级行动、方法论、信用研究 | 高 | 低 | 低 | B/C | 评级行动标题常公开，完整报告和批量历史通常付费；训练及大段输出权高度敏感 |
| Sell-side research portals / licensed research feeds | 卖方信用研究、预测、评级/推荐、公允利差与历史观点版本 | 高 | 中 | 中 | C/D | C1 的跨机构观点比较需要合法取得历史版本；终端阅读权不等于批量摄取、跨用户展示或模型训练权 |
| Wind / iFinD | 中国宏观、在岸债券、发行人财务、公告及部分全球市场数据 | 高 | 高 | 中 | C | 中国市场很有价值；亚洲跨国覆盖和实时 OTC 深度需验证；API 与 AI 使用权另谈 |
| CEIC / Macrobond / Haver | 亚洲及全球宏观历史、季调、共识/高频指标，依供应商而异 | 中 | 高 | 高 | C | 显著减少各国数据工程；vintage、导出、服务器及再分发权限需确认 |
| Dealogic DCM / LSEG Deals / Bloomberg new issue tools / IFR | 债券发行、承销、league table、定价过程、pipeline 和市场报道 | 高 | 中 | 低 | C | 对 C2/C12 很关键；已宣布发行可商业获取，实时 book color、未公开 pipeline 和完整订单仍属于承销团/内部数据 |
| MarketAxess | 机构信用债 RFQ、交易、流动性/估值类数据及执行工作流 | 高 | 低 | 低 | C/D | 需机构客户和合同；覆盖取决于债券与地区，不能视为全市场 order book |
| Tradeweb | 国债、利率衍生品、信用和部分 FX 的电子交易/市场数据 | 中 | 高 | 中 | C/D | 最有价值的数据往往与交易接入绑定；历史和派生用途另行许可 |
| Sell-side dealer/broker 报价渠道 | Dealer axes、indicative/firm quotes、runs、broker markets；可能经 Bloomberg IB/ALLQ、LSEG Messenger、合规邮箱、CSV/FIX/API 或交易平台送达 | 高 | 高 | 中 | D/E | 数据通常属于客户可见的双边/定向信息而非公共行情；能阅读不等于允许机器抓取，必须取得渠道、dealer 与客户合规授权 |
| BondbloX / BondEvalue 等亚洲债券平台 | 亚洲债券价格发现、分级交易或估值/分析，依产品而异 | 高 | 低 | 低 | C/D | 有亚洲特色，但覆盖、可成交深度、API 和历史需逐券 POC 验证 |
| Cbonds | 全球债券主数据、到期/票息/call 等公司行动、价格/指数和发行信息 | 高 | 中 | 低 | C | 可补 C10/C12 的 instrument master 和现金事件；机构级实时准确性和地域覆盖需抽样测试 |
| FINRA TRACE | FINRA 成员上报的 TRACE-eligible 债券成交 | 高 | 低 | 低 | A/B/C | 对部分亚洲美元债有价值，但不覆盖全部 Reg S/离岸 OTC 活动；免费、延迟、历史和订阅产品粒度不同 |
| DTCC Swap Data Repository 公共披露 | 美国报告制度下部分利率/信用/FX 衍生品交易 | 中 | 中 | 中 | A/B | 原始数据量大、修订多、匿名且字段复杂；只能视作市场活动的部分窗口 |
| CME / SGX / HKEX / JPX / KRX 等交易所数据 | 上市利率、FX 期货/期权、成交与持仓 | 低 | 高 | 高 | A/B/C | EOD 常较易得，实时 tick/order book 通常收费；对 OTC 市场只是代理 |
| EBS / 360T / Currenex / FXall 等 FX 场所 | spot、forward、swap/NDF 报价、成交和执行 | 低 | 低 | 高 | C/D | 通常需交易关系；单一场所不代表全市场，客户数据隔离要求高 |
| CLS | FX 结算量、部分聚合市场数据和机构级数据产品 | 低 | 低 | 中 | A/C | 公开多为聚合统计；详细流量非开放且覆盖受 CLS eligible currencies/participants 限制 |
| EPFR / Lipper / IIF 等资金流数据 | mutual fund/ETF flow、跨境资本流和持仓代理，具体取决于产品 | 高 | 中 | 高 | C | C12 的重要底座；频率、基金覆盖、look-through、公布时滞、样本偏差和再分发权需逐项审查 |
| ETF sponsor/交易所公开文件 | shares outstanding、NAV/AUM、部分 daily holdings 与 creation/redemption 文件 | 中 | 低 | 中 | A/B/C | 大型 ETF 可低成本覆盖，但不同 sponsor 历史深度与许可不同；不能替代 mutual fund 实时申赎 |
| FactSet / Morningstar / eVestment 等 | 组合、基金、持仓、公司与市场数据，依模块而异 | 高 | 中 | 中 | C | 适合 C11/C12 的持仓、同业和资金流补充，不是亚洲 OTC 实时定价或客户 flow 的替代品 |
| PitchBook / Preqin / 9fin / KBRA DLD 等私募市场数据 | Private credit、leveraged finance、借款人、sponsor、交易条款和可比案例，依产品而异 | 高 | 低 | 低 | C | 可为 C7 提供市场背景和可比交易，但无法替代客户 data room、贷款文件、工程尽调和持续 borrower reporting |
| Reuters / Bloomberg News / Dow Jones Newswires | 可信实时新闻和机器可读新闻产品 | 高 | 高 | 高 | C | 终端阅读权与机器摄取权不同；摘要、保存、训练和对客展示需单独许可 |
| GDELT / 经许可的开放新闻源 | 全球多语言新闻和事件元数据 | 中 | 中 | 中 | A/B | 适合低成本事件发现，不适合单独作为信用事实来源；需去重、来源评级和版权控制 |

---

## 6. 数据源清单：公开的区域与国家级来源

### 6.1 全球/区域公共底座

| 数据源 | 可用内容 | 可获取性 | 适合场景 | 主要缺口 |
|---|---|---|---|---|
| ADB AsianBondsOnline | 亚洲本币债券市场规模、收益率曲线、政策与市场报告 | A/B | R1、R5、跨市场概览 | 非实时；部分序列和国家粒度有限 |
| BIS Data Portal | 政策利率、有效汇率、信贷、跨境银行、债务证券、衍生品统计 | A | C3、C6、R2、F4、F6 | 频率偏低、修订和口径需要 point-in-time 管理 |
| IMF Data / IFS / WEO / COFER | 宏观、国际收支、外储、预测与全球比较 | A/B | C3、C6、R2、F4、F6 | 部分详细数据/API 或下载方式会变化；COFER 多为聚合 |
| World Bank Data / International Debt Statistics | 宏观、外债、发展与主权指标 | A | C3、C6、F8 | 频率低，不适合实时交易 |
| OECD Data | 成员经济体宏观与领先指标 | A/B | R2、F4 | 亚洲新兴市场覆盖不完整 |
| FRED / ALFRED | 全球及美国宏观、部分 vintage 数据 | A | R1、R2、R3 | 亚洲本地序列不全面；必须检查原始来源和发布时间 |
| GLEIF LEI / OpenFIGI | 法人 LEI、部分证券标识映射 | A/B | 全部实体与证券主数据 | 覆盖、映射唯一性和速率限制；不能单独解决复杂担保关系 |
| UN / OFAC / EU / UK HMT 等制裁清单 | 制裁主体、船舶、项目与规则 | A/B | C3、F6 | 名称匹配误报高；需本地监管和商业 KYC 数据补充 |

### 6.2 主要亚洲市场官方/半官方来源

| 市场 | 代表来源 | 主要内容 | 可获取性判断 | 产品判断 |
|---|---|---|---|---|
| 中国内地 | PBOC、SAFE、NBS、MOF、ChinaMoney/CFETS、CCDC/ChinaBond、SHCH、NAFMII、SSE/SZSE | 宏观、货币政策、外汇、发行/托管、收益率、估值、公告和交易规则 | A/B/C | 宏观和公告可做 POC；完整历史、实时成交/报价、批量估值及再分发通常需机构账号或商业许可 |
| 香港 | HKMA、CMU、HKEX、Bond Connect 相关公开统计 | 货币局数据、Exchange Fund 票据/债券、发行托管、上市文件、跨境持有/成交统计 | A/B | 官方数据较友好；亚洲美元信用债的可成交报价仍需商业/内部源 |
| 新加坡 | MAS、SGX、Singapore Department of Statistics | 政策/宏观、SGS 发行与收益率、汇率、上市债券文件和公司公告 | A/B | 适合宏观、SGS 和文档；SGD corporate/OTC credit 的实时深度有限 |
| 日本 | BOJ、MOF Japan、JSDA、JPX | 政策、宏观、JGB 拍卖、资金流、交易统计、利率期货 | A/B/C | 官方时间序列丰富；精细实时现金 JGB/IRS 与机构报价仍需许可数据 |
| 韩国 | BOK ECOS、MOEF、KOFIA Bond、KRX | 宏观、政策、国债/公司债价格与统计、交易所衍生品 | A/B/C | 公共覆盖较好但韩文和批量接口有摩擦；详细实时数据可能需会员/商业许可 |
| 印度 | RBI DBIE、CCIL、SEBI、NSE/BSE、Controller General of Accounts | 宏观、政策、G-sec、money market、FX、公司债披露与财政 | A/B/C | G-sec 和宏观基础较强；公司债、NDS/场所级实时和历史批量权限需逐项确认 |
| 印度尼西亚 | Bank Indonesia、Ministry of Finance/DJPPR、OJK、IDX、PHEI | 宏观、政策、政府债发行、公司披露和债券定价/估值 | A/B/C | 官方报告可得；高质量逐券估值与成交往往依赖本地商业源或机构接入 |
| 马来西亚 | Bank Negara Malaysia、FAST、Bursa Malaysia、BPAM | 宏观、政策、政府/公司债发行、公告、估值 | A/B/C | 发行和宏观较易得；BPAM 详细估值与批量使用通常是商业关系 |
| 泰国 | Bank of Thailand、ThaiBMA、Public Debt Management Office | 宏观、政策、政府债、公司债、资金流与市场统计 | A/B/C | 部分数据公开；逐券历史、实时和专业分析常需 ThaiBMA 会员/许可 |
| 菲律宾 | BSP、Bureau of the Treasury、PDS/PDEx | 宏观、政策、国债拍卖、固定收益交易/参考数据 | A/B/C | 官方宏观和拍卖可得；完整场内外价格历史与 API 需与 PDS/供应商确认 |
| 越南 | State Bank of Vietnam、HNX、Ministry of Finance、VBMA | 政策、政府/公司债发行、交易和规则 | B/C | 数据碎片化、语言和历史/API 一致性较弱；需要本地合作方与较多质检 |
| 台湾 | CBC、FSC、TPEx、TWSE、财政主管部门 | 宏观、政策、政府/公司债、柜买交易与公司披露 | A/B/C | 官方资料较丰富但中文、本地代码与许可需要适配；OTC 实时数据非完全开放 |

结论：**公开数据足以完成政策、宏观、发行、文档理解类 POC；公开数据不足以稳定支撑实时亚洲信用定价、真实流动性、完整 FX vol surface 和最佳执行。**

---

## 7. 数据源清单：客户内部数据——真正的产品壁垒

| 内部数据 | 对应价值 | 可获取性 | 主要治理要求 |
|---|---|---|---|
| IBOR/PMS/基金会计持仓与现金流 | 事件到持仓、组合风险、FX hedge、收益归因 | D | 租户隔离、最小权限、账户/客户脱敏、as-of 快照 |
| OMS/EMS/order/fill | 交易前检查、执行复盘、TCA | D | 交易敏感数据隔离、时间同步、不可用于跨客户训练 |
| Sell-side axes、indicative quotes、dealer/broker runs | C9 的连续报价状态、库存意愿、市场广度与买卖压力 | D/E | 保留原始消息与版本；遵守渠道和 dealer 条款、counterparty 保密、client-specific visibility、保存期限和不再分发限制 |
| RFQ、quote response、order 与 fill | 验证 axe 是否可能被 hit/lift、衡量真实可成交价和 dealer 质量 | D | 精确时间同步、交易意图隔离、不可跨客户训练或反推出单一客户行为 |
| 合规 client cohort、历史 flow 与配套 hedge legs | C11 的 client hedge propensity、flow beta 和 net duration transfer | D/E | 只做最小样本以上的聚合；客户身份、交易意图和跨 desk 权限严格隔离，禁止跨客户/跨机构训练 |
| Desk inventory、DV01 与 hedge history | C10/C11 的组合 realized duration、库存风险和对冲行为验证 | D | 前台敏感数据、point-in-time 快照、职责分离，不允许模型直接执行 hedge |
| 风险和估值引擎输出 | C6/C10 所需的 DV01/KRD、CS01、VaR/Expected Shortfall、Greeks 和情景 P&L 等正式数字 | D | 模型只调用和解释，不复制或自行替换正式方法 |
| 获准使用的卖方研究、内部信用 memo、watchlist 与批准记录 | C1 的跨机构观点、内部判断和历史决策演化 | D | 文档权限继承、版本控制、研究版权、MNPI 标签、引用原作者，不得越权横向展示 |
| Private credit data room、贷款模型/文件与 borrower reporting | C7 的尽调、条款比较、投后监控和 workout/recovery | D/E | deal/team 隔离、严格保密、用途和保存期限限制；法律、工程和估值材料不得被生成结论替代 |
| 新券承销团信息、book update、内部 pipeline | C2 的速度与市场颜色，以及 C12 的未来 primary cash absorption | D/E | 可能含 wall-crossed/MNPI 信息；按 deal/team 隔离，默认不进入通用模型或跨团队索引 |
| Treasury、融资、抵押品和保证金 | R8、F3、组合流动性 | D | 高敏感、实时性、职责分离与操作审批 |
| 客户问询、CRM、销售笔记 | 需求洞察和自动答复 | D | PII、适当性、跨客户隔离、营销与研究合规 |
| 人工修正、接受/拒绝与事后结果 | 模型评估和持续学习 | D | 防止把最终 P&L 当唯一标签；保留操作者、时间和理由 |

关键判断：商业数据让产品“能工作”，客户内部数据让产品“比通用模型更有价值”。内部数据不应混入共享基础模型；更适合在客户租户内做权限感知的 RAG、特征计算和轻量适配。

---

## 8. 三类场景所需的最小数据包

| 产品包 | POC 最小数据 | 机构版必须补齐 | 没有就不能承诺的能力 |
|---|---|---|---|
| Credit | 官方财报/公告、募集说明书、公开评级行动与新闻、EOD 价格、OpenFIGI/LEI；C1 需要获准使用的研究样本，C9 可用经脱敏的历史 axes/runs 样本做 POC | 可靠 bond master、完整研究历史、evaluated/live quote、可信新闻、关系/供应链数据、内部持仓与正式风险结果，以及带版本的 dealer axes/runs、RFQ/fill；C7 另需受限 data room 和贷款材料 | 没有合法研究权限时不能承诺跨机构观点比较；没有 data room 不能承诺 Private Credit 尽调；没有报价历史与成交验证时不能承诺实时可成交价、准确 hit/lift 或全市场流动性 |
| Rates | 央行/统计局、官方曲线与拍卖、EOD 国债/FX、经济日历 | OIS/IRS/期货实时与 tick、调查分布、repo、内部风险/持仓 | 秒级事件交易、完整跨市场 RV、精确 hedge ticket、资金面预警 |
| FX | 官方 fixing/外储/国际收支、EOD spot/forward、公开政策文档 | 可成交 spot/forward/NDF、basis、vol surface、venue/RFQ、持仓现金流 | 最佳执行、精确 options 结构、真实 hedge cost、dealer/venue 排序 |

### 8.1 Credit 重点场景的数据可得性

| 场景 | POC 最小数据 | 机构版必须补齐 | 可获取性判断 |
|---|---|---|---|
| C1 Research & View Evolution | 公司披露、公开评级行动、少量获准研究样本、EOD 债券和同业数据 | 完整且带历史版本的卖方研究、内部 memo、统一预测口径和研究权限 | A/B 可做主体与 peer 骨架；真正的跨机构观点比较依赖 C/D，版权和展示权是核心约束 |
| C3 Negative News Radar | 官方公告、公开新闻、基础实体关系和 EOD 市场异动 | 机器可读实时新闻、供应链/关系数据、live market、内部持仓和 dealer/RFQ 信号 | A/B 可做事件发现；实时、低噪声且连接持仓的生产告警需要 C/D |
| C6 Portfolio Multi-Factor Risk | 脱敏样例持仓、EOD 多资产因子、基础 DV01/CS01 和历史情景 | 完整 point-in-time 持仓、正式风险引擎、可执行行情、衍生品和负债/申赎信息 | 公开数据不能替代客户风险系统；P1 生产能力主要依赖 D |
| C7 Private Credit / Asset-Backed Financing | 经授权的模拟或历史脱敏 data room、公开项目和可比市场资料 | 实际 deal data room、贷款和担保文件、sponsor model、工程/资产报告及持续 borrower reporting | C 可补市场背景，核心数据属于 D/E；没有 deal-level 权限不能承诺交易尽调和投后监控 |
| C10 Realized Duration | 统一时点的日频 bond price/total return、analytical duration、UST curve、基础信用指数 | 可执行/高质量 evaluated price、quote freshness、OAS、组合权重和真实 hedge history | B/C 可做单券研究；组合级生产需要 D。流动性差的券可能只能给低置信度或不估计 |
| C11 Client Flow | 至少需要 sell-side 自有、去标识化的历史 RFQ/trade 与合规 client cohort；公开数据没有可信替代 | 配套 hedge legs、desk inventory/DV01、sales 标签修正和实时 flow | D/E。最有壁垒也最敏感；若没有 paired hedge，只能估 cash-flow pattern，不能声称知道客户 hedge ratio |
| C12 Funding Calendar | 公开 bond maturity/coupon/call、ETF shares/AUM/holdings、已宣布 primary deals | EPFR/Lipper/Morningstar 等 fund flow、完整 bond master、deal settlement、内部获准 pipeline 和历史 reinvestment ratio | A/B 可做骨架，C 可提高 fund-flow 覆盖，D/E 才能加入未公开 pipeline；所有预测必须显示覆盖率 |

---

## 9. 数据工程与模型设计的硬要求

### 9.1 时间与版本

- 所有行情、宏观、财务、评级和文档都要同时保存 `event_time`、`publish_time`、`ingest_time` 和 `effective_time`。
- 宏观必须保留 vintage；财务和评级必须保留修订/撤回；不能用今天修订后的数据解释当时决策。
- 价格必须标明来源、bid/ask/mid/last/evaluated、时区、市场状态和 stale flag。

### 9.2 固收主数据

- 统一 ISIN、FIGI、CUSIP/SEDOL/本地代码、issuer、borrower、guarantor、ultimate parent 和 SPV。
- 保存 clean/dirty price、day-count、coupon、business-day calendar、settlement、call/put、sink、indexation、seniority、担保和适用法律。
- 在岸/离岸、deliverable/NDF、不同 share class/法人不得靠名称字符串猜测。

### 9.3 OTC 报价状态模型

- 最小标准字段应包括 `security_id`、`dealer_id`、`side`、`quote_type`、`level_type`、`level`、`size`、`currency`、`quote_time`、`received_time`、`expiry`、`source`、`raw_message_id` 和 `visibility_scope`。
- 不覆盖上一条报价，而是保存事件流与状态迁移：`NEW`、`REFRESH`、`IMPROVE`、`WORSEN`、`SIZE_UP`、`SIZE_DOWN`、`WITHDRAW`、`EXPIRE`、`LIKELY_HIT/LIFTED`。
- 不直接比较不同票息和期限债券的 dollar price；需按各自曲线和 convention 转为 yield/spread/OAS，并保留原始报价。
- 核心特征包括 dealer breadth/concentration、bid/offer persistence、axe churn、quote half-life、spread tightening/widening、跨 dealer dispersion、RFQ response 和成交验证率。
- **报价消失本身不等于成交**。只有结合重新补价方向、实际 RFQ/fill/TRACE、多个 dealer 的同步行为及该 dealer 历史习惯后，才可标记为 `LIKELY_HIT/LIFTED`，且必须显示置信度与反证。

### 9.4 Realized Duration 模型纪律

- 基础估计可写为 `bond total return = alpha - realized duration × ΔUSD rate + credit/liquidity controls + residual`；rates 必须用小数单位并与债券估值时点对齐，避免 bp/百分比和亚洲收盘/纽约收盘错配。
- 同时报告 30/60/90 日 robust regression 或 shrinkage estimate、置信区间、R²、样本数、stale/zero-return 比例和结构变化；非同步或长期无成交的券允许返回“不可可靠估计”。
- 平行 rate beta 与 2Y/5Y/10Y key-rate beta、level/slope/curvature factor 应分开；加入市场信用 spread、行业/评级和事件控制，防止把 risk-off spread widening 全算成 duration。
- 组合结果需同时用逐券 exposure 加总和 portfolio return 直接回归做一致性检查，并纳入已有 Treasury/IRS hedge、现金和动态权重；输出目标是降低下一期 hedge error，而不是最大化样本内 R²。

### 9.5 Client Flow 建模与隐私

- 每笔 flow 保存 point-in-time client cohort、side/aggressor、cash bond risk、可能 hedge instrument、时间窗和匹配置信度；不得用事后 CRM 标签回填历史而不保留 vintage。
- Paired hedge 必须允许一对多、多对一和延迟执行；看不到客户在其他 dealer 的交易时，应明确标记 partial view，不能把“未观察到 hedge”当成“未对冲”。
- 输出限制在合规批准的 cohort/segment，设置最小样本、差分隐私或抑制规则；禁止单客户预测、跨客户模型记忆和销售人员越权查询。
- 评测采用未来 rate shock 下聚合 flow、hedge ratio 和 inventory duration transfer，不使用单一交易员主观标签作为唯一真值。

### 9.6 Funding Calendar 的 point-in-time 规则

- 每个 cash event 保存 announce、effective、settlement、maturity/call 和 ingest time；primary deal 只能在当时已知的 stage/size/probability 下进入历史回测，禁止用最终发行规模回填。
- Fund flow、ETF shares、holdings 和 mutual-fund 披露按各自公布时滞进入模型；用最新可得持仓做 bucket 映射时显示 coverage 和 mapping error。
- Maturity/coupon/call 是确定性 gross cash，真正回流 Asia credit 的金额需乘以动态 reinvestment probability；primary pipeline、tender 和 fund redemption 使用概率分布而不是单点。
- 资金日历同时输出 base/upside/downside 和数据缺口，并单独列出 index rebalance、月末季末、长假与大额 settlement 等机械性日期。

### 9.7 输出可信度

- 数字结论必须来自结构化字段或确定性计算，不允许模型凭上下文“心算”。
- 文本事实必须带句子/页码级引用；来源冲突时并列展示，不静默选择。
- 把“已确认事实、模型推断、市场传闻、用户假设”用不同视觉标签区分。
- 任何交易建议都显示输入数据 freshness、流动性等级、主要反证和人工审批点。

### 9.8 权限与合规

- 检索必须继承原系统权限，不能因为模型能搜到就扩大用户权限。
- MNPI、wall-crossed、新券 book、dealer quote、客户 PII 和交易意图必须分类隔离。
- 不用一个客户的内部数据训练服务其他客户的共享模型。
- 保留问题、检索证据、工具调用、计算版本、答案和人工修改的完整审计链。

---

## 10. 推荐 MVP 排序

### 第一阶段：用公开/文档数据证明“读得准、找得快”（P0）

1. **C1 信用研究整合、横截面对标与观点演化**：最能体现多语言长文档、跨机构比较和历史观点追踪能力。
2. **C4 covenant/资本结构解析**：输出结构化、可量化、容易做金标准评测。
3. **R2 央行反应函数与 statement diff**：亚洲多央行、多语言是天然垂类壁垒。
4. **R1/F1 联合晨报**：展示跨时区、多资产、带引用的工作流，但避免先承诺“预测”。
5. **F8 企业外币错配**：把 credit 与 FX 真正连起来，区别于通用金融问答。

### 第二阶段：接入客户持仓与机构行情，证明“能进入决策流程”（P1）

1. C3 信用负面新闻、关联风险与市场异动雷达。
2. C5 信用换券与流动性筛选。
3. **C9 OTC quote/axe 盯盘一期**：先接入合规邮箱/CSV 历史 runs，建立跨 dealer 报价状态和市场强弱面板。
4. **C10 Realized Duration**：用 30/60/90 日 rates beta、置信区间和 portfolio hedge error 补充 analytical duration。
5. **C12 资金日历一期**：接入公开 maturity/coupon/call、ETF flow 和已宣布 primary settlement，形成未来 1/5/20 日净技术面。
6. R4 曲线 RV/carry-roll。
7. R6 组合风险与对冲解释。
8. F3 动态 FX hedge。
9. C6 组合多因子风险、动态相关性与压力测试。

### 第三阶段：接入交易和专有数据，建立高壁垒（P2）

1. C2 新券实时定价与订单建议包。
2. **C9 OTC quote/axe 盯盘二期**：接入实时 RFQ/fill，校准 dealer-specific 的 hit/lift 推断和可成交价格区间。
3. **C11 Client Flow Monitor**：在合规 cohort 层面连接 cash trade 与 hedge legs，估计 flow beta、hedge lag 和 inventory duration transfer。
4. **C12 资金日历二期**：加入商业 mutual-fund flow、历史 reinvestment 模型和内部获准 primary pipeline。
5. R8 资金面/抵押品压力。
6. F5 FX options surface 与结构比较。
7. F7 执行前流动性和交易后 TCA。
8. C7 Private Credit 与 Asset-Backed Financing 分析。

### 不建议一开始承诺

- 仅凭公开 EOD 数据给出亚洲美元债“实时可成交价”；
- 对所有亚洲司法辖区自动生成无需律师复核的法律结论；
- 没有内部持仓、现金流和限额却给出具体组合交易数量；
- 没有 venue/RFQ 数据却声称能做 best execution；
- 用大模型生成的主观评分直接替代正式定价、风险或信用审批模型。

---

## 11. 评测框架：产品是否真的有用

| 维度 | 建议指标 | 适用场景 |
|---|---|---|
| 事实性 | 数字准确率、引用命中率、unsupported claim rate | 全部 |
| 完整性 | 重要观点/条款/事件/风险遗漏率、实体映射覆盖率 | C1/C3/C4/C7 |
| 时效性 | 来源发布到结构化、告警或首稿的延迟 | C2/C3/C9/R1/R2/R3/F1/F2 |
| 计算正确性 | 与前台/风险/独立 benchmark 的差异，VaR/Expected Shortfall 回溯表现 | C5/C6/R4/R6/R7/F3/F5 |
| 决策价值 | 人工接受率、节省时间、后续修改量、异常发现数 | 全部 |
| 交易质量 | 滑点、fill ratio、成本后收益、对冲误差 | C2/C5/R4/F3/F7 |
| 微观结构信号 | security/dealer/side 映射准确率、stale rate、疑似 hit/lift 精度、dealer breadth 覆盖率 | C9 |
| 经验利率风险 | 30/60/90 日 beta 稳定性、置信区间覆盖、下一期 portfolio hedge error、rate shock residual | C10 |
| 客户流行为 | paired-hedge precision、cohort hedge-ratio 校准、聚合 flow 方向、inventory duration transfer 误差 | C11 |
| 资金技术面 | maturity/coupon/call 覆盖、fund-flow 时滞、primary pipeline recall、净资金预测误差 | C12 |
| 安全合规 | 权限泄露、MNPI/PII 违规、不可审计答案数 | 全部 |

最终北极星指标不应只是“回答看起来专业”，而应是：**在不增加事实、权限和模型风险的前提下，缩短从新信息到可审计决策的时间。**
