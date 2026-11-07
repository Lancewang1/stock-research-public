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
function modelNumberContent(q){
 const {key,options}=modelNumberTarget,info=modelNumberLineage(key,q,options),name=info.name||info.label||modelItemNames[key]||key;
 const deps=(info.dependencies||[]).map(dep=>{
  const period=dep.period||q.period,row=(period.length===4?result.annual:result.quarters).find(x=>x.period===period);
  if(!row||!dep.key||dep.navigable===false)return `<li><span>${esc(dep.label)}</span><span>${esc(dep.formattedValue||'来源固定值')}</span></li>`;
  return `<li><span>${esc(dep.label)}</span>${modelNumberButton(dep.key,row,{...(dep.options||{}),...(dep.parameter?{parameter:dep.parameter}:{}),...(options.baseline||dep.baseline?{baseline:true}:{})},dep.formattedValue)}</li>`;
 }).join('');
 const canEdit=info.editable&&q.kind!=='actual'&&!options.baseline,parameter=info.parameter||options.parameter||'driver',inputKey=info.parameterKey||key;
 const editor=canEdit?`<section class="number-edit"><h3>修改这一项假设</h3><label>${esc(name)} <span class="note">${esc(info.unit==='ratio'?'%':info.unit||'')}</span><input aria-label="${esc(name)}" type="number" step="any" data-number-edit data-number-key="${esc(inputKey)}" data-number-parameter="${esc(parameter)}" data-number-period="${q.period}" data-scale="${info.scale||1}" value="${valid(info.value)?+(info.value*(info.scale||1)).toFixed(8):''}"></label><p class="mi-note">修改后重算关联结果，并保存为当前用户情景。</p></section>`:'';
 const formula=info.kind==='calculation'?`<section class="number-calculation"><h3>计算公式</h3><p data-number-formula>${esc(info.formula)}</p><p data-number-substitution>${esc(info.substitution)}</p></section>`:info.formula?`<p class="mi-note" data-number-input-note>${esc(info.formula)}</p>`:'';
 const evidenceKey=info.evidenceKey||key,context={q,d:q.profitDetail,b:CASE.profitModel?.quarters?.[q.period],p:q.profitDetail?.parameters};
 const evidence=modelEvidenceSpecs[evidenceKey]?`<details class="number-more-evidence"><summary>进一步查看该项证据与原文定位</summary>${modelItemEvidence(evidenceKey,context)}</details>`:'';
 const topic=modelTopicForItem(evidenceKey);
 return `<article id="modelNumberProvenance" data-number-key="${esc(key)}" data-number-period="${q.period}" data-number-kind="${info.kind}"><div class="number-heading"><div><small>${q.period} · ${q.kind==='actual'?'历史实际':'预测'}${options.baseline?' · 初始基准':''}</small><h3>${esc(name)}</h3></div><div class="number-current">${esc(info.formattedValue||'—')}${modelBadge(info)}</div></div>${formula}<section class="number-source"><h3>${info.kind==='assumption'?'假设来源与依据':info.kind==='actual'?'历史数据来源':'数字来源'}</h3><p data-number-source>${esc(info.source)}</p>${info.note?`<p data-number-analysis>${esc(info.note)}</p>`:''}</section>${deps?`<section class="number-inputs"><h3>本次计算使用的输入</h3><ul>${deps}</ul></section>`:''}${editor}${evidence}<button class="mi-link" data-model-analysis data-model-topic="${topic}" data-model-item="${esc(evidenceKey)}" data-model-period="${q.period}">查看这一项分析与相关假设 ›</button></article>`;
}
function decorateModelInputs(host,q){
 for(const input of host.querySelectorAll('[data-profit],[data-model-earnings],[data-business-revenue]')){
  if(input.nextElementSibling?.classList.contains('number-input-source'))continue;
  const parameter=input.hasAttribute('data-profit')?'profit':input.hasAttribute('data-model-earnings')?'driver':'',key=input.dataset.profit||input.dataset.modelEarnings||input.dataset.businessRevenue;
  const options=parameter?{parameter}:{},info=modelNumberLineage(key,q,options),button=document.createElement('button');
  button.type='button';button.className='number-input-source';button.dataset.modelNumber=key;button.dataset.modelPeriod=q.period;button.dataset.numberKind=info.kind;if(parameter)button.dataset.numberParameter=parameter;
  button.innerHTML=modelBadge(info)+'<span>查看此数来源</span>';input.insertAdjacentElement('afterend',button);
 }
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
