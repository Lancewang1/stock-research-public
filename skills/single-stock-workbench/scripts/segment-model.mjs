/** Company-neutral segment operating-profit bridge; all inputs are versioned. */
export function calculateSegmentCase(data,overrides={}){
  if(!overrides||typeof overrides!=='object'||Array.isArray(overrides))throw new TypeError('情景必须是对象');
  const keys=data.segments.map(s=>s.key),periods=new Set(data.quarters.map(q=>q.period));
  for(const [period,o] of Object.entries(overrides)){
    if(!periods.has(period)||!o||typeof o!=='object'||Array.isArray(o))throw new TypeError('期间或情景格式无效');
    for(const [key,value] of Object.entries(o)){
      if(!keys.some(k=>key===k+'RevenueChange'||key===k+'Margin'))throw new TypeError('未知分部参数');
      if(!Number.isFinite(value)||value< -1||value>(key.endsWith('Margin')?1:3))throw new RangeError('收入变化须为-100%至300%；营业利润率须为-100%至100%');
    }
  }
  const quarters=data.quarters.map(q=>{
    const changes=overrides[q.period]||{};if(q.kind!=='estimate'&&Object.keys(changes).length)throw new TypeError('实际期锁定');
    const segments=Object.fromEntries(keys.map(k=>{const b=q.segments[k],r=b.revenue*(1+(changes[k+'RevenueChange']??0)),margin=changes[k+'Margin']??b.operatingIncome/b.revenue;return[k,{revenue:r,operatingMargin:margin,operatingIncome:r*margin}];}));
    const revenue=Object.values(segments).reduce((s,x)=>s+x.revenue,0),operatingIncome=Object.values(segments).reduce((s,x)=>s+x.operatingIncome,0)+q.unallocatedOperatingIncome,netIncome=(operatingIncome+q.otherIncome)*(1-q.taxRate)-q.equityMethodLoss+q.accountingChange;
    const epsShares=netIncome<0?q.basicShares:q.dilutedShares;return {...q,segments,revenue,operatingIncome,netIncome,epsShares,eps:netIncome/epsShares};
  });
  const annual=[];for(const year of new Set(quarters.map(q=>q.period.slice(0,4)))){const qs=quarters.filter(q=>q.period.startsWith(year));if(qs.length!==4)continue;const days=qs.reduce((s,q)=>s+q.days,0),shares=qs.reduce((s,q)=>s+q.days*q.epsShares,0)/days;const row={period:year,dilutedShares:shares};for(const k of ['revenue','operatingIncome','netIncome'])row[k]=qs.reduce((s,q)=>s+q[k],0);row.eps=row.netIncome/shares;annual.push(row);}
  return {quarters,annual};
}
