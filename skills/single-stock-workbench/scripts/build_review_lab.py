"""Curate dated evidence and forecast vintages. No private transcript or original reports in output."""
from pathlib import Path
import json,calendar,datetime,re
ROOT=Path(__file__).resolve().parents[1]
def read(p):return json.loads((ROOT/p).read_text(encoding='utf-8'))
def main():
    research=read('assets/research.json');events=read('assets/review-events.json');snapshot=read('assets/v9-snapshot.json');market=read('assets/market-update.json')
    dates=sorted(set(snapshot['DATA']['d']+[x['date'] for x in market['series']['GOOGL']]))
    def conservative(date):
        if len(date)==7:
            y,m=map(int,date.split('-'));date+=f'-{calendar.monthrange(y,m)[1]}'
        return next((d for d in dates if d>date),'9999-12-31')
    out={'asOf':'2026-11-06','marketAsOf':market['asOf'],'forecasts':[],'events':[],'drivers':[],
         'limitations':['已审阅材料的检索实验，不是全研报库盲测；样本首次出现不代表行业首次出现。','历史EPS仅为同一家机构固定财年的两个版本，不代表一致预期或完整预测修订路径。','日期无精确发布时间时保守从下一交易日生效；月份日期用月末后下一交易日。','宏观历史为本次获取的修订后观测，描述性分析，不模拟当时可交易信息。','旧行情来自原Demo，2026-09起三条行情已另行核验；分析注明范围。']}
    for key,date in [('MS_20260824','2026-08-24'),('MS_20261029','2026-10-29')]:
        audit=read(f'outputs/research/profit_driver_audit/{key}.json');s=audit['sheets']['Model']
        assert s['ER5']['value']==46752
        out['forecasts'].append({'id':key+'-2027','broker':'Morgan Stanley','publicationDate':date,'effectiveDate':conservative(date),'period':'2027','basis':'GAAP diluted EPS, source model annual','eps':s['ER90']['value'],'source':'Model!ER5 / ER90','sha256':audit['sha256'],'status':'卖方模型缓存；非市场共识'})
    sourceMap={s['id']:s for s in research.get('sources',[])+events['sources']}
    for e in events['events']:
        if e['id']=='oct13-baseline':continue
        refs=[sourceMap[x] for x in e.get('sourceRefs',[]) if x in sourceMap]
        referenceDates=[s.get('date') or s.get('publicationDate') for s in refs]
        knownDates=[d for d in referenceDates if isinstance(d,str) and re.fullmatch(r'\d{4}-\d{2}(?:-\d{2})?',d)]
        effective=max([conservative(e['date'])]+[conservative(d) for d in knownDates])
        out['events'].append({'id':e['id'],'date':e['date'],'effectiveDate':effective,'title':e['title'],'information':e.get('newInformation',''),'expectation':e.get('expectationChange',''),'laterView':e.get('brokerResponses',[]),'sources':[{'id':s['id'],'title':s.get('title'),'date':s.get('date'),'url':s.get('url'),'page':s.get('page'),'kind':s.get('kind')} for s in refs],'dateBasis':'合并摘要按事件与所引来源最晚日期之后交易日生效，避免将后来解释前移'})
    for i,b in enumerate(events['brokerComparisons']):
        out['events'].append({'id':f'broker-{i}','date':b['date'],'effectiveDate':conservative(b['date']),'title':b['broker']+' · 目标价/观点修订','information':b['view'],'expectation':b.get('earningsRevision',''),'laterView':[b.get('caveat','')],'oldTarget':b.get('oldTarget'),'newTarget':b.get('newTarget'),'sources':[{'id':s,'title':sourceMap.get(s,{}).get('title'),'url':sourceMap.get(s,{}).get('url'),'kind':sourceMap.get(s,{}).get('kind')} for s in b.get('sourceRefs',[])]})
    # Transparent retrieval baseline, followed by human review; not an autonomous model update.
    definitions=[('cloud_mix','Cloud AI / TPU收入结构',r'TPU|Cloud|GCP|云','收入 / 业务结构','四块Cloud收入、客户交付与确认；采购份额仍需合同证据'),('gross_margin','直接成本与业务毛利',r'毛利|采购成本|third.party|第三方算力|margin|成本率','营业成本','业务直接成本率；辨别毛利率与营业利润率'),('depreciation','资产与折旧',r'折旧|D&A|depreciation|useful life','营业成本 / 研发','资产规模、使用年限、COGS/R&D分配'),('sbc','SBC及调整后盈利',r'SBC|stock.based|股份支付','费用 / 税 / EPS','SBC与税效应；不能直接当现金成本'),('search','搜索变现',r'搜索|Search|广告','收入 / TAC','搜索收入与分销TAC；流量与价格证据'),('cash_return','现金回收与资本回报',r'现金流|FCF|ROIC|资本回报','现金流约束','作为研究约束，不恢复独立Capex展示')]
    corpus=[]
    for card in research.get('crossCompanyEvidence',[]):
        text=' '.join(str(card.get(k,'')) for k in ['company','claim'])
        if not re.search(r'Google|Alphabet|GOOGL|Cloud|谷歌',text,re.I):continue
        cardDates=[sourceMap.get(ref,{}).get('date') or sourceMap.get(ref,{}).get('publicationDate') for ref in card.get('sourceRefs',[])]
        cardDates=[d for d in cardDates if isinstance(d,str) and re.fullmatch(r'\d{4}-\d{2}(?:-\d{2})?',d)]
        for ref in card.get('sourceRefs',[]):
            s=sourceMap.get(ref,{});date=s.get('date') or s.get('publicationDate')
            if not isinstance(date,str) or not re.fullmatch(r'\d{4}-\d{2}(?:-\d{2})?',date):continue
            if not re.search(r'broker|sell.side|analyst',s.get('kind','')):continue
            textDate=max(cardDates) if cardDates else date
            corpus.append({'sourceId':ref,'date':textDate,'publicationDate':date,'effectiveDate':conservative(textDate),'title':s.get('title',ref),'kind':s.get('kind','未分类'),'page':s.get('page') or s.get('cells'),'excerpt':text[:900],'interpretation':card.get('implication','')[:600]})
    for b in events['brokerComparisons']:
        for ref in b.get('sourceRefs',[]):
            s=sourceMap.get(ref,{})
            corpus.append({'sourceId':ref+'-'+b['broker'],'date':b['date'],'effectiveDate':conservative(b['date']),'title':b['broker']+' · '+s.get('title',ref),'kind':s.get('kind','媒体转述机构'),'page':s.get('page'),'excerpt':b['view']+' '+b.get('earningsRevision',''),'interpretation':b.get('caveat','')})
    for id,label,pattern,channel,parameter in definitions:
        hits={}
        for c in corpus:
            if re.search(pattern,c['excerpt'],re.I):hits.setdefault(c['sourceId'],c)
        matched=sorted(hits.values(),key=lambda x:x['effectiveDate'])
        assessments={'cloud_mix':'可保留：TPU硬件和持续云服务的收入、成本与估值应区分；不能把所有GCP都当AI。','gross_margin':'可保留成本拆分议题；来源是费用/营业利润，不能直接给出毛利率。','depreciation':'可保留：财报后GS观点直接讨论折旧费用；不据此确定真实资产年限。','sbc':'漏项：研报摘录样本未命中，但MS模型存在SBC盈利桥；需补充相关研究材料。','search':'可保留：搜索变现与预期差出现在财报后机构观点中；缺量价拆分数据。','cash_return':'可保留为现金回收约束；资本开支和现金流不是当期费用，不能直接减EPS。'}
        out['drivers'].append({'id':id,'label':label,'channel':channel,'parameter':parameter,'evidence':matched,'firstInSample':matched[0]['date'] if matched else None,'referenceRequired':id in ['cloud_mix','gross_margin','depreciation','sbc'],'status':'候选待人工复核' if matched else '参考因子未检索到：不能视为不重要','analystAssessment':assessments[id]})
    out['experiment']={'method':'基于已审阅摘录的规则检索基线 + 人工解释，不是盲测或全量自动理解','reference':['cloud_mix','gross_margin','depreciation','sbc'],'referenceCovered':sum(x['referenceRequired'] and bool(x['evidence']) for x in out['drivers']),'corpusCards':len(corpus),'distinctSources':len(set(x['sourceId'] for x in corpus)),'automaticModelMutation':False}
    (ROOT/'assets/review-lab.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'events':len(out['events']),'forecastVintages':len(out['forecasts']),'experiment':out['experiment']},ensure_ascii=False))
if __name__=='__main__':main()
