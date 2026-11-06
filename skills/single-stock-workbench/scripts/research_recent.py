#!/usr/bin/env python3
"""Fetch auditable offline research snapshots. Credentials never leave memory.

API credentials come from process environment or the user's API integration
note. Saved requests contain only public parameters; signed URLs are omitted.
"""
from __future__ import annotations
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT=Path(__file__).resolve().parents[1]

def credentials(note):
    keys={"WIND_API_KEY":os.environ.get("WIND_API_KEY"),"EODHD_API_TOKEN":os.environ.get("EODHD_API_TOKEN")}
    if note.is_file():
        lines=note.read_text(encoding="utf-8-sig").splitlines()
        for service,env in (("wind","WIND_API_KEY"),("eodhd","EODHD_API_TOKEN")):
            if keys[env]:continue
            for line in lines:
                if service not in line.lower():continue
                candidates=re.findall(r"(?<![A-Za-z0-9_])[A-Za-z0-9][A-Za-z0-9._-]{19,}(?![A-Za-z0-9_])",line)
                candidates=[x for x in candidates if not any(t in x.lower()for t in ["api_token","user-agent","get_financial","eodhd.com"])]
                if candidates:
                    keys[env]=max(candidates,key=len)
                    break
    return keys

def scrub(value,keys):
    text=json.dumps(value,ensure_ascii=False)if not isinstance(value,str)else value
    for key in keys.values():
        if key:text=text.replace(key,"[REDACTED]")
    text=re.sub(r"(?i)(api_token|api_key|token|apikey|access_token|state)=([^&\s\"<>]+)",r"\1=[REDACTED]",text)
    return text

def save(folder,name,payload,keys):
    folder.mkdir(parents=True,exist_ok=True)
    text=scrub(payload,keys)
    (folder/(name+".json")).write_text(text+"\n",encoding="utf-8")
    return text

def http_json(url,public,keys):
    started=datetime.now(timezone.utc).isoformat(timespec="seconds")
    req=urllib.request.Request(url,headers={"User-Agent":"LanceResearch/1.0","Accept":"application/json"})
    try:
        with urllib.request.urlopen(req,timeout=40)as response:
            body=response.read().decode("utf-8",errors="replace")
            try:data=json.loads(body)
            except json.JSONDecodeError:data={"text":body}
            return {"retrievedAt":started,"request":public,"httpStatus":response.status,"data":data}
    except urllib.error.HTTPError as exc:
        body=exc.read().decode("utf-8",errors="replace")
        return {"retrievedAt":started,"request":public,"httpStatus":exc.code,"errorBody":scrub(body,keys)}
    except Exception as exc:
        return {"retrievedAt":started,"request":public,"errorType":type(exc).__name__,"error":"Network request failed; signed URL omitted."}

def wind(server,tool,params,keys,skill):
    public={"provider":"Wind","server":server,"tool":tool,"params":params}
    if not keys.get("WIND_API_KEY"):
        return {"request":public,"error":"WIND_API_KEY unavailable in environment or supplied note."}
    node=shutil.which("node")
    if not node:
        candidate=Path.home()/".cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe"
        node=str(candidate)if candidate.is_file()else None
    if not node:return {"request":public,"error":"Node executable not found."}
    env=os.environ.copy();env["WIND_API_KEY"]=keys["WIND_API_KEY"]
    command=[node,str(skill/"scripts/cli.mjs"),"call",server,tool,json.dumps(params,ensure_ascii=False)]
    for attempt in range(2):
        try:
            result=subprocess.run(command,cwd=skill,env=env,capture_output=True,text=True,encoding="utf-8",errors="replace",timeout=150)
            try:payload=json.loads(result.stdout)
            except json.JSONDecodeError:payload={"text":result.stdout}
            envelope={"retrievedAt":datetime.now(timezone.utc).isoformat(timespec="seconds"),"request":public,"exitCode":result.returncode,"data":payload}
            code=payload.get("error",{}).get("code")if isinstance(payload,dict)else None
            if code in {"RATE_LIMIT_QPS","NETWORK_ERROR","SERVER_5XX"}and attempt==0:
                time.sleep(4);continue
            return envelope
        except subprocess.TimeoutExpired:
            if attempt==0:time.sleep(4);continue
            return {"request":public,"error":"Wind CLI timed out twice; same request retried."}
    raise AssertionError("unreachable")

def fetch(source_dir,folder,skill,refresh=False):
    keys=credentials(source_dir/"API 整合.txt")
    jobs={}
    for symbol in ("GOOGL.US","QQQ.US","XLC.US"):
        public={"provider":"EODHD","endpoint":"/api/eod/"+symbol,"from":"2026-09-01","to":"2026-11-05","period":"d"}
        if keys.get("EODHD_API_TOKEN"):
            query=urllib.parse.urlencode({"api_token":keys["EODHD_API_TOKEN"],"fmt":"json","from":public["from"],"to":public["to"],"period":"d"})
            jobs["eod_"+symbol.split('.')[0]]=lambda symbol=symbol,query=query,public=public:http_json("https://eodhd.com/api/eod/"+symbol+"?"+query,public,keys)
    if keys.get("EODHD_API_TOKEN"):
        public={"provider":"EODHD","endpoint":"/api/news","symbol":"GOOGL.US","from":"2026-10-01","to":"2026-11-05","limit":100}
        query=urllib.parse.urlencode({"api_token":keys["EODHD_API_TOKEN"],"fmt":"json","s":"GOOGL.US","from":public["from"],"to":public["to"],"limit":100})
        jobs["eod_news"]=lambda query=query,public=public:http_json("https://eodhd.com/api/news?"+query,public,keys)
        for day in ("2026-10-28","2026-10-29","2026-10-30"):
            pub={"provider":"EODHD","endpoint":"/api/news","symbol":"GOOGL.US","from":day,"to":day,"limit":100}
            query=urllib.parse.urlencode({"api_token":keys["EODHD_API_TOKEN"],"fmt":"json","s":"GOOGL.US","from":day,"to":day,"limit":100})
            jobs["eod_news_"+day]=lambda query=query,pub=pub:http_json("https://eodhd.com/api/news?"+query,pub,keys)
    jobs["wind_kline"]=lambda:wind("global_stock_data","get_global_stock_kline",{"windcode":"GOOGL.O","begin_date":"20260901","end_date":"20261105","period":"10","aftype":"0"},keys,skill)
    jobs["wind_announcements"]=lambda:wind("financial_docs","get_company_announcements",{"query":"Alphabet谷歌GOOGL2026年第三季度业绩公告2026年10月收入GoogleCloud搜索资本开支投资收益","top_k":10},keys,skill)
    jobs["wind_news"]=lambda:wind("financial_docs","get_financial_news",{"query":"Alphabet谷歌GOOGL2026年10月28日至11月5日财报股价大跌分析师Cloud搜索利润率资本开支","top_k":15},keys,skill)
    jobs["wind_kline_recent"]=lambda:wind("global_stock_data","get_global_stock_kline",{"windcode":"GOOGL.O","begin_date":"20261012","end_date":"20261105","period":"10","aftype":"0","count":-20},keys,skill)
    jobs["wind_analysts"]=lambda:wind("financial_docs","get_financial_news",{"query":"2026年10月29日Alphabet谷歌财报高盛花旗摩根士丹利摩根大通巴克莱分析师目标价搜索Cloud资本开支","top_k":15},keys,skill)
    manifest=[]
    with ThreadPoolExecutor(max_workers=4)as pool:
        futures={pool.submit(fn):name for name,fn in jobs.items()if refresh or not(folder/(name+'.json')).is_file()}
        for future in as_completed(futures):
            name=futures[future]
            try:result=future.result()
            except Exception as exc:result={"errorType":type(exc).__name__,"error":"Request execution failed; credentials and request URL omitted."}
            text=save(folder,name,result,keys)
            manifest.append({"id":name,"file":name+".json","sha256":hashlib.sha256(text.encode()).hexdigest(),"httpStatus":result.get("httpStatus"),"exitCode":result.get("exitCode")})
            print(name,"saved",result.get("httpStatus",result.get("exitCode","error")),flush=True)
    manifest=[]
    for path in sorted(folder.glob('*.json')):
        if path.name=='manifest.json':continue
        payload=json.loads(path.read_text(encoding='utf-8'))
        manifest.append({"id":path.stem,"file":path.name,"sha256":hashlib.sha256(path.read_bytes()).hexdigest(),"retrievedAt":payload.get("retrievedAt"),"httpStatus":payload.get("httpStatus"),"exitCode":payload.get("exitCode")})
    save(folder,"manifest",{"updatedAt":datetime.now(timezone.utc).isoformat(timespec="seconds"),"requests":manifest,"credentialSources":"process environment or user note; values not saved"},keys)

def load_data(folder,name):
    return json.loads((folder/(name+'.json')).read_text(encoding='utf-8'))['data']

def wind_data(folder,name):
    return json.loads(load_data(folder,name)['content'][0]['text'])['data']

def write_artifact(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

def compile_market(folder,assets):
    series={};notes=[];sources=[]
    for symbol in ('GOOGL','QQQ','XLC'):
        rows=load_data(folder,'eod_'+symbol)
        series[symbol]=[{k:r[k]for k in ('date','open','high','low','close','volume')}for r in rows]
        differences=[{'date':r['date'],'close':r['close'],'adjustedClose':r['adjusted_close']}for r in rows if r['close']!=r['adjusted_close']]
        notes.append({'symbol':symbol,'adjustedRows':len(differences),'differences':differences,'note':'图表采用原始 OHLC 和 close；adjusted_close 另列用于口径检查，未混入价格收益或技术指标。原始价格收益不含现金分红。'})
        sources.append({'id':'recent-eod-'+symbol.lower(),'title':'EODHD '+symbol+' 日线','date':rows[-1]['date'],'file':'outputs/research/raw_recent/eod_'+symbol+'.json','page':'data[]，date/open/high/low/close/adjusted_close/volume','url':'https://eodhd.com/financial-apis/api-for-historical-data-and-volumes','kind':'market_api','note':'直接 API 返回，未复权原始 OHLC。'})
    eod={r['date']:r for r in series['GOOGL']}
    wd=wind_data(folder,'wind_kline_recent');cols=[c['name']for c in wd['columns']]
    checks=[]
    for vals in wd['rows']:
        row=dict(zip(cols,vals));day=row['TIME'][:10]
        if day in eod:
            checks.append({'date':day,'windClose':float(row['MATCH']),'eodClose':eod[day]['close'],'difference':round(eod[day]['close']-float(row['MATCH']),8),'volumeDifference':eod[day]['volume']-int(row['VOLUME'])})
    value={'asOf':max(r[-1]['date']for r in series.values()),'retrievedOn':'2026-11-05','priceBasis':'unadjusted_ohlc_close','currency':'USD','series':series,'sources':sources,'adjustmentNotes':notes,'crossCheck':{'provider':'数据来源于万得 Wind 金融数据服务','file':'outputs/research/raw_recent/wind_kline_recent.json','matchedDates':len(checks),'maximumCloseDifferenceUSD':max(abs(r['difference'])for r in checks),'priceToleranceUSD':0.01,'passed':all(abs(r['difference'])<=0.01 for r in checks),'details':checks,'note':'EOD 部分 OHLC 保留两位小数；Wind 可保留三位。成交量存在供应商四舍五入/后续修订差异，本看板统一采用 EOD 原值。'}}
    write_artifact(assets/'market-update.json',value)
    return value

def compile_research(folder,assets,market):
    """Build reviewed narrative from immutable snapshots, with computable stats.

    The narrative is explicitly a 2026-11-05 research version. Refreshing APIs
    does not silently turn these historical interpretations into a new report.
    """
    sources=list(market['sources'])
    sec_url='https://www.sec.gov/Archives/edgar/data/1652044/000165204426000084/goog-20260930.htm'
    def source(id,title,date,file,page,url,kind,note):
        sources.append(dict(id=id,title=title,date=date,file=file,page=page,url=url,kind=kind,note=note))
    for id,title,page in (
        ('recent-10q-income','Alphabet 2026Q3 10-Q：合并损益表','p.5，Consolidated Statements of Income'),
        ('recent-10q-cash','Alphabet 2026Q3 10-Q：现金流与融资','p.9，Consolidated Statements of Cash Flows；p.48，季度 CFO/Capex'),
        ('recent-10q-backlog','Alphabet 2026Q3 10-Q：收入确认与订单口径','Note 2，Revenue Backlog / Deferred Revenues'),
        ('recent-10q-business','Alphabet 2026Q3 10-Q：业务收入、广告变现及分部利润','MD&A，Revenues / Monetization Metrics；p.52–53，Segment Operating Results'),
        ('recent-10q-investments','Alphabet 2026Q3 10-Q：投资损益波动','p.53，Other Income (Expense), Net；Note 3 Investments'),
    ):
        source(id,title,'2026-10-29','outputs/research/raw_recent/wind_announcements.json','data.content[0].text → data.items[0].content；'+page,sec_url,'company_filing','原始公司披露；全文由 Wind 返回，已与 SEC companyfacts 的收入、营业利润、净利润及 EPS 交叉核对。数据来源于万得 Wind 金融数据服务。')
    source('recent-earnings-8k','Alphabet 2026Q3 earnings 8-K','2026-10-28','outputs/research/raw_sec/alphabet-submissions.json','SEC submissions 中 2026-10-28 的 8-K 记录','https://www.sec.gov/Archives/edgar/data/1652044/000165204426000080/goog-20261028.htm','filing_index','用于核对财报发布日；本研究实际财务数值以 10-Q/SEC companyfacts 为据，不把次日 10-Q 提交日当作业绩发布时间。')
    specs=[('recent-gs-jpm',5),('recent-citi-first',8),('recent-citi-revision',10),('recent-ms-view',13),('recent-cmbi-view',2)]
    wa=wind_data(folder,'wind_analysts')['items']
    for id,index in specs:
        item=wa[index]
        source(id,item['title'],item['date'],'outputs/research/raw_recent/wind_analysts.json',f'data.content[0].text → data.items[{index}]',item['url'],'media_reported_analyst','媒体转述卖方观点，非原始研报或逐项模型；数据来源于万得 Wind 金融数据服务。')
    for id,file,index in (
        ('recent-citizens','eod_news_2026-10-29',77),
        ('recent-stockstory','eod_news_2026-10-29',40),
        ('recent-fcf-commentary','eod_news_2026-10-29',80),
        ('recent-pre-earnings','eod_news_2026-10-28',71),
        ('recent-afp-results','eod_news_2026-10-28',18),
    ):
        item=load_data(folder,file)[index]
        source(id,item['title'],item['date'],'outputs/research/raw_recent/'+file+'.json',f'data[{index}]',item['link'],'media_reported_analyst'if id=='recent-citizens'else'media_report','EODHD 新闻接口保存全文及原始链接；媒体估计、卖方判断与公司披露分开标注，同源转载不计为独立证据。')
    source('recent-wind-price','Wind GOOGL 原始日线交叉核验','2026-11-04','outputs/research/raw_recent/wind_kline_recent.json','data.content[0].text → data.rows；TIME/MATCH','https://aifinmarket.wind.com.cn/','market_api','18 个匹配日；与 EOD close 最大差 0.005 美元，符合两位/三位小数取整。数据来源于万得 Wind 金融数据服务。')
    source('recent-fred','FRED：DGS10 / VIXCLS / DTWEXBGS','2026-11-05','assets/macro-evidence.json','series[].observations，按各序列实际日期匹配','https://fred.stlouisfed.org/','official_macro','DGS10、VIX 截止 11 月 3 日，广义美元指数截止 10 月 30 日；不填补不存在的观察值。')
    by_symbol={s:{r['date']:r for r in rows}for s,rows in market['series'].items()}
    def change(symbol,start,end):return by_symbol[symbol][end]['close']/by_symbol[symbol][start]['close']-1
    windows=[]
    for label,start,end in (
        ('财报前调整','2026-10-13','2026-10-28'),
        ('财报后首个完整交易日','2026-10-28','2026-10-29'),
        ('后续调整','2026-10-29','2026-11-02'),
        ('10 月局部高点至收盘低点','2026-10-13','2026-11-02'),
        ('低点之后反弹','2026-11-02','2026-11-04'),
    ):
        returns={s:change(s,start,end)for s in by_symbol}
        windows.append({'label':label,'startDate':start,'endDate':end,'returns':returns,'excessVsQQQPctPoints':100*(returns['GOOGL']-returns['QQQ']),'excessVsXLCPctPoints':100*(returns['GOOGL']-returns['XLC']),'basis':'同日未复权收盘价；returns 为小数收益；excess 字段为百分点；不含分红、未做风险因子回归。'})
    rows=market['series']['GOOGL'];peak=rows[0];worst={'return':0}
    for row in rows:
        if row['close']>peak['close']:peak=row
        dd=row['close']/peak['close']-1
        if dd<worst['return']:worst={'return':dd,'startDate':peak['date'],'endDate':row['date'],'startPrice':peak['close'],'endPrice':row['close']}
    pre_volume=[r['volume']for r in rows if '2026-10-01'<=r['date']<'2026-10-29']
    price_stats={'windows':windows,'expandedWindow':{'from':rows[0]['date'],'to':rows[-1]['date'],'maximumCloseDrawdown':worst},'earningsDayVolume':by_symbol['GOOGL']['2026-10-29']['volume'],'preEarningsOctoberAverageVolume':sum(pre_volume)/len(pre_volume),'earningsVolumeMultiple':by_symbol['GOOGL']['2026-10-29']['volume']/(sum(pre_volume)/len(pre_volume)),'note':'10 月 13 日是 10 月观察窗收盘高点，11 月 2 日是截至 11 月 4 日的收盘低点，均为事后标签；扩展至 9 月 1 日后最高收盘在 9 月 21 日，回撤为 −21.40%。盘中高低点不能与收盘收益混算。'}
    brokers=[
        {'broker':'Goldman Sachs','date':'2026-10-29','security':'Alphabet，报道未明确股类','rating':'Buy','oldTarget':435,'newTarget':385,'unit':'USD/share','view':'搜索收入低于该行及媒体所列一致预期；2027 年资本开支与折旧上升压制自由现金流。','earningsRevision':'媒体给出 2027 Capex 350.4bn、D&A 75.017bn；属于该行估计，不是公司指引。','caveat':'报道的 2027 FCF 前后值重复为 −40.567bn，存在文本错误，不能据此计算下修幅度。','sourceRefs':['recent-gs-jpm']},
        {'broker':'J.P. Morgan','date':'2026-10-29','security':'Alphabet，报道未明确股类','rating':'原文摘录未列评级','oldTarget':425,'newTarget':375,'unit':'USD/share','view':'报道记录财报后的目标价下调。','earningsRevision':'未取得同版本原始模型。','caveat':'目标价变化不能分解成盈利与估值变化。','sourceRefs':['recent-gs-jpm']},
        {'broker':'Citi','date':'2026-10-30','security':'GOOGL / Class A','rating':'Buy','oldTarget':447,'newTarget':375,'unit':'USD/share','view':'10 月 29 日初评保留 447 美元，10 月 30 日更新为 375 美元；搜索变现不确定性超过 Cloud 超预期的正面作用。','earningsRevision':'总营业利润约低于其所列一致预期 6%；关注 2027 Capex 和 FCF。','caveat':'两天的目标价是先后版本，不能并列为同日冲突；买入评级不代表短期见底。','sourceRefs':['recent-citi-first','recent-citi-revision']},
        {'broker':'Morgan Stanley / Brian Nowak','date':'2026-10-29','security':'Alphabet，报道同时列 GOOG/GOOGL','rating':'Overweight','oldTarget':None,'newTarget':375,'unit':'USD/share','view':'仍看好 AI 与 Cloud；第三方 TPU 硬件收入占比上升可能压低整体估值倍数，搜索创新和代理产品变现决定重估。','earningsRevision':'报道引用盘后价格约为其 2028 EPS 预测的 16 倍；原始预测表未在这条新闻中披露。','caveat':'不能把 2028 分母的 16 倍直接与 2026 或 2027 PE 比较，也不能倒推并冒充原始 EPS。','sourceRefs':['recent-ms-view']},
        {'broker':'Citizens / Andrew Boone','date':'2026-10-29','security':'Alphabet，报道未明确股类','rating':'Market Outperform → Market Perform','oldTarget':None,'newTarget':None,'unit':'USD/share','view':'查询量增长与搜索货币化背离；担心 AI 代理分流高价值查询、AI Mode 变现偏低；认为搜索比算力密集和部分非经常性 TPU 销售更能支撑估值。','earningsRevision':'未取得原始盈利预测；承认成本压缩可能支持 EPS。','caveat':'高价值查询迁移是该分析师的解释，现有材料没有按查询意图/渠道拆分的数据来证明。','sourceRefs':['recent-citizens']},
        {'broker':'CMB International','date':'2026-10-30','security':'GOOG / Class C','rating':'Buy','oldTarget':428,'newTarget':421,'unit':'USD/share','view':'2026 年净利润预测下调 5%，2027–2028 上调 2%–4%，反映 Cloud 长期贡献；TPU 存货占用压制现金。','earningsRevision':'跨年度方向不同，不能概括为全期盈利下修。','caveat':'C 类股目标价，不能直接当作 GOOGL A 类目标价或并入同口径平均目标价。','sourceRefs':['recent-cmbi-view']},
    ]
    expectations=[
        {'metric':'总收入','unit':'USD mn','actual':127577,'expectation':127900,'surprisePct':(127577/127900-1)*100,'expectationBasis':'StockStory 新闻所列街头预期，非原始一致预期数据库；花旗称大体符合。','interpretation':'收入总量接近预期，不能只以总收入掩盖业务组合分歧。','sourceRefs':['recent-10q-income','recent-stockstory','recent-citi-first']},
        {'metric':'Google Search & other 收入','unit':'USD mn','actual':63350,'expectation':64895,'surprisePct':(63350/64895-1)*100,'expectationBasis':'华尔街见闻转述高盛报告所列市场一致预期；高盛自身预期 64200m。','interpretation':'同比仍增约 12%，但低于媒体所列一致预期约 2.38%；对高盛自身预期低约 1.32%。','sourceRefs':['recent-10q-business','recent-gs-jpm']},
        {'metric':'YouTube 广告收入','unit':'USD mn','actual':11207,'expectation':11340,'surprisePct':(11207/11340-1)*100,'expectationBasis':'10 月 28 日盘前 Yahoo 视频列预期 11.34bn；花旗次日所述预期差约 −2%，覆盖样本可能不同。','interpretation':'本组对比为 −1.17%；不把不同报道的 −1.17% 与约 −2% 强行合并。','sourceRefs':['recent-10q-business','recent-pre-earnings','recent-citi-first']},
        {'metric':'Google Cloud 收入','unit':'USD mn','actual':30709,'expectation':None,'surprisePct':7,'expectationBasis':'花旗媒体转述为约高于市场预期 7%，未取得原始预期数，surprisePct 为报道近似值。','interpretation':'同比增 102.61%；经营利润 11121m、利润率 36.21%。需拆服务消费和 TPU 系统交付。','sourceRefs':['recent-10q-business','recent-citi-first']},
        {'metric':'营业利润','unit':'USD mn','actual':40576,'expectation':None,'surprisePct':-6,'expectationBasis':'花旗媒体转述约低于一致预期 6%；招银转述约低 7%，样本不同。','interpretation':'同比增 29.93%，实际增长与低于事前预期可以同时成立。','sourceRefs':['recent-10q-income','recent-citi-first','recent-cmbi-view']},
        {'metric':'GAAP diluted EPS','unit':'USD/share','actual':2.12,'expectation':3.03,'surprisePct':(2.12/3.03-1)*100,'expectationBasis':'花旗明确标为 GAAP 的预期 3.03；其他报道有 3.02，不能与调整后 EPS 预期混用。','interpretation':'投资公允价值变化拖累净利润；普通股可分配净利须先减 298m 优先股股息。2.14 是原模型漏减股息所得，不是披露 EPS。','sourceRefs':['recent-10q-income','recent-citi-first','recent-10q-investments']},
        {'metric':'2026 年资本开支指引','unit':'USD bn','actual':None,'expectation':None,'surprisePct':None,'expectationBasis':'媒体转述公司仍维持 195–205bn，2027 年将显著增加但未提供数值指引。','interpretation':'不能写成这次上调 2026 指引；2027 年 350.4bn 是高盛预测，不是公司承诺。','sourceRefs':['recent-gs-jpm','recent-cmbi-view']},
    ]
    stages=[
        {'date':'2026-10-13','stage':'known_at_start','title':'10 月局部收盘高点：价格确认，起点预期有限','body':'GOOGL 收盘 353.78 美元，是本轮选取的 10 月局部高点。当日 QQQ 743.57、XLC 112.28。本次已取证的卖方更新主要发布在财报后，不能倒填为 10 月 13 日投资者已知的盈利预测；当前证据不足以重建这一天全部市场定价假设。','sourceRefs':['recent-eod-googl','recent-eod-qqq','recent-eod-xlc'],'evidenceStatus':'行情直接取数；起点完整一致预期尚缺'},
        {'date':'2026-10-28','stage':'during_period','title':'财报前已跌 8.17%，现金回收问题已进入讨论','body':'从 10 月 13 日至 10 月 28 日收盘，GOOGL −8.17%、QQQ −2.42%、XLC −8.14%。10 月 28 日盘前 Yahoo 财报预览已关注上季度自由现金流转负及投入回报，并列 YouTube 广告收入预期 11.34bn。这个窗口的先行下跌不能全部归于尚未披露的 Q3 结果；相对 XLC 几乎同步，说明行业背景值得并列观察。','sourceRefs':['recent-eod-googl','recent-eod-qqq','recent-eod-xlc','recent-pre-earnings'],'evidenceStatus':'同窗行情计算；财报前新闻时间可定位'},
        {'date':'2026-10-28','stage':'during_period','title':'盘后财报：Cloud 翻倍，搜索与现金流未满足预期','body':'本次财报于 10 月 28 日发布、10-Q 次日提交。Q3 总收入 127.577bn（同比 +24.65%），搜索 63.350bn（+11.99%），YouTube 广告 11.207bn（+9.22%），Cloud 30.709bn（+102.61%）。搜索低于媒体转述一致预期，Cloud 则高约 7%；Q3 经营现金流约 42.3bn，资本开支约 51.4bn，差额约 −9.1bn。总量增长很快，但收入质量和投入转现成为争议中心。','sourceRefs':['recent-earnings-8k','recent-10q-income','recent-10q-business','recent-10q-cash','recent-gs-jpm','recent-citi-first'],'evidenceStatus':'实际值为公司披露；预期差为媒体所述一致预期'},
        {'date':'2026-10-29','stage':'during_period','title':'首个完整交易日跌 12.64%：公司事件与市场调整重叠','body':'收盘由 324.89 跌至 283.82 美元（−12.64%）；QQQ −1.42%、XLC −1.87%，简单差分别为 −11.23、−10.77 个百分点。成交量约 1.397 亿股，为 10 月 1 日至 28 日日均的 5.46 倍。集中于财报后、显著弱于基准的价格变化支持公司特定信息重估的解释，但这不是可识别的因果贡献估计。','sourceRefs':['recent-eod-googl','recent-eod-qqq','recent-eod-xlc','recent-wind-price'],'evidenceStatus':'可重复的收盘收益与成交量计算；因果归因保留边界'},
        {'date':'2026-10-29','stage':'during_period','title':'卖方出现分歧：查询增长能否变成高质量收入','body':'Citizens 将评级从 Market Outperform 降至 Market Perform，担心 AI Mode 变现较低、代理改变高价值查询入口；这是分析师解释。公司 10-Q 披露付费点击 +8%、CPC +4%，并未证明整个广告单位价格已经下跌。高盛和摩根大通分别将目标价调至 385/375 美元；摩根士丹利维持增持、375 美元，强调 TPU 收入组合与 2028 EPS 分母下的估值。共同关注点是未来现金和倍数，观点并非一致看空。','sourceRefs':['recent-citizens','recent-10q-business','recent-gs-jpm','recent-ms-view'],'evidenceStatus':'公司变现指标已披露；卖方结论为媒体转述'},
        {'date':'2026-10-30','stage':'during_period','title':'第二轮修正：目标价、年份与股类必须分别读','body':'花旗前一日初评保留 447 美元，10 月 30 日将 GOOGL 目标价降至 375 美元、仍为 Buy。招银国际对 GOOG C 类股从 428 微调至 421 美元，同时下调 2026 净利润约 5%、上调 2027–2028 约 2%–4%。目标价下调并不等于所有年份盈利下修，GOOG 与 GOOGL 也不能直接合成一个目标价。','sourceRefs':['recent-citi-first','recent-citi-revision','recent-cmbi-view'],'evidenceStatus':'有发布日期的媒体转述；尚未取得逐项原始修订模型'},
        {'date':'2026-11-02','stage':'during_period','title':'阶段收盘低点：累计跌 21.14%，宏观背景并非利率持续上行','body':'GOOGL 收盘 278.99 美元，较 10 月 13 日 −21.14%；同窗 QQQ −8.40%、XLC −10.71%。从 10 月 29 日到此日 GOOGL 仅再跌 1.70%，QQQ 则跌 4.79%。FRED 同窗 10 年期国债收益率从 5.21%降至 4.91%，VIX 从 15.27 升至 21.15；说明风险偏好恶化与长债收益率下行并存，不能把整轮回撤简单归为利率上行。','sourceRefs':['recent-eod-googl','recent-eod-qqq','recent-eod-xlc','recent-fred'],'evidenceStatus':'低点为事后标签；价格和宏观观察可复核，未估计因果权重'},
        {'date':'2026-11-04','stage':'after_period','title':'反弹 3.56%：不足以证明盈利争议解除','body':'从 11 月 2 日低点至 11 月 4 日，GOOGL 回升至 288.93 美元（+3.56%），QQQ +1.59%、XLC +4.69%。目前没有新的完整季度实际值来证明搜索变现、TPU 现金回收或 2027 Capex 问题已经解决。后续验证应落在经营和现金指标，而非仅以反弹认定见底。','sourceRefs':['recent-eod-googl','recent-eod-qqq','recent-eod-xlc'],'evidenceStatus':'终点之后观察；不使用尚未公布的未来财报'},
    ]
    theses=[
        {'claim':'搜索是暂时增速扰动，还是 AI 流量提高了查询却稀释商业价值？','evidence':'搜索收入同比 +11.99%，低于媒体所列 64.895bn 一致预期；公司披露付费点击 +8%、CPC +4%。Citizens 强调查询增长与收入增长背离，媒体转述管理层另提汇率、区域广告需求和基数。','whatIsMissing':'按传统搜索/AI Mode、商业意图、地域拆分的查询量、广告覆盖、收入/查询与获客成本；原始电话会逐字稿及同口径固定汇率增长桥。','test':'连续跟踪 Search 增速、CPC、付费点击、TAC 比率、AI 广告覆盖及单位查询净收益。若收入增速恢复且利润/现金同步，弱化结构性受损论；若查询继续增长而单位净收益持续降，强化结构性压力论。','sourceRefs':['recent-10q-business','recent-gs-jpm','recent-citizens']},
        {'claim':'Cloud 翻倍增长能否保持经常性、可回款与足够利润率？','evidence':'Q3 Cloud 收入 30.709bn、营业利润 11.121bn、利润率 36.21%。10-Q 明确增长包含平台基础设施服务与 TPU 系统销售；利润增量被 TPU 库存及技术基础设施成本部分抵消。','whatIsMissing':'TPU 硬件系统销售与长期云消费的收入、毛利、订单、应收及付款条款分别披露；客户集中度和第三方算力占比。','test':'把硬件交付、云服务消耗和订单转收入分别建桥；同步跟踪 Cloud 利润率、库存与应收天数、合同履约和现金回收。若高增长主要来自前置硬件交付且营运资本持续占用，应降低可重复增长与估值假设。','sourceRefs':['recent-10q-business','recent-ms-view','recent-cmbi-view']},
        {'claim':'订单规模支持未来收入，但不能直接折算为两年收入或现金。','evidence':'10-Q 披露 Cloud backlog 560.8bn；公司整体 backlog 预计略超 55% 在未来 24 个月确认。2026Q1 起口径纳入原预计期限≤1年的合同，且总 backlog 含关联方 Crux AI 多年合同 16.8bn。','whatIsMissing':'同口径可比历史 backlog、各客户付款/终止安排、关联方及融资支持比例、交付能力与使用节奏。','test':'以期初 backlog＋新增订单−确认收入−调整建立滚动桥；比对预收、应收和实际现金。不能把 560.8×55%机械当成有保证的两年 Cloud 收入，也不能把不同口径同比全部视作需求加速。','sourceRefs':['recent-10q-backlog']},
        {'claim':'GAAP EPS 下跌中有投资重估，不应等同于核心营业利润崩塌。','evidence':'营业利润从 31.228bn 增至 40.576bn；其他收入/费用从 +12.759bn 变为 −8.221bn，差额 −20.980bn。净利润 26.468bn，减优先股股息 0.298bn 后普通股净利 26.170bn，披露 EPS 2.12。','whatIsMissing':'可持续税率、投资收益正常化、未来优先股分红和强制转股的股份路径；不能只删除负面投资损失而保留过去正收益。','test':'同时展示 GAAP 与明确公式的分析口径；将 OI、投资损益、利息、税、优先股股息和稀释股数逐项桥接。若核心营业利润、现金回收继续弱于预期，即使投资公允价值反弹也不能视作经营修复。','sourceRefs':['recent-10q-income','recent-10q-investments']},
        {'claim':'Capex、营运资本和融资三者共同决定普通股回报。','evidence':'9M CFO 127.149bn、Capex 131.953bn，简单 FCF −4.804bn；库存占用现金 10.959bn、应收占用 10.821bn。9M 普通股发行净额 42.870bn、强制可转优先股发行净额 19.063bn，回购现金支出为零。','whatIsMissing':'2027 年 Capex 具体公司指引、产能投用/折旧年限、库存周转、融资需求与转股股数；投入回报率及项目层现金回收。','test':'不要将 Capex 直接计入当期营业费用。分别跟踪 FCF＝CFO−购建 PP&E、折旧进入损益、净债务/股数变化；将单位新增云收入需要的资本、营运资本和现金利润联系起来。','sourceRefs':['recent-10q-cash','recent-gs-jpm']},
        {'claim':'价格下跌反映盈利与估值重估，但目前无法精确分摊各驱动贡献。','evidence':'财报日 GOOGL 较 QQQ 额外下跌 11.23 个百分点；卖方担心搜索与 TPU 组合的估值差异。窗口内 10 年期收益率下行而 VIX 上行，单一利率解释不成立。','whatIsMissing':'10 月 13 日和财报前后的完整同口径 NTM EPS/FCF 一致预期、风险因子暴露及可比公司再定价。','test':'使用同一股类、同一预测年度和同一会计口径计算 P/E 与盈利修订；再检查业务分部估值和现金回报。基准收益差是描述性比较，不能当作公司事件的纯因果效应。','sourceRefs':['recent-eod-googl','recent-eod-qqq','recent-fred','recent-ms-view']},
    ]
    case={'id':'googl-2026-q3-drawdown','title':'GOOGL：2026 年 10–11 月回撤——搜索变现、Cloud 组合与现金回报的重估','startDate':'2026-10-13','endDate':'2026-11-02','startPrice':353.78,'endPrice':278.99,'priceReturn':change('GOOGL','2026-10-13','2026-11-02'),'summary':'10 月局部收盘高点至 11 月 2 日低点回撤 21.14%，其中财报后首日下跌 12.64%。证据指向三项同时发生的预期变化：搜索及 YouTube 低于部分市场预期，Cloud 高增长包含 TPU 系统交付而其经常性与现金特征仍需拆分，高 Capex 与库存占用使自由现金流承压。GAAP 净利下跌另有大额非经营性投资损益影响；营业利润本身仍同比增长。股价与宏观同向调整不能量化为因果份额。','stages':stages,'theses':theses,'priceStats':price_stats,'brokerComparisons':brokers,'expectationVsOutcome':expectations,'limitations':['价格与研究版本截至 2026-11-05，最近完整美股收盘为 2026-11-04；未用盘中或未来数据填补。','本案例起点是 10 月收盘局部高点；扩展到 9 月的高点为 9 月 21 日，日期与幅度另列，不宣称该段为全年最大回撤。','行情使用未复权 OHLC/close，未计现金分红；QQQ/XLC 含 Alphabet 敞口并非独立对照，也未做 beta 或因子调整。','财务实际值使用公司 10-Q/SEC；市场预期与目标价主要是媒体转述，尚未取得完整卖方原文、预测覆盖样本及两版模型。','目标价依赖股类、估值年份和口径；GOOG 与 GOOGL、GAAP 与调整后 EPS 不混合平均。','高盛报道中 2027 FCF 前后数值重复，相关修订幅度未采用；不同媒体对 YouTube/营业利润预期差存在样本差异。','10 月 13 日完整事前预期、原始业绩会逐字稿和客户分项现金回收数据仍缺，不能确定高价值搜索迁移程度或精确拆分事件对股价的贡献。','11 月 2 日低点和 11 月 4 日反弹是事后观察标签，反弹本身未证明经营问题已解除。']}
    old=json.loads((assets/'review-case.json').read_text(encoding='utf-8'));old['id']='googl-2024-summer-drawdown'
    for item in stages:
        if item['date']=='2026-10-28' and '盘后财报' in item['title']:
            item['body'] += ' 时间说明：这里涉及的GS/Citi预期差取自10月29日媒体回溯，不能视为10月28日发布前已知。'
            item['evidenceStatus'] += '；机构比较为次日回溯'
    source('historical-2024q2-release','Alphabet Announces Second Quarter 2024 Results','2024-07-23','outputs/research/raw_recent/alphabet-2024q2-earnings-release.pdf','p.1：发布日期与合并实绩；p.2：分业务收入/营业利润；p.6：现金流；p.8：FCF 调节','https://s206.q4cdn.com/479360582/files/doc_financials/2024/q2/2024q2-alphabet-earnings-release.pdf','company_earnings_release','Alphabet 官网 FinancialReport API 返回的原始 PDF；关键表格已提取并逐页视觉核对。收入、营业利润、净利和 EPS 与 SEC companyfacts 一致。')
    source('historical-2024q2-sec','Alphabet 2024Q2 10-Q / SEC companyfacts','2024-07-24','outputs/research/raw_sec/alphabet-companyfacts.json','us-gaap；end=2024-06-30，filed=2024-07-24，accn=0001652044-24-000079；季度 start=2024-04-01','https://www.sec.gov/Archives/edgar/data/1652044/000165204424000079/goog-20240630.htm','company_filing','原始 10-Q 提交日期 7 月 24 日；业绩发布为 7 月 23 日。SEC Archives HTML 直接访问返回 403，本次实际核验用 SEC data API 与公司官网 PDF。')
    source('historical-doj-search-20240805','DOJ statements on the District of Columbia decision in U.S. v Google','2024-08-05','outputs/research/raw_recent/doj_press_api.json','results 中 uuid=86c8e7c2-917b-4d2b-84a0-9f6b4d7c41f7；date=1722859200、body','https://www.justice.gov/archives/opa/pr/justice-department-statements-us-district-court-district-columbias-decision-us-v-google','official_legal_statement','司法部官方 API 与归档新闻原文；这是胜诉声明，未据此假定最终补救措施或经营损失已经确定。')
    source('historical-doj-adtech-20240909','U.S. and Plaintiff States v. Google LLC [2023]：Trial Materials','2024-09-09','outputs/research/raw_recent/doj_adtech_case.json','Trial Materials → Plaintiffs\' Opening Statement (September 9, 2024)','https://www.justice.gov/atr/case/us-and-plaintiff-states-v-google-llc-2023','official_case_record','司法部官方案件页面定位到 2024-09-09 原告开庭陈述及 /atr/media/1366806/dl；截至回撤终点只能称审理阶段，不倒灌 2025/2026 判决与补救信息。')
    old['summary']='2024 年 7 月 10 日至 9 月 10 日，包内收盘价从 191.18 降至 148.66 美元（−22.24%）。新增公司原件确认 Q2 收入和营业利润仍增长、Cloud 首次季度收入超 10bn；但 Capex 同比增 91.43%，FCF 从上年同期 21.778bn 降至 13.454bn。8 月搜索案出现司法部胜诉声明，9 月广告技术案进入开庭陈述。实际经营、投入回报与监管节点已有一手证据；当时卖方一致预期及其修订仍未完整核实，不能把所有跌幅直接归于任何单一事件。'
    for item in old['stages']:
        if item['date']=='2024-07-23':
            item.update(title='财报原件：增长尚强，现金转化与预期差需分开判断',body='Alphabet 于 7 月 23 日发布 Q2 结果，7 月 24 日提交 10-Q。收入 84.742bn、营业利润 27.425bn、净利 23.619bn、稀释 EPS 1.89；搜索收入 48.509bn、YouTube 广告 8.663bn、Cloud 10.347bn（同比 +28.84%），Cloud 营业利润 1.172bn。Capex 13.186bn，较上年同期 6.888bn 增 91.43%；CFO 26.640bn，FCF 13.454bn。公司披露指出 2023 年现金流含 IRS 纳税延期影响，不能把全部现金流同比变化解释为经营恶化。旧包称 YouTube 低于预期，但当时一致预期原始样本仍未核实。包内 7 月 23/24 日收盘 181.79/172.63 美元，跌幅 −5.04%，不据此作纯财报因果估计。',sourceRefs=['historical-2024q2-release','historical-2024q2-sec','nasdaq-googl','pivnotes-20240710'],evidenceStatus='公司实绩、Capex/CFO/FCF 与日期已用原件核实；卖方预期差仍为二手待核')
        elif item['date']=='2024-09-10':
            item.update(title='截至终点：财务兑现、资本回报和监管三条线并存',body='截至 9 月 10 日，Q2 实绩和现金流、8 月 5 日 DOJ 搜索案胜诉声明、9 月 9 日广告技术案原告开庭陈述均已有公开记录。最终补救安排、分销渠道变化和经营损失在该时点不能假定已确定。收盘价 148.66 美元，对 7 月 10 日 −22.24%，为未计现金分红的价格变化。',sourceRefs=['historical-2024q2-release','historical-doj-search-20240805','historical-doj-adtech-20240909','nasdaq-googl'],evidenceStatus='实绩和监管节点有一手证据；影响大小与当时一致预期未完整识别')
    old['stages'].extend([
        {'date':'2024-08-05','stage':'during_period','title':'搜索案：司法部发布胜诉声明，补救影响尚待后续','body':'DOJ 当日针对哥伦比亚特区联邦地区法院 U.S. v. Google 裁决发布声明，称这是对 Google 的胜诉及反垄断执法的重要结果。此处确认法律事件发生与公开时间；声明本身不提供足以量化 Google 收入、利润或默认分销成本变化的最终补救安排。不得将后来诉讼结果倒填为当日已知事实。','sourceRefs':['historical-doj-search-20240805'],'evidenceStatus':'DOJ 官方 API、日期和声明正文已核对'},
        {'date':'2024-09-09','stage':'during_period','title':'广告技术案：进入开庭陈述，和搜索案是两条法律程序','body':'DOJ 的 U.S. and Plaintiff States v. Google LLC [2023] 案件页面列出 9 月 9 日原告 Opening Statement，确认该日审理节点。广告技术案与默认搜索分销案的业务暴露和潜在补救不同；在 9 月 10 日窗口终点仍应按审理中的风险讨论，不能把未来裁判写为已发生的拆分或收入损失。','sourceRefs':['historical-doj-adtech-20240909'],'evidenceStatus':'DOJ 官方案卷页面的日期及文件入口已核对'}
    ])
    old['stages'].sort(key=lambda x:x['date'])
    old['theses']=[
        {'claim':'实绩仍增长时，回撤究竟反映哪一部分预期下修？','evidence':'Q2 总收入 84.742bn、营业利润 27.425bn；Cloud 收入 10.347bn、利润 1.172bn 已核实。旧包记录 YouTube 低于预期，但未给同口径样本。','whatIsMissing':'7 月 10 日及财报前的搜索/YouTube/Cloud 一致预期、财报后 EPS/FCF 修订与估值分母；不能再称同期实际值全缺。','test':'将已核实实际值与有时间戳的预期逐项比较；若总量好于预期而仅某业务落差，则缩小盈利下修叙述；若下修来自远期利润率或现金，使用相应分母验证。','sourceRefs':['historical-2024q2-release','pivnotes-20240710']},
        {'claim':'资本开支扩张是否降低了近期现金回报，以及能否由未来云增长补偿？','evidence':'Q2 Capex 13.186bn（同比 +91.43%），CFO 26.640bn，FCF 13.454bn；上年同期 CFO 28.666bn、Capex 6.888bn，FCF 21.778bn。2023 CFO 含 IRS 纳税延期影响。Cloud 当季仍增 28.84%且实现利润扩张。','whatIsMissing':'当时的投产/利用率、未来收入与折旧计划、正常化税款时间和原始 Capex 指引预期。','test':'将现金税、营运资本和 Capex 分开，再跟踪新增算力的收入与经营现金。Capex 不是当期营业费用；单季 FCF 下降也不能自动等同长期投资价值受损。','sourceRefs':['historical-2024q2-release']},
        {'claim':'监管变化通过哪些经营变量改变盈利和估值？','evidence':'8 月 5 日 DOJ 对搜索案裁决发表胜诉声明，9 月 9 日广告技术案进入原告开庭陈述；9 月 16 日 Evercore 摘录属于窗口后。','whatIsMissing':'截至各日期真实可知的补救要求与概率、分销渠道收入/TAC 暴露，以及机构原始情景模型。','test':'分开搜索分销与广告技术业务，按最终措施、生效日期和诉讼路径调整；若补救力度或执行时间不同，修正折价。不能把尚未发生的拆分、收入流失当作确定事实。','sourceRefs':['historical-doj-search-20240805','historical-doj-adtech-20240909','pivnotes-20240910']},
    ]
    old['expectationVsOutcome']=[{'metric':metric,'unit':unit,'actual':actual,'expectation':None,'surprisePct':None,'expectationBasis':'当时同口径一致预期尚未取得，不计算预期差。','interpretation':note,'sourceRefs':['historical-2024q2-release']}for metric,unit,actual,note in (
        ('2024Q2 总收入','USD mn',84742,'公司披露同比增长约 14%。'),('2024Q2 Google Cloud 收入','USD mn',10347,'同比 +28.84%；Cloud 营业利润 1172m。'),('2024Q2 营业利润','USD mn',27425,'公司披露营业利润率约 32%。'),('2024Q2 GAAP diluted EPS','USD/share',1.89,'对应净利润 23619m。'),('2024Q2 资本开支','USD mn',13186,'同比 +91.43%；属于投资现金流。'),('2024Q2 FCF','USD mn',13454,'CFO 26640m 减 Capex 13186m；仍为正值。'))]
    old['limitations']=['7 月 23 日财报原件、7 月 24 日 SEC 数据与两个监管节点已补证；卖方研报和完整历史一致预期仍以旧包摘录为主，不能将其标为已核实。','缺少 2024-07-10 前对应原始预测，不能重建起点完整定价假设。','价格沿用包内日线，收益为两端简单价格变化，不含现金分红；未进行风险因子或事件贡献分解。','现金流同比受税款支付时间影响；2023 年同期 IRS 延期说明已保留，不将全部 CFO 变化归于经营效率。','Google 2024Q2 调整 AI 研发团队在分部与 Alphabet-level activities 之间的归属，分部利润同比需留意口径；详见原件 p.2。','司法部当前案件页同时含后续年度材料，本案例仅使用截至 2024-09-10 已公开的日期与文件；未倒灌后续裁判/补救。','7 月 10 日旧卡中的后出信息已拆入期间阶段，9 月 16 日 Evercore 观点保留在事后阶段。']
    source('nasdaq-googl','旧 Demo：Nasdaq GOOGL 日线','2026-11-02','原始 Demo ZIP/raw/GOOGL.json','data.tradesTable.rows，按 date 定位',None,'user_supplied_market_snapshot','2024 对比案例沿用包内价格；对应来源记录在主案例 registry。')
    source('pivnotes-20240710','旧 Demo：2024-07-10 顶点研究摘录','2024-07-10','原始 Demo ZIP/pivnotes.json','d=2024-07-10；各观点真实日期已在阶段中拆开',None,'user_supplied_secondary_excerpt','卡片日期不代表所有条目发布日期；原始研报待补。')
    source('pivnotes-20240910','旧 Demo：2024-09-10 底点研究摘录','2024-09-10','原始 Demo ZIP/pivnotes.json','d=2024-09-10；Evercore 为 2024-09-16 事后观点',None,'user_supplied_secondary_excerpt','不能把 9 月 16 日材料倒填成 9 月 10 日已知信息。')
    result={'asOf':'2026-11-05','marketAsOf':market['asOf'],'sources':sources,'drawdowns':[case,old],'comparisonNote':'2024 案例补齐公司财报原件、现金流与 DOJ 监管节点，但事前一致预期及卖方修订仍不完整；2026 案例另有近期 API 行情与有日期的媒体卖方观点。实绩、预期和法律程序按证据等级区分。','sourcePolicy':'公司披露优先；媒体转述一致预期与机构观点单列；推断附证伪条件；同源转载不作多源确认。Wind 数据来源于万得 Wind 金融数据服务。'}
    for item in old['stages']:
        if item['date']=='2024-07-23':
            item['body'] += ' 时间说明：7月24日收盘跌幅为次日市场反应，并非7月23日财报发布时已知。'
    known={s['id']for s in sources}
    for d in result['drawdowns']:
        for group in ('stages','theses','brokerComparisons','expectationVsOutcome'):
            for item in d.get(group,[]):
                assert all(ref in known for ref in item.get('sourceRefs',[])),item
    write_artifact(assets/'research-recent.json',result)
    return result

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir",type=Path,default=ROOT.parent)
    parser.add_argument("--output-dir",type=Path,default=ROOT/"outputs/research/raw_recent")
    parser.add_argument("--wind-skill",type=Path,default=Path.home()/".agents/skills/wind-mcp-skill")
    parser.add_argument("--refresh",action="store_true",help="Refresh existing snapshots; default preserves saved evidence")
    parser.add_argument("--compile-only",action="store_true",help="Compile reviewed 2026-11-05 artifacts from saved snapshots without network calls")
    parser.add_argument("--assets-dir",type=Path,default=ROOT/'assets')
    args=parser.parse_args()
    if not args.compile_only:
        fetch(args.source_dir,args.output_dir,args.wind_skill,args.refresh)
    market=compile_market(args.output_dir,args.assets_dir)
    research=compile_research(args.output_dir,args.assets_dir,market)
    print('compiled',len(market['series']),'market series;',len(research['sources']),'sources;',len(research['drawdowns']),'drawdown cases')

if __name__=="__main__":main()
