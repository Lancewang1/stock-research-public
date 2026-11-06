import json, math, datetime as dt
from collections import OrderedDict

MARKET=json.load(open('input_market.json',encoding='utf-8'))
def load(t):
    return dict(sorted(MARKET[t].items()))

G=load('GOOGL'); Q=load('QQQ'); X=load('XLC')
dates=list(G.keys())
c=[G[d]['c'] for d in dates]; o=[G[d]['o'] for d in dates]; h=[G[d]['h'] for d in dates]; l=[G[d]['l'] for d in dates]; v=[G[d]['v'] for d in dates]
n=len(dates)
print('range',dates[0],dates[-1],'first close',c[0],'last',c[-1])

def sma(a,w):
    out=[None]*len(a); s=0
    for i,x in enumerate(a):
        s+=x
        if i>=w: s-=a[i-w]
        if i>=w-1: out[i]=s/w
    return out
def ema(a,w):
    out=[None]*len(a); k=2/(w+1); e=None
    for i,x in enumerate(a):
        e=x if e is None else x*k+e*(1-k); out[i]=e
    return out
def rsi(a,w=14):
    out=[None]*len(a); g=l_=None
    for i in range(1,len(a)):
        ch=a[i]-a[i-1]; up=max(ch,0); dn=max(-ch,0)
        if i<=w:
            g=(g or 0)+up/w; l_=(l_ or 0)+dn/w
            if i==w: out[i]=100-100/(1+(g/l_ if l_ else 1e9))
        else:
            g=(g*(w-1)+up)/w; l_=(l_*(w-1)+dn)/w
            out[i]=100-100/(1+(g/l_ if l_ else 1e9))
    return out
ma20=sma(c,20); ma60=sma(c,60); ma200=sma(c,200); r14=rsi(c)
e12=ema(c,12); e26=ema(c,26); macd=[a-b for a,b in zip(e12,e26)]; sig=ema(macd,9); hist=[a-b for a,b in zip(macd,sig)]
# bollinger
bbu=[None]*n; bbl=[None]*n
for i in range(19,n):
    w=c[i-19:i+1]; m=sum(w)/20; sd=math.sqrt(sum((x-m)**2 for x in w)/20); bbu[i]=m+2*sd; bbl[i]=m-2*sd
# ATR14
tr=[h[0]-l[0]]+[max(h[i]-l[i],abs(h[i]-c[i-1]),abs(l[i]-c[i-1])) for i in range(1,n)]
atr=[None]*n
if n>=14:
    atr[13]=sum(tr[:14])/14
    for i in range(14,n):atr[i]=(atr[i-1]*13+tr[i])/14

# ---- Backtest: MA20/MA60 cross with RSI filter, long-only, next-day open fill
trades=[]; pos=None; signals=[]
for i in range(61,n-1):
    up=ma20[i]>ma60[i] and ma20[i-1]<=ma60[i-1]
    dn=ma20[i]<ma60[i] and ma20[i-1]>=ma60[i-1]
    if pos is None and up and r14[i] and r14[i]<75:
        pos=dict(ei=i+1,ep=o[i+1]); signals.append(dict(i=i+1,t='B',p=o[i+1]))
    elif pos is not None and (dn or c[i]<pos['ep']*0.90):
        ret=o[i+1]/pos['ep']-1
        trades.append(dict(ed=dates[pos['ei']],xd=dates[i+1],ep=round(pos['ep'],2),xp=round(o[i+1],2),ret=round(ret*100,2),days=i+1-pos['ei'],why='止损' if (c[i]<pos['ep']*0.90 and not dn) else '死叉'))
        signals.append(dict(i=i+1,t='S',p=o[i+1])); pos=None
openpos=None
if pos is not None:
    openpos=dict(ed=dates[pos['ei']],ep=round(pos['ep'],2),ret=round((c[-1]/pos['ep']-1)*100,2))
wins=[t for t in trades if t['ret']>0]
# equity curve of strategy vs buy&hold
eq=[1.0]*n; inpos=False; sigmap={s['i']:s['t'] for s in signals}
for i in range(1,n):
    eq[i]=eq[i-1]
    if inpos:
        if sigmap.get(i)=='S':
            eq[i]*=o[i]/c[i-1]; inpos=False
        else: eq[i]*=c[i]/c[i-1]
    elif sigmap.get(i)=='B':
        eq[i]*=c[i]/o[i]; inpos=True
# Strategy equity and the trade ledger both use next-day open fills, no costs.
stats=dict(n=len(trades),win=round(100*len(wins)/max(1,len(trades)),1),avg=round(sum(t['ret'] for t in trades)/max(1,len(trades)),2),
           avgwin=round(sum(t['ret'] for t in wins)/max(1,len(wins)),2),avgloss=round(sum(t['ret'] for t in trades if t['ret']<=0)/max(1,len(trades)-len(wins)),2),
           strat=round((eq[-1]-1)*100,1),bh=round((c[-1]/c[0]-1)*100,1))
# max drawdown both
def mdd(a):
    pk=a[0]; m=0
    for x in a:
        pk=max(pk,x); m=min(m,x/pk-1)
    return round(m*100,1)
stats['mdd_s']=mdd(eq); stats['mdd_bh']=mdd(c)
print('trades',stats)

# ---- 20-day forecast cone (log-return drift & vol over last 250d), labeled statistical extrapolation
import statistics
lr=[math.log(c[i]/c[i-1]) for i in range(n-250,n)]
mu=statistics.mean(lr); sd=statistics.pstdev(lr)
cone=[]
last=c[-1]; d0=dt.date.fromisoformat(dates[-1])
k=0; dd=d0
while k<20:
    dd+=dt.timedelta(days=1)
    if dd.weekday()>=5 or dd.isoformat() in MARKET.get('_market_holidays',[]): continue
    k+=1
    cone.append(dict(d=dd.isoformat(),m=round(last*math.exp(mu*k),2),u1=round(last*math.exp(mu*k+sd*math.sqrt(k)),2),l1=round(last*math.exp(mu*k-sd*math.sqrt(k)),2),u2=round(last*math.exp(mu*k+2*sd*math.sqrt(k)),2),l2=round(last*math.exp(mu*k-2*sd*math.sqrt(k)),2)))

# ---- auto trendlines: pivot highs/lows over last 250 days
seg=range(n-250,n)
def pivots(arr,cmp,w=10):
    out=[]
    for i in seg:
        win=arr[max(0,i-w):i+w+1]
        if arr[i]==(max(win) if cmp=='h' else min(win)): out.append(i)
    return out
ph=pivots(h,'h'); pl=pivots(l,'l')
def fitline(idx,arr):
    if len(idx)<2: return None
    xs=idx; ys=[arr[i] for i in idx]
    mx=sum(xs)/len(xs); my=sum(ys)/len(ys)
    b=sum((x-mx)*(y-my) for x,y in zip(xs,ys))/max(1e-9,sum((x-mx)**2 for x in xs)); a=my-b*mx
    return dict(i0=xs[0],i1=n-1+20,y0=round(a+b*xs[0],2),y1=round(a+b*(n-1+20),2))
res_line=fitline(ph[-4:],h); sup_line=fitline(pl[-4:],l)
levels=sorted(set(round(h[i],0) for i in ph[-6:]))[:3]+sorted(set(round(l[i],0) for i in pl[-6:]))[-3:]

# ---- factor attribution: rolling 60d OLS of GOOGL ret on QQQ ret and XLC residual (industry ex-market)
qd=set(Q.keys()); xd=set(X.keys())
rets=[]  # (date, rg, rq, rx)
for i in range(1,n):
    d=dates[i]; p=dates[i-1]
    if d in qd and p in qd:
        rg=c[i]/c[i-1]-1; rq=Q[d]['c']/Q[p]['c']-1
        rx=(X[d]['c']/X[p]['c']-1) if (d in xd and p in xd) else None
        rets.append((d,rg,rq,rx))
def ols2(ys,x1,x2):
    # y = a + b1 x1 + b2 x2 via normal equations (2 regressors)
    m=len(ys); mx1=sum(x1)/m; mx2=sum(x2)/m; my=sum(ys)/m
    s11=sum((a-mx1)**2 for a in x1); s22=sum((a-mx2)**2 for a in x2); s12=sum((a-mx1)*(b-mx2) for a,b in zip(x1,x2))
    s1y=sum((a-mx1)*(y-my) for a,y in zip(x1,ys)); s2y=sum((a-mx2)*(y-my) for a,y in zip(x2,ys))
    det=s11*s22-s12*s12
    if abs(det)<1e-12: return my,0,0
    b1=(s1y*s22-s2y*s12)/det; b2=(s2y*s11-s1y*s12)/det; a=my-b1*mx1-b2*mx2
    return a,b1,b2
# monthly attribution: for each month, use trailing-60d betas estimated at month start, decompose month return
months=OrderedDict()
for i,(d,rg,rq,rx) in enumerate(rets):
    months.setdefault(d[:7],[]).append(i)
attr=[]
keys=list(months.keys())
for mkey in keys:
    idx=months[mkey]
    st=idx[0]
    if st<60: continue
    win=rets[st-60:st]
    if any(w[3] is None for w in win): 
        # before XLC exists: single factor
        ys=[w[1] for w in win]; xs=[w[2] for w in win]
        mx=sum(xs)/60; my=sum(ys)/60
        b=sum((x-mx)*(y-my) for x,y in zip(xs,ys))/max(1e-12,sum((x-mx)**2 for x in xs)); a=my-b*mx; b2=0
        # industry residual: none
        mk=sum(rets[i][2] for i in idx); ind=0; tot=math.prod(1+rets[i][1] for i in idx)-1
        attr.append(dict(m=mkey,tot=round(tot*100,2),mkt=round(b*mk*100,2),ind=0,alpha=round((tot-b*mk)*100,2),beta=round(b,2),bi=None))
        continue
    # industry factor = XLC return orthogonalised to QQQ over the window
    xs1=[w[2] for w in win]; xs2=[w[3] for w in win]
    mx1=sum(xs1)/60; mx2=sum(xs2)/60
    bq=sum((a-mx1)*(b-mx2) for a,b in zip(xs1,xs2))/max(1e-12,sum((a-mx1)**2 for a in xs1))
    ind_win=[b-bq*a for a,b in zip(xs1,xs2)]
    a,b1,b2=ols2([w[1] for w in win],xs1,ind_win)
    mk=sum(rets[i][2] for i in idx); ind=sum((rets[i][3]-bq*rets[i][2]) for i in idx); tot=math.prod(1+rets[i][1] for i in idx)-1
    attr.append(dict(m=mkey,tot=round(tot*100,2),mkt=round(b1*mk*100,2),ind=round(b2*ind*100,2),alpha=round((tot-b1*mk-b2*ind)*100,2),beta=round(b1,2),bi=round(b2,2)))
print('attr months',len(attr),attr[-1])

# ---- sentiment proxy (price/volume derived; labeled as proxy)
vol_ma=sma(v,60); sent=[None]*n
ret20=[None]*n
for i in range(20,n):
    ret20[i]=c[i]/c[i-20]-1
for i in range(60,n):
    z_r=max(-1,min(1,ret20[i]/0.15))
    z_v=max(-1,min(1,(v[i]/vol_ma[i]-1)))
    z_rsi=(r14[i]-50)/50
    dist=max(-1,min(1,(c[i]/ma60[i]-1)/0.15))
    s=50+50*(0.35*z_r+0.15*z_v+0.3*z_rsi+0.2*dist)
    sent[i]=round(max(0,min(100,s)),1)

# Valuation is populated by build_dashboard from dated quarterly records.
eps=[None]*n; bv=[None]*n; pe=[None]*n; pb=[None]*n; pe_pct=[None]*n

# ---- events (DEMO cards for click-through), anchored on real dates
events=[
 dict(d='2018-07-23',tag='财报',title='Q2 2018 财报 · 云与 YouTube 增速成焦点',sell='示例：卖方多数维持买入，一致目标价上调；争议点在 TAC 占比抬升与 EU 罚款一次性影响。',buy='示例：多头仓位拥挤度中性偏高，财报前期权隐含波动 ±5%。',fund='示例：收入增速 26%、营业利润率 24%，资本开支加速。'),
 dict(d='2020-03-23',tag='宏观',title='疫情低点 · 广告需求断崖担忧',sell='示例：卖方集体下修 2020 广告收入预测，但强调搜索份额与现金储备。',buy='示例：买方情绪极度悲观，机构净卖出，VIX 创纪录。',fund='示例：PE 回落至 5 年低位区间；现金 1,170 亿美元为缓冲。'),
 dict(d='2021-02-02',tag='财报',title='Q4 2020 财报 · 首次披露云分部亏损',sell='示例：卖方关注云分部经营亏损口径与 YouTube 广告加速；目标价普遍上调。',buy='示例：买方持仓回到高位，情绪指标进入乐观区。',fund='示例：收入增速 23%，YouTube 广告 +46%。'),
 dict(d='2022-07-18',tag='公司',title='20:1 拆股生效',sell='示例：卖方认为拆股不改变基本面，但利于散户参与与潜在纳入道指讨论。',buy='示例：散户交易占比上升；机构持仓变化不大。',fund='示例：拆股后 EPS/BVPS 口径同步调整，估值不变。'),
 dict(d='2022-11-03',tag='宏观',title='加息周期估值压缩 · 年内低点附近',sell='示例：卖方下修 2023 收入增速至个位数，强调成本控制。',buy='示例：买方情绪悲观，成长股集体去仓位。',fund='示例：PE 压缩到十年低位；广告收入同比首次下滑。'),
 dict(d='2023-02-08',tag='产品',title='Bard 发布会后股价单日大跌',sell='示例：卖方分歧加大，AI 搜索对广告变现的冲击成为核心争议。',buy='示例：对冲基金短期减仓，散户抄底。',fund='示例：2023 指引强调效率年，裁员 1.2 万人。'),
 dict(d='2024-04-25',tag='财报',title='Q1 2024 财报 · 首次派息 + 700 亿回购',sell='示例：卖方一致上调目标价，云利润率成为新叙事。',buy='示例：买方情绪进入过热区，期权看涨比例高。',fund='示例：云营业利润率转正至 9%，云收入 +28%。'),
 dict(d='2025-04-24',tag='财报',title='Q1 2025 财报 · 关税扰动下搜索韧性',sell='示例：卖方关注 AI Overviews 变现与 capex 上修至 750 亿。',buy='示例：买方从关税恐慌中回补仓位。',fund='示例：搜索收入 +10%，capex/收入比抬升。'),
 dict(d='2026-10-28',tag='财报',title='Q3 2026 财报电话会',sell='示例：卖方观点待接入（进门 searchForeignReports）。',buy='示例：买方情绪待接入（持仓/期权/舆情源）。',fund='示例：基本面数据待接入 Wind。'),
]
dset=set(dates)
for e in events:
    # snap to nearest trading day
    d=dt.date.fromisoformat(e['d'])
    while d.isoformat() not in dset: d+=dt.timedelta(days=1)
    e['d']=d.isoformat(); e['i']=dates.index(e['d'])

def r2(a): return [None if x is None else round(x,2) for x in a]
data=dict(
  meta=dict(ticker='GOOGL',name='Alphabet Inc.',asof=dates[-1],n=n,src='Nasdaq.com historical API · 复权日线 · 取数 2026-11-04'),
  d=dates,o=r2(o),h=r2(h),l=r2(l),c=r2(c),v=[int(x) for x in v],
  ma20=r2(ma20),ma60=r2(ma60),ma200=r2(ma200),rsi=r2(r14),macd=r2(macd),sig=r2(sig),hist=r2(hist),bbu=r2(bbu),bbl=r2(bbl),atr=r2(atr),
  signals=signals,trades=trades,openpos=openpos,stats=stats,eq=[round(x,4) for x in eq],
  cone=cone,res=res_line,sup=sup_line,levels=levels,drift=dict(mu=round(mu*252*100,1),vol=round(sd*math.sqrt(252)*100,1)),
  attr=attr,sent=sent,
  qqq=[round(Q[d]['c'],2) if d in Q else None for d in dates],xlc=[round(X[d]['c'],2) if d in X else None for d in dates],
  eps=eps,bv=bv,pe=pe,pb=pb,pe_pct=pe_pct,events=events)
s=json.dumps(data,separators=(',',':'),ensure_ascii=False)
open('data.json','w',encoding='utf-8').write(s); print('json bytes',len(s))
