/** Quarterly scenario arithmetic. All amounts are USD mn; rates are decimals. */
import {validateProfitChanges,profitRevenueInputs,calculateProfitQuarter,profitAttribution} from './profit-model.mjs';
export const SCENARIO_LIMITS = Object.freeze({
  segmentGrowthYoY: [-1, 10], grossMargin: [0, 1], opexRatio: [0, 2],
  rdRatio: [0, 2], smRatio: [0, 2], gaRatio: [0, 2],
  taxRate: [-1, 1], otherIncome: [-1e9, 1e9], dilutedShares: [0.000001, 1e9], preferredDividends:[0,1e9]
});

const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value, name) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${name} 必须是有限数值`);
  return value;
};
const sum = values => values.reduce((total, value) => total + value, 0);
const daysIn = period => {
  const year = Number(period.slice(0, 4)), quarter = Number(period.slice(-1));
  return (Date.UTC(year, quarter * 3, 1) - Date.UTC(year, (quarter - 1) * 3, 1)) / 86400000;
};
const priorPeriod = period => `${Number(period.slice(0, 4)) - 1}Q${period.slice(-1)}`;

/** Strict allowlist used by the UI and by callers importing scenario JSON. */
export function validateOverrides(caseData, overrides = {}) {
  if (!record(overrides)) throw new TypeError('overrides 必须为期间到参数的对象');
  const quarters = new Map(caseData.quarters.map(quarter => [quarter.period, quarter]));
  const lastQuarterYear = caseData.quarters.map(quarter => quarter.period.slice(0, 4)).sort().at(-1);
  for (const row of caseData.annualBaselines || []) if (String(row.period) > lastQuarterYear) quarters.set(String(row.period), {...row, kind:'estimate'});
  const segmentKeys = new Set(caseData.segments.map(segment => segment.key));
  for (const [period, changes] of Object.entries(overrides)) {
    const quarter = quarters.get(period);
    if (!quarter) throw new TypeError(`未知期间：${period}`);
    if (quarter.kind !== 'estimate') throw new TypeError(`${period} 是公告实际期，不能修改`);
    if (!record(changes)) throw new TypeError(`${period} 参数必须是对象`);
    if (own(changes,'opexRatio') && ['rdRatio','smRatio','gaRatio'].some(key=>own(changes,key))) throw new TypeError(`${period} 不可同时覆盖总费用率与分项费用率`);
    for (const [key, value] of Object.entries(changes)) {
      if(key==='profit') {if(!caseData.profitModel?.quarters?.[period])throw new TypeError('该期间没有明细利润模型');validateProfitChanges(value);continue;}
      if (!own(SCENARIO_LIMITS, key)) throw new TypeError(`不支持的情景字段：${period}.${key}`);
      if (key === 'segmentGrowthYoY') {
        if (!record(value)) throw new TypeError(`${period}.segmentGrowthYoY 必须是对象`);
        for (const [segment, growth] of Object.entries(value)) {
          if (!segmentKeys.has(segment)) throw new TypeError(`未知板块：${segment}`);
          finite(growth, `${period}.${segment}`);
          if (growth < -1 || growth > 10) throw new RangeError(`${period}.${segment} 同比增速应在 -100% 至 1,000% 之间`);
        }
      } else {
        finite(value, `${period}.${key}`);
        const [minimum, maximum] = SCENARIO_LIMITS[key];
        if (value < minimum || value > maximum) throw new RangeError(`${period}.${key} 超出允许范围 ${minimum} 至 ${maximum}`);
        if (['rdRatio','smRatio','gaRatio'].includes(key) && !['rd','sm','ga'].every(field=>Number.isFinite(quarter[field]))) throw new TypeError(`${period} 缺少研发/销售/管理费用原始拆分`);
      }
    }
  }
  return true;
}

function expenseDrivers(original) {
  const split = ['rd','sm','ga'].every(key => Number.isFinite(original[key]));
  return {rdRatio: split ? original.rd/original.revenue : null, smRatio: split ? original.sm/original.revenue : null,
    gaRatio: split ? original.ga/original.revenue : null, otherOpexRatio: split ? (original.opex-original.rd-original.sm-original.ga)/original.revenue : null};
}
function calculateExpenses(original, revenue, drivers, changes) {
  if (!['rdRatio','smRatio','gaRatio'].every(key=>Number.isFinite(drivers[key]))) return {opex:revenue*drivers.opexRatio,rd:null,sm:null,ga:null,otherOpex:null};
  if (own(changes,'opexRatio')) {
    const base=original.opex/original.revenue, scale=base ? drivers.opexRatio/base : 1;
    for (const key of ['rdRatio','smRatio','gaRatio','otherOpexRatio']) drivers[key] *= scale;
  }
  const rd=revenue*drivers.rdRatio,sm=revenue*drivers.smRatio,ga=revenue*drivers.gaRatio,otherOpex=revenue*drivers.otherOpexRatio;
  drivers.opexRatio=drivers.rdRatio+drivers.smRatio+drivers.gaRatio+drivers.otherOpexRatio;
  return {rd,sm,ga,otherOpex,opex:rd+sm+ga+otherOpex};
}

/**
 * Actual quarters retain reported numbers. Estimates start from broker drivers.
 * YoY growth applies to the simulated prior-year quarter, propagating changes.
 * Annual EPS = summed net income / calendar-day-weighted diluted shares.
 */
export function calculateCase(caseData, overrides = {}) {
  if (!record(caseData) || caseData.schemaVersion !== 1) throw new TypeError('仅支持 schemaVersion = 1');
  if (!Array.isArray(caseData.quarters) || !caseData.quarters.length) throw new TypeError('缺少季度数据');
  if (!Array.isArray(caseData.segments) || !caseData.segments.length) throw new TypeError('缺少业务板块定义');
  const keys = caseData.segments.map(segment => segment.key);
  if (new Set(keys).size !== keys.length || keys.some(key => typeof key !== 'string')) throw new TypeError('板块 key 必须唯一');
  const originals = new Map();
  for (const quarter of caseData.quarters) {
    if (!record(quarter) || !/^\d{4}Q[1-4]$/.test(quarter.period)) throw new TypeError('季度格式必须为 YYYYQ1 至 YYYYQ4');
    if (originals.has(quarter.period)) throw new TypeError(`重复季度：${quarter.period}`);
    if (!['actual', 'estimate'].includes(quarter.kind)) throw new TypeError(`${quarter.period} 缺少实际/预测标识`);
    if (!record(quarter.segments)) throw new TypeError(`${quarter.period} 缺少板块收入`);
    for (const key of keys) {
      finite(quarter.segments[key], `${quarter.period}.${key}`);
      if (quarter.segments[key] < 0) throw new RangeError(`${quarter.period}.${key} 收入不能为负`);
    }
    for (const field of ['revenue', 'hedge', 'cogs', 'opex', 'operatingIncome', 'otherIncome', 'taxRate', 'netIncome', 'eps', 'dilutedShares']) finite(quarter[field], `${quarter.period}.${field}`);
    if (quarter.revenue <= 0 || quarter.dilutedShares <= 0) throw new RangeError(`${quarter.period} 收入及稀释股数必须大于零`);
    if (quarter.days != null && (!(quarter.days > 0) || quarter.days > 100 || !Number.isFinite(quarter.days))) throw new RangeError(`${quarter.period} 天数无效`);
    originals.set(quarter.period, quarter);
  }
  validateOverrides(caseData, overrides);
  const warnings = [];
  const simulated = new Map();
  const quarters = [...originals.values()].sort((left, right) => left.period.localeCompare(right.period)).map(original => {
    const period = original.period, priorOriginal = originals.get(priorPeriod(period)), priorSimulated = simulated.get(priorPeriod(period));
    const changes = overrides[period] || {};
    const baseDrivers = {
      segmentGrowthYoY: Object.fromEntries(keys.map(key => [key, priorOriginal?.segments[key] > 0 ? original.segments[key] / priorOriginal.segments[key] - 1 : null])),
      grossMargin: 1 - original.cogs / original.revenue,
      opexRatio: original.opex / original.revenue,
      ...expenseDrivers(original),
      taxRate: original.taxRate, otherIncome: original.otherIncome, dilutedShares: original.dilutedShares,preferredDividends:original.preferredDividends||0
    };
    const drivers = {...baseDrivers, ...changes, segmentGrowthYoY: {...baseDrivers.segmentGrowthYoY, ...(changes.segmentGrowthYoY || {})}};
    let result = {...original, segments: {...original.segments}, days: original.days ?? daysIn(period), drivers, changedFields: Object.keys(changes), changed: false};
    if (original.kind === 'estimate') {
      const segments = {};
      for (const key of keys) {
        const growth = drivers.segmentGrowthYoY[key];
        if (growth == null || !priorSimulated) {
          if (own(changes.segmentGrowthYoY || {}, key)) throw new RangeError(`${period}.${key} 缺少非零去年同期收入，不能应用同比修改`);
          segments[key] = original.segments[key];
          if (!priorSimulated) warnings.push(`${period}.${key} 缺少去年同期数据，保留原始板块收入`);
        } else {
          if (own(changes.segmentGrowthYoY || {}, key) && !(priorOriginal.segments[key] > 0)) throw new RangeError(`${period}.${key} 去年同期收入为零，无法应用同比修改`);
          segments[key] = priorSimulated.segments[key] * (1 + growth);
        }
      }
      const profitBase=caseData.profitModel?.quarters?.[period];
      let profitDetail=null;
      if(profitBase){const p=profitRevenueInputs(profitBase,changes.profit||{},segments.cloud);segments.cloud=['workspace','traditional','ai','tpu'].reduce((s,k)=>s+p[k+'Revenue'],0);profitDetail=calculateProfitQuarter(profitBase,p,sum(Object.values(segments))+original.hedge-segments.cloud,segments);drivers.segmentGrowthYoY.cloud=priorSimulated?.segments.cloud>0?segments.cloud/priorSimulated.segments.cloud-1:null;}
      const revenue = sum(Object.values(segments)) + original.hedge;
      if (!(revenue > 0)) throw new RangeError(`${period} 情景总收入须大于零`);
      let cogs=profitDetail&&!own(changes,'grossMargin')?profitDetail.group.cogs:revenue*(1-drivers.grossMargin);
      const grossProfit=revenue-cogs;
      let expense=calculateExpenses(original,revenue,drivers,changes);
      if(profitDetail){
        if(!own(changes,'opexRatio')){for(const f of ['rd','sm','ga'])if(!own(changes,f+'Ratio'))expense[f]=profitDetail.group[f];expense.otherOpex=profitDetail.group.otherOpex;expense.opex=expense.rd+expense.sm+expense.ga+expense.otherOpex;}
        profitDetail.manualCostAdjustment=cogs+expense.opex-profitDetail.group.cogs-profitDetail.group.opex;
        profitDetail.attribution=profitAttribution(profitBase,profitDetail.parameters,segments,original.hedge,cogs-profitDetail.group.cogs,expense.opex-profitDetail.group.opex);
        profitDetail.manualOverrides=['grossMargin','opexRatio','rdRatio','smRatio','gaRatio'].filter(k=>own(changes,k));
        drivers.grossMargin=grossProfit/revenue;drivers.opexRatio=expense.opex/revenue;for(const f of ['rd','sm','ga'])drivers[f+'Ratio']=expense[f]/revenue;
      }
      const opex=expense.opex,operatingIncome=grossProfit-opex;
      const pretaxIncome = operatingIncome + drivers.otherIncome;
      const netIncome = pretaxIncome * (1 - drivers.taxRate), dilutedEarnings=netIncome-drivers.preferredDividends,eps = dilutedEarnings / drivers.dilutedShares;
      result = {...result, segments, revenue, cogs, ...expense, grossProfit, operatingIncome, otherIncome: drivers.otherIncome, taxRate: drivers.taxRate, dilutedShares: drivers.dilutedShares,preferredDividends:drivers.preferredDividends,dilutedEarnings,netIncomeAvailableToCommon:dilutedEarnings, pretaxIncome, netIncome, eps};
      if(profitDetail){result.profitDetail=profitDetail;for(const f of ['sbc','depreciation','amortization','sbcTaxBenefit','cloudOperatingIncome'])result[f]=profitDetail[f];}
      if (![revenue, cogs, opex, operatingIncome, netIncome, eps].every(Number.isFinite)) throw new RangeError(`${period} 计算结果不是有限数值`);
      if (pretaxIncome < 0) warnings.push(`${period} 税前利润为负，仍按有效税率代数计算；未单独模拟递延税项或亏损抵扣限制`);
      result.changed = Object.keys(changes).length > 0 || keys.some(key => Math.abs(segments[key] - original.segments[key]) > 1e-7);
    } else {
      result.grossProfit = original.revenue - original.cogs;
      result.pretaxIncome = original.operatingIncome + original.otherIncome;
      result.preferredDividends=original.preferredDividends||0;
      result.dilutedEarnings=original.dilutedEarnings??original.netIncomeAvailableToCommon??(original.netIncome-result.preferredDividends);
      result.netIncomeAvailableToCommon=original.netIncomeAvailableToCommon??result.dilutedEarnings;
    }
    if(Number.isFinite(result.sbc)&&Number.isFinite(result.sbcTaxBenefit)){result.adjustedOperatingIncome=result.operatingIncome+result.sbc;result.adjustedNetIncome=result.netIncome+result.sbc-result.sbcTaxBenefit;result.adjustedEarnings=result.dilutedEarnings+result.sbc-result.sbcTaxBenefit;result.adjustedEps=result.adjustedEarnings/result.dilutedShares;}
    simulated.set(period, result);
    return result;
  });
  const annual = [];
  const years = [...new Set(quarters.map(quarter => quarter.period.slice(0, 4)))];
  for (const year of years) {
    const group = quarters.filter(quarter => quarter.period.startsWith(year));
    if (group.length !== 4) {
      warnings.push(`${year} 仅有 ${group.length} 个季度，不输出全年合计`);
      continue;
    }
    const days = sum(group.map(quarter => quarter.days));
    const dilutedShares = sum(group.map(quarter => quarter.dilutedShares * quarter.days)) / days;
    const row = {period: year, kind: group.every(quarter => quarter.kind === 'actual') ? 'actual' : 'estimate', complete: true, modelType:'quarter_rollup',quarterCount:4, days, dilutedShares,
      segments: Object.fromEntries(keys.map(key => [key, sum(group.map(quarter => quarter.segments[key]))])),
      sourceRefs: [...new Set(group.flatMap(quarter => quarter.sourceRefs || []))], changed: group.some(quarter => quarter.changed)};
    for (const field of ['revenue', 'hedge', 'cogs', 'opex', 'grossProfit', 'operatingIncome', 'otherIncome', 'pretaxIncome', 'netIncome','preferredDividends','dilutedEarnings','netIncomeAvailableToCommon']) row[field] = sum(group.map(quarter => quarter[field]));
    for (const field of ['capex', 'cfo','rd','sm','ga','otherOpex','sbc','depreciation','amortization']) row[field] = group.every(quarter => typeof quarter[field] === 'number' && Number.isFinite(quarter[field])) ? sum(group.map(quarter => quarter[field])) : null;
    row.eps = row.dilutedEarnings / dilutedShares;
    for(const f of ['sbcTaxBenefit','cloudOperatingIncome','adjustedOperatingIncome','adjustedNetIncome','adjustedEarnings'])row[f]=group.every(q=>Number.isFinite(q[f]))?sum(group.map(q=>q[f])):null;
    row.adjustedEps=row.adjustedEarnings==null?null:row.adjustedEarnings/dilutedShares;
    row.grossMargin = row.grossProfit / row.revenue;
    row.opexRatio = row.opex / row.revenue;
    row.taxRate = row.pretaxIncome === 0 ? null : (row.pretaxIncome - row.netIncome) / row.pretaxIncome;
    annual.push(row);
  }
  const lastQuarterYear=years.at(-1);
  const originalAnnual=new Map((caseData.annualBaselines||[]).map(row=>[String(row.period),row]));
  for(const original of [...originalAnnual.values()].filter(row=>String(row.period)>lastQuarterYear).sort((a,b)=>String(a.period).localeCompare(String(b.period)))){
    const year=String(original.period), priorYear=String(Number(year)-1), prior=annual.find(row=>row.period===priorYear), priorOriginal=originalAnnual.get(priorYear);
    if(!prior||!priorOriginal){warnings.push(`${year} 年度延展缺少完整前一年，未输出`);continue;}
    const changes=overrides[year]||{},baseGrowth=Object.fromEntries(keys.map(key=>[key,priorOriginal.segments[key]>0?original.segments[key]/priorOriginal.segments[key]-1:null]));
    const drivers={segmentGrowthYoY:baseGrowth,grossMargin:1-original.cogs/original.revenue,opexRatio:original.opex/original.revenue,...expenseDrivers(original),taxRate:original.taxRate,otherIncome:original.otherIncome,dilutedShares:original.dilutedShares,preferredDividends:original.preferredDividends||0,...changes};
    drivers.segmentGrowthYoY={...baseGrowth,...changes.segmentGrowthYoY};
    const segments=Object.fromEntries(keys.map(key=>{if(drivers.segmentGrowthYoY[key]==null){if(own(changes.segmentGrowthYoY||{},key))throw new RangeError(`${year}.${key} 缺少非零去年收入`);return [key,original.segments[key]];}return[key,prior.segments[key]*(1+drivers.segmentGrowthYoY[key])];}));
    const revenue=sum(Object.values(segments))+original.hedge;if(!(revenue>0))throw new RangeError(`${year} 年度总收入必须大于零`);
    const grossProfit=revenue*drivers.grossMargin,cogs=revenue-grossProfit,expense=calculateExpenses(original,revenue,drivers,changes),operatingIncome=grossProfit-expense.opex,pretaxIncome=operatingIncome+drivers.otherIncome,netIncome=pretaxIncome*(1-drivers.taxRate),dilutedEarnings=netIncome-drivers.preferredDividends,eps=dilutedEarnings/drivers.dilutedShares;
    annual.push({...original,period:year,kind:'estimate',complete:false,modelType:'annual_extension',quarterCount:0,segments,revenue,cogs,grossProfit,...expense,operatingIncome,pretaxIncome,otherIncome:drivers.otherIncome,taxRate:drivers.taxRate,dilutedShares:drivers.dilutedShares,preferredDividends:drivers.preferredDividends,dilutedEarnings,netIncomeAvailableToCommon:dilutedEarnings,netIncome,eps,grossMargin:drivers.grossMargin,opexRatio:drivers.opexRatio,drivers,changedFields:Object.keys(changes),changed:Object.keys(changes).length>0||prior.changed});
  }
  return {quarters, annual, warnings: [...new Set(warnings)]};
}

/** Translate a full-year driver into only the unreported quarters. */
export function setAnnualDriver(caseData, overrides, year, field, value, segment) {
  year=String(year);const next=JSON.parse(JSON.stringify(overrides||{})), current=calculateCase(caseData,next), annual=current.annual.find(row=>row.period===year);
  if(!annual)throw new TypeError(`${year} 没有完整年度可勾稽`);
  if(annual.modelType==='annual_extension'){next[year]??={};if(segment){next[year].segmentGrowthYoY??={};next[year].segmentGrowthYoY[segment]=value;}else{if(field==='opexRatio')for(const k of ['rdRatio','smRatio','gaRatio'])delete next[year][k];else if(['rdRatio','smRatio','gaRatio'].includes(field))delete next[year].opexRatio;next[year][field]=value;}calculateCase(caseData,next);return next;}
  const qs=current.quarters.filter(row=>row.period.startsWith(year)),future=qs.filter(row=>row.kind==='estimate'),actual=qs.filter(row=>row.kind==='actual');
  if(!future.length)throw new TypeError(`${year} 全年为实际期，不能修改`);
  const put=(q,key,v)=>{next[q.period]??={};if(key==='opexRatio')for(const k of ['rdRatio','smRatio','gaRatio'])delete next[q.period][k];else if(['rdRatio','smRatio','gaRatio'].includes(key))delete next[q.period].opexRatio;next[q.period][key]=v;};
  const futureRevenue=sum(future.map(q=>q.revenue));
  if(segment){const previous=current.annual.find(row=>row.period===String(Number(year)-1));if(!previous)throw new TypeError('缺少前一年全年收入');const remaining=previous.segments[segment]*(1+value)-sum(actual.map(q=>q.segments[segment])),weights=sum(future.map(q=>q.segments[segment]));if(remaining<0||weights<=0)throw new RangeError('年度收入目标低于已实现收入或缺少季节性基数');for(const q of future){const prior=current.quarters.find(p=>p.period===priorPeriod(q.period));if(!(prior?.segments[segment]>0))throw new RangeError('缺少去年同季收入');next[q.period]??={};next[q.period].segmentGrowthYoY??={};if(segment==='cloud'&&next[q.period].profit)for(const k of ['workspace','traditional','ai','tpu'])delete next[q.period].profit[k+'Revenue'];next[q.period].segmentGrowthYoY[segment]=remaining*q.segments[segment]/weights/prior.segments[segment]-1;}}
  else if(field==='grossMargin'){const target=(annual.revenue*value-sum(actual.map(q=>q.grossProfit)))/futureRevenue;future.forEach(q=>put(q,field,target));}
  else if(['opexRatio','rdRatio','smRatio','gaRatio'].includes(field)){const amount={opexRatio:'opex',rdRatio:'rd',smRatio:'sm',gaRatio:'ga'}[field];if(actual.some(q=>!Number.isFinite(q[amount])))throw new TypeError('实际期缺少分项费用');const target=(annual.revenue*value-sum(actual.map(q=>q[amount])))/futureRevenue;future.forEach(q=>put(q,field,target));}
  else if(field==='otherIncome'){const remaining=value-sum(actual.map(q=>q.otherIncome)),days=sum(future.map(q=>q.days));future.forEach(q=>put(q,field,remaining*q.days/days));}
  else if(field==='preferredDividends'){const remaining=value-sum(actual.map(q=>q.preferredDividends||0)),days=sum(future.map(q=>q.days));future.forEach(q=>put(q,field,remaining*q.days/days));}
  else if(field==='dilutedShares'){const remaining=value*annual.days-sum(actual.map(q=>q.dilutedShares*q.days)),days=sum(future.map(q=>q.days));future.forEach(q=>put(q,field,remaining/days));}
  else if(field==='taxRate'){const forecastPretax=sum(future.map(q=>q.pretaxIncome)),actualTax=sum(actual.map(q=>q.pretaxIncome-q.netIncome));if(Math.abs(forecastPretax)<1e-9)throw new RangeError('剩余季度税前利润为零，不能反推税率');const target=(annual.pretaxIncome*value-actualTax)/forecastPretax;future.forEach(q=>put(q,field,target));}
  else throw new TypeError(`不支持年度字段 ${field}`);
  calculateCase(caseData,next);return next;
}

/** Contract method only: attributed Google contract × fulfillment − already modeled. */
export function contractCloudScenario(caseData, overrides, period, contractAmount, fulfillmentRatio, includedAmount) {
  finite(contractAmount,'可归属Google合同金额');finite(fulfillmentRatio,'本季履约比例');finite(includedAmount,'基准已包含金额');
  if(contractAmount<0||includedAmount<0||fulfillmentRatio<0||fulfillmentRatio>1)throw new RangeError('合同与已含金额不能为负；履约比例应为0%至100%');
  const base=calculateCase(caseData),current=calculateCase(caseData,overrides),original=base.quarters.find(q=>q.period===period),prior=current.quarters.find(q=>q.period===priorPeriod(period));
  if(!original||original.kind!=='estimate')throw new TypeError('合同情景只能应用于未来季度');
  if(!(prior?.segments.cloud>0))throw new TypeError('缺少Cloud去年同季收入');
  const increment=contractAmount*fulfillmentRatio-includedAmount,targetRevenue=original.segments.cloud+increment;
  if(targetRevenue<0)throw new RangeError('扣除基准已含金额后Cloud收入不能为负');
  const growth=targetRevenue/prior.segments.cloud-1,next=JSON.parse(JSON.stringify(overrides||{}));next[period]??={};next[period].segmentGrowthYoY??={};next[period].segmentGrowthYoY.cloud=growth;if(next[period].profit)for(const k of ['workspace','traditional','ai','tpu'])delete next[period].profit[k+'Revenue'];
  calculateCase(caseData,next);
  return {overrides:next,increment,baselineRevenue:original.segments.cloud,targetRevenue,baselineGrowth:original.drivers.segmentGrowthYoY.cloud,scenarioGrowth:growth};
}

/** Portable scenario envelope tied to the exact deterministic case content. */
export function createScenario(caseData, overrides = {}, title = '自定义情景') {
  if (typeof caseData.meta?.caseId !== 'string' || !caseData.meta.caseId) throw new TypeError('案例缺少内容版本 caseId，不能保存情景');
  if (typeof title !== 'string' || title.length > 200) throw new TypeError('情景名称须为不超过200字的文本');
  calculateCase(caseData, overrides);
  return {
    schemaVersion: 1, type: 'single-stock-scenario', ticker: caseData.meta.ticker,
    caseAsOf: caseData.meta.asOf, caseId: caseData.meta.caseId,
    updatedAt: new Date().toISOString(), title: title || '自定义情景',
    overrides: JSON.parse(JSON.stringify(overrides))
  };
}

/** Parse without touching the source case or mutating the imported object. */
export function parseScenario(caseData, value) {
  if (!record(value)) throw new TypeError('情景 JSON 顶层必须为对象');
  const allowed = new Set(['schemaVersion', 'type', 'ticker', 'caseAsOf', 'caseId', 'updatedAt', 'title', 'overrides']);
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new TypeError(`情景包含未知字段：${key}`);
  if (value.schemaVersion !== 1 || value.type !== 'single-stock-scenario') throw new TypeError('不支持此情景文件格式，请使用本工作台导出的 JSON');
  if (value.ticker !== caseData.meta.ticker) throw new TypeError('情景股票与当前案例不一致');
  if (value.caseAsOf !== caseData.meta.asOf) throw new TypeError('情景日期版本与当前快照不一致，请在对应版本的 HTML 中导入');
  if (typeof caseData.meta.caseId !== 'string' || !caseData.meta.caseId || value.caseId !== caseData.meta.caseId) throw new TypeError('情景内容版本 caseId 与当前快照不一致，不能将旧假设自动套到新模型');
  if (value.updatedAt != null && (typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt)))) throw new TypeError('情景保存时间无效');
  if (value.title != null && (typeof value.title !== 'string' || value.title.length > 200)) throw new TypeError('情景名称须为不超过200字的文本');
  if (!own(value, 'overrides')) throw new TypeError('情景缺少 overrides');
  calculateCase(caseData, value.overrides);
  return {...value, title: value.title || '导入情景', overrides: JSON.parse(JSON.stringify(value.overrides))};
}
