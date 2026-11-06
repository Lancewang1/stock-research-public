"""Build reviewed driver inputs from read-only workbook audit; attach to fixed case."""
from pathlib import Path
import hashlib,json
ROOT=Path(__file__).resolve().parents[1]

def attach(case,inputs):
    case['profitModel']=inputs
    for q in case['quarters']:
        q.update(inputs['historyAmendments'].get(q['period'],{}))
    identity={**case,'meta':{k:v for k,v in case['meta'].items() if k not in ('caseId','generatedAt')}}
    case['meta']['caseId']=hashlib.sha256(json.dumps(identity,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
    return case

def main():
    audit=ROOT/'outputs/research/profit_driver_audit'
    ms=json.loads((audit/'MS_20261029.json').read_text(encoding='utf-8'))
    barc=json.loads((audit/'BARC_20260724.json').read_text(encoding='utf-8'))
    case=json.loads((ROOT/'outputs/googl-case.json').read_text(encoding='utf-8'))
    def val(book,sheet,cell):
        x=book['sheets'][sheet].get(cell,{}).get('value')
        if not isinstance(x,(float,int)):raise ValueError(f'Missing source {sheet}!{cell}')
        return x
    out={'version':1,'asOf':'2026-11-06','units':'USD million','quarters':{},'historyAmendments':{},
         'sources':[{'broker':'MS','date':'2026-10-29','sha256':ms['sha256'],'use':'集团基准、Cloud营业利润、SBC与税效应'},
                    {'broker':'Barclays','date':'2026-07-24','sha256':barc['sha256'],'use':'Cloud收入结构、分类折旧与年限；仅作结构参考'}],
         'limitations':['四块Cloud历史拆分未披露；仅未来情景拆分，历史总额锁定。','GCP内部AI初始占比60%为研究假设。','Barclays旧版Workspace/TPU收入份额用于拆分MS总额，不代表更新后的卖方预测。','分类资产原值由MS折旧与Barclays折旧构成反推，为尺度代理，非已核实资产台账。','未分配Cloud成本在起始时与MS利润勾稽，之后固定，不随情景自动倒算。','2028保留年度延展，未建立逐业务成本与折旧明细。']}
    # Model quarter columns are individually checked via existing source refs.
    for q in case['quarters']:
        refs=q.get('sourceRefs',[])
        addr=next(x.split('!')[1] for x in refs if x.startswith('ms:Model!') and x.endswith('16'))
        col=addr[:-2]
        out['historyAmendments'][q['period']]={'sbcTaxBenefit':val(ms,'Model',col+'80'),'cloudOperatingIncome':val(ms,'Non-Core Losses',col+'90')}
        if q['kind']!='estimate':continue
        i=['2026Q4','2027Q1','2027Q2','2027Q3','2027Q4'].index(q['period']);bc=['EE','EG','EH','EI','EJ'][i]
        cloud=q['segments']['cloud'];barcTotal=val(barc,'New Driver',bc+'102')
        workspace=cloud*val(barc,'New Driver',bc+'120')/barcTotal
        tpu=cloud*val(barc,'New Driver',bc+'127')/barcTotal
        gcp=cloud-workspace-tpu
        dep=q['depreciation'];amort=q['amortization'];sbc=q['sbc']
        serverWeight=val(barc,'Q PP&E',bc+'110')/val(barc,'Q PP&E',bc+'105')
        life=val(barc,'Q PP&E',bc+'113');otherLife=val(barc,'Q PP&E',bc+'117')
        alloc={f:val(ms,'Expense Drivers',col+str(row))/sbc for f,row in [('cogs',173),('rd',175),('sm',176),('ga',177)]}
        total=sum(q[f] for f in ['rd','sm','ga']);opexAlloc={f:q[f]/total for f in ['rd','sm','ga']}
        params=dict(workspaceRevenue=workspace,traditionalRevenue=gcp*.4,aiRevenue=gcp*.6,tpuRevenue=tpu,
                    workspaceDirectRate=.15,traditionalDirectRate=.25,tpuDirectRate=.70,
                    workspaceOpexRate=.30,traditionalOpexRate=.20,aiOpexRate=.12,tpuOpexRate=.05,
                    aiThirdPartyShare=.25,aiThirdPartyCostRate=.75,aiOwnOperatingRate=.25,
                    serverLife=life,otherLife=otherLife,serverAssetMultiplier=1,otherAssetMultiplier=1,
                    cloudDepShare=.4,workspaceDepShare=.05,traditionalDepShare=.25,
                    depreciationCogsShare=val(barc,'IS',bc+'272'),sbcMultiplier=1,
                    sbcTaxBenefitRate=val(ms,'Model',col+'80')/sbc,cloudSbcShare=cloud/q['revenue'],cloudUnallocatedCost=0)
        # Explicit baseline calibration, never re-fit after edits.
        direct=workspace*.15+gcp*.4*.25+gcp*.6*(.25*.75+.75*.25)+tpu*.70
        op=workspace*.30+gcp*.4*.20+gcp*.6*.12+tpu*.05
        target=out['historyAmendments'][q['period']]['cloudOperatingIncome']
        params['cloudUnallocatedCost']=cloud-direct-op-(dep+amort)*.4-sbc*params['cloudSbcShare']-target
        out['quarters'][q['period']]={'parameters':params,'cloudRevenue':cloud,'nonCloudRevenue':q['revenue']-cloud,
            'depreciation':dep,'amortization':amort,'sbc':sbc,'serverAssets':dep*serverWeight*life*4,
            'otherAssets':dep*(1-serverWeight)*otherLife*4,'sbcAllocation':alloc,'opexAllocation':opexAlloc,
            'cloudOperatingIncome':target,'groupCosts':{**{f:q[f] for f in ['cogs','rd','sm','ga']},'otherOpex':q['opex']-total},
            'sourceCells':{'ms':f'Model!{col}44,{col}46,{col}47,{col}80; Non-Core Losses!{col}90; Expense Drivers!{col}173:{col}177',
                           'barclays':f'New Driver!{bc}102,{bc}120,{bc}127; Q PP&E!{bc}110:{bc}117; IS!{bc}272'}}
    (ROOT/'assets/profit-inputs.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
    enriched=attach(case,out)
    for path in ['outputs/googl-case.json','assets/example-googl-case.json']:
        (ROOT/path).write_text(json.dumps(enriched,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'quarters':len(out['quarters']),'caseId':enriched['meta']['caseId'],
                      'calibrationCosts':{p:r['parameters']['cloudUnallocatedCost'] for p,r in out['quarters'].items()}}))

if __name__=='__main__':main()
