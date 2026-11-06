/** Independent Cloud / cash-capex scenario engine. USD bn, GW, decimal ratios. */
export const CLOUD_CUSTOMERS = Object.freeze(['Anthropic', 'OpenAI', 'otherAI']);
export const CLOUD_GLOBAL_DEFAULTS = Object.freeze({
  enterpriseGrowthAdjustment: 0, customerBudgetMultiplier: 1, googleShareMultiplier: 1,
  capacityMultiplier: 1, utilizationMultiplier: 1, netPriceMultiplier: 1,
  tpuVolumeMultiplier: 1, equipmentCostMultiplier: 1, facilityCostMultiplier: 1,
  nonCloudCapexMultiplier: 1
});
const GLOBAL_BOUNDS = {
  enterpriseGrowthAdjustment: [-.25, .5], customerBudgetMultiplier: [0, 10],
  googleShareMultiplier: [0, 5], capacityMultiplier: [0, 10], utilizationMultiplier: [0, 2],
  netPriceMultiplier: [0, 5], tpuVolumeMultiplier: [0, 10], equipmentCostMultiplier: [0, 5],
  facilityCostMultiplier: [0, 5], nonCloudCapexMultiplier: [0, 5]
};
const LABELS = {
  enterpriseGrowthAdjustment: '其他企业服务环比增速调整', customerBudgetMultiplier: '客户算力预算倍率',
  googleShareMultiplier: 'Google采购份额倍率', capacityMultiplier: '平均验收容量倍率',
  utilizationMultiplier: '利用率倍率', netPriceMultiplier: '服务净价倍率',
  tpuVolumeMultiplier: '外售TPU交付倍率', equipmentCostMultiplier: '自有设备成本倍率',
  facilityCostMultiplier: '自有设施成本倍率', nonCloudCapexMultiplier: '其他业务资本开支倍率'
};
const clone = x => structuredClone(x);
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const own = (x,k) => Object.prototype.hasOwnProperty.call(x,k);
const sum = xs => xs.reduce((a,b)=>a+b,0);
const finite = (v,name) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new TypeError(`${name} 必须是有限数值，缺失不能当零`);
  return v;
};
const bounded = (v,min,max,name) => {
  finite(v,name); if(v<min||v>max) throw new RangeError(`${name} 超出范围 ${min} 至 ${max}`); return v;
};
const periodNumber = p => {
  if(!/^\d{4}Q[1-4]$/.test(p)) throw new TypeError(`无效季度：${p}`);
  return Number(p.slice(0,4))*4+Number(p.at(-1))-1;
};
export const cloudQuarterDays = p => {
  periodNumber(p); const y=Number(p.slice(0,4)),q=Number(p.at(-1));
  return (Date.UTC(y,q*3,1)-Date.UTC(y,(q-1)*3,1))/86400000;
};
const ratio = (a,b) => Number.isFinite(a)&&Number.isFinite(b)&&b!==0 ? a/b-1 : null;
const at = (v,i,n,name) => {
  if(Array.isArray(v)) {if(v.length!==n)throw new TypeError(`${name} 必须含 ${n} 个季度`);return v[i];}
  return v;
};
const read = (p,path) => path.split('.').reduce((v,k)=>v?.[k],p);
function write(p,path,value) {const keys=path.split('.');let node=p;for(const k of keys.slice(0,-1))node=node[k];node[keys.at(-1)]=value;}
function flattened(o,prefix='',out={}) {
  if(!object(o))throw new TypeError('overrides必须是对象');
  for(const [key,value] of Object.entries(o)) {
    if(['__proto__','prototype','constructor'].includes(key))throw new TypeError('非法参数路径');
    const path=prefix?`${prefix}.${key}`:key;
    if(object(value))flattened(value,path,out);else {if(own(out,path))throw new TypeError(`重复参数 ${path}`);out[path]=value;}
  } return out;
}
function rule(path) {
  let m;
  if((m=/^global\.([A-Za-z]+)$/.exec(path))&&GLOBAL_BOUNDS[m[1]])return GLOBAL_BOUNDS[m[1]];
  if(/^enterprise\.sequentialGrowth(?:\.\d+)?$/.test(path))return [-.99,2];
  if(path==='enterprise.googleOwnedAssetShare')return [0,1];
  if((m=/^customers\.(Anthropic|OpenAI|otherAI)\.([A-Za-z]+)(?:\.(\d+))?$/.exec(path))) {
    if(m[2]==='serviceMethod'&&m[3]===undefined)return ['contract','constrainedBudget','budget','capacity'];
    if(m[2]==='budgetMethod'&&m[3]===undefined)return ['direct','revenueAndTraining'];
    if(['trainingShare','googleTrainingShare','googleInferenceShare','utilization','googleOwnedAssetShare','reservedBillingFraction'].includes(m[2]))return [0,1];
    if(m[2]==='inferenceCostRate')return [0,3];
    if(['computeBudgetBn','averageAcceptedCapacityGW','netServicePriceBnPerGWQuarter','commercialRevenueRunRateBn','trainingBudgetBn'].includes(m[2]))return [0,1e5];
  }
  if(/^externalTPU\.(capacitySoldGW|netPriceBnPerGW)(?:\.\d+)?$/.test(path))return [0,1e5];
  if(/^externalTPU\.recognitionFraction(?:\.\d+)?$/.test(path))return [0,1];
  if((m=/^capex\.([A-Za-z]+)$/.exec(path))) {
    if(['nonCloudShare','equipmentShare','maintenanceRatio'].includes(m[1]))return [0,1];
    if(['equipmentIntensityBnPerIncrementalServiceRevenueBn','facilityIntensityBnPerIncrementalServiceRevenueBn','aiEquipmentCostBnPerGW','aiFacilityCostBnPerGW'].includes(m[1]))return [0,1e4];
    if(['paymentLagQuarters','equipmentPaymentLagQuarters','facilityPaymentLagQuarters'].includes(m[1]))return [0,4,'integer'];
    if(m[1]==='nonCloudSequentialGrowth')return [-.99,2];
  }
  return null;
}
function prepare(data,overrides={}) {
  if(!object(data)||!Array.isArray(data.forecastPeriods)||!data.forecastPeriods.length)throw new TypeError('缺少forecastPeriods');
  const periods=data.forecastPeriods, history=data.history?.quarters;
  if(!Array.isArray(history)||!history.length)throw new TypeError('缺少已披露历史季度');
  const h=clone(history).sort((a,b)=>periodNumber(a.period)-periodNumber(b.period));
  if(new Set(h.map(x=>x.period)).size!==h.length)throw new TypeError('重复历史季度');
  for(const q of h) {
    bounded(q.cloudRevenueBn,0,1e6,`${q.period}.cloudRevenueBn`);
    if(q.cashCapexBn!==null&&q.cashCapexBn!==undefined)bounded(q.cashCapexBn,0,1e6,`${q.period}.cashCapexBn`);
    if(q.publicationDate&&data.asOf&&q.publicationDate>data.asOf)throw new TypeError(`${q.period} 含研究截止日之后披露`);
  }
  periods.forEach((p,i)=>{if(periodNumber(p)!==periodNumber(h.at(-1).period)+i+1)throw new TypeError('预测季度必须紧接历史且连续，不能覆盖实际期');});
  if(!object(data.parameters))throw new TypeError('缺少parameters');
  const p=clone(data.parameters);p.global={...CLOUD_GLOBAL_DEFAULTS,...p.global};
  p.enterprise={googleOwnedAssetShare:1,...p.enterprise};
  p.externalTPU={recognitionFraction:1,...p.externalTPU};
  p.capex={paymentLagQuarters:0,nonCloudSequentialGrowth:0,...p.capex};
  if(!object(p.customers)||CLOUD_CUSTOMERS.some(c=>!object(p.customers[c])))throw new TypeError('缺少三类客户情景参数');
  for(const c of CLOUD_CUSTOMERS)p.customers[c]={googleOwnedAssetShare:1,reservedBillingFraction:0,serviceMethod:'constrainedBudget',budgetMethod:'direct',...p.customers[c]};
  const flat=flattened(overrides);
  for(const [path,value] of Object.entries(flat)) {
    const r=rule(path);if(!r)throw new TypeError(`不支持或已锁定的参数：${path}`);
    const original=read(p,path);
    if(original===undefined)throw new TypeError(`未知参数或数组索引：${path}`);
    if(/\.\d+$/.test(path)) {
      const parent=read(p,path.split('.').slice(0,-1).join('.'));
      const raw=path.split('.').at(-1),index=Number(raw);
      if(!Array.isArray(parent)||String(index)!==raw||index<0||index>=periods.length)throw new TypeError(`数组索引越界：${path}`);
    }
    if(typeof r[0]==='string') {if(!r.includes(value))throw new TypeError(`无效计算方法：${value}`);}
    else for(const v of Array.isArray(value)?value:[value]) {bounded(v,r[0],r[1],path);if(r[2]==='integer'&&!Number.isInteger(v))throw new TypeError(`${path} 必须为整数`);}
    if(Array.isArray(original)!==Array.isArray(value)&&!(/\.\d+$/.test(path)))throw new TypeError(`${path} 必须保持原参数的标量或季度数组结构`);
    write(p,path,clone(value));
  }
  for(const [k,v] of Object.entries(p.global)) {if(!GLOBAL_BOUNDS[k])throw new TypeError(`未知global参数 ${k}`);bounded(v,...GLOBAL_BOUNDS[k],`global.${k}`);}
  for(const c of CLOUD_CUSTOMERS) {
    bounded(p.customers[c].baseRevenueBn,0,1e5,`${c}.baseRevenueBn`);
    bounded(p.customers[c].baseAverageAcceptedCapacityGW,0,1e5,`${c}.baseAverageAcceptedCapacityGW`);
    if(p.customers[c].budgetMethod==='revenueAndTraining'&&Object.keys(flat).some(path=>path.startsWith(`customers.${c}.computeBudgetBn`)||path.startsWith(`customers.${c}.trainingShare`)))
      throw new TypeError(`${c} 的总预算/训练比例由收入运行率、推理成本率和训练预算派生，不能重复编辑`);
  }
  bounded(p.externalTPU.baseRevenueBn,0,1e5,'externalTPU.baseRevenueBn');
  const base=h.at(-1),baseEnterprise=base.cloudRevenueBn-p.externalTPU.baseRevenueBn-sum(CLOUD_CUSTOMERS.map(c=>p.customers[c].baseRevenueBn));
  if(baseEnterprise<0)throw new RangeError('历史估计客户与TPU拆分超过已披露Cloud收入');
  if(p.enterprise.baseRevenueBn!==undefined&&Math.abs(p.enterprise.baseRevenueBn-baseEnterprise)>1e-6)throw new RangeError('历史基期拆分未勾稽Cloud总收入');
  if(Math.abs(finite(p.capex.baseCashCapexBn,'baseCashCapexBn')-finite(base.cashCapexBn,'历史最新cashCapexBn'))>1e-6)throw new RangeError('资本开支基期未勾稽已披露实际');
  for(const k of ['nonCloudShare','equipmentShare','maintenanceRatio'])bounded(p.capex[k],0,1,`capex.${k}`);
  for(const k of ['equipmentIntensityBnPerIncrementalServiceRevenueBn','facilityIntensityBnPerIncrementalServiceRevenueBn','aiEquipmentCostBnPerGW','aiFacilityCostBnPerGW'])bounded(p.capex[k],0,1e4,`capex.${k}`);
  for(const k of ['paymentLagQuarters','equipmentPaymentLagQuarters','facilityPaymentLagQuarters'])if(p.capex[k]!==undefined){bounded(p.capex[k],0,4,k);if(!Number.isInteger(p.capex[k]))throw new TypeError(`${k}必须为整数`);}
  bounded(p.capex.nonCloudSequentialGrowth,-.99,2,'nonCloudSequentialGrowth');
  return {p,h,periods,base,baseEnterprise,flat};
}
function run(data,overrides={}) {
  const {p,h,periods,base,baseEnterprise,flat}=prepare(data,overrides),n=periods.length,g=p.global;
  const warnings=new Set(),quarters=[],plans=[];
  let enterprise=baseEnterprise;
  let previousEnterpriseOwned=baseEnterprise*bounded(data.parameters.enterprise.googleOwnedAssetShare??1,0,1,'enterprise.baseGoogleOwnedAssetShare');
  let previousCustomerOwnedGW=sum(CLOUD_CUSTOMERS.map(c=>p.customers[c].baseAverageAcceptedCapacityGW*
    bounded(data.parameters.customers[c].baseGoogleOwnedAssetShare??data.parameters.customers[c].googleOwnedAssetShare??1,0,1,`${c}.baseGoogleOwnedAssetShare`)));
  const cap=p.capex,baseCloudCapex=cap.baseCashCapexBn*(1-cap.nonCloudShare),baseNonCloud=cap.baseCashCapexBn*cap.nonCloudShare;
  const previousByPeriod=new Map(h.map(q=>[q.period,q]));
  for(const [i,period] of periods.entries()) {
    const days=cloudQuarterDays(period),customers={},customerRevenueBn={};
    const growth=bounded(at(p.enterprise.sequentialGrowth,i,n,'enterprise.sequentialGrowth')+g.enterpriseGrowthAdjustment,-.99,3,`${period}.enterpriseGrowth`);
    enterprise*=1+growth;
    for(const c of CLOUD_CUSTOMERS) {
      const cp=p.customers[c],v=k=>at(cp[k],i,n,`${c}.${k}`);
      let trainingBudget,inferenceBudget,revenueRunRate=null,inferenceCostRate=null;
      if(cp.budgetMethod==='revenueAndTraining') {
        revenueRunRate=bounded(v('commercialRevenueRunRateBn'),0,1e5,`${c}.commercialRevenueRunRateBn`);
        inferenceCostRate=bounded(v('inferenceCostRate'),0,3,`${c}.inferenceCostRate`);
        inferenceBudget=revenueRunRate/4*inferenceCostRate*g.customerBudgetMultiplier;
        trainingBudget=bounded(v('trainingBudgetBn'),0,1e5,`${c}.trainingBudgetBn`)*g.customerBudgetMultiplier;
      } else if(cp.budgetMethod==='direct') {
        const directBudget=bounded(v('computeBudgetBn'),0,1e5,`${c}.computeBudgetBn`)*g.customerBudgetMultiplier;
        const directTrain=bounded(v('trainingShare'),0,1,`${c}.trainingShare`);
        trainingBudget=directBudget*directTrain;inferenceBudget=directBudget*(1-directTrain);
      } else throw new TypeError(`无效预算方法：${cp.budgetMethod}`);
      const budget=trainingBudget+inferenceBudget,train=budget>0?trainingBudget/budget:0;
      const tRaw=bounded(v('googleTrainingShare'),0,1,`${c}.googleTrainingShare`)*g.googleShareMultiplier;
      const iRaw=bounded(v('googleInferenceShare'),0,1,`${c}.googleInferenceShare`)*g.googleShareMultiplier;
      const uRaw=bounded(v('utilization'),0,1,`${c}.utilization`)*g.utilizationMultiplier;
      if(tRaw>1||iRaw>1||uRaw>1)warnings.add('有效份额或利用率超过100%的倍率组合已封顶为100%；原始参数保留。');
      const ts=Math.min(1,tRaw),is=Math.min(1,iRaw),utilization=Math.min(1,uRaw);
      const trainingDemand=trainingBudget*ts,inferenceDemand=inferenceBudget*is,demand=trainingDemand+inferenceDemand;
      const capacity=bounded(v('averageAcceptedCapacityGW'),0,1e5,`${c}.averageAcceptedCapacityGW`)*g.capacityMultiplier;
      const price=bounded(v('netServicePriceBnPerGWQuarter'),0,1e5,`${c}.netServicePriceBnPerGWQuarter`)*g.netPriceMultiplier;
      const capacityRevenue=capacity*utilization*price*days/90;
      const fullCapacityRevenue=capacity*price*days/90;
      const reservedFraction=bounded(v('reservedBillingFraction'),0,1,`${c}.reservedBillingFraction`);
      // Reserved billing applies only to accepted capacity. Demand already includes
      // reserved use: subtract the floor before computing additional usage.
      const reservedRevenue=fullCapacityRevenue*reservedFraction;
      const usageRevenue=Math.min(Math.max(0,demand-reservedRevenue),fullCapacityRevenue*(1-reservedFraction)*utilization);
      const method=cp.serviceMethod;
      if(!['contract','constrainedBudget','budget','capacity'].includes(method))throw new TypeError(`无效计算方法：${method}`);
      const revenue=method==='contract'?reservedRevenue+usageRevenue:method==='budget'?demand:method==='capacity'?capacityRevenue:Math.min(demand,capacityRevenue);
      const billingCeiling=method==='contract'?reservedRevenue+fullCapacityRevenue*(1-reservedFraction)*utilization:capacityRevenue;
      if(method==='contract')warnings.add(`${c}最低计费比例为用户情景，尚无合同条款验证；只对平均已验收容量计费。`);
      else if(method!=='constrainedBudget')warnings.add(`${c}使用${method==='budget'?'预算':'容量'}单方法情景，另一方法仅作交叉检查，不能相加。`);
      const trainingAllocation=demand>0?trainingDemand/demand:train;
      customerRevenueBn[c]=revenue;
      customers[c]={revenueBn:revenue,demandRevenueBn:demand,capacityRevenueBn:billingCeiling,
        trainingDemandRevenueBn:trainingDemand,inferenceDemandRevenueBn:inferenceDemand,
        trainingRevenueBn:revenue*trainingAllocation,inferenceRevenueBn:revenue*(1-trainingAllocation),
        computeBudgetBn:budget,budgetMethod:cp.budgetMethod,revenueRunRateBn:revenueRunRate,inferenceCostRate,
        trainingBudgetBn:trainingBudget,inferenceBudgetBn:inferenceBudget,trainingShare:train,
        googleTrainingShare:ts,googleInferenceShare:is,averageAcceptedCapacityGW:capacity,
        utilization,netServicePriceBnPerGWQuarter:price,serviceMethod:method,
        fullCapacityRevenueBn:fullCapacityRevenue,reservedBillingFraction:reservedFraction,
        reservedRevenueBn:method==='contract'?reservedRevenue:0,usageRevenueBn:method==='contract'?usageRevenue:revenue,
        fundingGapProxyBn:revenueRunRate===null?null:Math.max(0,budget-revenueRunRate/4),
        googleBudgetCoverage:revenue>0?demand/revenue:null,
        bindingConstraint:method==='contract'&&reservedRevenue>demand?'reserved_floor':method==='budget'?'budget_only':method==='capacity'?'capacity_only':demand<=billingCeiling?'budget':'capacity',
        googleOwnedAssetShare:bounded(v('googleOwnedAssetShare'),0,1,`${c}.googleOwnedAssetShare`),
        unmetDemandBn:Math.max(0,demand-revenue)};
    }
    const soldGW=bounded(at(p.externalTPU.capacitySoldGW,i,n,'externalTPU.capacitySoldGW'),0,1e5,'capacitySoldGW')*g.tpuVolumeMultiplier;
    const tpuPrice=bounded(at(p.externalTPU.netPriceBnPerGW,i,n,'externalTPU.netPriceBnPerGW'),0,1e5,'netPriceBnPerGW');
    const recognition=bounded(at(p.externalTPU.recognitionFraction,i,n,'externalTPU.recognitionFraction'),0,1,'recognitionFraction');
    const external=soldGW*tpuPrice*recognition,services=enterprise+sum(Object.values(customerRevenueBn)),cloud=services+external;
    const enterpriseOwned=enterprise*bounded(p.enterprise.googleOwnedAssetShare,0,1,'enterprise.googleOwnedAssetShare');
    const owned=enterpriseOwned+sum(CLOUD_CUSTOMERS.map(c=>customers[c].revenueBn*customers[c].googleOwnedAssetShare));
    const customerOwnedGW=sum(CLOUD_CUSTOMERS.map(c=>customers[c].averageAcceptedCapacityGW*customers[c].googleOwnedAssetShare));
    const incrementalEnterpriseOwned=Math.max(0,enterpriseOwned-previousEnterpriseOwned);
    // No disposal / retirement schedule is supplied: a fall in deployed capacity
    // leaves existing assets available and a rebound does not buy them twice.
    const incrementalCustomerOwnedGW=Math.max(0,customerOwnedGW-previousCustomerOwnedGW);
    const capitalizedCustomerCapacityGW=Math.max(previousCustomerOwnedGW,customerOwnedGW);
    const maintenance=baseCloudCapex*cap.maintenanceRatio;
    const enterpriseEquipment=incrementalEnterpriseOwned*cap.equipmentIntensityBnPerIncrementalServiceRevenueBn;
    const enterpriseFacilities=incrementalEnterpriseOwned*cap.facilityIntensityBnPerIncrementalServiceRevenueBn;
    const aiEquipment=incrementalCustomerOwnedGW*cap.aiEquipmentCostBnPerGW;
    const aiFacilities=incrementalCustomerOwnedGW*cap.aiFacilityCostBnPerGW;
    const equipmentPlan=(maintenance*cap.equipmentShare+enterpriseEquipment+aiEquipment)*g.equipmentCostMultiplier;
    const facilitiesPlan=(maintenance*(1-cap.equipmentShare)+enterpriseFacilities+aiFacilities)*g.facilityCostMultiplier;
    plans.push({equipmentPlanBn:equipmentPlan,facilitiesPlanBn:facilitiesPlan});
    const elag=cap.equipmentPaymentLagQuarters??cap.paymentLagQuarters,flag=cap.facilityPaymentLagQuarters??cap.paymentLagQuarters;
    if(elag>0||flag>0)warnings.add('付款滞后仅改变现金时点；预测前期未取得的付款计划按锁定基期资本开支分配估计，不代表已披露订单付款表。');
    const equipmentCash=i>=elag?plans[i-elag].equipmentPlanBn:baseCloudCapex*cap.equipmentShare;
    const facilitiesCash=i>=flag?plans[i-flag].facilitiesPlanBn:baseCloudCapex*(1-cap.equipmentShare);
    const nonCloud=baseNonCloud*(1+cap.nonCloudSequentialGrowth)**(i+1)*g.nonCloudCapexMultiplier,cashCapex=equipmentCash+facilitiesCash+nonCloud;
    const previousYear=previousByPeriod.get(`${Number(period.slice(0,4))-1}Q${period.at(-1)}`);
    const q={period,kind:'scenario',days,cloudRevenueBn:cloud,cashCapexBn:cashCapex,enterpriseRevenueBn:enterprise,
      customerRevenueBn,externalTPURevenueBn:external,servicesRevenueBn:services,ownedServiceRevenueBn:owned,customers,
      externalTPU:{capacitySoldGW:soldGW,netPriceBnPerGW:tpuPrice,recognitionFraction:recognition,revenueBn:external},
      capex:{equipmentPlanBn:equipmentPlan,facilitiesPlanBn:facilitiesPlan,equipmentCashBn:equipmentCash,facilitiesCashBn:facilitiesCash,
        nonCloudCashBn:nonCloud,incrementalOwnedServiceRevenueBn:incrementalEnterpriseOwned,
        incrementalEnterpriseOwnedServiceRevenueBn:incrementalEnterpriseOwned,ownedCustomerCapacityGW:customerOwnedGW,
        incrementalCustomerOwnedCapacityGW:incrementalCustomerOwnedGW,
        capitalizedCustomerCapacityGW,
        enterpriseEquipmentGrowthBn:enterpriseEquipment,enterpriseFacilitiesGrowthBn:enterpriseFacilities,
        aiEquipmentGrowthBn:aiEquipment,aiFacilitiesGrowthBn:aiFacilities,maintenanceCloudCashBn:maintenance,
        equipmentPaymentLagQuarters:elag,facilityPaymentLagQuarters:flag,
        thirdPartyAssetPurchasesIncluded:false,externalTPUInventoryIncluded:false},
      cloudYoY:ratio(cloud,previousYear?.cloudRevenueBn),cashCapexYoY:ratio(cashCapex,previousYear?.cashCapexBn),
      status:'research_scenario_not_company_guidance'};
    for(const field of ['cloudRevenueBn','cashCapexBn','ownedServiceRevenueBn'])finite(q[field],`${period}.${field}`);
    quarters.push(q);previousEnterpriseOwned=enterpriseOwned;previousCustomerOwnedGW=capitalizedCustomerCapacityGW;previousByPeriod.set(period,q);
  }
  const annual=[];
  for(const year of [...new Set(periods.map(p=>p.slice(0,4)))]) {
    const rows=[...h,...quarters].filter(q=>q.period.startsWith(year)),future=rows.filter(q=>q.kind==='scenario');
    const complete=rows.length===4&&new Set(rows.map(q=>q.period.at(-1))).size===4;
    const hasCapex=rows.every(q=>Number.isFinite(q.cashCapexBn)),allForecast=future.length===4;
    const previous=[...h,...quarters].filter(q=>q.period.startsWith(String(Number(year)-1)));
    const a={period:year,quarterCount:rows.length,actualQuarterCount:rows.length-future.length,complete,
      cloudRevenueBn:complete?sum(rows.map(q=>q.cloudRevenueBn)):null,cashCapexBn:complete&&hasCapex?sum(rows.map(q=>q.cashCapexBn)):null,
      forecastCloudRevenueBn:sum(future.map(q=>q.cloudRevenueBn)),forecastCashCapexBn:sum(future.map(q=>q.cashCapexBn)),
      enterpriseRevenueBn:allForecast?sum(future.map(q=>q.enterpriseRevenueBn)):null,
      externalTPURevenueBn:allForecast?sum(future.map(q=>q.externalTPURevenueBn)):null,
      customerRevenueBn:Object.fromEntries(CLOUD_CUSTOMERS.map(c=>[c,allForecast?sum(future.map(q=>q.customerRevenueBn[c])):null])),
      componentCoverage:allForecast?'full_year':'forecast_only'};
    a.cloudYoY=complete&&previous.length===4?ratio(a.cloudRevenueBn,sum(previous.map(q=>q.cloudRevenueBn))):null;
    a.cashCapexYoY=complete&&previous.length===4&&previous.every(q=>Number.isFinite(q.cashCapexBn))?ratio(a.cashCapexBn,sum(previous.map(q=>q.cashCapexBn))):null;
    annual.push(a);
  }
  return {asOf:data.asOf,units:{money:'USD bn',capacity:'GW',ratio:'fraction'},quarters,annual,history:h,parameters:p,overrides:flat,warnings:[...warnings],
    calibration:{...clone(data.calibration||{}),basePeriod:base.period,baseCloudRevenueBn:base.cloudRevenueBn,
      baseEnterpriseRevenueBn:baseEnterprise,baseCustomerRevenueBn:Object.fromEntries(CLOUD_CUSTOMERS.map(c=>[c,p.customers[c].baseRevenueBn])),
      baseExternalTPURevenueBn:p.externalTPU.baseRevenueBn,baseCashCapexBn:cap.baseCashCapexBn,
      historicalReconciliationDifferenceBn:baseEnterprise+sum(CLOUD_CUSTOMERS.map(c=>p.customers[c].baseRevenueBn))+p.externalTPU.baseRevenueBn-base.cloudRevenueBn},
    validation:{historicalTotalsLocked:true,msInputsUsedForForecast:false,budgetAndCapacityAdded:false,externalTPUAddedToCapex:false,finiteForecasts:true}};
}
function referenceSets(data) {
  const raw=data.comparisons||data.benchmarks||{};
  if(Array.isArray(raw))return raw.filter(v=>object(v)&&(Array.isArray(v.quarters)||Array.isArray(v.annual)));
  return Object.entries(raw).filter(([,v])=>Array.isArray(v)||(object(v)&&(Array.isArray(v.quarters)||Array.isArray(v.annual))))
    .map(([broker,v])=>Array.isArray(v)?{broker,quarters:v}:{broker,...v});
}
function comparisons(data,result) {
  return referenceSets(data).map(ref=>{
    const row=(q,r)=>({period:q.period,modelCloudRevenueBn:q.cloudRevenueBn,referenceCloudRevenueBn:r?.cloudRevenueBn??null,
      cloudDeltaBn:Number.isFinite(r?.cloudRevenueBn)?q.cloudRevenueBn-r.cloudRevenueBn:null,cloudDeltaPct:ratio(q.cloudRevenueBn,r?.cloudRevenueBn),
      modelCashCapexBn:q.cashCapexBn,referenceCashCapexBn:r?.cashCapexBn??null,
      capexDeltaBn:Number.isFinite(r?.cashCapexBn)&&q.cashCapexBn!==null?q.cashCapexBn-r.cashCapexBn:null,capexDeltaPct:ratio(q.cashCapexBn,r?.cashCapexBn)});
    const rq=ref.quarters||[],ra=ref.annual||[];
    return {broker:ref.broker||ref.name,publicationDate:ref.publicationDate||ref.date||ref.asOf||null,sourceRefs:ref.sourceRefs||[],
      note:'不同日期、不同信息集的机构模型对照，不代表同期市场共识；未用于独立预测计算。',
      quarters:result.quarters.map(q=>row(q,rq.find(r=>r.period===q.period))),
      annual:result.annual.map(q=>{const explicit=ra.find(r=>String(r.period).replace('FY','')===q.period),parts=rq.filter(r=>r.period.startsWith(q.period));
        const r=explicit||(parts.length===4?{cloudRevenueBn:parts.every(r=>Number.isFinite(r.cloudRevenueBn))?sum(parts.map(r=>r.cloudRevenueBn)):null,cashCapexBn:parts.every(r=>Number.isFinite(r.cashCapexBn))?sum(parts.map(r=>r.cashCapexBn)):null}:null);
        return {...row(q,r),complete:q.complete};})};
  });
}
export function resetCloudOverrides() {return {};}
export function cloudPresets() {
  return [{id:'base',label:'研究基准',overrides:{}},
    {id:'lower_delivery',label:'交付与需求偏弱',overrides:{'global.customerBudgetMultiplier':.85,'global.capacityMultiplier':.8,'global.enterpriseGrowthAdjustment':-.02,'global.tpuVolumeMultiplier':.8}},
    {id:'higher_delivery',label:'交付与需求偏强',overrides:{'global.customerBudgetMultiplier':1.15,'global.capacityMultiplier':1.2,'global.enterpriseGrowthAdjustment':.02,'global.tpuVolumeMultiplier':1.2}}];
}
export function runCloudSensitivity(data,overrides={}) {
  const base=run(data,overrides),year=base.annual.filter(a=>a.complete).at(-1)?.period;
  if(!year)return [];
  const baseAnnual=base.annual.find(a=>a.period===year),flat=base.overrides;
  return Object.keys(GLOBAL_BOUNDS).map(key=>{
    const path=`global.${key}`,value=base.parameters.global[key],[min,max]=GLOBAL_BOUNDS[key];
    const step=key==='enterpriseGrowthAdjustment'?.01:Math.max(.1,Math.abs(value)*.1);
    const down=Math.max(min,value-step),up=Math.min(max,value+step);
    const lo=run(data,{...flat,[path]:down}).annual.find(a=>a.period===year),hi=run(data,{...flat,[path]:up}).annual.find(a=>a.period===year);
    return {path,label:LABELS[key],period:year,baseValue:value,downValue:down,upValue:up,
      baseCloudRevenueBn:baseAnnual.cloudRevenueBn,downCloudRevenueBn:lo.cloudRevenueBn,upCloudRevenueBn:hi.cloudRevenueBn,
      baseCashCapexBn:baseAnnual.cashCapexBn,downCashCapexBn:lo.cashCapexBn,upCashCapexBn:hi.cashCapexBn,
      note:key==='enterpriseGrowthAdjustment'?'单因素环比增速±1个百分点，其余参数固定':'单因素倍率±10%附近冲击，其余参数固定；约束可能使局部响应为零'};
  });
}
export function requiredMSParameters(data,overrides={}) {
  const base=run(data,overrides),ref=referenceSets(data).find(r=>/^(ms|morgan stanley)$/i.test(r.broker||r.name||''));
  if(!ref)return [];
  const keys=['customerBudgetMultiplier','capacityMultiplier','googleShareMultiplier','tpuVolumeMultiplier','enterpriseGrowthAdjustment'];
  return base.quarters.flatMap(q=>{
    const reference=ref.quarters?.find(r=>r.period===q.period),target=reference?.cloudRevenueBn;if(!Number.isFinite(target))return [];
    const solutions=keys.map(key=>{
      const path=`global.${key}`,[lo,hi]=GLOBAL_BOUNDS[key],evaluate=value=>run(data,{...base.overrides,[path]:value}).quarters.find(r=>r.period===q.period).cloudRevenueBn;
      const lower=evaluate(lo),upper=evaluate(hi),item={path,label:LABELS[key],currentValue:base.parameters.global[key],value:null,feasible:false,
        lowerRevenueBn:lower,upperRevenueBn:upper,bounds:[lo,hi],status:'out_of_range'};
      if(Math.abs(q.cloudRevenueBn-target)<1e-7)return {...item,value:item.currentValue,feasible:true,status:'already_met'};
      if(target<Math.min(lower,upper)-1e-8||target>Math.max(lower,upper)+1e-8)return item;
      if(Math.abs(upper-lower)<1e-9)return {...item,status:'non_identifiable'};
      let left=lo,right=hi;
      for(let j=0;j<52;j++){const mid=(left+right)/2,value=evaluate(mid);if(value<target)left=mid;else right=mid;}
      const answer=(left+right)/2,achieved=evaluate(answer);
      return {...item,value:answer,feasible:Math.abs(achieved-target)<1e-6,status:Math.abs(achieved-target)<1e-6?'feasible':'out_of_range',achievedRevenueBn:achieved};
    });
    const capexTarget=reference?.cashCapexBn;
    const capexSolutions=Number.isFinite(capexTarget)?['equipmentCostMultiplier','facilityCostMultiplier','nonCloudCapexMultiplier','capacityMultiplier'].map(key=>{
      const path=`global.${key}`,[lo,hi]=GLOBAL_BOUNDS[key],evaluate=value=>run(data,{...base.overrides,[path]:value}).quarters.find(r=>r.period===q.period);
      const lower=evaluate(lo).cashCapexBn,upper=evaluate(hi).cashCapexBn;
      const item={path,label:LABELS[key],currentValue:base.parameters.global[key],value:null,feasible:false,status:'out_of_range',
        lowerCashCapexBn:lower,upperCashCapexBn:upper,bounds:[lo,hi]};
      if(Math.abs(q.cashCapexBn-capexTarget)<1e-7)return {...item,value:item.currentValue,feasible:true,status:'already_met'};
      if(capexTarget<Math.min(lower,upper)-1e-8||capexTarget>Math.max(lower,upper)+1e-8)return item;
      if(Math.abs(upper-lower)<1e-9)return {...item,status:'non_identifiable'};
      let left=lo,right=hi;
      for(let j=0;j<52;j++){const mid=(left+right)/2;if(evaluate(mid).cashCapexBn<capexTarget)left=mid;else right=mid;}
      const value=(left+right)/2,achieved=evaluate(value);
      return {...item,value,feasible:Math.abs(achieved.cashCapexBn-capexTarget)<1e-6,
        status:Math.abs(achieved.cashCapexBn-capexTarget)<1e-6?'feasible':'out_of_range',
        achievedCashCapexBn:achieved.cashCapexBn,associatedCloudRevenueBn:achieved.cloudRevenueBn};
    }):[];
    return [{period:q.period,targetCloudRevenueBn:target,currentCloudRevenueBn:q.cloudRevenueBn,gapBn:target-q.cloudRevenueBn,solutions,
      targetCashCapexBn:capexTarget??null,currentCashCapexBn:q.cashCapexBn,
      capexGapBn:Number.isFinite(capexTarget)?capexTarget-q.cashCapexBn:null,capexSolutions,
      note:'每个结果是只改该参数、其余固定的独立反推；各解不能同时应用，不代表机构采用这些假设。'}];
  });
}
export function calculateCloudCase(data,overrides={}) {
  const result=run(data,overrides),base=Object.keys(result.overrides).length?run(data):result;
  result.drivers=result.quarters.map((q,i)=>{
    const b=base.quarters[i],components={enterprise:q.enterpriseRevenueBn-b.enterpriseRevenueBn,
      ...Object.fromEntries(CLOUD_CUSTOMERS.map(c=>[c,q.customerRevenueBn[c]-b.customerRevenueBn[c]])),externalTPU:q.externalTPURevenueBn-b.externalTPURevenueBn};
    q.deltaVsBase={cloudRevenueBn:q.cloudRevenueBn-b.cloudRevenueBn,cashCapexBn:q.cashCapexBn-b.cashCapexBn,components};
    return {period:q.period,...q.deltaVsBase};
  });
  for(const a of result.annual) {
    const b=base.annual.find(x=>x.period===a.period),rows=result.drivers.filter(x=>x.period.startsWith(a.period));
    a.deltaVsBase={cloudRevenueBn:a.cloudRevenueBn===null||b.cloudRevenueBn===null?null:a.cloudRevenueBn-b.cloudRevenueBn,
      cashCapexBn:a.cashCapexBn===null||b.cashCapexBn===null?null:a.cashCapexBn-b.cashCapexBn,
      components:Object.fromEntries(['enterprise',...CLOUD_CUSTOMERS,'externalTPU'].map(k=>[k,sum(rows.map(x=>x.components[k]))]))};
  }
  result.comparisons=comparisons(data,result);result.benchmarks=result.comparisons;
  for(const q of result.quarters)q.comparison=Object.fromEntries(result.comparisons.map(c=>[c.broker,c.quarters.find(r=>r.period===q.period)]));
  result.sensitivity=runCloudSensitivity(data,overrides);result.inverse=requiredMSParameters(data,overrides);
  result.presets=cloudPresets(data);result.backtest=clone(data.backtest||{});return result;
}
