/* User workflows against the real inline scripts. DOM/canvas are mocked, not visual QA. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const {JSDOM, VirtualConsole} = require(path.join(process.env.STOCK_DASHBOARD_QA_MODULES || path.join(os.tmpdir(), 'stock-dashboard-qa', 'node_modules'), 'jsdom'));
const html = fs.readFileSync(process.argv[2] || path.join(__dirname, '../outputs/googl-dashboard.html'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));

function mount(saved = {}) {
  const errors = [], virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error.stack || String(error)));
  const context = new Proxy({measureText:t=>({width:String(t).length*7}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),setLineDash(){},getLineDash:()=>[],getTransform:()=>({})},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
  const dom = new JSDOM(html, {runScripts:'dangerously',url:'http://localhost/model-item-test',pretendToBeVisual:true,virtualConsole,beforeParse(window){
    window.structuredClone = global.structuredClone || plain;
    window.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
    window.HTMLCanvasElement.prototype.getContext=()=>context;
    window.scrollTo=()=>{};window.HTMLElement.prototype.scrollIntoView=()=>{};
    window.HTMLElement.prototype.getBoundingClientRect=function(){return {x:0,y:0,left:0,top:0,right:1100,bottom:440,width:1100,height:440};};
    Object.defineProperty(window.HTMLElement.prototype,'clientWidth',{get(){return 1100;}});
    Object.defineProperty(window.HTMLElement.prototype,'clientHeight',{get(){return 440;}});
    window.URL.createObjectURL=()=> 'blob:model-item-test';window.URL.revokeObjectURL=()=>{};
    window.HTMLAnchorElement.prototype.click=function(){};
    window.fetch=()=>{throw new Error('Static dashboard attempted network request');};
    for(const [key,value] of Object.entries(saved))window.localStorage.setItem(key,value);
  }});
  const win=dom.window, doc=win.document;
  const query=(selector,root=doc)=>{const el=root.querySelector(selector);assert.ok(el,'Missing '+selector);return el;};
  const check=()=>assert.equal(errors.length,0,errors.join('\n'));
  const click=selector=>{query(selector).click();check();};
  const edit=(selector,value)=>{const el=query(selector);el.value=String(value);el.dispatchEvent(new win.Event('change',{bubbles:true}));check();};
  const row=item=>query(`#modelGrid tbody th [data-model-item="${item}"]`).closest('tr');
  const value=(item,period='2027Q1')=>Number(query(`td[data-model-period="${period}"]`,row(item)).dataset.modelValue);
  const snapshot=period=>[...doc.querySelectorAll(`#modelGrid tbody td[data-model-period="${period}"]`)].map(x=>x.dataset.modelValue);
  const openItem=(item,period)=>click(`#modelGrid ${period?'td':'th'} [data-model-item="${item}"]${period?`[data-model-period="${period}"]`:''}`);
  const storage=()=>Object.fromEntries(Array.from({length:win.localStorage.length},(_,i)=>{const key=win.localStorage.key(i);return [key,win.localStorage.getItem(key)];}));
  const reveal=selector=>{const el=query(selector),parents=[];for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')parents.unshift(p);for(const p of parents)if(!p.open)query(':scope > summary',p).click();check();};
  const uniqueIds=()=>{const ids=[...doc.querySelectorAll('[id]')].map(x=>x.id);assert.equal(new Set(ids).size,ids.length,'Duplicate element IDs after detail navigation');};
  return {dom,win,doc,query,check,click,edit,row,value,snapshot,openItem,storage,reveal,uniqueIds};
}

let app,restored;
async function main(){
 try{
  app=mount();const {win,doc,query,check,click,edit,value,snapshot,openItem,reveal,uniqueIds}=app;
  check();
  assert.equal(query('#modelDetail').hidden,true,'Detail drawer is visible initially');
  assert.equal(doc.querySelectorAll('#modelGrid tbody tr').length,40,'Complete model was reduced');
  const itemKeys=[...doc.querySelectorAll('#modelGrid tbody th [data-model-item]')].map(x=>x.dataset.modelItem);
  assert.equal(itemKeys.length,40,'A model line has no specific item entry');
  assert.equal(new Set(itemKeys).size,40,'Different model lines share one generic item identity');
  const actualBefore=snapshot('2026Q3'),baselineQ1=snapshot('2027Q1'),baselineQ2=snapshot('2027Q2');
  openItem('revenue','2026Q3');
  assert.equal(query('#wbProfitPeriod').value,'2026Q3','Actual entry lost its period');
  assert.equal(doc.querySelectorAll('#modelItemTree input:not([disabled]):not([readonly])').length,0,'Actual-quarter detail exposes editable assumptions');
  click('#modelDetailClose');
  openItem('eps','2028');
  assert.equal(query('#wbProfitPeriod').value,'2028','Annual entry lost its period');
  assert.equal(doc.querySelectorAll('#modelItemTree input:not([disabled]):not([readonly])').length,0,'Annual extension invented detailed quarterly inputs');
  assert.match(query('#modelItemTree').textContent,/年度延展|年度/,'Annual extension context is not explained');
  click('#modelDetailClose');
  const businessKeys=['search','network','youtube','youtubeSubs','otherSubs','bets','workspace','traditional','ai','tpu'];
  openItem('revenue','2027Q2');
  for(const key of businessKeys)assert.equal(query(`#modelItemTree details[data-detail-item="${key}"]`).open,false,'Business must start collapsed: '+key);
  assert.equal(doc.querySelectorAll('#modelItemTree details[data-item-evidence][open]').length,0,'Evidence must start collapsed');
  click('#modelDetailClose');

  // Every financial line must have a reachable, scoped explanation rather than a generic wall.
  for(const key of itemKeys){
    openItem(key);assert.equal(query('#modelDetail').hidden,false,'Item did not open: '+key);
    if(key==='cloud')assert.equal(query('#modelCloudSlot').hidden,false,'Cloud entry did not open Cloud analysis');
    else assert.ok(doc.querySelector(`#modelItemTree [data-detail-item="${key}"]`) || ['revenue','subs'].includes(key)&&doc.querySelector('#modelItemTree [data-detail-item="search"],#modelItemTree [data-detail-item="youtubeSubs"]'),'Missing item-specific explanation: '+key);
    assert.ok(!/NaN|undefined/.test(query('#modelDetailTitle').textContent),'Invalid item heading: '+key);
    click('#modelDetailClose');
  }

  openItem('revenue','2027Q2');
  assert.equal(query('#wbProfitPeriod').value,'2027Q2','Revenue entry lost clicked quarter');
  assert.equal(doc.querySelectorAll('#modelDetailNav [data-wb-factor]').length,0,'Detached evidence toolbar remains');
  for(const key of businessKeys)query(`#modelItemTree details[data-detail-item="${key}"]`).open=false;
  click('#modelItemTree details[data-detail-item="search"] > summary');
  const search=query('#modelItemTree details[data-detail-item="search"]');
  assert.ok(search.open,'Search line did not expand');
  for(const key of businessKeys.filter(k=>k!=='search'))assert.equal(query(`#modelItemTree details[data-detail-item="${key}"]`).open,false,'Unrelated business opened: '+key);
  assert.equal(search.querySelector('[data-business-revenue="network"]'),null,'Search contains Network editing controls');
  const evidence=query('details[data-item-evidence]',search),evidenceKey=evidence.dataset.itemEvidence;
  assert.equal(evidence.open,false,'Evidence is expanded before explicit click');
  query(':scope > summary',evidence).click();assert.equal(evidence.open,true,'Evidence summary did not expand');
  assert.ok(evidence.textContent.trim().length>30,'Evidence lacks actual source/analysis content');
  const revenueSelector='#modelItemTree [data-detail-item="search"] [data-business-revenue="search"]';
  reveal(revenueSelector);const priorRevenue=value('revenue','2027Q2');
  query('#modelDetail .model-dialog').scrollTop=180;
  edit(revenueSelector,Number(query(revenueSelector).value)+1);
  assert.ok(Math.abs(value('revenue','2027Q2')-priorRevenue-1000)<1e-3,'Business revenue edit did not reach selected quarter total');
  assert.equal(query('#modelItemTree [data-detail-item="search"]').open,true,'Editing collapsed selected business');
  assert.equal(query(`#modelItemTree [data-item-evidence="${evidenceKey}"]`).open,true,'Editing collapsed selected evidence');
  assert.equal(query('#modelDetail .model-dialog').scrollTop,180,'Editing lost drawer scroll position');
  assert.equal(query('#wbProfitPeriod').value,'2027Q2','Editing changed the selected quarter');
  assert.deepEqual(snapshot('2026Q3'),actualBefore,'Revenue edit changed actual history');
  assert.deepEqual(snapshot('2027Q1'),baselineQ1,'Q2 revenue edit changed unrelated Q1');
  edit('#wbProfitPeriod','2027Q1');
  assert.equal(query('#modelItemTree [data-detail-item="search"]').open,true,'Changing quarter collapsed selected business');
  assert.equal(query(`#modelItemTree [data-item-evidence="${evidenceKey}"]`).open,true,'Changing quarter collapsed selected evidence');
  assert.equal(query('#wbProfitPeriod').value,'2027Q1','Quarter selector did not change context');
  assert.deepEqual(snapshot('2027Q1'),baselineQ1,'Changing view quarter mutated the model');
  edit('#wbProfitPeriod','2027Q2');
  uniqueIds();

  // The persisted scenario must reconstruct the same model without opening a detail.
  restored=mount(app.storage());restored.check();
  assert.deepEqual(restored.snapshot('2027Q2'),snapshot('2027Q2'),'Reload lost item-level revenue change');
  assert.equal(restored.query('#modelDetail').hidden,true,'Reload unexpectedly opened an editor');
  restored.dom.window.close();restored=null;
  click('#modelDetailClose');click('#wbReset');
  assert.deepEqual(snapshot('2027Q2'),baselineQ2,'Reset failed to restore baseline after item edit');

  // Direct entries expose only the requested financial item, while its assumptions stay live.
  openItem('taxRate','2027Q1');
  assert.ok(query('#modelItemTree [data-detail-item="taxRate"]').open,'Direct tax entry is not expanded');
  const taxSelector='#modelItemTree [data-model-earnings="taxRate"]';reveal(taxSelector);
  const epsBefore=value('eps'),taxBefore=Number(query(taxSelector).value);
  edit(taxSelector,taxBefore+1);assert.ok(value('eps')<epsBefore,'Higher tax rate did not reduce EPS');
  assert.equal(query('#modelItemTree [data-detail-item="taxRate"]').open,true,'Tax edit collapsed the item');
  click('#modelDetailClose');click('#wbReset');

  openItem('rd','2027Q1');
  const rdSelector='#modelItemTree [data-model-earnings="rdRatio"]';reveal(rdSelector);
  const oiBefore=value('operatingIncome');edit(rdSelector,Number(query(rdSelector).value)+1);
  assert.ok(value('operatingIncome')<oiBefore,'R&D expense edit did not affect operating profit');
  assert.ok(!doc.querySelector('#modelItemTree [data-detail-item="taxRate"]') || doc.querySelector('#modelItemTree [data-detail-item="taxRate"]').hidden,'R&D exposes unrelated tax item');
  click('#modelDetailClose');click('#wbReset');

  openItem('dilutedShares','2027Q1');
  const sharesSelector='#modelItemTree [data-model-earnings="dilutedShares"]';reveal(sharesSelector);
  const shareEPS=value('eps'),niBefore=value('netIncome');edit(sharesSelector,Number(query(sharesSelector).value)*1.1);
  assert.ok(value('eps')<shareEPS,'Larger share count did not dilute EPS');
  assert.equal(value('netIncome'),niBefore,'Share edit changed net profit');
  click('#modelDetailClose');click('#wbReset');

  openItem('depreciation','2027Q1');
  const lifeSelector='#modelItemTree [data-profit="serverLife"]';reveal(lifeSelector);
  const depBefore=value('depreciation'),depEPS=value('eps');edit(lifeSelector,Number(query(lifeSelector).value)+1);
  assert.ok(value('depreciation')<depBefore,'Longer asset life did not reduce depreciation');
  assert.ok(value('eps')>depEPS,'Longer asset life did not reach earnings');
  assert.deepEqual(snapshot('2026Q3'),actualBefore,'Expense edits changed actual history');
  query('#modelDetail').dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert.equal(query('#modelDetail').hidden,true,'Escape did not return to model');
  click('#wbReset');assert.deepEqual(snapshot('2027Q1'),baselineQ1,'Reset failed after financial-item edits');

  openItem('cloud','2027Q1');
  assert.equal(query('#modelCloudSlot').hidden,false,'Cloud line did not reach scoped analysis');
  assert.equal(typeof win.CloudApp.focusItem,'function','Cloud detail cannot focus a specific business/customer');
  win.CloudApp.focusItem('Anthropic','2027Q1');check();
  const cloudBefore=plain(win.CloudApp.getResult()),capacity='[data-cl-param="customers.Anthropic.averageAcceptedCapacityGW.1"]';reveal(capacity);
  edit(capacity,Number(query(capacity).value)*0.5);
  const cloudAfter=plain(win.CloudApp.getResult()),beforeQuarter=cloudBefore.quarters.find(q=>q.period==='2027Q1'),afterQuarter=cloudAfter.quarters.find(q=>q.period==='2027Q1');
  assert.ok(afterQuarter.customerRevenueBn.Anthropic<beforeQuarter.customerRevenueBn.Anthropic,'Customer-level capacity edit did not affect revenue');
  for(const client of ['OpenAI','otherAI'])assert.equal(afterQuarter.customerRevenueBn[client],beforeQuarter.customerRevenueBn[client],'Anthropic edit changed unrelated customer');
  assert.deepEqual(snapshot('2027Q1'),baselineQ1,'Cloud preview changed main model before explicit apply');
  reveal('#clApply');click('#clApply');
  assert.ok(Math.abs(value('cloud')-afterQuarter.cloudRevenueBn*1000)<1e-5,'Cloud apply did not update main model');
  assert.deepEqual(snapshot('2026Q3'),actualBefore,'Cloud apply changed actual history');
  uniqueIds();
  const cloudPaths=[...doc.querySelectorAll('[data-cl-param]')].map(x=>x.dataset.clParam);
  assert.equal(new Set(cloudPaths).size,cloudPaths.length,'Cloud drilldown duplicated assumption inputs');
  click('#wbReset');click('[data-cl-preset="base"]');check();
  assert.deepEqual(snapshot('2027Q1'),baselineQ1,'Final reset did not restore main model');
  // Going back through the Cloud hierarchy must carry the period selected inside Cloud.
  openItem('revenue','2027Q2');
  const cloudDriver='#modelItemTree [data-detail-item="ai"] [data-model-topic="cloud"][data-model-item="ai"]';
  reveal(cloudDriver);click(cloudDriver);
  assert.equal(query('#clDetailPeriod').value,'2027Q2','AI driver entry lost the model quarter');
  edit('#clDetailPeriod','2027Q4');
  click('#modelDetailNav [data-model-topic="cloud"]');
  assert.equal(query('#clDetailPeriod').value,'2027Q4','Cloud parent navigation reverted to stale entry quarter');
  click('#modelDetailNav [data-model-topic="revenue"]');
  assert.equal(query('#wbProfitPeriod').value,'2027Q4','Returning from Cloud lost the current quarter');
  click('#modelDetailClose');click('#wbReset');check();
  assert.deepEqual(snapshot('2027Q1'),baselineQ1,'Cloud navigation changed model values');
  console.log(JSON.stringify({result:'pass',scope:'non-visual item-detail workflows; canvas mocked',modelEntries:40,businessEntries:10,nestedEvidence:true,contextAndOpenStateRetained:true,mainModelRecalculation:true,actualHistoryLocked:true,scenarioReload:true,cloudPreviewApply:true,uniqueControls:true}));
 }finally{restored?.dom.window.close();app?.dom.window.close();}
}
main().catch(error=>{console.error(error.stack||String(error));process.exitCode=1;});
