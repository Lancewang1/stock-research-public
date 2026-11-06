"""Build point-in-time Cloud/capex inputs from archived public evidence.

Credentials are read only in memory. Default operation uses cached files;
--fetch obtains official Alphabet releases and SEC supplier company facts.
"""
from __future__ import annotations
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import statistics
import subprocess
import requests
import fitz
import numpy as np
from research_chain import fetch_wind, read_wind_key
from research_anthropic import user_agent

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'outputs/research/raw_cloud'
ASOF = '2026-11-05'
PERIODS = ['2026Q4','2027Q1','2027Q2','2027Q3','2027Q4']


def save_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False), encoding='utf-8')


def fetch(name, url):
    OUT.mkdir(parents=True, exist_ok=True)
    meta_path = OUT / f'{name}.meta.json'
    if meta_path.exists():
        return json.loads(meta_path.read_text(encoding='utf-8'))
    meta = {'id': name, 'url': url, 'retrievedAt': datetime.now(timezone.utc).isoformat()}
    try:
        r = requests.get(url, headers={'User-Agent': user_agent() if 'sec.gov/' in url else 'Research data collector'}, timeout=45)
        content_type = r.headers.get('content-type', '')
        suffix = '.pdf' if r.content.startswith(b'%PDF') else '.json' if 'json' in content_type else '.html'
        path = OUT / (name + suffix)
        path.write_bytes(r.content)
        meta.update(status=r.status_code, ok=r.ok, file=path.name, bytes=len(r.content), sha256=hashlib.sha256(r.content).hexdigest())
    except requests.RequestException as exc:
        meta.update(ok=False, errorType=type(exc).__name__)
    save_json(meta_path, meta)
    return meta


def fetch_sources():
    jobs = [(f'alphabet-financial-{y}', f'https://abc.xyz/feed/FinancialReport.svc/GetFinancialReportList?LanguageId=1&year={y}') for y in range(2020,2027)]
    jobs += [('nvidia-companyfacts', 'https://data.sec.gov/api/xbrl/companyfacts/CIK0001045810.json'),
             ('broadcom-companyfacts','https://data.sec.gov/api/xbrl/companyfacts/CIK0001730168.json')]
    with ThreadPoolExecutor(max_workers=4) as pool:
        for x in pool.map(lambda a: fetch(*a), jobs):
            print(json.dumps({k:x.get(k) for k in ['id','status','ok','bytes']},ensure_ascii=False),flush=True)
    pdf_jobs=[]
    for y in range(2020,2027):
        path=OUT/f'alphabet-financial-{y}.json'
        if not path.exists():continue
        reports=json.loads(path.read_text(encoding='utf-8')).get('GetFinancialReportListResult',[])
        for report in reports:
            sub=report.get('ReportSubType','')
            q={'First Quarter':1,'Second Quarter':2,'Third Quarter':3,'Fourth Quarter':4}.get(sub)
            if not q or y==2026 and q>3:continue
            for doc in report.get('Documents',[]):
                if doc.get('DocumentCategory')=='news' and doc.get('DocumentFileType','').upper()=='PDF':
                    pdf_jobs.append((f'alphabet-{y}q{q}',doc['DocumentPath']))
    with ThreadPoolExecutor(max_workers=4) as pool:
        for x in pool.map(lambda a: fetch(*a),pdf_jobs):
            print(json.dumps({k:x.get(k) for k in ['id','status','ok','bytes']},ensure_ascii=False),flush=True)


def extract_pdfs():
    for path in sorted(OUT.glob('alphabet-20*q*.pdf')):
        target=path.with_suffix('.pages.json')
        if target.exists():continue
        with fitz.open(path) as reader:
            save_json(target,{'file':path.name,'pages':[{'page':i+1,'text':p.get_text()} for i,p in enumerate(reader)]})


def number_values(text):
    return [float(x.replace(',','').replace('(','-').replace(')','')) for x in re.findall(r'\(?\d[\d,]*(?:\.\d+)?\)?',text)]


def release_rows():
    rows={};sources=[]
    for path in sorted(OUT.glob('alphabet-20*q*.pages.json')):
        year,q=map(int,re.search(r'alphabet-(\d{4})q(\d)',path.name).groups())
        doc=json.loads(path.read_text(encoding='utf-8'));pages=doc['pages']
        m=re.search(r'–\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})\s*–',pages[0]['text'])
        pub=datetime.strptime(m.group(1),'%B %d, %Y').date().isoformat()
        if pub>ASOF:continue
        def row(label,stop):
            for pg in pages:
                m=re.search(r'(?:^|\n)'+re.escape(label)+r'\s*\n(.*?)'+re.escape(stop),pg['text'],re.S)
                if m:return number_values(m.group(1)),pg['page']
            raise ValueError((path.name,label))
        cloud,cloudpage=row('Google Cloud','Other Bets')
        capex,capexpage=row('Purchases of property and equipment','Purchases of marketable securities')
        # Segment table immediately below Cloud has the same pair of quarter columns.
        revenue,revpage=row('Total revenues','Total TAC')
        sid=f'cloud-alphabet-{year}q{q}'
        meta=json.loads((OUT/f'alphabet-{year}q{q}.meta.json').read_text())
        sources.append({'id':sid,'title':f'Alphabet {year} Q{q} official earnings release','date':pub,
            'kind':'official_results','url':meta['url'],'file':f'outputs/research/raw_cloud/alphabet-{year}q{q}.pdf',
            'page':f'Cloud/revenue p{cloudpage}; cash purchases of property and equipment p{capexpage}',
            'retrievedAt':meta['retrievedAt']})
        for pos,yr in [(1,year),(0,year-1)]:
            key=f'{yr}Q{q}'
            candidate={'period':key,'periodEnd':f'{yr}-{q*3:02d}-{[31,30,30,31][q-1]}',
                'publicationDate':pub,'availableAt':pub,'cloudRevenueBn':cloud[pos]/1000,
                'cashCapexBn':abs(capex[pos])/1000,'totalRevenueBn':revenue[pos]/1000,
                'sourceRefs':[sid],'status':'reported_actual','comparativeColumn':pos==0,
                'note':'现金购置固定资产；不是包括融资租赁新增额的广义资本投入。'}
            if key not in rows or pub<rows[key]['publicationDate']:rows[key]=candidate
    ordered=sorted(rows.values(),key=lambda x:x['period'])
    # Cross-check official releases with SEC facts, deriving cash quarters from YTD.
    sec=json.loads((ROOT/'outputs/research/raw_sec/alphabet-companyfacts.json').read_text())['facts']['us-gaap']
    facts=sec['PaymentsToAcquirePropertyPlantAndEquipment']['units']['USD']
    for row in ordered:
        y=int(row['period'][:4]);q=int(row['period'][-1]);end=row['periodEnd']
        candidates=[x for x in facts if x.get('start')==f'{y}-01-01' and x['end']==end and x['filed']<=ASOF]
        if not candidates:continue
        this=min(candidates,key=lambda x:x['filed'])
        prev=0
        if q>1:
            prevend=f'{y}-{(q-1)*3:02d}-{[31,30,30][q-2]}'
            candidates=[x for x in facts if x.get('start')==f'{y}-01-01' and x['end']==prevend and x['filed']<=this['filed']]
            if not candidates:continue
            prev=max(candidates,key=lambda x:x['filed'])['val']
        derived=(this['val']-prev)/1e9
        row['secCashCapexBn']=derived
        row['secCashCapexMatch']=abs(derived-row['cashCapexBn'])<1e-8
        assert row['secCashCapexMatch'],(row['period'],derived,row['cashCapexBn'])
    return ordered,sources


def supplier_series():
    output={};sources=[]
    for name,company in [('nvidia','NVIDIA'),('broadcom','Broadcom')]:
        path=OUT/f'{name}-companyfacts.json'
        data=json.loads(path.read_text())['facts']['us-gaap']
        records=[]
        for tag in ['RevenueFromContractWithCustomerExcludingAssessedTax','Revenues']:
            for f in data.get(tag,{}).get('units',{}).get('USD',[]):
                if not f.get('start') or f['filed']>ASOF or f['end']<'2019-01-01':continue
                duration=(date.fromisoformat(f['end'])-date.fromisoformat(f['start'])).days
                if 70<=duration<=110:
                    records.append({**f,'tag':tag})
        selected={}
        for f in records:
            if f['end'] not in selected or f['filed']<selected[f['end']]['filed']:selected[f['end']]=f
        rows=[]
        for end,f in sorted(selected.items()):
            prev=[x for x in selected.values() if 330<=(date.fromisoformat(end)-date.fromisoformat(x['end'])).days<=400 and x['filed']<=f['filed']]
            prev=min(prev,key=lambda x:abs((date.fromisoformat(end)-date.fromisoformat(x['end'])).days-365)) if prev else None
            rows.append({'company':company,'periodEnd':end,'periodStart':f['start'],'publicationDate':f['filed'],
                'fiscalPeriod':f"FY{f.get('fy')} {f.get('fp')}",'totalRevenueBn':f['val']/1e9,
                'yoy':f['val']/prev['val']-1 if prev else None,'accession':f['accn'],'tag':f['tag'],
                'sourceRefs':[f'cloud-{name}-sec'],'signalRole':'行业总收入供给代理，非Google采购额或NVDA数据中心收入'} )
        output[name]=rows
        meta=json.loads((OUT/f'{name}-companyfacts.meta.json').read_text())
        sources.append({'id':f'cloud-{name}-sec','title':f'{company} SEC companyfacts, earliest filed quarterly total revenue',
            'date':ASOF,'kind':'regulatory_api','url':meta['url'],'file':f'outputs/research/raw_cloud/{name}-companyfacts.json',
            'note':'只用filed<=预测起点的事实；总收入代理不等于GPU/ASIC/数据中心收入。部分Q4没有直接季度标签，未强造记录。'})
    return output,sources


def quantiles(values):
    a=np.array(values,dtype=float)
    return {'min':float(a.min()),'p25':float(np.quantile(a,.25)),'median':float(np.median(a)),
            'p75':float(np.quantile(a,.75)),'max':float(a.max()),'n':len(values)}


def latest_signal(series,cutoff):
    eligible=[x for x in series if x['publicationDate']<=cutoff and x['yoy'] is not None]
    return max(eligible,key=lambda x:x['periodEnd']) if eligible else None


def historical_validation(history,suppliers):
    """Expanding-window forecasts; all predictors precede the held-out release.

    This validates aggregate historical models, not the unobservable client split.
    No coefficient or model choice is selected using the held-out errors.
    """
    pairs=[];tests=[]
    for i in range(5,len(history)):
        target=history[i];prev=history[i-1];cutoff=prev['publicationDate']
        known=[r for r in history[:i] if r['publicationDate']<=cutoff]
        if len(known)<6 or target['publicationDate']<=cutoff:continue
        by={r['period']:r for r in known}
        ys=[];qs=[]
        for j,r in enumerate(known):
            k=f"{int(r['period'][:4])-1}{r['period'][4:]}"
            if k in by:ys.append(r['cloudRevenueBn']/by[k]['cloudRevenueBn']-1)
            if j and quarter_index(r['period'])-quarter_index(known[j-1]['period'])==1:
                qs.append(r['cloudRevenueBn']/known[j-1]['cloudRevenueBn']-1)
        if not qs:continue
        latestq=qs[-1]
        trailingq=statistics.median(qs[-4:])
        projected_naive=prev['cloudRevenueBn']*(1+trailingq)
        targetprev=by.get(f"{int(target['period'][:4])-1}{target['period'][4:]}")
        projected_seasonal=targetprev['cloudRevenueBn']*(1+statistics.median(ys[-4:])) if targetprev and ys else projected_naive
        ns=latest_signal(suppliers['nvidia'],cutoff);bs=latest_signal(suppliers['broadcom'],cutoff)
        x=[latestq,ns['yoy'] if ns else 0,bs['yoy'] if bs else 0]
        y=target['cloudRevenueBn']/prev['cloudRevenueBn']-1
        eligible=[p for p in pairs if p['targetPublicationDate']<=cutoff]
        supplier_prediction=None
        if len(eligible)>=7 and ns and bs:
            X=np.array([p['x'] for p in eligible]);Y=np.array([p['y'] for p in eligible])
            center=X.mean(0);scale=X.std(0);scale[scale<1e-8]=1
            Z=np.column_stack([np.ones(len(X)),(X-center)/scale])
            penalty=np.eye(4);penalty[0,0]=0
            beta=np.linalg.solve(Z.T@Z+penalty,Z.T@Y)
            pred=float(np.r_[1,(np.array(x)-center)/scale]@beta)
            supplier_prediction=prev['cloudRevenueBn']*(1+max(-.5,min(1,pred)))
        capex_predict=prev['cashCapexBn']
        intensity=statistics.median([r['cashCapexBn']/r['totalRevenueBn'] for r in known[-4:]])
        rev_q=statistics.median([known[j]['totalRevenueBn']/known[j-1]['totalRevenueBn']-1 for j in range(max(1,len(known)-4),len(known))])
        capex_intensity=prev['totalRevenueBn']*(1+rev_q)*intensity
        if target['period']>='2024Q1':
            tests.append({'period':target['period'],'forecastOrigin':cutoff,'targetPublicationDate':target['publicationDate'],
                'trainingRows':len(eligible),'actualCloudBn':target['cloudRevenueBn'],
                'cloudTrailingQuarterGrowthBn':projected_naive,'cloudSeasonalYoyBn':projected_seasonal,
                'cloudSupplierRidgeBn':supplier_prediction,'actualCapexBn':target['cashCapexBn'],
                'capexLastQuarterBn':capex_predict,'capexHistoricalIntensityBn':capex_intensity,
                'supplierInputs':{'nvidia':ns,'broadcom':bs}})
        pairs.append({'x':x,'y':y,'targetPublicationDate':target['publicationDate']})
    def score(field,actual,matching=None):
        sample=[x for x in tests if x[field] is not None and (not matching or x[matching] is not None)]
        if not sample:return None
        errors=[x[field]-x[actual] for x in sample]
        return {'n':len(sample),'maeBn':float(np.mean(np.abs(errors))),
            'mape':float(np.mean([abs(e)/x[actual] for e,x in zip(errors,sample)])),
            'biasBn':float(np.mean(errors)),'periods':[x['period'] for x in sample]}
    scores={k:score(k,'actualCloudBn' if k.startswith('cloud') else 'actualCapexBn') for k in
        ['cloudTrailingQuarterGrowthBn','cloudSeasonalYoyBn','cloudSupplierRidgeBn','capexLastQuarterBn','capexHistoricalIntensityBn']}
    scores['cloudTrailingQuarterGrowthMatchedSupplier']=score('cloudTrailingQuarterGrowthBn','actualCloudBn','cloudSupplierRidgeBn')
    return {'method':'逐季扩展训练；固定岭惩罚1，未按留出成绩选模型或参数；下一季预测起点为前季正式披露日。',
        'testWindow':'2024Q1–2026Q3','rows':tests,'scores':scores,
        'noLookAheadChecks':{'allTargetsPublishedAfterOrigin':all(x['forecastOrigin']<x['targetPublicationDate'] for x in tests),
            'allSupplierFactsAvailableAtOrigin':all(all(z is None or z['publicationDate']<=x['forecastOrigin'] for z in x['supplierInputs'].values()) for x in tests)},
        'interpretation':'这是整体Cloud/现金capex历史模型的真实滚动留出，不验证没有历史实绩的客户拆分、5GW兑现或新硬件收入；样本小且2026发生业务结构变化。',
        'investmentReturnBacktest':False}


def quarter_index(period):
    return int(period[:4])*4+int(period[-1])-1


def make_inputs():
    history,sources=release_rows();suppliers,supplier_sources=supplier_series();sources+=supplier_sources
    backtest=historical_validation(history,suppliers)
    latest=history[-1]
    by={x['period']:x for x in history}
    growth=[]
    for i,x in enumerate(history):
        if i:
            growth.append({'period':x['period'],'qoq':x['cloudRevenueBn']/history[i-1]['cloudRevenueBn']-1,
                'incrementBn':x['cloudRevenueBn']-history[i-1]['cloudRevenueBn']})
        prior=by.get(f"{int(x['period'][:4])-1}{x['period'][4:]}")
        if prior:x['cloudYoy']=x['cloudRevenueBn']/prior['cloudRevenueBn']-1
    mature=[x for x in growth if '2023Q1'<=x['period']<='2024Q4']
    enterprise_season={str(q):statistics.median([x['qoq'] for x in mature if int(x['period'][-1])==q]) for q in range(1,5)}
    enterprise_growth=[enterprise_season[p[-1]] for p in PERIODS]
    calibration={
        'cloudQuarterGrowth2023to2024':quantiles([x['qoq'] for x in mature]),
        'cloudQuarterGrowthLast8':quantiles([x['qoq'] for x in growth[-8:]]),
        'quarterSeasonalGrowth':enterprise_season,
        'quarterSeasonalityMethod':'2023–2024每个季度的Cloud环比增长中位数；两年各两点，作为企业/Workspace成熟业务增长的尺度代理，非已披露细分增速。',
        'cashCapexToTotalRevenueLast8':quantiles([x['cashCapexBn']/x['totalRevenueBn'] for x in history[-8:]]),
        'cashCapexToCloudRevenueLast8':quantiles([x['cashCapexBn']/x['cloudRevenueBn'] for x in history[-8:]]),
        'cloudIncrementLast4Bn':statistics.mean([x['incrementBn'] for x in growth[-4:]]),
        'sourceRefs':[x['sourceRefs'][0] for x in history if '2023Q1'<=x['period']<='2026Q3']}
    chain=json.loads((ROOT/'assets/research-chain.json').read_text(encoding='utf-8'))
    ids=['chain-anthropic-google-20251023','chain-anthropic-google-20260406','chain-anthropic-series-h-20260528','chain-broadcom-q3-20260902']
    sources += [s for s in chain['sources'] if s['id'] in ids]
    sources.append({'id':'cloud-openai-subprocessors','title':'OpenAI Sub-processor list','date':'2026-10-14','kind':'company_disclosure',
        'url':'https://openai.com/policies/sub-processor-list/','file':'outputs/research/raw_cloud/openai-subprocessors.html',
        'page':'Third Party Sub-processors → Google Cloud Platform row',
        'note':'GCP为API、ChatGPT Enterprise/Edu/Business提供Cloud infrastructure。只证明供应关系，没有金额、GPU/TPU构成、训练用途或Google份额。'})
    sources.append({'id':'cloud-openai-business-scale','title':'OpenAI CFO: A business that scales with the value of intelligence','date':'2026-01-18','kind':'company_disclosure',
        'url':'https://openai.com/index/a-business-that-scales-with-the-value-of-intelligence/','file':'outputs/research/raw_cloud/openai-business-scale.html',
        'page':'Sarah Friar: Compute grew / revenue followed the same curve paragraphs',
        'note':'官方2023/2024/2025 ARR约2/6/20+bn、可用算力0.2/0.6/约1.9GW。ARR与算力是全公司口径，不是Google份额或确认收入；2026–2027外推另标假设。'})
    local=json.loads((ROOT/'assets/research-local-models.json').read_text(encoding='utf-8'))
    local_source=next(s for s in local['sources'] if s['id']=='local-googl-barc-20260724')
    sources.append(local_source)
    sources.append({'id':'cloud-research-assumptions','title':'可编辑客户与资产归属情景假设','date':ASOF,'kind':'research_assumption',
        'file':'assets/cloud-inputs.json','page':'parameters / parameterDefinitions / customerScenarios',
        'note':'预算、客户拆分、Google采购份额及验收路径未由公开披露唯一识别。它们是受规模和已知时间约束的敏感性情景，非实绩或统计置信区间。'})
    mature_yoy=statistics.median([x['cloudYoy'] for x in history if '2023Q1'<=x['period']<='2024Q4'])
    enterprise_base=by['2024Q3']['cloudRevenueBn']*(1+mature_yoy)**2
    growth_excess=max(0,latest['cloudRevenueBn']-by['2025Q3']['cloudRevenueBn']*(1+mature_yoy))
    external_base=growth_excess*.45
    base={'Anthropic':1.0*(92/90)*.8*2.7,
          'OpenAI':1.9*2.0*.10*(92/90)*.8*2.7}
    base['otherAI']=latest['cloudRevenueBn']-enterprise_base-external_base-sum(base.values())
    assert base['otherAI']>0
    customer_specs={
        'Anthropic':{'label':'Anthropic','computeBudgetBn':[12,14,17,20,23],'trainingShare':.6,'googleTrainingShare':.30,
            'googleInferenceShare':.25,'averageAcceptedCapacityGW':[1.4,1.8,2.4,3.0,3.6],'googleOwnedAssetShare':.8,
            'sourceRefs':['chain-anthropic-google-20251023','chain-anthropic-google-20260406','chain-anthropic-series-h-20260528'],
            'rationale':'2026>1GW计划与2027起新增5GW为容量和日期锚；仅假设部分逐季验收。算力预算及Google份额没有官方金额验证，不能由47bn运行率或融资65bn推出。'},
        'OpenAI':{'label':'OpenAI','computeBudgetBn':[18,21,24,27,30],'trainingShare':.6,'googleTrainingShare':.06,
            'googleInferenceShare':.11,'averageAcceptedCapacityGW':[.55,.65,.75,.85,1.0],'googleOwnedAssetShare':1.0,
            'sourceRefs':['cloud-openai-subprocessors','cloud-openai-business-scale'],
            'rationale':'官方确认GCP基础设施关系、2025全公司ARR20+bn和约1.9GW。2026规模外推2倍低于2023–2025每年约3倍历史，但仍是假设；Google份额和容量均未披露，金额可降至0。不把ChatGPT活跃度、Gemini流量直接转换成采购。'},
        'otherAI':{'label':'其他外部AI客户','computeBudgetBn':[14,17,20,23,26],'trainingShare':.45,'googleTrainingShare':.24,
            'googleInferenceShare':.30,'averageAcceptedCapacityGW':[1.9,2.3,2.8,3.3,3.8],'googleOwnedAssetShare':.8,
            'sourceRefs':[latest['sourceRefs'][0]],
            'rationale':'汇总其他外部模型/应用客户的采购敏感性，不包含Google自身Search/Gemini消耗，也不包含Anthropic/OpenAI及对外TPU硬件。官方Cloud强劲增长只校准总规模，无法确定本组客户金额。'}}
    # A dated business-scale anchor plus explicit cost/forward-growth assumptions;
    # this does not turn annualized run-rate into recognized quarterly revenue.
    revenue_proxy0={'Anthropic':47/4*1.5**(7/12),'OpenAI':20/4*2,
        'otherAI':base['otherAI']/(.45*.24+.55*.30)*(1-.45)/.4}
    proxy_growth={'Anthropic':.15,'OpenAI':.15,'otherAI':calibration['cloudQuarterGrowthLast8']['median']}
    inference_rate={'Anthropic':.4,'OpenAI':.45,'otherAI':.4}
    demand_builds={}
    for key,spec in customer_specs.items():
        rev=[revenue_proxy0[key]*(1+proxy_growth[key])**i for i in range(5)]
        inference=[x*inference_rate[key] for x in rev]
        training=[x*spec['trainingShare']/(1-spec['trainingShare']) for x in inference]
        spec['computeBudgetBn']=[a+b for a,b in zip(inference,training)]
        demand_builds[key]={'formula':'computeBudgetBn = quarterlyRevenueProxyBn × inferenceProcurementCostRate + trainingBudgetBn',
            'quarterlyRevenueProxyBn':rev,'inferenceProcurementCostRate':inference_rate[key],
            'inferenceBudgetBn':inference,'trainingBudgetBn':training,'trainingBudgetFormula':'推理预算 × trainingShare/(1-trainingShare)；训练占比是独立研究假设。',
            'forwardQuarterGrowth':proxy_growth[key],'status':'derived_research_scenario_not_recognized_revenue',
            'anchor':{'Anthropic':'2026-05官方运行率47bn/4×研究年增长1.5倍^(7/12)，得到Q4运行率尺度代理；15%未来环比另为研究假设。',
                'OpenAI':'2025官方ARR下界20bn/4×研究2026增长2倍，得到Q4收入尺度代理；15%未来环比另为研究假设。',
                'otherAI':'从基期AI剩余分摊和研究Google份额反算预算尺度，再按近期总Cloud增长中位数外推；并非独立观察到的客户收入或预算。'}[key],
            'sourceRefs':spec['sourceRefs']+['cloud-research-assumptions'],
            'unidentified':['推理采购费用率','训练预算占比','Google训练/推理份额','未来增长','实际确认收入与运行率代理之差']}
    customers={}
    for key,spec in customer_specs.items():
        customers[key]={k:v for k,v in spec.items() if k not in ['label','rationale','sourceRefs']}
        customers[key].update(baseRevenueBn=base[key],utilization=.8,netServicePriceBnPerGWQuarter=2.7,
            baseAverageAcceptedCapacityGW=base[key]/(92/90*.8*2.7),
            budgetMethod='revenueAndTraining',
            commercialRevenueRunRateBn=[x*4 for x in demand_builds[key]['quarterlyRevenueProxyBn']],
            inferenceCostRate=inference_rate[key],trainingBudgetBn=demand_builds[key]['trainingBudgetBn'],
            serviceMethod='contract',reservedBillingFraction=0,status='research_assumption',sourceRefs=spec['sourceRefs']+['cloud-research-assumptions'],
            baseRevenueStatus='estimated_allocation_not_disclosed',baseRevenueReadonly=True,
            baseAverageAcceptedCapacityReadonly=True,
            baseCapacityBasis='基期拆分收入/(92天/90×研究利用率0.8×研究净价2.7)，仅是锁定尺度容量，不是已披露/已验收实绩。')
    owned_base=enterprise_base*.9+sum(base[k]*customers[k]['googleOwnedAssetShare'] for k in base)
    services_base=latest['cloudRevenueBn']-external_base
    owned_ratio=owned_base/services_base
    avg_increment=calibration['cloudIncrementLast4Bn']
    # This is an aggregate proxy, not an identified cost of Cloud capacity.
    noncloud=.4;maintenance=.3;equipment=.7
    expansion_intensity=latest['cashCapexBn']*(1-noncloud)*(1-maintenance)/(avg_increment*owned_ratio)
    parameters={
        'enterprise':{'baseRevenueBn':enterprise_base,'sequentialGrowth':enterprise_growth,'googleOwnedAssetShare':.9,
            'status':'historically_calibrated_research_proxy','baseRevenueReadonly':True,
            'note':'基期余额含Workspace、普通企业GCP与未单列业务；它是官方总额减研究拆分的残差，不能称已披露企业收入。'},
        'customers':customers,
        'externalTPU':{'baseRevenueBn':external_base,'recognitionFraction':1,'capacitySoldGW':[.5,.6,.75,.9,1.05],
            'netPriceBnPerGW':[14.2857142857,14.5,15,15.5,16.0],'status':'broker_anchored_research_assumption',
            'baseRevenueReadonly':True,'sourceRefs':['local-googl-barc-20260724','cloud-research-assumptions'],
            'note':'只算Google对外TPU系统销售的收入情景，与TPU云服务分开；价格参考BARC外售行的GW×单价结构，原行名TPUaaS存在语义歧义，不是公司披露成交价。'},
        'capex':{'baseCashCapexBn':latest['cashCapexBn'],'equipmentShare':equipment,'nonCloudShare':noncloud,
            'equipmentIntensityBnPerIncrementalServiceRevenueBn':expansion_intensity*equipment*.4,
            'facilityIntensityBnPerIncrementalServiceRevenueBn':expansion_intensity*(1-equipment)*.4,
            'enterpriseExpansionCalibrationShare':.4,
            'aiEquipmentCostBnPerGW':12.0,'aiFacilityCostBnPerGW':4.0,
            'paymentLagQuarters':0,'equipmentPaymentLagQuarters':0,'facilityPaymentLagQuarters':0,
            'maintenanceRatio':maintenance,'status':'historically_calibrated_research_proxy','baseCashCapexReadonly':True,
            'calibrationFormula':'总扩容强度=最新现金capex×(1-非Cloud比例)×(1-维持比例)/(最近4季Cloud收入环比增量均值×基期服务自有资产比例)；其中40%作为企业增量收入强度，再按设备70%/设施30%拆分。AI客户独立使用自有验收GW增量×每GW设备/设施成本。',
            'note':'非Cloud40%、维持30%、设备70%、企业强度分摊40%、自有资产比例及AI每GW设备12/设施4bn均为研究情景，不是分部或采购成本披露。集团历史只能校准规模，不能识别Cloud因果资本成本；AI预算/售价/利用率变化不直接改变投资；不含外售TPU库存成本。'},
        'global':{'enterpriseGrowthAdjustment':0,'customerBudgetMultiplier':1,'googleShareMultiplier':1,'capacityMultiplier':1,
            'utilizationMultiplier':1,'netPriceMultiplier':1,'tpuVolumeMultiplier':1,
            'equipmentCostMultiplier':1,'facilityCostMultiplier':1,'nonCloudCapexMultiplier':1}}
    definitions=[]
    def add(path,label,value,lo,hi,unit,step,group,basis,refs,status='research_assumption',readonly=False):
        definitions.append({'path':path,'label':label,'value':value,'min':lo,'max':hi,'unit':unit,'step':step,
            'group':group,'basis':basis,'sourceRefs':refs,'status':status,'readonly':readonly})
    global_meta=[
        ('enterpriseGrowthAdjustment','企业服务环比增速调整',-.25,.5,'ratio',.005,'调整enterprise.sequentialGrowth，基准来自历史季节性尺度。'),
        ('customerBudgetMultiplier','客户算力预算倍率',0,10,'multiple',.05,'共同缩放所有客户推理预算与训练预算，1保持明细参数。'),
        ('googleShareMultiplier','Google采购份额倍率',0,5,'multiple',.05,'共同缩放各客户训练/推理Google采购比例，最终份额限制在0至100%。'),
        ('capacityMultiplier','平均验收容量倍率',0,10,'multiple',.05,'缩放各客户未来平均验收容量，不改基期；由此影响服务上限及AI自有资产扩容。'),
        ('utilizationMultiplier','利用率倍率',0,2,'multiple',.05,'缩放已验收容量利用率，有效利用率最高100%；默认 constrainedBudget 模式下，收入受需求与供给较小值限制。'),
        ('netPriceMultiplier','服务净价倍率',0,5,'multiple',.05,'缩放服务情景净价，不改变自有GW设备投资。'),
        ('tpuVolumeMultiplier','外售TPU交付倍率',0,10,'multiple',.05,'缩放外售硬件验收量，不与Google云服务容量重复计费。'),
        ('equipmentCostMultiplier','自有设备成本倍率',0,5,'multiple',.05,'缩放 Cloud 维持投入设备部分、企业扩容设备投入及 AI 自有容量设备投入；不缩放非Cloud支出。'),
        ('facilityCostMultiplier','自有设施成本倍率',0,5,'multiple',.05,'缩放 Cloud 维持投入设施部分、企业扩容设施投入及 AI 自有容量设施投入；不缩放非Cloud支出。'),
        ('nonCloudCapexMultiplier','其他业务资本开支倍率',0,5,'multiple',.05,'缩放非Cloud现金capex基准，体现Search/Gemini等自用建设情景。')]
    for key,label,lo,hi,unit,step,basis in global_meta:
        add('global.'+key,label,parameters['global'][key],lo,hi,unit,step,'快捷调整',basis,
            ['cloud-research-assumptions'],'scenario_control')
    for i,p in enumerate(PERIODS):
        add(f'enterprise.sequentialGrowth.{i}',f'{p}企业/Workspace环比增速',enterprise_growth[i],-.05,.30,'ratio',.005,'企业与Workspace',
            calibration['quarterSeasonalityMethod'],calibration['sourceRefs'],'historically_calibrated_proxy')
    add('enterprise.googleOwnedAssetShare','企业服务自有资产比例',.9,0,1,'ratio',.05,'资本开支',
        '研究假设；剩余部分代表第三方租用或非自有资产服务。',['cloud-research-assumptions'])
    for key,spec in customer_specs.items():
        group=spec['label'];refs=spec['sourceRefs']+['cloud-research-assumptions']
        add(f'customers.{key}.reservedBillingFraction','已验收容量最低计费比例',0,0,1,'ratio',.05,group,
            '合同条款未披露；初始0%仅表示本情景不计保底，并非确认没有最低承诺。按满额计费金额的比例设置，保底已包含对应使用量，不再重复计费。',refs)
        for i,p in enumerate(PERIODS):
            v=customers[key]['computeBudgetBn'][i]
            add(f'customers.{key}.computeBudgetBn.{i}',f'{p}总算力采购预算（派生）',v,0,v*2,'USD bn',.5,group,spec['rationale'],refs,readonly=True)
            v=customers[key]['commercialRevenueRunRateBn'][i]
            add(f'customers.{key}.commercialRevenueRunRateBn.{i}',f'{p}平均年化收入运行率情景',v,0,v*3,'USD bn annualized',1,group,
                demand_builds[key]['anchor']+' 这里是季度平均运行率情景，不是确认收入、当前真实ARR或Google订单。',refs,'disclosure_anchored_research_proxy' if key!='otherAI' else 'residual_calibrated_research_proxy')
            v=customers[key]['trainingBudgetBn'][i]
            add(f'customers.{key}.trainingBudgetBn.{i}',f'{p}训练采购预算',v,0,v*3,'USD bn',.5,group,
                '初值按推理预算×训练占比/(1-训练占比)设置；可独立调整，训练预算没有公司原始财务表核验。',refs)
            v=customers[key]['averageAcceptedCapacityGW'][i]
            add(f'customers.{key}.averageAcceptedCapacityGW.{i}',f'{p}平均验收且可收费容量',v,0,max(5,v*2),'GW',.05,group,
                'Google服务容量的情景，不是芯片出货；季度平均值，不是季末容量。'+spec['rationale'],refs)
        for field,label,value in [('googleTrainingShare','训练采购Google比例',spec['googleTrainingShare']),
            ('googleInferenceShare','推理采购Google比例',spec['googleInferenceShare']),('utilization','已上线容量利用率',.8),('googleOwnedAssetShare','服务中Google自有资产比例',spec['googleOwnedAssetShare'])]:
            add(f'customers.{key}.{field}',label,value,0,1,'ratio',.01,group,'未披露参数；可独立压力测试，不是由客户关系推算的实绩。',refs)
        add(f'customers.{key}.inferenceCostRate','推理采购费用/收入代理',inference_rate[key],0,3,'ratio',.05,group,
            '推理采购费用率没有公司成本表核验；训练另列。该比率不可等同毛利率的补数，也不可由全口径compute费用率替代。',refs)
        add(f'customers.{key}.netServicePriceBnPerGWQuarter','季度净服务单价',2.7,.5,5,'USD bn/GW/quarter',.1,group,
            '引擎定义为90天、100%利用率的情景净价，再乘季度天数/90和利用率。BARC2.7是每平均GW的有效季度收入，原表未披露利用率；本模型再乘80%是额外实现折扣，并非复现BARC公式或公开满载费率。客户净价、GPU/TPU混合和折扣未披露。',['local-googl-barc-20260724','cloud-research-assumptions'],'broker_anchored_research_assumption')
    for i,p in enumerate(PERIODS):
        add(f'externalTPU.capacitySoldGW.{i}',f'{p}对外TPU验收销售容量',parameters['externalTPU']['capacitySoldGW'][i],0,2,'GW',.05,'外售TPU',
            '2027全年基准3.3GW，低于BARC 2027预测3.7GW；不是公司销量实绩。',['local-googl-barc-20260724','cloud-research-assumptions'],'broker_anchored_research_assumption')
        add(f'externalTPU.netPriceBnPerGW.{i}',f'{p}对外硬件净收入/GW',parameters['externalTPU']['netPriceBnPerGW'][i],5,25,'USD bn/GW',.5,'外售TPU',
            'BARC季度/年度假设14.29/18.31bn每GW仅为尺度参考，实际毛额/净额需遵循合同及会计口径。',['local-googl-barc-20260724','cloud-research-assumptions'],'broker_anchored_research_assumption')
    add('externalTPU.recognitionFraction','交付批次当期确认比例',1,0,1,'ratio',.05,'外售TPU',
        '100%是旧情景初值，未核实控制权转移与硬件/服务划分；可调低检验当期确认收入，不自动将未确认余额递延至后期。',['cloud-research-assumptions'])
    for field,label,lo,hi,unit,step in [
        ('nonCloudShare','现金capex中非Cloud比例',0,1,'ratio',.05),('equipmentShare','设备占扩容及维持支出比例',0,1,'ratio',.05),
        ('maintenanceRatio','Cloud维持支出比例',0,1,'ratio',.05),
        ('equipmentIntensityBnPerIncrementalServiceRevenueBn','设备资本强度',0,15,'USD bn / USD bn',.25),
        ('facilityIntensityBnPerIncrementalServiceRevenueBn','机房资本强度',0,10,'USD bn / USD bn',.25),
        ('aiEquipmentCostBnPerGW','AI自有设备采购成本/GW',4,24,'USD bn/GW',.5),
        ('aiFacilityCostBnPerGW','AI自有机房及配套成本/GW',1,10,'USD bn/GW',.5),
        ('paymentLagQuarters','付款滞后季度',0,4,'quarters',1)]:
        if field=='aiEquipmentCostBnPerGW':
            basis='12bn/GW是研究成本代理：BARC外售TPU经营费用/销售GW在2026Q4为10.714bn、2027为13.732bn，二者均值12.223取整为12。该费用可能含非设备项目，且外售方费用不同于Google自有设备现金购置；因此不是已识别历史单位成本。Broadcom首批35bn/1GW是融资交易范围对照，不是Google成本上限。'
            refs=['local-googl-barc-20260724','chain-broadcom-q3-20260902','cloud-research-assumptions'];status='broker_scale_proxy_not_historical_unit_cost'
        elif field=='aiFacilityCostBnPerGW':
            basis='4bn/GW是取设备研究成本12bn/GW的三分之一作为设施配套情景；现有资料不能识别设施/设备拆分，没有历史实绩校准。设置1–10bn/GW压力范围，不能把XPV融资或TPU售价当设施成本。'
            refs=['cloud-research-assumptions'];status='unidentified_research_assumption'
        else:
            basis=parameters['capex']['calibrationFormula']+' '+parameters['capex']['note']
            refs=[latest['sourceRefs'][0],'cloud-research-assumptions'];status='historically_calibrated_research_proxy'
        add('capex.'+field,label,parameters['capex'][field],lo,hi,unit,step,'资本开支',basis,refs,status)
    assumption_meta={}
    for key,spec in customer_specs.items():
        assumption_meta[key]={'relationshipVerified':True,'verifiedPurchaseAmountBn':None,
            'baseAllocationBn':base[key],'baseAllocationStatus':'research_allocation_not_disclosed',
            'rationale':spec['rationale'],'sourceRefs':spec['sourceRefs'],'scenarioIntervalMeaning':'用户可编辑压力测试范围，非统计置信区间。',
            'demandBuild':demand_builds[key],
            'historicalAllocationBasis':{'Anthropic':'1GW计划尺度×92/90天×研究利用率80%×研究净价2.7；不是计划已经验收的断言。',
                'OpenAI':'2025公司算力约1.9GW×研究2026增长2倍×研究GCP容量份额10%×92/90天×80%×2.7；关系不能验证这些份额。',
                'otherAI':'官方Cloud总额扣除成熟增长反推企业基期、硬件加速分摊及两名客户情景后的残差，非客户实绩。'}[key]}
    case=json.loads((ROOT/'outputs/googl-case.json').read_text(encoding='utf-8'))
    ms_date=next(x for x in case['brokerComparisons'] if x['broker']=='Morgan Stanley')['date']
    ms_source=next(x for x in case['sources'] if x['id']=='ms')
    sources.append({'id':'cloud-ms-model','title':'Morgan Stanley Alphabet模型快照','date':ms_date,'kind':'broker_model',
        'file':ms_source['file'],'page':'Model / Rev Roll-up；日期IndexInformation!B2 / ModPubIndex!A2',
        'note':'日期来自模型索引；与较旧机构版本不构成同期一致预期。只作结果比较，不作为自主模型输入。'})
    ms=[{'period':x['period'],'cloudRevenueBn':x['segments']['cloud']/1000,'cashCapexBn':x['capex']/1000,
        'sourceRefs':['cloud-ms-model']} for x in case['quarters'] if x['period'] in PERIODS]
    from build_case import CachedWorkbook
    bw=CachedWorkbook((ROOT.parent/'GOOGL_BARC_analyst_model_20260724.xlsx').read_bytes(),'BARC comparison')
    barc=[{'period':p,'cloudRevenueBn':bw.value('New Driver',f'{col}102')/1000,'cashCapexBn':None,
        'sourceRefs':['local-googl-barc-20260724'],'cell':f'New Driver!{col}102'} for p,col in zip(PERIODS,['EE','EG','EH','EI','EJ'])]
    gs=CachedWorkbook((ROOT.parent/'GOOGL_GS_analyst_model_20260804.xlsx').read_bytes(),'GS comparison')
    sources.append({'id':'cloud-gs-model','title':'Goldman Sachs Alphabet模型快照','date':'2026-08-04','kind':'broker_model',
        'file':'GOOGL_GS_analyst_model_20260804.xlsx','page':'Cash Flow Statement!DC25 / DD25',
        'note':'原工作簿缓存中购置固定资产现金流为负，比较展示支出绝对值；旧日期预测不是11月一致预期。'})
    gs_annual=[{'period':str(y),'cashCapexBn':abs(gs.value('Cash Flow Statement',f'{col}25'))/1000,
        'sourceRefs':['cloud-gs-model'],'cell':f'Cash Flow Statement!{col}25'} for y,col in [(2026,'DC'),(2027,'DD')]]
    reports=json.loads((ROOT/'assets/research-local-reports.json').read_text(encoding='utf-8'))
    jpm_source=next(x for x in reports['sources'] if x['id']=='local-jpm-us-internet-202607')
    sources.append(jpm_source)
    jpm_annual=[{'period':str(x['period']).replace('E',''),'cashCapexBn':x['value']/1000,'sourceRefs':x['sourceRefs'],
        'page':x['page']} for x in reports['evidenceMetrics'] if x['id'] in ['local-jpm-google-capex-2026','local-jpm-google-capex-2027']]
    comparisons={'ms':{'asOf':ms_date,'publicationDate':ms_date,'dateBasis':'IndexInformation!B2 / ModPubIndex!A2',
        'quarters':ms,'sourceRefs':['cloud-ms-model'],'role':'预测完成后比较，不作为自主预测输入或拟合目标。'},
        'barclays':{'asOf':'2026-07-24','publicationDate':'2026-07-24','quarters':barc,
            'annual':[{'period':'2027','cloudRevenueBn':bw.value('New Driver','EK102')/1000,
                'components':{'gcpExExternalTPUAndWorkspaceBn':bw.value('New Driver','EK114')/1000,
                    'workspaceBn':bw.value('New Driver','EK120')/1000,'externalTPURevenueBn':bw.value('New Driver','EK127')/1000},
                'sourceRefs':['local-googl-barc-20260724'],'cells':['New Driver!EK102','New Driver!EK114','New Driver!EK120','New Driver!EK127']}],
            'sourceRefs':['local-googl-barc-20260724']},
        'goldmanSachs':{'asOf':'2026-08-04','publicationDate':'2026-08-04','annual':gs_annual,'sourceRefs':['cloud-gs-model']},
        'jpmorgan':{'asOf':'2026-07','publicationDate':'2026-07','datePrecision':'month','annual':jpm_annual,'sourceRefs':['local-jpm-us-internet-202607']}}
    result={'schemaVersion':1,'asOf':ASOF,'forecastPeriods':PERIODS,'units':{'money':'USD bn','capacity':'GW'},
        'history':{'quarters':history,'supplierSignals':suppliers,'latestPeriod':latest['period']},
        'calibration':calibration,'backtest':backtest,'customerScenarios':assumption_meta,
        'parameters':parameters,'parameterDefinitions':definitions,
        'comparisons':comparisons,
        'comparisonsNote':'机构模型日期不同；BARC部分驱动提供尺度锚，但其Cloud结果未用于拟合。MS、GS和JPM只在独立预测后比较。',
        'capexCostCrossChecks':{
            'barclays2026Q4ExpensePerSoldGWBn':bw.value('New Driver','EE149')/1000/bw.value('New Driver','EE130'),
            'barclays2027ExpensePerSoldGWBn':bw.value('New Driver','EK149')/1000/bw.value('New Driver','EK130'),
            'roundedEquipmentScenarioBnPerGW':12,'facilityToEquipmentResearchRatio':1/3,
            'broadcomFirstXPVTrancheBn':35,'broadcomFirstXPVDeploymentGW':1,
            'sourceRefs':['local-googl-barc-20260724','chain-broadcom-q3-20260902'],
            'scopeWarning':'BARC外售经营费用/GW是券商单位经济代理，不是自有固定资产现金支出；XPV35bn/1GW是打包融资范围，不是设备成本，更不是Google承担额。设施4bn/GW无法由这些资料识别，明确为研究情景而非历史校准。'},
        'historicalAllocationCalibration':{'matureCloudYoy':mature_yoy,'enterpriseProxyBaseBn':enterprise_base,
            'enterpriseFormula':'2024Q3总Cloud×(1+2023–2024总Cloud同比中位数)^2；它是成熟增长基线代理，含历史AI，非已披露企业分部。',
            'cloudGrowthAboveMatureBaselineBn':growth_excess,'hardwareShareOfExcessAssumption':.45,
            'externalHardwareBaseBn':external_base,'hardwareFormula':'2026Q3 Cloud减2025Q3×成熟同比基线，其超额增长的45%作为硬件分摊情景；45%未披露。',
            'warning':'总额勾稽只保证算术一致，不能验证客户拆分。所有基期拆分锁定只读，供敏感性备选另列。'},
        'allocationSensitivityAlternatives':[
            {'id':'low-named-customer-allocation','Anthropic':1.104,'OpenAI':0,'otherAI':3,'externalTPU':3,
             'enterprise':latest['cloudRevenueBn']-7.104,'basis':'已知客户/硬件分摊偏低，更多归于企业残差；不改官方总额。'},
            {'id':'central-allocation',**base,'externalTPU':external_base,'enterprise':enterprise_base,'basis':'有公式与来源尺度锚的研究基准。'},
            {'id':'high-named-customer-allocation','Anthropic':3.312,'OpenAI':1.25856,'otherAI':5,'externalTPU':7,
             'enterprise':latest['cloudRevenueBn']-16.57056,'basis':'Anthropic取1.5GW计划尺度、OpenAI取15%容量份额、硬件分摊提高；均为研究压力测试。'}],
        'sources':sources,
        'scenarioPresets':{
            'low':{'label':'需求及交付偏弱','budgetMultiplier':.75,'googleShareMultiplier':.8,'capacityMultiplier':.75,'servicePriceMultiplier':.9,'externalTPUVolumeMultiplier':.7,'externalTPUPriceMultiplier':.9,'enterpriseGrowthAdjustment':-.025},
            'base':{'label':'研究基准','budgetMultiplier':1,'googleShareMultiplier':1,'capacityMultiplier':1,'servicePriceMultiplier':1,'externalTPUVolumeMultiplier':1,'externalTPUPriceMultiplier':1,'enterpriseGrowthAdjustment':0},
            'high':{'label':'需求及交付偏强','budgetMultiplier':1.25,'googleShareMultiplier':1.2,'capacityMultiplier':1.25,'servicePriceMultiplier':1.1,'externalTPUVolumeMultiplier':1.3,'externalTPUPriceMultiplier':1.1,'enterpriseGrowthAdjustment':.025}},
        'accountingRules':['预算法与容量法取较小值，不将二者相加。','Google外部客户服务与硬件销售分栏；Google自用Search/Gemini不产生外部Cloud收入。',
            'NVIDIA/Broadcom总收入只作历史信号；没有Google专属数量时不直乘Google份额。','Anthropic公开TPU数量、2027新容量、融资及采购新闻不可叠加为Google收入。',
            '企业自有扩容按相邻季度新增服务收入强度代理；AI客户按相邻季度自有验收GW增量×设备/设施成本；第三方租赁不全额映射Google自有capex。'],
        'limitations':['历史总额已由官方release核验且现金capex与SEC对账；客户及服务/硬件历史拆分不是披露事实。',
            '企业成熟增速只用2023–2024总Cloud作尺度代理，2026产品销售及AI增长使其不能当作真实同口径企业历史。',
            '客户预算、采购份额、净价和验收容量不可被现有材料唯一识别；情景范围不是置信区间，也不是订单承诺。',
            '供应商回归历史样本有限，未证明增加信号能改善预测；整体Cloud回测不验证客户拆分或TPU项目收入。',
            '现金capex强度有集团自用AI与提前建设的混合影响；非Cloud基准固定，未自动预测Google自身AI扩张，且季度付款有波动；没有拟合MS来消除差异。',
            'Broadcom总收入在2023年收购VMware后口径变化；供应商总收入并非同质AI供给指标，回归只做探索性留出对照。',
            '2021比较值来自2022官方发布，availability严格使用取得该值的发布日，未伪装为2021实时数据。'],
        'generatedAt':datetime.now(timezone.utc).isoformat()}
    source_ids={s['id'] for s in sources}
    assert len(source_ids)==len(sources)
    assert all(s['date']<=ASOF for s in sources)
    assert all(r['publicationDate']<=ASOF for r in history)
    assert abs(parameters['enterprise']['baseRevenueBn']+sum(base.values())+external_base-latest['cloudRevenueBn'])<1e-10
    assert all(backtest['noLookAheadChecks'].values())
    save_json(ROOT/'assets/cloud-inputs.json',result)
    # Reuse the actual engine for alternative decompositions of the same reported
    # base total. These are research uncertainty runs, never historical edits.
    engine_code="""
import fs from 'node:fs';
import {calculateCloudCase} from './scripts/cloud-model.mjs';
const data=JSON.parse(fs.readFileSync('./assets/cloud-inputs.json','utf8'));
const runs=data.allocationSensitivityAlternatives.map(a=>{
 const d=structuredClone(data);
 d.parameters.enterprise.baseRevenueBn=a.enterprise;
 d.parameters.externalTPU.baseRevenueBn=a.externalTPU;
 for(const c of ['Anthropic','OpenAI','otherAI']){
  d.parameters.customers[c].baseRevenueBn=a[c];
  d.parameters.customers[c].baseAverageAcceptedCapacityGW=a[c]/(92/90*.8*2.7);
 }
 const r=calculateCloudCase(d);
 return {id:a.id,baseCloudTotalBn:a.enterprise+a.externalTPU+a.Anthropic+a.OpenAI+a.otherAI,
 quarters:r.quarters.map(q=>({period:q.period,cloudRevenueBn:q.cloudRevenueBn,cashCapexBn:q.cashCapexBn})),
 annual:r.annual.map(q=>({period:q.period,cloudRevenueBn:q.cloudRevenueBn,cashCapexBn:q.cashCapexBn}))};
});
process.stdout.write(JSON.stringify({method:'官方基期Cloud总额固定，仅替换未披露的客户/硬件分摊并重算基期容量；未来各客户预算、交付、价格保持不变。不是概率区间或历史验证。',runs}));
"""
    proc=subprocess.run(['node','--input-type=module','-e',engine_code],cwd=ROOT,capture_output=True,text=True,encoding='utf-8',timeout=45)
    if proc.returncode:
        raise RuntimeError('Cloud engine allocation sensitivity failed: '+proc.stderr[:500])
    result['allocationSensitivity']=json.loads(proc.stdout)
    save_json(OUT/'allocation-sensitivity.json',result['allocationSensitivity'])
    save_json(ROOT/'assets/cloud-inputs.json',result)
    save_json(OUT/'input-validation.json',{'historicalQuarters':len(history),'secCapexMatches':sum(bool(x.get('secCashCapexMatch')) for x in history),
        'sources':len(sources),'parameterDefinitions':len(definitions),'noLookAheadChecks':backtest['noLookAheadChecks'],
        'baseCloudTotalBn':latest['cloudRevenueBn'],'msExcludedFromInputs':True})
    return {'historyQuarters':len(history),'sources':len(sources),'parameterDefinitions':len(definitions),'scores':backtest['scores'],
            'enterpriseGrowth':enterprise_growth,'totalExpansionIntensity':expansion_intensity}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fetch',action='store_true')
    parser.add_argument('--extract',action='store_true')
    parser.add_argument('--wind-query')
    parser.add_argument('--wind-name',default='openai-google')
    parser.add_argument('--build',action='store_true')
    args=parser.parse_args()
    OUT.mkdir(parents=True,exist_ok=True)
    if args.fetch:fetch_sources()
    if args.extract:extract_pdfs()
    if args.wind_query:
        key=read_wind_key(ROOT.parent/'API 整合.txt')
        print(json.dumps(fetch_wind(OUT,args.wind_name,'get_financial_news',args.wind_query,key),ensure_ascii=False))
    if args.build:print(json.dumps(make_inputs(),ensure_ascii=False))


if __name__=='__main__':main()
