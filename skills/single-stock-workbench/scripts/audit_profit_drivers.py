"""Read-only financial-driver audit of supplied Alphabet workbooks."""
from pathlib import Path
import hashlib
import json
import re
from research_local_models import ReadModel

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'outputs/research/profit_driver_audit'
OUT.mkdir(parents=True,exist_ok=True)
catalog=json.loads((ROOT/'outputs/research/local_models/catalog.json').read_text(encoding='utf-8'))
paths={
    'MS_20261029':ROOT.parent/'stock-dashboard-demo_v9_2026-11-04/stock-dashboard-demo/ms-model/clean.xlsx',
    'MS_20260824':ROOT/catalog[12]['file'],
    'GS_20260804':ROOT/catalog[8]['file'],
    'BARC_20260724':ROOT/catalog[2]['file'],
}
rx=re.compile(r'cloud|\bAI\b|artificial|margin|depreci|amorti|useful|\blife\b|\bSBC\b|stock.based|share.based|non.gaap|ex.sbc|capex|cost of|operating profit',re.I)
all_index=[]
for key,path in paths.items():
    wb=ReadModel(path);hits=[];sheets={}
    for sheet in wb.sheets:
        cells=wb.read(sheet);sheets[sheet]=cells
        by_row={}
        for addr,c in cells.items():
            value=c['value']
            if isinstance(value,str) and not c.get('formula') and len(value)<600 and rx.search(value):
                row=int(re.search(r'\d+',addr).group())
                by_row.setdefault(row,[]).append({'cell':addr,'label':value})
        for row,labels in by_row.items():
            hits.append({'sheet':sheet,'row':row,'labels':labels})
    wb.close()
    obj={'model':key,'file':str(path.resolve()),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'sheets':sheets,'hits':hits}
    (OUT/(key+'.json')).write_text(json.dumps(obj,ensure_ascii=False,indent=2),encoding='utf-8')
    all_index.append({k:obj[k] for k in ['model','file','sha256','hits']})
(OUT/'index.json').write_text(json.dumps(all_index,ensure_ascii=False,indent=2),encoding='utf-8')
for entry in all_index:
    print('\nMODEL',entry['model'])
    for h in entry['hits']:
        if h['sheet'] not in ['ImportantDisclosures','Disclosures','Outlinks','Bear DCF','Core DCF','Bull DCF']:
            print(h['sheet'],h['row'],' | '.join(x['cell']+' '+x['label'][:130] for x in h['labels']))
