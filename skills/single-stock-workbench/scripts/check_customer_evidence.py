"""Reproduce provisional historical checks; never writes production model inputs."""
from pathlib import Path
import hashlib
import json
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'outputs/research/customer_evidence_20261106'


def items(name):
    outer = json.loads((RAW / f'{name}.json').read_text(encoding='utf-8'))
    return json.loads(outer['content'][0]['text'])['data']['items']


def main():
    filing = items('anthropic_note8')[0]
    source_text = ' '.join(BeautifulSoup(filing['content'], 'html.parser').get_text(' ', strip=True).split())
    # Check the complete contiguous rows against the archived provider response.
    # This checks transcription, not independent authenticity of the filing.
    for row in [
        'Revenue $41 $386 $4,585 $1,163 $16,286',
        'Compute and infrastructure 433 2,522 7,326 2,334 8,945',
        'Cost of revenue(1) $26 $752 $2,773 $1,019 $2,380',
        'Research and development(2) 422 2,275 6,338 1,850 9,741',
    ]:
        if row not in source_text:
            raise ValueError('Archived table differs from the reviewed transcription')
    data = [
        ('2023', 41, 433, 26, 422),
        ('2024', 386, 2522, 752, 2275),
        ('2025', 4585, 7326, 2773, 6338),
        ('2025H1', 1163, 2334, 1019, 1850),
        ('2026H1', 16286, 8945, 2380, 9741),
    ]
    historical = []
    for period, revenue, compute, cor, rd in data:
        historical.append({
            'period': period, 'unit': 'USD million', 'revenue': revenue,
            'computeInfrastructureExpense': compute, 'costOfRevenue': cor,
            'researchDevelopmentExpense': rd, 'interimUnaudited': 'H1' in period,
            'computeRevenuePct': compute / revenue * 100,
            'costOfRevenuePct': cor / revenue * 100,
            'originalScenarioTotalComputeProxy': revenue * .4 / (1 - .6),
            'proxyMinusReportedComputePct': (revenue / compute - 1) * 100,
            # Conditional on serving-compute being included within cost of revenue.
            # The residual includes research/internal use; it is NOT pure training.
            'nonServingComputeLowerBoundPct': max(0, 1 - cor / compute) * 100,
        })
    scenarios = []
    for inference, training_share, google_inference, google_training in [
        (.4, .6, .25, .30), (.8, .6, .125, .15), (.2, .6, .5, .6)
    ]:
        training = inference * training_share / (1 - training_share)
        scenarios.append({
            'inferenceExpenseRevenue': inference, 'trainingShare': training_share,
            'googleInferenceShare': google_inference, 'googleTrainingShare': google_training,
            'googleDemandRevenue': inference * google_inference + training * google_training,
        })
    result = {
        'asOf': '2026-11-06', 'status': 'provisional_source_transcription_not_out_of_sample_validation',
        'source': {k: filing[k] for k in ('date', 'title', 'url')},
        'sourceSHA256': hashlib.sha256((RAW / 'anthropic_note8.json').read_bytes()).hexdigest(),
        'limitations': [
            'SEC original unavailable (HTTP 403); Wind transcription only.',
            'Expense is not cash procurement, and 2026 compute includes leases/depreciation.',
            'Cost of revenue is a serving-cost proxy, not exact inference procurement.',
            'Research and development is not pure training.',
            'Annual and first-half observations overlap; no regression or statistical validation.',
            'These are retrospective compatibility checks of a forward scenario, not historical forecasts.',
        ],
        'anthropic': historical,
        'openaiSecondaryOnly': [
            {'period': '2024', 'revenue': 3700, 'costOfRevenue': 2650,
             'costOfRevenuePct': 2650 / 3700 * 100},
            {'period': '2025', 'revenue': 13070, 'costOfRevenue': 7500,
             'costOfRevenuePct': 7500 / 13070 * 100},
        ],
        'nonIdentifiabilityExample': scenarios,
        'productionInputsChanged': False,
    }
    target = RAW / 'historical-checks.json'
    target.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'output': str(target), 'anthropic': historical,
                      'nonIdentifiabilityExample': scenarios}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
