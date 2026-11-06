#!/usr/bin/env python3
"""Inventory and read user-supplied model archives without editing originals.

Only extraction copies and JSON evidence are written. Cached formula values are
reported as saved, never represented as a fresh Excel recalculation.
"""
from __future__ import annotations
import argparse
from datetime import datetime,timezone
import hashlib
import io
import json
from pathlib import Path
import re
import zipfile
import xml.etree.ElementTree as ET

NS={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}

ROOT=Path(__file__).resolve().parents[1]
COMPANIES={
 'Alphabet':r'(?i)(?:\bGOOGL?\b|Alphabet|Google)',
 'Anthropic':r'(?i)(?:Anthropic|\bANTH\b|Claude)',
 'NVIDIA':r'(?i)(?:\bNVDA\b|NVIDIA)',
 'Broadcom':r'(?i)(?:\bAVGO\b|Broadcom)',
 'Amazon':r'(?i)(?:\bAMZN\b|Amazon)',
 'Microsoft':r'(?i)(?:\bMSFT\b|Microsoft)',
}
MODEL_EXTS={'.xlsx','.xlsm','.xlsb','.xls','.csv'}

def dump(path,value):
 path.parent.mkdir(parents=True,exist_ok=True)
 path.write_text(json.dumps(value,ensure_ascii=False,indent=2,default=str)+'\n',encoding='utf-8')

def companies(name):
 return [company for company,pat in COMPANIES.items()if re.search(pat,name.replace('_',' '))]

def inventory(source,out):
 entries=[];archives=[];errors=[]
 def walk(data,archive,chain=(),depth=0):
  if depth>12:
   errors.append({'archive':archive,'chain':chain,'error':'Nested archive depth over 12'});return
  try:
   with zipfile.ZipFile(data)as z:
    infos=z.infolist();archives.append({'archive':archive,'chain':list(chain),'entryCount':len(infos),'depth':depth})
    for i in infos:
     ext=Path(i.filename).suffix.lower()
     entry={'archive':archive,'archiveChain':list(chain),'member':i.filename,'size':i.file_size,'compressedSize':i.compress_size,'crc32':f'{i.CRC:08x}','zipTimestamp':datetime(*i.date_time).isoformat(),'isDirectory':i.is_dir(),'extension':ext,'companies':companies(i.filename)}
     entries.append(entry)
     if ext=='.zip'and not i.is_dir():
      if i.file_size>1_000_000_000:errors.append({'archive':archive,'chain':list(chain),'member':i.filename,'error':'Nested archive exceeds 1 GB; not loaded'})
      else:walk(io.BytesIO(z.read(i)),archive,chain+(i.filename,),depth+1)
  except Exception as exc:errors.append({'archive':archive,'chain':list(chain),'errorType':type(exc).__name__,'error':str(exc)})
 root_files=sorted(source.rglob('*'))
 for p in root_files:
  if p.is_file()and p.suffix.lower()=='.zip':walk(p,str(p.relative_to(source)))
  elif p.is_file():entries.append({'archive':None,'archiveChain':[],'member':str(p.relative_to(source)),'size':p.stat().st_size,'extension':p.suffix.lower(),'companies':companies(p.name),'isDirectory':False})
 matches=[e for e in entries if e['companies']and e['extension']in MODEL_EXTS]
 result={'asOf':'2026-11-05','sourceDirectory':str(source),'originalsReadOnly':True,'archiveCount':len([a for a in archives if a['depth']==0]),'nestedArchiveCount':len([a for a in archives if a['depth']>0]),'entryCount':len(entries),'archives':archives,'entries':entries,'matches':matches,'errors':errors}
 dump(out/'inventory.json',result)
 return result

def read_member(source,entry):
 if entry['archive']is None:return(source/entry['member']).read_bytes()
 current=source/entry['archive']
 for member in entry['archiveChain']:
  with zipfile.ZipFile(current)as z:current=io.BytesIO(z.read(member))
 with zipfile.ZipFile(current)as z:return z.read(entry['member'])

def extract(source,entry,out):
 content=read_member(source,entry);sha=hashlib.sha256(content).hexdigest()
 basename=re.sub(r'[^\w.() -]','_',Path(entry['member']).name)
 path=out/(sha[:12]+'_'+basename)
 if not path.exists():path.write_bytes(content)
 return path,sha

class ReadModel:
 """Read OOXML cached values/formulas without executing macros or links.

 Direct XML also handles the supplied MS files' invalid removed-print-title
 defined names, which prevent openpyxl from opening some original files.
 """
 def __init__(self,path):
  self.z=zipfile.ZipFile(path)
  self.cache={}
  self.strings=[]
  if 'xl/sharedStrings.xml'in self.z.namelist():
   tree=ET.fromstring(self.z.read('xl/sharedStrings.xml'))
   self.strings=[''.join(x.itertext())for x in tree.findall('m:si',NS)]
  wb=ET.fromstring(self.z.read('xl/workbook.xml'))
  rels=ET.fromstring(self.z.read('xl/_rels/workbook.xml.rels'))
  targets={a.attrib['Id']:a.attrib['Target']for a in rels}
  self.sheets={}
  for s in wb.find('m:sheets',NS):
   target=targets[s.attrib['{'+NS['r']+'}id']]
   self.sheets[s.attrib['name']]=target.lstrip('/')if target.startswith('/')else 'xl/'+target
 def read(self,name):
  if name in self.cache:return self.cache[name]
  tree=ET.fromstring(self.z.read(self.sheets[name]));cells={}
  for c in tree.findall('.//m:sheetData/m:row/m:c',NS):
   typ=c.attrib.get('t');v=c.find('m:v',NS);f=c.find('m:f',NS)
   raw=v.text if v is not None else None
   if typ=='s'and raw is not None:value=self.strings[int(raw)]
   elif typ=='inlineStr':value=''.join(c.find('m:is',NS).itertext())
   elif raw is not None and typ not in {'str','e','b'}:
    try:value=float(raw);value=int(value)if value.is_integer()else value
    except ValueError:value=raw
   else:value=raw
   item={'cell':c.attrib['r'],'cachedValue':value,'value':value,'dataType':typ,'styleIndex':c.attrib.get('s')}
   if f is not None:
    item['formula']='='+f.text if f.text else None
    if f.attrib:item['formulaAttributes']=f.attrib
   if value is not None or f is not None:cells[c.attrib['r']]=item
  masters={x['formulaAttributes']['si']:x for x in cells.values()if x.get('formula')and x.get('formulaAttributes',{}).get('t')=='shared'}
  for item in cells.values():
   a=item.get('formulaAttributes',{})
   if a.get('t')=='shared'and item.get('formula')is None and a.get('si')in masters:
    master=masters[a['si']]
    from openpyxl.formula.translate import Translator
    try:
     item['formula']=Translator(master['formula'],origin=master['cell']).translate_formula(item['cell'])
     item['sharedFormulaMaster']=master['cell']
     item['formulaExpandedFromSharedMaster']=True
    except Exception:pass
  self.cache[name]=cells
  return cells
 def close(self):self.z.close()

def build_evidence(out,asset):
 catalog=json.loads((out/'catalog.json').read_text(encoding='utf-8'))
 inv=json.loads((out/'inventory.json').read_text(encoding='utf-8'))
 nvidia=json.loads((out/'nvidia-evidence.json').read_text(encoding='utf-8'))
 dates=['2026-07-30','2026-06-04','2026-07-24','2026-07-30','2026-08-27','2026-08-27','2026-06-04','2026-07-30','2026-08-04','2026-07-31','2026-08-09','2026-07-31','2026-08-24','2026-08-27','2026-06-03']
 tickers={'Alphabet':'googl','NVIDIA':'nvda','Broadcom':'avgo','Amazon':'amzn','Microsoft':'msft'}
 sources=[];source_by_index={};model_index=[]
 for i,a in enumerate(catalog):
  company=a['companies'][0];broker='Morgan Stanley'if i>=10 else'Goldman Sachs'if i>=5 else'Barclays'
  broker_id={'Morgan Stanley':'ms','Goldman Sachs':'gs','Barclays':'barc'}[broker]
  sid='local-'+tickers[company]+'-'+broker_id+'-'+dates[i].replace('-','')
  if i>=10:
   date_basis='ImportantDisclosures!A8、IndexInformation!B2、ModPubIndex!A2 三处内部发布记录核对；不是 ZIP 修改时间。'
   date_cells=['ImportantDisclosures!A8','IndexInformation!B2','ModPubIndex!A2']
  elif i<5:
   date_basis='ModelCover!F2 的研究发布日期；文件名辅助核对。';date_cells=['ModelCover!F2']
  else:
   date_basis='文件名日期，与 docProps/core.xml modified 的日期一致；未独立取得随附发布邮件。';date_cells=[]
  source={'id':sid,'title':broker+' '+company+' model','date':dates[i],'dateBasis':date_basis,'file':a['file'].replace('\\','/'),'archive':'Fundamental Models/'+a['archive'],'member':a['member'],'sha256':a['sha256'],'kind':'user_supplied_sell_side_model','cells':date_cells,'note':'读取原档副本的公式和已保存缓存；未执行宏、刷新外部链接或重新计算。日期早于 2026-11-05，属于历史卖方预测，不是最新实际或公司指引。'}
  if i==12:source['note']+=' 归档文件名写 C3.ai，但内部 IndexInformation!B7=Alphabet Inc.、A10=GOOGL.O，已按内部身份确认。'
  if i==14:source['note']+=' 内部发布日期为 6 月 3 日，core modified 为 6 月 4 日，不互相替代。'
  sources.append(source);source_by_index[i]=source
  model_index.append({'company':company,'broker':broker,'publicationDate':dates[i],'sourceRef':sid,'file':source['file'],'sha256':a['sha256'],'sheets':a['sheets'],'exactDuplicateCount':len(a['duplicates']),'dateBasis':date_basis,'identityNote':'文件名误标 C3.ai，内部为 Alphabet'if i==12 else None})
 # Use the root agent's already reviewed NVIDIA work and retain stronger MS date proof.
 current_ids={s['id']for s in sources}
 for source in nvidia['sources']:
  if source['id']not in current_ids:sources.append(source)
 metrics=list(nvidia['evidenceMetrics']);cards=list(nvidia['crossCompanyEvidence']);checks=[]
 opened={}
 def wb(index):
  if index not in opened:opened[index]=ReadModel(ROOT/catalog[index]['file'])
  return opened[index]
 def metric(index,sheet,cell,name,period,unit='USD mn',**extra):
  item=wb(index).read(sheet).get(cell)
  if item is None or not isinstance(item.get('value'),(int,float)):
   raise ValueError(f'Missing numeric cached cell: {index} {sheet}!{cell}')
  source=source_by_index[index]
  record={'id':source['id']+'-'+re.sub(r'[^a-z0-9]+','-',sheet.lower())+'-'+cell.lower(),'company':catalog[index]['companies'][0],'broker':source['title'].split(catalog[index]['companies'][0])[0].strip(),'metric':name,'period':period,'fiscalPeriod':period,'value':item['value'],'unit':unit,'status':'sell_side_forecast','publicationDate':source['date'],'sheet':sheet,'cell':cell,'cachedValue':item['value'],'formula':item.get('formula'),'inputKind':'formula'if 'formula'in item else'hardcoded_model_input','sourceRefs':[source['id']],**extra}
  if item.get('sharedFormulaMaster'):record['sharedFormulaMaster']=item['sharedFormulaMaster'];record['formulaExpandedFromSharedMaster']=True
  metrics.append(record);return record
 g=wb(2).read('New Driver')
 for col,period in [('EE','2026Q4'),('EK','2027FY')]:
  for row,name,unit in [(102,'Google Cloud revenue','USD mn'),(114,'GCP revenue excluding External TPU Sales and Workspace','USD mn'),(120,'Workspace revenue','USD mn'),(127,'External TPU Sales (model label)','USD mn'),(130,'External TPU capacity sold assumption','GW'),(131,'TPUaaS revenue per GW (model label)','USD mn/GW'),(148,'Third-party compute cost','USD mn'),(149,'External TPU sales operating expenses','USD mn'),(152,'Google Cloud operating income','USD mn'),(156,'Google Cloud operating margin','fraction'),(166,'External TPU sales operating income','USD mn'),(170,'External TPU sales operating margin','fraction')]:
   metric(2,'New Driver',col+str(row),name,period,unit,periodEnd='2026-12-31'if col=='EE'else'2027-12-31',periodHeaderCells=[col+'5'],unitBasis='IS!A4 为 $ in Millions；GW/单位价/利润率依 New Driver 行标签及公式。',notEquivalentTo='company actuals, Anthropic-specific contract allocation, or current Morgan Stanley baseline')
  rev=g[col+'102']['value'];cost=g[col+'134']['value'];op=g[col+'152']['value']
  checks.append({'check':'Cloud revenue components '+period,'differenceUSDmn':rev-sum(g[col+str(row)]['value']for row in [114,120,127]),'passed':abs(rev-sum(g[col+str(row)]['value']for row in [114,120,127]))<1e-6})
  checks.append({'check':'Cloud revenue less cost '+period,'differenceUSDmn':rev-cost-op,'passed':abs(rev-cost-op)<1e-6})
 metric(2,'New Driver','EE117','Average GCP capacity assumption','2026Q4','GW',unitBasis='平均季初与季末模型容量，New Driver!EE117 引用 Q PP&E!EE127/EE131。')
 metric(2,'New Driver','EE118','GCP quarterly revenue per average GW assumption','2026Q4','USD mn/GW/quarter',unitBasis='New Driver!EE114=EE117*EE118；单位由季度收入和GW桥确定。')
 metric(2,'IS','EE39','Third-party compute cost linked to consolidated IS','2026Q4',unitBasis='IS!A4 USD mn；链接 New Driver!EE148。')
 metric(2,'IS','EE40','External TPU cost linked to consolidated IS','2026Q4',unitBasis='IS!A4 USD mn；链接 New Driver!EE149。')
 for col,period in [('CF','FY2026Q3'),('CG','FY2026Q4'),('DH','FY2026'),('DI','FY2027')]:
  metric(1,'Rev',col+'42','AI semiconductor revenue',period,unitBasis='Rev!A3 $ in millions；季度按 Rev!row2 月份与 row3 财季，年度按 row2/row3 FYE。',periodEnd=None,modelPeriodLabel={'CF':'Jul-2026 3QE','CG':'Oct-2026 4QE','DH':'2026 FYE','DI':'2027 FYE'}[col],notEquivalentTo='GOOGL-specific purchases, Anthropic consumption, or commissioned cloud capacity')
 for col,period in [('EA','FY2026'),('EB','FY2027')]:
  metric(6,'worksheet',col+'90','AI semiconductor revenue',period,unitBasis='worksheet 行210/223 标 $mn；年度标签 row4 FY26E/FY27E。',periodEnd=None,periodHeaderCells=[col+'4'],notEquivalentTo='Google Cloud revenue')
 metric(6,'worksheet','BW211','Custom silicon gross margin assumption','model Jul-2026 forecast','fraction',periodHeaderCells=['BW3','BW4'],periodLabelConflict='BW3=Jul Q3 而 BW4=2Q26E；此处保留月份而不把矛盾季度标签当正式财季。')
 sg=source_by_index[2]['id'];sb=source_by_index[1]['id'];ss=source_by_index[6]['id']
 cards.extend([
  {'company':'Alphabet / Google Cloud','relationship':'同公司历史卖方模型：收入与成本拆分','claim':'Barclays 2026-07-24 模型把 2026Q4 Cloud 收入 41.579bn 拆为 GCP 23.436bn、Workspace 5.279bn、External TPU Sales 12.865bn；FY2027 分别为 131.925bn、22.477bn、67.745bn，合计 222.147bn。外售 TPU 已在这份 Barclays 基准内。','implication':'可用作同口径基准的收入桥和防重复计入检查。它不证明当前 Morgan Stanley 基准已包含相同外售 TPU；切换机构或加入新合同前必须先对齐已有收入组成。','sourceRefs':[sg],'limitations':['这是 7 月旧预测，Q3 财报后不能自动视为最新预期。','GCP 明确排除 External TPU Sales 与 Workspace；三个组成不能再次与总 Cloud 收入相加。','未找到 Anthropic 客户名或客户分配；不能把全部外售 TPU 归给 Anthropic。'],'strength':'模型结构、公式及缓存：强；当前预测有效性与客户归属：待验证','factors':['Cloud收入增速','收入确认节奏','基准已含收入'],'publicationDate':'2026-07-24','applicablePeriods':['2026Q4','2027FY'],'sheet':'New Driver','cells':['EE102','EE114','EE120','EE127','EK102','EK114','EK120','EK127']},
  {'company':'Alphabet / Google Cloud','relationship':'历史模型的容量、单价与外售 TPU 盈利假设','claim':'2026Q4 外售 TPU 收入=0.90055GW×14,285.714m/GW=12,865m；FY2027 外售容量合计 3.7GW、逐季单价 18,309.524m/GW，收入 67,745.238m。模型对外售 TPU 设 25%营业利润率，因此 Q4 外售营业利润 3,216.25m、费用 9,648.75m。GCP 单独以平均容量 8.6799GW×2,700m/GW/季计算 Q4 收入。','implication':'可为另行构建 Barclays 口径容量情景提供候选假设；本看板仍以 MS 为计算基准，未自动套用这些值，并保持卖方假设标签。应先核合同归属、计费/确认方式和交付批次，再把新增量减去这份基准已含量。','sourceRefs':[sg],'limitations':['行127叫 External TPU Sales，行131叫 TPUaaS Revenue per GW；公式是在当季用GW乘完整单价，未展示月度服务摊销，不能仅凭标签判定真实合同按硬件交付还是持续服务确认。','这些是硬编码或公式驱动的卖方假设，非公司公布的价格、已验收GW或客户采购。','25%是营业利润率，不能当集团毛利率或现金回收率；不能把 GCP 每GW季度收入与外售 TPU 每GW销售额互换。'],'strength':'单元格公式和现金单位明确；现实合同映射仍缺','factors':['可交付容量','净单位价格','Cloud营业利润率','收入确认节奏'],'publicationDate':'2026-07-24','applicablePeriods':['2026Q4','2027FY'],'sheet':'New Driver','cells':['EE117','EE118','EE127','EE130','EE131','EE166','EE170','EK127','EK130','EK131']},
  {'company':'Alphabet / Google Cloud','relationship':'外售硬件与第三方算力成本进入集团损益的路径','claim':'2026Q4 Cloud 总费用 31.051bn = GCP/Workspace费用18.642bn + 第三方算力2.760bn + 外售TPU费用9.649bn。New Driver!EE148=920×3，IS!EE39引用它；IS!EE40引用外售TPU费用。Cloud营业利润10.529bn、利润率25.32%。FY2027 Cloud营业利润67.486bn、利润率30.38%。','implication':'在该机构模型内，新增收入必须同时检查第三方算力、外售成本及核心云费用，不能只增加Cloud收入。可将3P Compute单独设为用户输入，避免把缺失月份默认为已确认成本节约。','sourceRefs':[sg],'limitations':['2027Q2-Q4 New Driver!EH148/EI148/EJ148为空，FY2027只计Q1的2.760bn；这是该版本的空白/假设边界，不是公司确认以后成本为零。','成本行跨Cloud分部和集团IS需保持同一版本；不能把本BARC成本桥直接嫁接到MS收入基准。','缓存验证不等于用Excel重算，也未刷新外部链接。'],'strength':'模型中的成本传导已追到集团IS；未来费用完整性需复核','factors':['Cloud营业利润率','集团营业成本','第三方算力费用'],'publicationDate':'2026-07-24','applicablePeriods':['2026Q4','2027FY'],'sheet':'New Driver / IS','cells':['New Driver!EE134','New Driver!EE141','New Driver!EE148','New Driver!EE149','New Driver!EE152','New Driver!EK152','IS!EE39','IS!EE40']},
  {'company':'Broadcom','relationship':'Google TPU/ASIC上游供应商：旧预测与供应结构','claim':'2026-06-04 Barclays 模型预计 FY2026Q3/Q4 AI半导体收入16.124bn/22.207bn，FY2027为126.326bn；同日Goldman Sachs年度AI预测为FY2026 57.052bn、FY2027 133.045bn。BARC的AI收入明确由Custom Silicon与AI Networking相加。','implication':'可以比较当时供给侧增长预期与后续交付兑现，但不能把Broadcom全部AI收入当成Google采购，更不能等额转成Cloud收入。两家对FY2027的差异应保留为模型分歧。','sourceRefs':[sb,ss],'limitations':['日期较研究截止日早五个月，属于历史卖方预测，非11月最新指引。','BARC Rev!A77:A90虽有GOOGL units/ASP/v4-v6结构，但v6单位最后非空为CD80（Jan-2026列），后续预测列缺失，不能用该旧拆分生成2026Q4或2027 Google采购量。','GS worksheet的季度行存在冲突：BW3=Jul Q3而BW4=2Q26E；本卡只使用明确年度FY标签进行跨机构比较。','芯片出货、客户采购、机房投产验收、按合同计费和Google收入确认不是同一时点。'],'strength':'聚合AI预测与结构：可追溯；当前Google客户出货：不足','factors':['可交付容量','供应侧收入','Google份额'],'publicationDate':'2026-06-04','applicablePeriods':['FY2026Q3','FY2026Q4','FY2027'],'sheet':'Rev / worksheet','cells':['Rev!CF42','Rev!CG42','Rev!DI42','Rev!CD80','Rev!CF80','worksheet!EA90','worksheet!EB90']},
  {'company':'Anthropic','relationship':'客户需求证据缺口：本地模型目录检查','claim':'完整盘点31个ZIP、1,373个条目，未发现Anthropic命名模型；五家相关公司的15份独立模型共享字符串中也未检出Anthropic或Claude。现有本地文件不能提供Anthropic分季度采购、费用或供应商分配预测。','implication':'继续使用已单独核验的客户公开披露作为需求线索；不将Google或Broadcom聚合预测伪装为Anthropic采购计划。若要量化该客户，仍需客户原始财务/采购模型或明确合同分配。','sourceRefs':['local-models-inventory'],'limitations':['本次完整盘点的是归档条目，内容扫描聚焦匹配的五家公司的15个独立模型；不能证明其余所有公司工作簿从未提及Anthropic。','未检出名称也不等于相关客户贡献未计入匿名/聚合假设。'],'strength':'目录覆盖与匹配模型名称扫描：明确；客户采购量化：缺失','factors':['客户采购','合同归属','基准已含收入'],'publicationDate':'2026-11-05','applicablePeriods':['2026Q4','2027FY']},
 ])
 sources.append({'id':'local-models-inventory','title':'Fundamental Models 全归档目录盘点及去重','date':'2026-11-05','file':'outputs/research/local_models/inventory.json','page':'archives / entries / matches；去重后的catalog.json','kind':'local_archive_inventory','note':'31 ZIP、1373条目、0嵌套ZIP、0读取错误；24文件名命中中7个是macOS资源叉，17个有效文件按SHA256去重为15独立模型。原档只读。'})
 for i,fields,note in [
  (10,['New Revenue Detail!CY159','New Revenue Detail!CY166','New Revenue Detail!CY170','New Revenue Detail!DB159'],'字段定位：Azure and other Cloud Services 在行159，Azure AI 在行166且按行159减Core Azure行170计算，属于模型残差估计。旧Azure行152口径不同，不能混用；CY3为Dec-26E，DB3为2027E且按微软六月财年，不能直接当自然年。未完成全口径深审，不输出新增量化结论。'),
  (11,['Model!EU34','Model!EU261','Model!EU401','Retail vs AWS!EE258','Retail vs AWS!EE415'],'字段定位：主Model AWS收入行34引用Retail vs AWS行258；AWS折旧摊销在Model行261、资本开支在行401并引用Retail vs AWS行415。Drivers and Detail行882是旧的Revenue and Gross Profit合并行，不直接当当前AWS收入。期间和单位尚需完整核对，不输出新增量化结论。'),
 ]:
  model_index[i]['reviewFields']={'cells':fields,'note':note,'status':'field_location_only'}
 for w in opened.values():w.close()
 known={s['id']for s in sources}
 for card in cards:assert set(card['sourceRefs'])<=known
 for m in metrics:assert set(m['sourceRefs'])<=known
 assert all(x['passed']for x in checks)
 result={'asOf':'2026-11-05','scope':'用户 Fundamental Models 本地归档；不调用API、不执行宏、原件只读。优先验证Alphabet容量/费用桥、Broadcom与NVIDIA旧预测。','sources':sources,'crossCompanyEvidence':cards,'evidenceMetrics':metrics,'modelInventory':{'archiveCount':inv['archiveCount'],'nestedArchiveCount':inv['nestedArchiveCount'],'entryCount':inv['entryCount'],'filenameMatches':24,'macOSResourceForksExcluded':7,'validMatchedModelFiles':17,'uniqueMatchedModels':len(catalog),'anthropicNamedModels':0,'archiveErrors':inv['errors'],'inventoryFile':'outputs/research/local_models/inventory.json','catalogFile':'outputs/research/local_models/catalog.json'},'models':model_index,'verification':{'formulaRecalculated':False,'values':'original saved formula caches / hardcoded assumptions','formulas':'OOXML formulas; shared formulas expanded from explicit master without evaluation','macrosExecuted':False,'externalLinksRefreshed':False,'originalsModified':False,'checks':checks},'limitations':['目录最新版本日期为2026年6月至8月，均早于11月5日；不能替代财报后的最新预测。','FY/CY、季度末、月份标签和财务报表单位按具体模型核对，不因文件名或FactSet辅助行自动映射。','未做全部1373条目逐单元格深审；完整目录清单已保留，深读集中相关15个去重模型及核心业务。','公司内同名或旧残留行可能有不同口径；只提取已核对期间与公式依赖的具体行。','新增参数仅提供可审查的历史机构假设，不自动覆盖当前MS基准。']}
 dump(asset,result)
 return result

def main():
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument('--source-dir',type=Path,default=ROOT.parent/'Fundamental Models')
 p.add_argument('--output-dir',type=Path,default=ROOT/'outputs/research/local_models')
 p.add_argument('--inventory-only',action='store_true')
 p.add_argument('--build-only',action='store_true')
 a=p.parse_args();result=inventory(a.source_dir,a.output_dir)
 if a.build_only:
  evidence=build_evidence(a.output_dir,ROOT/'assets/research-local-models.json')
  print(json.dumps({'sources':len(evidence['sources']),'cards':len(evidence['crossCompanyEvidence']),'metrics':len(evidence['evidenceMetrics'])}));return
 print(json.dumps({'archives':result['archiveCount'],'nestedArchives':result['nestedArchiveCount'],'entries':result['entryCount'],'matchedModels':len(result['matches']),'errors':result['errors']},ensure_ascii=False))
 for e in result['matches']:print(json.dumps({k:e[k]for k in ['archive','archiveChain','member','size','zipTimestamp','companies']if k in e},ensure_ascii=False))

if __name__=='__main__':main()
