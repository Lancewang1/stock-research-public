"""Fetch bounded FRED macro history without persisting API credentials."""
from pathlib import Path
from datetime import datetime, timezone
import argparse
import json
import requests


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-dir', type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    config = next(args.source_dir.glob('API *.txt')).read_text(encoding='utf-8-sig')
    api_key = None
    for line in config.splitlines():
        cols = [x.strip().strip('`') for x in line.split('|')]
        if len(cols) > 3 and cols[1].startswith('FRED_API_KEY'):
            api_key = cols[2]
            break
    if not api_key:
        raise ValueError('FRED key not found')
    result = {'asOf': '2026-11-05', 'fetchedAt': datetime.now(timezone.utc).isoformat(), 'series': [], 'log': []}
    raw = root / 'outputs/research/raw_macro'
    raw.mkdir(parents=True, exist_ok=True)
    for series_id, name, unit in [('DGS10', '美国10年期国债收益率', '%'), ('VIXCLS', 'VIX', 'index'), ('DTWEXBGS', '美联储广义贸易加权美元指数', 'index')]:
        entry = {'id': series_id, 'name': name, 'unit': unit, 'url': f'https://fred.stlouisfed.org/series/{series_id}'}
        try:
            response = requests.get('https://api.stlouisfed.org/fred/series/observations', params={'series_id': series_id, 'api_key': api_key, 'file_type': 'json', 'observation_start': '2026-09-01', 'observation_end': '2026-11-04'}, timeout=35)
            status = {'id': series_id, 'httpStatus': response.status_code}
            if response.ok:
                data = response.json()
                (raw / f'{series_id}.json').write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
                entry['observations'] = [{'date': x['date'], 'value': float(x['value'])} for x in data.get('observations', []) if x['value'] != '.']
                result['series'].append(entry)
                status['observations'] = len(entry['observations'])
            result['log'].append(status)
        except (requests.RequestException, ValueError) as exc:
            result['log'].append({'id': series_id, 'errorType': type(exc).__name__})
    (root / 'assets/macro-evidence.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(result['log']))


if __name__ == '__main__':
    main()
