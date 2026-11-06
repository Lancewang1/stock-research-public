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
    cloudInput=json.loads((ROOT/'assets/cloud-inputs.json').read_text(encoding='utf-8'))
    if not cloudInput.get('msBaseline'):raise ValueError('Run build_ms_baseline.mjs first')
    cloudRows={x['period']:x for x in cloudInput['msBaseline']['rows']}
    def val(book,sheet,cell):
        x=book['sheets'][sheet].get(cell,{}).get('value')
        if not isinstance(x,(float,int)):raise ValueError(f'Missing source {sheet}!{cell}')
        return x
    out={'version':1,'asOf':'2026-11-06','units':'USD million','quarters':{},'historyAmendments':{},
         'sources':[{'broker':'MS','date':'2026-10-29','sha256':ms['sha256'],'use':'集团基准、Cloud营业利润、SBC与税效应'},
                    {'broker':'Barclays','date':'2026-07-24','sha256':barc['sha256'],'use':'Cloud收入结构、分类折旧与年限；仅作结构参考'}],
         'limitations':['四块Cloud历史拆分未披露；仅未来情景拆分，历史总额锁定。','AI和TPU收入来自客户/交付种子参数；企业服务增长按MS总额反推。','Workspace/传统GCP内部比例沿旧结构代理，不由MS唯一识别。','分类资产原值由MS折旧与Barclays折旧构成反推，为尺度代理，非已核实资产台账。','默认反推统一Cloud现金成本倍率对齐MS利润，额外未分配项为0；修改后不自动拟合。','2028保留年度延展，未建立逐业务成本与折旧明细。']}
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
        enterpriseWorkspaceRatio=workspace/(workspace+gcp*.4)
        anchor=cloudRows[q['period']]
        workspace=anchor['enterpriseRevenueBn']*1000*enterpriseWorkspaceRatio
        traditional=anchor['enterpriseRevenueBn']*1000*(1-enterpriseWorkspaceRatio)
        ai=anchor['aiRevenueBn']*1000;tpu=anchor['tpuRevenueBn']*1000
        if abs(workspace+traditional+ai+tpu-cloud)>1e-5:raise ValueError('Cloud baseline not reconciled')
        dep=q['depreciation'];amort=q['amortization'];sbc=q['sbc']
        serverWeight=val(barc,'Q PP&E',bc+'110')/val(barc,'Q PP&E',bc+'105')
        life=val(barc,'Q PP&E',bc+'113');otherLife=val(barc,'Q PP&E',bc+'117')
        alloc={f:val(ms,'Expense Drivers',col+str(row))/sbc for f,row in [('cogs',173),('rd',175),('sm',176),('ga',177)]}
        total=sum(q[f] for f in ['rd','sm','ga']);opexAlloc={f:q[f]/total for f in ['rd','sm','ga']}
        params=dict(workspaceRevenue=workspace,traditionalRevenue=traditional,aiRevenue=ai,tpuRevenue=tpu,
                    workspaceDirectRate=.15,traditionalDirectRate=.25,tpuDirectRate=.70,
                    workspaceOpexRate=.30,traditionalOpexRate=.20,aiOpexRate=.12,tpuOpexRate=.05,
                    aiThirdPartyShare=.25,aiThirdPartyCostRate=.75,aiOwnOperatingRate=.25,
                    serverLife=life,otherLife=otherLife,serverAssetMultiplier=1,otherAssetMultiplier=1,
                    cloudDepShare=.4,workspaceDepShare=.05,traditionalDepShare=.25,
                    depreciationCogsShare=val(barc,'IS',bc+'272'),sbcMultiplier=1,
                    sbcTaxBenefitRate=val(ms,'Model',col+'80')/sbc,cloudSbcShare=cloud/q['revenue'],cloudUnallocatedCost=0)
        ytref=ms['sheets']['Expense Drivers'][col+'69']['formula'].split('!')[1]
        ytcol=ytref.rstrip('0123456789')
        ytsubs=val(ms,'YouTube',ytcol+'33')
        nflCell=ms['sheets']['YouTube'].get(ytcol+'47',{}).get('value')
        nfl=nflCell if isinstance(nflCell,(int,float)) else max(0,val(ms,'YouTube',ytcol+'39')-.55*(q['segments']['youtube']+ytsubs))
        contentRate=(val(ms,'YouTube',ytcol+'39')-nfl)/(q['segments']['youtube']+ytsubs)
        params.update(searchTacRate=val(ms,'Expense Drivers',col+'25')/q['segments']['search'],
                      networkTacRate=val(ms,'Expense Drivers',col+'45')/q['segments']['network'],
                      youtubeContentRate=contentRate,youtubeSubsShare=ytsubs/q['segments']['subs'],nflContentCost=nfl)
        # Explicit baseline calibration, never re-fit after edits.
        direct=workspace*.15+traditional*.25+ai*(.25*.75+.75*.25)+tpu*.70
        op=workspace*.30+traditional*.20+ai*.12+tpu*.05
        target=out['historyAmendments'][q['period']]['cloudOperatingIncome']
        allowance=cloud-target-(dep+amort)*.4-sbc*params['cloudSbcShare']
        params['cloudCashCostMultiplier']=allowance/(direct+op)
        if not 0<=params['cloudCashCostMultiplier']<=3:raise ValueError('MS cost multiplier outside declared range')
        params['cloudUnallocatedCost']=0
        out['quarters'][q['period']]={'parameters':params,'cloudRevenue':cloud,'nonCloudRevenue':q['revenue']-cloud,
            'msImplied':{'method':'uniform_cash_cost_multiplier','cashCostAtSeed':direct+op,'allowedCashCost':allowance,'multiplier':params['cloudCashCostMultiplier'],'unallocatedCost':0,'enterpriseGrowth':anchor['value'],'fixed':'客户/TPU种子假设、Workspace/传统比例、D&A与SBC分配固定；统一缩放所有Cloud直接现金成本和经营费用，非MS原始费率。'},
            'segments':q['segments'],'hedge':q['hedge'],'nonCloudCostSource':f'MS 2026-10-29 Expense Drivers!{col}25,{col}45; YouTube!{ytcol}33,{ytcol}39,{ytcol}43,{ytcol}47; distribution TAC assigned to search per source denominator'+('；NFL单元格缺失：当前0仅为原模型总内容成本减55%分成后的隐含余额，非已核实无成本。' if nflCell is None else ''),
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
