import { Button, Link } from '@vibe/core'
import type { MatchResult } from '../types'
import { truncate } from '../lib/text'
import { ConfidenceBadge } from './ConfidenceBadge'

interface ReplyCardProps {
  result: MatchResult
  onCopy: (text: string) => void
}

export function ReplyCard({ result, onCopy }: ReplyCardProps) {
  return (
    <article className="reply-card">
      <div className="reply-card__topline">
        <span className="reply-card__group">{result.reply.group}</span>
        <ConfidenceBadge confidence={result.confidence} />
      </div>
      <h3>{result.reply.name}</h3>
      <p className="reply-card__reason">{result.reason}</p>
      <p className="reply-card__body">{truncate(result.reply.text, 340)}</p>
      {result.overlappingTerms.length > 0 ? (
        <div className="token-list">
          {result.overlappingTerms.map((term) => (
            <span className="token-list__token" key={term}>
              {term}
            </span>
          ))}
        </div>
      ) : null}
      <div className="reply-card__actions">
        <Button
          kind="secondary"
          onClick={() => {
            onCopy(result.reply.text)
          }}
        >
          Copy reply
        </Button>
        <Link href={result.reply.url} target="_blank" text="Open canned item" />
      </div>
    </article>
  )
}
