import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculateCloudCase,solveMSCloudRevenue} from '../scripts/cloud-model.mjs';
import {cloudProfitBuild,solveMSProfit} from '../scripts/profit-model.mjs';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const data=read('../assets/cloud-inputs.json'),c=read('../assets/example-googl-case.json');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const before=JSON.stringify(data),base=calculateCloudCase(data);
for(const q of base.quarters){
 const b=c.profitModel.quarters[q.period],p=b.parameters;
 near(q.cloudRevenueBn*1000,b.cloudRevenue);near(p.workspaceRevenue+p.traditionalRevenue,q.enterpriseRevenueBn*1000);
 near(p.aiRevenue,Object.values(q.customerRevenueBn).reduce((a,b)=>a+b,0)*1000);near(p.tpuRevenue,q.externalTPURevenueBn*1000);
 near(p.cloudUnallocatedCost,0);near(cloudProfitBuild(p,b).totals.operatingIncome,b.cloudOperatingIncome);
 const changed={...p,aiRevenue:p.aiRevenue*1.1};
 assert.notEqual(cloudProfitBuild(changed,b).totals.operatingIncome,b.cloudOperatingIncome);
 const solution=solveMSProfit(b,changed);assert.ok(solution.feasible);
 near(cloudProfitBuild({...changed,...solution.changes},b).totals.operatingIncome,b.cloudOperatingIncome);
 assert.equal(solveMSProfit(b,{...p,workspaceRevenue:0,traditionalRevenue:0,aiRevenue:0,tpuRevenue:0}).feasible,false);
}
for(const method of ['enterprise','tpu']){
 const o={'global.customerBudgetMultiplier':.95},s=solveMSCloudRevenue(data,o,method);assert.ok(s.feasible);
 for(const row of s.rows)near(row.targetRevenueBn,row.achievedRevenueBn);
 assert.deepEqual(o,{'global.customerBudgetMultiplier':.95});
}
const zero=solveMSCloudRevenue(data,{'global.tpuVolumeMultiplier':0},'tpu');assert.equal(zero.feasible,false);assert.equal(zero.overrides,null);
const arr=solveMSCloudRevenue(data,{'enterprise.sequentialGrowth':[.1,.1,.1,.1,.1]},'enterprise');assert.ok(arr.feasible);
assert.equal(JSON.stringify(data),before);
console.log('PASS: MS revenue/profit inverse solutions, aligned business composition, zero residual, no automatic refit, infeasible delivery and immutable inputs');
