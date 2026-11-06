"""Read-only report search and dated online evidence collection for customer budgets."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from io import BytesIO
import argparse, hashlib, json, re, zipfile
import fitz
from research_chain import read_wind_key, fetch_wind

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'outputs/research/customer_evidence_20261106'
OUT.mkdir(parents=True,exist_ok=True)
def dump(name,value):
    (OUT/name).write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')

QUERIES={
 'anthropic_note8':('get_company_announcements','Anthropic2026-10-26FormS-1，Note8，SupplementalOperatingExpenseInformation，功能分类费用表，2023、2024、2025、2025H1、2026H1的Costofrevenue与Researchanddevelopment，请返回原始英文表格数值和页码，别用总算力费用替代。'),
 'anthropic_relatedparties':('get_company_announcements','Anthropic2026-10-26FormS-1，RelatedPartyTransactions，GoogleLLC、AmazonWebServices，2024和2025及2026H1，采购费用、computeandinfrastructureexpenses、最低承诺，与云渠道销售及分销费分开，返回原始英文段落和表格。'),
 'openai_reuters_cost':('get_financial_news','Reuters2025年11月OpenAIinferencecostsgrossmargin2024年2025年TheInformation，或者2026年FinancialTimes审计财务，查原文报道，返回文章链接和发布日期。'),
 'anthropic_reuters_channels':('get_financial_news','Reuters2026-09-29AnthropicIPO2025revenueAmazonGooglecloud47%distributionfees351million原始报道及网址。'),
 'anthropic_cost_history':('get_financial_news','截至2026年11月5日，Anthropic历年2023至2026收入、推理成本、训练成本、毛利率，查找Reuters、FinancialTimes、TheInformation引用投资者财务资料的原始报道，给出日期、URL、实际与预测的区别，不根据收入自行推算费用。'),
 'openai_cost_history':('get_financial_news','截至2026年11月5日，OpenAI在2024、2025年的推理支出、训练支出、收入和毛利率，查找Reuters或TheInformation的财务报道，区分实际费用和当时预测，返回原文及网址。'),
 'anthropic_google_share':('get_financial_news','Anthropic向Google、AWS、Microsoft支付的历史算力采购金额或供应商支出占比，2024至2026，区分实际付款、费用和未来多年承诺，提供原始出处和日期，无披露请明确。'),
 'openai_google_share':('get_financial_news','OpenAI与GoogleCloud在2025、2026合作的采购金额、实际费用、使用比例、训练或推理用途，Reuters与TheInformation报道原文和发布日期。'),
 'anthropic_financial_tables':('get_company_announcements','Anthropic2026年S-1及S-1/A，2024年、2025年及2026年前九个月收入、computeandinfrastructure费用、推理成本和训练成本、Google相关方采购费用，提供原始表格、会计定义和原始文件URL及页码，不补造未披露拆分。'),
 'anthropic_aws_primary':('get_company_announcements','Amazon与Anthropic合作公告，AWSprimarycloudprovider和primarytrainingpartner的定义、Trainium容量、采购金额，2024至2026原始公告和日期；是否披露AWS占Anthropic算力支出比例。'),
}

def online(names=None):
    secret=read_wind_key(ROOT.parent/'API 整合.txt')
    selected={k:v for k,v in QUERIES.items() if not names or k in names}
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures={pool.submit(fetch_wind,OUT,k,tool,q,secret):k for k,(tool,q) in selected.items()}
        for f in as_completed(futures):print(json.dumps(f.result(),ensure_ascii=False),flush=True)

def local():
    inv=json.loads((ROOT/'outputs/research/local_reports/inventory.json').read_text(encoding='utf-8'))
    unique={e['sha256']:e for e in inv['entries'] if e.get('extension')=='.pdf'}
    by_archive={}
    for e in unique.values():by_archive.setdefault(e['archive'],[]).append(e)
    clients=re.compile(r'Anthropic|Claude|Open\s?AI|ChatGPT',re.I)
    costs=re.compile(r'inferen|train(?:ing)?|gross.margin|cost.of.revenue|cost.of.goods|compute.cost|cloud.cost|cloud.spend|cash.burn|推理|训练|毛利|算力成本|采购',re.I)
    hits=[];errors=[];pages=0;scanned=0
    for archive,entries in by_archive.items():
        with zipfile.ZipFile(archive) as z:
            for e in entries:
                try:
                    payload=z.read(e['member'])
                    with fitz.open(stream=payload,filetype='pdf') as doc:
                        scanned+=1;pages+=len(doc)
                        for i,p in enumerate(doc):
                            t=p.get_text('text')
                            if not clients.search(t):continue
                            contexts=[]
                            for m in clients.finditer(t):
                                c=t[max(0,m.start()-600):m.end()+1400]
                                if costs.search(c):contexts.append(c)
                            if contexts:
                                hits.append({'id':e['id'],'archive':archive,'member':e['member'],'page':i+1,'sha256':e['sha256'],'text':t,'contexts':contexts,'score':len(costs.findall(' '.join(contexts)))})
                except Exception as exc:errors.append({'id':e['id'],'type':type(exc).__name__})
        print(json.dumps({'scannedPDFs':scanned,'pages':pages,'hitPages':len(hits)},ensure_ascii=False),flush=True)
    dump('local-search.json',{'searchedAt':datetime.now(timezone.utc).isoformat(),'uniquePDFs':len(unique),'scannedPDFs':scanned,'pages':pages,'errors':errors,'hits':hits})
    ranked=sorted(hits,key=lambda x:x['score'],reverse=True)
    dump('local-ranked.json',[{k:r[k] for k in ['id','member','page','score','contexts']} for r in ranked])
    print(json.dumps({'finished':True,'scannedPDFs':scanned,'pages':pages,'hitPages':len(hits),'documents':len({x['id'] for x in hits}),'errors':errors},ensure_ascii=False),flush=True)

if __name__=='__main__':
    a=argparse.ArgumentParser();a.add_argument('mode',choices=['local','online']);a.add_argument('--only',nargs='*');args=a.parse_args()
    if args.mode=='local':local()
    else:online(args.only)
