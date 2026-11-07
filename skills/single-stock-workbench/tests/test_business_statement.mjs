import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculateCase,createScenario,parseScenario} from '../scripts/model.mjs';
import {solveMSProfit,cloudProfitBuild} from '../scripts/profit-model.mjs';
const c=JSON.parse(readFileSync(new URL('../assets/example-googl-case.json',import.meta.url),'utf8'));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`),get=p=>calculateCase(c,{'2027Q1':{profit:p}}).quarters.find(q=>q.period==='2027Q1');
const q=get({}),d=q.profitDetail,b=c.profitModel.quarters[q.period];
function reconcile(q){const parts=Object.values(q.profitDetail.businessParts),sum=f=>parts.reduce((s,x)=>s+(x[f]||0),0),pd=q.profitDetail;
 near(sum('revenue')+q.hedge,q.revenue);near(sum('grossProfit')+q.hedge,q.grossProfit);near(sum('da'),q.depreciation+q.amortization);near(sum('rd')+sum('sm')+sum('ga')+sum('otherOpex')+pd.cloudUnallocatedCost,q.opex);near(sum('operatingIncome')+q.hedge-pd.cloudUnallocatedCost,q.operatingIncome);
}
reconcile(q);
for(const [key,row] of Object.entries(d.businessParts)){
 const unchanged=get({[key+'GrossMargin']:row.grossMargin});near(unchanged.grossProfit,q.grossProfit);near(unchanged.operatingIncome,q.operatingIncome);
 const improved=get({[key+'GrossMargin']:row.grossMargin+.01});near(improved.grossProfit-q.grossProfit,row.revenue*.01);near(improved.operatingIncome-q.operatingIncome,row.revenue*.01);near(improved.netIncome-q.netIncome,row.revenue*.01*(1-q.taxRate));reconcile(improved);
 const life=get({[key+'GrossMargin']:row.grossMargin,serverLife:8});near(life.operatingIncome-q.operatingIncome,q.depreciation-life.depreciation);assert.ok(life.eps>q.eps);reconcile(life);
}
const zero=calculateCase(c,{'2027Q1':{segmentGrowthYoY:{search:-1,network:-1,youtube:-1,subs:-1,bets:-1},profit:{workspaceRevenue:0,traditionalRevenue:0,aiRevenue:0,tpuRevenue:10000}}}).quarters.find(q=>q.period==='2027Q1');reconcile(zero);
const overrides={'2027Q1':{profit:{searchGrossMargin:.6,aiGrossMargin:.3,serverLife:8}}};assert.deepEqual(parseScenario(c,createScenario(c,overrides)).overrides,overrides);
const current=get(overrides['2027Q1'].profit);near(current.profitDetail.attribution.reduce((s,x)=>s+x.operatingIncome,0),current.operatingIncome-q.operatingIncome);
const p={...d.parameters,aiGrossMargin:.3},solution=solveMSProfit(b,p);assert.ok(solution.feasible);near(cloudProfitBuild({...p,...solution.changes},b).totals.operatingIncome,b.cloudOperatingIncome);
assert.throws(()=>get({aiGrossMargin:1}));assert.throws(()=>get({searchGrossMargin:NaN}));
console.log('PASS: ten-business aggregation, margin-to-profit derivative, independent depreciation under margin overrides, zero revenue allocation, persistence and MS refit');
