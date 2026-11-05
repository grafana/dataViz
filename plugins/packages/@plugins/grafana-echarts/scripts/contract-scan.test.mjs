// Tests of the `fixtures.11` scan. Run: node --test 'scripts/*.test.mjs' (`pnpm run test:ci` runs it after Jest).
// https://nodejs.org/api/test.html
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { isAllowedUrl, scanContractFiles } from './contract-scan.mjs';

describe('isAllowedUrl', () => {
  test('allows the public hosts and the loopback host', () => {
    for (const url of [
      'https://grafana.com',
      'https://grafana.com/docs/grafana/latest/',
      'https://www.grafana.com/x?y=1',
      'https://github.com/grafana/dataViz#readme',
      'https://json-schema.org/draft/2020-12/schema',
      'https://echarts.apache.org/en/option.html',
      'https://example.org/',
      'http://localhost:3000/d/abc',
      'http://127.0.0.1',
    ]) {
      assert.equal(isAllowedUrl(url), true, url);
    }
  });

  test('rejects a longer host, a user part and other hosts', () => {
    for (const url of [
      'https://grafana.com.evil.io/x',
      'https://github.com.attacker.net/a',
      'https://example.com.evil.test',
      'https://grafana.com-evil.io/',
      'https://grafana.com@evil.io/',
      'https://grafana.com:443@evil.io/',
      'http://localhost.evil.io/',
      'http://grafana.com/',
      'https://evil.io/?u=https://grafana.com/',
    ]) {
      assert.equal(isAllowedUrl(url), false, url);
    }
  });
});

describe('scanContractFiles', () => {
  test('gives no problem for a clean file', () => {
    assert.deepEqual(scanContractFiles(new Map([['a.json', '{"link": "https://grafana.com/docs"}']])), []);
  });

  test('names the file and the type of each problem, and never the value', () => {
    const hits = scanContractFiles(
      new Map([
        ['token.json', '{"token": "abc"}'],
        ['url.json', '{"link": "https://grafana.com.evil.io/x"}'],
      ])
    );
    assert.deepEqual(hits, ['token.json: password', 'url.json: URL that is not on the allowed list']);
  });
});
