"""Read-only Amazon migration trial from the user's dated Barclays model."""
from pathlib import Path
import json,hashlib,re,calendar
from research_local_models import ReadModel
ROOT=Path(__file__).resolve().parents[1]
def main():
    p=ROOT/'outputs/research/local_models/78ac3e40da06_AMZN_BARC_analyst_model_20260730.xlsx'
    m=ReadModel(p);s=m.read('New Driver');i=m.read('IS')
    def v(sheet,addr):
        value=sheet.get(addr,{}).get('value')
        if not isinstance(value,(int,float)):raise ValueError('Missing numeric source '+addr)
        return value
    out={'ticker':'AMZN','schemaVersion':1,'asOf':'2026-07-30','units':'USD million except EPS','broker':'Barclays','sourceSHA256':hashlib.sha256(p.read_bytes()).hexdigest(),'segments':[{'key':'northAmerica','label':'北美零售及服务'},{'key':'international','label':'国际零售及服务'},{'key':'aws','label':'AWS'}],'quarters':[],
         'scope':'迁移测试，旧版卖方预测，非当前投资判断；原件只读、无宏、无全表重算。',
         'differences':['Amazon按北美/国际/AWS分部；广告、订阅已包含在零售服务中，不能再与分部相加。','AWS AI收入是原卖方拆分，不复用Google客户份额或外售TPU。','使用分部营业利润率（非毛利率）；本测试未迁移Google分类折旧和SBC模型。','不同信息日期的AMZN与GOOGL预测不能作为同日横向估值比较。','原表数值日期有异常日号；季度采用IS第5行明确的1Q27E等标签。']}
    for k in range(1,5):
        label=f'{k}Q27E';cells=[a for a,x in i.items() if re.fullmatch(r'[A-Z]+5',a) and x.get('value')==label];assert len(cells)==1
        col=cells[0][:-1];segments={name:{'revenue':v(s,col+str(rr)),'operatingIncome':v(s,col+str(oi)),'sourceCells':[f'New Driver!{col}{rr}',f'New Driver!{col}{oi}']} for name,rr,oi in [('northAmerica',528,555),('international',581,608),('aws',628,659)]}
        revenue=v(i,col+'10');op=v(i,col+'28');net=v(i,col+'44');shares=v(i,col+'71');assert abs(sum(x['revenue'] for x in segments.values())-revenue)<1e-6
        row={'period':f'2027Q{k}','kind':'estimate','days':sum(calendar.monthrange(2027,month)[1] for month in range((k-1)*3+1,k*3+1)),'segments':segments,'revenue':revenue,'operatingIncome':op,'unallocatedOperatingIncome':op-sum(x['operatingIncome'] for x in segments.values()),'otherIncome':v(i,col+'36'),'taxRate':v(i,col+'41'),'equityMethodLoss':v(i,col+'38'),'accountingChange':v(i,col+'43'),'netIncome':net,'dilutedShares':shares,'basicShares':v(i,col+'69'),'eps':v(i,col+'66'),'awsAIRevenue':v(s,col+'686'),'sourceCells':[f'IS!{col}{r}' for r in [5,10,28,36,38,41,43,44,66,69,71]]+[f'New Driver!{col}686']}
        assert abs((op+row['otherIncome'])*(1-row['taxRate'])-row['equityMethodLoss']+row['accountingChange']-net)<1e-6
        assert abs(net/shares-row['eps'])<1e-8;out['quarters'].append(row)
    m.close();out['caseId']=hashlib.sha256(json.dumps(out,sort_keys=True).encode()).hexdigest()
    (ROOT/'assets/amzn-trial.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8');print('AMZN: four quarters, segment revenue / operating profit / net income / EPS reconciled.')
if __name__=='__main__':main()
