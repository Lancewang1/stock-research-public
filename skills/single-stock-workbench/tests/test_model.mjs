import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculateCase, validateOverrides, createScenario, parseScenario, setAnnualDriver, contractCloudScenario} from '../scripts/model.mjs';

const close = (actual, expected, label, tolerance = 1e-8) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} != ${expected}`);
const fixture = {
  schemaVersion: 1,
  segments: [{key: 'search', label: 'Search'}, {key: 'cloud', label: 'Cloud'}],
  quarters: [2025, 2026, 2027].flatMap(year => [1,2,3,4].map(q => {
    const revenue = 100 * 1.1 ** (year - 2025), netIncome = (revenue * .3 + 5) * .8;
    return {period: `${year}Q${q}`, kind: year === 2025 ? 'actual' : 'estimate',
      segments: {search: revenue * .4, cloud: revenue * .6}, revenue, hedge: 0,
      cogs: revenue * .5, opex: revenue * .2, operatingIncome: revenue * .3,
      otherIncome: 5, taxRate: .2, netIncome, eps: netIncome / 10, dilutedShares: 10};
  }))
};
const frozenInput = JSON.stringify(fixture);
const baseline = calculateCase(fixture);
close(baseline.quarters.find(q => q.period === '2026Q4').eps, 3.04, 'baseline EPS');
const modified = calculateCase(fixture, {'2026Q4': {segmentGrowthYoY: {cloud: .15}, grossMargin: .49}});
const q4 = modified.quarters.find(q => q.period === '2026Q4');
close(q4.revenue, 113, 'Cloud growth affects consolidated revenue');
close(q4.netIncome, 30.216, 'independent profit bridge');
close(q4.eps, 3.0216, 'independent diluted EPS');
close(modified.annual.find(y => y.period === '2026').netIncome, 121.416, 'full-year profit with three unchanged quarters');
close(modified.quarters.find(q => q.period === '2027Q4').revenue, 124.3, 'following-year propagation');
assert.equal(JSON.stringify(fixture), frozenInput, 'input model is immutable');
assert.deepEqual(modified.quarters.filter(q => q.kind === 'actual'), baseline.quarters.filter(q => q.kind === 'actual'));
assert.deepEqual(modified.quarters.filter(q => ['2026Q1','2026Q2','2026Q3'].includes(q.period)), baseline.quarters.filter(q => ['2026Q1','2026Q2','2026Q3'].includes(q.period)));

const variableShares = structuredClone(fixture);
for (const q of variableShares.quarters.filter(q => q.period.startsWith('2025'))) {
  q.dilutedShares = q.period.endsWith('2') || q.period.endsWith('4') ? 20 : 10;
  q.eps = q.netIncome / q.dilutedShares;
}
const weighted = calculateCase(variableShares).annual.find(y => y.period === '2025');
close(weighted.dilutedShares, (90*10+91*20+92*10+92*20)/365, 'annual day-weighted shares');
close(weighted.eps, 112/weighted.dilutedShares, 'annual EPS uses income and weighted shares');
assert.ok(Math.abs(weighted.eps - 8.4) > .1, 'annual EPS must not sum quarterly EPS');

const partial = structuredClone(fixture);
partial.quarters = partial.quarters.filter(q => q.period !== '2027Q4');
assert.ok(!calculateCase(partial).annual.some(y => y.period === '2027'), 'partial year is not presented as full year');
for (const invalid of [
  {'2025Q4': {grossMargin: .5}}, {'2028Q1': {grossMargin: .5}},
  {'2026Q4': {dilutedShares: 0}}, {'2026Q4': {grossMargin: null}},
  {'2026Q4': {taxRate: NaN}}, {'2026Q4': {segmentGrowthYoY: {cloud: -1.1}}},
  {'2026Q4': {segmentGrowthYoY: {invented: .1}}}, {'2026Q4': {unexpected: 1}}
]) assert.throws(() => calculateCase(fixture, invalid));
const duplicate = structuredClone(fixture);
duplicate.quarters.push(duplicate.quarters[0]);
assert.throws(() => calculateCase(duplicate), /重复季度/);
const zeroBase = structuredClone(fixture);
zeroBase.quarters.find(q => q.period === '2025Q4').segments.cloud = 0;
assert.throws(() => calculateCase(zeroBase, {'2026Q4': {segmentGrowthYoY: {cloud: .2}}}), /去年同期/);

if (process.argv[2]) {
  const data = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const raw = JSON.stringify(data);
  const base = calculateCase(data);
  assert.ok(data.checks.every(c => c.status !== 'fail'), 'source reconciliation has no failed check');
  assert.equal(data.quarters.at(-1).period, '2027Q4', 'available quarterly forecast ends in 2027');
  assert.ok(data.annualBaselines.some(y => y.period === '2028'), '2028 annual reference remains available');
  const y2028=base.annual.find(y=>y.period==='2028');
  assert.equal(y2028.modelType,'annual_extension');
  assert.equal(y2028.quarterCount,0,'annual extension has no invented quarters');
  assert.equal(y2028.complete,false,'annual extension is not a quarterly rollup');
  for (const q of data.quarters) {
    close(Object.values(q.segments).reduce((a,b) => a+b,0) + q.hedge, q.revenue, `${q.period} segments`, .02);
    const calculated = base.quarters.find(c => c.period === q.period);
    close(calculated.revenue, q.revenue, `${q.period} baseline revenue`, .02);
    close(calculated.netIncome, q.netIncome, `${q.period} baseline income`, .1);
    close(calculated.eps, q.eps, `${q.period} baseline EPS`, .005);
  }
  validateOverrides(data, data.exampleScenario.overrides);
  const example = calculateCase(data, data.exampleScenario.overrides);
  const envelope = createScenario(data, data.exampleScenario.overrides, '演示情景 · 计算验证');
  const imported = parseScenario(data, JSON.parse(JSON.stringify(envelope)));
  assert.deepEqual(calculateCase(data, imported.overrides), example, 'scenario export/import preserves results');
  assert.throws(() => parseScenario(data, {...envelope, caseId: 'different-inputs-same-date'}), /caseId/);
  assert.throws(() => parseScenario(data, {...envelope, ticker: 'MSFT'}), /股票/);
  assert.throws(() => parseScenario(data, {...envelope, unknownField: 1}), /未知字段/);
  assert.throws(() => parseScenario(data, {...envelope, overrides: {'2026Q3': {taxRate: .1}}}), /不能修改/);
  imported.overrides['2026Q4'].grossMargin = .5;
  assert.notEqual(imported.overrides['2026Q4'].grossMargin, envelope.overrides['2026Q4'].grossMargin, 'imported edits do not mutate saved envelope');
  assert.deepEqual(base.quarters.filter(q => q.kind === 'actual'), example.quarters.filter(q => q.kind === 'actual'));
  assert.equal(JSON.stringify(data), raw);
  const q = example.quarters.find(q => q.period === '2026Q4');
  const b = base.quarters.find(q => q.period === '2026Q4');
  const y = example.annual.find(y => y.period === '2026');
  const by = base.annual.find(y => y.period === '2026');
  const secQ3=base.quarters.find(q=>q.period==='2026Q3');
  close(secQ3.eps,2.12,'SEC reported Q3 EPS retained');
  close(secQ3.dilutedEarnings,26170,'SEC ordinary diluted earnings numerator');
  assert.ok(Math.abs(secQ3.eps-secQ3.netIncome/secQ3.dilutedShares)>.01,'reported actual EPS includes preferred accounting');
  const dividend=calculateCase(data,{'2026Q4':{preferredDividends:298}}).quarters.find(q=>q.period==='2026Q4');
  close(dividend.netIncome,b.netIncome,'preferred dividend does not reduce company net income');
  close(dividend.eps,b.eps-298/b.dilutedShares,'preferred dividend reduces diluted EPS');
  const expense=calculateCase(data,{'2026Q4':{rdRatio:b.rd/b.revenue+.01}}).quarters.find(q=>q.period==='2026Q4');
  close(expense.operatingIncome,b.operatingIncome-b.revenue*.01,'R&D independently changes operating profit');
  close(expense.sm,b.sm,'R&D edit preserves S&M');
  close(expense.ga,b.ga,'R&D edit preserves G&A');
  assert.throws(()=>calculateCase(data,{'2026Q4':{opexRatio:.3,rdRatio:.1}}),/不可同时/);
  const annualOverrides=setAnnualDriver(data,{},2027,'segmentGrowthYoY',.5,'cloud');
  const annualResult=calculateCase(data,annualOverrides);
  close(annualResult.annual.find(y=>y.period==='2027').segments.cloud/base.annual.find(y=>y.period==='2026').segments.cloud-1,.5,'annual target reconciles four quarters');
  assert.deepEqual(annualResult.quarters.filter(q=>q.kind==='actual'),base.quarters.filter(q=>q.kind==='actual'));
  assert.throws(()=>setAnnualDriver(data,{},2025,'grossMargin',.6),/实际期/);
  const extensionOverrides=setAnnualDriver(data,annualOverrides,2028,'grossMargin',.6);
  close(calculateCase(data,extensionOverrides).annual.find(y=>y.period==='2028').grossMargin,.6,'annual extension is editable');
  const extensionEnvelope=createScenario(data,extensionOverrides,'annual extension');
  assert.deepEqual(parseScenario(data,extensionEnvelope).overrides,extensionOverrides,'annual overrides survive export/import');
  const contract=contractCloudScenario(data,{'2026Q4':{grossMargin:.6}},'2026Q4',1000,.25,100);
  close(contract.increment,150,'contract amount × fulfillment − already modeled');
  const contracted=calculateCase(data,contract.overrides).quarters.find(q=>q.period==='2026Q4');
  close(contracted.segments.cloud,b.segments.cloud+150,'contract applies incremental Cloud revenue');
  close(contracted.drivers.grossMargin,.6,'contract preserves user margin assumption');
  close(contracted.segments.search,b.segments.search,'contract leaves other segments alone');
  for(const args of [['2026Q3',1000,.25,100],['2028Q1',1000,.25,100],['2026Q4',null,.25,100],['2026Q4',1000,1.1,100],['2026Q4',-1,.25,100]])assert.throws(()=>contractCloudScenario(data,{},...args));
  console.log(JSON.stringify({example: {period: q.period, baselineRevenue: b.revenue, scenarioRevenue: q.revenue,
    baselineNetIncome: b.netIncome, scenarioNetIncome: q.netIncome, baselineEPS: b.eps, scenarioEPS: q.eps,
    yearEPS: y.eps, baselineYearEPS: by.eps}}, null, 2));
}
console.log('PASS: profit bridge, propagation, historical lock, annual EPS, incomplete years, input validation, source immutability.');
