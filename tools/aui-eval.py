#!/usr/bin/env python3
"""AUI golden-set evaluator.

Runs tools/aui-golden.json through the live plugin's /aui/eval endpoint and prints
accuracy / precision / recall plus a per-case table. The endpoint uses the Host's
default model, so this measures the real model-judged pipeline, not a mock.

Usage:
  DSH_WEB_URL="http://127.0.0.1:62306/?token=..." python tools/aui-eval.py [--threshold 0.6] [--json out.json]

Requirements: Python 3.9+, playwright, and a Chromium build
(set PLAYWRIGHT_CHROME=/path/to/chrome if it is not found automatically).
"""
import argparse
import json
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
GOLDEN = ROOT / 'aui-golden.json'
CHROME = os.environ.get('PLAYWRIGHT_CHROME', '')


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--threshold', type=float, default=0.6)
    parser.add_argument('--json', default='')
    parser.add_argument('--batch-size', type=int, default=6)
    args = parser.parse_args()

    url = os.environ.get('DSH_WEB_URL', '').strip()
    if not url:
        fallback = Path('/tmp/dsh-auth-url.txt')
        if fallback.exists():
            url = fallback.read_text().strip()
    if not url:
        print('missing DSH_WEB_URL (authenticated Web URL, e.g. http://127.0.0.1:62306/?token=...)', file=sys.stderr)
        return 1

    golden = json.loads(GOLDEN.read_text(encoding='utf-8'))
    cases = golden['cases']
    results = []
    with sync_playwright() as playwright:
        launch = {'headless': True}
        if CHROME:
            launch['executable_path'] = CHROME
        browser = playwright.chromium.launch(**launch)
        page = browser.new_page(viewport={'width': 1200, 'height': 800})
        page.goto(url, wait_until='domcontentloaded', timeout=60000)
        page.wait_for_timeout(3500)
        for offset in range(0, len(cases), args.batch_size):
            batch = [{'id': case['id'], 'text': case['text']} for case in cases[offset:offset + args.batch_size]]
            payload = json.dumps({'cases': batch}, ensure_ascii=False)
            out = page.evaluate(
                """async (payload) => {
                  const r = await fetch('/api/plugin-discovery/aui/eval', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: payload,
                  });
                  return { status: r.status, body: r.ok ? await r.json() : await r.text() };
                }""",
                payload,
            )
            if out['status'] != 200:
                print(f"HTTP {out['status']}: {out['body']}", file=sys.stderr)
                return 1
            results.extend(out['body']['results'])
            print(f"batch {offset // args.batch_size + 1}/{(len(cases) + args.batch_size - 1) // args.batch_size}: {len(results)} results")
        browser.close()

    by_id = {case['id']: case for case in cases}
    positives = sum(1 for case in cases if case['kind'] == 'positive')
    negatives = len(cases) - positives
    tp = wrong = fn = fp = tn = 0
    for result in results:
        case = by_id[result['id']]
        suggested = result['suggest'] and result['confidence'] >= args.threshold
        if case['kind'] == 'positive':
            if suggested and result['plugin'] in case['expect']:
                tp += 1
            elif suggested:
                wrong += 1
            else:
                fn += 1
        elif suggested:
            fp += 1
        else:
            tn += 1
    precision = tp / (tp + wrong + fp) if tp + wrong + fp else 0.0
    recall = tp / positives if positives else 0.0
    accuracy = (tp + tn) / len(results) if results else 0.0
    print(f"\nthreshold {args.threshold:.2f}: hits {tp}/{positives}, wrong {wrong}, missed {fn}, false positives {fp}/{negatives}")
    print(f'accuracy {accuracy:.1%} | precision {precision:.1%} | recall {recall:.1%} | latency {sum(r["latencyMs"] for r in results) / len(results):.0f} ms')
    for result in results:
        case = by_id[result['id']]
        suggested = result['suggest'] and result['confidence'] >= args.threshold
        if case['kind'] == 'positive' and not (suggested and result['plugin'] in case['expect']):
            print(f"  miss/wrong: {case['id']} -> {result['plugin']} ({result['confidence']:.2f})")
        elif case['kind'] == 'negative' and suggested:
            print(f"  false positive: {case['id']} -> {result['plugin']} ({result['confidence']:.2f})")
    if args.json:
        Path(args.json).write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
