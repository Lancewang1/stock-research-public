import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculateCloudCase,runCloudSensitivity,requiredMSParameters,cloudPresets,resetCloudOverrides} from '../scripts/cloud-model.mjs';

const close=(a,b,label,tol=1e-7)=>assert.ok(Math.abs(a-b)<tol,`${label}: ${a} != ${b}`);
const periods=['2026Q4','2027Q1','2027Q2','2027Q3','2027Q4'];
const fixture={schemaVersion:1,asOf:'2026-11-05',forecastPeriods:periods,
 history:{quarters:[['2025Q4',15,20],['2026Q1',18,22],['2026Q2',20,25],['2026Q3',25,30]].map(([period,cloudRevenueBn,cashCapexBn])=>({period,cloudRevenueBn,cashCapexBn,publicationDate:'2026-10-28',kind:'actual'}))},
 parameters:{enterprise:{baseRevenueBn:16,sequentialGrowth:[.05,.05,.05,.05,.05],googleOwnedAssetShare:1},
  customers:{
   Anthropic:{baseRevenueBn:3,baseAverageAcceptedCapacityGW:1,computeBudgetBn:[10,12,14,16,18],trainingShare:.5,googleTrainingShare:.2,googleInferenceShare:.4,averageAcceptedCapacityGW:[1,1.2,1.4,1.6,1.8],utilization:.8,netServicePriceBnPerGWQuarter:4,googleOwnedAssetShare:.5,serviceMethod:'constrainedBudget'},
   OpenAI:{baseRevenueBn:2,baseAverageAcceptedCapacityGW:.5,computeBudgetBn:[4,4.4,4.8,5.2,5.6],trainingShare:.25,googleTrainingShare:.5,googleInferenceShare:.5,averageAcceptedCapacityGW:[.5,.6,.7,.8,.9],utilization:.9,netServicePriceBnPerGWQuarter:5,googleOwnedAssetShare:1,serviceMethod:'constrainedBudget'},
   otherAI:{baseRevenueBn:1,baseAverageAcceptedCapacityGW:.4,computeBudgetBn:[5,5,5,5,5],trainingShare:.5,googleTrainingShare:.2,googleInferenceShare:.2,averageAcceptedCapacityGW:[.4,.4,.4,.4,.4],utilization:.8,netServicePriceBnPerGWQuarter:4,googleOwnedAssetShare:1,serviceMethod:'constrainedBudget'}},
  externalTPU:{baseRevenueBn:3,capacitySoldGW:[.2,.3,.4,.5,.6],netPriceBnPerGW:[10,10,10,10,10]},
  capex:{baseCashCapexBn:30,nonCloudShare:.4,equipmentShare:.7,maintenanceRatio:.3,equipmentIntensityBnPerIncrementalServiceRevenueBn:3,facilityIntensityBnPerIncrementalServiceRevenueBn:2,aiEquipmentCostBnPerGW:12,aiFacilityCostBnPerGW:4,paymentLagQuarters:0}}};
const frozen=JSON.stringify(fixture),base=calculateCloudCase(fixture),q=base.quarters[0];
close(q.enterpriseRevenueBn,16.8,'independent residual enterprise recursion');
close(q.customers.Anthropic.trainingDemandRevenueBn,1,'training budget x share');
close(q.customers.Anthropic.inferenceDemandRevenueBn,2,'inference budget x share');
close(q.customers.Anthropic.revenueBn,3,'budget is binding');
close(q.customers.Anthropic.capacityRevenueBn,1*.8*4*92/90,'90-day price convention');
close(q.cloudRevenueBn,24.8,'five components reconcile');
close(q.capex.incrementalOwnedServiceRevenueBn,.8,'owned service growth excludes third-party portion');
close(q.capex.equipmentCashBn,6.18,'owned equipment maintenance plus incremental growth');
close(q.capex.facilitiesCashBn,3.22,'owned facilities maintenance plus incremental growth');
close(q.cashCapexBn,21.4,'group cash capex includes separately estimated non-Cloud spend');
close(base.annual[0].cloudRevenueBn,87.8,'2026 actual plus forecast');
close(base.annual[0].cashCapexBn,98.4,'2026 capex rollup');
assert.equal(base.annual[0].componentCoverage,'forecast_only');
assert.equal(base.annual[0].enterpriseRevenueBn,null,'unknown full-year historical split is not invented');
assert.equal(JSON.stringify(fixture),frozen,'data input remains immutable');

for(const row of base.quarters) {
 close(row.cloudRevenueBn,row.enterpriseRevenueBn+Object.values(row.customerRevenueBn).reduce((a,b)=>a+b,0)+row.externalTPURevenueBn,'Cloud component sum');
 for(const c of Object.values(row.customers))close(c.trainingRevenueBn+c.inferenceRevenueBn,c.revenueBn,'training/inference allocation');
 close(row.cashCapexBn,row.capex.equipmentCashBn+row.capex.facilitiesCashBn+row.capex.nonCloudCashBn,'cash capex components');
}
close(base.annual.find(a=>a.period==='2027').cloudRevenueBn,base.quarters.filter(q=>q.period.startsWith('2027')).reduce((a,b)=>a+b.cloudRevenueBn,0),'2027 quarter-year sum');

const demandStress=calculateCloudCase(fixture,{'global.customerBudgetMultiplier':10});
assert.equal(demandStress.quarters[0].customers.Anthropic.bindingConstraint,'capacity');
close(demandStress.quarters[0].customers.Anthropic.revenueBn,q.customers.Anthropic.capacityRevenueBn,'demand cannot exceed physical billing capacity');
const zeroCapacity=calculateCloudCase(fixture,{'global.capacityMultiplier':0});
for(const c of Object.values(zeroCapacity.quarters[0].customers))close(c.revenueBn,0,'zero accepted capacity gives zero constrained customer revenue');
const zeroBudget=calculateCloudCase(fixture,{'global.customerBudgetMultiplier':0});
for(const c of Object.values(zeroBudget.quarters[0].customers))close(c.revenueBn,0,'zero budget does not become missing or capacity revenue');
const contractArgs={'customers.Anthropic.serviceMethod':'contract','customers.Anthropic.reservedBillingFraction':.5};
const contract=calculateCloudCase(fixture,contractArgs).quarters[0].customers.Anthropic;
close(contract.reservedRevenueBn,1*4*92/90*.5,'reserved billing on accepted capacity');
close(contract.revenueBn,3,'reserved use is not billed twice');
close(contract.usageRevenueBn,3-contract.reservedRevenueBn,'extra use subtracts reserved use');
const contractLow=calculateCloudCase(fixture,{...contractArgs,'global.customerBudgetMultiplier':0,'global.utilizationMultiplier':0}).quarters[0].customers.Anthropic;
close(contractLow.revenueBn,contract.reservedRevenueBn,'zero usage and budget do not erase contracted floor');
assert.equal(contractLow.bindingConstraint,'reserved_floor');
close(contractLow.googleBudgetCoverage,0,'budget shortfall is visible');
const contractNotDelivered=calculateCloudCase(fixture,{...contractArgs,'global.capacityMultiplier':0}).quarters[0].customers.Anthropic;
close(contractNotDelivered.revenueBn,0,'undelivered capacity earns no reserved fee');
const noFloor=calculateCloudCase(fixture,{'customers.Anthropic.serviceMethod':'contract'});
close(noFloor.quarters[0].customers.Anthropic.revenueBn,q.customers.Anthropic.revenueBn,'zero floor retains old constrained scenario');
const fullyReserved=calculateCloudCase(fixture,{...contractArgs,'customers.Anthropic.reservedBillingFraction':1,'global.customerBudgetMultiplier':10}).quarters[0].customers.Anthropic;
close(fullyReserved.usageRevenueBn,0,'fully reserved capacity has no additional capacity sold twice');
close(fullyReserved.revenueBn,fullyReserved.fullCapacityRevenueBn,'fully reserved billing bounded by accepted capacity');
assert.throws(()=>calculateCloudCase(fixture,{...contractArgs,'customers.Anthropic.reservedBillingFraction':1.1}),/超出范围/);
const upstream=structuredClone(fixture);
Object.assign(upstream.parameters.customers.Anthropic,{budgetMethod:'revenueAndTraining',commercialRevenueRunRateBn:[40,44,48,52,56],inferenceCostRate:.2,trainingBudgetBn:[1,1.1,1.2,1.3,1.4]});
const upstreamBase=calculateCloudCase(upstream),upstreamHigher=calculateCloudCase(upstream,{'customers.Anthropic.commercialRevenueRunRateBn.0':80});
close(upstreamBase.quarters[0].customers.Anthropic.inferenceBudgetBn,2,'run rate / four x inference cost');
close(upstreamBase.quarters[0].customers.Anthropic.trainingBudgetBn,1,'training budget is separate');
close(upstreamBase.quarters[0].customers.Anthropic.computeBudgetBn,3,'upstream cost bridge');
close(upstreamBase.quarters[0].customers.Anthropic.revenueBn,1,'two separate Google shares');
close(upstreamHigher.quarters[0].customers.Anthropic.revenueBn,1.8,'run-rate input changes calculated Cloud service revenue');
close(upstreamHigher.quarters[0].cashCapexBn,upstreamBase.quarters[0].cashCapexBn,'demand run-rate does not erase or create already planned assets');
assert.throws(()=>calculateCloudCase(upstream,{'customers.Anthropic.computeBudgetBn.0':99}),/派生/);
assert.throws(()=>calculateCloudCase(upstream,{'customers.Anthropic.trainingShare':.4}),/派生/);
for(const shock of [{'global.netPriceMultiplier':.5},{'global.utilizationMultiplier':.5},{'global.customerBudgetMultiplier':.5}]) {
 const weaker=calculateCloudCase(fixture,shock);
 assert.ok(weaker.quarters[0].cloudRevenueBn<base.quarters[0].cloudRevenueBn);
 for(let i=0;i<5;i++)close(weaker.quarters[i].cashCapexBn,base.quarters[i].cashCapexBn,'fixed planned capacity investment survives demand/price/utilization decline');
}
const capped=calculateCloudCase(fixture,{'global.googleShareMultiplier':5,'global.utilizationMultiplier':2});
for(const c of Object.values(capped.quarters[0].customers))assert.ok(c.googleTrainingShare<=1&&c.googleInferenceShare<=1&&c.utilization<=1);
assert.ok(capped.warnings.length>0,'effective 100% ceilings are disclosed');

const tpu=calculateCloudCase(fixture,{'global.tpuVolumeMultiplier':2});
close(tpu.quarters[0].cloudRevenueBn-q.cloudRevenueBn,2,'TPU sales change revenue');
close(tpu.quarters[0].cashCapexBn,q.cashCapexBn,'external TPU inventory is not Google cash capex');
const outsourced={...fixture.parameters.customers};
const noOwned=structuredClone(fixture);
noOwned.parameters.enterprise.googleOwnedAssetShare=0;
for(const c of Object.values(noOwned.parameters.customers))c.googleOwnedAssetShare=0;
const outsourcedBase=calculateCloudCase(noOwned),outsourcedHigher=calculateCloudCase(noOwned,{'global.customerBudgetMultiplier':2,'global.capacityMultiplier':2});
assert.ok(outsourcedHigher.quarters[0].cloudRevenueBn>outsourcedBase.quarters[0].cloudRevenueBn);
close(outsourcedHigher.quarters[0].cashCapexBn,outsourcedBase.quarters[0].cashCapexBn,'third-party assets do not produce Google growth capex');
const lag=calculateCloudCase(fixture,{'capex.paymentLagQuarters':1,'global.equipmentCostMultiplier':2});
close(lag.quarters[0].capex.equipmentCashBn,12.6,'pre-forecast equipment pipeline uses disclosed base capex allocation');
close(lag.quarters[1].capex.equipmentCashBn,12.36,'one-quarter payment lag affects cash timing');
const idle=structuredClone(fixture);
idle.parameters.customers.Anthropic.averageAcceptedCapacityGW=[2,1,2,2,2];
idle.parameters.customers.OpenAI.averageAcceptedCapacityGW=[.5,.5,.5,.5,.5];
idle.parameters.customers.otherAI.averageAcceptedCapacityGW=[.4,.4,.4,.4,.4];
const idleResult=calculateCloudCase(idle);
close(idleResult.quarters[0].capex.incrementalCustomerOwnedCapacityGW,.5,'initial added assets acquired');
close(idleResult.quarters[2].capex.incrementalCustomerOwnedCapacityGW,0,'capacity rebound does not repurchase idle owned assets');

const edited=calculateCloudCase(fixture,{enterprise:{sequentialGrowth:[.1,.05,.05,.05,.05]}});
assert.ok(edited.quarters.every((r,i)=>r.enterpriseRevenueBn>base.quarters[i].enterpriseRevenueBn),'early enterprise growth propagates');
assert.deepEqual(edited.history,base.history,'historical actuals locked');
for(const d of edited.drivers)close(Object.values(d.components).reduce((a,b)=>a+b,0),d.cloudRevenueBn,'driver bridge reconciles');
assert.deepEqual(calculateCloudCase(fixture,resetCloudOverrides()),base,'reset restores exact research baseline');
assert.equal(cloudPresets().length,3);
for(const preset of cloudPresets())assert.equal(calculateCloudCase(fixture,preset.overrides).quarters.length,5);

for(const bad of [
 {'history.quarters.0.cloudRevenueBn':1},{'capex.baseCashCapexBn':0},{'customers.Anthropic.baseRevenueBn':8},
 {'not_a_parameter':1},{'customers.Anthropic.computeBudgetBn.5':3},{'customers.Anthropic.computeBudgetBn.-1':3},
 {'global.customerBudgetMultiplier':null},{'global.capacityMultiplier':NaN},{'customers.Anthropic.utilization':1.1},
 {'capex.paymentLagQuarters':.5},{'customers.Anthropic.serviceMethod':'budget_plus_capacity'},
 {'externalTPU.capacitySoldGW':[.1]},{'enterprise.sequentialGrowth':[-1,0,0,0,0]}
])assert.throws(()=>calculateCloudCase(fixture,bad));
const broken=structuredClone(fixture);broken.parameters.enterprise.baseRevenueBn=99;
assert.throws(()=>calculateCloudCase(broken),/勾稽/);
const missing=structuredClone(fixture);missing.parameters.customers.Anthropic.computeBudgetBn[2]=null;
assert.throws(()=>calculateCloudCase(missing),/缺失不能当零/);
const lookahead=structuredClone(fixture);lookahead.history.quarters[0].publicationDate='2026-11-06';
assert.throws(()=>calculateCloudCase(lookahead),/截止日/);

const withMS=structuredClone(fixture);
withMS.comparisons={ms:{publicationDate:'2026-08-24',quarters:base.quarters.map(r=>({period:r.period,cloudRevenueBn:r.cloudRevenueBn+2,cashCapexBn:r.cashCapexBn+3}))}};
const compared=calculateCloudCase(withMS);
assert.deepEqual(compared.quarters.map(r=>r.cloudRevenueBn),base.quarters.map(r=>r.cloudRevenueBn),'MS must not influence independent forecast');
close(compared.comparisons[0].quarters[0].cloudDeltaBn,-2,'MS difference direction');
const inverse=requiredMSParameters(withMS).find(r=>r.period==='2026Q4'),solution=inverse.solutions.find(s=>s.path==='global.enterpriseGrowthAdjustment');
assert.equal(solution.feasible,true);
close(calculateCloudCase(withMS,{[solution.path]:solution.value}).quarters[0].cloudRevenueBn,inverse.targetCloudRevenueBn,'inverse closes selected quarter MS gap',1e-6);
const capexSolution=inverse.capexSolutions.find(s=>s.path==='global.equipmentCostMultiplier');
assert.equal(capexSolution.feasible,true);
close(calculateCloudCase(withMS,{[capexSolution.path]:capexSolution.value}).quarters[0].cashCapexBn,inverse.targetCashCapexBn,'cash capex inverse closes selected quarter MS gap',1e-6);
const impossible=structuredClone(withMS);impossible.comparisons.ms.quarters[0].cloudRevenueBn=1e4;
assert.ok(requiredMSParameters(impossible)[0].solutions.every(s=>s.feasible===false),'impossible target is not a fabricated parameter');
for(const s of runCloudSensitivity(fixture)) {
 assert.ok(s.upCloudRevenueBn+1e-8>=s.downCloudRevenueBn,`${s.path} Cloud monotonicity`);
 assert.ok([s.baseCloudRevenueBn,s.downCloudRevenueBn,s.upCloudRevenueBn,s.baseCashCapexBn,s.downCashCapexBn,s.upCashCapexBn].every(Number.isFinite));
}

if(process.argv[2]) {
 const data=JSON.parse(readFileSync(process.argv[2],'utf8')),original=JSON.stringify(data),result=calculateCloudCase(data);
 assert.equal(result.quarters.length,5);assert.equal(result.quarters[0].period,'2026Q4');assert.equal(result.quarters.at(-1).period,'2027Q4');
 close(result.calibration.historicalReconciliationDifferenceBn,0,'real data historical split reconciliation');
 assert.equal(result.annual.find(a=>a.period==='2027').quarterCount,4);
 for(const preset of cloudPresets(data)) {
  const scenario=calculateCloudCase(data,preset.overrides);
  assert.deepEqual(scenario.history,result.history);
  for(const q of scenario.quarters)assert.ok(Number.isFinite(q.cloudRevenueBn)&&Number.isFinite(q.cashCapexBn));
 }
 assert.equal(JSON.stringify(data),original);
 console.log(JSON.stringify({input:process.argv[2],quarters:result.quarters.map(q=>({period:q.period,cloud:q.cloudRevenueBn,capex:q.cashCapexBn})),comparisons:result.comparisons.length}));
}
console.log('PASS: independent arithmetic, constraints, ownership, payment lag, historical locking, inverse targets, sensitivity and reset');
