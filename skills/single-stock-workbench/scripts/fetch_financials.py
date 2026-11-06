"""Fetch public SEC facts and filing metadata; credentials stay in memory."""
from pathlib import Path
import argparse
import json
import re
from datetime import datetime, timezone
import requests


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-dir', type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    out = root / 'outputs' / 'research' / 'raw_sec'
    out.mkdir(parents=True, exist_ok=True)
    config = next(args.source_dir.glob('API *.txt')).read_text(encoding='utf-8-sig')
    ua = None
    for line in config.splitlines():
        cols = [x.strip().strip('`') for x in line.split('|')]
        if len(cols) > 3 and cols[1] == 'SEC_USER_AGENT':
            ua = cols[2]
            break
    if not ua:
        raise ValueError('SEC_USER_AGENT not found in supplied configuration')
    session = requests.Session()
    session.headers.update({'User-Agent': ua, 'Accept-Encoding': 'gzip, deflate', 'Accept': 'application/json'})
    log = []
    for label, url in [
        ('alphabet-submissions', 'https://data.sec.gov/submissions/CIK0001652044.json'),
        ('alphabet-companyfacts', 'https://data.sec.gov/api/xbrl/companyfacts/CIK0001652044.json'),
        ('alphabet-submissions-history', 'https://data.sec.gov/submissions/CIK0001652044-submissions-001.json'),
        ('google-submissions', 'https://data.sec.gov/submissions/CIK0001288776.json'),
    ]:
        item = {'id': label, 'url': url, 'fetchedAt': datetime.now(timezone.utc).isoformat()}
        try:
            response = session.get(url, timeout=40)
            item['httpStatus'] = response.status_code
            if response.ok:
                payload = response.json()
                (out / f'{label}.json').write_text(json.dumps(payload, ensure_ascii=False), encoding='utf-8')
                item['status'] = 'retrieved'
                if label.endswith('submissions'):
                    r = payload.get('filings', {}).get('recent', {})
                    item['lastFilingDate'] = (r.get('filingDate') or [None])[0]
            else:
                item['status'] = 'http_error'
        except (requests.RequestException, ValueError) as exc:
            item['status'] = type(exc).__name__
        log.append(item)
        print(json.dumps(item, ensure_ascii=False))
    (out / 'fetch-log.json').write_text(json.dumps(log, ensure_ascii=False, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
