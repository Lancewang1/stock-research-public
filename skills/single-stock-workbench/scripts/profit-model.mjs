/** Detailed Cloud profit bridge. USD million. Frozen calibration, no residual refit. */
export const PROFIT_BUSINESSES=['workspace','traditional','ai','tpu'];
export const PROFIT_LIMITS={
  workspaceRevenue:[0,1e7],traditionalRevenue:[0,1e7],aiRevenue:[0,1e7],tpuRevenue:[0,1e7],
  workspaceDirectRate:[0,2],traditionalDirectRate:[0,2],tpuDirectRate:[0,2],
  workspaceOpexRate:[0,2],traditionalOpexRate:[0,2],aiOpexRate:[0,2],tpuOpexRate:[0,2],
  aiThirdPartyShare:[0,1],aiThirdPartyCostRate:[0,2],aiOwnOperatingRate:[0,2],
  serverLife:[1,40],otherLife:[1,80],serverAssetMultiplier:[0,5],otherAssetMultiplier:[0,5],
  cloudDepShare:[0,1],workspaceDepShare:[0,1],traditionalDepShare:[0,1],
  depreciationCogsShare:[0,1],sbcMultiplier:[0,5],sbcTaxBenefitRate:[0,1],
  cloudSbcShare:[0,1],cloudUnallocatedCost:[-1e7,1e7]
};
export function validateProfitChanges(changes){
  if(!changes||typeof changes!=='object'||Array.isArray(changes))throw new TypeError('利润驱动参数必须是对象');
  for(const [k,v]of Object.entries(changes)){
    const limits=PROFIT_LIMITS[k];if(!limits)throw new TypeError('不支持的利润驱动：'+k);
    if(typeof v!=='number'||!Number.isFinite(v)||v<limits[0]||v>limits[1])throw new RangeError(k+' 超出允许范围 '+limits.join(' 至 '));
  }
}
export function profitRevenueInputs(base,changes,cloudTotal){
  validateProfitChanges(changes);const p={...base.parameters,...changes};
  if(p.workspaceDepShare+p.traditionalDepShare>1+1e-12)throw new RangeError('Workspace和传统GCP折旧分配合计不能超过100%');
  for(const k of PROFIT_BUSINESSES)if(!Object.hasOwn(changes,k+'Revenue'))p[k+'Revenue']=base.parameters[k+'Revenue']*cloudTotal/base.cloudRevenue;
  return p;
}
export function cloudProfitBuild(p,base){
  const revenue=PROFIT_BUSINESSES.reduce((s,k)=>s+p[k+'Revenue'],0);
  const depreciation=base.serverAssets*p.serverAssetMultiplier/p.serverLife/4+base.otherAssets*p.otherAssetMultiplier/p.otherLife/4;
  const amortization=base.amortization,sbc=base.sbc*p.sbcMultiplier,da=depreciation+amortization;
  const cloudDA=da*p.cloudDepShare,cloudSbc=sbc*p.cloudSbcShare;
  const depWeights={workspace:p.workspaceDepShare,traditional:p.traditionalDepShare,ai:Math.max(0,1-p.workspaceDepShare-p.traditionalDepShare),tpu:0};
  const parts={};
  for(const k of PROFIT_BUSINESSES){
    const r=p[k+'Revenue'],directRate=k==='ai'?p.aiThirdPartyShare*p.aiThirdPartyCostRate+(1-p.aiThirdPartyShare)*p.aiOwnOperatingRate:p[k+'DirectRate'];
    const direct=r*directRate,opex=r*p[k+'OpexRate'],d=cloudDA*depWeights[k],stock=cloudSbc*(revenue>0?r/revenue:base.parameters[k+'Revenue']/base.cloudRevenue);
    const cogs=direct+d*p.depreciationCogsShare+stock*base.sbcAllocation.cogs;
    const expense={};for(const f of ['rd','sm','ga'])expense[f]=opex*base.opexAllocation[f]+stock*base.sbcAllocation[f]+(f==='rd'?d*(1-p.depreciationCogsShare):0);
    const gp=r-cogs,op=gp-expense.rd-expense.sm-expense.ga;
    parts[k]={revenue:r,directCost:direct,thirdPartyCost:k==='ai'?r*p.aiThirdPartyShare*p.aiThirdPartyCostRate:0,
      ownOperatingCost:k==='ai'?r*(1-p.aiThirdPartyShare)*p.aiOwnOperatingRate:0,da:d,sbc:stock,cogs,...expense,grossProfit:gp,operatingIncome:op,
      grossMargin:r>0?gp/r:null,operatingMargin:r>0?op/r:null};
  }
  const totals={};for(const f of ['revenue','cogs','rd','sm','ga','grossProfit','operatingIncome'])totals[f]=Object.values(parts).reduce((s,x)=>s+x[f],0);
  // Unallocated adjustment stays visible. It is a cost, negative means benefit.
  totals.rd+=p.cloudUnallocatedCost;totals.operatingIncome-=p.cloudUnallocatedCost;
  return {parts,totals,depreciation,amortization,sbc,cloudDA,cloudSbc,parameters:p};
}
export function calculateProfitQuarter(base,p,nonCloudRevenue){
  const detail=cloudProfitBuild(p,base),frozen=cloudProfitBuild(base.parameters,base);
  const scale=base.nonCloudRevenue>0?nonCloudRevenue/base.nonCloudRevenue:1;
  const otherDA=(detail.depreciation+detail.amortization)*(1-p.cloudDepShare),oldOtherDA=(base.depreciation+base.amortization)*(1-base.parameters.cloudDepShare);
  const otherSbc=detail.sbc-detail.cloudSbc,oldOtherSbc=base.sbc-frozen.cloudSbc;
  const group={};const nonCloud={};
  for(const field of ['cogs','rd','sm','ga']){
    const daWeight=field==='cogs'?p.depreciationCogsShare:field==='rd'?1-p.depreciationCogsShare:0;
    const oldWeight=field==='cogs'?base.parameters.depreciationCogsShare:field==='rd'?1-base.parameters.depreciationCogsShare:0;
    const cashResidual=base.groupCosts[field]-frozen.totals[field]-oldOtherDA*oldWeight-oldOtherSbc*base.sbcAllocation[field];
    nonCloud[field]=cashResidual*scale+otherDA*daWeight+otherSbc*base.sbcAllocation[field];
    group[field]=detail.totals[field]+nonCloud[field];
    if(group[field]<-1e-7)throw new RangeError('情景导致集团'+field+'费用为负，请检查未分配项和业务拆分');
  }
  nonCloud.otherOpex=base.groupCosts.otherOpex*scale;group.otherOpex=nonCloud.otherOpex;
  group.opex=group.rd+group.sm+group.ga+group.otherOpex;
  return {...detail,group,nonCloud,cloudOperatingIncome:detail.totals.operatingIncome,
    cloudUnallocatedCost:p.cloudUnallocatedCost,sbcTaxBenefit:detail.sbc*p.sbcTaxBenefitRate,
    allocationNote:'成本率、Cloud资产/SBC分配与固定校准项为研究假设；非Cloud现金成本按非Cloud收入同比例变化'};
}
