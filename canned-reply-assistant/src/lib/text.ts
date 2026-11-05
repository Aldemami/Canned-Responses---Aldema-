const stopWords = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'has',
  'hi',
  'how',
  'i',
  'if',
  'in',
  'is',
  'it',
  'its',
  'let',
  'me',
  'my',
  'not',
  'of',
  'on',
  'or',
  'our',
  'please',
  'that',
  'the',
  'their',
  'them',
  'there',
  'this',
  'to',
  'up',
  'we',
  'with',
  'you',
  'your',
])

function normalizeToken(token: string) {
  const compact = token.toLowerCase().replace(/[^a-z0-9/#+.-]/g, '')

  if (!compact) {
    return ''
  }

  if (compact.length > 4 && compact.endsWith('ies')) {
    return `${compact.slice(0, -3)}y`
  }

  if (compact.length > 3 && compact.endsWith('s') && !compact.endsWith('ss')) {
    return compact.slice(0, -1)
  }

  return compact
}

export function tokenize(text: string) {
  return text
    .split(/\s+/)
    .map(normalizeToken)
    .filter((token) => token.length > 1 && !stopWords.has(token))
}

export function uniqueTokens(text: string) {
  return [...new Set(tokenize(text))]
}

export function truncate(text: string, maxLength = 240) {
  if (text.length <= maxLength) {
    return text
  }

  return `${text.slice(0, maxLength - 1).trimEnd()}…`
}

export function compactWhitespace(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

export function escapeHtml(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}
