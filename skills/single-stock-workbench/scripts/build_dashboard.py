"""Build a portable, offline HTML research workbench from a case snapshot."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import sys
import copy
import datetime as dt
import subprocess
import tempfile


def _json(path: Path, default=None):
    return json.loads(path.read_text(encoding="utf-8-sig")) if path.exists() else default


def _market_holidays(year: int) -> list[str]:
    def observed(month, day):
        date = dt.date(year, month, day)
        return date + dt.timedelta(days=-1 if date.weekday() == 5 else 1 if date.weekday() == 6 else 0)
    def nth(month, weekday, count):
        date = dt.date(year, month, 1)
        return date + dt.timedelta(days=(weekday-date.weekday()) % 7+7*(count-1))
    # Gregorian Easter; NYSE closes on Good Friday.
    a, b, c = year % 19, year // 100, year % 100
    d, e, f = b // 4, b % 4, (b + 8) // 25
    g = (b-f+1)//3; h=(19*a+b-d-g+15)%30; i=c//4; k=c%4
    l=(32+2*e+2*i-h-k)%7; m=(a+11*h+22*l)//451
    month=(h+l-7*m+114)//31; day=(h+l-7*m+114)%31+1
    easter=dt.date(year, month, day)
    memorial=dt.date(year, 5, 31);memorial-=dt.timedelta(days=memorial.weekday())
    days=[observed(1,1),nth(1,0,3),nth(2,0,3),easter-dt.timedelta(days=2),memorial,observed(6,19),observed(7,4),nth(9,0,1),nth(11,3,4),observed(12,25)]
    return [date.isoformat() for date in days]


def update_market(root: Path, snapshot: dict, case_data: dict) -> dict:
    """Merge verified price increments, recalculate indicators, preserve stale-index gaps."""
    snapshot = copy.deepcopy(snapshot)
    old = snapshot['DATA']; original_dates = old['d']
    series = {}
    for symbol, key in [('GOOGL', None), ('QQQ','qqq'), ('XLC','xlc')]:
        rows = {}
        for index, date in enumerate(original_dates):
            if key:
                close = old[key][index]
                if close is None: continue
                rows[date] = dict(o=close,h=close,l=close,c=close,v=0)
            else:
                rows[date] = {short:old[short][index] for short in ('o','h','l','c','v')}
        series[symbol] = rows
    update = _json(root/'assets'/'market-update.json', {})
    for symbol, rows in update.get('series', {}).items():
        if symbol not in series: continue
        for row in rows:
            series[symbol][row['date']] = {short:float(row[long]) for short,long in [('o','open'),('h','high'),('l','low'),('c','close'),('v','volume')]}
    latest=max(series['GOOGL'])
    last_year=int(latest[:4])
    series['_market_holidays']=_market_holidays(last_year)+_market_holidays(last_year+1)
    with tempfile.TemporaryDirectory(prefix='single-stock-v9-') as folder:
        temp=Path(folder)
        (temp/'input_market.json').write_text(json.dumps(series,ensure_ascii=False),encoding='utf-8')
        completed=subprocess.run([sys.executable,'-X','utf8',str(root/'scripts'/'v9_market.py')],cwd=temp,capture_output=True,text=True,encoding='utf-8')
        if completed.returncode:
            raise RuntimeError('行情指标重算失败：'+completed.stderr)
        data=_json(temp/'data.json')
    data['meta']['src']='原Nasdaq历史 + EODHD增量（Wind交叉核对）；未将其他指数末端缺值前填'
    data['meta']['sourceDates']={symbol:max(rows) for symbol,rows in series.items() if isinstance(rows,dict)}
    snapshot['DATA']=data
    idx=snapshot['IDX'];idx['sourceDates']={}
    for symbol, values in idx['series'].items():
        known=snapshot.get('indexClose',{}).get(symbol,{date:value for date,value in zip(original_dates,values) if value is not None})
        if symbol in series: known.update({date:row['c'] for date,row in series[symbol].items()})
        idx['series'][symbol]=[known.get(date) for date in data['d']]
        idx['sourceDates'][symbol]=max(known) if known else None
    snapshot['IDX']=idx
    # Rebuild valuation step series using actual publication dates where supplied.
    publications=_json(root/'assets'/'publication_dates.json',[])
    pub={row['period']:row for row in publications}
    quarter_case={row['period']:row for row in case_data['quarters'] if row['kind']=='actual'}
    records=[];quarter_data=copy.deepcopy(snapshot['qfund'])
    for row in quarter_data:
        current=quarter_case.get(row['p'])
        if current:
            row['eps']=current['eps'];row['sh']=current['dilutedShares'];row['ni']=current['netIncome'];row['rev']=current['revenue']
            # Preserve the explicitly separate original adjusted/core model series.
        row['epsBasis']='SEC reported where verified; otherwise source model'
    for index,row in enumerate(quarter_data):
        if index<3: continue
        window=quarter_data[index-3:index+1]
        if any(q.get('eps') is None or q.get('rev') is None for q in window):continue
        source=pub.get(row['p'])
        if source:
            announced=source['date'];eff=next((date for date in data['d'] if date>announced),(dt.date.fromisoformat(announced)+dt.timedelta(days=1)).isoformat())
        else:eff=(dt.date.fromisoformat(row['end'])+dt.timedelta(days=30)).isoformat()
        shares=row['sh'];netcash=(row.get('cash')or 0)+(row.get('sec')or 0)-(row.get('std')or 0)-(row.get('ltd')or 0)
        records.append(dict(p=row['p'],eff=eff,publicationDate=source['date'] if source else None,eps=sum(q['eps'] for q in window),epsng=sum(q.get('epsng') if q.get('epsng') is not None else q['eps'] for q in window),epscore=sum(q['epscore'] for q in window),rps=sum(q['rev'] for q in window)/shares,bvps=row['equity']/shares,fcfps=sum(q['fcf'] for q in window)/shares,ebitda=sum(q['ebitda'] for q in window),ni=sum(q['ni'] for q in window),netcash=netcash,sh=shares))
    keys=['eps','epsng','epscore','rps','ni','bvps','fcfps','ebitda','netcash','sh'];daily={key:[] for key in keys};qp=[];index=-1
    records.sort(key=lambda row:row['eff'])
    for date in data['d']:
        while index+1<len(records) and records[index+1]['eff']<=date:index+=1
        for key in keys:daily[key].append(records[index][key] if index>=0 else None)
        qp.append(records[index]['p'] if index>=0 else None)
    snapshot['VAL']={**snapshot['VAL'],'rec':records,'daily':daily,'qp':qp,'basisNote':'GAAP EPS采用已核验SEC季度值，其余模型转录；模型调整/剔除投资损益序列保留原始模型口径。公告保守按下一交易日生效；缺公告日期才以季末+30天近似。'}
    data['eps']=daily['eps'];data['bv']=daily['bvps']
    data['pe']=[price/eps if eps is not None and eps>0 else None for price,eps in zip(data['c'],daily['eps'])]
    data['pb']=[price/book if book is not None and book>0 else None for price,book in zip(data['c'],daily['bvps'])]
    data['pe_pct']=[]
    for i,value in enumerate(data['pe']):
        window=[x for x in data['pe'][max(0,i-3*252):i+1] if x is not None]
        data['pe_pct'].append(round(100*sum(x<=value for x in window)/len(window)) if value is not None and window else None)
    # Historical annual EPS is a numerator / day-weighted-shares bridge, never a sum of quarterly EPS.
    source_annual={str(row['period']):row for row in case_data.get('annualBaselines',[]) if row['kind']=='actual'}
    qfund={row['p']:row for row in quarter_data}
    for annual in snapshot['FC']['ann']:
        year=str(annual['p']);quarters=[q for q in snapshot['FC']['q'] if q['p'].startswith(year) and not q.get('est')]
        annual['quarterCount']=len(quarters);annual['partialYear']=len(quarters)!=4
        if year in source_annual and len(quarters)==4:
            annual['eps']=source_annual[year]['eps'];annual['sh']=source_annual[year]['dilutedShares'];annual['epsBasis']='Source model annual EPS; not independently verified for all fields'
            continue
        weighted=0.;days=0;income=0.
        for quarter in quarters:
            record=qfund.get(quarter['p'],{});q=int(quarter['p'][-1]);start=dt.date(int(year),3*q-2,1);end=dt.date(int(year)+1,1,1) if q==4 else dt.date(int(year),3*q+1,1);n_days=(end-start).days
            shares=record.get('sh') or quarter.get('sh')
            if not shares:break
            current=quarter_case.get(quarter['p'],{})
            income+=current.get('dilutedEarnings',record.get('ni',quarter['ni']));weighted+=shares*n_days;days+=n_days
        if days and weighted:
            annual['sh']=weighted/days;annual['eps']=income/annual['sh'];annual['epsBasis']='Approximate quarterly income / day-weighted shares bridge; not full if-converted annual accounting'
        else:annual['eps']=None;annual['epsBasis']='Insufficient annual earnings numerator or shares'
    snapshot['FC']['price']=case_data['meta']['price'];snapshot['FC']['price_date']=case_data['meta']['priceDate']
    return snapshot


def build_dashboard(case_path: Path, output_path: Path, public: bool = False) -> Path:
    root = Path(__file__).resolve().parents[1]
    case_data = json.loads(case_path.read_text(encoding="utf-8-sig"))
    if case_data.get("schemaVersion") != 1:
        raise ValueError("仅支持 schemaVersion = 1 的研究案例")
    for field in ("meta", "segments", "quarters", "sources"):
        if field not in case_data:
            raise ValueError(f"案例缺少字段：{field}")
    if not case_data["quarters"]:
        raise ValueError("案例没有可计算的季度")
    template = (root / "assets" / "dashboard.html").read_text(encoding="utf-8")
    model = (root / "scripts" / "model.mjs").read_text(encoding="utf-8")
    model = re.sub(r"^import .*profit-model.mjs';\s*", "", model, flags=re.MULTILINE)
    model = (root / 'scripts/profit-model.mjs').read_text(encoding='utf-8') + '\n' + model
    model = re.sub(r"^export\s+", "", model, flags=re.MULTILINE)
    snapshot=update_market(root,_json(root/'assets'/'v9-snapshot.json'),case_data)
    research=_json(root/'assets'/'research.json',{})
    cloud_data=_json(root/'assets'/'cloud-inputs.json')
    review_data=_json(root/'assets'/'review-events.json')
    if not cloud_data or not review_data:
        raise ValueError('Missing cloud-inputs.json or review-events.json; build the research models first')
    if not research:
        for name in ['research-recent.json','research-chain.json']:
            part=_json(root/'assets'/name,{})
            for key,value in part.items():
                if isinstance(value,list):research.setdefault(key,[]).extend(value)
                else:research[key]=value
        macro=_json(root/'assets'/'macro-evidence.json')
        if macro:research['macroEvidence']=macro
    if isinstance(research.get('macroEvidence'),dict):research['macroEvidence'].pop('log',None)
    if public:
        def public_payload(value):
            if isinstance(value, dict):
                return {k: public_payload(v) for k, v in value.items()
                        if k not in {'file', 'filePath', 'localPath', 'archive', 'member', 'retrievalAudit', 'localMaterialAudits'}}
            if isinstance(value, list):
                return [public_payload(v) for v in value]
            if isinstance(value, str):
                value = value.replace(str(root.parent), '[local materials]').replace(root.parent.as_posix(), '[local materials]')
                value = re.sub(r'[A-Za-z]:[\\/]Users[\\/][^\\/\s]+', '[local user]', value)
            return value
        case_data, research, cloud_data, review_data, snapshot = [public_payload(v) for v in (case_data, research, cloud_data, review_data, snapshot)]
    # Prevent data strings from closing the inline script or creating HTML markup.
    def payload(value):
        return json.dumps(value,ensure_ascii=False,allow_nan=False,separators=(',',':')).replace('<','\\u003c').replace('\u2028','\\u2028').replace('\u2029','\\u2029')
    replacements={'__CASE_DATA__':payload(case_data),'__MODEL_CODE__':model,'__RESEARCH_DATA__':payload(research),'__WORKBENCH_CODE__':(root/'assets'/'workbench-v9.js').read_text(encoding='utf-8')}
    replacements['__WORKBENCH_CODE__']=replacements['__WORKBENCH_CODE__'].replace('/* __PROFIT_UI__ */',(root/'assets/business-statement.js').read_text(encoding='utf-8')+'\n'+(root/'assets/model-evidence.js').read_text(encoding='utf-8')+'\n'+(root/'assets/model-lineage.js').read_text(encoding='utf-8')+'\n'+(root/'assets/model-items.js').read_text(encoding='utf-8')+'\n'+(root/'assets/model-number-ui.js').read_text(encoding='utf-8')+'\n'+(root/'assets/model-shell.js').read_text(encoding='utf-8')+'\n'+(root/'assets/profit-ui.js').read_text(encoding='utf-8'))
    analysis_model=re.sub(r'^export\s+', '', (root/'scripts/review-analysis.mjs').read_text(encoding='utf-8'),flags=re.MULTILINE)
    replacements['__REVIEW_LAB__']='const REVIEW_LAB_DATA='+payload(_json(root/'assets/review-lab.json'))+';\nconst MACRO_HISTORY='+payload(_json(root/'assets/macro-history.json'))+';\nconst RAL=(()=>{'+analysis_model+'\nreturn {reviewPivots,reviewInterval,earningsMultipleBridge,datedEvidence,reviewStages,pairedStats,rollingFactor,technicalSnapshot};})();\n'+(root/'assets/review-stages.js').read_text(encoding='utf-8')+'\n'+(root/'assets/review-lab.js').read_text(encoding='utf-8')
    segment_model=re.sub(r'^export\s+', '', (root/'scripts/segment-model.mjs').read_text(encoding='utf-8'),flags=re.MULTILINE)
    replacements['__REVIEW_LAB__']+='\nconst AMZN_TRIAL='+payload(_json(root/'assets/amzn-trial.json'))+';\nconst SGM=(()=>{'+segment_model+'\nreturn {calculateSegmentCase};})();\n'+(root/'assets/company-trial.js').read_text(encoding='utf-8')
    cloud_model = re.sub(r'^export\s+', '', (root/'scripts/cloud-model.mjs').read_text(encoding='utf-8'), flags=re.MULTILINE)
    replacements.update({'__CLOUD_DATA__':payload(cloud_data), '__REVIEW_DATA__':payload(review_data),
                         '__CLOUD_MODEL__':cloud_model,
                         '__CLOUD_UI__':(root/'assets/cloud-ui.js').read_text(encoding='utf-8').replace('/* __CLOUD_LINES__ */',(root/'assets/cloud-lines.js').read_text(encoding='utf-8')),
                         '__REVIEW_UI__':(root/'assets/review-v11.js').read_text(encoding='utf-8'),
                         '__V11_INTEGRATION__':(root/'assets/v11-integration.js').read_text(encoding='utf-8')})
    replacements.update({'/*'+key+'*/':payload(snapshot[key]) for key in ['DATA','FC','VAL','IDX','PIV']})
    for marker in replacements:
        if template.count(marker) != 1:
            raise ValueError(f"HTML 模板标记缺失或不唯一：{marker}")
    html=template
    for marker,replacement in replacements.items():html=html.replace(marker,replacement,1)
    if re.search(r"<(?:script|link|img)[^>]+(?:src|href)=[\"']https?://", html, re.I):
        raise ValueError("HTML 含外部资源引用，不满足离线要求")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(html, encoding="utf-8", newline="\n")
    return output_path


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--case", "--data", dest="case_path", type=Path, default=root / "outputs" / "googl-case.json")
    parser.add_argument("--output", type=Path, default=root / "outputs" / "googl-dashboard.html")
    parser.add_argument("--public", action="store_true", help="Omit local evidence locations from the shareable HTML")
    args = parser.parse_args()
    result = build_dashboard(args.case_path, args.output, public=args.public)
    print(f"已生成离线看板：{result.resolve()}")


if __name__ == "__main__":
    main()
