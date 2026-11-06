"""Archive supplier contract evidence and build a conservative static comparison.

Public HTTP only unless a reviewer explicitly selects a Wind query. Credentials
are read into the subprocess environment and are never printed or persisted.
The builder distinguishes cloud services, equipment leases and investments.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
import json
from pathlib import Path
import re

from research_chain import ROOT, fetch_public, fetch_wind, read_wind_key

OUT = ROOT / 'outputs/research/raw_contracts'
CHAIN = ROOT / 'outputs/research/raw_chain'
PUBLIC = {
    'sec_avgo_submissions': 'https://data.sec.gov/submissions/CIK0001730168.json',
    'sec_googl_submissions': 'https://data.sec.gov/submissions/CIK0001652044.json',
    'sec_amzn_submissions': 'https://data.sec.gov/submissions/CIK0001018724.json',
    'sec_msft_submissions': 'https://data.sec.gov/submissions/CIK0000789019.json',
    'microsoft_anthropic_partnership': 'https://blogs.microsoft.com/blog/2025/11/18/microsoft-nvidia-and-anthropic-announce-strategic-partnerships/',
    'microsoft_sec_filings': 'https://www.microsoft.com/en-us/Investor/sec-filings',
}
WIND = {
    'wind_googl_revenue': '谷歌ALPHABET，Form10-Q，2026年10月29日，Quarterlyreport-20260930，RevenueRecognition，remainingperformanceobligations，GoogleCloud，客户集中度。仅该份公告原文。',
    'wind_googl_anthropic': '谷歌ALPHABET，Form10-Q，2026年10月29日，Quarterlyreport-20260930，Anthropic，租赁承诺，预付款，FinancialGuarantees，相关原文。仅该份公告。',
}

class Text(HTMLParser):
    def __init__(self):
        super().__init__(); self.skip = 0; self.parts = []
    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'): self.skip += 1
    def handle_endtag(self, tag):
        if tag in ('script', 'style'): self.skip = max(0, self.skip - 1)
    def handle_data(self, data):
        if not self.skip and data.strip(): self.parts.append(data.strip())

def text(path):
    parser = Text(); parser.feed(path.read_text(encoding='utf-8'))
    return '\n'.join(parser.parts)

def dump(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def wind_items(path):
    result = json.loads(path.read_text(encoding='utf-8'))
    for part in result.get('content', []):
        try: payload = json.loads(part.get('text', ''))
        except (ValueError, TypeError): continue
        for item in payload.get('data', {}).get('items', []): yield item

def build():
    """Build from archived responses; no network calls or credential access."""
    chain = json.loads((ROOT / 'assets/research-chain.json').read_text(encoding='utf-8'))
    inherited = {s['id']: s for s in chain['sources']}
    selected = [
        'chain-anthropic-google-20251023', 'chain-anthropic-google-20260406',
        'chain-anthropic-series-h-20260528', 'chain-anthropic-aws-20260420',
        'chain-anthropic-ms-nv-20251118', 'chain-broadcom-q3-20260902',
        'chain-amazon-10q-20261030', 'chain-msft-fy27q1-20261028',
        'chain-anthropic-contracts-news-20261026',
    ]
    sources = [dict(inherited[s]) for s in selected]
    source_text = {}
    for s in sources:
        p = ROOT / s['file']
        source_text[s['id']] = text(p) if p.suffix == '.html' else '\n'.join(x.get('content', '') for x in wind_items(p))
        s['sourceStrength'] = 'primary_company_disclosure' if s['kind'] in ('company_disclosure', 'official_results') else 'vendor_transcript' if s['kind'] == 'wind_transcript' else 'vendor_filing_excerpt' if s['kind'] == 'wind_filing_excerpt' else 'secondary_news_unverified_contract'
    def add_source(sid, name, title, date, page, strength, primary_url=None):
        raw = OUT / (name + '.json')
        item = next(wind_items(raw))
        assert item['date'] == date and ('10-Q' in item['title']), (name, item.get('title'))
        meta = json.loads((OUT / (name + '.meta.json')).read_text(encoding='utf-8'))
        source_text[sid] = item['content']
        excerpt = OUT / (name + '.item0.txt')
        excerpt.write_text(item['content'], encoding='utf-8')
        sources.append({'id': sid, 'title': title, 'date': date, 'file': str(raw.relative_to(ROOT)).replace('\\', '/'),
                        'textFile': str(excerpt.relative_to(ROOT)).replace('\\', '/'), 'url': item['url'],
                        'primaryUrl': primary_url, 'page': page, 'kind': 'wind_filing_excerpt', 'sourceStrength': strength,
                        'retrievedAt': meta['retrievedAt'], 'note': 'SEC目录确认申报日期与文件名；SEC正文HTTP403。此处使用Wind返回的英文披露段落，保留为转录证据，不声称独立核对完整原件。数据来源于万得Wind金融数据服务。'})
    av = 'contracts-avgo-10q-20260910'
    gr = 'contracts-googl-revenue-10q-20261029'
    gg = 'contracts-googl-guarantees-10q-20261029'
    ms = 'contracts-msft-10q-20261028'
    add_source(av, 'wind_avgo_contracts', 'Broadcom FY2026Q3 10-Q：设备融资、担保与集中度（Wind原文段落）', '2026-09-10', 'item0；p21 Financial Guarantee / Convertible Notes；p27客户集中度；AI XPV平台段', 'vendor_filing_excerpt', 'https://www.sec.gov/Archives/edgar/data/1730168/000173016826000080/avgo-20260802.htm')
    add_source(gr, 'wind_googl_revenue', 'Alphabet 2026Q3 10-Q：TPU产品销售、服务确认与收入积压（Wind原文段落）', '2026-10-29', 'item0；p11 Google Cloud及Multiple Performance Obligations；p13–14 Revenue Backlog / Deferred Revenues', 'vendor_filing_excerpt', 'https://www.sec.gov/Archives/edgar/data/1652044/000165204426000084/goog-20260930.htm')
    add_source(gg, 'wind_googl_anthropic', 'Alphabet 2026Q3 10-Q：TPU回购保证及租赁预付款（Wind原文段落）', '2026-10-29', 'item0；p24–25 Leases；p32–33 Financial Guarantees', 'vendor_filing_excerpt', 'https://www.sec.gov/Archives/edgar/data/1652044/000165204426000084/goog-20260930.htm')
    add_source(ms, 'wind_msft_contracts', 'Microsoft FY2027Q1 10-Q：RPO、递延收入及确认口径（Wind原文段落）', '2026-10-28', 'item0；Changes in unearned revenue及紧随其后的RPO段；p39收入判断；p44–45 AI投资风险', 'vendor_filing_excerpt', 'https://www.sec.gov/Archives/edgar/data/789019/000119312526436133/msft-20260930.htm')
    mb = 'contracts-msft-partnership-20251118'
    meta = json.loads((OUT / 'microsoft_anthropic_partnership.meta.json').read_text(encoding='utf-8'))
    assert meta['status'] == 200
    source_text[mb] = text(OUT / 'microsoft_anthropic_partnership.html')
    sources.append({'id': mb, 'title': 'Microsoft官方：Microsoft, NVIDIA and Anthropic announce strategic partnerships', 'date': '2025-11-18', 'file': 'outputs/research/raw_contracts/microsoft_anthropic_partnership.html', 'url': meta['url'], 'page': '正文Azure采购、1GW容量及投资段', 'kind': 'company_disclosure', 'sourceStrength': 'primary_company_disclosure', 'retrievedAt': meta['retrievedAt'], 'note': '供应商官方原文，独立复核Anthropic公告所述30bn Azure采购承诺；未披露逐季履约及付款表。'})
    known = {s['id']: s for s in sources}
    metrics = []
    def metric(mid, company, label, value, unit, sid, quote, period, contract=None, status='disclosed_aggregate', **extra):
        assert re.sub(r'\s+', '', quote) in re.sub(r'\s+', '', source_text[sid]), (mid, quote)
        if extra.get('bound'):
            extra['comparison'] = {'up_to':'≤','greater_than':'>','just_over':'略高于','approximately':'约'}[extra['bound']]
        if extra.get('notApplicableTo'):
            extra['notEquivalentTo'] = extra['notApplicableTo']
        notes = [extra.get('note'), extra.get('scope')]
        if 'customerAttribution' in extra and extra['customerAttribution'] is None:
            notes.append('公司聚合披露；未能单独归属于Anthropic。')
        if extra.get('notEquivalentTo'):
            notes.append('不可视为：' + extra['notEquivalentTo'])
        if any(notes): extra['note'] = '；'.join(n for n in notes if n)
        metrics.append({'id': mid, 'company': company, 'metric': label, 'value': value, 'unit': unit,
                        'period': period, 'status': status, 'publicationDate': known[sid]['date'],
                        'sourceRefs': [sid], 'sourceStrength': known[sid]['sourceStrength'], 'quote': quote,
                        'contractId': contract, 'inputEligible': False, **extra})
    gcap = 'anthropic-google-broadcom-tpu-2026'
    aws = 'anthropic-aws-expansion-2026'
    az = 'anthropic-azure-2025'
    blease = 'anthropic-broadcom-equipment-lease'
    xp = 'broadcom-xpv-initial-tranche-2026'
    gs = 'anthropic-google-services'
    sh = 'chain-anthropic-series-h-20260528'
    metric('contract-google-broadcom-gw', 'Anthropic / Google / Broadcom', 'Next-generation TPU capacity agreement', 5, 'GW', sh, 'with Google and Broadcom for five gigawatts of next-generation TPU capacity', '2027 onward', gcap, 'announced_capacity_not_accepted')
    metric('contract-aws-gw', 'Anthropic / AWS', 'New capacity upper bound', 5, 'GW', 'chain-anthropic-aws-20260420', 'up to 5 gigawatts (GW) of capacity', 'delivery schedule incomplete', aws, 'announced_capacity_not_accepted', bound='up_to')
    metric('contract-aws-spend', 'Anthropic / AWS', 'AWS technology commitment lower bound', 100000, 'USD mn', 'chain-anthropic-aws-20260420', 'more than $100 billion over the next ten years', 'ten years from 2026 agreement', aws, 'multi_year_commitment', bound='greater_than')
    metric('contract-azure-spend', 'Anthropic / Microsoft', 'Azure compute purchase commitment', 30000, 'USD mn', mb, '$30 billion of Azure compute capacity', 'duration not specified in announcement', az, 'multi_year_commitment')
    metric('contract-azure-gw', 'Anthropic / Microsoft', 'Additional capacity upper bound', 1, 'GW', mb, 'additional compute capacity up to one gigawatt', 'delivery schedule not disclosed', az, 'announced_capacity_not_accepted', bound='up_to')
    metric('contract-avgo-backstop-max', 'Broadcom', 'Maximum potential Backstop after full deployment', 29000, 'USD mn', av, 'approximately $29 billion', 'as of 2026-08-02; full deployment exposure', xp, 'contingent_maximum_not_cash_paid', bound='approximately')
    metric('contract-avgo-backstop-factor', 'Broadcom', 'Outstanding lease amount factor before asset recoveries', 0.85, 'fraction', av, '85% of the outstanding amounts owed', 'five-year lease terms', xp, 'contractual_contingent_formula')
    metric('contract-avgo-note-max', 'Broadcom', 'Conditional convertible note principal upper bound', 42000, 'USD mn', av, 'aggregate principal amount of $42 billion', 'as of 2026-08-02', xp, 'conditional_facility_not_issued', bound='up_to', note='客户可在条件满足且需要时向Broadcom发行可转票据，由客户融资，仅用于租赁义务；不是Broadcom发行42bn负债，截至8月2日未发行。')
    metric('contract-avgo-notes-issued', 'Broadcom', 'Convertible notes issued under disclosed arrangement', 0, 'USD mn', av, 'As of August 2, 2026, no notes have been issued to us.', '2026-08-02', xp, 'disclosed_actual')
    metric('contract-avgo-backstop-paid', 'Broadcom', 'Payments under Backstop', 0, 'USD mn', av, 'No amounts have been paid under the Backstop.', '2026-08-02', xp, 'disclosed_actual')
    metric('contract-avgo-xpv-tranche', 'Broadcom', 'Initial third-party financed XPV tranche', 35000, 'USD mn', av, 'an initial tranche of $35 billion', 'June 2026', xp, 'financing_tranche_not_broadcom_revenue')
    metric('contract-avgo-distributor-concentration', 'Broadcom', 'One direct distributor share of company revenue', .50, 'fraction', av, 'accounted for 50% and 46% of our net revenue', 'FY2026Q3 ending 2026-08-02', status='disclosed_aggregate', scope='single unnamed distributor, not end customer')
    metric('contract-avgo-topfive-concentration', 'Broadcom', 'Top five end customers share of company revenue', .55, 'fraction', av, 'approximately 55% and 50% of our net revenue', 'FY2026Q3 ending 2026-08-02', status='disclosed_aggregate', bound='approximately', scope='five unnamed end customers across all channels')
    metric('contract-googl-tpu-repurchase-guarantee', 'Alphabet', 'Maximum potential TPU repurchase guarantee payments', 6600, 'USD mn', gg, 'maximum potential future payments under these guarantees were $6.6 billion', '2026-09-30', status='contingent_maximum_not_cash_paid', customerAttribution=None)
    metric('contract-googl-cloud-rpo', 'Alphabet / Google Cloud', 'Google Cloud remaining performance obligations', 560800, 'USD mn', gr, '$560.8 billion related to Google Cloud', '2026-09-30', status='disclosed_aggregate', customerAttribution=None)
    metric('contract-googl-total-rpo', 'Alphabet', 'Company remaining performance obligations', 567700, 'USD mn', gr, '$567.7 billion of remaining performance obligations', '2026-09-30', status='disclosed_aggregate')
    metric('contract-googl-total-rpo-24m', 'Alphabet', 'Company RPO expected recognition fraction over next 24 months', .55, 'fraction', gr, 'just over 55% of the revenue backlog as revenues over the next 24 months', '24 months after 2026-09-30', status='company_expectation_aggregate', bound='just_over', notApplicableTo='Anthropic-specific schedule or any single quarter')
    metric('contract-googl-uncommenced-lease-prepay-q3', 'Alphabet', 'Prepayments for leases not yet commenced', 159, 'USD mn', gg, '$159 million and $994 million of lease prepayments for leases not yet commenced', '2026Q3', status='disclosed_aggregate', customerAttribution=None)
    metric('contract-googl-uncommenced-lease-prepay-ytd', 'Alphabet', 'Prepayments for leases not yet commenced', 994, 'USD mn', gg, '$159 million and $994 million of lease prepayments for leases not yet commenced', '2026 nine months', status='disclosed_aggregate', customerAttribution=None)
    metric('contract-aws-rpo', 'Amazon / AWS', 'Long-term customer commitments primarily related to AWS', 578000, 'USD mn', 'chain-amazon-10q-20261030', 'approximately $578 billion as of September 30, 2026', '2026-09-30', status='disclosed_aggregate', customerAttribution=None, originalTermFilter='exceeds one year')
    metric('contract-msft-commercial-rpo', 'Microsoft', 'Commercial remaining performance obligations', 677000, 'USD mn', 'chain-msft-fy27q1-20261028', 'Commercial remaining performance obligation increased 73% to $677 billion', '2026-09-30', status='disclosed_aggregate', notEquivalentTo='Azure-only or Anthropic-only RPO')
    metric('contract-msft-total-rpo', 'Microsoft', 'Total company remaining performance obligations', 683000, 'USD mn', ms, 'was $683billion as of September 30, 2026', '2026-09-30', status='disclosed_aggregate')
    metric('contract-msft-rpo-12m', 'Microsoft', 'Total and commercial RPO expected recognition fraction in next 12 months', .30, 'fraction', ms, 'approximately30% of both our total company remaining performance obligation revenue and commercial remaining performance obligation revenue over the next12months', '12 months after 2026-09-30', status='company_expectation_aggregate', bound='approximately', notApplicableTo='Anthropic-specific schedule or any single quarter')
    cards = []
    def card(cid, company, relationship, claim, implication, refs, limits, factors, contracts=(), periods=('2026Q4','2027FY')):
        levels = {known[r]['sourceStrength'] for r in refs}
        if levels == {'primary_company_disclosure'}:
            strength = '直接取得公司公告原文；具体合同及逐季交付仍待核'
        elif levels == {'vendor_filing_excerpt'}:
            strength = 'Wind监管披露英文摘录；SEC完整原件未核对'
        elif levels <= {'vendor_filing_excerpt','vendor_transcript'}:
            strength = 'Wind监管披露摘录及电话会转录；完整原件未核对'
        else:
            strength = '公司公告原文与Wind监管披露摘录交叉对照；完整合同未核对'
        cards.append({'id': cid, 'company': company, 'relationship': relationship, 'claim': claim, 'implication': implication,
                      'sourceRefs': refs, 'limitations': limits, 'factors': factors, 'strength': strength,
                      'publicationDate': max(known[r]['date'] for r in refs), 'applicablePeriods': list(periods),
                      'contractIds': list(contracts), 'contractId': contracts[0] if len(contracts)==1 else None})
    card('contracts-tpu-accounting', 'Alphabet / Google Cloud', 'TPU硬件与云服务的收入确认边界',
         'Alphabet Q3 10-Q的Wind英文段落明确：Cloud包括TPU系统销售。按用量云服务随客户消耗确认，订阅服务按合同期确认；TPU硬件/软件通常在控制权转移时确认并扣预期退货，安装、支持与延保按服务期或履约确认。部分回购权按退货权处理，转让设备后仍保留回购要求的安排按金融担保处理。',
         '外售TPU不能统一当作按GW按月收费的云服务，也不能把多年合同全额落入交付季度。先按合同分配硬件、软件及服务履约义务，再验证控制权、验收和回购条款；这为核对Barclays External TPU Sales行提供会计边界。', [gr,gg],
         ['已取得的是Wind监管披露转录；SEC正文访问403。','政策适用于Alphabet相关业务，未披露Anthropic每份合同的履约义务分摊和单价。','截至9月末TPU回购担保最大潜在付款6.6bn，非已付款、收入冲减或Anthropic专属金额。'],
         ['收入确认节奏','Cloud收入增速','基准已含收入','付款与融资'], [gcap,gs,blease])
    card('contracts-tpu-capacity-dedup', 'Anthropic / Google / Broadcom', '统一容量台账与交付边界',
         'Anthropic 4月公告称新增多GW TPU容量从2027年开始上线；5月公告将Google与Broadcom联合协议明确为5GW。这是一组联合容量，Google与Broadcom不能各计5GW。2025年10月另有2026年上线超过1GW的计划，但截至研究日未取得对应逐季验收表。',
         '台账以统一contractId记录5GW；设备融资、芯片交付与Google服务采购作为不同金额口径附属记录。2026Q4及2027各季可计费容量仍为null，不把宣布容量全部转换为收入。',
         ['chain-anthropic-google-20251023','chain-anthropic-google-20260406',sh],
         ['多次公告为同一协议的更新，不构成多个订单。','缺少2025扩容与2026联合协议逐批对应表，暂不合计为6GW或更高。','芯片生产出货不证明数据中心已通电、验收或开始计费。'],
         ['可交付容量','Google份额','收入确认节奏','基准已含收入'], [gcap])
    card('contracts-avgo-financing', 'Broadcom / Anthropic', '第三方设备融资及Broadcom或有支持',
         'Broadcom截至8月2日10-Q转录披露：首批XPV融资35bn、超过1GW、五年租期；交付扩大租赁Backstop，付款使其下降。客户违约时责任按85%未偿担保租赁金额减设备处置回收值计，全部设备部署后最大潜在责任约29bn。另允许客户在条件满足且需要时向Broadcom发行最多42bn可转票据，仅用于客户租赁义务，并非Broadcom发行债务；截至8月2日没有发行票据或支付Backstop。',
         '第三方融资能缓解客户前期现金压力，但不能把融资额或担保上限当作芯片收入、Google Cloud收入或已到账现金。应同时监控设备交付、客户租金付款、残值和或有负债；“第三方出资”不等于Broadcom没有信用敞口。',
         [av,'chain-broadcom-q3-20260902'],
         ['10-Q相关段落称匿名customer；9月2日电话会转录才将35bn首批/1GW部署指向Anthropic，身份映射强于单一匿名段但仍应取得完整协议核对。','不能把29bn与42bn相加成已发生损失；两者触发条件和抵偿关系未完整展开。','新闻所称161.2bn五年租赁总额未取得客户原文，不以35bn首批替代或相加。'],
         ['付款与融资','可交付容量','客户支付能力','收入确认节奏'], [xp,blease,gcap])
    card('contracts-avgo-concentration', 'Broadcom', '分销商与终端客户集中度分开',
         'Broadcom FY2026Q3 10-Q转录披露：单一直接分销商占季度公司收入50%，前三财季46%；前五终端客户经全部渠道合计占季度公司收入约55%、前三财季50%。',
         '集中度增加交付节奏、信用和需求波动敏感性，但分销商不是最终客户。不能把50%写成Google/Anthropic采购占比，也不能据前五客户合计反推单一客户份额。', [av],
         ['分母为Broadcom公司净收入，非AI收入或Google Cloud收入。','没有披露本段各终端客户名称与份额；Google、Anthropic单独份额保持null。'],
         ['Google份额','客户采购','客户支付能力'])
    card('contracts-aws-recognition', 'Amazon / AWS / Anthropic', 'AWS十年承诺与履约、付款区分',
         'Anthropic官方公告为十年超过100bn的AWS技术采购承诺及最多5GW新增容量，2026年末接近1GW是交付计划。Amazon Q3 10-Q转录再次确认该扩展，并说明长期承诺收入取决于客户使用与AWS履约。预收款先记unearned revenue，在服务期间确认。',
         'AWS承诺是客户多云分配约束；不能拿其金额计算Google份额，也不能均摊为每年10bn或每季2.5bn实际收入。客户应付/预付计划与芯片性能义务需要单独核对。',
         ['chain-anthropic-aws-20260420','chain-amazon-10q-20261030'],
         ['5GW与此前扩展的精确重叠和逐批上线缺少完整表。','Amazon新增5bn及未来最多20bn股权投资与客户采购不同，不相互抵销成净采购。','AWS聚合RPO578bn及总预收款不能归给Anthropic。'],
         ['Google份额','付款与融资','可交付容量','收入确认节奏'], [aws])
    card('contracts-azure-recognition', 'Microsoft / Anthropic', 'Azure采购与聚合RPO边界',
         'Microsoft供应商官方公告直接确认Anthropic采购30bn Azure算力并另签最多1GW容量；微软最多5bn股权投资另列。FY27Q1官方业绩披露商业RPO677bn；10-Q转录称公司总RPO683bn、商业平均期限约2.3年，约30%在随后12个月确认。',
         'Azure是Anthropic算力替代来源，但商业RPO包含Microsoft 365等多项业务，不能当Azure或Anthropic订单。30%也不能直接作为单一客户或单季兑现率。',
         [mb,'chain-msft-fy27q1-20261028',ms],
         ['公开合作公告未给付款、取消、逐季交付或验收计划。','新闻所称44.9bn与2025公告30bn可能是后续变化，未取得原合同前不互相替代、不叠加。','最多1GW不能全部映射Google或再计为NVIDIA另一份云容量订单。'],
         ['Google份额','可交付容量','收入确认节奏','付款与融资'], [az])
    card('contracts-google-backlog', 'Alphabet / Google Cloud', '收入积压、预收与公司自身租赁付款',
         'Q3 10-Q转录披露Google Cloud RPO560.8bn，公司总RPO567.7bn；预计总额略高于55%在未来24个月确认。2026Q1起RPO纳入原期限不超过一年的合同。公司Q3另付159m未起租预付款、前九月994m，属于Alphabet自身设施租赁支出。',
         'Google、AWS和微软RPO定义及期限不同，不能直接比较数字大小推导客户份额。Google自身付给设施出租方的预付款，与Anthropic向Google支付的服务预付款是相反现金方向；后者尚无可核实金额。', [gr,gg],
         ['上述RPO及租赁金额均非Anthropic专属。','55%以上是全公司24个月确认预期，不能乘Anthropic合同或均摊到季度。','新旧RPO同比比较需检查一年以下合同纳入的口径改变。'],
         ['收入确认节奏','付款与融资','基准已含收入','客户支付能力'], [gs])
    news = 'chain-anthropic-contracts-news-20261026'
    contracts = [
        {'id':gcap,'title':'Google / Broadcom联合TPU容量','parties':['Anthropic','Google','Broadcom'],'scope':'joint_capacity','value':5,'amount':None,'unit':'GW','delivery':'2027年起上线；逐季验收与计费容量待核','recognition':'容量本身不是收入；按硬件/服务合同分别确认','payment':'联合容量公告没有付款表','overlap':'同一5GW仅记一次；2025年超过1GW计划与本批对应关系未取得','sourceRefs':['chain-anthropic-google-20260406',sh],'quarterlyAcceptedGW':None,'googleRecognizedRevenue':None},
        {'id':gs,'title':'Anthropic向Google采购服务','parties':['Anthropic','Google'],'scope':'cloud_services','value':None,'amount':None,'reportedAmount':114500,'unit':'USD mn','reportedPeriod':'2026-04至2033-07','delivery':'缺季度服务履约表','recognition':'按使用量或订阅期间；实际合同分拆未核实','payment':'新闻称最低采购及补差；原合同付款/预付/终止条款未核实','overlap':'与联合TPU容量有关联可能；不叠加成另一份容量，不能等同Broadcom设备租赁','sourceRefs':[news,gr],'sourceStrength':'secondary_news_amount_unverified','quarterlyPayment':None,'prepayment':None,'cancelability':None},
        {'id':blease,'title':'Anthropic TPU设备融资租赁','parties':['Anthropic','Broadcom','financing counterparties'],'scope':'equipment_finance_lease','value':None,'amount':None,'reportedAmount':161200,'unit':'USD mn','reportedPeriod':'五年；新闻金额不含利息','delivery':'新闻称部分2026上线、更多2027起；逐批对应未核实','recognition':'租赁付款不是Google云服务收入；供应链各层确认另核','payment':'客户租金与第三方设备融资分开；总额原文待核','overlap':'与联合5GW及XPV融资可能重叠；35bn首批不再与总租金合计','sourceRefs':[news,av,'chain-broadcom-q3-20260902'],'sourceStrength':'secondary_news_amount_unverified','quarterlyPayment':None},
        {'id':xp,'title':'Broadcom XPV首批设备融资与Backstop','parties':['Broadcom','third-party financial partner','unnamed customer in 10-Q'],'scope':'third_party_financing_and_contingent_support','value':35000,'amount':35000,'unit':'USD mn','delivery':'2026年6月首批，覆盖超过1GW；担保随交付增加','recognition':'融资额、最大潜在担保与设备营业收入分别记录','payment':'五年客户租赁；最高29bn潜在Backstop；客户可有条件向Broadcom发行最多42bn票据，8月2日未支付Backstop亦未发行票据','overlap':'与设备租赁关联；电话会转录命名Anthropic，不能新增一份1GW总容量','sourceRefs':[av,'chain-broadcom-q3-20260902'],'maxBackstopUSDmn':29000,'conditionalNoteUSDmn':42000},
        {'id':aws,'title':'Anthropic AWS技术采购扩展','parties':['Anthropic','AWS'],'scope':'cloud_technology_services','value':100000,'amount':100000,'bound':'greater_than','unit':'USD mn','delivery':'最多5GW，接近1GW计划2026年底上线；验收表未取得','recognition':'按使用及AWS履约，不能等额分摊十年','payment':'十年采购承诺；预付款与实际支付未披露','overlap':'官方>100bn与新闻110bn可能同一扩展不同版本，不相加','sourceRefs':['chain-anthropic-aws-20260420','chain-amazon-10q-20261030'],'quarterlyPayment':None,'prepayment':None},
        {'id':az,'title':'Anthropic Azure采购与额外容量','parties':['Anthropic','Microsoft Azure'],'scope':'cloud_compute_services','value':30000,'amount':30000,'unit':'USD mn','delivery':'额外最多1GW；逐季时间表未披露','recognition':'收入须服务履约；不能套全公司RPO确认比例','payment':'公告未披露支付期或预付款','overlap':'2025公告30bn与新闻后续44.9bn不相加；NVIDIA硬件/投资另列但不新增重复GW','sourceRefs':[mb,'chain-anthropic-ms-nv-20251118'],'quarterlyPayment':None,'prepayment':None},
    ]
    gaps = [
        {'id':'contracts-gap-quarterly-acceptance','company':'Anthropic / Google / Broadcom','field':'accepted_billable_capacity_by_quarter','value':None,'needed':'2026Q4及2027逐季交付、通电验收、计费开始日、容量重叠表','why':'公告容量及芯片出货不能直接转收入','contractIds':[gcap,blease],'sourceRefs':['chain-anthropic-google-20260406',sh]},
        {'id':'contracts-gap-payment','company':'Anthropic / Google','field':'payment_prepayment_and_minimum_spend_schedule','value':None,'needed':'Google服务合同全文、预付款/应付/最低消费/补差/终止和履约条件','why':'114.5bn仍只有新闻线索；财务模型不得把null当零','contractIds':[gs],'sourceRefs':[news]},
        {'id':'contracts-gap-attribution','company':'Google / Broadcom','field':'customer_contract_split_and_baseline_inclusion','value':None,'needed':'同一TPU批次的设备租赁、Google硬件销售、云服务金额分配及MS基准已含收入','why':'防止同一经济活动跨供应链重复计入Google收入','contractIds':[gcap,gs,blease,xp],'sourceRefs':[gr,av]},
        {'id':'contracts-gap-customer-share','company':'Alphabet / Broadcom / Amazon / Microsoft','field':'anthropic_specific_customer_revenue_or_rpo_share','value':None,'needed':'供应商按Anthropic实名披露的收入、RPO、应收/预收和客户份额','why':'聚合RPO、匿名终端客户与分销商集中度不能替代单一客户数据','sourceRefs':[gr,av,ms,'chain-amazon-10q-20261030']},
        {'id':'contracts-gap-primary-filing','company':'Alphabet / Broadcom / Amazon / Microsoft','field':'full_original_contract_or_regulatory_filing','value':None,'needed':'可合法取得的完整原始10-Q及相关合同附件；现有SEC目录成功、正文403','why':'Wind英文转录可检查原句，但不是已核对完整原件','sourceRefs':[gr,av,ms,'chain-amazon-10q-20261030']},
    ]
    for obj in cards + metrics + contracts + gaps:
        assert set(obj['sourceRefs']) <= set(known)
    assert len({x['id'] for x in contracts}) == len(contracts)
    assert all(x['publicationDate'] <= '2026-11-05' for x in metrics + cards)
    result = {'asOf':'2026-11-05','scope':'Anthropic客户与Google/Broadcom/AWS/Azure合同、容量、收入确认和资金边界；新增原文优先，Wind保留转录级别。',
              'sources':sources,'crossCompanyEvidence':cards,'evidenceMetrics':metrics,'contracts':contracts,'materialGaps':gaps,
              'supersedesMetrics':[{'id':'anthropic-google-capacity','replacementId':'contract-google-broadcom-gw'},{'id':'anthropic-aws-budget','replacementId':'contract-aws-spend'}],
              'verification':{'metricQuoteAssertions':len(metrics),'sourceIdsResolve':True,'joint5GWCount':1,'sourceDatesWithinCutoff':True,'missingQuarterlyInputsAreNull':True,'secIndexRequests':'4成功','secBodyRequests':'5次403，未绕过','sameFilingDifferentQueriesNotIndependentEvidence':True},
              'limitations':['多次官方公告可能为同一合同版本更新，不能按新闻条数累加采购。','Google/Broadcom联合5GW、设备租赁、XPV融资和Google服务合同不能在同一口径相加。','本次未执行交易，未将任何合同金额自动应用到EPS；金额、容量、现金流和确认收入分别保留。']}
    dump(ROOT/'assets/research-contracts.json',result)
    dump(OUT/'validation.json',result['verification'])
    print(json.dumps({'sources':len(sources),'cards':len(cards),'metrics':len(metrics),'contracts':len(contracts),'gaps':len(gaps)}))

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fetch', nargs='*')
    parser.add_argument('--url')
    parser.add_argument('--name', default='extra')
    parser.add_argument('--wind-query')
    parser.add_argument('--wind-names', nargs='*')
    parser.add_argument('--build', action='store_true')
    args = parser.parse_args(); OUT.mkdir(parents=True, exist_ok=True)
    if args.url: print(json.dumps(fetch_public(OUT, args.name, args.url)))
    if args.fetch is not None:
        names = args.fetch or list(PUBLIC)
        with ThreadPoolExecutor(max_workers=4) as pool:
            for result in pool.map(lambda name: fetch_public(OUT, name, PUBLIC[name]), names): print(json.dumps(result))
    if args.wind_query:
        key = read_wind_key(ROOT.parent / 'API 整合.txt')
        print(json.dumps(fetch_wind(OUT, args.name, 'get_company_announcements', args.wind_query, key)))
    if args.wind_names is not None:
        key = read_wind_key(ROOT.parent / 'API 整合.txt')
        names = args.wind_names or list(WIND)
        with ThreadPoolExecutor(max_workers=3) as pool:
            for result in pool.map(lambda name: fetch_wind(OUT, name, 'get_company_announcements', WIND[name], key), names): print(json.dumps(result))
    if args.build: build()

if __name__ == '__main__': main()
