/* Inside WB. Evidence belongs to a financial line, and expands in place. */
const modelEvidenceSpecs={
 revenue:{name:'集团收入',formula:'集团收入 = Search + Network + YouTube广告 + 订阅/平台/设备 + Google Cloud + Other Bets + 汇率对冲。',note:'YouTube订阅已经包含在订阅/平台/设备中；Cloud四块只是Cloud内部拆分，不能再与Cloud总额重复相加。',rows:{Model:[16]},sources:['recent-10q-business']},
 growth:{name:'收入同比',formula:'收入同比 = 本期集团收入 ÷ 上年同季集团收入 − 1；年度同比使用完整年度收入。',note:'分部输入变化会沿同比基数传导到下一年同季；不使用独立、互不勾稽的同比覆盖。缺少上年基数时显示—。',rows:{Model:[16]}},
 search:{name:'Search / 搜索',formula:'预测收入 = 当前情景的上年同季搜索收入 ×（1 + 本季搜索同比假设）。搜索分销TAC = 搜索收入 × 分销TAC率。',note:'搜索流量、商业查询占比和单次查询变现共同影响收入。当前同比是可编辑情景，不把AI查询增长或新闻方向直接当成收入增速。业务完整毛利还含研究分摊的共享成本。',rows:{'Rev Roll-up':[26]},factor:'search',sources:['recent-10q-business','recent-citizens']},
 network:{name:'Network / 广告网络',formula:'预测收入 = 上年同季Network收入 ×（1 + 本季同比假设）；Network TAC = Network收入 × 网络TAC率。',note:'网络TAC和搜索分销TAC采用不同分母和费率。已识别TAC之外仍有共享成本分摊，不能将收入减TAC称为完整披露毛利。',rows:{'Rev Roll-up':[58]},factor:'network',sources:['recent-10q-business']},
 youtube:{name:'YouTube广告',formula:'广告收入按同比假设递推；YouTube内容成本 =（广告收入 + YouTube订阅收入）× 内容分成率 + NFL固定成本。',note:'YouTube广告与订阅分开计收入，共同内容成本按模型分配。2027Q1/Q2 NFL源单元格为空；当前0为原缓存总内容成本的隐含余额，不代表核实后没有成本。',rows:{'Rev Roll-up':[33]},factor:'youtube',sources:['recent-10q-business']},
 youtubeSubs:{name:'YouTube订阅',formula:'YouTube订阅 = 订阅/平台/设备合计 × YouTube订阅份额；编辑金额同时重算合计及内部份额。',note:'Music/Premium与其他订阅分开，但不新增第七个MS收入分部。份额是研究拆分，当前材料不提供与本季完全对应的独立披露；内容分成及NFL成本与广告一起核对。',rows:{'Other Drivers':[31],'Rev Roll-up':[99]},factor:'subs',quote:/YouTube|Music|Premium/i,sources:['recent-10q-business']},
 otherSubs:{name:'其他订阅、平台与设备',formula:'其他订阅/平台/设备 = MS订阅/平台/设备合计 − YouTube订阅。',note:'Google One、应用平台与硬件尚未各自形成独立量价模型。该项直接成本未单独识别，模型保留共享成本分摊；不能把Google One用户增长直接套到全部余额。',rows:{'Other Drivers':[31],'Rev Roll-up':[99]},factor:'subs',quote:/Google One|设备|平台|Gemini/i,sources:['recent-10q-business']},
 subs:{name:'订阅 / 平台 / 设备',formula:'订阅/平台/设备 = YouTube订阅 + 其他订阅、平台与设备；两个明细合计保持MS分部口径。',note:'拆分份额为研究假设；合并分部的源数据不等于独立披露每项收入。',rows:{'Other Drivers':[31],'Rev Roll-up':[99]},factor:'subs',sources:['recent-10q-business']},
 bets:{name:'Other Bets',formula:'预测收入 = 上年同季Other Bets收入 ×（1 + 本季同比假设）。',note:'该收入行覆盖Other Bets，不等于Waymo单一公司收入。当前成本按非Cloud共享项研究分摊，不能据此推断Waymo真实单车经济性或Other Bets披露营业利润。',rows:{'Rev Roll-up':[105]},factor:'bets',sources:['recent-10q-business']},
 cloud:{name:'Google Cloud',formula:'Cloud = Workspace + 传统GCP + AI服务 + 独立TPU交付。AI服务再按客户预算、可归属份额、验收容量与计费条件计算。',note:'默认以MS总额反推企业服务增长，客户与TPU种子参数固定；条件解不是MS披露的客户预测，也不是独立研究预测。修改假设后不会自动重新拟合。',rows:{'Non-Core Losses':[56],'Rev Roll-up':[93]},factor:'cloud',cross:[25],sources:['contracts-googl-revenue-10q-20261029'],metric:/Google Cloud remaining performance|Company remaining performance|Company RPO expected recognition/i},
 workspace:{name:'Workspace',formula:'Workspace与传统GCP共同组成企业服务；按研究比例拆分MS条件反推后的企业收入。',note:'MS Cloud总额不能唯一识别Workspace收入。Barclays旧拆分提供结构参考，日期与口径保留；编辑本季收入属于用户假设。',rows:{'Non-Core Losses':[56]},cross:[9],metric:/Workspace/i},
 traditional:{name:'传统 GCP',formula:'传统GCP是企业服务中扣除Workspace的部分，独立于客户AI服务与外售TPU。',note:'企业服务增长是固定客户/TPU参数下对齐MS总额的条件解；不能把Cloud余额自动解释为已披露传统云增长。Barclays旧容量及收入/GW仅作尺度参照。',rows:{'Non-Core Losses':[56]},cross:[9,10,15],metric:/GCP revenue excluding|Average GCP capacity|GCP quarterly revenue/i},
 ai:{name:'AI云服务',formula:'客户服务收入由客户预算与可交付容量共同约束；保底计费与额外用量分开，训练预算、推理费用率、Google份额各自可编辑。',note:'客户run-rate、融资、总算力承诺不等于Google当季收入。第三方算力与自有算力的参考成本率为研究假设，默认再乘MS反推的统一现金成本倍率。',rows:{'Non-Core Losses':[56]},cross:[0,1,2,4,5,7,8,13,17,18,20,23,24],metric:/run-rate revenue|GAAP确认收入|Compute and infrastructure|收入成本|Third-party compute|Azure revenue|AWS revenue/i},
 tpu:{name:'独立TPU交付',formula:'外售TPU收入 = 季度交付数量 × 每单位交付价格 × 当期确认比例；不与同批云服务重复计费。',note:'硬件通常在控制权转移时确认；安装、支持及延保按履约确认。GW、出货、验收和收入是不同阶段。Barclays旧25%是营业利润率，不能当毛利率。',rows:{'Non-Core Losses':[56]},cross:[6,9,10,11,12,16,19,21,22],metric:/External TPU|TPUaaS|TPU capacity|TPU repurchase|Custom silicon/i},
 hedge:{name:'汇率对冲收入',formula:'汇率对冲单独加到集团收入，不分摊成某一业务的客户收入。',note:'当前值沿源模型；实际汇率变动与套保损益并不等价。尚未建立货币敞口、合约期限和汇率到套保收入的模型。',rows:{'Rev Roll-up':[111]}},
 cogs:{name:'营业成本',formula:'营业成本由业务现金直接成本、共享成本、计入营业成本的折旧/摊销和SBC组成；集团手动覆盖差额单列。',note:'搜索/Network TAC和YouTube内容分成已识别；其他非Cloud成本仍有研究分摊。D&A和SBC已经包含在此或经营费用中，不能再扣一次。',rows:{Model:[18]},factor:'gm',cross:[11]},
 grossProfit:{name:'毛利',formula:'毛利 = 集团收入 − 营业成本。',note:'业务毛利合计连同对冲收入及集团覆盖差额与集团勾稽。非Cloud业务毛利含共享成本研究分摊，不能标为公司披露。',rows:{Model:[16,18]},factor:'gm'},
 grossMargin:{name:'毛利率',formula:'集团毛利率 = 毛利 ÷ 集团收入；业务输入的基准毛利率先按初始D&A/SBC标准化，再反推现金直接成本。',note:'当前折旧与SBC仍独立进入情景毛利率；固定毛利率不能抵消寿命变化。已编辑业务毛利率后，其直接成本率参数不再驱动该业务，恢复成本率驱动后重新生效。',rows:{Model:[16,18]},factor:'gm',cross:[3,11]},
 rd:{name:'研发费用',formula:'业务现金研发费用 + 分配至研发的D&A + 研发SBC + 研发调整 = 集团研发费用。集团研发费用率覆盖优先。',note:'Cloud现金经营费用按源模型费用结构分配；非Cloud共享费用按收入研究分摊。COGS以外的D&A计研发，Cloud未分配成本暂列研发。',rows:{'Expense Drivers':[167]},factor:'ox',quote:/研发|研究|R&D/i},
 sm:{name:'销售费用',formula:'业务现金销售费用 + 分配的销售SBC = 集团销售费用；集团销售费用率覆盖时按收入计算。',note:'费用结构来自MS基准，Cloud参考费用率与现金成本倍率为研究模型。没有客户级获客成本、销售人数和单客费用的独立观测，不能将分配结果当披露。',rows:{'Expense Drivers':[168]}},
 ga:{name:'管理费用',formula:'业务现金管理费用 + 分配的管理SBC = 集团管理费用；集团管理费用率覆盖优先。',note:'该模型沿MS基准费用结构；未为诉讼、重组或其他一次性费用建立独立季度台账。管理费用变化不可直接解释为已证实的经营效率改善。',rows:{'Expense Drivers':[169]},factor:'ox',quote:/法律|管理|诉讼/i},
 otherOpex:{name:'其他经营费用 / 残差',formula:'其他经营费用 = 经营费用合计 − 研发 − 销售 − 管理。',note:'差额是模型勾稽项，保留来源和计算边界，不强行归入任何已识别费用或当作新增业务。',rows:{Model:[16,18,54],'Expense Drivers':[167,168,169]}},
 opex:{name:'经营费用合计',formula:'经营费用合计 = 研发 + 销售 + 管理 + 其他经营费用。',note:'费用中已含SBC和部分折旧摊销。业务模型与集团费用率覆盖之间的差额单列；使用集团覆盖后可能遮蔽业务假设的传导。',rows:{Model:[16,18,54],'Expense Drivers':[167,168,169]},factor:'ox'},
 opexRatio:{name:'经营费用率',formula:'经营费用率 =（研发 + 销售 + 管理 + 其他经营费用）÷ 集团收入。',note:'费用率是汇总结果。若使用集团费用率覆盖，业务费用变化需与覆盖差额一起查看，不能把两套费用再相加。',rows:{Model:[16,18,54],'Expense Drivers':[167,168,169]},factor:'ox'},
 operatingIncome:{name:'营业利润',formula:'营业利润 = 毛利 − 经营费用。变化桥按收入规模、业务结构、现金成本、D&A、SBC、校准及手动覆盖依次替换。',note:'变化桥精确加总，但交叉影响归入后替换步骤，属于情景算术分解，不是市场或经营的因果归因。',rows:{Model:[54]},factor:'profit',quote:/营业利润|利润率|Services/i},
 operatingMargin:{name:'营业利润率',formula:'营业利润率 = 营业利润 ÷ 集团收入。',note:'收入结构、现金成本与已投产资产折旧会共同改变利润率，不能仅凭收入加速判断利润率提升。',rows:{Model:[16,54]},factor:'profit',quote:/营业利润|利润率|Services/i},
 otherIncome:{name:'非经营收益',formula:'税前利润 = 营业利润 + 非经营收益；其他收益可直接作为本季金额假设编辑。',note:'2026年大额投资收益显著影响净利；投资估值收益与主营经营表现分开。当前未建立投资组合逐项公允价值预测。',rows:{Model:[64]},sources:['recent-10q-investments']},
 pretaxIncome:{name:'税前利润',formula:'税前利润 = 营业利润 + 非经营收益。',note:'分别核对经营利润与投资等非经营项；模型没有用税后净利润反填经营利润。',rows:{Model:[54,64]},sources:['recent-10q-income']},
 tax:{name:'所得税',formula:'所得税 = 税前利润 × 有效税率；等于税前利润减GAAP净利润。',note:'单一有效税率是情景简化，未按司法辖区、递延税项及一次性税务事项独立建模。SBC调整的税效应在调整后利润桥单独处理。',rows:{Model:[84,86]},sources:['recent-10q-income']},
 taxRate:{name:'有效税率',formula:'有效税率假设直接作用于税前利润；GAAP净利润 = 税前利润 ×（1 − 有效税率）。',note:'本季可编辑值沿MS基准，不是公司税率指引；亏损期、一次性投资收益和税务事项可能使简单比率失真。',rows:{Model:[84]},sources:['recent-10q-income']},
 netIncome:{name:'净利润 · GAAP',formula:'GAAP净利润 =（营业利润 + 非经营收益）×（1 − 有效税率）。',note:'净利润尚未扣优先股股息；每股盈利分子另行计算。投资收益未从GAAP净利中剔除。',rows:{Model:[54,64,84,86]},sources:['recent-10q-income','recent-10q-investments']},
 preferredDividends:{name:'优先股股息',formula:'预测普通股盈利分子 = GAAP净利润 − 优先股股息。',note:'MS原模型未单列，预测默认0是可改情景，不是公司股息指引；历史优先使用已核对的SEC普通股摊薄分子，不能机械以净利/股数替代。',rows:{Model:[86,94]},sources:['recent-10q-income']},
 dilutedEarnings:{name:'普通股摊薄盈利分子',formula:'预测期使用净利润减优先股股息；历史期优先使用SEC直接标记的普通股摊薄盈利分子。',note:'2026Q3普通股分子26,170m，低于净利润26,468m；除以12,368m股得到2.12。年度沿季度分子桥接，未实现完整if-converted反稀释测试。',rows:{Model:[86,94]},sources:['recent-10q-income']},
 dilutedShares:{name:'稀释股数',formula:'季度EPS分母为本季稀释股数（百万股）；年度分母按各季度天数加权。',note:'股数可作为预测假设编辑。尚未独立建模回购金额、成交价格、股权激励发行及可转证券变化，不把股数下降自动称为已公布回购计划。',rows:{Model:[94]},sources:['recent-10q-income']},
 eps:{name:'EPS · GAAP模型口径',formula:'EPS = 普通股摊薄盈利分子 ÷ 稀释股数；年度EPS = 四季分子合计 ÷ 按天数加权股数。',note:'年度EPS不能将季度EPS相加。2026Q3使用SEC分子与2.12披露值，保留与MS约2.14的差异；年度桥接不冒充完整GAAP if-converted计算。',rows:{Model:[86,90,94]},sources:['recent-10q-income'],metric:/JPM Alphabet GAAP EPS/i},
 msEps:{name:'原MS年度EPS · 对照',formula:'该行保留MS年度列的原始EPS缓存，和季度汇总的模型EPS并列。',note:'两者可能因普通股分子、年度加权股数及转换假设不同而有差异。只作原值对照，不用该数字覆盖用户情景。',rows:{Model:[90]},sources:['ms']},
 sbc:{name:'SBC',formula:'集团SBC = MS基准SBC × SBC倍率；按基准费用构成与Cloud份额分配到各业务。',note:'SBC已经包含在GAAP营业成本和经营费用中。Cloud占比及内部业务分配为研究假设；调整后口径再加回，GAAP利润不得重复扣减。',rows:{Model:[44]},profitSource:true},
 sbcTaxBenefit:{name:'SBC相关税效应',formula:'SBC税效应 = SBC × SBC税效应率；税后加回 = SBC − 该税效应。',note:'SBC税效应率与集团有效税率不是同一个参数。基准沿MS调整桥，用户修改为情景，不能据此断定实际税务抵扣。',rows:{Model:[44]},profitSource:true},
 adjustedOperatingIncome:{name:'营业利润 · 调整后',formula:'调整后营业利润 = GAAP营业利润 + SBC。',note:'当前调整口径仅加回SBC；未剔除重组、诉讼等其他事项，也不作为公司公布的Non-GAAP指标。',rows:{Model:[44,54]},profitSource:true},
 adjustedNetIncome:{name:'净利润 · 调整后',formula:'调整后净利润 = GAAP净利润 + SBC − SBC税效应。',note:'投资收益等其他非经营项目仍保留，不能据此声称得到纯经营、经常性或公司正式调整后盈利。',rows:{Model:[44,86]},profitSource:true},
 adjustedEps:{name:'EPS · 调整后',formula:'调整后EPS =（调整后净利润 − 优先股股息）÷ 稀释股数；年度仍按分子合计与天数加权股数桥接。',note:'调整仅限税后SBC，不剔除其他一次性项目，非公司正式Non-GAAP EPS。',rows:{Model:[44,86,94]},profitSource:true},
 depreciation:{name:'折旧',formula:'季度折旧 = 服务器资产代理 × 资产倍率 ÷ 服务器年限 ÷ 4 + 其他资产代理 × 资产倍率 ÷ 其他年限 ÷ 4。',note:'资产原值由MS折旧与Barclays分类结构反推，非核实资产台账；不是完整新增/退役滚动模型。改变寿命后D&A按分配进入营业成本与研发，不能再次扣减。',rows:{Model:[46]},factor:'ox',quote:/折旧|基础设施|能源/i,profitSource:true},
 amortization:{name:'摊销',formula:'摊销沿MS本季基准，与分类资产寿命驱动的折旧分开，再合并为D&A备查。',note:'当前没有独立可编辑的无形资产新增与摊销年限模型。改服务器寿命只改变折旧，不自动改变摊销。',rows:{Model:[47]}},
 da:{name:'折旧与摊销合计',formula:'D&A = 折旧 + 摊销；按COGS分配比例进入营业成本，其余进入研发费用。',note:'D&A为已含在利润表内的备查值。Cloud D&A分给Workspace、传统GCP，余量分给AI；独立TPU交付不分配自有云折旧。',rows:{Model:[46,47]},profitSource:true},
 cloudOperatingIncome:{name:'Cloud营业利润',formula:'Cloud营业利润 = 四块Cloud收入 − 现金直接成本 − 现金经营费用 − D&A − SBC − 额外未分配成本。',note:'MS原Cloud营业利润由集团减其他业务形成残差。当前固定收入结构、D&A/SBC和参考费率后反推统一现金成本倍率，额外校准默认0；不能称独立盈利预测。',rows:{'Non-Core Losses':[56]},cross:[3,10,11,14],metric:/Google Cloud operating|Third-party compute/i,profitSource:true},
 cfo:{name:'经营现金流 · MS备查',formula:'该行直接保留MS经营现金流缓存；当前利润表情景没有完整的营运资本、税款与付款时点桥。',note:'本行不会随收入、利润或服务器寿命自动重算。经营现金流、融资、设备采购和现金资本开支不同，不能用这一静态备查值推导用户情景的自由现金流。',rows:{Model:[322]},factor:'profit',quote:/现金流|库存|资本成本/i,sources:['recent-10q-cash']}
};

function modelItemEvidence(key,context={}){
 const aliases={margin:'grossMargin',profit:'operatingIncome',earnings:'eps',adjusted:'adjustedEps',otherOperatingExpenses:'otherOpex',taxExpense:'tax',revenueGrowth:'growth'};
 key=aliases[key]||key;
 const spec=modelEvidenceSpecs[key];
 if(!spec)return '<p class="note">目前没有这项的单独研究材料。请先查看上方公式中的各项输入及其来源。</p>';
 const {q={},d={},b={},p={}}=context,period=q.period||'';
 const registry=new Map();
 for(const source of [...(CASE.sources||[]),...(RESEARCH.sources||[]),...(CASE.profitModel?.sources||[])])registry.set(source.id,{...registry.get(source.id),...source});
 const detail=(id,title,body,cls='')=>`<details class="model-item-evidence ${cls}" data-item-evidence="${esc(key+'-'+id)}"><summary>${esc(title)}</summary><div class="model-evidence-body">${body}</div></details>`;
 const paragraph=s=>s?'<p>'+esc(s)+'</p>':'';
 const values=entries=>'<dl class="model-evidence-values">'+entries.filter(([,v])=>v!=null&&v!=='').map(([label,v])=>'<div><dt>'+esc(label)+'</dt><dd>'+esc(v)+'</dd></div>').join('')+'</dl>';
 const loc=record=>values([['工作表',record.sheet],['单元格',text(record.cells||record.cell||'')],['区间',text(record.range||record.cellRange||'')],['页码',text(record.pages||record.page||'')]]);
 const inlineSource=(ref,id)=>{
  const raw=typeof ref==='string'?ref:ref?.id,source=registry.get(raw)||registry.get(String(raw).split(':')[0]);
  if(!source)return paragraph('来源定位：'+raw+'；此来源记录暂缺。');
  const url=source.url&&/^https?:\/\//i.test(source.url)?source.url:null;
  const positions=values([['引用定位',raw],['文件',source.file||source.filePath||source.path],['压缩包',source.archive],['包内文件',source.member],['工作表',source.sheet],['单元格',text(source.cells||source.cell||'')],['页码',text(source.pages||source.page||'')],['资料日期',source.publicationDate||source.publishedAt||source.date||source.asOf],['证据身份',source.kind]]);
  return detail('source-'+id,source.title||source.label||source.id,positions+paragraph(text(source.note||''))+(url?'<p><a href="'+esc(url)+'" target="_blank" rel="noreferrer">查看原始来源</a></p>':''),'model-evidence-source');
 };
 const sourceRefs=(refs,id)=>(refs||[]).map((ref,i)=>inlineSource(ref,id+'-'+i)).join('');
 const current=modelNumberLineage(key,q);
 let html=detail('calculation','计算方法与数据来源',paragraph(current.formula|| (current.kind==='actual'?'历史期间直接采用资料中的对应金额。':'这一项的数值依据见上方假设说明。'))+paragraph(current.explanation)+paragraph(current.clientSource)+modelAssumptionCitations(current)+values([['查看期间',period],['数据性质',q.kind==='actual'?'历史数据':'预测情景']]),'model-evidence-method');
 const sourceRow=(period.length===4?CASE.annualBaselines:CASE.quarters)?.find(x=>x.period===period);
 const selected=(sourceRow?.sourceRefs||[]).filter(ref=>{const m=String(ref).match(/^ms:([^!]+)![A-Z]+(\d+)$/);return m&&spec.rows?.[m[1]]?.includes(Number(m[2]));});
 if(selected.length)html+=detail('model-cells','MS模型底稿 · '+period,paragraph('以下是对应科目的源模型输入位置；用户情景由当前假设重算，并不改写原工作簿。')+sourceRefs(selected,'model'));
 if(spec.profitSource)html+=detail('profit-sources','经营假设与成本分配 · 来源定位',values([['MS 2026-10-29',b.sourceCells?.ms],['Barclays 2026-07-24',b.sourceCells?.barclays]])+paragraph('MS提供基准及费用构成；Barclays旧模型提供分类资产与寿命的结构参考。Cloud分配、资产代理及现金成本倍率属于研究构建，不是这些单元格逐项披露的经营事实。'));
 if(['search','network','youtube','youtubeSubs','otherSubs'].includes(key)&&b.nonCloudCostSource)html+=detail('cost-source','TAC与内容成本 · 原模型公式及缺口',paragraph(b.nonCloudCostSource)+paragraph('已识别成本之后仍有共享残余；成本率、基准毛利率覆盖及折旧/SBC应按当前模型的优先顺序计算。'));
 for(const [i,source] of (spec.sources||[]).entries())html+=inlineSource(source,'primary-'+i);
 const facts=CASE.financialVerification?.quarters?.[period]?.facts||{};
 const factKeys={eps:['reportedEps','dilutedEarnings','dilutedShares'],dilutedEarnings:['dilutedEarnings'],preferredDividends:['netIncome','dilutedEarnings'],netIncome:['netIncome'],dilutedShares:['dilutedShares'],operatingIncome:['operatingIncome'],revenue:['revenue']}[key]||[];
 for(const field of factKeys){const f=facts[field];if(f)html+=detail('filing-'+field,'已核对SEC字段 · '+f.tag,values([['原始值',nf(f.val,3)+' '+f.unit],['期间',f.start+' → '+f.end],['提交日',f.filed],['表单',f.form],['申报编号',f.accn]])+paragraph('保留原单位与申报版本；本项核验不扩大为整份模型已独立验证。')+sourceRefs(['sec-companyfacts'],'filing-'+field));}
 const factor=typeof GD!=='undefined'&&spec.factor?GD.factors?.find(f=>f.k===spec.factor):null;
 if(factor){
  const quotations=(factor.q||[]).filter(x=>!spec.quote||spec.quote.test(String(x[0])));
  quotations.forEach((entry,i)=>{html+=detail('excerpt-'+i,'原有业绩会摘录 · '+(GD.call?.date||'材料日期待核')+' · '+entry[1],paragraph(entry[0])+paragraph('证据身份：旧Demo二手摘录；时间戳仅为原记录定位，完整业绩会原文未独立复核。内容适用其原材料期间，不等于当前预测季度的数值指引。')+sourceRefs(['demo'],'excerpt-'+i));});
  const views=(GD.views||[]).filter(v=>(v.fk||[]).includes(spec.factor)&&(!spec.quote||spec.quote.test(v.t||''))).sort((a,c)=>String(c.d).localeCompare(String(a.d)));
  views.forEach((v,i)=>{html+=detail('view-'+i,v.org+' · '+v.d,paragraph(v.t)+values([['人物/类型',[v.who,v.type].filter(Boolean).join(' / ')],['原记录来源',v.src]])+paragraph('原包观点摘录；未取得每条完整原文，不能升级为已独立核验事实。机构日期不同，也不构成同一时点市场一致预期。'));});
 }
 for(const index of spec.cross||[]){
  const record=RESEARCH.crossCompanyEvidence?.[index];if(!record)continue;
  html+=detail('research-'+(record.id||index),record.company+' · '+record.relationship,evidenceMeta(record)+paragraph(record.claim)+paragraph('对本项的约束：'+record.implication)+values([['证据强度',record.strength]])+loc(record)+list(record.limitations)+sourceRefs(record.sourceRefs,'cross-'+index));
 }
 if(spec.metric)(RESEARCH.evidenceMetrics||[]).forEach((record,index)=>{
  if(!spec.metric.test(record.metric||''))return;
  const raw=valid(record.value)?nf(record.value,6):present(record.value)?text(record.value):'未取得';
  html+=detail('metric-'+(record.id||index),record.company+' · '+record.metric+' · '+(record.period||record.fiscalPeriod||record.publicationDate||''),evidenceMeta(record)+values([['原数值',raw+' '+(record.unit||'')],['性质',record.status||record.kind],['财季/期末',record.fiscalPeriod||record.periodEnd],['公式',record.formula],['缓存值',record.cachedValue],['不可等同于',record.notEquivalentTo]])+loc(record)+paragraph(record.note)+paragraph('保留该来源原日期、单位和期间；此证据不自动覆盖本季参数。')+sourceRefs(record.sourceRefs,'metric-'+index));
 });
 if(['workspace','traditional'].includes(key))html+=detail('allocation-gap','拆分依据与下一项核验',paragraph('Workspace/传统GCP的当期独立收入、客户量和净价尚未完整披露。当前保留研究比例和企业余额约束；下一步需核对同口径订阅席位、净价与传统GCP收入，不能仅从Cloud总额唯一反推出两项。'));
 return '<div class="model-evidence-list" data-model-evidence-for="'+esc(key)+'">'+html+'</div>';
}
