/* Inside WB. Number-level provenance mirrors the engine; it never recalculates the case. */
const modelLineageCloud=['workspace','traditional','ai','tpu'];
const modelLineageNonCloud=['search','network','youtube','youtubeSubs','otherSubs','bets'];
const modelLineageSegments=['search','youtube','network','cloud','subs','bets'];
const modelLineageMetricLabels={cashCost:'现金营业成本',directCost:'现金直接成本',identifiedDirect:'已识别直接成本',allocationWeight:'业务分配比例',daWeight:'折旧摊销分配比例',cashOpex:'现金经营费用',daCogs:'计入营业成本的折旧摊销',referenceGrossMargin:'初始业务毛利率',effectiveDirectRate:'实际现金直接成本率',effectiveOpexRate:'实际现金经营费用率',thirdPartyCost:'第三方算力采购成本',ownOperatingCost:'自有算力现金运营成本',cogsAdjustment:'业务自设毛利率带来的成本调整',grossMarginPoints:'毛利率变化',epsDelta:'每股收益较基准变化',impliedPE:'隐含市盈率',cloudSubs:'Cloud及订阅收入合计',msCloudOperatingIncome:'摩根士丹利Cloud营业利润预测',msCloudCostMultiplier:'对齐摩根士丹利预测所需成本倍率','depImpact.netIncome':'折旧变化对净利润的影响','depImpact.eps':'折旧变化对每股收益的影响'};
const modelLineageParameterLabels={
 cloudCashCostMultiplier:'Cloud现金成本倍率',searchTacRate:'搜索分销TAC率',networkTacRate:'Network TAC率',youtubeContentRate:'YouTube内容分成率',youtubeSubsShare:'YouTube占订阅收入份额',nflContentCost:'NFL固定内容成本',
 workspaceRevenue:'Workspace收入',traditionalRevenue:'传统GCP收入',aiRevenue:'AI云服务收入',tpuRevenue:'独立TPU交付收入',workspaceDirectRate:'Workspace直接成本率',traditionalDirectRate:'传统GCP直接成本率',tpuDirectRate:'TPU直接成本率',workspaceOpexRate:'Workspace经营费用率',traditionalOpexRate:'传统GCP经营费用率',aiOpexRate:'AI经营费用率',tpuOpexRate:'TPU经营费用率',aiThirdPartyShare:'AI第三方算力份额',aiThirdPartyCostRate:'AI第三方采购成本率',aiOwnOperatingRate:'AI自有运营成本率',serverLife:'服务器使用年限',otherLife:'其他资产使用年限',serverAssetMultiplier:'服务器资产倍率',otherAssetMultiplier:'其他资产倍率',cloudDepShare:'集团D&A分配Cloud比例',workspaceDepShare:'Cloud D&A分配Workspace比例',traditionalDepShare:'Cloud D&A分配传统GCP比例',depreciationCogsShare:'D&A计入营业成本比例',sbcMultiplier:'SBC倍率',sbcTaxBenefitRate:'SBC税效应率',cloudSbcShare:'集团SBC分配Cloud比例',cloudUnallocatedCost:'Cloud额外未分配成本',rdRatio:'研发费用率',smRatio:'销售费用率',gaRatio:'管理费用率',otherOpexRatio:'其他经营费用率',cloudTargetGrowth:'Cloud同比输入（业务覆盖前）',cloudRevenueTarget:'Cloud收入目标（业务覆盖前）',cloudDA:'Cloud D&A',cloudSbc:'Cloud SBC',nonCloudDA:'非Cloud D&A',nonCloudSbc:'非Cloud SBC',nonCloudRevenue:'非Cloud收入（含对冲）',nonCloudBusinessRevenue:'非Cloud业务收入（不含对冲）',nonCloudDirect:'非Cloud可识别直接成本',nonCloudCashResidual:'非Cloud共享现金成本',nonCloudCogs:'非Cloud营业成本',manualCogs:'集团营业成本覆盖差额',manualOpex:'集团费用覆盖差额',adjustedEarnings:'调整后普通股盈利分子',depImpact:'当前情景折旧减少量'
};
function modelLineageUnit(key){
 if(['allocationWeight','daWeight','effectiveDirectRate','effectiveOpexRate','referenceGrossMargin'].includes(key))return 'ratio';
 if(/GrossMargin$|GrowthYoY$|Ratio$|Rate$|Share$|Margin$/.test(key)||['growth','taxRate','cloudTargetGrowth'].includes(key))return 'ratio';
 if(key==='grossMarginPoints')return 'pp';
 if(/Multiplier$/.test(key)||key==='cloudCost')return 'multiple';
 if(/Life$/.test(key))return 'years';
 if(['eps','msEps','adjustedEps','epsDelta','depImpact.eps'].includes(key))return 'USD/share';
 if(key==='impliedPE')return 'multiple';
 if(key==='dilutedShares')return 'million shares';
 return 'USD mn';
}
function modelLineageFormat(value,unit){
 if(typeof value!=='number'||!Number.isFinite(value))return '—';
 const n=(v,d=3)=>(Math.abs(v)<.5*10**(-d)?0:v).toLocaleString('zh-CN',{maximumFractionDigits:d});
 if(unit==='ratio')return n(value*100)+'%';
 if(unit==='pp')return n(value)+' 个百分点';
 if(unit==='multiple')return n(value,6)+'×';
 if(unit==='years')return n(value)+' 年';
 if(unit==='million shares')return n(value)+' 百万股';
 return n(value,unit==='USD/share'?6:3)+' '+({'USD mn':'百万美元','USD/share':'美元/股',days:'天'}[unit]||unit);
}
function modelLineageClientText(value){
 return String(value??'').replace(/股权激励费用（SBC）/g,'股权激励费用').replace(/折旧与摊销（D&A）/g,'折旧与摊销').replace(/D&A/g,'折旧与摊销').replace(/SBC/g,'股权激励费用').replace(/COGS/g,'营业成本').replace(/\bMS\b/g,'摩根士丹利').replace(/\bGAAP\b(?!（会计准则口径）)/g,'GAAP（会计准则口径）').replace(/普通股盈利分子/g,'归属普通股股东的利润').replace(/非现金负担率/g,'折旧摊销及股权激励费用占收入比例').replace(/资产代理/g,'估算资产规模').replace(/未分配校准项/g,'额外成本或收益').replace(/主表手动费用覆盖/g,'自设成本费用').replace(/覆盖前Cloud收入目标/g,'单独设定业务收入前的Cloud目标').replace(/业务覆盖前/g,'业务收入单独设定前').replace(/原始\/覆盖同比输入/g,'当前同比假设').replace(/覆盖/g,'自设调整').replace(/冻结/g,'初始').replace(/快照股价/g,'参考股价');
}
function modelLineageClientMetadata(key,q,options,info){
 const period=q?.period||'',business=key.match(/^business\.([^.]+)\.([^.]+)$/),metric=business?.[2]||key,bkey=business?.[1],d=q?.profitDetail;
 const ms='摩根士丹利2026年10月29日模型',barc='巴克莱2026年7月24日模型';
 const out={clientSource:'',sourceRefs:[],explanation:''};
 const set=(source,refs=[],explanation='')=>{out.clientSource=source;out.sourceRefs=refs;out.explanation=explanation;};
 const costRefs=['ms','barc'];
 if(info.kind==='missing'){set('本期没有这一项目的可用数值。',[],q?.modelType==='annual_extension'?'2028仅提供年度预测，没有季度及业务成本明细。':'缺失数据以“—”表示，不用0代替。');return out;}
 if(info.kind==='actual'){
  const facts=CASE.financialVerification?.quarters?.[period]?.facts||{},field=key==='eps'?'reportedEps':key;
  if(facts[field])set(`Alphabet公司披露的${period}数据，已与SEC财务记录核对。`,['sec-companyfacts']);
  else if(q?.modelType==='quarter_rollup')set(`我们的历史年度计算：汇总${period}各季度数据；季度资料来自${ms}及已核对的公司披露。`,['ms','sec-companyfacts'],'金额按季度相加；比率按全年金额计算，股数按季度天数加权。');
  else set(`${period}历史数据沿用${ms}所列记录；该项目未全部单独核验为公司披露。`,['ms']);
  return out;
 }
 const userSet=/用户情景覆盖/.test(info.source||'');
 const staticMS=['hedge','cfo','amortization','msEps','msCloudOperatingIncome'].includes(key)||(!d&&['sbc','depreciation','sbcTaxBenefit','cloudOperatingIncome'].includes(key));
 if(info.kind==='assumption'){
  if(business&&metric==='identifiedDirect')set('我们的成本拆分：该业务尚未单列可识别直接成本，其成本保留在共享成本中。',[],'这里的0表示没有单列金额，不表示业务实际没有成本。');
  else if(business&&metric==='allocationWeight'&&bkey==='tpu')set('我们的折旧分配假设：独立TPU交付不分配自有云设备的折旧摊销。',[],'这一分配比例设为0；集团折旧总额不受影响。');
  else if(staticMS)set(`${period}采用${ms}的${info.label}预测。`,['ms'],key==='cfo'?'本项是卖方现金流预测；当前没有完整营运资本和收付款预测，因此不随利润情景自动改变。':key==='msEps'?'保留卖方原始年度每股收益，方便与本模型的季度汇总结果比较。':key==='amortization'?'摊销沿用卖方预测；调整服务器年限只改变折旧，不改变摊销。':'本项沿用卖方金额，不随其他经营假设自动重新计算。');
  else if(['serverLife','otherLife','depreciationCogsShare'].includes(key))set(`${period}参考${barc}的分类年限或折旧费用分配假设。`,['barc']);
  else if(['searchTacRate','networkTacRate','youtubeContentRate','youtubeSubsShare','sbcTaxBenefitRate'].includes(key))set(`我们根据${ms}中对应成本、收入或税效应测算这一比例，并用作本期假设。`,['ms'],'原始金额来自卖方模型，比率按这些金额计算；它不是公司单独披露的费率。');
  else if(key==='nflContentCost')set(`${period}的NFL内容成本参考${ms}；缺少独立费用的季度，按其总内容成本扣除其他分成估算。`,['ms']);
  else if(key==='cloudSbcShare')set(`我们的股权激励分配假设，初始比例参考${ms}中Cloud占集团收入的比重。`,['ms']);
  else if(['serverAssetMultiplier','otherAssetMultiplier'].includes(key))set(`我们的资产规模调整假设；原始规模根据${ms}的折旧与${barc}的分类结构估算。`,costRefs);
  else if(key==='sbcMultiplier')set(`我们的股权激励规模假设；1倍表示采用${ms}的本期费用预测。`,['ms']);
  else if(key==='preferredDividends')set(`我们初始将优先股股息设为0；${ms}没有单独列示这一项目。`,['ms']);
  else if(key==='cloudUnallocatedCost'||key==='cloudResidual')set('我们的额外成本假设，初始为0；只有另行识别成本或收益时才需调整。',[]);
  else if(business&&metric==='revenue'&&modelLineageCloud.includes(bkey)||/^(workspace|traditional|ai|tpu)Revenue$/.test(key))set(`采用已应用的${info.label}收入假设；原始Cloud总额来自${ms}，业务拆分由我们测算。`,['ms','barc']);
  else if(/GrowthYoY$/.test(key)||key==='cloudTargetGrowth'||options.parameter==='segmentGrowthYoY')set(`初始增长假设由${ms}的本期收入预测与上年同期收入测算。`,['ms']);
  else if(['grossMargin','opexRatio','rdRatio','smRatio','gaRatio','otherOpexRatio','otherIncome','taxRate','dilutedShares'].includes(key))set(`${period}的初始假设参考${ms}相应预测；费用及毛利比例按其金额与收入测算。`,['ms']);
  else if(/GrossMargin$/.test(key))set('采用您设定的业务毛利率，据此反推该业务现金成本；原始毛利率来自我们的业务成本测算。',costRefs);
  else if(key==='cloudCashCostMultiplier')set(`采用当前现金成本倍率假设；初始倍率由我们为对齐${ms}的Cloud营业利润测算。`,costRefs);
  else if(/DirectRate$|OpexRate$|^aiThirdParty|^aiOwnOperating|DepShare$/.test(key))set(`我们的${info.label}研究假设，现有材料没有披露这一独立业务的精确比例。`,[]);
  else set(info.source?.includes('MS')||info.source?.includes('ms:')?`${period}采用${ms}的对应预测。`:'本项为明确列示的研究分配假设，详细依据见本项说明。',info.source?.includes('MS')||info.source?.includes('ms:')?['ms']:[]);
  if(userSet){out.clientSource='当前采用用户自设情景。'+out.clientSource;out.explanation=out.explanation||'原始资料用于比较和判断，用户调整后的数值不代表卖方或公司预测。';}
  return out;
 }
 if(q?.modelType==='quarter_rollup'){
  set(`我们的年度计算：汇总${period}各季度的实际数据与当前预测；原始财务预测来自${ms}，已核验历史值来自公司披露。`,['ms','sec-companyfacts']);
  if(key==='dilutedShares')out.explanation='将每季稀释股数乘以该季度天数，四季相加后除以全年天数，得到全年平均股数；单位为百万股。';
  else if(key==='eps')out.explanation='将四季归属普通股股东的利润相加，再除以按天数加权的全年稀释股数，得到每股美元金额；不把季度EPS直接相加。';
  else if(key==='adjustedEps')out.explanation='将四季调整后归属普通股股东的利润相加，再除以按天数加权的全年稀释股数。调整后利润在归属普通股股东的利润中加回股权激励费用，并扣除相关税收影响；不把季度调整后EPS直接相加。';
  else if(['grossMargin','opexRatio','operatingMargin','taxRate'].includes(key))out.explanation=({grossMargin:'全年毛利除以全年收入，得到全年毛利率。',opexRatio:'全年经营费用合计除以全年收入，得到全年经营费用率。',operatingMargin:'全年营业利润除以全年收入，得到全年营业利润率。',taxRate:'全年所得税除以全年税前利润，得到全年有效税率。'})[key]+'不对季度比率取简单平均。';
  else if(key==='growth'||/GrowthYoY$/.test(key))out.explanation='以全年收入除以上年全年收入，再减1，表示相对于上年增长或下降的比例。';
  else out.explanation='四个季度采用相同币种和金额单位后相加；有缺失季度时不生成完整年度金额。';
  return out;
 }
 if(business){
  if(metric==='revenue')set(modelLineageCloud.includes(bkey)?`我们的业务收入测算：初始Cloud总额来自${ms}，业务结构参考巴克莱模型及我们的客户、交付分析，再按当前Cloud目标调整。`:`我们的业务收入测算：采用${ms}的收入及订阅拆分作为起点，并使用当前增长或份额假设。`,modelLineageCloud.includes(bkey)?costRefs:['ms']);
  else if(['cashCost','directCost','identifiedDirect','cashOpex','effectiveDirectRate','effectiveOpexRate','thirdPartyCost','ownOperatingCost'].includes(metric))set(modelLineageCloud.includes(bkey)?'我们的Cloud现金成本测算：将本业务收入与参考成本率、第三方份额和现金成本倍率相结合；参考费率属于研究假设。':`我们的非Cloud成本测算：TAC和内容成本参考${ms}，尚未识别的共同成本按收入分配。`,modelLineageCloud.includes(bkey)?['ms']:['ms']);
  else if(['da','daCogs','allocationWeight','daWeight'].includes(metric))set(`我们的折旧分配测算：集团折旧以${ms}为起点，资产类别及年限参考${barc}，业务份额由我们设定。`,costRefs);
  else if(metric==='sbc')set(`我们的股权激励分配测算：集团费用来自${ms}，Cloud份额与各业务收入比例决定业务分配。`,['ms']);
  else set(`我们的业务盈利测算：采用${ms}的收入、费用构成与${barc}的资产结构，并加入当前业务成本及分配假设。`,costRefs);
  const explanations={revenue:modelLineageCloud.includes(bkey)?'未单独设定业务收入时，初始业务收入按Cloud总目标的变化比例同步调整。':'本业务收入按对应增长假设计算；YouTube订阅及其他订阅再按份额拆分。',grossProfit:'收入减去营业成本得到毛利，金额单位一致。',grossMargin:'毛利除以该业务收入，表示每一美元收入中保留下来的毛利比例。',operatingMargin:'营业利润除以该业务收入，表示每一美元收入对应的营业利润。',opex:'将本业务的研发、销售、管理及其他经营费用相加。',operatingIncome:'毛利减去本业务经营费用得到营业利润；Cloud层面的额外未分配成本在Cloud合计扣除。',da:'先确定集团折旧摊销中Cloud或非Cloud的金额，再按本业务分配比例计算；分配不增加集团总成本。',daCogs:'本业务折旧摊销乘以计入营业成本的比例，其余计入研发费用。',sbc:'先按Cloud与非Cloud份额分配集团股权激励费用，再按各业务收入占比分配；总收入为0时沿用初始业务占比。',allocationWeight:modelLineageCloud.includes(bkey)?'Workspace与传统GCP采用研究份额，剩余Cloud折旧摊销分配给AI；独立TPU交付份额为0。':'本业务收入除以六项非Cloud业务收入合计；总收入为0时使用初始收入比例。',cogs:'现金营业成本，加上计入营业成本的折旧摊销和股权激励费用，得到完整业务营业成本。',cashCost:'有自设毛利率时，据此推算现金成本；否则按直接成本率或共享成本分配计算。现金成本不包含另计的折旧摊销和股权激励费用。',directCost:'Cloud业务收入乘以参考直接成本率及现金成本倍率；AI业务分别计算第三方采购和自有运营两部分。',identifiedDirect:'搜索和Network按各自TAC率计算，YouTube按内容分成率计算，NFL固定费用另计入YouTube订阅。',cashOpex:'业务收入乘以现金经营费用率和现金成本倍率，估计研发、销售与管理的现金支出。',rd:'现金研发费用，加上研发分配的股权激励费用及营业成本之外的折旧摊销。',sm:'现金销售费用，加上销售分配的股权激励费用；非Cloud业务按收入份额分配。',ga:'现金管理费用，加上管理分配的股权激励费用；非Cloud业务按收入份额分配。',otherOpex:'将非Cloud其他经营费用按本业务收入比例分配。',effectiveDirectRate:'本业务实际现金直接成本除以业务收入，反映当前成本假设共同作用后的费率。',effectiveOpexRate:'参考现金经营费用率乘以当前现金成本倍率，得到实际采用的现金费用率。',thirdPartyCost:'AI收入乘以第三方算力份额、第三方采购成本率和现金成本倍率。',ownOperatingCost:'AI收入先扣除第三方算力对应份额，剩余收入乘以自有运营成本率和现金成本倍率。',referenceGrossMargin:'以初始业务收入和初始分配成本计算，作为当前情景的比较起点。',cogsAdjustment:'采用自设业务毛利率后，营业成本与原成本驱动结果之间的差额。'};
  out.explanation=explanations[metric]||'按本业务列示的收入、现金成本和费用分配计算。';return out;
 }
 if(/^attribution\./.test(key)){set(`我们的盈利变化分解：从${ms}基准依次调整收入、成本、资产年限、股权激励和用户情景，比较每一步结果。`,costRefs,'每一步只替换一组假设，变化额等于替换后减替换前；交叉影响计入后替换的步骤。毛利率差以百分点表示，这是算术分解，不代表因果贡献。');return out;}
 const special={
  epsDelta:[`我们的情景比较：当前每股收益减去以${ms}重建的初始每股收益。`,['ms'],'结果是每股美元的绝对差额，不是增长百分比。'],
  impliedPE:[`我们的估值计算：使用${CASE.meta.priceDate}的参考股价与当前年度每股收益；股价来自EODHD行情。`,['recent-eod-googl','ms'],'股价和每股收益均以美元计，二者相除为市盈率倍数；每股收益为0或负数时不计算。'],
  cloudSubs:[`我们的收入合计：将当前Cloud与订阅收入相加，原始预测来自${ms}。`,['ms'],'这只是展示用的小计，不能再加到集团总收入中。'],
  msCloudCostMultiplier:[`我们的条件测算：以${ms}的Cloud营业利润为目标，结合当前业务收入、折旧、股权激励和成本假设求出现金成本倍率。`,costRefs,'先从收入扣除目标利润和不能按倍率变化的成本，再除以倍率为1时的可调整现金成本。已有自设毛利率对应的现金成本保持不变。'],
  cloudRevenueTarget:[`我们的Cloud收入目标测算：按${ms}提供的收入起点与当前同比假设，计算业务收入单独调整前的Cloud总额。`,['ms'],'上年同季Cloud收入乘以1加本期同比。随后应用单独业务收入时，最终Cloud合计可能与此目标不同。'],
  servers:[`我们的服务器折旧测算：资产规模由${ms}折旧与${barc}资产结构估算，使用当前年限和规模系数。`,costRefs,'估算资产规模乘以规模系数，再除以使用年限，得到年度折旧；除以4换算为季度金额。'],
  otherAssets:[`我们的其他资产折旧测算：资产规模由${ms}折旧与${barc}资产结构估算，使用当前年限和规模系数。`,costRefs,'估算资产规模乘以规模系数，再除以使用年限与4，得到季度折旧。'],
  depImpact:[`我们的折旧敏感性比较：将${ms}初始折旧与当前资产规模、年限对应的折旧相减。`,costRefs,'正值表示当前假设减少了折旧，负值表示增加。'],
  'depImpact.netIncome':[`我们的税后敏感性测算：折旧变化来自资产规模与年限假设，税率采用当前情景。`,costRefs,'折旧减少量乘以1减有效税率，得到净利润变化；存在集团费用自设调整时不直接推算。'],
  'depImpact.eps':[`我们的每股收益敏感性测算：使用折旧变化、当前税率和稀释股数；原始预测来自${ms}。`,costRefs,'税后折旧减少额除以稀释股数。利润按百万美元、股数按百万股，结果为美元/股。'],
  nonCloudDirect:[`我们的可识别成本合计：搜索TAC、Network TAC及YouTube内容成本的原始费率参考${ms}。`,['ms'],'分别按对应收入和成本率计算，再相加；NFL固定费用计入YouTube订阅。'],
  nonCloudCashResidual:[`我们的共享现金成本估计：从${ms}初始费用中扣除已识别的Cloud、TAC、内容及非现金费用，再按非Cloud收入变化调整。`,costRefs,'从当前非Cloud营业成本中剔除直接成本、折旧摊销、股权激励及业务自设调整，还原共同承担的现金成本。'],
  sharedCost:[`我们的共享成本估计：非Cloud营业成本减去按${ms}识别的TAC和内容成本。`,costRefs,'共享金额仍包含折旧摊销、股权激励及业务成本调整，不能全部视为现金支出。']
 };
 if(special[key]){set(...special[key]);return out;}
 if(['manualCost','manualCogs','manualOpex'].includes(key)){set('我们的集团自设调整比较：将主表实际采用的成本费用，与逐业务计算的成本费用作差。',costRefs,'正值表示集团自设假设使成本费用增加；差额单独列示，避免与业务成本重复计算。');return out;}
 if(['cloudDA','nonCloudDA','cloudSbc','nonCloudSbc'].includes(key)){set(`我们的费用分配计算：集团金额来自${ms}及当前规模假设，Cloud份额按研究假设分配。`,/DA$/.test(key)?costRefs:['ms'],'Cloud金额等于集团总额乘以Cloud分配比例，非Cloud金额等于集团总额减Cloud金额。');return out;}
 if(['nonCloudRevenue','nonCloudBusinessRevenue'].includes(key)){set(`我们的非Cloud收入汇总：各业务初始预测来自${ms}，使用当前增长和订阅份额。`,['ms'],key==='nonCloudRevenue'?'集团收入减Cloud收入，含汇率对冲，用于共同成本随收入变化的计算。':'六项非Cloud业务收入相加，不含汇率对冲，用于各业务的成本分配。');return out;}
 if(key==='nonCloudCogs'){set(`我们的非Cloud营业成本汇总：采用${ms}的TAC、内容和共同费用起点，加上当前折旧、股权激励及业务假设。`,costRefs,'六项非Cloud业务营业成本相加，包括已经应用的业务毛利率调整。');return out;}
 const explanations={revenue:'六个分部收入与汇率对冲相加。订阅和Cloud内部细分只在各自分部中计算一次。',growth:'本期收入除以上年同期收入，再减1，表示同比增长或下降比例。',cloud:'Workspace、传统GCP、AI服务与独立TPU交付四项收入相加；业务分类及收入确认按各项研究说明理解。',grossProfit:'收入减营业成本，得到毛利。',grossMargin:'毛利除以收入，得到毛利率。',cogs:'没有集团自设毛利率时，合计业务成本；有自设毛利率时，收入乘以1减毛利率。',rd:'合计业务研发费用，并计入Cloud额外未分配成本；存在集团自设费用率时按收入和该费用率计算。',sm:'合计各业务销售费用；存在集团自设销售费用率时，按收入乘该比率计算。',ga:'合计各业务管理费用；存在集团自设管理费用率时，按收入乘该比率计算。',otherOpex:'保留研发、销售和管理之外的经营费用，按业务分配或集团费用假设计算。',opex:'将研发、销售、管理和其他经营费用相加。',opexRatio:'经营费用合计除以收入。',operatingIncome:'毛利减经营费用，得到营业利润。',operatingMargin:'营业利润除以收入，得到营业利润率。',pretaxIncome:'营业利润加上非经营收益，得到税前利润。',tax:'税前利润乘以有效税率，得到所得税。',netIncome:'税前利润扣除按有效税率计算的所得税，得到净利润。',dilutedEarnings:'净利润减去优先股股息，得到用于计算普通股每股收益的利润。',eps:'归属普通股股东的利润除以稀释股数。利润按百万美元、股数按百万股，结果为美元/股。',adjustedOperatingIncome:'在会计准则营业利润中加回股权激励费用，得到本模型的调整后营业利润。',adjustedNetIncome:'净利润加回股权激励费用，再扣除相关税收影响。',adjustedEarnings:'归属普通股股东的利润加回股权激励费用，再扣除相关税收影响。',adjustedEps:'调整后归属普通股股东的利润除以稀释股数，得到调整后每股收益。',sbc:'卖方本期股权激励预测乘以当前规模系数。',sbcTaxBenefit:'股权激励费用乘以该费用的税效应率，与集团有效税率分别处理。',depreciation:'服务器与其他资产分别按规模和使用年限计算季度折旧，再相加；使用年限以年计，除以4换算为季度。',da:'折旧加摊销，二者已计入营业成本或经营费用，不能再从利润中扣一次。',cloudOperatingIncome:'四项Cloud业务营业利润相加，再扣除Cloud额外未分配成本。'};
 if(key==='revenue')set(`我们的集团收入汇总：各分部以${ms}预测为起点，按当前增长和业务假设计算；汇率对冲沿用卖方金额。`,['ms','barc'],explanations.revenue);
 else if(key==='cloud')set(`我们的Cloud收入合计：初始总额来自${ms}，业务结构参考巴克莱模型及我们的客户、交付测算。`,costRefs,explanations.cloud);
 else if(key==='growth')set(`我们的收入同比计算：比较当前集团收入与上年同期收入；历史收入与原始预测来自${ms}及已核对公司资料。`,['ms','sec-companyfacts'],explanations.growth);
 else if(['sbc','sbcTaxBenefit'].includes(key))set(`我们的股权激励测算：以${ms}的费用和相关税收影响为基础，使用当前规模系数及税效应率。`,['ms'],explanations[key]);
 else if(key==='depreciation'||key==='da')set(`我们的折旧摊销测算：折旧起点与摊销来自${ms}，分类资产年限参考${barc}，并使用当前资产规模和分配假设。`,costRefs,explanations[key]);
 else if(['pretaxIncome','tax','netIncome','dilutedEarnings','eps','adjustedOperatingIncome','adjustedNetIncome','adjustedEarnings','adjustedEps'].includes(key))set(`我们的利润及每股收益计算：采用当前营业利润，以及${ms}提供的非经营收益、税率、股数和股权激励起点，反映当前情景假设。`,d?costRefs:['ms'],explanations[key]);
 else if(modelLineageSegments.includes(key)&&key!=='cloud')set(`我们的分部收入测算：以${ms}的上年同季收入和初始增长预测为起点，应用当前同比假设。`,['ms'],'上年同季收入乘以1加本期同比，得到同一金额单位的本期收入。');
 else if(/GrowthYoY$/.test(key))set(`我们的增长率计算：比较当前业务收入和上年同期收入；初始财务数据来自${ms}。`,['ms'],'增长率等于本期收入除以上年同期收入再减1。');
 else if(['grossMargin','opexRatio','rdRatio','smRatio','gaRatio','otherOpexRatio'].includes(key))set(`我们的集团比率测算：将当前相应利润或费用与收入比较，初始金额及费用结构来自${ms}。`,d?costRefs:['ms'],'分项金额除以收入得到比率；若年度仅有总费用率假设，分项按原费用结构同比例调整。');
 else set(d?`我们的盈利测算：采用${ms}的收入、费用和税务预测，${barc}的资产年限参考，以及当前业务假设。`:`我们的年度预测：采用${ms}的分部增长、成本费用比例及税务、股数假设。`,d?costRefs:['ms'],explanations[key]||'使用列示的收入、成本、费用及税务假设计算，各金额采用相同单位。');
 out.explanation=explanations[key]||out.explanation;
 if(options.parameter==='profit'&&key==='cloudCashCostMultiplier')set(`我们的基准反推：以${ms}的Cloud利润为目标，按原始收入、折旧、股权激励及参考费率求出现金成本倍率。`,costRefs,'允许的现金成本等于收入减目标营业利润、折旧摊销和股权激励费用；再除以参考费率下的现金成本。');
 return out;
}
function modelNumberLineage(inputKey,inputRow,options={}){
 let key=String(inputKey||''),q=inputRow;
 const isFiniteNumber=x=>typeof x==='number'&&Number.isFinite(x),has=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k);
 const current=options.baseline?baseline:result;
 if(options.baseline&&q)q=[...(baseline.quarters||[]),...(baseline.annual||[])].find(x=>x.period===q.period)||q;
 const period=q?.period||'',annual=period.length===4,rows=annual?current.annual:current.quarters;
 const original=(annual?CASE.annualBaselines:CASE.quarters)?.find(x=>String(x.period)===period)||{};
 const priorPeriod=String(Number(period.slice(0,4))-1)+period.slice(4),prior=rows?.find(x=>x.period===priorPeriod);
 const originalPrior=(annual?CASE.annualBaselines:CASE.quarters)?.find(x=>String(x.period)===priorPeriod);
 const changes=options.baseline?{}:(overrides[period]||{}),b=CASE.profitModel?.quarters?.[period],d=q?.profitDetail,p=d?.parameters||{},bp=b?.parameters||{};
 const names=typeof modelItemNames==='undefined'?{}:modelItemNames;
 const name=k=>{
  const value=String(k||''),businessName=value.match(/^business\.([^.]+)\.([^.]+)$/);
  if(businessName)return name(businessName[1])+' · '+name(businessName[2]);
  const growthName=value.match(/^(search|network|youtube|cloud|subs|bets)GrowthYoY$/);
  if(growthName)return name(growthName[1])+'收入同比';
  return modelLineageClientText(names[value]||modelLineageParameterLabels[value]||modelLineageMetricLabels[value]||(value.endsWith('GrossMargin')?name(value.slice(0,-11))+'标准化基准毛利率':'未提供名称的项目'));
 };
 const sourceCells=k=>{
  const spec=typeof modelEvidenceSpecs==='undefined'?null:modelEvidenceSpecs[k];
  return (original.sourceRefs||[]).filter(ref=>{const m=String(ref).match(/^ms:([^!]+)![A-Z]+(\d+)$/);return m&&spec?.rows?.[m[1]]?.includes(Number(m[2]));}).join('；');
 };
 const msCol=String((original.sourceRefs||[]).find(x=>/^ms:Model![A-Z]+16$/.test(x))||'').match(/!([A-Z]+)16$/)?.[1];
 const barcCol=b?.sourceCells?.barclays?.match(/New Driver!([A-Z]+)102/)?.[1];
 const origin=k=>k==='cloudOperatingIncome'&&msCol?`MS 2026-10-29 Non-Core Losses!${msCol}90`:k==='sbcTaxBenefit'&&msCol?`MS 2026-10-29 Model!${msCol}80`:sourceCells(k)||`${period}源模型快照中的${name(k)}字段`;
 const modelSource=path=>`${period}模型计算：${path}`;
 const basePrefix=options.baseline?'初始基准（不含用户覆盖）。':'';
 const val=(k,row=q)=>{
  if(!row)return null;
  if(k==='growth'){const list=row.period.length===4?current.annual:current.quarters,prev=list?.find(x=>x.period===String(Number(row.period.slice(0,4))-1)+row.period.slice(4));return prev?.revenue?row.revenue/prev.revenue-1:null;}
  if(k==='otherOpex')return ['opex','rd','sm','ga'].every(x=>isFiniteNumber(row[x]))?row.opex-row.rd-row.sm-row.ga:null;
  if(k==='tax')return isFiniteNumber(row.pretaxIncome)&&isFiniteNumber(row.netIncome)?row.pretaxIncome-row.netIncome:null;
  if(k==='grossMargin')return row.revenue?row.grossProfit/row.revenue:null;
  if(k==='opexRatio')return row.revenue?row.opex/row.revenue:null;
  if(['rdRatio','smRatio','gaRatio','otherOpexRatio'].includes(k)){const field=k.replace('Ratio',''),amount=field==='otherOpex'?(['opex','rd','sm','ga'].every(x=>isFiniteNumber(row[x]))?row.opex-row.rd-row.sm-row.ga:null):row[field];return isFiniteNumber(amount)&&row.revenue?amount/row.revenue:null;}
  if(k==='operatingMargin')return row.revenue?row.operatingIncome/row.revenue:null;
  if(k==='da')return isFiniteNumber(row.depreciation)&&isFiniteNumber(row.amortization)?row.depreciation+row.amortization:null;
  if(k==='msEps')return row.period.length===4?CASE.annualBaselines?.find(x=>String(x.period)===row.period)?.eps:null;
  return has(row.segments,k)?row.segments[k]:row[k];
 };
 const dep=(k,value=val(k),extra={})=>{const u=extra.unit||modelLineageUnit(k),entry={key:k,label:name(k),value,period,unit:u,formattedValue:modelLineageFormat(value,u),...extra};entry.label=modelLineageClientText(entry.label);return entry;};
 const raw=(label,value,unit='USD mn')=>{
  let clientSource='',sourceRefs=[];
  if(label==='快照股价'){clientSource=`EODHD ${CASE.meta.priceDate}参考股价，单位美元/股。`;sourceRefs=['recent-eod-googl'];}
  else if(label==='全年天数'){clientSource=period+'各季度自然日天数之和，用于计算全年平均股数。';}
  else if(/分类资产代理/.test(label)){clientSource='我们的资产规模估计，采用摩根士丹利折旧预测及巴克莱分类结构、使用年限测算。';sourceRefs=['ms','barc'];}
  else if(/初始非现金负担率/.test(label)){clientSource='我们的初始业务成本分配：计入营业成本的折旧摊销与股权激励费用，除以初始业务收入。';sourceRefs=['ms','barc'];}
  else if(/基准SBC|基准费用分配|初始分项费用率|初始总费用率/.test(label)){clientSource='按摩根士丹利2026年10月29日模型的相应费用金额与费用合计或收入测算。';sourceRefs=['ms'];}
  else if(/允许现金成本/.test(label)){clientSource='我们的测算：摩根士丹利Cloud收入减去其营业利润目标，再扣除初始Cloud折旧摊销和股权激励。';sourceRefs=['ms','barc'];}
  else if(/参考费率现金成本|倍率1时/.test(label)){clientSource='我们的测算：当前业务收入乘以参考现金成本及费用率，按成本倍率为1计算。';sourceRefs=['ms'];}
  else if(/Cloud业务收入权重/.test(label)){clientSource='我们的分配计算：本业务收入占四项Cloud收入合计的比例；合计为0时采用初始比例。';sourceRefs=['ms','barc'];}
  else if(/MS目标|初始Cloud总收入|恢复初始资产|MS基准/.test(label)){clientSource='摩根士丹利2026年10月29日模型的本期原始预测。';sourceRefs=['ms'];}
  else if(/^初始非Cloud|^初始业务收入/.test(label)){clientSource='摩根士丹利初始分部收入及我们的YouTube订阅拆分；用于收入为0时保留原有费用分配比例。';sourceRefs=['ms'];}
  else if(/^初始/.test(label)){clientSource='我们的初始业务拆分，依据摩根士丹利Cloud总额、巴克莱结构参考及客户和交付假设测算。';sourceRefs=['ms','barc'];}
  else if(/本步骤替换后|上一步结果/.test(label)){clientSource='我们的逐步情景测算：从初始基准依次改变指定假设后得到的利润或毛利率。';sourceRefs=['ms','barc'];}
  else if(/已覆盖毛利率|业务毛利率覆盖差额/.test(label)){clientSource='我们的成本测算：根据用户设定的业务毛利率推算现金成本，并与原成本假设比较。';sourceRefs=['ms','barc'];}
  else if(/非Cloud|业务模型|原成本驱动/.test(label)){clientSource='我们的业务成本计算：使用摩根士丹利费用、当前收入和成本假设，以及折旧与股权激励分配。';sourceRefs=['ms','barc'];}
  else {clientSource='本次测算采用的'+modelLineageClientText(label)+'，由本项列示的经营假设计算。';}
  return dep('',value,{label,unit,navigable:false,clientSource,sourceRefs});
 };
 const profitDep=k=>{const kind=!has(changes.profit,k)&&(k.endsWith('Revenue')||k.endsWith('GrossMargin')||k==='cloudCashCostMultiplier')?'calculation':'assumption';return dep(k,p[k],{label:name(k),kind,parameter:'profit',parameterKey:k,scale:modelLineageUnit(k)==='ratio'?100:1,editable:kind==='assumption'&&q?.kind==='estimate'&&!options.baseline});};
 const driverDep=k=>{const direct=['otherIncome','taxRate','dilutedShares','preferredDividends'].includes(k),kind=q?.kind==='actual'?'actual':q?.modelType==='quarter_rollup'?'calculation':has(changes,k)||direct?'assumption':d||has(changes,'opexRatio')&&['rdRatio','smRatio','gaRatio','otherOpexRatio'].includes(k)?'calculation':'assumption';return dep(k,q?.drivers?.[k]??val(k),{kind,parameter:'driver',parameterKey:k,scale:modelLineageUnit(k)==='ratio'?100:1,editable:kind==='assumption'&&k!=='otherOpexRatio'&&q?.kind==='estimate'&&!options.baseline});};
 const businessDep=(business,metric,value)=>dep(`business.${business}.${metric}`,value??d?.businessParts?.[business]?.[metric],{label:name(business)+' · '+name(metric),unit:modelLineageUnit(metric)});
 const finish=(kind,value,formula='',dependencies=[],source='',note='',extra={})=>{
  const unit=extra.unit||modelLineageUnit(key),finite=isFiniteNumber(value);
  const result={kind:finite?kind:'missing',label:name(key),formula:finite?modelLineageClientText(formula):'',substitution:finite&&formula?dependencies.map(x=>`${modelLineageClientText(x.label)} = ${x.formattedValue??modelLineageFormat(x.value,x.unit)}`).join('；')+` → ${modelLineageFormat(value,unit)}`:'',source:basePrefix+(source||origin(key)),evidenceKey:extra.evidenceKey||key,dependencies:finite?dependencies:[],note:finite?note:(note||'本期没有该字段的有效数据；不补造为0。'),value:finite?value:null,unit,formattedValue:modelLineageFormat(value,unit),editable:false,...extra};
  result.label=modelLineageClientText(result.label);
  if(!finite){result.kind='missing';result.editable=false;}
  // A calculated value is always read-only; clients edit its assumption dependencies.
  if(result.kind!=='assumption'||options.baseline||q?.kind!=='estimate')result.editable=false;
  Object.assign(result,modelLineageClientMetadata(key,q,options,result));
  if(options.baseline)result.clientSource='初始基准。'+result.clientSource;
  return result;
 };
 const calc=(value,formula,deps,source,note,extra)=>finish('calculation',value,formula,deps,source||modelSource('scripts/model.mjs'),note,extra);
 const assumption=(value,source,note,extra)=>finish('assumption',value,'',[],source,note,extra);
 const missing=note=>finish('missing',null,'',[],'本期模型未提供',note);
 if(!q)return missing('未找到当前期间。');
 if(key==='epsDelta'){
  const baseRow=(annual?baseline.annual:baseline.quarters).find(x=>x.period===period);
  return calc(isFiniteNumber(q.eps)&&isFiniteNumber(baseRow?.eps)?q.eps-baseRow.eps:null,'EPS变化 = 当前情景EPS − 初始季度重建基准EPS',[dep('eps'),dep('eps',baseRow?.eps,{label:'初始基准EPS',baseline:true})],modelSource('情景与冻结基准比较'),'单位为USD/股的绝对差额，不是增长百分比。',{label:'EPS相对基准变化',evidenceKey:'eps'});
 }
 if(key==='impliedPE')return calc(q.eps>0?CASE.meta.price/q.eps:null,'隐含PE = 快照股价 ÷ 当前预测EPS',[raw('快照股价',CASE.meta.price,'USD/share'),dep('eps')],`参考价：CASE.meta.price，日期${CASE.meta.priceDate}；EPS由当前模型计算。`,'股价为固定快照；负值或零EPS不输出PE。',{label:'隐含PE',evidenceKey:'eps'});
 if(key==='cloudSubs')return calc(isFiniteNumber(q.segments?.cloud)&&isFiniteNumber(q.segments?.subs)?q.segments.cloud+q.segments.subs:null,'Cloud+订阅 = Cloud收入 + 订阅/平台/设备收入',[dep('cloud'),dep('subs')],modelSource('旧口径展示合计'),'展示旧口径合并，不新增集团收入。',{label:'Cloud + 订阅',evidenceKey:'revenue'});
 if(options.business)key=`business.${options.business}.${options.metric||'revenue'}`;
 const growthMatch=key.match(/^(search|youtube|network|cloud|subs|bets)GrowthYoY$/);
 if(growthMatch||options.parameter==='segmentGrowthYoY'){
  const segment=growthMatch?growthMatch[1]:key,label=name(segment)+'收入同比',v=q.drivers?.segmentGrowthYoY?.[segment]??(prior?.segments?.[segment]>0?q.segments?.[segment]/prior.segments[segment]-1:null);
  const extra={label,unit:'ratio',parameter:'segmentGrowthYoY',parameterKey:segment,scale:100,editable:q.kind==='estimate'&&!options.baseline,evidenceKey:segment};
  if(q.kind==='actual')return finish('actual',v,'本期分部收入 ÷ 上年同期分部收入 − 1',[dep(segment,q.segments?.[segment]),dep(segment,prior?.segments?.[segment],{period:priorPeriod,label:'上年同期'+name(segment)})],origin(segment),'历史收入同比；原始报告/源模型口径。',{...extra,editable:false});
  if(q.modelType==='quarter_rollup'||(segment==='cloud'&&d))return calc(v,'本期分部收入 ÷ 上年同期分部收入 − 1',[dep(segment,q.segments?.[segment]),dep(segment,prior?.segments?.[segment],{period:priorPeriod,label:'上年同期'+name(segment)})],modelSource('分部收入同比'),segment==='cloud'&&d?'Cloud业务收入覆盖后，本数字为四块业务合计的实际同比；用于同比递推的原输入另见“Cloud收入目标（业务覆盖前）”。':'年度同比由全年收入计算。',extra);
  return assumption(v,has(changes.segmentGrowthYoY,segment)?`用户情景覆盖：overrides[${period}].segmentGrowthYoY.${segment}`:`由${origin(segment)}与${priorPeriod}原始分部收入相除减1得到初始同比，再冻结为本期输入。`,'修改该同比假设后，以当前情景的上年同期收入重算本期收入金额。',extra);
 }
 if(options.parameter==='profit'){
  if(!d||!b)return missing('本期没有逐业务利润参数；2028仅有年度延展。');
  const extra={parameter:'profit',parameterKey:key,scale:modelLineageUnit(key)==='ratio'?100:1,editable:!options.baseline&&q.kind==='estimate',evidenceKey:'depreciation'};
  if(key.endsWith('Revenue')&&modelLineageCloud.includes(key.slice(0,-7))){const x=modelNumberLineage(`business.${key.slice(0,-7)}.revenue`,q,options.baseline?{baseline:true}:{});return {...x,...extra,editable:x.kind==='assumption'&&extra.editable,evidenceKey:key.slice(0,-7)};}
  if(key.endsWith('GrossMargin')){
   const business=key.slice(0,-11),part=d.businessParts?.[business],ref=baseline.quarters?.find(x=>x.period===period)?.profitDetail?.businessParts?.[business];
   if(!part||!ref)return missing('该业务没有可用毛利率输入。');
   if(has(changes.profit,key))return assumption(p[key],`用户情景覆盖：overrides[${period}].profit.${key}`,'该标准化毛利率反推现金成本；基准D&A/SBC负担固定，当前D&A/SBC仍独立传导。',{...extra,evidenceKey:business});
   const refNonCash=ref.revenue>0?(ref.daCogs+ref.sbc*b.sbcAllocation.cogs)/ref.revenue:0;
   const v=part.revenue?1-(part.cogs-part.daCogs-part.sbc*b.sbcAllocation.cogs)/part.revenue-refNonCash:ref.grossMargin;
   return calc(v,'标准化基准毛利率 = 1 − 当前现金成本 ÷ 当前业务收入 − 初始非现金成本 ÷ 初始业务收入',[dep(`business.${business}.cashCost`,part.cogs-part.daCogs-part.sbc*b.sbcAllocation.cogs,{label:'当前现金成本'}),businessDep(business,'revenue'),raw('初始非现金负担率',refNonCash,'ratio')],modelSource('业务成本反推，尚未手动覆盖'), '当前值由成本假设计算；请修改对应成本率或费用分配输入。它不等同当前情景的最终业务毛利率。',{...extra,evidenceKey:business});
  }
  const evidence=key.startsWith('search')?'search':key.startsWith('network')?'network':/youtube|nfl/i.test(key)?'youtubeSubs':key.startsWith('sbc')||key==='cloudSbcShare'?'sbc':/Life|Asset|Dep|depreciation/.test(key)?'depreciation':key==='cloudCashCostMultiplier'||key==='cloudUnallocatedCost'?'cloudOperatingIncome':modelLineageCloud.find(x=>key.startsWith(x))||'cloud';
  extra.evidenceKey=evidence;
  if(has(changes.profit,key))return assumption(p[key],`用户情景覆盖：overrides[${period}].profit.${key}`,'本值为当前已应用的情景输入；导入情景或应用反推结果也存放在此，不宣称是公司指引。',extra);
  if(key==='cloudCashCostMultiplier')return calc(p[key],'初始现金成本倍率 =（基准Cloud收入 − MS目标Cloud营业利润 − 基准Cloud D&A − 基准Cloud SBC）÷ 参考费率下Cloud现金成本',[raw('允许现金成本',b.msImplied?.allowedCashCost),raw('参考费率现金成本',b.msImplied?.cashCostAtSeed)],`初始MS条件反推：MS ${b.sourceCells.ms}；参数构建 scripts/build_profit_inputs.py。`,'固定初始收入拆分、D&A、SBC与参考费率后反推；修改其他输入不会重新求解本倍率。',extra);
  const precise={serverLife:`Barclays 2026-07-24 Q PP&E!${barcCol}113`,otherLife:`Barclays 2026-07-24 Q PP&E!${barcCol}117`,depreciationCogsShare:`Barclays 2026-07-24 IS!${barcCol}272`,sbcTaxBenefitRate:`MS 2026-10-29 Model!${msCol}80 ÷ Model!${msCol}44；初始比例冻结为输入`,cloudSbcShare:`${origin('cloud')} ÷ ${origin('revenue')}；基准Cloud收入占集团比例冻结为SBC研究分配`,searchTacRate:`MS Expense Drivers!${msCol}25 ÷ Search收入；${b.nonCloudCostSource}`,networkTacRate:`MS Expense Drivers!${msCol}45 ÷ Network收入；${b.nonCloudCostSource}`,youtubeSubsShare:`MS YouTube订阅收入 ÷ MS订阅/平台/设备总额；${b.nonCloudCostSource}`,youtubeContentRate:`MS（YouTube总内容成本 − NFL成本）÷（广告收入 + YouTube订阅收入）；${b.nonCloudCostSource}`,nflContentCost:b.nonCloudCostSource};
  const research={workspaceDirectRate:'15%',traditionalDirectRate:'25%',tpuDirectRate:'70%',workspaceOpexRate:'30%',traditionalOpexRate:'20%',aiOpexRate:'12%',tpuOpexRate:'5%',aiThirdPartyShare:'25%',aiThirdPartyCostRate:'75%',aiOwnOperatingRate:'25%',cloudDepShare:'40%',workspaceDepShare:'5%',traditionalDepShare:'25%',serverAssetMultiplier:'1×',otherAssetMultiplier:'1×',sbcMultiplier:'1×',cloudUnallocatedCost:'0'};
  return assumption(p[key],precise[key]||`研究模型初始参数：scripts/build_profit_inputs.py 的 ${key} = ${research[key]??String(bp[key])}；非公司独立披露。`,key==='nflContentCost'?b.nonCloudCostSource:precise[key]?'来源材料的初始比例/年限作为当前预测输入；材料日期与预测期间不同。':'用于情景测算的参考假设，随当前模型输入冻结，可由客户修改。',extra);
 }
 if(options.parameter==='driver'||['rdRatio','smRatio','gaRatio','otherOpexRatio'].includes(key)){
  const extra={parameter:'driver',parameterKey:key,scale:modelLineageUnit(key)==='ratio'?100:1,editable:q.kind==='estimate'&&!options.baseline&&key!=='otherOpexRatio',evidenceKey:key.replace('Ratio','')};
  if(['otherIncome','taxRate','dilutedShares','preferredDividends'].includes(key)){const x=modelNumberLineage(key,q,{baseline:options.baseline});return {...x,...extra,editable:x.kind==='assumption'&&extra.editable};}
  const v=q.drivers?.[key]??val(key),amount={grossMargin:'grossProfit',opexRatio:'opex',rdRatio:'rd',smRatio:'sm',gaRatio:'ga',otherOpexRatio:'otherOpex'}[key];
  if(q.kind==='actual')return finish('actual',v,'本期金额 ÷ 本期收入',[dep(amount),dep('revenue')],origin(amount),'历史期间只读。',{...extra,editable:false});
  if(has(changes,key))return assumption(v,`用户情景覆盖：overrides[${period}].${key}`,'该费用率或毛利率覆盖优先于业务明细；覆盖差额在归因中单列。',extra);
  if(q.modelType==='quarter_rollup'||d)return calc(v,`${name(key)} = ${name(amount)} ÷ 集团收入`,[dep(amount),dep('revenue')],modelSource('当前业务明细汇总后的有效比例'),'当前值是业务或季度汇总的计算结果，请修改其依赖中的假设。',extra);
  if(has(changes,'opexRatio')&&['rdRatio','smRatio','gaRatio','otherOpexRatio'].includes(key))return calc(v,'分项费用率 = 初始分项费用率 × 总费用率覆盖 ÷ 初始总费用率',[raw('初始分项费用率',amount==='otherOpex'?(original.opex-original.rd-original.sm-original.ga)/original.revenue:original[amount]/original.revenue,'ratio'),driverDep('opexRatio'),raw('初始总费用率',original.opex/original.revenue,'ratio')],modelSource('calculateExpenses'),'',extra);
  return assumption(v,`${origin(amount)} ÷ ${origin('revenue')}；原模型比例冻结为预测输入。`,'年度延展仅按原始比例和当前收入计算，不存在2028季度业务明细。',extra);
 }
 const businessMatch=key.match(/^business\.([^.]+)\.([^.]+)$/);
 if(businessMatch){
  const business=businessMatch[1],metric=businessMatch[2],part=d?.businessParts?.[business],cloud=modelLineageCloud.includes(business),extra={label:name(business)+' · '+name(metric),unit:modelLineageUnit(metric),evidenceKey:business};
  if(!part)return missing('本期没有该业务的独立利润明细；不以集团比例伪造历史拆分。');
  const nonCloudTotal=modelLineageNonCloud.reduce((s,k)=>s+d.businessParts[k].revenue,0);
  const baseBusinessRevenue=k=>k==='youtubeSubs'?b.segments.subs*bp.youtubeSubsShare:k==='otherSubs'?b.segments.subs*(1-bp.youtubeSubsShare):b.segments[k];
  const nonCloudWeight=cloud?null:nonCloudTotal>0?part.revenue/nonCloudTotal:baseBusinessRevenue(business)/modelLineageNonCloud.reduce((s,k)=>s+baseBusinessRevenue(k),0);
  const daWeight=cloud?(business==='workspace'?p.workspaceDepShare:business==='traditional'?p.traditionalDepShare:business==='ai'?Math.max(0,1-p.workspaceDepShare-p.traditionalDepShare):0):nonCloudWeight;
  const metricVal=metric==='opex'?part.rd+part.sm+part.ga+(part.otherOpex||0):part[metric];
  const mdep=m=>businessDep(business,m,m==='opex'?part.rd+part.sm+part.ga+(part.otherOpex||0):part[m]);
  const note=cloud?'Cloud内部拆分及非现金分配是研究模型。':'非Cloud未识别的共享成本按业务收入分配，非公司披露的独立业务利润。';
  if(metric==='revenue'){
   if(cloud){
    if(has(changes.profit,business+'Revenue'))return assumption(metricVal,`用户情景覆盖：overrides[${period}].profit.${business}Revenue`,'手动金额或下层Cloud情景应用后的金额覆盖；此值不再随总额同比同比例缩放。',{...extra,editable:!options.baseline,parameter:'profit',parameterKey:business+'Revenue',scale:1});
    const targetGrowth=changes.segmentGrowthYoY?.cloud??(originalPrior?.segments?.cloud>0?original.segments.cloud/originalPrior.segments.cloud-1:null),target=prior&&isFiniteNumber(targetGrowth)?prior.segments.cloud*(1+targetGrowth):original.segments.cloud;
    return calc(metricVal,'业务收入 = 初始业务收入 × 覆盖前Cloud收入目标 ÷ 初始Cloud总收入',[raw('初始'+name(business)+'收入',bp[business+'Revenue']),dep('cloudRevenueTarget',target),raw('初始Cloud总收入',b.cloudRevenue)],`${period}利润模型收入缩放；初始${business}Revenue见profit-inputs.json。${business==='workspace'||business==='traditional'?`Workspace/传统GCP按Barclays ${b.sourceCells.barclays}结构拆分MS条件反推企业收入。`:'AI/TPU初始收入来自cloud-inputs.json的冻结客户/交付情景。'}`,'未手动覆盖时随Cloud同比目标同比例缩放；下层研究情景不会自动改写此值。',extra);
   }
   if(['youtubeSubs','otherSubs'].includes(business))return calc(metricVal,business==='youtubeSubs'?'YouTube订阅收入 = 订阅/平台/设备总收入 × YouTube订阅份额':'其他订阅收入 = 订阅/平台/设备总收入 ×（1 − YouTube订阅份额）',[dep('subs'),profitDep('youtubeSubsShare')],modelSource('nonCloudDirect'),note,extra);
   return {...modelNumberLineage(business,q,{baseline:options.baseline}),...extra};
  }
  if(metric==='grossProfit')return calc(metricVal,'业务毛利 = 业务收入 − 业务营业成本',[mdep('revenue'),mdep('cogs')],modelSource('calculateProfitQuarter'),note,extra);
  if(metric==='grossMargin'||metric==='operatingMargin')return calc(metricVal,`${name(metric)} = ${metric==='grossMargin'?'业务毛利':'业务营业利润'} ÷ 业务收入`,[mdep(metric==='grossMargin'?'grossProfit':'operatingIncome'),mdep('revenue')],modelSource('calculateProfitQuarter'),note,extra);
  if(metric==='opex')return calc(metricVal,'业务经营费用 = 研发 + 销售 + 管理 + 其他经营费用',['rd','sm','ga','otherOpex'].filter(x=>isFiniteNumber(part[x])).map(mdep),modelSource('calculateProfitQuarter'),note,extra);
  if(metric==='operatingIncome')return calc(metricVal,'业务营业利润 = 毛利 − 经营费用',[mdep('grossProfit'),mdep('opex')],modelSource('calculateProfitQuarter'),cloud?'不含Cloud层额外未分配成本；该项在Cloud合计单独扣除。':note,extra);
  if(metric==='da')return calc(metricVal,cloud?'业务D&A = 集团D&A × Cloud D&A份额 × 业务D&A分配权重':'业务D&A = 集团D&A ×（1 − Cloud D&A份额）× 非Cloud业务收入权重',[dep('da'),profitDep('cloudDepShare'),dep(`business.${business}.allocationWeight`,daWeight,{label:cloud?'业务D&A分配权重':'非Cloud业务收入权重',unit:'ratio'})],modelSource('calculateProfitQuarter'),note,extra);
  if(metric==='sbc'){
   const weight=cloud?(q.segments.cloud>0?part.revenue/q.segments.cloud:bp[business+'Revenue']/b.cloudRevenue):nonCloudWeight;
   return calc(metricVal,cloud?'业务SBC = 集团SBC × Cloud SBC份额 × Cloud业务收入权重':'业务SBC = 集团SBC ×（1 − Cloud SBC份额）× 非Cloud业务收入权重',[dep('sbc'),profitDep('cloudSbcShare'),cloud?raw('Cloud业务收入权重',weight,'ratio'):dep(`business.${business}.allocationWeight`,weight,{label:'非Cloud业务收入权重',unit:'ratio'})],modelSource('calculateProfitQuarter'),'收入权重 = 业务收入 ÷ 对应Cloud/非Cloud业务总收入；分配总收入为0时使用冻结基准业务份额。'+note,extra);
  }
  if(metric==='allocationWeight'){
   const total=modelLineageNonCloud.reduce((s,k)=>s+d.businessParts[k].revenue,0),baseTotal=modelLineageNonCloud.reduce((s,k)=>s+(k==='youtubeSubs'?b.segments.subs*bp.youtubeSubsShare:k==='otherSubs'?b.segments.subs*(1-bp.youtubeSubsShare):b.segments[k]),0);
   const v=cloud?(business==='workspace'?p.workspaceDepShare:business==='traditional'?p.traditionalDepShare:business==='ai'?Math.max(0,1-p.workspaceDepShare-p.traditionalDepShare):0):total>0?part.revenue/total:(business==='youtubeSubs'?b.segments.subs*bp.youtubeSubsShare:business==='otherSubs'?b.segments.subs*(1-bp.youtubeSubsShare):b.segments[business])/baseTotal;
   if(cloud&&['workspace','traditional'].includes(business))return {...modelNumberLineage(business+'DepShare',q,{parameter:'profit',baseline:options.baseline}),label:name(business)+'折旧摊销分配比例'};
   if(cloud&&business==='tpu')return assumption(0,'研究分配规则：独立TPU交付不承担自有云资产D&A。','固定权重0。',{...extra,unit:'ratio'});
   const priorBusinessRevenue=business==='youtubeSubs'?b.segments.subs*bp.youtubeSubsShare:business==='otherSubs'?b.segments.subs*(1-bp.youtubeSubsShare):b.segments[business];
   return calc(v,cloud?'AI折旧摊销分配比例 = 1 − Workspace份额 − 传统GCP份额；最低为0':total>0?'业务收入比例 = 业务收入 ÷ 六项非Cloud业务收入合计':'业务收入比例 = 初始业务收入 ÷ 初始六项非Cloud业务收入合计',cloud?[profitDep('workspaceDepShare'),profitDep('traditionalDepShare')]:total>0?[mdep('revenue'),dep('nonCloudBusinessRevenue',total)]:[raw('初始业务收入',priorBusinessRevenue),raw('初始非Cloud业务收入合计',baseTotal)],modelSource('calculateProfitQuarter'),total===0&&!cloud?'总收入为0时退回初始业务收入权重。':note,{...extra,unit:'ratio'});
  }
  if(metric==='daCogs')return calc(metricVal,'计入营业成本的D&A = 业务D&A × D&A计入营业成本比例',[mdep('da'),profitDep('depreciationCogsShare')],modelSource('cloudProfitBuild / calculateProfitQuarter'),note,extra);
  if(metric==='cogs'){
   const cash=part.cogs-part.daCogs-part.sbc*b.sbcAllocation.cogs;
   return calc(metricVal,'业务营业成本 = 业务现金成本 + 业务D&A × COGS分配比例 + 业务SBC × 基准SBC的COGS比例',[dep(`business.${business}.cashCost`,cash,{label:'业务现金成本'}),mdep('da'),profitDep('depreciationCogsShare'),mdep('sbc'),raw('基准SBC的COGS比例',b.sbcAllocation.cogs,'ratio')],modelSource('cloudProfitBuild / calculateProfitQuarter'),note,extra);
  }
  if(['cashCost','directCost'].includes(metric)){
   const cash=metric==='directCost'?part.directCost:part.cogs-part.daCogs-part.sbc*b.sbcAllocation.cogs;
   if(isFiniteNumber(p[business+'GrossMargin'])){
    const ref=baseline.quarters.find(x=>x.period===period).profitDetail.businessParts[business],refRate=ref.revenue>0?(ref.daCogs+ref.sbc*b.sbcAllocation.cogs)/ref.revenue:0;
    return calc(cash,'业务现金成本 = 业务收入 ×（1 − 标准化毛利率假设 − 初始非现金负担率）；最低为0',[mdep('revenue'),profitDep(business+'GrossMargin'),raw('初始非现金负担率',refRate,'ratio')],modelSource('毛利率覆盖分支'),note,extra);
   }
   if(cloud)return calc(cash,business==='ai'?'AI现金直接成本 = AI收入 × [第三方份额 × 第三方成本率 +（1 − 第三方份额）× 自有成本率] × Cloud现金成本倍率':'现金直接成本 = 业务收入 × 参考直接成本率 × Cloud现金成本倍率',[mdep('revenue'),...(business==='ai'?['aiThirdPartyShare','aiThirdPartyCostRate','aiOwnOperatingRate']:[business+'DirectRate']).map(profitDep),profitDep('cloudCashCostMultiplier')],modelSource('cloudProfitBuild'),note,extra);
   return calc(cash,'业务现金成本 = 可识别直接成本 + 非Cloud共享现金成本 × 业务收入权重',[dep(`business.${business}.identifiedDirect`,d.nonCloudDirect?.parts[business]?.cost??0,{label:'可识别直接成本'}),dep('nonCloudCashResidual',d.nonCloud.cogs-(d.nonCloudDirect?.total||0)-(d.depreciation+d.amortization)*(1-p.cloudDepShare)*p.depreciationCogsShare-(d.sbc-d.cloudSbc)*b.sbcAllocation.cogs-modelLineageNonCloud.reduce((s,k)=>s+(d.businessParts[k].cogsAdjustment||0),0)),dep(`business.${business}.allocationWeight`,nonCloudWeight,{label:'业务收入权重',unit:'ratio'})],modelSource('calculateProfitQuarter'),note,extra);
  }
  if(metric==='identifiedDirect'){
   const v=d.nonCloudDirect?.parts[business]?.cost;
   if(!isFiniteNumber(v))return assumption(0,'模型没有单独识别该业务的直接成本，以共享成本研究分摊。','0表示未单列直接成本，不表示实际成本为0。',extra);
   const parameter=business==='search'?'searchTacRate':business==='network'?'networkTacRate':'youtubeContentRate';
   return calc(v,`可识别成本 = 业务收入 × ${name(parameter)}${business==='youtubeSubs'?' + NFL固定成本':''}`,[mdep('revenue'),profitDep(parameter),...(business==='youtubeSubs'?[profitDep('nflContentCost')]:[])],modelSource('nonCloudDirect'),business==='youtubeSubs'?'NFL在实际计算引擎中归入YouTube订阅成本。':note,extra);
  }
  if(metric==='cashOpex')return calc(metricVal,'Cloud业务现金经营费用 = 业务收入 × 参考经营费用率 × 现金成本倍率',[mdep('revenue'),profitDep(business+'OpexRate'),profitDep('cloudCashCostMultiplier')],modelSource('cloudProfitBuild'),note,extra);
  if(metric==='effectiveDirectRate')return calc(metricVal,part.revenue?'实际现金直接成本率 = 现金直接成本 ÷ 业务收入':'实际现金直接成本率 = 0（本期业务收入为0）',part.revenue?[mdep('directCost'),mdep('revenue')]:[mdep('revenue')],modelSource('cloudProfitBuild'),'收入为0时按模型规则显示0，不用于推断合同费率。',extra);
  if(metric==='effectiveOpexRate')return calc(metricVal,'实际现金经营费用率 = 参考现金经营费用率 × Cloud现金成本倍率',[profitDep(business+'OpexRate'),profitDep('cloudCashCostMultiplier')],modelSource('cloudProfitBuild'),note,extra);
  if(metric==='thirdPartyCost')return calc(metricVal,'AI第三方算力成本 = AI收入 × 第三方算力份额 × 采购成本率 × Cloud现金成本倍率',[mdep('revenue'),profitDep('aiThirdPartyShare'),profitDep('aiThirdPartyCostRate'),profitDep('cloudCashCostMultiplier')],modelSource('cloudProfitBuild'),'采用自设AI毛利率时不再独立计算第三方和自有两项现金成本。',extra);
  if(metric==='ownOperatingCost')return calc(metricVal,'AI自有运营成本 = AI收入 ×（1 − 第三方算力份额）× 自有运营成本率 × Cloud现金成本倍率',[mdep('revenue'),profitDep('aiThirdPartyShare'),profitDep('aiOwnOperatingRate'),profitDep('cloudCashCostMultiplier')],modelSource('cloudProfitBuild'),'采用自设AI毛利率时不再独立计算第三方和自有两项现金成本。',extra);
  if(metric==='referenceGrossMargin'){
   const initial=baseline.quarters.find(x=>x.period===period)?.profitDetail?.businessParts?.[business];
   return calc(metricVal,'初始业务毛利率 = 1 − 初始业务营业成本 ÷ 初始业务收入',[businessDep(business,'cogs',initial?.cogs),businessDep(business,'revenue',initial?.revenue)].map(x=>({...x,baseline:true})),modelSource('calculateProfitQuarter'),'初始成本包含直接成本及按初始收入份额分配的共同成本。',extra);
  }
  if(metric==='cogsAdjustment'){
   const sumAdjustment=modelLineageNonCloud.reduce((s,k)=>s+(d.businessParts[k].cogsAdjustment||0),0),beforeAdjustment=d.nonCloud.cogs-sumAdjustment;
   const initialCost=(d.nonCloudDirect?.parts[business]?.cost??0)+(beforeAdjustment-(d.nonCloudDirect?.total||0))*nonCloudWeight;
   return calc(metricVal,'业务成本调整 = 当前业务营业成本 − 原成本驱动下的业务营业成本',[mdep('cogs'),raw('原成本驱动下的业务营业成本',initialCost)],modelSource('calculateProfitQuarter'),'原成本包含可识别直接成本，以及按当前收入比例分配的共同成本。',extra);
  }
  if(['rd','sm','ga','otherOpex'].includes(metric)){
   if(!cloud)return calc(metricVal,'业务费用 = 非Cloud费用总额 × 业务收入权重',[raw('非Cloud'+name(metric),d.nonCloud[metric]),dep(`business.${business}.allocationWeight`,nonCloudWeight,{label:'业务收入权重',unit:'ratio'})],modelSource('calculateProfitQuarter'),note,extra);
   return calc(metricVal,`业务${name(metric)} = 现金经营费用 × 基准费用分配比例 + SBC × 基准SBC分配比例${metric==='rd'?' + D&A ×（1 − D&A计入营业成本比例）':''}`,[mdep('cashOpex'),raw('基准费用分配比例',b.opexAllocation[metric],'ratio'),mdep('sbc'),raw('基准SBC分配比例',b.sbcAllocation[metric],'ratio'),...(metric==='rd'?[mdep('da'),profitDep('depreciationCogsShare')]:[])],modelSource('cloudProfitBuild'),note,extra);
  }
  return missing('该业务指标没有独立的数值来源映射。');
 }
 if(modelLineageCloud.includes(key)||['youtubeSubs','otherSubs'].includes(key))return modelNumberLineage(`business.${key}.revenue`,q,{baseline:options.baseline});
 const attribution=key.match(/^attribution\.(\d+)\.(grossProfit|grossMarginPoints|operatingIncome)$/);
 if(attribution){
  const index=Number(attribution[1]),metric=attribution[2],entry=d?.attribution?.[index],r0=b?Object.values(b.segments).reduce((s,v)=>s+v,0)+b.hedge:null,gp0=b?r0-b.groupCosts.cogs:null,oi0=b?gp0-b.groupCosts.rd-b.groupCosts.sm-b.groupCosts.ga-b.groupCosts.otherOpex:null;
  const first=metric==='grossProfit'?gp0:metric==='operatingIncome'?oi0:100*gp0/r0,previous=(d?.attribution||[]).slice(0,index).reduce((sum,row)=>sum+row[metric],first),after=previous+(entry?.[metric]??0),unit=metric==='grossMarginPoints'?'pp':'USD mn';
  const marginMetric=metric==='grossMarginPoints';
  return calc(entry?.[metric],marginMetric?'本步骤毛利率变化（百分点）=（本步骤毛利率 − 上一步毛利率）× 100':'本步骤影响 = 替换本步骤参数后的结果 − 上一步结果',[raw('本步骤替换后',marginMetric?after/100:after,marginMetric?'ratio':unit),raw('上一步结果',marginMetric?previous/100:previous,marginMetric?'ratio':unit)],modelSource(`profitAttribution；第${index+1}步：${entry?.label||'缺失'}`),'顺序为总收入规模→业务结构→现金成本→资产/年限/折旧分配→SBC→未分配项→集团覆盖。交叉影响归入后替换步骤，是精确算术桥，不是因果归因。',{label:(entry?.label||'归因')+' · '+(marginMetric?'毛利率变化':name(metric)+'变化'),unit,evidenceKey:'operatingIncome'});
 }
 if(d&&b){
  if(key==='msCloudOperatingIncome')return assumption(b.cloudOperatingIncome,`MS 2026-10-29 Non-Core Losses!${msCol}90`,'原始MS Cloud营业利润预测缓存，作为条件反推目标；不随当前情景变化。',{label:'MS目标Cloud营业利润',evidenceKey:'cloudOperatingIncome'});
  if(key==='msCloudCostMultiplier'){
   let fixed=0,variable=0;
   for(const business of modelLineageCloud){const r=p[business+'Revenue'],rate=business==='ai'?p.aiThirdPartyShare*p.aiThirdPartyCostRate+(1-p.aiThirdPartyShare)*p.aiOwnOperatingRate:p[business+'DirectRate'];if(isFiniteNumber(p[business+'GrossMargin']))fixed+=d.parts[business].directCost;else variable+=r*rate;variable+=r*p[business+'OpexRate'];}
   const allowance=q.segments.cloud-b.cloudOperatingIncome-d.cloudDA-d.cloudSbc,v=variable>0?(allowance-fixed)/variable:null;
   return calc(v,'对齐MS所需现金成本倍率 =（Cloud收入 − MS目标营业利润 − Cloud D&A − Cloud SBC − 已固定现金成本）÷ 参考费率下可缩放现金成本',[dep('cloud'),raw('MS目标Cloud营业利润',b.cloudOperatingIncome),dep('cloudDA',d.cloudDA),dep('cloudSbc',d.cloudSbc),raw('已覆盖毛利率对应的固定现金成本',fixed),raw('倍率1时的可缩放现金成本',variable)],`当前条件反推：scripts/profit-model.mjs solveMSProfit；MS目标来自Non-Core Losses!${msCol}90。`,'求解时Cloud未分配成本设为0；倍率超出0–3时不可应用。此条件解尚未自动应用为当前倍率。',{label:'当前条件下对齐MS所需倍率',unit:'multiple',evidenceKey:'cloudOperatingIncome'});
  }
  if(key==='depImpact.netIncome'||key==='depImpact.eps'){
   const saving=b.depreciation-d.depreciation,v=saving*(1-q.taxRate)/(key.endsWith('.eps')?q.dilutedShares:1);
   if(d.manualOverrides?.length)return missing('存在集团费用覆盖，折旧敏感性不能直接等同实际净利润/EPS传导；请查看营业利润变化归因。');
   return calc(v,key.endsWith('.eps')?'EPS敏感性 = 折旧减少量 ×（1 − 有效税率）÷ 稀释股数':'净利润敏感性 = 折旧减少量 ×（1 − 有效税率）',[dep('depImpact',saving),dep('taxRate'),...(key.endsWith('.eps')?[dep('dilutedShares')]:[])],modelSource('折旧敏感性对照'),'固定收入与其他假设，只恢复资产倍率和年限的初始值。',{label:key.endsWith('.eps')?'折旧对EPS的敏感性':'折旧对净利润的敏感性',evidenceKey:'depreciation'});
  }
  if(key==='cloudCost')return modelNumberLineage('cloudCashCostMultiplier',q,{parameter:'profit',baseline:options.baseline});
  if(key==='cloudResidual')return modelNumberLineage('cloudUnallocatedCost',q,{parameter:'profit',baseline:options.baseline});
  if(key==='cloudTargetGrowth')return assumption(changes.segmentGrowthYoY?.cloud??(originalPrior?.segments?.cloud>0?original.segments.cloud/originalPrior.segments.cloud-1:null),has(changes.segmentGrowthYoY,'cloud')?`用户情景覆盖：overrides[${period}].segmentGrowthYoY.cloud`:`初始同比：${origin('cloud')} ÷ ${priorPeriod}原始Cloud收入 − 1。`,'先计算Cloud目标，再按初始结构缩放未覆盖业务。单独覆盖业务后最终Cloud同比可能不同。',{unit:'ratio',evidenceKey:'cloud',editable:!options.baseline,parameter:'segmentGrowthYoY',parameterKey:'cloud',scale:100});
  if(key==='cloudRevenueTarget'){
   const g=changes.segmentGrowthYoY?.cloud??(originalPrior?.segments?.cloud>0?original.segments.cloud/originalPrior.segments.cloud-1:null),v=prior&&isFiniteNumber(g)?prior.segments.cloud*(1+g):original.segments.cloud;
   return calc(v,'覆盖前Cloud收入目标 = 上年同季情景Cloud收入 ×（1 + 原始/覆盖同比输入）',[dep('cloud',prior?.segments.cloud,{period:priorPeriod,label:'上年同季Cloud收入'}),dep('cloudTargetGrowth',g,{unit:'ratio'})],modelSource('calculateCase：profitRevenueInputs之前'),'单独业务收入覆盖在此目标之后应用，故目标未必等于最终Cloud合计。',{evidenceKey:'cloud'});
  }
  if(['servers','otherAssets'].includes(key)){
   const server=key==='servers',asset=server?b.serverAssets:b.otherAssets,mult=server?'serverAssetMultiplier':'otherAssetMultiplier',life=server?'serverLife':'otherLife';
   return calc(asset*p[mult]/p[life]/4,'季度折旧 = 分类资产代理 × 资产倍率 ÷ 使用年限 ÷ 4',[raw('分类资产代理',asset),profitDep(mult),profitDep(life)],`资产代理由MS Model!${msCol}46折旧及Barclays ${b.sourceCells.barclays}分类结构/年限反推；scripts/build_profit_inputs.py。`,'资产代理 = 初始折旧 × 原始分类折旧权重 × 初始使用年限 × 4；不是披露资产原值或完整新增/退役台账。',{label:server?'服务器季度折旧':'其他资产季度折旧',evidenceKey:'depreciation'});
  }
  if(key==='depImpact')return calc(b.depreciation-d.depreciation,'当前情景折旧减少量 = 初始资产/年限下的折旧 − 当前折旧',[raw('恢复初始资产/年限后的折旧',b.depreciation),dep('depreciation')],modelSource('折旧敏感性对照'),'固定收入与其他假设；正值表示当前情景减少折旧。存在集团毛利/费用率覆盖时，不能直接把全部差额当作净利润提升。',{evidenceKey:'depreciation'});
  if(key==='cloudDA'||key==='cloudSbc')return calc(d[key],key==='cloudDA'?'Cloud D&A = 集团D&A × Cloud D&A份额':'Cloud SBC = 集团SBC × Cloud SBC份额',[dep(key==='cloudDA'?'da':'sbc'),profitDep(key==='cloudDA'?'cloudDepShare':'cloudSbcShare')],modelSource('cloudProfitBuild'),'分配份额为研究假设。',{evidenceKey:key==='cloudDA'?'da':'sbc'});
  if(key==='nonCloudDA'||key==='nonCloudSbc')return calc(key==='nonCloudDA'?d.depreciation+d.amortization-d.cloudDA:d.sbc-d.cloudSbc,key==='nonCloudDA'?'非Cloud D&A = 集团D&A − Cloud D&A':'非Cloud SBC = 集团SBC − Cloud SBC',[dep(key==='nonCloudDA'?'da':'sbc'),dep(key==='nonCloudDA'?'cloudDA':'cloudSbc',key==='nonCloudDA'?d.cloudDA:d.cloudSbc)],modelSource('calculateProfitQuarter'),'已包含在COGS/费用内，不重复扣减。',{evidenceKey:key==='nonCloudDA'?'da':'sbc'});
  if(key==='nonCloudRevenue')return calc(q.revenue-q.segments.cloud,'非Cloud收入 = 集团收入 − Cloud收入',[dep('revenue'),dep('cloud')],modelSource('calculateProfitQuarter'),'该缩放分母包含对冲收入。',{evidenceKey:'revenue'});
  if(key==='nonCloudBusinessRevenue')return calc(modelLineageNonCloud.reduce((s,k)=>s+d.businessParts[k].revenue,0),'非Cloud业务收入 = Search + Network + YouTube广告 + YouTube订阅 + 其他订阅/平台/设备 + Other Bets',modelLineageNonCloud.map(k=>businessDep(k,'revenue')),modelSource('calculateProfitQuarter'),'该分配分母不含汇率对冲。',{evidenceKey:'revenue'});
  if(key==='nonCloudDirect')return calc(d.nonCloudDirect?.total,'可识别直接成本 = 搜索TAC + Network TAC + YouTube广告内容成本 + YouTube订阅内容成本',['search','network','youtube','youtubeSubs'].map(k=>dep(`business.${k}.identifiedDirect`,d.nonCloudDirect?.parts[k]?.cost,{label:name(k)+'可识别成本'})),modelSource('nonCloudDirect'),b.nonCloudCostSource,{evidenceKey:'cogs'});
  if(key==='nonCloudCogs')return calc(d.nonCloud.cogs,'非Cloud营业成本 = 六项非Cloud业务营业成本合计',modelLineageNonCloud.map(k=>businessDep(k,'cogs')),modelSource('calculateProfitQuarter'),'包含业务毛利率覆盖产生的现金成本调整。',{evidenceKey:'cogs'});
  if(key==='sharedCost')return calc(d.nonCloud.cogs-(d.nonCloudDirect?.total||0),'共享成本 = 非Cloud营业成本 − 可识别直接成本',[dep('nonCloudCogs',d.nonCloud.cogs),dep('nonCloudDirect',d.nonCloudDirect?.total)],modelSource('calculateProfitQuarter'),'包含共享现金成本、D&A、SBC及业务毛利率覆盖的差额，非独立披露科目。',{evidenceKey:'cogs'});
  if(key==='nonCloudCashResidual'){
   const adjustment=modelLineageNonCloud.reduce((s,k)=>s+(d.businessParts[k].cogsAdjustment||0),0),nonDA=(d.depreciation+d.amortization)*(1-p.cloudDepShare),nonSbc=d.sbc-d.cloudSbc,v=d.nonCloud.cogs-(d.nonCloudDirect?.total||0)-nonDA*p.depreciationCogsShare-nonSbc*b.sbcAllocation.cogs-adjustment;
   return calc(v,'共享现金成本 = 非Cloud营业成本 − 可识别直接成本 − 非Cloud D&A计入COGS − 非Cloud SBC计入COGS − 业务毛利率覆盖差额',[dep('nonCloudCogs',d.nonCloud.cogs),dep('nonCloudDirect',d.nonCloudDirect?.total),raw('非Cloud D&A计入COGS',nonDA*p.depreciationCogsShare),raw('非Cloud SBC计入COGS',nonSbc*b.sbcAllocation.cogs),raw('业务毛利率覆盖差额',adjustment)],modelSource('calculateProfitQuarter'),'等价于冻结初始共享现金残差 × 当前含对冲非Cloud收入 / 初始含对冲非Cloud收入。',{evidenceKey:'cogs'});
  }
  if(['manualCost','manualCogs','manualOpex'].includes(key)){
   const cogs=q.cogs-d.group.cogs,opex=q.opex-d.group.opex;
   return calc(key==='manualCost'?d.manualCostAdjustment:key==='manualCogs'?cogs:opex,key==='manualCost'?'集团费用覆盖差额 = 主表COGS + 主表经营费用 − 业务模型COGS − 业务模型经营费用':key==='manualCogs'?'集团COGS覆盖差额 = 主表COGS − 业务模型COGS':'集团经营费用覆盖差额 = 主表经营费用 − 业务模型经营费用',[...(key!=='manualOpex'?[dep('cogs'),raw('业务模型COGS',d.group.cogs)]:[]),...(key!=='manualCogs'?[dep('opex'),raw('业务模型经营费用',d.group.opex)]:[])],modelSource('calculateCase.manualCostAdjustment'),'覆盖优先于业务明细，差额单列勾稽；正值表示主表费用更高。',{evidenceKey:'opex'});
  }
 }
 const value=val(key);
 if(!isFiniteNumber(value))return missing(q.modelType==='annual_extension'?'年度延展未实现该字段的季度/业务计算，不填造数据。':'本期该字段没有有效来源数值。');
 if(q.kind==='actual')return finish('actual',value,'',[],origin(key),'历史期间只读；由源模型/已核对披露保留。派生比率以该历史期间的分子分母计算。');
 if(key==='msEps')return assumption(value,origin('msEps'),'MS年度列原始EPS缓存，仅用于外部对照，不受客户情景影响。');
 if(q.modelType==='quarter_rollup'){
  const qs=current.quarters.filter(x=>x.period.startsWith(period));
  if(key==='dilutedShares')return calc(value,'年度稀释股数 = 四季“稀释股数 × 各季天数”之和 ÷ 全年天数',qs.map(x=>dep(key,x.dilutedShares,{period:x.period,label:x.period+'稀释股数（权重'+x.days+'天）'})).concat(raw('全年天数',q.days,'days')),modelSource('quarter_rollup'),`全年天数${q.days}；季度股数按日加权，非简单平均。`);
  if(['eps','adjustedEps'].includes(key))return calc(value,key==='eps'?'年度EPS = 四季普通股盈利分子合计 ÷ 按天数加权稀释股数':'年度调整后EPS = 四季调整后普通股盈利分子合计 ÷ 按天数加权稀释股数',[dep(key==='eps'?'dilutedEarnings':'adjustedEarnings'),dep('dilutedShares')],modelSource('quarter_rollup'),'年度EPS不等于季度EPS相加。');
  const annualRatios={grossMargin:['grossProfit','revenue'],opexRatio:['opex','revenue'],operatingMargin:['operatingIncome','revenue'],taxRate:['tax','pretaxIncome']};
  if(annualRatios[key])return calc(value,`${name(key)} = 年度${name(annualRatios[key][0])} ÷ 年度${name(annualRatios[key][1])}`,annualRatios[key].map(k=>dep(k)),modelSource('quarter_rollup'),'全年比率由全年金额计算，不对季度比率取平均。');
  if(key==='growth')return calc(value,'年度收入同比 = 本年收入 ÷ 上年收入 − 1',[dep('revenue'),dep('revenue',prior?.revenue,{period:priorPeriod,label:'上年收入'})],modelSource('quarter_rollup'));
  return calc(value,`年度${name(key)} = 四个季度${name(key)}之和`,qs.map(x=>dep(key,val(key,x),{period:x.period,label:x.period+' '+name(key)})),modelSource('quarter_rollup'),'全年同时包含已报告季度与预测季度；预测假设在各季度修改。');
 }
 if(['otherIncome','taxRate','dilutedShares','preferredDividends'].includes(key))return assumption(value,has(changes,key)?`用户情景覆盖：overrides[${period}].${key}`:key==='preferredDividends'?`${period}研究默认输入0；MS原模型未单列优先股股息。`:origin(key),key==='preferredDividends'?'默认0是可改假设，不是公司股息指引。':'源模型预测值冻结为可修改输入，非公司实际数据。',{editable:!options.baseline,parameter:'driver',parameterKey:key,scale:modelLineageUnit(key)==='ratio'?100:1});
 if(['hedge','cfo','amortization'].includes(key)||(!d&&['sbc','depreciation','sbcTaxBenefit','cloudOperatingIncome'].includes(key)))return assumption(value,origin(key),key==='cfo'?'MS现金流预测缓存；本利润表情景没有营运资本/付款桥，因此不随收入或利润改动。':'沿源模型的本期预测输入；当前没有该字段的独立驱动模型。');
 if(key==='revenue')return calc(value,'集团收入 = Search + YouTube广告 + Network + Cloud + 订阅/平台/设备 + Other Bets + 汇率对冲',[...modelLineageSegments,'hedge'].map(k=>dep(k)),modelSource('calculateCase'));
 if(modelLineageSegments.includes(key)){
  if(key==='cloud'&&d)return calc(value,'Cloud收入 = Workspace + 传统GCP + AI云服务 + 独立TPU交付',modelLineageCloud.map(k=>businessDep(k,'revenue')),modelSource('profitRevenueInputs'),'内部四块只合计一次，不能再和Cloud总额重复加总。');
  const growth=q.drivers?.segmentGrowthYoY?.[key];
  if(!prior||!isFiniteNumber(growth))return assumption(value,origin(key),'缺少有效上年同季基数，模型保留源预测金额。');
  return calc(value,`${name(key)}收入 = 上年同期情景收入 ×（1 + 本期同比输入）`,[dep(key,prior.segments[key],{period:priorPeriod,label:'上年同期'+name(key)+'收入'}),dep(key+'GrowthYoY',growth,{label:name(key)+'同比输入',unit:'ratio',parameter:'segmentGrowthYoY',parameterKey:key,scale:100,editable:!options.baseline})],modelSource('calculateCase'),'收入金额由公式计算；请修改本期同比输入。');
 }
 if(key==='growth')return calc(value,'收入同比 = 本期收入 ÷ 上年同期收入 − 1',[dep('revenue'),dep('revenue',prior?.revenue,{period:priorPeriod,label:'上年同期收入'})],modelSource('calculateCase'));
 if(key==='cogs'){
  if(!d||has(changes,'grossMargin'))return calc(value,'营业成本 = 集团收入 ×（1 − 毛利率输入）',[dep('revenue'),driverDep('grossMargin')],modelSource('calculateCase'),'集团毛利率覆盖优先于逐业务成本。');
  return calc(value,'集团营业成本 = 十项业务营业成本合计',[...modelLineageCloud,...modelLineageNonCloud].map(k=>businessDep(k,'cogs')),modelSource('calculateProfitQuarter.group.cogs'),'已含分配的D&A和SBC，不再次扣减。');
 }
 if(key==='grossProfit')return calc(value,'毛利 = 集团收入 − 营业成本',[dep('revenue'),dep('cogs')],modelSource('calculateCase'));
 if(key==='grossMargin'){
  if(has(changes,'grossMargin')||!d)return modelNumberLineage(key,q,{parameter:'driver',baseline:options.baseline});
  return calc(value,'集团毛利率 = 毛利 ÷ 集团收入',[dep('grossProfit'),dep('revenue')],modelSource('calculateCase'));
 }
 if(['rd','sm','ga','otherOpex'].includes(key)){
  if(d&&!has(changes,'opexRatio')&&(key==='otherOpex'||!has(changes,key+'Ratio')))return calc(value,`集团${name(key)} = 各业务${name(key)}合计${key==='rd'?' + Cloud未分配成本':''}`,[...modelLineageCloud,...modelLineageNonCloud].filter(k=>isFiniteNumber(d.businessParts[k][key])).map(k=>businessDep(k,key)).concat(key==='rd'?[profitDep('cloudUnallocatedCost')]:[]),modelSource('calculateProfitQuarter.group.'+key),'非Cloud共享费用按收入研究分配。');
  return calc(value,`${name(key)} = 集团收入 × ${name(key+'Ratio')}`,[dep('revenue'),driverDep(key+'Ratio')],modelSource('calculateExpenses'),'总费用率覆盖时，原始各项费率同比例缩放；分项费率覆盖时直接使用该项输入。');
 }
 if(key==='opex')return calc(value,'经营费用合计 = 研发 + 销售 + 管理 + 其他经营费用',['rd','sm','ga','otherOpex'].map(k=>dep(k)),modelSource('calculateExpenses / calculateProfitQuarter'));
 if(key==='opexRatio'){if(has(changes,'opexRatio')||!d)return modelNumberLineage(key,q,{parameter:'driver',baseline:options.baseline});return calc(value,'经营费用率 = 经营费用合计 ÷ 收入',[dep('opex'),dep('revenue')],modelSource('calculateCase'));}
 const simple={operatingIncome:['营业利润 = 毛利 − 经营费用',['grossProfit','opex']],operatingMargin:['营业利润率 = 营业利润 ÷ 收入',['operatingIncome','revenue']],pretaxIncome:['税前利润 = 营业利润 + 非经营收益',['operatingIncome','otherIncome']],tax:['所得税 = 税前利润 × 有效税率',['pretaxIncome','taxRate']],netIncome:['GAAP净利润 = 税前利润 ×（1 − 有效税率）',['pretaxIncome','taxRate']],dilutedEarnings:['普通股盈利分子 = GAAP净利润 − 优先股股息',['netIncome','preferredDividends']],eps:['EPS = 普通股盈利分子 ÷ 稀释股数',['dilutedEarnings','dilutedShares']],adjustedOperatingIncome:['调整后营业利润 = GAAP营业利润 + SBC',['operatingIncome','sbc']],adjustedNetIncome:['调整后净利润 = GAAP净利润 + SBC − SBC税效应',['netIncome','sbc','sbcTaxBenefit']],adjustedEarnings:['调整后普通股盈利分子 = 普通股盈利分子 + SBC − SBC税效应',['dilutedEarnings','sbc','sbcTaxBenefit']],adjustedEps:['调整后EPS = 调整后普通股盈利分子 ÷ 稀释股数',['adjustedEarnings','dilutedShares']],da:['D&A = 折旧 + 摊销',['depreciation','amortization']]};
 if(simple[key])return calc(value,simple[key][0],simple[key][1].map(k=>dep(k)),modelSource('calculateCase'),key.startsWith('adjusted')?'调整只加回税后SBC，未剔除投资收益或其他一次性事项。':'');
 if(d){
  if(key==='sbc')return calc(value,'集团SBC = 基准SBC × SBC倍率',[raw('MS基准SBC',b.sbc),profitDep('sbcMultiplier')],`MS Model!${msCol}44；scripts/profit-model.mjs cloudProfitBuild`,'已含于GAAP费用；只在调整后口径加回。');
  if(key==='sbcTaxBenefit')return calc(value,'SBC税效应 = 集团SBC × SBC税效应率',[dep('sbc'),profitDep('sbcTaxBenefitRate')],modelSource('calculateProfitQuarter'),'此税效应率与集团有效税率不同。');
  if(key==='depreciation')return calc(value,'季度折旧 = 服务器资产代理 × 服务器倍率 ÷ 服务器年限 ÷ 4 + 其他资产代理 × 其他资产倍率 ÷ 其他年限 ÷ 4',[dep('servers',b.serverAssets*p.serverAssetMultiplier/p.serverLife/4,{label:'服务器季度折旧'}),dep('otherAssets',b.otherAssets*p.otherAssetMultiplier/p.otherLife/4,{label:'其他资产季度折旧'})],modelSource('cloudProfitBuild'),'分类资产为MS折旧和Barclays分类结构反推代理，不是披露资产台账。');
  if(key==='cloudOperatingIncome')return calc(value,'Cloud营业利润 = 四项Cloud业务营业利润合计 − Cloud未分配成本',[...modelLineageCloud.map(k=>businessDep(k,'operatingIncome')),profitDep('cloudUnallocatedCost')],modelSource('cloudProfitBuild.totals.operatingIncome'),'包含Cloud D&A与SBC；集团手动费用覆盖不反填Cloud营业利润。');
 }
 return missing('该数值尚无逐项计算来源映射；不使用其他科目证据替代。');
}
