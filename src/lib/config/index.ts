import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

interface PixelForgeConfig {
  figmaToken?: string;
  figmaTokenEncrypted?: string;
}

const CONFIG_DIR = path.join(process.cwd(), '.pixelforge');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

function ensureDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function getEncryptionKey(): Buffer {
  const secretPath = path.join(CONFIG_DIR, '.session-secret');
  let key = 'pixelforge-local-encryption-key-default';
  try {
    const stored = fs.readFileSync(secretPath, 'utf-8').trim();
    if (stored.length >= 32) key = stored;
  } catch { /* 시크릿 파일 없으면 기본 키 사용 */ }
  return crypto.createHash('sha256').update(key).digest();
}

function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(encoded: string): string | null {
  try {
    const [ivHex, tagHex, dataHex] = encoded.split(':');
    if (!ivHex || !tagHex || !dataHex) return null;
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return decipher.update(dataHex, 'hex', 'utf8') + decipher.final('utf8');
  } catch {
    return null;
  }
}

export function readConfig(): PixelForgeConfig {
  ensureDir();
  if (!fs.existsSync(CONFIG_PATH)) return {};
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw) as PixelForgeConfig;
  } catch {
    return {};
  }
}

export function writeConfig(config: PixelForgeConfig): void {
  ensureDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { encoding: 'utf-8', mode: 0o600 });
}

export function getFigmaToken(): string | null {
  const envToken = process.env.FIGMA_TOKEN;
  if (envToken) return envToken;

  const config = readConfig();

  if (config.figmaTokenEncrypted) {
    return decrypt(config.figmaTokenEncrypted);
  }

  // 평문 토큰이 남아있으면 암호화로 마이그레이션
  if (config.figmaToken) {
    const token = config.figmaToken;
    config.figmaTokenEncrypted = encrypt(token);
    delete config.figmaToken;
    writeConfig(config);
    return token;
  }

  return null;
}

export function setFigmaToken(token: string): void {
  const config = readConfig();
  config.figmaTokenEncrypted = encrypt(token);
  delete config.figmaToken;
  writeConfig(config);
}
