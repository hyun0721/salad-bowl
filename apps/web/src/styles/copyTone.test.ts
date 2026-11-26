/// <reference types="node" />
import { globSync, readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('keeps app copy free of 합니다체', () => {
  const files = ['ts', 'tsx'].flatMap((ext) => globSync(`src/**/*.${ext}`))
    .filter((file) => !/\.test\.tsx?$/.test(file))
  expect(files.length).toBeGreaterThan(10)

  const failures = files.flatMap((file) => {
    const source = readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(?<!:)\/\/.*$/gm, '')
      // Logs are outside the copy change requested by the brief.
      .replace(/^\s*console\.(?:error|warn|info|log)\(.*$/gm, '')
    return source.split('\n').flatMap((line, index) =>
      /니다|니까|십시오/.test(line) ? [`${file}:${index + 1}: ${line.trim()}`] : [])
  })
  expect(failures, failures.join('\n')).toEqual([])
})
