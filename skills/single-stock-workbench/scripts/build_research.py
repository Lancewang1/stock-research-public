"""Merge audited static evidence snapshots without making network requests."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]


def main():
    assets = ROOT / 'assets'
    recent = json.loads((assets / 'research-recent.json').read_text(encoding='utf-8'))
    chain = json.loads((assets / 'research-chain.json').read_text(encoding='utf-8'))
    macro = json.loads((assets / 'macro-evidence.json').read_text(encoding='utf-8'))
    case = json.loads((ROOT / 'outputs/googl-case.json').read_text(encoding='utf-8'))
    local = []
    for filename in ['research-local-models.json', 'research-local-reports.json',
                     'research-anthropic.json', 'research-contracts.json']:
        path = assets / filename
        if path.exists():
            local.append(json.loads(path.read_text(encoding='utf-8-sig')))
    sources = {}
    for source in recent.get('sources', []) + chain.get('sources', []) + [s for part in local for s in part.get('sources', [])]:
        source = dict(source)
        previous = sources.get(source['id'], {})
        if any(previous[key] != source[key] for key in previous.keys() & source.keys()):
            raise ValueError('Conflicting source ID: ' + source['id'])
        sources[source['id']] = {**previous, **source}
    for source in case['sources']:
        sources[source['id']] = {**source, 'title': source.get('title', source.get('label', source['id'])),
                                  'date': source.get('date', source.get('asOf'))}
    for series in macro['series']:
        source_id = 'fred-' + series['id']
        sources[source_id] = {'id': source_id, 'title': series['name'], 'url': series['url'],
                              'date': series['observations'][-1]['date'] if series['observations'] else None,
                              'kind': 'macro_api', 'file': f"outputs/research/raw_macro/{series['id']}.json", 'note': 'FRED直接API；各序列真实末日独立显示。'}
    merged = {**recent, **{k: v for k,v in chain.items() if k not in ['sources', 'asOf']},
              'asOf': max(recent['asOf'], chain['asOf']), 'sources': list(sources.values()),
              'macroEvidence': macro, 'financialVerification': case.get('financialVerification', {})}
    for part in local:
        for replacement in part.get('supersedesEvidence', []):
            previous = merged.get('crossCompanyEvidence', [])
            matches = [row for row in previous if row.get('company') == replacement['company']
                       and row.get('claim') == replacement['claim']]
            replacements = [row for row in part.get('crossCompanyEvidence', [])
                            if row.get('company') == replacement['replacementCompany']
                            and row.get('claim') == replacement['replacementClaim']]
            if len(matches) != 1 or len(replacements) != 1:
                raise ValueError('Evidence replacement must match one old and one new card')
            merged['crossCompanyEvidence'] = [row for row in previous if row is not matches[0]]
        for replacement in part.get('supersedesMetrics', []):
            previous = merged.get('evidenceMetrics', [])
            if sum(row.get('id') == replacement['id'] for row in previous) != 1:
                raise ValueError('Metric replacement must identify exactly one old metric')
            if sum(row.get('id') == replacement['replacementId'] for row in part.get('evidenceMetrics', [])) != 1:
                raise ValueError('Metric replacement must identify exactly one new metric')
            merged['evidenceMetrics'] = [row for row in previous if row.get('id') != replacement['id']]
        for key in ['crossCompanyEvidence', 'evidenceMetrics', 'relationships', 'contracts']:
            merged.setdefault(key, []).extend(part.get(key, []))
    merged['localMaterialAudits'] = [part.get('inventorySummary', part.get('modelInventory', part.get('reportInventory', part.get('audit', {})))) for part in local]
    merged['localMaterialGaps'] = [gap for part in local for gap in part.get('materialGaps', [])]
    missing = []
    def walk(value):
        if isinstance(value, dict):
            for ref in value.get('sourceRefs', []):
                if ref not in sources and ref.split(':')[0] not in sources:
                    missing.append(ref)
            for child in value.values():
                walk(child)
        elif isinstance(value, list):
            for child in value:
                walk(child)
    walk(merged)
    if missing:
        raise ValueError('Unresolved evidence sources: ' + ', '.join(sorted(set(missing))))
    (assets / 'research.json').write_text(json.dumps(merged, ensure_ascii=False, indent=2, allow_nan=False), encoding='utf-8')
    print(json.dumps({'sources': len(sources), 'drawdowns': len(merged.get('drawdowns', [])),
                      'crossCompanyEvidence': len(merged.get('crossCompanyEvidence', [])), 'unresolvedReferences': 0}))


if __name__ == '__main__':
    main()
