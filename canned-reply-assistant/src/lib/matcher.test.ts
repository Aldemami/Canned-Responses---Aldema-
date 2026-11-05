import { describe, expect, it } from 'vitest'
import { buildSeedLibrary } from './library'
import { buildReplyMatcher } from './matcher'

const matcher = buildReplyMatcher(buildSeedLibrary())

describe('buildReplyMatcher', () => {
  it('returns the deal-room canned reply for a matching ticket', () => {
    const matches = matcher.match(
      'deal room not populating',
      'The quote output is not showing up in deal room and the rep needs to know what to publish.',
    )

    expect(matches[0]?.reply.name).toContain('Deal room not populating')
    expect(['high', 'medium']).toContain(matches[0]?.confidence)
  })

  it('suggests the tools access canned responses for access requests', () => {
    const matches = matcher.match(
      'User/Access/Permission Issue',
      'The teammate needs access to Sales Navigator and asks which ticket flow to use.',
    )

    const names = matches.map((match) => match.reply.name)
    expect(
      names.some((name) =>
        ['System Access Request', 'Systems Issues Support - Deflection'].includes(name),
      ),
    ).toBe(true)
  })

  it('suggests Renewals for renewal-opportunity creation issues', () => {
    const suggestion = matcher.suggestGroup(
      'Renewal Opp Creation',
      'The account is moving from CC to wire and the renewal opp needs a new contract path.',
    )

    expect(suggestion.group).toBe('Renewals')
  })

  it('flags near-duplicate canned replies when the proposed answer already exists', () => {
    const duplicates = matcher.findLikelyDuplicates(
      'Partner portal MFA reset',
      'I have disconnected the partner users MFA and triggered a reset password email so they can set it up again.',
    )

    expect(duplicates[0]?.reply.name).toContain('Partner Portal MFA Reset Password')
    expect(duplicates.length).toBeGreaterThan(0)
  })
})
