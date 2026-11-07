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
  const dom = new JSDOM(html, {runScripts:'dangerously',url:'http://localhost/number-provenance-test',pretendToBeVisual:true,virtualConsole,beforeParse(window){
    window.structuredClone = global.structuredClone || plain;
    window.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
    window.HTMLCanvasElement.prototype.getContext=()=>context;
    window.scrollTo=()=>{};window.HTMLElement.prototype.scrollIntoView=()=>{};
    window.HTMLElement.prototype.getBoundingClientRect=function(){return {x:0,y:0,left:0,top:0,right:1100,bottom:440,width:1100,height:440};};
    Object.defineProperty(window.HTMLElement.prototype,'clientWidth',{get(){return 1100;}});
    Object.defineProperty(window.HTMLElement.prototype,'clientHeight',{get(){return 440;}});
    window.URL.createObjectURL=()=> 'blob:number-provenance-test';window.URL.revokeObjectURL=()=>{};
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
  const isVisible=el=>{
    if(!el)return false;
    for(let node=el;node&&node.nodeType===1;node=node.parentElement){
      if(node.hidden||win.getComputedStyle(node).display==='none')return false;
      if(node.tagName==='DETAILS'&&!node.open&&!node.querySelector(':scope > summary')?.contains(el))return false;
    }
    return true;
  };
  const numberButton=(key,period)=>query(`#modelGrid td [data-model-number="${key}"][data-model-period="${period}"]`);
  const numberKind=(key,period)=>numberButton(key,period).dataset.numberKind;
  const openNumber=(key,period)=>{numberButton(key,period).click();check();return query('#modelNumberProvenance');};
  const expectPanel=(key,period,kind)=>{
    const panel=query('#modelNumberProvenance');
    assert.ok(isVisible(panel),'Numeric provenance is not visible');
    assert.equal(panel.dataset.numberKey,key,'Numeric popup changed the clicked field');
    assert.equal(panel.dataset.numberPeriod,period,'Numeric popup changed the clicked period');
    assert.equal(panel.dataset.numberKind,kind,'Numeric popup contradicts table classification');
    assert.ok(!/NaN|undefined|Infinity/.test(panel.textContent),'Invalid number text in provenance');
    const source=query('[data-number-source]',panel);
    assert.ok(isVisible(source)&&source.textContent.trim().length>8,'Source is hidden or missing');
    if(kind==='calculation'){
      const formula=query('[data-number-formula]',panel),substitution=query('[data-number-substitution]',panel);
      assert.ok(isVisible(formula)&&formula.textContent.trim().length>5,'Formula requires another disclosure or is absent');
      assert.ok(isVisible(substitution)&&/\d/.test(substitution.textContent),'Current-period substitution is hidden or absent');
      assert.equal(panel.querySelectorAll('[data-number-edit]').length,0,'Calculated number exposes an unrelated direct assumption editor');
    }
    const otherPanels=[...doc.querySelectorAll('#modelItemTree > [data-detail-item]')].filter(isVisible);
    assert.ok(otherPanels.length<=1,'Numeric popup exposes sibling financial items');
    return panel;
  };
  const analysis=(key,period)=>{openNumber(key,period);click('#modelNumberProvenance [data-model-analysis]');check();};
  const reset=()=>{click('#modelDetailClose');click('#wbReset');};
  const baseline=snapshot('2027Q1'),actual=snapshot('2026Q3');
  const periods=['2026Q4','2027Q1','2027Q2','2027Q3','2027Q4','2026','2027','2028'];
  let forecastNumbers=0;
  for(const period of periods){
    for(const cell of doc.querySelectorAll(`#modelGrid td[data-model-period="${period}"]`)){
      if(cell.dataset.modelValue==='')continue;
      const button=query('[data-model-number]',cell),badge=query('[data-number-badge]',button);
      assert.ok(['assumption','calculation'].includes(button.dataset.numberKind),'Forecast value lacks assumption/calculation identity: '+period+'/'+button.dataset.modelNumber);
      assert.equal(badge.textContent.trim(),button.dataset.numberKind==='assumption'?'假设':'计算结果','Visible badge differs from numeric type');
      forecastNumbers++;
    }
  }
  assert.ok(forecastNumbers>200,'Forecast coverage is incomplete');

  const quarterKinds={revenue:'calculation',search:'calculation',cloud:'calculation',cogs:'calculation',grossProfit:'calculation',grossMargin:'calculation',rd:'calculation',operatingIncome:'calculation',otherIncome:'assumption',taxRate:'assumption',dilutedShares:'assumption',preferredDividends:'assumption',hedge:'assumption',amortization:'assumption',cfo:'assumption',eps:'calculation'};
  for(const [key,kind] of Object.entries(quarterKinds))assert.equal(numberKind(key,'2027Q1'),kind,'Wrong quarterly classification: '+key);
  for(const key of ['taxRate','dilutedShares','otherIncome','preferredDividends','revenue','eps'])assert.equal(numberKind(key,'2027'),'calculation','Annual aggregate treated as direct input: '+key);
  for(const key of ['taxRate','dilutedShares','otherIncome','preferredDividends'])assert.equal(numberKind(key,'2028'),'assumption','Annual-extension direct input treated as quarter rollup: '+key);
  assert.equal(numberKind('msEps','2027'),'assumption','External MS forecast treated as this model calculation');

  // Every populated financial line has a direct explanation for its selected number.
  const keys=[...doc.querySelectorAll('#modelGrid tbody th [data-model-item]')].map(x=>x.dataset.modelItem);
  assert.equal(keys.length,40);
  for(const key of keys){
    const period=key==='msEps'?'2027':'2027Q1';
    const cell=numberButton(key,period).closest('td');
    if(cell.dataset.modelValue==='')continue;
    const kind=numberKind(key,period);openNumber(key,period);expectPanel(key,period,kind);click('#modelDetailClose');
  }
  openNumber('dilutedShares','2027');
  assert.match(expectPanel('dilutedShares','2027','calculation').textContent,/天数|加权/,'Annual share weighting is unexplained');
  click('#modelDetailClose');
  openNumber('eps','2028');
  assert.match(expectPanel('eps','2028','calculation').textContent,/年度|2028/,'Annual-extension context is missing');
  click('#modelDetailClose');

  // Following one formula operand replaces the selected number and Back restores it.
  openNumber('eps','2027Q2');
  const operand=query('#modelNumberProvenance button[data-model-number]');
  const operandKey=operand.dataset.modelNumber,operandPeriod=operand.dataset.modelPeriod||'2027Q2';
  operand.click();check();
  assert.equal(query('#modelNumberProvenance').dataset.numberKey,operandKey,'Formula operand opens an unrelated number');
  assert.equal(query('#modelNumberProvenance').dataset.numberPeriod,operandPeriod,'Formula operand loses its period');
  click('#modelDetailNav [data-model-back]');
  expectPanel('eps','2027Q2','calculation');click('#modelDetailClose');

  // The original input stays editable directly from its own source popup, including 2028.
  for(const period of ['2027Q1','2028']){
    const epsBefore=value('eps',period),oldActual=snapshot('2026Q3');
    openNumber('taxRate',period);expectPanel('taxRate',period,'assumption');
    const input=query('#modelNumberProvenance [data-number-edit][data-number-key="taxRate"]');
    assert.ok(isVisible(input),'Assumption editor is hidden behind unrelated details');
    assert.equal(input.dataset.numberPeriod,period,'Assumption editor points at the wrong period');
    edit('#modelNumberProvenance [data-number-edit][data-number-key="taxRate"]',Number(input.value)+1);
    assert.ok(value('eps',period)<epsBefore,'Direct numeric assumption edit did not reach EPS: '+period);
    expectPanel('taxRate',period,'assumption');
    assert.deepEqual(snapshot('2026Q3'),oldActual,'Direct numeric editor modified actuals');
    reset();
  }

  // Tracing a frozen comparison must retain the frozen baseline through its operands.
  analysis('depreciation','2027Q1');click('#modelItemTree [data-model-item="servers"]');
  const life='#modelItemTree [data-profit="serverLife"]';reveal(life);const originalLife=Number(query(life).value);
  edit(life,originalLife+2);click('#modelDetailClose');
  analysis('depreciation','2027Q1');click('#modelItemTree [data-model-item="depImpact"]');
  click('#modelItemTree [data-model-number="servers"][data-number-baseline="true"]');
  const baselineLife=query('#modelNumberProvenance [data-model-number="serverLife"]');
  assert.equal(baselineLife.dataset.numberBaseline,'true','Frozen depreciation operand lost baseline context');
  baselineLife.click();check();
  const baselinePanel=expectPanel('serverLife','2027Q1','assumption');
  assert.equal(baselinePanel.querySelectorAll('[data-number-edit]').length,0,'Frozen comparison opened a current input editor');
  assert.equal(parseFloat(query('.number-current',baselinePanel).textContent),originalLife,'Frozen comparison shows the user override');
  assert.match(query('[data-number-source]',baselinePanel).textContent,/初始基准/,'Frozen input source loses baseline identity');
  reset();

  // Numeric identity changes with the real override state, not simply editability.
  analysis('grossMargin','2027Q1');
  const gm='#modelItemTree [data-model-earnings="grossMargin"]';reveal(gm);edit(gm,Number(query(gm).value)-1);
  assert.equal(numberKind('grossMargin','2027Q1'),'assumption','Direct margin override did not change provenance');
  assert.equal(numberKind('grossProfit','2027Q1'),'calculation','Derived gross profit was mislabeled as a user input');
  openNumber('grossMargin','2027Q1');assert.match(expectPanel('grossMargin','2027Q1','assumption').textContent,/用户|覆盖|自定义/,'User override source is not identified');
  reset();assert.equal(numberKind('grossMargin','2027Q1'),'calculation','Reset did not restore derived provenance');

  analysis('taxRate','2027Q1');const tax='#modelItemTree [data-model-earnings="taxRate"]';reveal(tax);
  const epsBefore=value('eps');edit(tax,Number(query(tax).value)+1);
  assert.ok(value('eps')<epsBefore,'Tax assumption failed to propagate into EPS');
  assert.equal(numberKind('taxRate','2027Q1'),'assumption');assert.equal(numberKind('taxRate','2027'),'calculation');
  const saved=app.storage();restored=mount(saved);restored.check();assert.deepEqual(restored.snapshot('2027Q1'),snapshot('2027Q1'),'Saved assumptions did not reconstruct financial result');restored.dom.window.close();restored=null;
  reset();

  // Source and formula dialogs must not broaden back into a group of editable siblings.
  for(const key of ['rd','sm','ga','taxRate','dilutedShares','sbc','amortization']){
    analysis(key,'2027Q1');
    const roots=[...doc.querySelectorAll('#modelItemTree > [data-detail-item]')].filter(isVisible);
    assert.equal(roots.length,1,'Analysis displays more than the clicked financial item: '+key);
    assert.equal(roots[0].dataset.detailItem,key,'Analysis opens the wrong financial item');
    click('#modelDetailClose');
  }

  // Cloud uses the same input/result distinction without exposing other customers.
  openNumber('cloud','2027Q1');expectPanel('cloud','2027Q1','calculation');
  click('#modelNumberProvenance [data-model-analysis]');
  click('#modelItemTree [data-model-topic="cloud"][data-model-item="cloud"]');
  assert.ok(isVisible(query('#modelCloudSlot')),'Cloud numeric analysis is unreachable');
  const cloudBefore=plain(win.CloudApp.getResult()),mainBefore=snapshot('2027Q1');
  const cloudInputs=[...doc.querySelectorAll('#cloudLab [data-cl-param]')];
  assert.ok(cloudInputs.length>50,'Cloud parameter coverage is incomplete');
  for(const input of cloudInputs){
    const badge=query(`[data-cl-number="param:${input.dataset.clParam}"]`);
    assert.equal(badge.dataset.clKind,input.readOnly?'calculated':'assumption','Cloud input has wrong numeric identity: '+input.dataset.clParam);
  }
  win.CloudApp.focusItem('Anthropic','2027Q1');check();
  assert.equal(query('#cloudLab [data-cl-current="true"]').dataset.clDetail,'item:Anthropic');
  for(const other of ['OpenAI','otherAI'])assert.equal(isVisible(query(`#cloudLab [data-cl-item="${other}"]`)),false,'Cloud shows unrelated customer: '+other);
  const cloudNumbers=[
    ['param:customers.Anthropic.averageAcceptedCapacityGW.1','assumption'],
    ['param:customers.Anthropic.commercialRevenueRunRateBn.1','assumption'],
    ['param:customers.Anthropic.computeBudgetBn.1','calculated'],
    ['metric:2027Q1:Anthropic:revenueBn','calculated']
  ];
  for(const [id,kind] of cloudNumbers){
    win.CloudApp.focusItem('Anthropic','2027Q1');check();
    const selector=`#cloudLab [data-cl-number="${id}"]`;reveal(selector);
    assert.ok(isVisible(query(selector)),'Cloud numeric entry is hidden: '+id);
    click(selector);const panel=query('#clNumberDetail');
    assert.ok(isVisible(panel),'Cloud numeric detail is hidden');
    assert.equal(panel.dataset.clNumberId,id,'Cloud clicked another number');
    assert.equal(panel.dataset.clKind,kind,'Cloud popup identity differs from its number');
    assert.ok(isVisible(query('.cl-number-basis',panel))&&query('.cl-number-basis',panel).textContent.trim().length>8,'Cloud basis missing');
    assert.ok(isVisible(query('.cl-number-sources',panel))&&query('.cl-number-sources',panel).textContent.trim().length>8,'Cloud sources missing');
    assert.equal(query('#clAssumptionAudit').hidden,true,'Cloud number popup still displays sibling items');
    if(kind==='calculated'){
      assert.ok(isVisible(query('.cl-number-formula',panel)),'Cloud formula is hidden');
      assert.ok(isVisible(query('.cl-number-substitution',panel))&&/\d/.test(query('.cl-number-substitution',panel).textContent),'Cloud current substitution missing');
      assert.equal(panel.querySelectorAll('[data-cl-param]').length,0,'Cloud calculated number contains an assumption editor');
    }else{
      const input=query('[data-cl-param]',panel);assert.ok(isVisible(input),'Cloud assumption editor is hidden');
      assert.equal(input.dataset.clParam,id.slice(6),'Cloud popup edits a different assumption');
      assert.equal(panel.querySelectorAll('[data-cl-param]').length,1,'Cloud popup exposes sibling assumptions');
      if(id.includes('averageAcceptedCapacityGW')){
        edit('#clNumberDetail [data-cl-param]',Number(input.value)*0.5);
        const next=plain(win.CloudApp.getResult()).quarters.find(q=>q.period==='2027Q1'),previous=cloudBefore.quarters.find(q=>q.period==='2027Q1');
        assert.ok(next.customerRevenueBn.Anthropic<previous.customerRevenueBn.Anthropic,'Cloud numeric assumption did not change its customer result');
        for(const other of ['OpenAI','otherAI'])assert.equal(next.customerRevenueBn[other],previous.customerRevenueBn[other],'Cloud numeric assumption changed unrelated customer');
        assert.deepEqual(snapshot('2027Q1'),mainBefore,'Cloud numeric editor applied its preview without explicit apply');
      }
    }
    click('#clNumberBack');assert.equal(query('#clDetailPeriod').value,'2027Q1','Cloud numeric return changed period');
  }
  const cloudPaths=[...doc.querySelectorAll('[data-cl-param]')].map(x=>x.dataset.clParam);
  assert.equal(new Set(cloudPaths).size,cloudPaths.length,'Cloud numeric detail duplicated editors');
  click('[data-cl-preset="base"]');assert.deepEqual(plain(win.CloudApp.getResult().annual),cloudBefore.annual,'Cloud numeric edit reset failed');
  click('#modelDetailClose');
  openNumber('revenue','2026Q3');
  const actualPanel=query('#modelNumberProvenance');assert.equal(actualPanel.dataset.numberKind,'actual');
  assert.equal(actualPanel.querySelectorAll('input:not([disabled]):not([readonly])').length,0,'Actual value exposes editing');
  click('#modelDetailClose');
  assert.deepEqual(snapshot('2026Q3'),actual,'Numeric inspection/editing changed actual history');
  assert.deepEqual(snapshot('2027Q1'),baseline,'Final reset failed');
  uniqueIds();check();
  console.log(JSON.stringify({result:'pass',scope:'non-visual numeric provenance; canvas mocked',forecastNumbers,financialEntries:40,directSourceAndFormula:true,quarterAnnualClassification:true,dynamicOverrideIdentity:true,directQuarterAndAnnualEditing:true,oneItemAtATime:true,cloudNumericProvenance:true,cloudCustomerIsolation:true,cloudPreviewOnly:true,persistence:true,actualHistoryLocked:true}));
 }finally{restored?.dom.window.close();app?.dom.window.close();}
}
main().catch(error=>{console.error(error.stack||String(error));process.exitCode=1;});
