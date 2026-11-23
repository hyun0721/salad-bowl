/// <reference types="node" />
import { globSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = Object.fromEntries(globSync('src/**/*.css').map((file) => [file, readFileSync(file, 'utf8')]))

function violations(source: string) {
  // Preserve line numbers while ignoring explanatory comments.
  const css = source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
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

describe('design tokens', () => {
  it('detects literals, allows column widths and ignores comments', () => {
    expect(violations('/* 44px */\n.x { width: 48px; grid-template-columns: 1fr 48px; font-size: 1em; }')).toEqual([])
    expect(violations('.x { color: #abc; background: rgb(0 0 0); font-size: 1.2rem; width: 44px; min-height: 48px; }')).toHaveLength(5)
    expect(violations('.x {\n height:\n 48px;\n}')).toEqual(['2: height:\n 48px'])
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
