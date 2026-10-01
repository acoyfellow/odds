import { describe, expect, test } from 'bun:test';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { redact, resolveToken, tokenFromFile } from '../src/credentials.ts';

const none = () => undefined;

describe('resolveToken', () => {
  test('prefers env, then keychain, then file', () => {
    expect(
      resolveToken({ env: { ODDS_TOKEN: 'e' }, keychain: () => 'k', file: () => 'f' }),
    ).toEqual({
      token: 'e',
      source: 'env',
    });
    expect(resolveToken({ env: {}, keychain: () => 'k', file: () => 'f' }).source).toBe('keychain');
    expect(resolveToken({ env: {}, keychain: none, file: () => 'f' }).source).toBe('file');
  });

  test('fails with a keychain hint when nothing is configured', () => {
    expect(() => resolveToken({ env: {}, keychain: none, file: none })).toThrow(/odds-gateway/);
  });

  test('has no wrangler fallback in the source', () => {
    const source = readFileSync(join(import.meta.dir, '..', 'src', 'credentials.ts'), 'utf8');
    expect(source).not.toContain('wrangler');
  });
});

describe('tokenFromFile', () => {
  test('refuses a group- or world-readable token file', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'odds-')), 'token');
    writeFileSync(path, 'secret-file-token\n');
    chmodSync(path, 0o644);
    expect(() => tokenFromFile(path)).toThrow(/chmod 600/);
    chmodSync(path, 0o600);
    expect(tokenFromFile(path)).toBe('secret-file-token');
  });

  test('returns undefined when the file is missing', () => {
    expect(tokenFromFile(join(tmpdir(), 'odds-missing-token'))).toBeUndefined();
  });
});

describe('redact', () => {
  test('removes every occurrence of the secret', () => {
    expect(redact('Bearer abc123 failed; abc123', 'abc123')).toBe(
      'Bearer [redacted] failed; [redacted]',
    );
    expect(redact('nothing here', '')).toBe('nothing here');
  });
});
