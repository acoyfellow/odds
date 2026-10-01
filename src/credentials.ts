import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const ODDS_CONFIG_DIR = join(homedir(), '.config', 'odds');
export const KEYCHAIN_SERVICE = 'odds-gateway';
const CONFIG_FILE = join(ODDS_CONFIG_DIR, 'config.json');
const TOKEN_FILE = join(ODDS_CONFIG_DIR, 'token');
const OWNER_ONLY = 0o077;

export interface OddsConfig {
  accountId: string;
  gateway: string;
}

export type TokenSource = 'env' | 'keychain' | 'file';

export interface ResolvedToken {
  token: string;
  source: TokenSource;
}

export interface TokenSources {
  env: NodeJS.ProcessEnv;
  keychain: () => string | undefined;
  file: () => string | undefined;
}

function assertOwnerOnly(path: string): void {
  if ((statSync(path).mode & OWNER_ONLY) !== 0) {
    throw new Error(`${path} must be chmod 600`);
  }
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): OddsConfig {
  let fileConfig: Partial<OddsConfig> = {};
  try {
    fileConfig = JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) as Partial<OddsConfig>;
  } catch {
    fileConfig = {};
  }
  const accountId = env.ODDS_ACCOUNT_ID ?? fileConfig.accountId;
  const gateway = env.ODDS_GATEWAY ?? fileConfig.gateway ?? 'default';
  if (!accountId) throw new Error(`Set accountId in ${CONFIG_FILE} or ODDS_ACCOUNT_ID`);
  return { accountId, gateway };
}

export function tokenFromKeychain(): string | undefined {
  if (process.platform !== 'darwin') return undefined;
  try {
    const value = execFileSync(
      'security',
      ['find-generic-password', '-a', process.env.USER ?? '', '-s', KEYCHAIN_SERVICE, '-w'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5_000 },
    ).trim();
    return value || undefined;
  } catch {
    return undefined;
  }
}

export function tokenFromFile(path: string = TOKEN_FILE): string | undefined {
  try {
    assertOwnerOnly(path);
    return readFileSync(path, 'utf8').trim() || undefined;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

const defaultSources = (): TokenSources => ({
  env: process.env,
  keychain: tokenFromKeychain,
  file: tokenFromFile,
});

export function resolveToken(sources: TokenSources = defaultSources()): ResolvedToken {
  const fromEnv = sources.env.ODDS_TOKEN?.trim();
  if (fromEnv) return { token: fromEnv, source: 'env' };
  const fromKeychain = sources.keychain();
  if (fromKeychain) return { token: fromKeychain, source: 'keychain' };
  const fromFile = sources.file();
  if (fromFile) return { token: fromFile, source: 'file' };
  throw new Error(
    `No odds gateway token. Store one with: security add-generic-password -a "$USER" -s ${KEYCHAIN_SERVICE} -w`,
  );
}

export function readToken(): string {
  return resolveToken().token;
}

export function redact(text: string, secret: string): string {
  if (!secret) return text;
  return text.split(secret).join('[redacted]');
}
