/** Detailed Cloud profit bridge. USD million. Frozen calibration, no residual refit. */
export const PROFIT_BUSINESSES=['workspace','traditional','ai','tpu'];
export const NONCLOUD_BUSINESSES=['search','network','youtube','youtubeSubs','otherSubs','bets'];
export const PROFIT_LIMITS={
  cloudCashCostMultiplier:[0,3],
  searchTacRate:[0,2],networkTacRate:[0,2],youtubeContentRate:[0,2],youtubeSubsShare:[0,1],nflContentCost:[0,1e7],
  workspaceRevenue:[0,1e7],traditionalRevenue:[0,1e7],aiRevenue:[0,1e7],tpuRevenue:[0,1e7],
  workspaceDirectRate:[0,2],traditionalDirectRate:[0,2],tpuDirectRate:[0,2],
  workspaceOpexRate:[0,2],traditionalOpexRate:[0,2],aiOpexRate:[0,2],tpuOpexRate:[0,2],
  aiThirdPartyShare:[0,1],aiThirdPartyCostRate:[0,2],aiOwnOperatingRate:[0,2],
  serverLife:[1,40],otherLife:[1,80],serverAssetMultiplier:[0,5],otherAssetMultiplier:[0,5],
  cloudDepShare:[0,1],workspaceDepShare:[0,1],traditionalDepShare:[0,1],
  depreciationCogsShare:[0,1],sbcMultiplier:[0,5],sbcTaxBenefitRate:[0,1],
  cloudSbcShare:[0,1],cloudUnallocatedCost:[-1e7,1e7]
};
for(const k of [...PROFIT_BUSINESSES,...NONCLOUD_BUSINESSES])PROFIT_LIMITS[k+'GrossMargin']=[-5,1];
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
    const cashMultiplier=p.cloudCashCostMultiplier??1;
    let direct=r*directRate*cashMultiplier;
    const opex=r*p[k+'OpexRate']*cashMultiplier,d=cloudDA*depWeights[k],stock=cloudSbc*(revenue>0?r/revenue:base.parameters[k+'Revenue']/base.cloudRevenue);
    if(Number.isFinite(p[k+'GrossMargin'])){
      const bp=base.parameters,bw={workspace:bp.workspaceDepShare,traditional:bp.traditionalDepShare,ai:1-bp.workspaceDepShare-bp.traditionalDepShare,tpu:0};
      const reference=(base.depreciation+base.amortization)*bp.cloudDepShare*bw[k]*bp.depreciationCogsShare+base.sbc*bp.cloudSbcShare*bp[k+'Revenue']/base.cloudRevenue*base.sbcAllocation.cogs;
      direct=r*(1-p[k+'GrossMargin']-(bp[k+'Revenue']>0?reference/bp[k+'Revenue']:0));
      if(direct < -1e-7)throw new RangeError(k+'毛利率过高，隐含现金成本为负；请降低毛利率或恢复成本驱动');
      direct=Math.max(0,direct);
    }
    const cogs=direct+d*p.depreciationCogsShare+stock*base.sbcAllocation.cogs;
    const expense={};for(const f of ['rd','sm','ga'])expense[f]=opex*base.opexAllocation[f]+stock*base.sbcAllocation[f]+(f==='rd'?d*(1-p.depreciationCogsShare):0);
    const gp=r-cogs,op=gp-expense.rd-expense.sm-expense.ga;
    parts[k]={revenue:r,directCost:direct,cashOpex:opex,effectiveDirectRate:r?direct/r:0,effectiveOpexRate:p[k+'OpexRate']*cashMultiplier,thirdPartyCost:k==='ai'&&!Number.isFinite(p.aiGrossMargin)?r*p.aiThirdPartyShare*p.aiThirdPartyCostRate*cashMultiplier:null,
      ownOperatingCost:k==='ai'&&!Number.isFinite(p.aiGrossMargin)?r*(1-p.aiThirdPartyShare)*p.aiOwnOperatingRate*cashMultiplier:null,da:d,daCogs:d*p.depreciationCogsShare,sbc:stock,cogs,...expense,grossProfit:gp,operatingIncome:op,
      grossMargin:r>0?gp/r:null,operatingMargin:r>0?op/r:null};
  }
  const totals={};for(const f of ['revenue','cogs','rd','sm','ga','grossProfit','operatingIncome'])totals[f]=Object.values(parts).reduce((s,x)=>s+x[f],0);
  // Unallocated adjustment stays visible. It is a cost, negative means benefit.
  totals.rd+=p.cloudUnallocatedCost;totals.operatingIncome-=p.cloudUnallocatedCost;
  return {parts,totals,depreciation,amortization,sbc,cloudDA,cloudSbc,parameters:p};
}

/** One free cost parameter, all other current assumptions fixed; no residual benefit. */
export function solveMSProfit(base,p){
  const clean={...p,cloudUnallocatedCost:0,cloudCashCostMultiplier:1},d=cloudProfitBuild(clean,base);
  const cash=Object.values(d.parts).reduce((s,x)=>s+x.directCost+x.cashOpex,0),allowance=d.totals.revenue-base.cloudOperatingIncome-d.cloudDA-d.cloudSbc;
  const zero=cloudProfitBuild({...clean,cloudCashCostMultiplier:0},base),fixed=Object.values(zero.parts).reduce((s,x)=>s+x.directCost+x.cashOpex,0),slope=cash-fixed;
  const value=slope>0?(allowance-fixed)/slope:null,feasible=Number.isFinite(value)&&value>=0&&value<=3;
  return {target:base.cloudOperatingIncome,revenue:d.totals.revenue,cashAtOne:cash,fixedCashCost:fixed,cashAllowance:allowance,value,feasible,bounds:[0,3],status:slope<=0?'non_identifiable':feasible?'feasible':'out_of_range',changes:feasible?{cloudCashCostMultiplier:value,cloudUnallocatedCost:0}:null};
}
export function nonCloudDirect(p,segments){
  if(!segments||!Number.isFinite(p.searchTacRate))return null;
  const parts={search:{revenue:segments.search,cost:segments.search*p.searchTacRate},network:{revenue:segments.network,cost:segments.network*p.networkTacRate},youtube:{revenue:segments.youtube,cost:segments.youtube*p.youtubeContentRate},youtubeSubs:{revenue:segments.subs*p.youtubeSubsShare,cost:segments.subs*p.youtubeSubsShare*p.youtubeContentRate+p.nflContentCost},otherSubs:{revenue:segments.subs*(1-p.youtubeSubsShare),cost:null},bets:{revenue:segments.bets,cost:null}};
  return {parts,total:Object.values(parts).reduce((s,x)=>s+(x.cost??0),0)};
}
export function calculateProfitQuarter(base,p,nonCloudRevenue,segments){
  const detail=cloudProfitBuild(p,base),frozen=cloudProfitBuild(base.parameters,base);
  const scale=base.nonCloudRevenue>0?nonCloudRevenue/base.nonCloudRevenue:1;
  const otherDA=(detail.depreciation+detail.amortization)*(1-p.cloudDepShare),oldOtherDA=(base.depreciation+base.amortization)*(1-base.parameters.cloudDepShare);
  const otherSbc=detail.sbc-detail.cloudSbc,oldOtherSbc=base.sbc-frozen.cloudSbc;
  const group={};const nonCloud={};
  const direct=nonCloudDirect(p,segments),oldDirect=nonCloudDirect(base.parameters,base.segments);
  for(const field of ['cogs','rd','sm','ga']){
    const daWeight=field==='cogs'?p.depreciationCogsShare:field==='rd'?1-p.depreciationCogsShare:0;
    const oldWeight=field==='cogs'?base.parameters.depreciationCogsShare:field==='rd'?1-base.parameters.depreciationCogsShare:0;
    const cashResidual=base.groupCosts[field]-frozen.totals[field]-oldOtherDA*oldWeight-oldOtherSbc*base.sbcAllocation[field]-(field==='cogs'&&direct&&oldDirect?oldDirect.total:0);
    nonCloud[field]=cashResidual*scale+otherDA*daWeight+otherSbc*base.sbcAllocation[field]+(field==='cogs'&&direct?direct.total:0);
    group[field]=detail.totals[field]+nonCloud[field];
    if(group[field]<-1e-7)throw new RangeError('情景导致集团'+field+'费用为负，请检查未分配项和业务拆分');
  }
  nonCloud.otherOpex=base.groupCosts.otherOpex*scale;group.otherOpex=nonCloud.otherOpex;
  // Explicit research allocation: distribute remaining NonCloud costs by revenue.
  // No segment disclosure is inferred from this allocation; total remains unchanged.
  const businessParts={...detail.parts};
  if(direct&&oldDirect){
    const total=Object.values(direct.parts).reduce((s,x)=>s+x.revenue,0),oldTotal=Object.values(oldDirect.parts).reduce((s,x)=>s+x.revenue,0);
    const residual=nonCloud.cogs-direct.total-otherDA*p.depreciationCogsShare-otherSbc*base.sbcAllocation.cogs;
    const oldResidual=base.groupCosts.cogs-frozen.totals.cogs-oldDirect.total-oldOtherDA*base.parameters.depreciationCogsShare-oldOtherSbc*base.sbcAllocation.cogs;
    for(const k of NONCLOUD_BUSINESSES){
      const x=direct.parts[k],old=oldDirect.parts[k],w=total>0?x.revenue/total:old.revenue/oldTotal,ow=old.revenue/oldTotal;
      const da=otherDA*w,stock=otherSbc*w,daCogs=da*p.depreciationCogsShare;
      const referenceCogs=(old.cost??0)+(oldResidual+oldOtherDA*base.parameters.depreciationCogsShare+oldOtherSbc*base.sbcAllocation.cogs)*ow;
      let cash=(x.cost??0)+residual*w;
      if(Number.isFinite(p[k+'GrossMargin'])){
        const refNonCash=(oldOtherDA*base.parameters.depreciationCogsShare+oldOtherSbc*base.sbcAllocation.cogs)*ow;
        cash=x.revenue*(1-p[k+'GrossMargin']-(old.revenue>0?refNonCash/old.revenue:0));
        if(cash < -1e-7)throw new RangeError(k+'毛利率隐含负现金成本，请降低假设');
        cash=Math.max(0,cash);
      }
      const cogs=cash+daCogs+stock*base.sbcAllocation.cogs,originalCogs=(x.cost??0)+(nonCloud.cogs-direct.total)*w;
      // Use the unmodified total for all allocation weights; accumulate separately below.
      businessParts[k]={revenue:x.revenue,cogs,da,daCogs,sbc:stock,grossProfit:x.revenue-cogs,grossMargin:x.revenue?1-cogs/x.revenue:null,
        referenceGrossMargin:old.revenue?1-referenceCogs/old.revenue:null,rd:nonCloud.rd*w,sm:nonCloud.sm*w,ga:nonCloud.ga*w,otherOpex:nonCloud.otherOpex*w,cogsAdjustment:cogs-originalCogs};
      const b=businessParts[k];b.operatingIncome=b.grossProfit-b.rd-b.sm-b.ga-b.otherOpex;
    }
    const delta=NONCLOUD_BUSINESSES.reduce((s,k)=>s+businessParts[k].cogsAdjustment,0);nonCloud.cogs+=delta;group.cogs+=delta;
  }
  group.opex=group.rd+group.sm+group.ga+group.otherOpex;
  return {...detail,group,businessParts,nonCloud,nonCloudDirect:direct,cloudOperatingIncome:detail.totals.operatingIncome,
    cloudUnallocatedCost:p.cloudUnallocatedCost,sbcTaxBenefit:detail.sbc*p.sbcTaxBenefitRate,
    allocationNote:'Cloud成本率、资产/SBC分配与固定校准项为研究假设；非Cloud可识别TAC/内容成本按业务驱动，其余共享现金成本随非Cloud总收入变化'};
}

/** Ordered exact bridge, not causal attribution. Each step holds remaining inputs fixed. */
export function profitAttribution(base,p,segments,hedge,manualCogs=0,manualOpex=0){
  if(!base.segments)return [];
  const total=s=>Object.values(s).reduce((a,b)=>a+b,0),r0=total(base.segments)+base.hedge,r1=total(segments)+hedge;
  const evaluate=(a,s,r)=>{const d=calculateProfitQuarter(base,a,r-s.cloud,s);return {revenue:r,grossProfit:r-d.group.cogs,operatingIncome:r-d.group.cogs-d.group.opex,grossMargin:1-d.group.cogs/r};};
  let prev=evaluate(base.parameters,base.segments,r0),a={...base.parameters};const rows=[];
  const add=(label,s,r)=>{const v=evaluate(a,s,r);rows.push({label,grossProfit:v.grossProfit-prev.grossProfit,operatingIncome:v.operatingIncome-prev.operatingIncome,grossMarginPoints:100*(v.grossMargin-prev.grossMargin)});prev=v;};
  const scaled=Object.fromEntries(Object.entries(base.segments).map(([k,v])=>[k,v*r1/r0]));for(const k of PROFIT_BUSINESSES)a[k+'Revenue']=base.parameters[k+'Revenue']*r1/r0;
  add('总收入规模（固定初始结构）',scaled,r1);
  for(const k of PROFIT_BUSINESSES)a[k+'Revenue']=p[k+'Revenue'];add('业务收入结构',segments,r1);
  const dep=['serverLife','otherLife','serverAssetMultiplier','otherAssetMultiplier','cloudDepShare','workspaceDepShare','traditionalDepShare','depreciationCogsShare'],sbc=['sbcMultiplier','sbcTaxBenefitRate','cloudSbcShare'];
  for(const k of Object.keys(p))if(!k.endsWith('Revenue')&&!dep.includes(k)&&!sbc.includes(k)&&k!=='cloudUnallocatedCost')a[k]=p[k];add('现金成本率及内容成本',segments,r1);
  for(const k of dep)a[k]=p[k];add('资产 / 年限 / 折旧分配',segments,r1);
  for(const k of sbc)a[k]=p[k];add('SBC',segments,r1);
  a.cloudUnallocatedCost=p.cloudUnallocatedCost;add('未分配校准项',segments,r1);
  rows.push({label:'主表手动费用覆盖',grossProfit:-manualCogs,operatingIncome:-manualCogs-manualOpex,grossMarginPoints:-100*manualCogs/r1});return rows;
}
