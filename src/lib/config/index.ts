import path from 'path';
import fs from 'fs';

interface PixelForgeConfig {
  figmaToken?: string;
}

const CONFIG_DIR = path.join(process.cwd(), '.pixelforge');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

function ensureDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
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
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

export function getFigmaToken(): string | null {
  const envToken = process.env.FIGMA_TOKEN;
  if (envToken) return envToken;
  const config = readConfig();
  return config.figmaToken ?? null;
}

export function setFigmaToken(token: string): void {
  const config = readConfig();
  config.figmaToken = token;
  writeConfig(config);
}
