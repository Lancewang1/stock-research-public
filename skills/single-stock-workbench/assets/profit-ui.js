/* Inside WB: shared scenario state and persistence. */
let profitPeriod='2027Q1';
function renderProfitPanel(){
 let host=$('#wbProfit');if(!host){host=document.createElement('div');host.id='wbProfit';host.className='wb-extra';$('#tblwrap').insertAdjacentElement('beforebegin',host);}
 const period=modelNumberTarget?.period||modelContextPeriod||profitPeriod,q=(period.length===4?result.annual:result.quarters).find(x=>x.period===period);if(!q)return;
 const d=q.profitDetail,b=CASE.profitModel?.quarters?.[period],p=d?.parameters;
 const open=new Set([...host.querySelectorAll('details[open]')].map(modelDisclosureKey));
 const dialog=$('#modelDetail .model-dialog'),scroll=dialog?.scrollTop||0;
 const active=document.activeElement,focusIdentity=active?.hasAttribute('data-number-edit')?[active.dataset.numberKey,active.dataset.numberParameter,active.dataset.numberPeriod]:null;
 host.innerHTML=`<div class="mi-period"><label>查看期间 <select id="wbProfitPeriod" aria-label="利润模型季度">${[...result.quarters,...result.annual.filter(x=>x.period>='2026')].map(x=>`<option value="${x.period}" ${x.period===period?'selected':''}>${x.period}${x.kind==='actual'?'A':'E'}</option>`).join('')}</select></label><span>${q.kind==='actual'?'历史实际值·只读':q.modelType==='annual_extension'?'年度延展·编辑本年输入假设':period.length===4?'年度汇总·进入预测季度修改假设':'结果由公式计算·在下方修改驱动假设'}</span></div>${modelNumberTarget?modelNumberContent(q):'<div id="modelItemTree">'+modelItemsContent(q,d,b,p)+'</div>'}`;
 if(!modelNumberTarget)decorateModelInputs(host,q);
 host.querySelectorAll('details').forEach(x=>x.open=open.has(modelDisclosureKey(x)));
 renderModelHome();if(dialog)dialog.scrollTop=scroll;
 if(focusIdentity){const input=[...host.querySelectorAll('[data-number-edit]')].find(x=>x.dataset.numberKey===focusIdentity[0]&&x.dataset.numberParameter===focusIdentity[1]&&x.dataset.numberPeriod===focusIdentity[2]);input?.focus({preventScroll:true});}
}
document.addEventListener('change',event=>{
  if(event.target.id==='wbProfitPeriod'){const selected=event.target.value;if(modelNumberTarget)modelNumberTarget.period=selected;if(CASE.profitModel.quarters[selected]){profitPeriod=selected;activePeriod=selected;modelContextPeriod=null;}else modelContextPeriod=selected;renderProfitPanel();renderGdRows();return;}
  const el=event.target.closest('[data-profit]');if(!el)return;
  try{if(!el.value.trim())throw new Error('参数不可留空');const next=clone(overrides);next[profitPeriod]??={};next[profitPeriod].profit??={};next[profitPeriod].profit[el.dataset.profit]=Number(el.value)/Number(el.dataset.scale);commit(next,'Cloud分业务盈利情景');}catch(e){error(e.message);renderProfitPanel();}
});
document.addEventListener('click',event=>{
  if(['wbProfitFitMS','wbProfitRestoreMS'].includes(event.target.id)){
    try{const next=clone(overrides);if(event.target.id==='wbProfitRestoreMS')delete next[profitPeriod];else{const q=result.quarters.find(x=>x.period===profitPeriod),solution=WBM.solveMSProfit(CASE.profitModel.quarters[profitPeriod],q.profitDetail.parameters);if(!solution.feasible)throw new Error('当前条件下无可行成本倍率');next[profitPeriod]??={};next[profitPeriod].profit={...next[profitPeriod].profit,...solution.changes};}commit(next,'MS隐含假设 · 用户情景');}catch(e){error(e.message);}return;
  }
  if(!['wbProfitNoResidual','wbProfitClearMargins'].includes(event.target.id))return;
  try{const next=clone(overrides);next[profitPeriod]??={};if(event.target.id==='wbProfitNoResidual'){next[profitPeriod].profit??={};next[profitPeriod].profit.cloudUnallocatedCost=0;}else for(const k of ['grossMargin','opexRatio','rdRatio','smRatio','gaRatio'])delete next[profitPeriod][k];commit(next,'Cloud盈利敏感性');}catch(e){error(e.message);}
});
