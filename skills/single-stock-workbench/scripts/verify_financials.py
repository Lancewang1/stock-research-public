"""Build portable SEC verification and conservative disclosure-date evidence."""
from pathlib import Path
from datetime import date, timedelta
import json
import calendar

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'outputs/research/raw_sec'
AS_OF = '2026-11-05'


def main():
    facts = json.loads((RAW / 'alphabet-companyfacts.json').read_text(encoding='utf-8'))['facts']['us-gaap']
    case = json.loads((ROOT / 'outputs/googl-case.json').read_text(encoding='utf-8'))
    all_filings = []
    for filename in ['alphabet-submissions.json', 'alphabet-submissions-history.json', 'google-submissions.json']:
        path = RAW / filename
        if not path.exists():
            continue
        data = json.loads(path.read_text(encoding='utf-8'))
        table = data.get('filings', {}).get('recent', data)
        if not isinstance(table.get('form'), list):
            continue
        cik = '1288776' if filename.startswith('google-') else '1652044'
        for i, form in enumerate(table['form']):
            if form not in ['10-Q', '10-K', '8-K']:
                continue
            row = {k: v[i] for k, v in table.items() if isinstance(v, list) and len(v) == len(table['form'])}
            row['url'] = f"https://www.sec.gov/Archives/edgar/data/{cik}/{row['accessionNumber'].replace('-', '')}/{row['primaryDocument']}"
            all_filings.append(row)
    dates = {}
    for filing in all_filings:
        if filing['form'] not in ['10-Q', '10-K'] or not filing.get('reportDate'):
            continue
        end = date.fromisoformat(filing['reportDate'])
        period = f'{end.year}Q{(end.month - 1)//3+1}'
        if period in dates or end.month not in [3, 6, 9, 12]:
            continue
        filed = date.fromisoformat(filing['filingDate'])
        candidates = [x for x in all_filings if x['form'] == '8-K' and '2.02' in x.get('items', '')
                      and 0 <= (filed - date.fromisoformat(x['filingDate'])).days <= 4]
        release = min(candidates, key=lambda x: x['filingDate']) if candidates else filing
        dates[period] = {'period': period, 'date': release['filingDate'], 'url': release['url'],
                         'basis': 'SEC 8-K Item 2.02 filing' if candidates else 'SEC periodic filing',
                         'effectiveRule': 'next_trading_day',
                         'note': '公告时刻未逐项核实，统一从下一交易日使用，避免盘后数据提前进入当日估值。'}

    def pick(tag, start, end, unit='USD'):
        rows = facts.get(tag, {}).get('units', {}).get(unit, [])
        matches = [r for r in rows if r.get('start') == start and r.get('end') == end and r.get('filed', '') <= AS_OF and r.get('form') in ['10-Q', '10-K']]
        return min(matches, key=lambda r: r['filed']) if matches else None

    verified = {}
    checks = []
    for q in case['quarters']:
        if q['kind'] != 'actual':
            continue
        year, quarter = map(int, q['period'].split('Q'))
        month = quarter * 3
        start = date(year, month - 2, 1).isoformat()
        end = date(year, month, calendar.monthrange(year, month)[1]).isoformat()
        mapping = {'revenue': ('Revenues', 'USD'), 'netIncome': ('NetIncomeLoss', 'USD'),
                   'operatingIncome': ('OperatingIncomeLoss', 'USD'),
                   'reportedEps': ('EarningsPerShareDiluted', 'USD/shares'),
                   'dilutedShares': ('WeightedAverageNumberOfDilutedSharesOutstanding', 'shares'),
                   'netIncomeAvailableToCommon': ('NetIncomeLossAvailableToCommonStockholdersBasic', 'USD'),
                   'dilutedEarnings': ('NetIncomeLossAvailableToCommonStockholdersDiluted', 'USD'),
                   'preferredDividends': ('PreferredStockDividendsIncomeStatementImpact', 'USD')}
        row = {'period': q['period'], 'facts': {}, 'sourceRefs': []}
        for field, (tag, unit) in mapping.items():
            value = pick(tag, start, end, unit)
            if value is None:
                continue
            scaled = value['val'] if unit == 'USD/shares' else value['val'] / 1e6
            row[field] = scaled
            row['facts'][field] = {**value, 'tag': tag, 'unit': unit}
            row['sourceRefs'].append(f"sec-companyfacts:{tag}:{value['accn']}:{start}/{end}")
            if field in ['revenue', 'netIncome', 'operatingIncome', 'dilutedShares']:
                diff = q[field] - scaled
                checks.append({'period': q['period'], 'field': field, 'modelValue': q[field], 'secValue': scaled, 'difference': diff,
                               'status': 'match' if abs(diff) < .01 else 'difference'})
        if 'reportedEps' in row:
            row['modelEps'] = q['eps']
            row['epsDifference'] = q['eps'] - row['reportedEps']
        if 'dilutedEarnings' not in row and 'netIncomeAvailableToCommon' in row:
            row['dilutedEarnings'] = row['netIncomeAvailableToCommon']
            row['dilutedEarningsBasis'] = 'basic common earnings fallback; no explicit diluted numerator fact'
        elif 'dilutedEarnings' in row:
            row['dilutedEarningsBasis'] = 'SEC directly tagged diluted common earnings numerator'
        if 'preferredDividends' not in row:
            row['preferredDividends'] = 0
            row['preferredDividendsBasis'] = 'no separately tagged preferred dividend for this quarter; model assumption zero'
        else:
            row['preferredDividendsBasis'] = 'SEC directly reported preferred dividend for the actual quarter; locked'
        verified[q['period']] = row
    payload = {'asOf': AS_OF, 'source': {'id': 'sec-companyfacts', 'title': 'Alphabet SEC companyfacts',
               'url': 'https://data.sec.gov/api/xbrl/companyfacts/CIK0001652044.json', 'kind': 'company_filing'},
               'quarters': verified, 'checks': checks,
               'epsNote': '季度公告EPS与模型原EPS分开展示。可转优先股的if-converted反稀释判断可能随季度/全年变化；情景年度EPS为季度普通股盈利汇总除以加权股数，未模拟完整年度转换测试。'}
    (ROOT / 'assets/financial-verification.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    (ROOT / 'assets/publication_dates.json').write_text(json.dumps(list(sorted(dates.values(), key=lambda r:r['period'])), ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'verifiedQuarters': len(verified), 'checks': len(checks), 'differences': [x for x in checks if x['status']=='difference'], 'publicationDates': len(dates)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
