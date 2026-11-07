/* User workflows against the real inline scripts. DOM/canvas are mocked, not visual QA. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const {fileURLToPath} = require('node:url');
const {JSDOM, VirtualConsole} = require(path.join(process.env.STOCK_DASHBOARD_QA_MODULES || path.join(os.tmpdir(), 'stock-dashboard-qa', 'node_modules'), 'jsdom'));
const html = fs.readFileSync(process.argv[2] || path.join(__dirname, '../outputs/googl-dashboard.html'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));

function mount(saved = {}) {
  const errors = [], virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error.stack || String(error)));
  const context = new Proxy({measureText:t=>({width:String(t).length*7}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),setLineDash(){},getLineDash:()=>[],getTransform:()=>({})},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
  const dom = new JSDOM(html, {runScripts:'dangerously',url:'http://localhost/formula-assumption-test',pretendToBeVisual:true,virtualConsole,beforeParse(window){
    window.structuredClone = global.structuredClone || plain;
    window.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
    window.HTMLCanvasElement.prototype.getContext=()=>context;
    window.scrollTo=()=>{};window.HTMLElement.prototype.scrollIntoView=()=>{};
    window.HTMLElement.prototype.getBoundingClientRect=function(){return {x:0,y:0,left:0,top:0,right:1100,bottom:440,width:1100,height:440};};
    Object.defineProperty(window.HTMLElement.prototype,'clientWidth',{get(){return 1100;}});
    Object.defineProperty(window.HTMLElement.prototype,'clientHeight',{get(){return 440;}});
    window.URL.createObjectURL=()=> 'blob:formula-assumption-test';window.URL.revokeObjectURL=()=>{};
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

const app=mount();
try {
 const {win,doc,query,check,click,edit,value,snapshot,reveal,uniqueIds}=app;
 const mainOnly=process.argv.includes('--main-only');
 const portableMode=process.argv.includes('--portable');
 const near=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<Math.max(1e-4,Math.abs(expected)*1e-9),`${message}: ${actual} != ${expected}`);
 const visible=el=>{
  if(!el)return false;
  for(let n=el;n&&n.nodeType===1;n=n.parentElement){
   if(n.hidden||win.getComputedStyle(n).display==='none')return false;
   if(n.tagName==='DETAILS'&&!n.open&&!n.querySelector(':scope > summary')?.contains(el))return false;
  }
  return true;
 };
 const numeric=(key,period='2027Q1')=>click(`#modelGrid td [data-model-number="${key}"][data-model-period="${period}"]`);
 const analysis=(key,period='2027Q1')=>{numeric(key,period);click('#modelNumberProvenance [data-model-analysis]');};
 const close=()=>click('#modelDetailClose');
 const reset=()=>{close();click('#wbReset');};
 const inputSelector=(key,parameter,period='2027Q1')=>`[data-number-edit][data-number-key="${key}"][data-number-parameter="${parameter}"][data-number-period="${period}"]`;
 const narrative=input=>{
  const block=input.closest('[data-assumption-key]');assert.ok(block,'Editable driver lacks assumption identity');
  const rationale=query('[data-assumption-rationale]',block),text=rationale.textContent.trim();
  assert.ok(visible(rationale)&&text.length>25,'Assumption explanation is hidden or too short');
  assert.match(text,/[\u3400-\u9fff]{4}/,'Assumption explanation is only a parameter or code path');
  assert.match(text,/基准|假设|预测|参考|来源|披露|模型|历史|收入|年限|资产|成本/,'Assumption explanation lacks a research context');
  return block;
 };
 const formula=root=>{
  const f=query('[data-number-formula]',root),s=query('[data-number-substitution]',root);
  assert.ok(visible(f)&&f.textContent.trim().length>8,'Formula requires another expansion');
  assert.ok(visible(s)&&/\d/.test(s.textContent),'Current values are missing from formula');
  return f.textContent;
 };
 const uniqueDrivers=()=>{
  const keys=[...doc.querySelectorAll('#modelDetail [data-number-edit]')].map(x=>[x.dataset.numberPeriod,x.dataset.numberParameter,x.dataset.numberKey].join(':'));
  assert.equal(keys.length,new Set(keys).size,'A formula and its analysis duplicate the same driver input');
 };
 check();
 const actual=snapshot('2026Q3'),baseline=snapshot('2027Q1');

 // The assumption cites the actual dated source, with an honest portable fallback.
 analysis('search');
 const searchCost='#modelItemTree [data-model-number="business.search.cogs"]';reveal(searchCost);click(searchCost);
 click('#modelNumberProvenance [data-model-number="business.search.cashCost"]');
 click('#modelNumberProvenance [data-model-number="business.search.identifiedDirect"]');
 const tacSelector='#modelNumberProvenance '+inputSelector('searchTacRate','profit');
 const tacCard=query(tacSelector).closest('[data-assumption-key="searchTacRate"]');
 const tacRationale=query('[data-assumption-rationale]',tacCard),tacSource=query('[data-assumption-source]',tacCard);
 assert.ok(visible(tacRationale)&&visible(tacSource),'TAC explanation or citation requires another expansion');
 assert.match(tacRationale.textContent,/摩根士丹利|Morgan\s+Stanley/,'TAC explanation does not name the source institution');
 assert.match(tacRationale.textContent,/18[.]49\d*\s*%?/,'TAC explanation omits the actual 18.49% assumption');
 const audit=query('details[data-assumption-audit]',tacCard);
 assert.equal(audit.open,false,'Technical source metadata starts expanded');
 const firstLayer=tacCard.cloneNode(true);firstLayer.querySelectorAll('details[data-assumption-audit]').forEach(x=>x.remove());
 assert.doesNotMatch(firstLayer.textContent,/固定模型快照|冻结|覆盖|Expense\s+Drivers|\bDI25\b/,'Customer explanation leaks technical provenance wording');
 if(portableMode){
  assert.equal(tacSource.querySelector('a[href^="file:"]'),null,'Portable source citation contains a private local file link');
  const record=query('[data-assumption-source-record="ms"]',tacSource);assert.ok(visible(record),'Portable source citation lacks its source record action');
  assert.equal(record.tagName,'BUTTON','Portable missing file masquerades as a report hyperlink');
  assert.equal(tacSource.querySelector('a[href*="morganstanley.com/matrix"],a[href*="morganstanley.com/eqr/disclosures"]'),null,'A general portal or compliance page masquerades as the original model');
  record.click();check();assert.equal(query('#drawer').hidden,false,'Portable source record button does not open its record');
  assert.match(query('#drBody').textContent,/Morgan\s+Stanley|摩根士丹利/,'Portable record opens an unrelated source');
  click('#drClose');
 }else{
  const citation=query('[data-assumption-citation="ms"]',tacSource);assert.ok(visible(citation),'MS source citation is hidden');
  assert.equal(citation.tagName,'A','Local source citation is not a real file hyperlink');
  const href=citation.getAttribute('href');assert.match(href,/^file:\/\//i,'Local MS source does not point to its original file');
  const sourcePath=fileURLToPath(href);assert.match(sourcePath,/ms-model[\\/]clean\.xlsx$/i,'MS citation points to another document');
  assert.ok(fs.existsSync(sourcePath),'MS citation target does not exist');
  const expected=path.resolve(__dirname,'../../stock-dashboard-demo_v9_2026-11-04/stock-dashboard-demo/ms-model/clean.xlsx');
  assert.equal(path.normalize(sourcePath).toLowerCase(),expected.toLowerCase(),'MS citation does not use the verified original workbook');
 }
 const specificAnalysis=query('[data-assumption-analysis]',tacCard);assert.ok(visible(specificAnalysis),'Our analysis entry is hidden');
 assert.equal(specificAnalysis.dataset.modelItem,'search','TAC citation routes to an unrelated broad analysis');
 specificAnalysis.click();check();
 assert.equal(query('#modelItemTree > [data-detail-item]').dataset.detailItem,'search','Our analysis link did not open the Search analysis');
 assert.equal(query('#wbProfitPeriod').value,'2027Q1','Analysis citation lost the source period');
 assert.ok(query('#modelItemTree').textContent.trim().length>100,'Analysis citation opens an empty view');close();

 // A label and a numeric cell lead to the same visible Search formula and YoY assumption.
 for(const entry of ['label','number']){
  if(entry==='label')click('#modelGrid th [data-model-item="search"]');else numeric('search');
  const selector='#modelDetail '+inputSelector('search','segmentGrowthYoY'),input=query(selector);
  const context=input.closest('[data-model-formula-context]');assert.ok(context,'Search assumption is detached from its formula');
  assert.match(formula(context),/上年同期/);assert.match(formula(context),/1\s*[+＋]/);assert.match(formula(context),/同比/);
  assert.ok(visible(input),'Search growth input is hidden');narrative(input);uniqueDrivers();
  assert.equal(doc.querySelector('#modelDetail [data-business-revenue]'),null,'Search result still has a revenue amount editor');
  for(const detail of doc.querySelectorAll('#modelDetail .number-more-evidence,#modelDetail details[data-item-evidence]'))assert.equal(detail.open,false,'Detailed evidence should start collapsed');
  const prior=value('search','2026Q1'),before=value('search'),group=value('revenue'),q2=snapshot('2027Q2'),eps=value('eps'),growth=Number(input.value);
  near(before,prior*(1+growth/100),'Search formula does not reproduce the displayed result');
  edit(selector,growth+2.25);
  near(value('search'),prior*(1+(growth+2.25)/100),'Search YoY edit does not follow its displayed formula');
  near(value('revenue')-group,prior*0.0225,'Search YoY change does not reach group revenue');
  assert.notEqual(value('eps'),eps,'Search YoY change does not reach earnings');
  assert.deepEqual(snapshot('2027Q2'),q2,'Q1 growth edit changed unrelated Q2');
  assert.deepEqual(snapshot('2026Q3'),actual,'Search assumption edit changed actual history');
  assert.ok(visible(query(selector)),'Recalculation hides the active growth assumption');
  reset();
 }

 // Item-name entries for calculated lines expose formulas, without result amount inputs.
 for(const key of ['revenue','grossProfit','grossMargin','rd','opex','operatingIncome','tax','netIncome','eps','adjustedEps','depreciation']){
  click(`#modelGrid th [data-model-item="${key}"]`);formula(query('#modelItemTree [data-model-formula-context]'));
  for(const input of doc.querySelectorAll('#modelItemTree [data-number-edit]')){
   assert.ok(input.dataset.numberKey!==key||input.dataset.numberParameter==='segmentGrowthYoY','A result edits itself: '+key);
  }
  assert.equal(doc.querySelector('#modelItemTree [data-business-revenue]'),null);uniqueDrivers();close();
 }
 assert.equal(doc.querySelector('#ft input[data-period="2027Q1"][data-field="grossMargin"]'),null,'Legacy table still edits the derived quarterly margin');

 // The annual total is a roll-up; the 2028 extension has its own annual growth input.
 numeric('search','2027');const annual=query('#modelNumberProvenance');
 assert.match(formula(annual),/Q1|季度|各季|四季/);
 assert.equal(annual.querySelector(inputSelector('search','segmentGrowthYoY','2027')),null,'Annual roll-up exposes a redundant growth-result input');
 const annualBefore=value('search','2027'),priorQ1=value('search','2026Q1');
 click('#modelNumberProvenance [data-model-number="search"][data-model-period="2027Q1"]');
 const quarterGrowth='#modelNumberProvenance '+inputSelector('search','segmentGrowthYoY');edit(quarterGrowth,Number(query(quarterGrowth).value)+1);
 near(value('search','2027')-annualBefore,priorQ1/100,'Quarter driver does not aggregate into the annual result');reset();
 numeric('search','2028');const extension=query('#modelNumberProvenance');
 assert.match(formula(extension),/上年|上一年|2027/);
 const annualGrowth='#modelNumberProvenance '+inputSelector('search','segmentGrowthYoY','2028'),annualInput=query(annualGrowth),priorAnnual=value('search','2027'),newGrowth=Number(annualInput.value)+1;
 assert.ok(visible(annualInput));narrative(annualInput);edit(annualGrowth,newGrowth);
 near(value('search','2028'),priorAnnual*(1+newGrowth/100),'Annual extension ignores the prior annual base');
 assert.equal(doc.querySelector('#modelGrid [data-model-period="2028Q1"]'),null,'Annual extension invented quarterly values');reset();
 numeric('search','2026Q3');assert.equal(query('#modelNumberProvenance').dataset.numberKind,'actual');
 assert.equal(query('#modelNumberProvenance').querySelectorAll('input').length,0,'Historical number exposes an assumption editor');close();

 // Depreciation is edited through asset lives and multipliers, never a depreciation amount.
 numeric('depreciation');const depPanel=query('#modelNumberProvenance');formula(depPanel);
 const assetKeys=[...depPanel.querySelectorAll('[data-number-edit]')].map(x=>x.dataset.numberKey).sort();
 assert.deepEqual(assetKeys,['otherAssetMultiplier','otherLife','serverAssetMultiplier','serverLife'].sort(),'Depreciation exposes non-driver amount inputs');
 for(const input of depPanel.querySelectorAll('[data-number-edit]')){assert.ok(visible(input));narrative(input);}uniqueDrivers();
 const lifeSelector='#modelNumberProvenance '+inputSelector('serverLife','profit'),multSelector='#modelNumberProvenance '+inputSelector('serverAssetMultiplier','profit');
 const oldLife=Number(query(lifeSelector).value),oldMult=Number(query(multSelector).value),baseAssets=win.eval('CASE.profitModel.quarters["2027Q1"].serverAssets'),depBefore=value('depreciation'),epsBefore=value('eps');
 edit(lifeSelector,oldLife+2);
 near(value('depreciation')-depBefore,baseAssets*oldMult/4*(1/(oldLife+2)-1/oldLife),'Server life does not follow the asset depreciation formula');
 assert.ok(value('eps')>epsBefore,'Longer useful life does not reach EPS');
 const depAfterLife=value('depreciation');edit(multSelector,oldMult+0.1);
 near(value('depreciation')-depAfterLife,baseAssets*0.1/(oldLife+2)/4,'Asset multiplier does not follow the depreciation formula');
 assert.equal(query('#modelNumberProvenance').dataset.numberKey,'depreciation','Driver edit replaces the selected result');reset();

 if(!mainOnly){
  // Cloud retains exactly one editor per driver and an explicit apply boundary.
  click('#modelGrid th [data-model-item="cloud"]');win.CloudApp.focusItem('tpu','2027Q1');check();
  const cloudId='metric:2027Q1:cloud:externalTPURevenueBn',cloudButton=`#cloudLab [data-cl-number="${cloudId}"]`;reveal(cloudButton);click(cloudButton);
  const panel=query('#clNumberDetail');assert.equal(panel.dataset.clKind,'calculated');
  assert.ok(visible(query('.cl-number-formula',panel))&&visible(query('.cl-number-substitution',panel)),'Cloud calculation formula is hidden');
  for(const detail of panel.querySelectorAll('details.cl-number-analysis'))assert.equal(detail.open,false,'Cloud detailed analysis starts expanded');
  const capacity='#clNumberDrivers [data-cl-param="externalTPU.capacitySoldGW.1"]';assert.ok(visible(query(capacity)),'Cloud formula does not expose its capacity assumption');
  const cloudBefore=plain(win.CloudApp.getResult()),mainBefore=snapshot('2027Q1'),beforeQuarter=cloudBefore.quarters.find(q=>q.period==='2027Q1');
  for(const input of panel.querySelectorAll('[data-cl-param]')){assert.ok(input.hasAttribute('data-cl-driver-input'));assert.ok(visible(input));}
  const pathCounts=()=>{const paths=[...doc.querySelectorAll('[data-cl-param]')].map(x=>x.dataset.clParam);assert.equal(paths.length,new Set(paths).size,'Cloud formula duplicates original editors');return paths.length;};
  const controls=pathCounts();edit(capacity,Number(query(capacity).value)*0.5);
  assert.equal(query('#clNumberDetail').dataset.clNumberId,cloudId,'Cloud driver edit changes the selected calculation');
  const afterQuarter=plain(win.CloudApp.getResult()).quarters.find(q=>q.period==='2027Q1');
  near(afterQuarter.externalTPURevenueBn,beforeQuarter.externalTPURevenueBn*0.5,'Cloud TPU revenue ignores its capacity input');
  assert.deepEqual(afterQuarter.customerRevenueBn,beforeQuarter.customerRevenueBn,'TPU assumption changes unrelated service customers');
  assert.deepEqual(snapshot('2027Q1'),mainBefore,'Cloud inline driver applied a preview to the main model');assert.equal(pathCounts(),controls);
  click('#clNumberBack');assert.equal(query('#clDetailPeriod').value,'2027Q1');assert.equal(pathCounts(),controls);
  click('#clApply');near(value('cloud'),afterQuarter.cloudRevenueBn*1000,'Explicit Cloud apply did not update the model');
  assert.deepEqual(snapshot('2026Q3'),actual,'Cloud application changed actual history');
  for(const business of ['workspace','traditional','ai','tpu']){
   close();analysis('revenue');click(`#modelItemTree [data-model-topic][data-model-item="${business}"]`);
   assert.equal(doc.querySelector(`#modelItemTree [data-number-edit][data-number-key="${business}Revenue"]`),null,'Applied Cloud result exposes a direct amount editor: '+business);
   assert.ok(query(`#modelItemTree [data-model-topic="cloud"][data-model-item="${business}"]`),'Applied Cloud component loses its underlying driver entry: '+business);
  }
  reset();click('[data-cl-preset="base"]');
 }
 assert.deepEqual(snapshot('2027Q1'),baseline,'Workflow reset did not restore the initial model');
 assert.deepEqual(snapshot('2026Q3'),actual,'Formula workflow changed historical actuals');uniqueIds();check();
 console.log(JSON.stringify({result:'pass',scope:'non-visual formula and assumption workflow; canvas mocked',sourceMode:portableMode?'portable':'local',realSourceCitation:true,technicalAuditCollapsed:true,specificAnalysisCitation:true,searchLabelAndNumberFormula:true,searchYoYArithmetic:true,narrativeEvidenceVisible:true,resultsHaveNoSelfEditors:true,annualAnd2028Distinct:true,depreciationUnderlyingDrivers:true,cloudDriversAndExplicitApply:!mainOnly,historicalActualsLocked:true}));
} finally {app.dom.window.close();}
