"""Inspect supplied PDF rights notices without distributing report bodies."""
from pathlib import Path
import json
import re
import zipfile
import fitz

ROOT = Path(__file__).resolve().parents[1]
inventory = json.loads((ROOT / 'outputs/research/local_reports/inventory.json').read_text(encoding='utf-8'))
entries = {e['sha256']: e for e in inventory['entries'] if e.get('extension') == '.pdf'}
patterns = [
    r'not permitted to publish[^.]{0,250}',
    r'(?:may not|must not|cannot)\s+(?:be\s+)?(?:reproduced|redistributed|copied|reprinted|distributed)[^.]{0,220}',
    r'(?:reproduced|redistributed|reprinted|copied)[^.]{0,150}without[^.]{0,70}(?:consent|permission)',
    r'(?:不得|未经).{0,100}(?:转载|复制|分发|许可|同意)',
]
rx = re.compile('|'.join(patterns), re.I)
rows = []
archives = {}
for entry in entries.values():
    archives.setdefault(entry['archive'], []).append(entry)
for archive, grouped in archives.items():
    with zipfile.ZipFile(archive) as z:
        for entry in grouped:
            row = {'id': entry['id'], 'filename': Path(entry['member']).name,
                   'sha256': entry['sha256'], 'status': 'permission_not_established'}
            try:
                with fitz.open(stream=z.read(entry['member']), filetype='pdf') as doc:
                    pages = sorted(set(list(range(min(2, len(doc)))) + list(range(max(0, len(doc)-5), len(doc)))))
                    for i in pages:
                        text = ' '.join(doc[i].get_text().split())
                        found = rx.search(text)
                        if found:
                            notice = re.split(r'for the exclusive use of|\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}', found.group(0), flags=re.I)[0]
                            row.update(status='restriction_notice_found', page=i+1,
                                       notice=notice[:260].strip())
                            break
            except Exception as exc:
                row.update(status='inspection_error', error=type(exc).__name__)
            rows.append(row)
summary = {status: sum(r['status'] == status for r in rows)
           for status in sorted(set(r['status'] for r in rows))}
out = ROOT / 'outputs/research/report-distribution-audit.json'
out.write_text(json.dumps({'reviewedAt': '2026-11-06', 'scope': 'first 2 and last 5 text pages per unique PDF; no license inference from silence',
                          'summary': summary, 'reports': rows}, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'reports': len(rows), 'summary': summary,
                  'noticeExamples': [r for r in rows if r['status'] == 'restriction_notice_found'][:2]}, ensure_ascii=False))
