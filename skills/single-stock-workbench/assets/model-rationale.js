/* Inside WB. Client-facing explanations; source IDs retain the detailed citations. */
function modelAssumptionRationale(inputKey,q,options={},providedInfo){
 const info=providedInfo||modelNumberLineage(inputKey,q,options),period=q?.period||'';
 const research=typeof RESEARCH==='undefined'?{}:RESEARCH,has=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k),finite=v=>typeof v==='number'&&Number.isFinite(v);
 const original=(period.length===4?CASE.annualBaselines:CASE.quarters)?.find(x=>String(x.period)===period)||{},previousPeriod=String(Number(period.slice(0,4))-1)+period.slice(4);
 const previous=(period.length===4?CASE.annualBaselines:CASE.quarters)?.find(x=>String(x.period)===previousPeriod);
 const base=CASE.profitModel?.quarters?.[period],bp=base?.parameters||{},changes=options.baseline?{}:overrides[period]||{};
 let key=String(inputKey||''),parameter=options.parameter||info.parameter||'',segment=null;
 if(key==='cloudCost')key='cloudCashCostMultiplier';
 if(key==='cloudResidual')key='cloudUnallocatedCost';
 if(key==='cloudTargetGrowth'){segment='cloud';parameter='segmentGrowthYoY';}
 const growth=key.match(/^(search|network|youtube|cloud|subs|bets)GrowthYoY$/);
 if(growth){segment=growth[1];parameter='segmentGrowthYoY';}
 if(parameter==='segmentGrowthYoY')segment=segment||info.parameterKey||key.replace(/GrowthYoY$/,'');
 const business=key.match(/^business\.([^.]+)\.revenue$/);
 if(business){if(['workspace','traditional','ai','tpu'].includes(business[1])){key=business[1]+'Revenue';parameter='profit';}else if(['youtubeSubs','otherSubs'].includes(business[1])){key='youtubeSubsShare';parameter='profit';}else{segment=business[1];parameter='segmentGrowthYoY';}}
 const name=k=>modelLineageClientText((typeof modelItemNames!=='undefined'&&modelItemNames[k])||(typeof modelLineageParameterLabels!=='undefined'&&modelLineageParameterLabels[k])||(typeof modelLineageMetricLabels!=='undefined'&&modelLineageMetricLabels[k])||(k===key?info.label:'相关项目'));
 const format=(v,k=key)=>modelLineageFormat(v,modelLineageUnit(k)).replace('USD mn','百万美元').replace('USD/share','美元/股'),valueText=(v,k=key)=>finite(v)?format(v,k):'原模型所列数值';
 const ms='摩根士丹利2026年10月29日模型',barc='巴克莱2026年7月24日模型';
 const paragraphs=[],sourceRefs=[];
 let sourceLabel='我们的研究设定',sourceType='research_assumption',analysisKey=null,analysisLabel=null;
 const cite=refs=>{for(const ref of refs||[])if(ref&&!sourceRefs.includes(ref))sourceRefs.push(ref);};
 const add=(text,refs=[])=>{if(text)paragraphs.push(text);cite(refs);};
 const from=(label,type,text,refs=[])=>{sourceLabel=label;sourceType=type;add(text,refs);};
 const analysis=(text,k=info.evidenceKey||segment||key,refs=[])=>{analysisKey=k;analysisLabel='我们的分析：'+name(k);add('我们的分析：'+text,refs);};
 const exactRefs=item=>{const rows=typeof modelEvidenceSpecs==='undefined'?{}:modelEvidenceSpecs[item]?.rows||{};return (original.sourceRefs||[]).filter(ref=>{const m=String(ref).match(/^ms:([^!]+)![A-Z]+(\d+)$/);return m&&rows[m[1]]?.includes(Number(m[2]));});};
 const msColumn=String((original.sourceRefs||[]).find(x=>/^ms:Model![A-Z]+16$/.test(x))||'').match(/!([A-Z]+)16$/)?.[1];
 const conditionalSource=id=>(research.sources||[]).some(x=>x.id===id);
 const finish=(title='假设依据')=>{
  const overridden=parameter==='segmentGrowthYoY'?has(changes.segmentGrowthYoY,segment):parameter==='profit'?has(changes.profit,key):has(changes,key);
  const chosen=parameter==='segmentGrowthYoY'?changes.segmentGrowthYoY?.[segment]:parameter==='profit'?changes.profit?.[key]:changes[key];
  const basisSourceLabel=sourceLabel,basisSourceType=sourceType;
  if(overridden){paragraphs.unshift(`当前采用您设置的${finite(chosen)?valueText(chosen,parameter==='segmentGrowthYoY'?'growth':key):'数值'}。以下是原假设的依据，供比较参考。`);sourceLabel='用户自设情景';sourceType='user_scenario';}
  return {title,paragraphs,sourceRefs,sourceLabel,sourceType,basisSourceLabel,basisSourceType,analysisKey,analysisLabel};
 };
 if(!q){from('资料暂缺','missing','尚未找到这一期间的假设依据。');return finish();}
 if(info.kind==='missing'){from('本期资料暂缺','missing',info.clientSource||'本期没有这一项目的可用数据。');if(info.explanation)add(info.explanation);return finish('数据说明');}
 if(q.kind==='actual'){
  const verified=info.sourceRefs?.includes('sec-companyfacts');
  from(verified?'Alphabet公司披露与历史资料':'历史财务资料',verified?'company_filing':'historical_source',info.clientSource||`${period}保留已整理的历史财务数值。`,info.sourceRefs||exactRefs(info.evidenceKey||key));if(info.explanation)add(info.explanation);return finish('数据来源');
 }
 if(key==='msEps'){
  from(ms,'broker_model',`${period}的原始年度每股收益采用${ms}的${valueText(info.value)}预测。`,['ms',...exactRefs('msEps')]);
  analysis('这项数值保留卖方原年度结果，方便与本模型按季度利润和加权股数计算的每股收益比较；改变经营假设不会改写它。','msEps');return finish();
 }
 if(q.modelType==='quarter_rollup'){
  from('本模型季度汇总','model_calculation',`${period}年度结果由各季度财务数据计算。调整尚未公布季度的假设后，全年结果会随之更新。`);
  if(segment)add('全年收入同比按本年与上年全年收入比较，各季度收入则按上年同季收入和该季增长假设计算。');
  else if(key==='dilutedShares')add('年度稀释股数按各季度天数加权，用于计算全年EPS。');
  else if(key==='taxRate')add('年度有效税率等于全年所得税除以全年税前利润。');
  return finish('计算依据');
 }
 if(segment){
  const initial=previous?.segments?.[segment]>0?original.segments?.[segment]/previous.segments[segment]-1:null;
  from(ms,'broker_model',`按${ms}的收入预测测算，${period}的${name(segment)}收入同比为${valueText(initial,'growth')}，我们以此作为增长假设的起点。`,['ms',...exactRefs(segment)]);
  if(segment==='search'){
   if(conditionalSource('recent-citizens'))analysis('Alphabet 2026Q3付费点击增长8%、单次点击价格增长4%，说明当期量价均在增长；Citizens则关注AI搜索的变现效率。因此，判断后续收入时，需要同时观察查询量和每次查询带来的广告收入。上述数据用于检验增长假设，不直接决定本期增速。','search',['recent-10q-business','recent-citizens']);
   else analysis('搜索收入取决于查询量、商业查询占比和广告变现。AI使用量增长不一定带来同等收入增长，当前增速仍以摩根士丹利预测为起点。','search',['recent-10q-business']);
  }else if(segment==='youtube')analysis('广告收入与观看量、广告展示和价格有关；付费订阅另计入订阅业务。评估广告增长时，应将两类收入分开。','youtube',['recent-10q-business']);
  else if(segment==='network')analysis('Network依赖合作网站和应用的广告流量，与Google自有搜索的变现及分成不同，因此单独采用增长假设。','network',['recent-10q-business']);
  else if(segment==='subs')analysis('这项收入包括YouTube订阅、其他订阅、平台和设备。我们先预测合计，再拆分YouTube订阅，避免重复计算；单一产品的增长不能代表全部业务。','subs',['recent-10q-business']);
  else if(segment==='bets')analysis('Other Bets包含多项业务，不能用Waymo一家的进展代表整体增长。目前仍采用摩根士丹利对该分部的预测。','bets',['recent-10q-business']);
  else if(segment==='cloud'){
   analysis('订单要经过交付、验收和履约才形成收入。我们分别研究企业服务、AI客户和TPU交付；TPU的具体合同与分类仍需核对，多年订单金额不能直接算作本季收入。','cloud',['contracts-googl-revenue-10q-20261029']);
   add('修改这里的Cloud总增长假设，会按原业务比例重新计算四项收入。若需保留客户与交付明细，请在Cloud经营驱动中修改并应用。');
  }
  return finish();
 }
 const profitKeys=new Set([...Object.keys(bp),...['search','network','youtube','youtubeSubs','otherSubs','bets','workspace','traditional','ai','tpu'].map(k=>k+'GrossMargin')]);
 if(parameter==='profit'||profitKeys.has(key)){
  parameter='profit';const initial=bp[key],initialText=valueText(initial);
  if(key.endsWith('GrossMargin')){
   const bkey=key.slice(0,-11);
   from('我们的业务成本测算','model_calculation',`${name(bkey)}的标准化毛利率由我们的业务成本测算得出，包含现金成本及原有折旧、摊销和股权激励费用分配。`,['ms']);
   analysis('这项业务没有独立披露的完整毛利率。调整成本率可以观察毛利变化；若您此前已设定毛利率，则按该设定推算现金成本。',bkey);
  }else if(key.endsWith('Revenue')&&['workspace','traditional','ai','tpu'].includes(key.slice(0,-7))){
   const bkey=key.slice(0,-7);
   if(['workspace','traditional'].includes(bkey)){
    from('摩根士丹利、巴克莱模型及我们的拆分','research_assumption',`${name(bkey)}的初始收入为${initialText}：我们以${ms}的Cloud总收入为基础，扣除AI和TPU收入后，再参考${barc}拆分企业服务。`,['ms','local-googl-barc-20260724']);
    analysis('公司没有披露足以验证当季Workspace与传统GCP收入的完整明细，这个拆分是我们的估算。',bkey);
   }else if(bkey==='ai'){
    from('我们的客户收入测算','research_assumption',`AI云服务的初始收入为${initialText}，来自我们对客户算力预算、Google份额、可用容量和计费条件的测算。`);
    analysis('Anthropic的Google合作支持需求判断，但其同时向AWS和Azure采购。客户总预算和宣布容量不能全部计为Google收入。','ai',['chain-anthropic-google-20260406','chain-anthropic-aws-20260420','contracts-msft-partnership-20251118']);
   }else{
    from('我们的TPU交付测算','research_assumption',`TPU交付的初始收入为${initialText}，由我们假设的交付量、价格和当期收入确认比例计算。`,['local-googl-barc-20260724']);
    analysis('交付、验收与收入确认可能发生在不同时间，需按具体合同判断；同一批TPU不应同时计入设备收入和云服务收入。','tpu',['contracts-googl-revenue-10q-20261029']);
   }
  }else if(key==='searchTacRate'||key==='networkTacRate'){
   const search=key==='searchTacRate',subject=search?'搜索分销':'Network',businessKey=search?'search':'network';
   from(ms,'broker_model',`按${ms}的${subject}成本与收入测算，${period}的TAC率约为${initialText}。这是我们根据该模型计算的比率。`,['ms',`ms:Expense Drivers!${msColumn}${search?'25':'45'}`,...exactRefs(businessKey)]);
   analysis(`${search?'TAC是Google为获取搜索流量支付的分销费用':'TAC是Google向广告合作伙伴支付的流量分成'}。我们用这一比例估计收入增长带来的相关成本；后续可根据合作协议、流量来源和分成变化调整。`,businessKey);
  }else if(['youtubeContentRate','youtubeSubsShare','nflContentCost'].includes(key)){
   if(key==='youtubeContentRate'){
    from(ms,'broker_model',`按${ms}测算，YouTube可变内容分成率为${initialText}：从总内容成本中扣除NFL费用，再除以广告与订阅收入合计。`,['ms']);
    analysis('我们把随收入变化的内容分成与NFL固定费用分开，便于观察收入增长对利润的影响。','youtube');
   }else if(key==='youtubeSubsShare'){
    from(ms,'broker_model',`按${ms}的收入预测测算，YouTube订阅占“订阅、平台与设备”收入的${initialText}。`,['ms',...exactRefs('subs')]);
    analysis('这一比例用于将YouTube订阅与其他产品分开，同时保持合计收入一致；它不是公司单独披露的当期份额。','youtubeSubs');
   }else{
    const missing=/NFL.*缺失/.test(base?.nonCloudCostSource||'');
    from(ms,missing?'model_calculation':'broker_model',missing?`${ms}未提供${period}完整的NFL费用，我们按其总内容成本扣除其他内容分成，估得${initialText}。该估计不代表已确认NFL当季没有成本。`:`${period}的NFL费用采用${ms}的${initialText}。`,['ms']);
    analysis('NFL费用单列，不随广告或订阅收入同比例变化；在我们的业务拆分中，它计入YouTube订阅成本。','youtubeSubs');
   }
  }else if(['workspaceDirectRate','traditionalDirectRate','tpuDirectRate'].includes(key)){
   const bkey=key.replace('DirectRate','');
   from('我们的成本假设','research_assumption',`${name(bkey)}的参考现金直接成本率设为${initialText}，这是我们的研究假设，并非卖方报告给出的独立费率。`);
   analysis('不同业务分别设定成本率，可以比较收入结构变化对利润的影响。折旧、摊销和股权激励费用另行计算，因此这里不是完整营业成本率。',bkey);
   if(bkey==='tpu')add('巴克莱旧模型中的25%指营业利润率，不能直接作为这里的毛利率或成本率。',['local-googl-barc-20260724']);
  }else if(/^(workspace|traditional|ai|tpu)OpexRate$/.test(key)){
   const bkey=key.replace('OpexRate','');
   from('我们的费用假设','research_assumption',`${name(bkey)}的参考现金经营费用率设为${initialText}，由我们用于情景测算；现有材料没有给出这项业务的独立费率。`);
   analysis('这项假设估计研发、销售和管理的现金投入，折旧与股权激励费用另计。业务投入增加或运营效率变化时，可以据此调整。',bkey);
  }else if(['aiThirdPartyShare','aiThirdPartyCostRate','aiOwnOperatingRate'].includes(key)){
   const subject={aiThirdPartyShare:'AI收入中使用第三方算力的份额',aiThirdPartyCostRate:'第三方算力对应收入的采购成本率',aiOwnOperatingRate:'自有算力对应收入的现金运营成本率'}[key];
   from('我们的AI成本假设','research_assumption',`${subject}设为${initialText}，属于我们的研究假设，现有采购资料不足以直接验证这一比例。`);
   if(key==='aiThirdPartyShare')analysis('巴克莱模型单列了第三方算力费用，因此我们也将外部采购与自有运营分开测算；具体份额仍需客户和采购合同验证。','ai',['local-googl-barc-20260724']);
   else if(key==='aiThirdPartyCostRate')analysis('第三方采购费率应结合租用价格、转售价格和合同期限判断。这里提供可调整的起点，巴克莱资料仅支持单列这类成本。','ai',['local-googl-barc-20260724']);
   else analysis('自有运营成本只估计现金支出，设备折旧和股权激励费用另计，因此该比例不能直接理解为AI业务的完整利润率。','ai');
  }else if(key==='serverLife'||key==='otherLife'){
   from(barc,'broker_model',`${key==='serverLife'?'服务器':'其他资产'}使用年限采用${barc}的${initialText}。`,['local-googl-barc-20260724']);
   analysis('我们按资产类别分别计算折旧。实际年限会受技术更新、投产与退役安排影响，可据此调整；延长年限会降低当期折旧，缩短年限则相反。','depreciation');
  }else if(key==='serverAssetMultiplier'||key==='otherAssetMultiplier'){
   from('我们的资产规模假设','research_assumption',`${key==='serverAssetMultiplier'?'服务器':'其他资产'}规模系数初始为${initialText}，表示沿用我们根据摩根士丹利折旧预测和巴克莱资产结构估算的规模。`,['ms','local-googl-barc-20260724']);
   analysis('这个规模是用于折旧测算的估计，不是公司披露的资产原值。新增投产或退役信息可以支持调整，但设备订单不等于已经投产。','depreciation');
  }else if(['cloudDepShare','workspaceDepShare','traditionalDepShare'].includes(key)){
   const subject={cloudDepShare:'集团折旧与摊销分配给Cloud的比例',workspaceDepShare:'Cloud折旧与摊销分配给Workspace的比例',traditionalDepShare:'Cloud折旧与摊销分配给传统GCP的比例'}[key];
   from('我们的折旧分配假设','research_assumption',`${subject}设为${initialText}，由我们按业务用途进行研究分配，公司未披露这一精确比例。`);
   analysis('调整比例改变各业务承担的成本，集团折旧总额保持不变。Cloud分给Workspace与传统GCP后的剩余部分计入AI，自有云设备折旧不分配给独立TPU交付。','da');
  }else if(key==='depreciationCogsShare'){
   from(barc,'broker_model',`计入营业成本的折旧与摊销比例采用${barc}的${initialText}。`,['local-googl-barc-20260724']);
   analysis('其余部分计入研发费用。调整比例会改变毛利与研发费用的分布，但不改变集团折旧总额。','da');
  }else if(key==='sbcMultiplier'){
   from('摩根士丹利预测及我们的情景系数','research_assumption',`股权激励费用规模系数初始为${initialText}，即采用${ms}对${period}的费用预测。`,['ms',`ms:Model!${msColumn}44`]);
   analysis('若人员规模或激励安排发生变化，可调整这项系数。股权激励已计入GAAP成本费用，仅在调整后盈利中加回。','sbc');
  }else if(key==='sbcTaxBenefitRate'){
   from(ms,'broker_model',`按${ms}的股权激励费用及相关税收影响测算，本期税效应率为${initialText}。`,['ms',`ms:Model!${msColumn}80`,`ms:Model!${msColumn}44`]);
   analysis('这项比例用于计算股权激励的税后加回金额，与集团有效税率不同，不能互相替代。','sbcTaxBenefit');
  }else if(key==='cloudSbcShare'){
   from('我们的股权激励分配假设','research_assumption',`我们将集团股权激励费用的${initialText}分配给Cloud；该比例参考${ms}中Cloud占集团收入的比重。`,['ms',...exactRefs('cloud'),...exactRefs('revenue')]);
   analysis('收入占比是缺少业务费用明细时的估计办法。若取得Cloud的人员或激励费用信息，应据此调整。','sbc');
  }else if(key==='cloudUnallocatedCost'){
   from('我们的额外成本假设','research_assumption',`Cloud额外未分配成本初始设为${initialText}：目前没有另加一笔独立成本或收益的依据。`);
   analysis('Cloud利润已通过收入、现金成本、折旧和股权激励计算。只有识别出额外项目时才需调整，正值增加成本，负值表示收益。','cloudOperatingIncome');
  }else if(key==='cloudCashCostMultiplier'){
   from('摩根士丹利利润预测与我们的反推计算','model_calculation',`以${ms}的Cloud营业利润为目标，我们测算出的初始现金成本倍率为${initialText}。它是计算结果，不是摩根士丹利直接给出的费率。`,['ms']);
   analysis('在收入结构、折旧和股权激励假设不变时，统一调整现金成本，使Cloud利润与该卖方预测一致。改变其他假设后，只有选择重新计算并应用，才更新这项倍率。','cloudOperatingIncome');
  }else{
   from(info.sourceRefs?.includes('ms')?ms:'本项来源说明',info.sourceRefs?.includes('ms')?'broker_model':'research_assumption',info.clientSource||'本项尚未整理可核验的独立来源，不能认定为卖方或公司给出的假设。',info.sourceRefs||[]);
   if(info.explanation)add(info.explanation);
  }
  return finish(info.kind==='calculation'?'测算依据':'假设依据');
 }
 if(['taxRate','otherIncome','dilutedShares','preferredDividends'].includes(key)){
  parameter='driver';const initial=original[key]??(key==='preferredDividends'?0:null);
  if(key==='preferredDividends'){
   from('我们的股息假设','research_assumption','优先股股息初始按0计。摩根士丹利模型没有单独列示这一项目，我们暂不假设新增支付。',['ms']);
   analysis('净利润减去优先股股息后得到普通股盈利分子；若有新的股息或转换安排，应相应调整。','preferredDividends',['recent-10q-income']);
  }else{
   from(ms,'broker_model',`${period}的${name(key)}采用${ms}的${valueText(initial)}预测。`,['ms',...exactRefs(key)]);
   if(key==='taxRate')analysis('税率将税前利润连接到净利润。投资损益、税收优惠及业务地区变化都可能影响有效税率，因此以卖方预测为起点，避免直接延用某个历史季度。','taxRate',['recent-10q-income','recent-10q-investments']);
   else if(key==='otherIncome')analysis('投资估值变动会明显影响净利润，故将其与主营营业利润分开看待。我们目前沿用卖方预测，不把单季大额投资收益延续到以后各季。','otherIncome',['recent-10q-investments']);
   else analysis('稀释股数决定EPS的分母，受回购、员工股权激励及可转证券影响。若这些安排发生变化，可调整本项；季度股数与年末实际股数并不相同。','dilutedShares',['recent-10q-income']);
  }
  return finish();
 }
 if(['grossMargin','opexRatio','rdRatio','smRatio','gaRatio','otherOpexRatio'].includes(key)){
  parameter='driver';const amount={grossMargin:'grossProfit',opexRatio:'opex',rdRatio:'rd',smRatio:'sm',gaRatio:'ga',otherOpexRatio:'otherOpex'}[key];
  if(q.modelType==='annual_extension'){
   const numerator=amount==='grossProfit'?original.revenue-original.cogs:amount==='otherOpex'?original.opex-original.rd-original.sm-original.ga:original[amount],initial=original.revenue?numerator/original.revenue:null;
   from(ms,'broker_model',`按${ms}的年度收入与${name(amount)}测算，${period}的${name(key)}初始为${valueText(initial)}。该年尚无季度业务拆分，因此使用年度比例预测。`,['ms',...exactRefs(amount)]);
  }else from('我们的业务利润测算','model_calculation',`${name(key)}由业务收入与成本费用计算，相关假设变化后会自动更新。`,exactRefs(amount));
  const reason={grossMargin:'收入结构、现金成本、折旧和股权激励共同影响毛利率，应分别检查这些驱动。',opexRatio:'经营费用包括研发、销售、管理及其他费用，比较整体费用率时仍需查看分项投入。',rdRatio:'研发费用含部分折旧与股权激励，不能全部理解为现金研发投入。',smRatio:'销售费用需要结合获客投入、销售团队和业务组合判断。',gaRatio:'管理费用可能受到诉讼、重组等项目影响，判断效率变化时应将这些事项分开。',otherOpexRatio:'这一项保留尚未明确归入研发、销售或管理的费用差额。'}[key];
  analysis(reason,amount);return finish(info.kind==='calculation'?'测算依据':'假设依据');
 }
 if(info.kind==='assumption'){
  const refs=info.sourceRefs||exactRefs(info.evidenceKey||key),fromMS=refs.includes('ms')||refs.some(x=>String(x).startsWith('ms:'));
  from(fromMS?ms:'本项研究设定',fromMS?'broker_model':'research_assumption',info.clientSource||`${period}的${info.label||name(key)}暂缺可核验的来源说明。`,refs);
  if(info.explanation)add(info.explanation);
 }else{
  from('我们的测算','model_calculation',info.clientSource||'本项由当前列示的收入、成本与费用假设测算。',info.sourceRefs||[]);
  if(info.explanation)add(info.explanation);
 }
 return finish(info.kind==='calculation'?'计算依据':'假设依据');
}
