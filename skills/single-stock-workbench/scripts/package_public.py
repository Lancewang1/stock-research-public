"""Build a portable public skill and ZIP; never uploads raw provider/report files."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
REMOVED_KEYS = {'file', 'filePath', 'localPath', 'localDocumentUrl', 'archive', 'member', 'retrievalAudit', 'localMaterialAudits'}


def sanitize(value):
    if isinstance(value, dict):
        return {k: sanitize(v) for k, v in value.items() if k not in REMOVED_KEYS}
    if isinstance(value, list):
        return [sanitize(v) for v in value]
    if isinstance(value, str):
        value = value.replace(str(ROOT.parent), '[local materials]').replace(ROOT.parent.as_posix(), '[local materials]')
        return re.sub(r'[A-Za-z]:[\\/]Users[\\/][^\\/\s]+', '[local user]', value)
    return value


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--repo', type=Path, required=True)
    args = parser.parse_args()
    repo = args.repo.resolve()
    target = repo / 'skills/single-stock-workbench'
    target.mkdir(parents=True, exist_ok=True)
    selected = [ROOT / 'SKILL.md', ROOT / 'README.md']
    for folder in ('agents', 'assets', 'references', 'scripts', 'tests'):
        selected.extend(p for p in (ROOT/folder).rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.suffix != '.pyc')
    for rel in ['outputs/research/report-distribution-audit.json',
                'outputs/research/customer_evidence_20261106/historical-checks.json']:
        selected.append(ROOT/rel)
    for src in selected:
        dst = target/src.relative_to(ROOT)
        dst.parent.mkdir(parents=True, exist_ok=True)
        if src.suffix == '.json':
            content = json.dumps(sanitize(json.loads(src.read_text(encoding='utf-8-sig'))), ensure_ascii=False, indent=2)
        else:
            content = sanitize(src.read_text(encoding='utf-8-sig'))
        dst.write_text(content, encoding='utf-8', newline='\n')
    published = repo/'demos/googl-workbench/index.html'
    rebuilt = target/'outputs/googl-dashboard.html'
    subprocess.run([sys.executable, '-X', 'utf8', str(target/'scripts/build_dashboard.py'),
                    '--case', str(target/'assets/example-googl-case.json'), '--output', str(rebuilt), '--public'], check=True)
    if rebuilt.read_bytes() != published.read_bytes():
        raise RuntimeError('Public skill does not reproduce the published HTML byte-for-byte')
    files = sorted(p for p in target.rglob('*') if p.is_file())
    # Fail closed on unexpected stale binaries or provider dumps in the target.
    expected = {str(p.relative_to(ROOT)).replace('\\', '/') for p in selected} | {'outputs/googl-dashboard.html', 'MANIFEST.json'}
    if any(p.relative_to(target).as_posix() not in expected for p in files):
        raise RuntimeError('Unexpected files in public skill staging directory')
    manifest = {'release': '2026-11-07-model-language-audit', 'offlineRebuild': 'byte-identical',
                'browserVisualAcceptance': 'waived_by_user_browser_connection_unavailable', 'rawReportsIncluded': False,
                'files': [{'path': p.relative_to(target).as_posix(), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest(),
                           'bytes': p.stat().st_size} for p in files if p.name != 'MANIFEST.json']}
    (target/'MANIFEST.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8', newline='\n')
    archive = repo/'downloads/single-stock-workbench.zip'
    archive.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
        for p in sorted(target.rglob('*')):
            if p.is_file():
                info = zipfile.ZipInfo('single-stock-workbench/'+p.relative_to(target).as_posix(), (2026,11,7,0,0,0))
                info.compress_type = zipfile.ZIP_DEFLATED
                z.writestr(info, p.read_bytes())
    with zipfile.ZipFile(archive) as z:
        if z.testzip() is not None:
            raise RuntimeError('ZIP integrity check failed')
    print(json.dumps({'files': len(manifest['files'])+1, 'zipBytes': archive.stat().st_size,
                      'zipSHA256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'offlineRebuild': 'identical'}))


if __name__ == '__main__':
    main()
