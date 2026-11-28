/// <reference types="node" />
import { globSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = Object.fromEntries(globSync('src/**/*.css').map((file) => [file, readFileSync(file, 'utf8')]))

function withoutComments(source: string) {
  // Preserve line numbers while ignoring explanatory comments.
  return source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
}

function violations(source: string) {
  const css = withoutComments(source)
  const rules = [
    /#[\da-f]{3,8}\b|\b(?:rgba?|hsla?)\s*\(/gi,
    /\bfont-size\s*:[^;}]*\b\d*\.?\d+(?:px|rem)\b/gi,
    /(?<![\w.])44px\b/gi,
    /(?:^|[;{])\s*(?:min-|max-)?height\s*:[^;}]*\b48px\b/gi,
  ]
  return rules.flatMap((rule) => [...css.matchAll(rule)].map((match) => {
    const offset = match.index + match[0].search(/[^\s;{]/)
    return `${css.slice(0, offset).split('\n').length}: ${match[0].replace(/^[;{]\s*/, '').trim()}`
  }))
}

function typographyViolations(source: string, tokens: string, allowDefinitions = false) {
  const css = withoutComments(source)
  const definitions = /--(?:text|line-height)-[\w-]+\s*:/g
  const defined = new Set([...withoutComments(tokens).matchAll(definitions)].map((match) => match[0].replace(/\s*:$/, '')))
  const overrides = allowDefinitions ? [] : [...css.matchAll(definitions)]
  const unknown = [...css.matchAll(/var\(\s*(--(?:text|line-height)-[\w-]+)/g)]
    .filter((match) => !defined.has(match[1]))
  return [...overrides, ...unknown].map((match) =>
    `${css.slice(0, match.index).split('\n').length}: ${match[0]}`)
}

describe('design tokens', () => {
  it('detects literals, allows column widths and ignores comments', () => {
    expect(violations('/* 44px */\n.x { width: 48px; grid-template-columns: 1fr 48px; font-size: 1em; }')).toEqual([])
    expect(violations('.x { color: #abc; background: rgb(0 0 0); font-size: 1.2rem; width: 44px; min-height: 48px; }')).toHaveLength(5)
    expect(violations('.x {\n height:\n 48px;\n}')).toEqual(['2: height:\n 48px'])
  })

  it('detects typography overrides and unknown references while ignoring comments', () => {
    const tokens = '/* --text-fake: 1px; */\n:root { --text-body: 13px; --line-height-body: 19px; }'
    expect(typographyViolations('/* --text-local: 2px;\n var(--text-missing) */\n.x { font-size: var(--text-body); line-height: var( --line-height-body); }', tokens)).toEqual([])
    expect(typographyViolations('.x {\n --text-local: 13px;\n --line-height-local: 19px;\n font-size: var(--text-fake, 13px);\n line-height: var(--line-height-missing);\n}', tokens)).toEqual([
      '2: --text-local:', '3: --line-height-local:', '4: var(--text-fake', '5: var(--line-height-missing',
    ])
    expect(typographyViolations(tokens, tokens, true)).toEqual([])
    expect(typographyViolations(':root { --text-body: var(--text-missing); }', tokens, true)).toEqual(['1: var(--text-missing'])
  })

  it('defines typography only in tokens.css and resolves every typography reference', () => {
    const failures = Object.entries(styles).flatMap(([file, css]) =>
      typographyViolations(css, styles['src/styles/tokens.css'], file === 'src/styles/tokens.css')
        .map((violation) => `${file}:${violation}`))
    expect(failures, failures.join('\n')).toEqual([])
  })

  it('uses tokens for colors, font sizes and control dimensions', () => {
    // apps/web 밖에서 실행하면 glob이 비어 검사 없이 통과하므로 막는다.
    expect(Object.keys(styles).length).toBeGreaterThan(10)
    const failures = Object.entries(styles)
      .filter(([file]) => file !== 'src/styles/tokens.css')
      .flatMap(([file, css]) => violations(css).map((violation) => `${file}:${violation}`))
    expect(failures, failures.join('\n')).toEqual([])
  })
})
