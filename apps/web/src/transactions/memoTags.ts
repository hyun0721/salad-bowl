const TAG = /(?<!\S)#([\p{L}\p{N}_]{1,50})(?![\p{L}\p{N}_])/gu

export function normalizeTag(raw: string | null): string | null {
  if (raw === null) return null
  const tag = (raw.startsWith('#') ? raw.slice(1) : raw).normalize('NFC')
  return /^[\p{L}\p{N}_]{1,50}$/u.test(tag) ? tag : null
}

export function extractTags(memo: string | null): string[] {
  return [...new Set([...(memo ?? '').normalize('NFC').matchAll(TAG)].map((match) => match[1]))]
}

export function addTags(memo: string | null, tags: string[]): string {
  let result = memo ?? ''
  const present = new Set(extractTags(result))
  for (const raw of tags) {
    const tag = normalizeTag(raw)
    if (tag === null) throw new Error('invalid tag')
    if (!present.has(tag)) {
      result += (result ? ' ' : '') + '#' + tag
      present.add(tag)
    }
  }
  return result
}

export function removeTags(memo: string | null, tags: string[]): string {
  const original = memo ?? ''
  const removed = new Set(tags.map((raw) => {
    const tag = normalizeTag(raw)
    if (tag === null) throw new Error('invalid tag')
    return tag
  }))
  const normalized = original.normalize('NFC')
  let result = ''
  let from = 0
  let changed = false
  for (const match of normalized.matchAll(TAG)) {
    if (!removed.has(match[1])) continue
    result += normalized.slice(from, match.index)
    let end = match.index + match[0].length
    if (result.endsWith(' ')) result = result.slice(0, -1)
    else if (!result && normalized[end] === ' ') end++
    from = end
    changed = true
  }
  return changed ? result + normalized.slice(from) : original
}
