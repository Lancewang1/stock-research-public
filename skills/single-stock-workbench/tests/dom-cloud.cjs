/* Non-visual integration checks: real inline scripts, mocked canvas and layout. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const {JSDOM, VirtualConsole} = require(path.join(process.env.STOCK_DASHBOARD_QA_MODULES || path.join(os.tmpdir(), 'stock-dashboard-qa', 'node_modules'), 'jsdom'));
const html = fs.readFileSync(process.argv[2] || path.join(__dirname, '../outputs/googl-dashboard.html'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));

function mount(saved = {}) {
  const errors = [];
  const downloads = [], blobs = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error.stack || String(error)));
  const context = new Proxy({measureText:t=>({width:String(t).length*7}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),setLineDash(){},getLineDash:()=>[],getTransform:()=>({})},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
  const dom = new JSDOM(html, {runScripts:'dangerously',url:'http://localhost/cloud-integration-test',pretendToBeVisual:true,virtualConsole,beforeParse(window){
    window.structuredClone = global.structuredClone || plain;
    window.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
    window.HTMLCanvasElement.prototype.getContext=()=>context;
    window.scrollTo=()=>{};window.HTMLElement.prototype.scrollIntoView=()=>{};
    window.HTMLElement.prototype.getBoundingClientRect=function(){return {x:0,y:0,left:0,top:0,right:1100,bottom:440,width:1100,height:440};};
    Object.defineProperty(window.HTMLElement.prototype,'clientWidth',{get(){return 1100;}});
    Object.defineProperty(window.HTMLElement.prototype,'clientHeight',{get(){return 440;}});
    window.Blob = global.Blob;
    window.URL.createObjectURL=blob=>{blobs.push(blob);return 'blob:local-test';};window.URL.revokeObjectURL=()=>{};
    window.HTMLAnchorElement.prototype.click=function(){downloads.push({name:this.download,href:this.href});};
    window.fetch=()=>{throw new Error('Static dashboard attempted network request');};
    for (const [key, value] of Object.entries(saved)) window.localStorage.setItem(key,value);
  }});
  const {document, Event} = dom.window;
  const query = selector => {const el=document.querySelector(selector);assert.ok(el,'Missing '+selector);return el;};
  const click = selector => query(selector).click();
  const check = () => assert.equal(errors.length,0,errors.join('\n'));
  const edit = (param,value) => {
    const el=query(`[data-cl-param="${param}"]`);
    el.value=String(value);el.dispatchEvent(new Event('change',{bubbles:true}));check();
    assert.equal(query('#clError').hidden,true,query('#clError').textContent);
  };
  const storage = () => Object.fromEntries(Array.from({length:dom.window.localStorage.length},(_,i)=>{const k=dom.window.localStorage.key(i);return [k,dom.window.localStorage.getItem(k)];}));
  const importScenario = async value => {
    const input=query('#clFile'), body=JSON.stringify(value);
    Object.defineProperty(input,'files',{value:[{name:'scenario.json',size:Buffer.byteLength(body),text:async()=>body}],configurable:true});
    input.dispatchEvent(new Event('change',{bubbles:true}));
    await new Promise(resolve=>setImmediate(resolve));
    check();
  };
  return {dom,document,query,click,check,edit,storage,downloads,blobs,importScenario};
}

let primary,restored;
async function main() {
try {
  primary=mount();
  const {dom,document,query,click,check,edit}=primary;
  const win=dom.window;
  check();
  assert.ok(win.CloudApp,'Cloud application failed to initialize');
  const resourceSelectors='script[src],link[href],img[src],iframe[src],source[src],audio[src],video[src],object[data],embed[src]';
  for(const resource of document.querySelectorAll(resourceSelectors)) {
    const url=resource.getAttribute('src')||resource.getAttribute('href')||resource.getAttribute('data');
    assert.ok(!/^(?:https?:)?\/\//i.test(url),'External network resource: '+url);
  }
  assert.ok(!/\b(?:url\(\s*["']?|@import\s+["'])(?:https?:)?\/\//i.test(html),'External CSS resource');
  const embedded=plain(win.eval('({cloud:CLOUD_DATA,research:RESEARCH,review:REVIEW_DATA,caseData:CASE})'));
  const registry=new Set([...embedded.cloud.sources,...embedded.research.sources,...embedded.review.sources,...embedded.caseData.sources].map(s=>s.id));
  function auditReferences(value,key='') {
    if(Array.isArray(value)){value.forEach(item=>auditReferences(item,key));return;}
    if(!value||typeof value!=='object')return;
    for(const [name,item] of Object.entries(value)) {
      if(['sourceRefs','verificationRefs','supplementalRefs','sourceIds'].includes(name)&&Array.isArray(item))for(const ref of item)assert.ok(registry.has(ref),'Unresolved source '+ref);
      if(['publicationDate','publishedAt','availableAt','filingDate','filed'].includes(name)&&typeof item==='string'&&/^\d{4}-\d{2}-\d{2}/.test(item))assert.ok(item.slice(0,10)<='2026-11-05','Future publication in '+key+'.'+name);
      auditReferences(item,key+'.'+name);
    }
  }
  auditReferences(embedded.cloud,'CLOUD_DATA');
  assert.equal(document.querySelectorAll('#recentEventReview .rv11-event').length,12,'Recent event chain absent');
  assert.equal(document.querySelectorAll('#recentEventReview .rv11-controversy').length,3,'Review controversies absent');
  assert.equal(document.querySelectorAll('#recentEventReview details[open]').length,0,'Review evidence must default closed');
  assert.ok(!Array.from(document.querySelectorAll('aside button')).some(b=>b.disabled),'Disabled empty navigation remains');
  assert.ok(!/一致预期|研报与纪要/.test(query('aside').textContent),'Empty consensus/report navigation remains');

  click('[data-view="forecast"]');check();
  const baseline=plain(win.CloudApp.getResult());
  const baselineAnnual=baseline.annual.find(q=>q.period==='2027');
  const globalInputs=Array.from(document.querySelectorAll('#cloudLab [data-cl-param^="global."]'));
  assert.equal(globalInputs.length,7,'Quick global parameter controls missing or duplicated');
  assert.ok(globalInputs.every(el=>!el.closest('details')),'Quick parameters hidden in advanced details');
  assert.ok(query('#fullForecast').open,'Earnings model must start expanded');
  assert.equal(query('#fcCard').firstElementChild.id,'fullForecast','Earnings model must be first');
  assert.equal(query('#cloudLab .cl-line').id,'clContractLine','Contract line must precede economics');
  for(const id of ['clContractEvidence','clEconomicsEvidence']) assert.ok(!query('#'+id).closest('details'),'Key evidence must be visible');
  assert.match(query('#clEconomicsEvidence').textContent,/14.6%/,'New historical cost evidence missing');
  assert.ok(query('[data-cl-param="customers.Anthropic.reservedBillingFraction"]'),'Reserved billing editor absent');
  const paths=[...document.querySelectorAll('[data-cl-param]')].map(e=>e.dataset.clParam);
  assert.equal(new Set(paths).size,paths.length,'Duplicate parameter editors');
  assert.ok(!/capex|资本开支/i.test(query('#cloudLab').textContent),'Removed Capex module still rendered');
  assert.ok(!/capex/i.test(query('#studyOverview').textContent),'Overview still advertises Capex');
  assert.match(query('#clAssumptionAudit').textContent,/没有直接量化证据/,'Unsupported assumptions must be explicit');
  assert.match(query('#clAssumptionAudit').textContent,/EK130/,'TPU source cells missing');
  assert.equal(document.querySelectorAll('#clSensitivity tbody tr').length,7,'Non-revenue sensitivities remain');
  const clientNames={Anthropic:'Anthropic',OpenAI:'OpenAI',otherAI:'其他AI'};
  for (const client of Object.keys(clientNames)) {
    const param=`customers.${client}.averageAcceptedCapacityGW.1`;
    const input=query(`[data-cl-param="${param}"]`);
    const label=input.getAttribute('aria-label') || input.closest('label')?.textContent || '';
    const group=input.closest('fieldset')?.querySelector('legend')?.textContent || input.closest('[data-cl-customer]')?.dataset.clCustomer || '';
    assert.ok((label+group).includes(clientNames[client]) || group===client,`Customer input lacks visible identity: ${param}`);
    query('#cl-contract-'+client).open=true;
    const previous=baseline.quarters.find(q=>q.period==='2027Q1');
    edit(param,Number(input.value)*0.1);
    const changed=plain(win.CloudApp.getResult()).quarters.find(q=>q.period==='2027Q1');
    assert.ok(changed.customerRevenueBn[client]<previous.customerRevenueBn[client],`${client} lower delivery capacity did not reduce its revenue`);
    for (const other of Object.keys(clientNames).filter(c=>c!==client)) assert.equal(changed.customerRevenueBn[other],previous.customerRevenueBn[other],`${client} edit changed unrelated ${other}`);
    assert.ok(query('#cl-contract-'+client).open,'Editing a detailed input collapsed the active section');
    click('[data-cl-preset="base"]');check();
    assert.deepEqual(plain(win.CloudApp.getResult().annual),baseline.annual,`Reset failed after ${client} edit`);
  }

  // ARR is an editable driver; the readonly total budget must display the newly
  // derived engine result, never the original parameters.computeBudgetBn cache.
  const budgetInput=client=>query(`[data-cl-param="customers.${client}.computeBudgetBn.0"]`);
  const budgetBefore=Object.fromEntries(Object.keys(clientNames).map(client=>[client,Number(budgetInput(client).value)]));
  for(const client of Object.keys(clientNames)) {
    const input=budgetInput(client);
    assert.ok(input.readOnly,`${client} derived budget unexpectedly editable`);
    const expected=Number((baseline.quarters[0].customers[client].computeBudgetBn*Number(input.dataset.scale)).toFixed(5));
    assert.equal(Number(input.value),expected,`${client} initial readonly budget differs from computed result`);
  }
  const arrParam='customers.Anthropic.commercialRevenueRunRateBn.0';
  const arrInput=query(`[data-cl-param="${arrParam}"]`);
  assert.ok(!arrInput.readOnly,'Revenue run-rate should be editable');
  edit(arrParam,Number(arrInput.value)*0.5);
  const arrChanged=plain(win.CloudApp.getResult());
  const updatedBudget=arrChanged.quarters[0].customers.Anthropic.computeBudgetBn;
  const renderedBudget=Number(budgetInput('Anthropic').value);
  assert.notEqual(updatedBudget,baseline.quarters[0].customers.Anthropic.computeBudgetBn,'ARR edit failed to change derived budget');
  assert.notEqual(renderedBudget,budgetBefore.Anthropic,'Readonly budget retained stale cache after ARR edit');
  assert.equal(renderedBudget,Number((updatedBudget*Number(budgetInput('Anthropic').dataset.scale)).toFixed(5)),'Readonly budget differs from current engine result after ARR edit');
  for(const other of ['OpenAI','otherAI']) {
    assert.equal(Number(budgetInput(other).value),budgetBefore[other],`Anthropic ARR edit changed displayed ${other} budget`);
    assert.deepEqual(arrChanged.quarters[0].customers[other],baseline.quarters[0].customers[other],`Anthropic ARR edit changed ${other} engine result`);
  }
  click('[data-cl-preset="base"]');check();
  assert.deepEqual(plain(win.CloudApp.getResult().annual),baseline.annual,'Reset failed after ARR edit');
  assert.equal(Number(budgetInput('Anthropic').value),budgetBefore.Anthropic,'Reset left readonly budget stale');

  edit('customers.Anthropic.reservedBillingFraction',50);
  edit('global.customerBudgetMultiplier',0);
  const reserved=plain(win.CloudApp.getResult()).quarters[0].customers.Anthropic;
  assert.ok(reserved.revenueBn>0,'Budget zero erased contractual floor');
  assert.equal(reserved.googleBudgetCoverage,0);
  assert.equal(reserved.revenueBn,reserved.reservedRevenueBn);
  const method=query('[data-cl-method="customers.Anthropic.serviceMethod"]');
  method.value='constrainedBudget';method.dispatchEvent(new win.Event('change',{bubbles:true}));check();
  assert.equal(win.CloudApp.getResult().quarters[0].customers.Anthropic.revenueBn,0,'Method selector failed');
  click('[data-cl-preset="base"]');check();
  edit('externalTPU.recognitionFraction',50);
  assert.equal(win.CloudApp.getResult().quarters[0].externalTPURevenueBn,baseline.quarters[0].externalTPURevenueBn*.5,'Recognition editor failed');
  click('[data-cl-preset="base"]');check();

  const sensitivityRows=document.querySelectorAll('#clSensitivity tbody tr');
  assert.ok(sensitivityRows.length>=5,'Sensitivity calculation not shown');
  assert.ok(!/NaN|Infinity|undefined/.test(query('#clSensitivity').textContent),'Invalid sensitivity values displayed');
  const sensitivityBefore=query('#clSensitivity').textContent;
  edit('externalTPU.capacitySoldGW.1',0.3);
  const changed=plain(win.CloudApp.getResult());
  const changedAnnual=changed.annual.find(q=>q.period==='2027');
  assert.ok(changedAnnual.cloudRevenueBn<baselineAnnual.cloudRevenueBn,'TPU volume edit did not affect annual revenue');
  assert.notEqual(query('#clSensitivity').textContent,sensitivityBefore,'Sensitivity table did not recalculate');
  assert.ok(query('#studyOverview').textContent.includes(changedAnnual.cloudRevenueBn.toLocaleString('en-US',{maximumFractionDigits:1})),'Overview did not update with model');
  const saved=primary.storage();
  const cloudKey=Object.keys(saved).find(k=>k.startsWith('googl-cloud-v11:'));
  assert.ok(cloudKey,'Cloud scenario not saved locally');
  assert.equal(JSON.parse(saved[cloudKey]).overrides['externalTPU.capacitySoldGW.1'],0.3,'Saved override differs from input');
  restored=mount(saved);restored.check();
  assert.deepEqual(plain(restored.dom.window.CloudApp.getResult().annual),changed.annual,'Reload failed to restore saved model');
  assert.equal(restored.query('[data-cl-param="externalTPU.capacitySoldGW.1"]').value,'0.3','Reload did not show saved input');
  restored.dom.window.close();restored=null;

  click('#clExport');check();
  assert.equal(primary.downloads.length,1,'Scenario export did not trigger a download');
  assert.equal(primary.downloads[0].name,'googl-cloud-scenario.json','Export filename wrong');
  assert.equal(primary.blobs.length,1,'Scenario export did not create JSON content');
  const exported=JSON.parse(await primary.blobs[0].text());
  assert.equal(exported.version,1);assert.equal(exported.caseKey,cloudKey);
  assert.equal(exported.overrides['externalTPU.capacitySoldGW.1'],0.3,'Export differs from current scenario');
  click('[data-cl-preset="base"]');check();
  let pickerOpened=false;query('#clFile').addEventListener('click',()=>{pickerOpened=true;},{once:true});
  click('#clImport');assert.ok(pickerOpened,'Import button did not open the file picker');
  await primary.importScenario(exported);
  assert.equal(query('#clError').hidden,true,query('#clError').textContent);
  assert.deepEqual(plain(win.CloudApp.getResult().annual),changed.annual,'Same-snapshot import did not restore scenario');
  const storageBeforeReject=primary.storage();
  await primary.importScenario({...exported,caseKey:cloudKey+'-wrong-snapshot',overrides:{'externalTPU.capacitySoldGW.1':0.9}});
  assert.equal(query('#clError').hidden,false,'Wrong-snapshot import was accepted');
  assert.match(query('#clError').textContent,/快照不匹配|版本.*不匹配/,'Wrong-snapshot error unclear');
  assert.deepEqual(plain(win.CloudApp.getResult().annual),changed.annual,'Rejected import mutated model');
  assert.deepEqual(primary.storage(),storageBeforeReject,'Rejected import mutated local storage');
  await primary.importScenario(exported);
  assert.equal(query('#clError').hidden,true,'Valid import did not clear prior rejection');

  const originalQuarter=plain(win.eval('WBM.calculateCase(CASE,{}).quarters.find(q=>q.period==="2026Q3")'));
  const originalOperatingAssumptions=plain(win.eval('WBM.calculateCase(CASE,{}).quarters.filter(q=>q.kind==="estimate").map(q=>({period:q.period,taxRate:q.taxRate,dilutedShares:q.dilutedShares}))'));
  click('#clApply');check();
  assert.equal(query('#clError').hidden,true,query('#clError').textContent);
  assert.ok(query('#fullForecast').open,'Applying Cloud did not open forecast table');
  assert.match(query('#wbScenarioNote').textContent,/Cloud/,'Applied forecast lost provenance');
  // Read the actual stored case using its saved override shape, not a guessed storage key.
  const earningsSaved=Object.values(primary.storage()).map(raw=>{try{return JSON.parse(raw);}catch{return null;}}).find(v=>v?.title==='客户与供给模型 · Cloud收入');
  assert.ok(earningsSaved,'Applied earnings scenario not saved');
  win.__cloudTestOverrides=earningsSaved.overrides;
  const applied=plain(win.eval('WBM.calculateCase(CASE,window.__cloudTestOverrides)'));
  delete win.__cloudTestOverrides;
  for(const row of changed.quarters){const actual=applied.quarters.find(q=>q.period===row.period);assert.ok(Math.abs(actual.segments.cloud-row.cloudRevenueBn*1000)<1e-7,`Cloud revenue not applied in ${row.period}`);}
  assert.deepEqual(applied.quarters.find(q=>q.period==='2026Q3'),originalQuarter,'Cloud application modified a reported quarter');
  assert.deepEqual(applied.quarters.filter(q=>q.kind==='estimate').map(q=>({period:q.period,taxRate:q.taxRate,dilutedShares:q.dilutedShares})),originalOperatingAssumptions,'Cloud application changed tax or shares');
  for(const row of changed.quarters){const detail=applied.quarters.find(q=>q.period===row.period).profitDetail;assert.ok(detail);assert.ok(Math.abs(detail.parts.ai.revenue-Object.values(row.customerRevenueBn).reduce((a,b)=>a+b,0)*1000)<1e-6);assert.ok(Math.abs(detail.parts.tpu.revenue-row.externalTPURevenueBn*1000)<1e-6);}
  click('#wbReset');check();
  click('[data-cl-preset="base"]');check();
  assert.deepEqual(plain(win.CloudApp.getResult().annual),baseline.annual,'Cloud reset did not restore baseline');

  const msBefore=plain(win.CloudApp.getResult().quarters);
  click('#clMSPreview');check();assert.deepEqual(plain(win.CloudApp.getResult().quarters),msBefore);
  assert.ok(query('#clMSSolution').textContent.includes('2027Q1'));
  click('#clMSFit');check();
  plain(win.CloudApp.getResult().quarters).forEach((q,i)=>assert.ok(Math.abs(q.cloudRevenueBn-msBefore[i].cloudRevenueBn)<1e-6));
  const cost=query('[data-profit="cloudCashCostMultiplier"]'),originalCost=Number(cost.value);
  cost.value=originalCost*.9;cost.dispatchEvent(new win.Event('change',{bubbles:true}));check();
  assert.ok(Number(query('[data-profit="cloudCashCostMultiplier"]').value)<originalCost);
  click('#wbProfitFitMS');check();assert.ok(Math.abs(Number(query('[data-profit="cloudCashCostMultiplier"]').value)-originalCost)<1e-5);
  click('#wbProfitRestoreMS');check();assert.ok(Math.abs(Number(query('[data-profit="cloudCashCostMultiplier"]').value)-originalCost)<1e-5);
  click('[data-cl-preset="base"]');check();
  click('[data-view="chart"]');click('#tabs [data-tab="3"]');
  click('[data-wb-case="googl-2026-q3-drawdown"]');
  click('#recentEventReview [data-focus="oct28-release"]');check();
  assert.equal(win.eval('D.d[S.sel]'),'2026-10-29','After-hours earnings must focus the next-day price reaction');
  assert.ok(win.eval('D.d[S.i0] <= "2026-10-28" && D.d[S.i1] >= "2026-10-29"'),'Focused range excludes earnings reaction window');
  click('#recentEventReview [data-focus="nov02-low"]');check();
  assert.equal(win.eval('D.d[S.sel]'),'2026-11-02','Closing low focus date wrong');
  click('[data-wb-case="googl-2024-summer-drawdown"]');check();
  assert.equal(document.querySelectorAll('#recentEventReview').length,0,'Old review did not retain its independent renderer');
  assert.ok(query('#wbResearch').textContent.includes('2024'),'Historical review absent');
  assert.ok(!/\?{5,}/.test(document.body.textContent),'Corrupted Chinese text');
  console.log(JSON.stringify({result:'pass',scope:'non-visual DOM integration; canvas mocked',globalInputs:7,customerInputs:3,derivedBudgetUpdates:true,sensitivityRecalculated:true,localSaveReload:true,exportImport:true,wrongSnapshotRejected:true,offlineResources:true,sourcesResolved:true,publicationCutoff:true,revenueOnly:true,assumptionEvidenceVisible:true,cloudApplyToEarnings:true,actualQuarterLocked:true,reset:true,eventReactionFocus:true,emptyNavigationRemoved:true}));
} finally {
  restored?.dom.window.close();primary?.dom.window.close();
}
}
main().catch(error=>{console.error(error.stack||String(error));process.exitCode=1;});
