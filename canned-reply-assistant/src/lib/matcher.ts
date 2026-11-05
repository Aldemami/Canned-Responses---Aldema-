import { appConfig } from '../config/appConfig'
import type {
  CannedGroup,
  CannedReply,
  ConfidenceLabel,
  GroupSuggestion,
  MatchResult,
} from '../types'
import { tokenize, uniqueTokens } from './text'

interface IndexedReply {
  reply: CannedReply
  weights: Map<string, number>
  norm: number
  allTokens: Set<string>
  nameTokens: Set<string>
  groupTokens: Set<string>
}

function scoreToConfidence(score: number): ConfidenceLabel {
  if (score >= appConfig.matcher.highThreshold) {
    return 'high'
  }

  if (score >= appConfig.matcher.mediumThreshold) {
    return 'medium'
  }

  if (score >= appConfig.matcher.lowThreshold) {
    return 'low'
  }

  return 'none'
}

function buildFieldFrequency(tokens: string[], multiplier: number) {
  const frequency = new Map<string, number>()

  for (const token of tokens) {
    frequency.set(token, (frequency.get(token) ?? 0) + multiplier)
  }

  return frequency
}

function mergeFrequencies(...parts: Map<string, number>[]) {
  const merged = new Map<string, number>()

  for (const part of parts) {
    for (const [token, value] of part) {
      merged.set(token, (merged.get(token) ?? 0) + value)
    }
  }

  return merged
}

function vectorNorm(weights: Map<string, number>) {
  let total = 0

  for (const value of weights.values()) {
    total += value * value
  }

  return Math.sqrt(total)
}

function cosineSimilarity(
  queryWeights: Map<string, number>,
  queryNorm: number,
  document: IndexedReply,
) {
  if (!queryNorm || !document.norm) {
    return 0
  }

  let dotProduct = 0

  for (const [token, weight] of queryWeights) {
    dotProduct += weight * (document.weights.get(token) ?? 0)
  }

  return dotProduct / (queryNorm * document.norm)
}

function overlapRatio(queryTokens: string[], candidateTokens: Set<string>) {
  if (!queryTokens.length) {
    return 0
  }

  const overlap = queryTokens.filter((token) => candidateTokens.has(token)).length
  return overlap / queryTokens.length
}

function buildReason(
  queryTokens: string[],
  indexedReply: IndexedReply,
  confidence: ConfidenceLabel,
) {
  const overlaps = queryTokens.filter((token) => indexedReply.allTokens.has(token))
  const nameHits = overlaps.filter((token) => indexedReply.nameTokens.has(token))

  if (nameHits.length > 0) {
    return `${confidence} confidence: title overlap on ${nameHits
      .slice(0, 3)
      .join(', ')}`
  }

  if (overlaps.length > 0) {
    return `${confidence} confidence: shared keywords ${overlaps
      .slice(0, 4)
      .join(', ')}`
  }

  return `${confidence} confidence: nearest library language match`
}

export function buildReplyMatcher(library: CannedReply[]) {
  const documentFrequencies = new Map<string, number>()

  const rawDocuments = library.map((reply) => {
    const nameTokens = tokenize(reply.name)
    const groupTokens = tokenize(reply.group)
    const bodyTokens = tokenize(reply.text)
    const allTokens = [...new Set([...nameTokens, ...groupTokens, ...bodyTokens])]

    for (const token of allTokens) {
      documentFrequencies.set(token, (documentFrequencies.get(token) ?? 0) + 1)
    }

    return {
      reply,
      nameTokens,
      groupTokens,
      bodyTokens,
      allTokens,
    }
  })

  const totalDocuments = Math.max(rawDocuments.length, 1)

  const indexedReplies: IndexedReply[] = rawDocuments.map((document) => {
    const frequencies = mergeFrequencies(
      buildFieldFrequency(document.nameTokens, 2.6),
      buildFieldFrequency(document.groupTokens, 1.4),
      buildFieldFrequency(document.bodyTokens, 1),
    )
    const weights = new Map<string, number>()

    for (const [token, tf] of frequencies) {
      const df = documentFrequencies.get(token) ?? 1
      const idf = Math.log((1 + totalDocuments) / (1 + df)) + 1
      weights.set(token, tf * idf)
    }

    return {
      reply: document.reply,
      weights,
      norm: vectorNorm(weights),
      allTokens: new Set(document.allTokens),
      nameTokens: new Set(document.nameTokens),
      groupTokens: new Set(document.groupTokens),
    }
  })

  function buildQueryWeights(subject: string, description: string) {
    const subjectTokens = tokenize(subject)
    const descriptionTokens = tokenize(description)
    const queryTokens = [...new Set([...subjectTokens, ...descriptionTokens])]
    const queryFrequency = mergeFrequencies(
      buildFieldFrequency(subjectTokens, 2.5),
      buildFieldFrequency(descriptionTokens, 1),
    )
    const weights = new Map<string, number>()

    for (const [token, tf] of queryFrequency) {
      const df = documentFrequencies.get(token) ?? 1
      const idf = Math.log((1 + totalDocuments) / (1 + df)) + 1
      weights.set(token, tf * idf)
    }

    return {
      queryTokens,
      weights,
      norm: vectorNorm(weights),
    }
  }

  function match(
    subject: string,
    description: string,
    limit: number = appConfig.matcher.maxSuggestions,
  ): MatchResult[] {
    const { queryTokens, weights, norm } = buildQueryWeights(subject, description)

    if (queryTokens.length === 0) {
      return []
    }

    return indexedReplies
      .map((indexedReply) => {
        const cosine = cosineSimilarity(weights, norm, indexedReply)
        const titleOverlap = overlapRatio(queryTokens, indexedReply.nameTokens)
        const keywordOverlap = overlapRatio(queryTokens, indexedReply.allTokens)
        const groupOverlap = overlapRatio(queryTokens, indexedReply.groupTokens)
        const phraseBonus =
          subject.trim().length > 4 &&
          indexedReply.reply.name.toLowerCase().includes(subject.trim().toLowerCase())
            ? 0.1
            : 0

        const score = Math.min(
          1,
          cosine + titleOverlap * 0.28 + keywordOverlap * 0.12 + groupOverlap * 0.08 + phraseBonus,
        )
        const confidence = scoreToConfidence(score)

        return {
          reply: indexedReply.reply,
          score,
          confidence,
          overlappingTerms: queryTokens
            .filter((token) => indexedReply.allTokens.has(token))
            .slice(0, 5),
          reason: buildReason(queryTokens, indexedReply, confidence),
        }
      })
      .filter((result) => result.confidence !== 'none')
      .sort((left, right) => right.score - left.score)
      .slice(0, limit)
  }

  function suggestGroup(topic: string, answer: string): GroupSuggestion {
    const candidates = match(topic, answer, 7)
    const aggregate = new Map<CannedGroup, number>()

    for (const candidate of candidates) {
      aggregate.set(
        candidate.reply.group,
        (aggregate.get(candidate.reply.group) ?? 0) + candidate.score,
      )
    }

    const [group = 'General', score = 0] = [...aggregate.entries()].sort(
      (left, right) => right[1] - left[1],
    )[0] ?? ['General', 0]

    const topNeighbor = candidates[0]
    const confidence = scoreToConfidence(score / Math.max(candidates.length, 1) + (topNeighbor?.score ?? 0) * 0.35)

    return {
      group,
      score,
      confidence,
      rationale: topNeighbor
        ? `Closest existing reply: "${topNeighbor.reply.name}" in ${topNeighbor.reply.group}.`
        : 'No close neighbors found, so General is the safest default group.',
    }
  }

  function findLikelyDuplicates(topic: string, answer: string) {
    return match(topic, answer, 5).filter(
      (candidate) => candidate.score >= appConfig.matcher.duplicateThreshold,
    )
  }

  return {
    match,
    suggestGroup,
    findLikelyDuplicates,
  }
}

export function confidenceSummary(matches: MatchResult[]): ConfidenceLabel {
  return matches[0]?.confidence ?? 'none'
}

export function extractTicketKeywords(subject: string, description: string) {
  return uniqueTokens(`${subject} ${description}`).slice(0, 8)
}
