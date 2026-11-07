/* Inside WB. Number-level provenance mirrors the engine; it never recalculates the case. */
const modelLineageCloud=['workspace','traditional','ai','tpu'];
const modelLineageNonCloud=['search','network','youtube','youtubeSubs','otherSubs','bets'];
const modelLineageSegments=['search','youtube','network','cloud','subs','bets'];
const modelLineageParameterLabels={
 cloudCashCostMultiplier:'Cloud现金成本倍率',searchTacRate:'搜索分销TAC率',networkTacRate:'Network TAC率',youtubeContentRate:'YouTube内容分成率',youtubeSubsShare:'YouTube占订阅收入份额',nflContentCost:'NFL固定内容成本',
 workspaceRevenue:'Workspace收入',traditionalRevenue:'传统GCP收入',aiRevenue:'AI云服务收入',tpuRevenue:'独立TPU交付收入',workspaceDirectRate:'Workspace直接成本率',traditionalDirectRate:'传统GCP直接成本率',tpuDirectRate:'TPU直接成本率',workspaceOpexRate:'Workspace经营费用率',traditionalOpexRate:'传统GCP经营费用率',aiOpexRate:'AI经营费用率',tpuOpexRate:'TPU经营费用率',aiThirdPartyShare:'AI第三方算力份额',aiThirdPartyCostRate:'AI第三方采购成本率',aiOwnOperatingRate:'AI自有运营成本率',serverLife:'服务器使用年限',otherLife:'其他资产使用年限',serverAssetMultiplier:'服务器资产倍率',otherAssetMultiplier:'其他资产倍率',cloudDepShare:'集团D&A分配Cloud比例',workspaceDepShare:'Cloud D&A分配Workspace比例',traditionalDepShare:'Cloud D&A分配传统GCP比例',depreciationCogsShare:'D&A计入营业成本比例',sbcMultiplier:'SBC倍率',sbcTaxBenefitRate:'SBC税效应率',cloudSbcShare:'集团SBC分配Cloud比例',cloudUnallocatedCost:'Cloud额外未分配成本',rdRatio:'研发费用率',smRatio:'销售费用率',gaRatio:'管理费用率',otherOpexRatio:'其他经营费用率',cloudTargetGrowth:'Cloud同比输入（业务覆盖前）',cloudRevenueTarget:'Cloud收入目标（业务覆盖前）',cloudDA:'Cloud D&A',cloudSbc:'Cloud SBC',nonCloudDA:'非Cloud D&A',nonCloudSbc:'非Cloud SBC',nonCloudRevenue:'非Cloud收入（含对冲）',nonCloudBusinessRevenue:'非Cloud业务收入（不含对冲）',nonCloudDirect:'非Cloud可识别直接成本',nonCloudCashResidual:'非Cloud共享现金成本',nonCloudCogs:'非Cloud营业成本',manualCogs:'集团营业成本覆盖差额',manualOpex:'集团费用覆盖差额',adjustedEarnings:'调整后普通股盈利分子',depImpact:'当前情景折旧减少量'
};
function modelLineageUnit(key){
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
 const n=(v,d=3)=>v.toLocaleString('zh-CN',{maximumFractionDigits:d});
 if(unit==='ratio')return n(value*100)+'%';
 if(unit==='pp')return n(value)+' pp';
 if(unit==='multiple')return n(value,6)+'×';
 if(unit==='years')return n(value)+' 年';
 if(unit==='million shares')return n(value)+' 百万股';
 return n(value,unit==='USD/share'?6:3)+' '+unit;
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
 const name=k=>names[k]||modelLineageParameterLabels[k]||(k.endsWith('GrossMargin')?(names[k.slice(0,-11)]||k.slice(0,-11))+'标准化基准毛利率':k);
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
 const dep=(k,value=val(k),extra={})=>{const u=extra.unit||modelLineageUnit(k);return {key:k,label:name(k),value,period,unit:u,formattedValue:modelLineageFormat(value,u),...extra};};
 const raw=(label,value,unit='USD mn')=>dep('',value,{label,unit,navigable:false});
 const profitDep=k=>dep(k,p[k],{label:name(k),parameter:'profit',parameterKey:k,scale:modelLineageUnit(k)==='ratio'?100:1,editable:q?.kind==='estimate'&&!options.baseline});
 const driverDep=k=>dep(k,q?.drivers?.[k]??val(k),{parameter:'driver',parameterKey:k,scale:modelLineageUnit(k)==='ratio'?100:1,editable:q?.kind==='estimate'&&!options.baseline});
 const businessDep=(business,metric,value)=>dep(`business.${business}.${metric}`,value??d?.businessParts?.[business]?.[metric],{label:name(business)+' · '+name(metric),unit:modelLineageUnit(metric)});
 const finish=(kind,value,formula='',dependencies=[],source='',note='',extra={})=>{
  const unit=extra.unit||modelLineageUnit(key),finite=isFiniteNumber(value);
  const result={kind:finite?kind:'missing',label:name(key),formula:finite?formula:'',substitution:finite&&formula?dependencies.map(x=>`${x.label} = ${x.formattedValue??modelLineageFormat(x.value,x.unit)}`).join('；')+` → ${modelLineageFormat(value,unit)}`:'',source:basePrefix+(source||origin(key)),evidenceKey:extra.evidenceKey||key,dependencies:finite?dependencies:[],note:finite?note:(note||'本期没有该字段的有效数据；不补造为0。'),value:finite?value:null,unit,formattedValue:modelLineageFormat(value,unit),editable:false,...extra};
  if(!finite){result.kind='missing';result.editable=false;}
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
  return assumption(v,has(changes.segmentGrowthYoY,segment)?`用户情景覆盖：overrides[${period}].segmentGrowthYoY.${segment}`:`由${origin(segment)}与${priorPeriod}原始分部收入相除减1得到初始同比，再冻结为本期输入。`,'同比假设作用于当前情景的上年同期收入；编辑收入金额时也转换为该同比输入。',extra);
 }
 if(options.parameter==='profit'){
  if(!d||!b)return missing('本期没有逐业务利润参数；2028仅有年度延展。');
  const extra={parameter:'profit',parameterKey:key,scale:modelLineageUnit(key)==='ratio'?100:1,editable:!options.baseline&&q.kind==='estimate',evidenceKey:'depreciation'};
  if(key.endsWith('Revenue')&&modelLineageCloud.includes(key.slice(0,-7))){const x=modelNumberLineage(`business.${key.slice(0,-7)}.revenue`,q,options.baseline?{baseline:true}:{});return {...x,...extra,evidenceKey:key.slice(0,-7)};}
  if(key.endsWith('GrossMargin')){
   const business=key.slice(0,-11),part=d.businessParts?.[business],ref=baseline.quarters?.find(x=>x.period===period)?.profitDetail?.businessParts?.[business];
   if(!part||!ref)return missing('该业务没有可用毛利率输入。');
   if(has(changes.profit,key))return assumption(p[key],`用户情景覆盖：overrides[${period}].profit.${key}`,'该标准化毛利率反推现金成本；基准D&A/SBC负担固定，当前D&A/SBC仍独立传导。',{...extra,evidenceKey:business});
   const refNonCash=ref.revenue>0?(ref.daCogs+ref.sbc*b.sbcAllocation.cogs)/ref.revenue:0;
   const v=part.revenue?1-(part.cogs-part.daCogs-part.sbc*b.sbcAllocation.cogs)/part.revenue-refNonCash:ref.grossMargin;
   return calc(v,'标准化基准毛利率 = 1 − 当前现金成本 ÷ 当前业务收入 − 初始非现金成本 ÷ 初始业务收入',[raw('当前现金成本',part.cogs-part.daCogs-part.sbc*b.sbcAllocation.cogs),businessDep(business,'revenue'),raw('初始非现金负担率',refNonCash,'ratio')],modelSource('业务成本反推，尚未手动覆盖'), '这是编辑窗口的计算起点。提交修改后才成为覆盖假设；不等同当前情景的最终业务毛利率。',{...extra,evidenceKey:business});
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
  if(['otherIncome','taxRate','dilutedShares','preferredDividends'].includes(key))return {...modelNumberLineage(key,q,{baseline:options.baseline}),...extra};
  const v=q.drivers?.[key]??val(key),amount={grossMargin:'grossProfit',opexRatio:'opex',rdRatio:'rd',smRatio:'sm',gaRatio:'ga',otherOpexRatio:'otherOpex'}[key];
  if(q.kind==='actual')return finish('actual',v,'本期金额 ÷ 本期收入',[dep(amount),dep('revenue')],origin(amount),'历史期间只读。',{...extra,editable:false});
  if(has(changes,key))return assumption(v,`用户情景覆盖：overrides[${period}].${key}`,'该费用率或毛利率覆盖优先于业务明细；覆盖差额在归因中单列。',extra);
  if(q.modelType==='quarter_rollup'||d)return calc(v,`${name(key)} = ${name(amount)} ÷ 集团收入`,[dep(amount),dep('revenue')],modelSource('当前业务明细汇总后的有效比例'),'未覆盖时此值是计算结果；客户提交修改后成为集团覆盖假设。',extra);
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
   if(cloud&&['workspace','traditional'].includes(business))return {...modelNumberLineage(business+'DepShare',q,{parameter:'profit',baseline:options.baseline}),label:name(business)+' D&A分配权重'};
   if(cloud&&business==='tpu')return assumption(0,'研究分配规则：独立TPU交付不承担自有云资产D&A。','固定权重0。',{...extra,unit:'ratio'});
   return calc(v,cloud?'AI D&A权重 = max(0, 1 − Workspace份额 − 传统GCP份额)':'业务收入权重 = 业务收入 ÷ 非Cloud六项业务收入合计',cloud?[profitDep('workspaceDepShare'),profitDep('traditionalDepShare')]:[mdep('revenue'),dep('nonCloudBusinessRevenue',total)],modelSource('calculateProfitQuarter'),total===0&&!cloud?'总收入为0时退回初始业务收入权重。':note,{...extra,unit:'ratio'});
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
    return calc(cash,'业务现金成本 = max(0, 业务收入 ×（1 − 标准化毛利率假设 − 初始非现金负担率）)',[mdep('revenue'),profitDep(business+'GrossMargin'),raw('初始非现金负担率',refRate,'ratio')],modelSource('毛利率覆盖分支'),note,extra);
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
  return calc(entry?.[metric],'本步骤影响 = 替换本步骤参数后的结果 − 上一步结果',[raw('本步骤替换后',after,unit),raw('上一步结果',previous,unit)],modelSource(`profitAttribution；第${index+1}步：${entry?.label||'缺失'}`),'顺序为总收入规模→业务结构→现金成本→资产/年限/折旧分配→SBC→未分配项→集团覆盖。交叉影响归入后替换步骤，是精确算术桥，不是因果归因。',{label:(entry?.label||'归因')+' · '+(metric==='grossMarginPoints'?'毛利率变化':name(metric)+'变化'),unit,evidenceKey:'operatingIncome'});
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
  if(key==='cloudTargetGrowth')return assumption(changes.segmentGrowthYoY?.cloud??(originalPrior?.segments?.cloud>0?original.segments.cloud/originalPrior.segments.cloud-1:null),has(changes.segmentGrowthYoY,'cloud')?`用户情景覆盖：overrides[${period}].segmentGrowthYoY.cloud`:`初始同比：${origin('cloud')} ÷ ${priorPeriod}原始Cloud收入 − 1。`,'先计算Cloud目标，再按初始结构缩放未覆盖业务。单独覆盖业务后最终Cloud同比可能不同。',{unit:'ratio',evidenceKey:'cloud'});
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
  if(key==='dilutedShares')return calc(value,'年度稀释股数 = Σ（季度稀释股数 × 季度天数）÷ 年度天数',qs.map(x=>dep(key,x.dilutedShares,{period:x.period,label:x.period+'稀释股数（权重'+x.days+'天）'})),modelSource('quarter_rollup'),`全年天数${q.days}；季度股数按日加权，非简单平均。`);
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
  return calc(value,`${name(key)}收入 = 上年同期情景收入 ×（1 + 本期同比输入）`,[dep(key,prior.segments[key],{period:priorPeriod,label:'上年同期'+name(key)+'收入'}),dep(key+'GrowthYoY',growth,{label:name(key)+'同比输入',unit:'ratio',parameter:'segmentGrowthYoY',parameterKey:key,scale:100,editable:!options.baseline})],modelSource('calculateCase'),'金额编辑会转换为同比假设；此金额仍是同比递推的计算结果。');
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
