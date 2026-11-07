/* User workflows against the real inline scripts. DOM/canvas are mocked, not visual QA. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {fileURLToPath} = require('node:url');
const {JSDOM, VirtualConsole} = require(path.join(process.env.STOCK_DASHBOARD_QA_MODULES || path.join(os.tmpdir(), 'stock-dashboard-qa', 'node_modules'), 'jsdom'));
let html = fs.readFileSync(process.argv[2] || path.join(__dirname, '../outputs/googl-dashboard.html'), 'utf8');
const buildSha256 = createHash('sha256').update(html,'utf8').digest('hex');
const plain = value => JSON.parse(JSON.stringify(value));

function mount(saved = {}) {
  const errors = [], virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error.stack || String(error)));
  const context = new Proxy({measureText:t=>({width:String(t).length*7}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),setLineDash(){},getLineDash:()=>[],getTransform:()=>({})},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
  const dom = new JSDOM(html, {runScripts:'dangerously',url:'http://localhost/client-language-test',pretendToBeVisual:true,virtualConsole,beforeParse(window){
    window.structuredClone = global.structuredClone || plain;
    window.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
    window.HTMLCanvasElement.prototype.getContext=()=>context;
    window.scrollTo=()=>{};window.HTMLElement.prototype.scrollIntoView=()=>{};
    window.HTMLElement.prototype.getBoundingClientRect=function(){return {x:0,y:0,left:0,top:0,right:1100,bottom:440,width:1100,height:440};};
    Object.defineProperty(window.HTMLElement.prototype,'clientWidth',{get(){return 1100;}});
    Object.defineProperty(window.HTMLElement.prototype,'clientHeight',{get(){return 440;}});
    window.URL.createObjectURL=()=> 'blob:client-language-test';window.URL.revokeObjectURL=()=>{};
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

// Read-only test access to the real renderers. Production files and API stay unchanged.
const mainMarker='function modelNumberContent(q){';
assert.equal(html.split(mainMarker).length,2,'Main renderer marker is missing or ambiguous');
html=html.replace(mainMarker,`window.__clientLanguageQA={
 rows:()=>[...result.quarters,...result.annual],
 registry:()=>[...sourceMap.values()],
 inspect:(key,period,options={})=>{
  const row=(period.length===4?result.annual:result.quarters).find(q=>q.period===period);
  const info=modelNumberLineage(key,row,options);
  return {info,html:modelFormulaContext(key,row,options),rationale:modelAssumptionRationale(key,row,options,info)};
 },
 prepareItem:(root,period)=>decorateModelInputs(root,(period.length===4?result.annual:result.quarters).find(q=>q.period===period)),
 item:(key,period)=>{
  const oldItem=modelItem,oldTopic=modelTopic;
  try{modelItem=key;modelTopic=modelTopicForItem(key);const q=(period.length===4?result.annual:result.quarters).find(x=>x.period===period);return modelItemsContent(q,q.profitDetail,CASE.profitModel?.quarters?.[period],q.profitDetail?.parameters);}
  finally{modelItem=oldItem;modelTopic=oldTopic;}
 }
};\n`+mainMarker);
const cloudMarker='function focusNumber(id,remember=true){';
assert.equal(html.split(cloudMarker).length,2,'Cloud renderer marker is missing or ambiguous');
html=html.replace(cloudMarker,`window.__clientCloudQA={descriptors:()=>[...clNumbers.values()],drivers:id=>clDriverSpecs(clNumbers.get(id)),registry:()=>data.sources||[]};\n`+cloudMarker);

const app=mount(),issues=[],counts={forecastNumbers:0,mainModelRows:0,analysisItems:0,analysisPanels:0,mainDescriptors:0,mainCalculations:0,mainAssumptions:0,actualDescriptors:0,baselineDescriptors:0,businessDescriptors:0,fixedInputs:0,citations:0,cloudInitialDescriptors:0,cloudDescriptors:0,cloudCalculations:0,cloudAssumptions:0};
const issue=(scope,field,message,value)=>issues.push({scope,field,message,...(value!==undefined?{value:String(value).slice(0,350)}:{})});
const ensure=(condition,scope,field,message,value)=>{if(!condition)issue(scope,field,message,value);};
const asciiBrands=new Set(['YouTube','OpenAI','DeepMind','CoreWeave','AlphaFold','NetApp','iPhone','iPad','iOS','macOS','ChatGPT','GitHub','TikTok','PowerPoint','Baidu','nonGAAP','NonGAAP','TPUaaS','CapEx','OpEx','FactSet','Substack','Cloudflare','AppLovin','SaaS','IaaS','PaaS','YoY','QoQ','kWh']);
const internalPattern=/(?:\b(?:assets|scripts|outputs|references)\/[\w./-]+|\b(?:CASE|RESEARCH|CLOUD_DATA|WBM)\.|\boverrides(?:\[|\.)|\b(?:calculateCase|calculateProfitQuarter|cloudProfitBuild|quarter_rollup|annual_extension|profitDetail|sourceRefs|parameterKey)\b|\b(?:Model|Expense Drivers|New Driver|Non-Core Losses|Q PP&E)![A-Z]+\d+|\b(?:[A-Za-z][\w-]*\.)+(?:mjs|cjs|js|json|py|xlsx|xlsm)\b)/;
const camelPattern=/\b[A-Za-z][A-Za-z0-9]*[a-z][A-Z][A-Za-z0-9]*\b/g;
const language=(scope,field,text)=>{
 const value=String(text||'');
 const path=value.match(internalPattern);if(path)issue(scope,field,'Visible text contains an internal field, file or cell path',path[0]);
 const words=[...new Set(value.match(camelPattern)||[])].filter(x=>!asciiBrands.has(x));
 if(words.length)issue(scope,field,'Visible text contains untranslated camelCase labels',words.join(', '));
 if(/\b(?:NaN|undefined|Infinity)\b/.test(value))issue(scope,field,'Invalid rendered value',value);
};
try{
 const {win,doc,query,check,click,snapshot}=app;check();
 const main=win.__clientLanguageQA,cloud=win.__clientCloudQA;
 assert.ok(main&&cloud,'Audit hooks did not initialize');
 const before={main:snapshot('2027Q1'),history:snapshot('2026Q3'),cloud:plain(win.CloudApp.getResult()),storage:app.storage()};
 const mainRegistry=new Map(main.registry().map(s=>[s.id,s])),cloudRegistry=new Map(cloud.registry().map(s=>[s.id,s]));
 const registry=new Map([...win.eval('REVIEW_DATA.sources||[]'),...cloud.registry(),...main.registry()].map(s=>[s.id,s]));
 const sourceId=ref=>typeof ref==='string'?(registry.has(ref)?ref:ref.split(':')[0]):ref?.id;
 const inlineSourceURLs=new Map([['cloud-anthropic-s1-wind','https://m.wind.com.cn/mobwftweb/M/?code=885B502A5698&lan=zh&device=pc&terminaltype=COM.WINDRAG&version=26.5.0.39845&gateway=na#/NA/1AEB9390141B830B16DBFF1C7F0B6322']]);
 const resolveSource=ref=>typeof ref==='object'&&ref?ref:cloudRegistry.get(sourceId(ref))||registry.get(sourceId(ref));
 const checkRefs=(scope,refs)=>{for(const ref of refs||[]){
  const id=sourceId(ref),source=resolveSource(ref),inline=typeof ref==='object'&&!registry.has(id);
  ensure(registry.has(id)||(inline&&inlineSourceURLs.get(id)===source?.url&&source?.title&&(source?.date||source?.publicationDate)),scope,'sourceRefs','Source reference lacks a registered or verified inline record',id);
  if(typeof ref==='object'&&registry.has(id)&&ref.url)ensure(ref.url===registry.get(id).url,scope,'sourceRefs','Inline source changes its registered URL',id);
 }};
 const visible=(el,root)=>{
  if(!el)return false;
  for(let n=el;n&&n.nodeType===1;n=n.parentElement){
   if(n.hidden||n.style.display==='none')return false;
   if(n.tagName==='DETAILS'&&!n.open&&!n.querySelector(':scope > summary')?.contains(el))return false;
   if(n===root)break;
  }
  return true;
 };
 const visibleText=root=>{
  const walker=doc.createTreeWalker(root,win.NodeFilter.SHOW_TEXT),parts=[];
  while(walker.nextNode()){const n=walker.currentNode;if(n.parentElement&&!n.parentElement.closest('script,style')&&visible(n.parentElement,root))parts.push(n.nodeValue);}
  return parts.join(' ').replace(/\s+/g,' ').trim();
 };
 const field=(root,selector,scope,label,min=8)=>{
  const node=root.querySelector(selector);ensure(node&&visible(node,root),scope,label,'Required customer-facing explanation is not directly visible');
  if(node){const text=visibleText(node);ensure(text.length>=min,scope,label,'Explanation is missing or too short',text);language(scope,label,text);return text;}
  return '';
 };
 const citations=(root,scope,expectedRefs=[])=>{
  const nodes=[...root.querySelectorAll('[data-model-citation],[data-assumption-citation],[data-assumption-source-record]')];
  const actual=new Set();
  for(const node of nodes){
   if(!visible(node,root))continue;
   const id=node.dataset.modelCitation||node.dataset.assumptionCitation||node.dataset.assumptionSourceRecord;actual.add(id);counts.citations++;
   const source=mainRegistry.get(id);ensure(!!source,scope,'citation','Displayed citation is not a registered source',id);if(!source)continue;
   if(node.tagName==='A'){
    const href=node.getAttribute('href'),allowed=[source.url,source.localDocumentUrl].filter(Boolean);
    ensure(allowed.includes(href),scope,'citation','Citation URL is not the recorded source URL',href);
    ensure(/^(?:https?:|file:)\/\//i.test(href||''),scope,'citation','Source uses a fake or unsupported report URL',href);
   }else ensure(node.tagName==='BUTTON'||node.querySelector('button'),scope,'citation','Missing document should use a source record action',id);
  }
  for(const ref of expectedRefs||[]){const id=sourceId(ref);if(registry.has(id))ensure(actual.has(id),scope,'citation','Declared source is not directly linked or available as a source record',id);}
  return actual;
 };
 const cloudCitations=(root,scope,refs=[])=>{
  const sources=refs.map(resolveSource).filter(Boolean);
  if(sources.some(s=>s.id==='cloud-ms-implied-baseline')&&!sources.some(s=>s.id==='cloud-ms-model'))sources.push(registry.get('cloud-ms-model'));
  const allowed=new Set(sources.filter(Boolean).flatMap(s=>[s.url,s.localDocumentUrl]).filter(url=>/^(?:https?:|file:)\/\//i.test(url||'')));
  const actual=new Set();
  for(const link of root.querySelectorAll('.cl-key-source-links a')){
   if(!visible(link,root))continue;
   const href=link.getAttribute('href');actual.add(href);counts.citations++;
   ensure(allowed.has(href),scope,'citation','Cloud citation URL is not an input source URL',href);
  }
  for(const url of allowed)ensure(actual.has(url),scope,'citation','Cloud input source is not directly linked',url);
 };
 const inspectAssumptions=(root,scope,baseline=false)=>{
  for(const card of root.querySelectorAll('[data-assumption-key]')){
   if(!visible(card,root))continue;
   const key=card.dataset.assumptionKey,parameter=card.dataset.assumptionParameter,period=card.dataset.assumptionPeriod;
   const itemScope=scope+' / input '+key+' '+period;
   field(card,'[data-assumption-rationale]',itemScope,'assumptionRationale',25);
   field(card,'[data-assumption-source]',itemScope,'assumptionSource',6);
   const audit=card.querySelector('details[data-assumption-audit]');ensure(!audit||!audit.open,itemScope,'audit','Technical audit is expanded by default');
   const input=card.querySelector('[data-number-edit]');if(baseline)ensure(!input,itemScope,'baseline','Frozen baseline is editable');
   // The Cloud growth editor uses the segment's canonical input identity,
   // while its provenance describes the pre-allocation revenue target.
   const lineageKey=key==='cloud'&&parameter==='segmentGrowthYoY'?'cloudTargetGrowth':key;
   let described=main.inspect(lineageKey,period,{...(lineageKey===key?{parameter}:{}),...(baseline?{baseline:true}:{})});
   // Fixed source assumptions have no editable parameter; their card still carries
   // the UI's default "driver" identity. Inspect the original number in that case.
   if(described.info.kind!=='assumption')described=main.inspect(lineageKey,period,baseline?{baseline:true}:{});
   checkRefs(itemScope,described.rationale?.sourceRefs);citations(card,itemScope,described.rationale?.sourceRefs);
   if(!described.rationale?.sourceRefs?.length){
    ensure(/我们|研究|用户|客户|情景|资料暂缺/.test(visibleText(card)),itemScope,'researchSource','Uncited assumption does not identify an explicit research or user basis');
    ensure(!!card.querySelector('[data-assumption-analysis]')||(described.rationale?.paragraphs||[]).length>=2||/资料暂缺/.test(visibleText(card)),itemScope,'researchSource','Uncited research assumption lacks its specific analysis explanation');
   }
  }
 };
 const scratch=doc.createElement('section');scratch.id='clientLanguageInspection';doc.body.append(scratch);
 const queue=[],seen=new Set();
 const add=(key,period,options={},reason='dependency')=>{if(key&&period)queue.push({key,period,options,reason});};
 const buttonSpec=b=>({key:b.dataset.modelNumber,period:b.dataset.modelPeriod,options:{...(b.dataset.numberParameter?{parameter:b.dataset.numberParameter}:{}),...(b.dataset.numberBaseline?{baseline:true}:{})}});
 const rowKeys=[...doc.querySelectorAll('#modelGrid tbody th [data-model-item]')].map(x=>x.dataset.modelItem);counts.mainModelRows=rowKeys.length;
 for(const cell of doc.querySelectorAll('#modelGrid td[data-model-period]')){
  if(cell.dataset.modelValue==='')continue;
  const b=cell.querySelector('[data-model-number]');if(!b)continue;
  const {key,period,options}=buttonSpec(b),kind=b.dataset.numberKind;
  if(kind==='assumption'||kind==='calculation'){counts.forecastNumbers++;add(key,period,options,'forecast-cell');}
 }
 for(const key of rowKeys){add(key,'2026Q3',{},'actual-cell');add(key,key==='msEps'?'2027':'2027Q1',{baseline:true},'frozen-baseline');}
 for(const key of ['revenue','cloud','search','sbc','depreciation','cloudOperatingIncome','eps'])add(key,'2028',{},'annual-extension');

 // Render all item-name views with the actual renderer, then traverse every number it exposes.
 const allItems=[...new Set([...rowKeys,'youtubeSubs','otherSubs','workspace','traditional','ai','tpu','servers','otherAssets','depAllocation','depImpact','cloudCost','cloudResidual','sharedCost','manualCost','attribution'])];
 for(const key of allItems){
  const scope='item '+key+' 2027Q1';scratch.innerHTML=main.item(key,'2027Q1');main.prepareItem(scratch,'2027Q1');
  const selected=scratch.querySelector(':scope > [data-detail-item]');
  ensure(!!selected,scope,'item','Financial item does not render its own analysis');if(!selected)continue;selected.open=true;counts.analysisItems++;
  language(scope,'visibleItem',visibleText(scratch));inspectAssumptions(scratch,scope);
  for(const panel of scratch.querySelectorAll('details.mi-evidence')){
   panel.open=true;counts.analysisPanels++;
   const panelScope=scope+' / '+panel.querySelector('summary')?.textContent;
   language(panelScope,'visibleItem',visibleText(panel));inspectAssumptions(panel,panelScope);panel.open=false;
  }
  for(const b of scratch.querySelectorAll('[data-model-number]')){const x=buttonSpec(b);add(x.key,x.period,x.options,'item-number');}
 }
 ensure(counts.forecastNumbers>=310,'coverage','forecast','Not all populated forecast numbers were inspected',counts.forecastNumbers);
 ensure(counts.mainModelRows===40,'coverage','rows','The complete main model was not inspected',counts.mainModelRows);
 while(queue.length){
  const spec=queue.shift(),identity=JSON.stringify([spec.key,spec.period,spec.options.parameter||'',!!spec.options.baseline]);
  if(seen.has(identity))continue;seen.add(identity);
  const scope='number '+spec.key+' '+spec.period+(spec.options.parameter?' '+spec.options.parameter:'')+(spec.options.baseline?' baseline':'');
  let rendered;try{rendered=main.inspect(spec.key,spec.period,spec.options);}catch(error){issue(scope,'render','Number renderer threw',error.message);continue;}
  const info=rendered.info;counts.mainDescriptors++;if(spec.options.baseline)counts.baselineDescriptors++;if(spec.key.startsWith('business.'))counts.businessDescriptors++;
  language(scope,'label',info.name||info.label);checkRefs(scope,info.sourceRefs);checkRefs(scope,rendered.rationale?.sourceRefs);
  scratch.innerHTML=rendered.html;language(scope,'visibleText',visibleText(scratch));
  if(info.kind==='calculation'){
   counts.mainCalculations++;field(scratch,'[data-number-formula]',scope,'formula',8);field(scratch,'[data-number-substitution]',scope,'substitution',8);
   field(scratch,'[data-number-explanation]',scope,'calculationExplanation',8);
   const source=field(scratch,'[data-number-source]',scope,'calculationSource',12);
   ensure(!/^(?:来源[：:]?\s*)?(?:本模型计算|模型计算结果|按当前输入计算|依据模型计算)[。.]?$/.test(source),scope,'calculationSource','Calculation source is only a generic label',source);
   citations(scratch,scope,info.sourceRefs);
  }else if(info.kind==='assumption'){counts.mainAssumptions++;ensure(!!scratch.querySelector('[data-assumption-key]'),scope,'assumption','Assumption does not render an identified source card');}
  else if(info.kind==='actual'){counts.actualDescriptors++;field(scratch,'[data-number-source]',scope,'actualSource',8);citations(scratch,scope,info.sourceRefs);ensure(!scratch.querySelector('[data-number-edit]'),scope,'historical','Historical number is editable');}
  else ensure(info.kind==='missing',scope,'kind','Unknown number identity',info.kind);
  inspectAssumptions(scratch,scope,!!spec.options.baseline);
  for(const dep of info.dependencies||[]){
   checkRefs(scope+' / '+dep.label,dep.sourceRefs);language(scope,'dependencyLabel',dep.label);
   if(!dep.key||dep.navigable===false){
    if(typeof dep.value==='number'&&Number.isFinite(dep.value)){
     counts.fixedInputs++;ensure(String(dep.clientSource||'').length>=10,scope,'fixedInputSource','Fixed numeric input lacks a readable source',dep.label);
     language(scope,'fixedInputSource',dep.clientSource);
     const fixed=[...scratch.querySelectorAll('.formula-fixed-input')].find(el=>el.querySelector('span')?.textContent===dep.label);
     ensure(!!fixed,scope,'fixedInputSource','Fixed input is missing from formula inputs',dep.label);
     if(fixed){field(fixed,'[data-number-fixed-source]',scope+' / '+dep.label,'fixedInputSource',10);citations(fixed,scope+' / '+dep.label,dep.sourceRefs);}
    }
    continue;
   }
   add(dep.key,dep.period||spec.period,{...(dep.options||{}),...(dep.parameter?{parameter:dep.parameter}:{}),...(spec.options.baseline||dep.baseline?{baseline:true}:{})});
  }
  for(const b of scratch.querySelectorAll('[data-model-number]')){const x=buttonSpec(b);add(x.key,x.period,x.options);}
  if(seen.size>6000){issue('coverage','recursion','Main dependency traversal exceeded its bounded node limit');break;}
 }
 scratch.remove();

 // Cloud's real focusNumber renderer is cheap enough to inspect every numeric view.
 click('#modelGrid th [data-model-item="cloud"]');
 const cloudQueue=cloud.descriptors().map(x=>x.id),cloudSeen=new Set();counts.cloudInitialDescriptors=cloudQueue.length;
 ensure(cloudQueue.length>=334,'coverage','cloud','Cloud descriptor inventory is incomplete',cloudQueue.length);
 while(cloudQueue.length){
  const id=cloudQueue.shift();if(cloudSeen.has(id))continue;cloudSeen.add(id);
  const scope='cloud '+id;let entry=cloud.descriptors().find(x=>x.id===id);if(!entry){issue(scope,'descriptor','Cloud numeric reference does not resolve');continue;}
  try{ensure(win.CloudApp.focusNumber(id)!==false,scope,'render','Cloud numeric view did not open');check();}catch(error){issue(scope,'render','Cloud renderer threw',error.message);continue;}
  counts.cloudDescriptors++;const panel=query('#clNumberDetail');language(scope,'label',entry.label);language(scope,'visibleText',visibleText(panel));checkRefs(scope,entry.sources);cloudCitations(panel,scope,entry.sources);
  ensure(panel.dataset.clNumberId===id,scope,'selection','Cloud renderer changed the selected number');
  if(entry.kind==='calculated'){
   counts.cloudCalculations++;field(panel,'.cl-number-formula',scope,'formula',8);field(panel,'.cl-number-substitution',scope,'substitution',8);
   field(panel,'.cl-number-operation',scope,'calculationExplanation',12);field(panel,'.cl-number-data-source',scope,'calculationSource',12);
  }else if(entry.kind==='assumption'){
   counts.cloudAssumptions++;field(panel,'.cl-number-rationale',scope,'assumptionRationale',25);field(panel,'.cl-number-evidence-summary',scope,'assumptionSource',15);
  }else issue(scope,'kind','Unknown Cloud identity',entry.kind);
  for(const detail of panel.querySelectorAll('details.cl-number-analysis'))ensure(!detail.open,scope,'audit','Long Cloud source analysis starts expanded');
  for(const input of panel.querySelectorAll('[data-cl-param]')){
   const path=input.dataset.clParam;ensure(doc.querySelectorAll(`[data-cl-param="${path}"]`).length===1,scope,'input','Cloud numeric renderer duplicated an assumption editor',path);
  }
  for(const b of panel.querySelectorAll('[data-cl-number]'))cloudQueue.push(b.dataset.clNumber);
  for(const driver of cloud.drivers(id)||[]){
   language(scope,'driverLabel',driver.label);checkRefs(scope,driver.sources);
   if(driver.id&&!driver.fixed)cloudQueue.push(driver.id);
  }
  if(cloudSeen.size>2500){issue('coverage','cloudRecursion','Cloud traversal exceeded its bounded node limit');break;}
 }
 ensure(counts.businessDescriptors>100,'coverage','businessDependencies','Business formula dependency coverage is too small',counts.businessDescriptors);
 ensure(counts.baselineDescriptors>=40,'coverage','baseline','Frozen comparisons were not traversed',counts.baselineDescriptors);
 assert.deepEqual(snapshot('2027Q1'),before.main,'Read-only language traversal changed model values');
 assert.deepEqual(snapshot('2026Q3'),before.history,'Read-only language traversal changed history');
 assert.deepEqual(plain(win.CloudApp.getResult()),before.cloud,'Read-only language traversal changed Cloud calculation');
 assert.deepEqual(app.storage(),before.storage,'Read-only language traversal modified saved assumptions');
 app.uniqueIds();check();
 const result={result:issues.length?'fail':'pass',buildSha256,scope:'read-only recursive renderer audit; jsdom canvas/layout mocked',...counts,issues};
 if(process.env.CLIENT_LANGUAGE_REPORT)fs.writeFileSync(process.env.CLIENT_LANGUAGE_REPORT,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({...result,issues:issues.slice(0,35),remainingIssues:Math.max(0,issues.length-35)}));
 if(issues.length)process.exitCode=1;
}finally{app.dom.window.close();}
