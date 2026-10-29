import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = resolve(process.cwd(), 'src');
const read = (path: string) => readFileSync(resolve(src, path), 'utf8');

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    return entry.isDirectory() ? cssFiles(path) : entry.name.endsWith('.css') ? [path] : [];
  });
}

describe('design tokens', () => {
  it('defines the shared spacing and type scale once in the root theme', () => {
    const tokens = read('styles/tokens.css');
    for (const [name, value] of Object.entries({
      'space-1': 4, 'text-xs': 11, 'text-sm': 12, 'text-base': 13,
      'text-md': 15, 'text-lg': 18, 'text-xl': 20, 'text-2xl': 24, 'text-input': 16,
    })) {
      expect(tokens.match(new RegExp(`--${name}: ${value}px;`, 'g'))).toHaveLength(1);
    }
  });

  it('uses tokens for font sizes and the specified spacing literals', () => {
    const css = cssFiles(src).filter((path) => !path.endsWith('/tokens.css'))
      .map((path) => readFileSync(path, 'utf8')).join('\n');
    expect(css).not.toMatch(/font-size:\s*\d+px/);
    expect(css).not.toMatch(/(?:gap|padding|margin)[\w-]*:[^;]*\b(?:4|6|10|14)px/);
  });

  it('gives disabled buttons explicit theme colors and cursor', () => {
    expect(read('common/ui.module.css')).toMatch(/\.button:disabled\s*\{[^}]*background: var\(--surface-100\);[^}]*color: var\(--ink-muted\);[^}]*border-color: var\(--line\);[^}]*opacity: 1;[^}]*cursor: not-allowed;/);
    expect(read('common/ui.module.css')).toMatch(/\.primary:disabled\s*\{[^}]*background: var\(--line\);[^}]*color: var\(--ink-muted\);/);
    expect(read('auth/LoginPage.module.css')).toMatch(/\.submit:disabled\s*\{[^}]*background: var\(--line\);[^}]*color: var\(--ink-muted\);/);
    expect(read('imports/UploadForm.module.css')).toMatch(/\.clear:disabled\s*\{[^}]*color: var\(--ink-muted\);[^}]*opacity: 1;[^}]*cursor: not-allowed;/);
  });
});
