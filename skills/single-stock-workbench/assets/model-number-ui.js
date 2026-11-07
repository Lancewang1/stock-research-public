/* Inside WB: explain one observed model number, then trace its inputs. */
let modelNumberTarget=null,modelTrail=[],modelRestoring=false;
const modelDefaultItems={revenue:'revenue',margin:'grossMargin',depreciation:'depreciation',opex:'opex',profit:'operatingIncome',earnings:'eps',adjusted:'adjustedEps',cashflow:'cfo'};
function modelTopicForItem(key){
 if(['cogs','grossProfit','grossMargin','sharedCost'].includes(key))return 'margin';
 if(['rd','sm','ga','otherOpex','opex','opexRatio','rdRatio','smRatio','gaRatio'].includes(key))return 'opex';
 if(['depreciation','amortization','da','servers','otherAssets','depAllocation','depImpact'].includes(key))return 'depreciation';
 if(['operatingIncome','operatingMargin','cloudOperatingIncome','cloudCost','cloudResidual','manualCost','attribution'].includes(key))return 'profit';
 if(['sbc','sbcTaxBenefit','adjustedOperatingIncome','adjustedNetIncome','adjustedEps'].includes(key))return 'adjusted';
 if(key==='cfo')return 'cashflow';
 if(['otherIncome','pretaxIncome','tax','taxRate','netIncome','preferredDividends','dilutedEarnings','dilutedShares','eps','msEps'].includes(key))return 'earnings';
 return 'revenue';
}
function rememberModelSelection(){
 if(modelRestoring||!modelTopic||$('#modelDetail')?.hidden)return;
 modelTrail.push({topic:modelTopic,item:modelItem,period:modelNumberTarget?.period||(modelTopic==='cloud'?window.CloudApp?.getPeriod?.():null)||modelContextPeriod||profitPeriod,number:modelNumberTarget?{...modelNumberTarget}:null,scroll:$('#modelDetail .model-dialog')?.scrollTop||0});
}
function goModelBack(){
 const previous=modelTrail.pop();if(!previous){closeModelDetail();return;}
 if(modelTopic==='cloud'){
  const period=window.CloudApp?.getPeriod?.();
  if(period){if(!previous.number)previous.period=period;for(const entry of modelTrail)if(!entry.number)entry.period=period;}
 }
 modelRestoring=true;
 try{if(previous.number)openModelNumber(previous.number.key,previous.period,previous.number.options);else openModelDetail(previous.topic,previous.period,previous.item);$('#modelDetail .model-dialog').scrollTop=previous.scroll;}finally{modelRestoring=false;}
}
function modelBadge(info){return `<span class="model-number-badge is-${info.kind}" data-number-badge>${esc({assumption:'假设',calculation:'计算结果',actual:'历史实际',missing:'未提供'}[info.kind]||info.kind)}</span>`;}
function modelNumberButton(key,q,options={},display){
 const info=modelNumberLineage(key,q,options),parameter=options.parameter||'',baselineAttr=options.baseline?' data-number-baseline="true"':'';
 return `<button class="model-value-link" data-model-number="${esc(key)}" data-model-item="${esc(info.evidenceKey||key)}" data-model-period="${q.period}" data-number-kind="${info.kind}"${parameter?` data-number-parameter="${esc(parameter)}"`:''}${baselineAttr} aria-label="${esc((info.name||info.label||modelItemNames[key]||key)+' '+q.period+' '+(display||info.formattedValue||'')+'，查看来源')}"><span>${display??esc(info.formattedValue||'—')}</span>${modelBadge(info)}</button>`;
}
function openModelNumber(key,period,options={}){
 initializeModelShell();const selected=period||profitPeriod,q=(selected.length===4?result.annual:result.quarters).find(x=>x.period===selected);if(!q)return;
 if($('#modelDetail').hidden)modelReturnFocus=document.activeElement;
 rememberModelSelection();const info=modelNumberLineage(key,q,options);
 modelNumberTarget={key,period:selected,options:{...options}};modelItem=info.evidenceKey||key;modelTopic=modelTopicForItem(modelItem);
 if(CASE.profitModel?.quarters?.[selected]){profitPeriod=selected;activePeriod=selected;modelContextPeriod=null;}else modelContextPeriod=selected;
 renderProfitPanel();$('#modelDetail').hidden=false;document.body.classList.add('model-detail-open');filterModelDetail();$('#modelDetailClose').focus();$('#modelDetail .model-dialog').scrollTop=0;
}
function modelAssumptionCitations(rationale){
 const seen=new Set(),items=[];
 for(const ref of rationale.sourceRefs||[]){
  const raw=typeof ref==='string'?ref:ref?.id,id=sourceMap.has(raw)?raw:String(raw).split(':')[0],source=sourceMap.get(id);
  if(!source||seen.has(id))continue;seen.add(id);
  const date=source.publicationDate||source.date||source.asOf||'';
  const label=id==='ms'?'摩根士丹利（MS）· Alphabet盈利预测模型 · 2026-10-29':id==='local-googl-barc-20260724'||id==='barc'?'巴克莱（Barclays）· Alphabet模型 · 2026-07-24':(source.title||source.label||id)+(date?' · '+date:'');
  const web=/^https?:\/\//i.test(source.url||'')?source.url:null,local=/^file:\/\/\//i.test(source.localDocumentUrl||'')?source.localDocumentUrl:null;
  if(web||local)items.push(`<a class="assumption-citation" data-model-citation="${esc(id)}" data-assumption-citation="${esc(id)}" href="${esc(web||local)}" target="_blank" rel="noopener noreferrer">${esc(label)} · ${web?'查看原文':'打开原始模型（本地）'} ↗</a>`);
  else items.push(`<span class="assumption-citation-record"><button class="assumption-citation" data-model-citation="${esc(id)}" data-assumption-source-record="${esc(id)}" data-wb-source="${esc(id)}">${esc(label)} · 查看来源记录</button><small>当前未提供原文链接${source.kind?.includes('model')?'，原始模型未附在便携文件中':''}。</small></span>`);
 }
 return items.length?`<div class="assumption-citations">${items.join('')}</div>`:'';
}
function modelAssumptionPanel(key,q,options={},info=modelNumberLineage(key,q,options)){
 if(info.kind!=='assumption')return '';
 const parameter=info.parameter||options.parameter||'driver',inputKey=info.parameterKey||key,name=info.name||info.label||modelItemNames[key]||key;
 const cloudRevenueInput=parameter==='profit'&&/^(workspace|traditional|ai|tpu)Revenue$/.test(inputKey);
 const canEdit=info.editable&&q.kind!=='actual'&&!options.baseline&&!cloudRevenueInput;
 const rationale=modelAssumptionRationale(key,q,options,info),paragraphs=rationale.paragraphs||[];
 const unitLabel={ratio:'%',multiple:'倍',years:'年','USD mn':'百万美元','USD/share':'美元/股','million shares':'百万股'}[info.unit]||info.unit||'';
 const editor=canEdit?`<label class="assumption-control">${esc(name)} <span class="note">${esc(unitLabel)}</span><input aria-label="${esc(name)}" type="number" step="any" data-number-edit data-number-key="${esc(inputKey)}" data-number-parameter="${esc(parameter)}" data-number-period="${q.period}" data-scale="${info.scale||1}" value="${valid(info.value)?+(info.value*(info.scale||1)).toFixed(8):''}"></label>`:`<div class="assumption-fixed">${esc(info.formattedValue||'—')}${options.baseline?' · 初始基准，只读':''}</div>`;
 const cloudLink=cloudRevenueInput&&!options.baseline?`<p class="mi-note">这是当前已应用或导入的业务金额。修改客户、增长和交付假设并重新应用，即可更新这项收入。</p><button class="mi-link" data-model-topic="cloud" data-model-item="${inputKey.replace(/Revenue$/,'')}" data-model-period="${q.period}">修改这项收入的经营驱动 ›</button>`:'';
 const analysisKey=rationale.analysisKey||info.evidenceKey,analysis=analysisKey?`<button class="mi-link" data-assumption-analysis data-model-topic="${modelTopicForItem(analysisKey)}" data-model-item="${esc(analysisKey)}" data-model-period="${q.period}">${esc(rationale.analysisLabel||'我们的分析：'+(modelItemNames[analysisKey]||name))} ›</button>`:'';
 const sourceLabel=rationale.sourceLabel||'来源与分析依据',audit=`<details class="assumption-audit" data-assumption-audit><summary>模型取数明细</summary><p>${esc(info.source)}</p>${info.note?'<p>'+esc(info.note)+'</p>':''}${rationale.sourceRefs?.length?'<p>'+rationale.sourceRefs.map(esc).join('；')+'</p>':''}</details>`;
 return `<section class="model-assumption" data-assumption-key="${esc(inputKey)}" data-assumption-parameter="${esc(parameter)}" data-assumption-period="${q.period}"><header><h4>${esc(name)}</h4>${modelBadge(info)}</header>${editor}${cloudLink}<div class="assumption-rationale" data-assumption-rationale><h4>${esc(rationale.title||'假设依据')}</h4>${paragraphs.map(t=>'<p>'+esc(t)+'</p>').join('')}</div><div class="assumption-source" data-assumption-source><p>${options.baseline?'初始基准 · ':''}${esc(sourceLabel)}</p>${modelAssumptionCitations(rationale)}</div>${analysis}${audit}${canEdit?'<small>修改假设后，模型将重新计算相关收入和利润。</small>':''}</section>`;
}
function modelFormulaContext(key,q,options={}){
 const info=modelNumberLineage(key,q,options),deps=info.dependencies||[],seen=new Set();
 const inputs=deps.map(dep=>{
  const period=dep.period||q.period,row=(period.length===4?result.annual:result.quarters).find(x=>x.period===period);
  if(!row||!dep.key||dep.navigable===false)return `<li class="formula-fixed-input"><div><span>${esc(dep.label)}</span><p data-number-fixed-source>${esc(dep.clientSource||'本项采用原始资料中的对应数值，来源见本公式下方说明。')}</p>${modelAssumptionCitations(dep)}</div><span>${esc(dep.formattedValue||'原始资料数值')}</span></li>`;
  const opts={...(dep.options||{}),...(dep.parameter?{parameter:dep.parameter}:{}),...(options.baseline||dep.baseline?{baseline:true}:{})},child=modelNumberLineage(dep.key,row,opts);
  const identity=[period,child.parameter||opts.parameter||'',child.parameterKey||dep.key,!!opts.baseline].join(':');if(seen.has(identity))return '';seen.add(identity);
  if(child.kind==='assumption')return '<li class="formula-assumption-input">'+modelAssumptionPanel(dep.key,row,opts,child)+'</li>';
  return `<li class="formula-result-input"><span>${esc(dep.label)}</span>${modelNumberButton(dep.key,row,opts,dep.formattedValue)}</li>`;
 }).join('');
 const formula=info.kind==='calculation'?`<section class="number-calculation"><h3>计算公式</h3><p data-number-formula>${esc(info.formula)}</p>${info.explanation?`<p data-number-explanation>${esc(info.explanation)}</p>`:''}<p data-number-substitution>${esc(info.substitution)}</p></section>`:info.formula&&info.kind!=='assumption'?`<p class="mi-note" data-number-input-note>${esc(info.formula)}</p>`:'';
 const extra=key==='depreciation'&&q.profitDetail?`<section class="formula-asset-drivers"><h3>公式中的资产与年限假设</h3>${['serverLife','serverAssetMultiplier','otherLife','otherAssetMultiplier'].map(k=>modelAssumptionPanel(k,q,{parameter:'profit',...options})).join('')}</section>`:'';
 const sourceSummary=info.clientSource||(info.kind==='assumption'?'假设来源：'+(modelAssumptionRationale(key,q,options,info).sourceLabel||'上方所列来源与分析')+'。':'当前材料尚未提供这一项数据。');
 return `<div class="model-formula-context" data-model-formula-context="${esc(key)}" data-formula-kind="${info.kind}">${formula}${info.kind==='assumption'?modelAssumptionPanel(key,q,options,info):''}${inputs?`<section class="number-inputs"><h3>公式中的输入与假设</h3><ul>${inputs}</ul><p class="mi-note">点击其中的计算结果，可继续查看它的算法和数据来源。</p></section>`:''}${extra}<section class="number-source"><h3>数据来源</h3><p data-number-source>${options.baseline?'初始基准 · ':''}${esc(sourceSummary)}</p>${info.kind!=='assumption'?modelAssumptionCitations(info)+`<details class="assumption-audit"><summary>模型取数与计算口径</summary><p>${esc(info.source)}</p>${info.note?`<p>${esc(info.note)}</p>`:''}</details>`:''}</section></div>`;
}
function modelNumberContent(q){
 const {key,options}=modelNumberTarget,info=modelNumberLineage(key,q,options),name=info.name||info.label||modelItemNames[key]||key;
 const evidenceKey=info.evidenceKey||key,context={q,d:q.profitDetail,b:CASE.profitModel?.quarters?.[q.period],p:q.profitDetail?.parameters};
 const evidence=modelEvidenceSpecs[evidenceKey]?`<details class="number-more-evidence"><summary>详细分析、证据原文与来源定位</summary>${modelItemEvidence(evidenceKey,context)}</details>`:'';
 return `<article id="modelNumberProvenance" data-number-key="${esc(key)}" data-number-period="${q.period}" data-number-kind="${info.kind}"><div class="number-heading"><div><small>${q.period} · ${q.kind==='actual'?'历史实际':'预测'}${options.baseline?' · 初始基准':''}</small><h3>${esc(name)}</h3></div><div class="number-current">${esc(info.formattedValue||'—')}${modelBadge(info)}</div></div>${modelFormulaContext(key,q,options)}${evidence}<button class="mi-link" data-model-analysis data-model-topic="${modelTopicForItem(evidenceKey)}" data-model-item="${esc(evidenceKey)}" data-model-period="${q.period}">查看这一项的详细分析 ›</button></article>`;
}
function decorateModelInputs(host,q){
 for(const input of host.querySelectorAll('[data-profit],[data-model-earnings],[data-business-revenue]')){
  const parameter=input.hasAttribute('data-profit')?'profit':input.hasAttribute('data-model-earnings')?'driver':'',key=input.dataset.profit||input.dataset.modelEarnings||input.dataset.businessRevenue;
  const options=parameter?{parameter}:{},info=modelNumberLineage(key,q,options),label=input.closest('label');
  if(input.hasAttribute('data-business-revenue')||info.kind!=='assumption'){label?.remove();continue;}
  const canonicalKey=info.parameterKey||key,canonicalParameter=info.parameter||parameter;
  const existing=[...host.querySelectorAll('[data-number-edit]')].some(el=>el.dataset.numberKey===canonicalKey&&el.dataset.numberParameter===canonicalParameter&&el.dataset.numberPeriod===q.period);
  if(existing){label?.remove();continue;}
  label?.insertAdjacentHTML('beforebegin',modelAssumptionPanel(key,q,options,info));label?.remove();
 }
 host.querySelectorAll('.mi-assumptions').forEach(node=>{if(!node.querySelector('input,button,.model-assumption'))node.remove();});
}
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-model-number]');if(button){event.preventDefault();openModelNumber(button.dataset.modelNumber,button.dataset.modelPeriod,{...(button.dataset.numberParameter?{parameter:button.dataset.numberParameter}:{}),...(button.dataset.numberBaseline?{baseline:true}:{})});return;}
 if(event.target.closest('[data-model-back]')){goModelBack();return;}if(event.target.closest('[data-model-home]'))closeModelDetail();
});
document.addEventListener('change',event=>{
 const input=event.target.closest('[data-number-edit]');if(!input)return;
 try{
  if(!input.value.trim())throw new Error('假设不可留空');const value=Number(input.value)/Number(input.dataset.scale||1);if(!valid(value))throw new Error('假设必须是有限数字');
  const period=input.dataset.numberPeriod,key=input.dataset.numberKey,parameter=input.dataset.numberParameter,next=clone(overrides);next[period]??={};
  if(parameter==='profit'){next[period].profit??={};next[period].profit[key]=value;}
  else if(parameter==='segmentGrowthYoY'){
   const segment=key.replace(/GrowthYoY$/,'');if(period.length===4){applyAnnual(period,'segmentGrowthYoY',value,segment);return;}
   next[period].segmentGrowthYoY??={};next[period].segmentGrowthYoY[segment]=value;if(segment==='cloud'&&next[period].profit)for(const k of ['workspace','traditional','ai','tpu'])delete next[period].profit[k+'Revenue'];
  }else{
   if(period.length===4){applyAnnual(period,key,value);return;}
   if(['rdRatio','smRatio','gaRatio'].includes(key))delete next[period].opexRatio;if(key==='opexRatio')for(const k of ['rdRatio','smRatio','gaRatio'])delete next[period][k];next[period][key]=value;
  }
  commit(next,'数值假设情景');
 }catch(err){error(err.message);}
});
