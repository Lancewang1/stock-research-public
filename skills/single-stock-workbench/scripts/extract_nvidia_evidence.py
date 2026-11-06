"""Read selected cached MS/GS model cells; never execute macros or recalculate sources."""
from pathlib import Path
import json
import openpyxl

ROOT = Path(__file__).resolve().parents[1]


def main():
    catalog = json.loads((ROOT / 'outputs/research/local_models/catalog.json').read_text(encoding='utf-8'))
    selected = [('a2303dd11891', 'local-nvda-ms-20260827', 'Morgan Stanley'), ('a673f3557c90', 'local-nvda-gs-20260827', 'Goldman Sachs')]
    out = {'sources': [], 'crossCompanyEvidence': [], 'evidenceMetrics': []}
    for sha_prefix, source_id, broker in selected:
        record = next(row for row in catalog if row['sha256'].startswith(sha_prefix))
        assert record['companies'] == ['NVIDIA']
        path = ROOT / record['file']
        values = openpyxl.load_workbook(path, read_only=True, data_only=True)
        formulas = openpyxl.load_workbook(path, read_only=True, data_only=False)
        out['sources'].append({'id': source_id, 'title': f'{broker} NVIDIA financial model',
            'date': '2026-08-27', 'dateBasis': '文件名或工作簿内部modified属性；未独立取得随附发布邮件',
            'kind': 'user_supplied_sell_side_model', 'file': record['file'],
            'archive': 'Fundamental Models/' + record['archive'], 'member': record['member'],
            'sha256': record['sha256'], 'note': '只读公式及已保存缓存值；未执行宏、刷新外部链接或在Excel重算。卖方预测不是公司指引。'})
        if broker == 'Morgan Stanley':
            specs = [('IS','CK7','FY2027Q3','Revenue','USD mn'),('IS','CL7','FY2027Q4','Revenue','USD mn'),
                ('IS','DR7','FY2028','Revenue','USD mn'),('BU-New','BA72','FY2027Q3','Data Center revenue','USD mn'),
                ('BU-New','BB72','FY2027Q4','Data Center revenue','USD mn'),
                ('DC GPU Breakdown','X28','FY2027Q3','Rubin / Rubin Ultra share of DC GPU revenue','ratio'),
                ('DC GPU Breakdown','Y28','FY2027Q4','Rubin / Rubin Ultra share of DC GPU revenue','ratio'),
                ('DC GPU Breakdown','X53','FY2027Q3','Blended GPU ASP','USD thousands'),
                ('DC GPU Breakdown','Y53','FY2027Q4','Blended GPU ASP','USD thousands'),
                ('IS','CK13','FY2027Q3','GAAP gross margin','ratio'),('IS','CL13','FY2027Q4','GAAP gross margin','ratio')]
            out['crossCompanyEvidence'].append({'company': 'NVIDIA · MS模型', 'relationship': 'GPU供给与产品组合参考',
                'claim': '8月27日MS模型预计FY2027Q3/Q4收入108.128/120.004bn，Data Center收入101.110/113.228bn；Rubin系列占DC GPU收入21%/35%是模型硬编码假设，带动混合ASP由40.735k升至43.243k美元。',
                'implication': '可用来拆GPU代际、量价及供给节奏，并与Google的GPU/TPU成本和容量假设交叉检查。没有Google客户分配，不能把NVIDIA增长率直接填入Cloud收入增长。',
                'sourceRefs': [source_id], 'publicationDate': '2026-08-27', 'applicablePeriods': ['FY2027Q3','FY2027Q4','FY2028'],
                'factors': ['Cloud收入增速','可交付容量','算力成本','毛利率'], 'strength': '原始卖方模型可见；客户归属和实际交付未确认',
                'limitations': ['NVIDIA财年截至次年1月，FY2027Q3不等于2027自然Q3；按Fiscal Year行识别期间。',
                    'IS的FactSet Year行与Fiscal Year行相差一年；日历日期存在近似标签，未据此生成官方季度截止日。',
                    'MS份额及ASP属于预测假设；分产品单位由收入/ASP反推，不是独立已确认出货量。',
                    '模型含更远期错误及陈旧辅助标题，本次仅引用已核对单元格；未将整本模型认证为正确。']})
        else:
            specs = [('NVDA','ES7','FY2027Q3','Revenue','USD mn'),('NVDA','ET7','FY2027Q4','Revenue','USD mn'),('NVDA','EZ7','FY2028','Revenue','USD mn')]
            out['crossCompanyEvidence'].append({'company': 'NVIDIA · GS与MS对照', 'relationship': '同一公司两套卖方预测',
                'claim': '8月27日GS模型对FY2027Q3/Q4收入预测为110.081/124.814bn，MS为108.128/120.004bn；FY2028分别718.299/690.168bn。',
                'implication': '显示供给与产品组合假设的分歧，用作情景范围的参考；两份模型不能自动代表全市场共识，也不是Google采购预算。',
                'sourceRefs': [source_id, 'local-nvda-ms-20260827'], 'publicationDate': '2026-08-27',
                'applicablePeriods': ['FY2027Q3','FY2027Q4','FY2028'], 'factors': ['Cloud收入增速','可交付容量'],
                'strength': '直接模型预测对照；对GOOGL的映射仍缺客户份额',
                'limitations': ['保留8月版本时点，未冒充11月更新。', 'GS部分远期季度标题和Datacenter标签陈旧；这里仅用主NVDA表已核对Fiscal Year期间。']})
        for sheet, cell, period, metric, unit in specs:
            value = values[sheet][cell].value
            assert isinstance(value, (int,float))
            formula = formulas[sheet][cell].value
            out['evidenceMetrics'].append({'company':'NVIDIA', 'broker': broker, 'metric': metric, 'period': period,
                'fiscalPeriod': period, 'value': value, 'unit': unit, 'status':'卖方预测缓存', 'publicationDate':'2026-08-27',
                'sheet':sheet, 'cell':cell, 'cachedValue':value, 'formula':formula if isinstance(formula,str) and formula.startswith('=') else None,
                'inputKind':'formula' if isinstance(formula,str) and formula.startswith('=') else 'hardcoded_assumption', 'sourceRefs':[source_id]})
        values.close(); formulas.close()
    target = ROOT / 'outputs/research/local_models/nvidia-evidence.json'
    target.write_text(json.dumps(out,ensure_ascii=False,indent=2,allow_nan=False),encoding='utf-8')
    print(json.dumps({'sources':len(out['sources']),'cards':len(out['crossCompanyEvidence']),'metrics':len(out['evidenceMetrics'])}))


if __name__ == '__main__':
    main()
