/** Descriptive review arithmetic. No forward fill, trading recommendations or look-ahead signals. */
const raFinite=x=>typeof x==='number'&&Number.isFinite(x);
export function reviewPivots(dates,prices,{rise=.15,fall=.15,window=0}={}){
  if(!(rise>0&&rise<=2&&fall>0&&fall<1)||!Number.isInteger(window)||window<0)throw new RangeError('涨幅须>0，回撤须在0与100%之间；窗口须为非负整数');
  const start=window?Math.max(0,dates.length-window):0,out=[];let mode=0,lo=start,hi=start,ext=start;
  const push=(t,i,confirmedAt)=>out.push({t,i,d:dates[i],px:prices[i],confirmedAt:confirmedAt==null?null:dates[confirmedAt],prov:confirmedAt==null});
  for(let i=start+1;i<dates.length;i++){
    if(!mode){if(prices[i]<prices[lo])lo=i;if(prices[i]>prices[hi])hi=i;if(prices[i]>=prices[lo]*(1+rise)){push('bottom',lo,i);mode=1;ext=i;}else if(prices[i]<=prices[hi]*(1-fall)){push('top',hi,i);mode=-1;ext=i;}}
    else if(mode===1){if(prices[i]>=prices[ext])ext=i;else if(prices[i]<=prices[ext]*(1-fall)){push('top',ext,i);mode=-1;ext=i;}}
    else{if(prices[i]<=prices[ext])ext=i;else if(prices[i]>=prices[ext]*(1+rise)){push('bottom',ext,i);mode=1;ext=i;}}
  }
  if(mode)push(mode===1?'top':'bottom',ext,null);
  return out.map((p,k)=>({...p,chg:k?100*(p.px/out[k-1].px-1):null,days:k?p.i-out[k-1].i:null,next:k+1<out.length?100*(out[k+1].px/p.px-1):null,ndays:k+1<out.length?out[k+1].i-p.i:null,note:null}));
}
export function reviewInterval(dates,series,start,end){
  if(start>end)throw new RangeError('起始日期不能晚于终止日期');
  const i=dates.findIndex(d=>d>=start);let j=dates.length-1;while(j>=0&&dates[j]>end)j--;
  if(i<0||j<=i)throw new RangeError('区间至少需要两个交易日');
  const returns=Object.fromEntries(Object.entries(series).map(([k,v])=>[k,raFinite(v[i])&&v[i]>0&&raFinite(v[j])?v[j]/v[i]-1:null]));
  return {i,j,start:dates[i],end:dates[j],returns,excess:Object.fromEntries(Object.entries(returns).filter(([k])=>k!=='GOOGL').map(([k,v])=>[k,v==null||returns.GOOGL==null?null:returns.GOOGL-v]))};
}
export function earningsMultipleBridge({start,end,priceStart,priceEnd,snapshots,maxAge=120}){
  const eligible=date=>snapshots.filter(s=>s.effectiveDate<=date&&s.publicationDate<=date&&s.eps>0&&((Date.parse(date)-Date.parse(s.publicationDate))/864e5<=maxAge)).sort((a,b)=>a.effectiveDate.localeCompare(b.effectiveDate)).at(-1);
  const a=eligible(start),b=eligible(end);if(!a||!b)return {available:false,reason:'缺少在两个端点已可获得、且未超过时效窗口的盈利预测；不以当前预测倒填历史。'};
  if(a.broker!==b.broker||a.period!==b.period||a.basis!==b.basis)return {available:false,reason:'预测机构、目标财年或EPS口径不同，不能计算同口径估值桥。'};
  if(!(priceStart>0&&priceEnd>0))return {available:false,reason:'价格无效'};
  const epsReturn=b.eps/a.eps-1,multipleStart=priceStart/a.eps,multipleEnd=priceEnd/b.eps,multipleReturn=multipleEnd/multipleStart-1;
  return {available:true,a,b,multipleStart,multipleEnd,epsReturn,multipleReturn,interaction:epsReturn*multipleReturn,total:priceEnd/priceStart-1,sameSnapshot:a.id===b.id,ageStart:(Date.parse(start)-Date.parse(a.publicationDate))/864e5,ageEnd:(Date.parse(end)-Date.parse(b.publicationDate))/864e5};
}
export function datedEvidence(events,start,end){return {known:events.filter(e=>e.effectiveDate<=start),during:events.filter(e=>e.effectiveDate>start&&e.effectiveDate<=end),later:events.filter(e=>e.effectiveDate>end)};}
export function pairedStats(pairs){
  if(pairs.length<20)return {n:pairs.length,correlation:null,beta:null,reason:'有效配对不足20，不输出相关性'};
  const n=pairs.length,mx=pairs.reduce((s,p)=>s+p.x,0)/n,my=pairs.reduce((s,p)=>s+p.y,0)/n;
  let xx=0,yy=0,xy=0;for(const p of pairs){xx+=(p.x-mx)**2;yy+=(p.y-my)**2;xy+=(p.x-mx)*(p.y-my);}
  return {n,correlation:xx>0&&yy>0?xy/Math.sqrt(xx*yy):null,beta:xx>0?xy/xx:null,meanStockReturn:my};
}
export function rollingFactor(dates,prices,observations,end,window=60,transform='return'){
  if(!Number.isInteger(window)||window<20||window>756)throw new RangeError('相关性窗口须为20至756个交易日');
  const map=new Map(observations.filter(o=>raFinite(o.value)).map(o=>[o.date,o.value]));let stop=dates.length-1;while(stop>=0&&dates[stop]>end)stop--;
  const pairs=[];for(let i=Math.max(1,stop-window+1);i<=stop;i++){
    const a=map.get(dates[i-1]),b=map.get(dates[i]);if(!raFinite(a)||!raFinite(b)||!raFinite(prices[i])||!(prices[i-1]>0))continue;
    const x=transform==='bp'?(b-a)*100:transform==='difference'?b-a:a>0?b/a-1:null;if(!raFinite(x))continue;
    pairs.push({date:dates[i],x,y:prices[i]/prices[i-1]-1});
  }
  const half=Math.floor(pairs.length/2),first=pairedStats(pairs.slice(0,half)),second=pairedStats(pairs.slice(half)),all=pairedStats(pairs);
  return {...all,start:pairs[0]?.date,end:pairs.at(-1)?.date,requestedSessions:window,first,second,stability:first.correlation==null||second.correlation==null?'分段样本不足':Math.sign(first.correlation)!==Math.sign(second.correlation)?'方向翻转':Math.abs(first.correlation-second.correlation)>.3?'幅度变化较大':'分段方向相同且差异≤0.3（描述性）'};
}
export function technicalSnapshot(dates,close,high,low,end){
  let j=dates.length-1;while(j>=0&&dates[j]>end)j--;if(j<0)return null;
  const mean=n=>j+1<n?null:close.slice(j-n+1,j+1).reduce((a,b)=>a+b,0)/n;
  // Wilder smoothing from the beginning of the supplied price series.
  let gain=0,loss=0,atr=0,rsi=null;for(let i=1;i<=j;i++){
    const change=close[i]-close[i-1],g=Math.max(0,change),l=Math.max(0,-change),tr=Math.max(high[i]-low[i],Math.abs(high[i]-close[i-1]),Math.abs(low[i]-close[i-1]));
    if(i<=14){gain+=g/14;loss+=l/14;atr+=tr/14;}else{gain=(gain*13+g)/14;loss=(loss*13+l)/14;atr=(atr*13+tr)/14;}
    if(i>=14)rsi=loss===0?(gain===0?50:100):100-100/(1+gain/loss);
  }
  const ret=close.slice(Math.max(0,j-20),j+1).map((x,i,a)=>i?Math.log(x/a[i-1]):null).slice(1),m=ret.reduce((a,b)=>a+b,0)/ret.length;
  return {date:dates[j],price:close[j],ma20:mean(20),ma60:mean(60),ma200:mean(200),rsi14:rsi,atr14:j>=14?atr:null,vol20:ret.length===20?Math.sqrt(ret.reduce((s,x)=>s+(x-m)**2,0)/19*252):null};
}
