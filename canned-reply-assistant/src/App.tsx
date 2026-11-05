import {
  AttentionBox,
  Button,
  Checkbox,
  Loader,
  Search,
  Tab,
  TabList,
  TextArea,
  TextField,
} from '@vibe/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BarList } from './components/BarList'
import { ConfidenceBadge } from './components/ConfidenceBadge'
import { MetricCard } from './components/MetricCard'
import { ReplyCard } from './components/ReplyCard'
import { appConfig, persistMondayToken, readInitialMondayToken } from './config/appConfig'
import { buildDashboardData } from './lib/dashboard'
import { formatHours, formatPercent } from './lib/format'
import { buildGapClusters, composeDraftCannedReply } from './lib/gaps'
import { buildImpactEstimate, summarizeEventLog } from './lib/impact'
import { buildReplyMatcher } from './lib/matcher'
import { truncate } from './lib/text'
import { appendEvent, readEventLog } from './services/eventLog'
import { buildDemoBundle, createCannedReply, loadAppData } from './services/mondayApi'
import type { AppDataBundle, CannedGroup, MatchResult, TicketRecord } from './types'

const tabs = [
  'Suggest replies',
  'Browse library',
  'Add a great answer',
  'Gap finder',
  'Dashboard',
]
const emptyReplies: AppDataBundle['cannedReplies'] = []
const emptyTickets: AppDataBundle['tickets'] = []

function App() {
  const initialToken = readInitialMondayToken()
  const [mode, setMode] = useState<'demo' | 'live'>(initialToken ? 'live' : 'demo')
  const [activeTab, setActiveTab] = useState(0)
  const [tokenDraft, setTokenDraft] = useState(initialToken)
  const [token, setToken] = useState(initialToken)
  const [bundle, setBundle] = useState<AppDataBundle | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadNotice, setLoadNotice] = useState('')
  const [loadError, setLoadError] = useState('')
  const [copyStatus, setCopyStatus] = useState('')
  const [subjectInput, setSubjectInput] = useState('')
  const [descriptionInput, setDescriptionInput] = useState('')
  const [librarySearch, setLibrarySearch] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<'All' | CannedGroup>('All')
  const [candidateTopic, setCandidateTopic] = useState('')
  const [candidateAnswer, setCandidateAnswer] = useState('')
  const [confirmWrite, setConfirmWrite] = useState(false)
  const [isSubmittingCandidate, setIsSubmittingCandidate] = useState(false)
  const [candidateStatus, setCandidateStatus] = useState('')
  const [impactMinutesSaved, setImpactMinutesSaved] = useState('6')
  const [gapDraft, setGapDraft] = useState<{ title: string; body: string } | null>(null)
  const [eventLog, setEventLog] = useState(readEventLog())
  const lastSuggestionEventKey = useRef('')

  useEffect(() => {
    let isCurrent = true

    async function fetchData() {
      setIsLoading(true)
      setLoadError('')
      setLoadNotice('')

      if (mode === 'demo') {
        setBundle(buildDemoBundle())
        setLoadNotice('Demo mode is on: using bundled canned replies and anonymized sample tickets.')
        setIsLoading(false)
        return
      }

      if (!token.trim()) {
        setBundle(buildDemoBundle())
        setLoadNotice('Live mode needs a monday API token. Showing demo data until one is added.')
        setIsLoading(false)
        return
      }

      const nextBundle = await loadAppData(token)

      if (!isCurrent) {
        return
      }

      setBundle(nextBundle)
      if (nextBundle.dataSource === 'seed') {
        setLoadNotice(
          'A live board read failed, so the app fell back to the bundled library snapshot and demo tickets.',
        )
      }
      setIsLoading(false)
    }

    fetchData().catch((error) => {
      console.error(error)
      if (isCurrent) {
        setBundle(buildDemoBundle())
        setLoadError(error instanceof Error ? error.message : 'Failed to load app data.')
        setIsLoading(false)
      }
    })

    return () => {
      isCurrent = false
    }
  }, [mode, token])

  const cannedReplies = bundle?.cannedReplies ?? emptyReplies
  const tickets = bundle?.tickets ?? emptyTickets
  const matcher = useMemo(() => buildReplyMatcher(cannedReplies), [cannedReplies])

  const ticketSuggestions = useMemo(
    () => matcher.match(subjectInput, descriptionInput),
    [descriptionInput, matcher, subjectInput],
  )

  const sampleTickets = useMemo(
    () => tickets.slice(0, 5).sort((left, right) => right.creationDate.localeCompare(left.creationDate)),
    [tickets],
  )

  const dashboardMatches = useMemo(() => {
    const nextMap = new Map<string, MatchResult[]>()

    for (const ticket of tickets) {
      nextMap.set(ticket.id, matcher.match(ticket.subject || ticket.name, ticket.description, 1))
    }

    return nextMap
  }, [matcher, tickets])

  const dashboard = useMemo(
    () => buildDashboardData(tickets, dashboardMatches),
    [dashboardMatches, tickets],
  )
  const gapClusters = useMemo(
    () => buildGapClusters(tickets, dashboardMatches),
    [dashboardMatches, tickets],
  )
  const impactEstimate = useMemo(
    () =>
      buildImpactEstimate(dashboard.coverage, dashboard.totalTickets, {
        minutesSavedPerReply: Number(impactMinutesSaved) || 0,
      }),
    [dashboard.coverage, dashboard.totalTickets, impactMinutesSaved],
  )
  const eventSummary = useMemo(() => summarizeEventLog(eventLog), [eventLog])

  const libraryGroupCounts = useMemo(() => {
    const counts = new Map<CannedGroup, number>()

    for (const reply of cannedReplies) {
      counts.set(reply.group, (counts.get(reply.group) ?? 0) + 1)
    }

    return counts
  }, [cannedReplies])

  const filteredLibrary = useMemo(() => {
    const query = librarySearch.trim().toLowerCase()

    return cannedReplies.filter((reply) => {
      const groupMatches = selectedGroup === 'All' || reply.group === selectedGroup
      if (!groupMatches) {
        return false
      }

      if (!query) {
        return true
      }

      const haystack = `${reply.name} ${reply.group} ${reply.text}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [cannedReplies, librarySearch, selectedGroup])

  const candidateGroupSuggestion = useMemo(
    () => matcher.suggestGroup(candidateTopic, candidateAnswer),
    [candidateAnswer, candidateTopic, matcher],
  )

  const likelyDuplicates = useMemo(
    () => matcher.findLikelyDuplicates(candidateTopic, candidateAnswer),
    [candidateAnswer, candidateTopic, matcher],
  )

  useEffect(() => {
    const signature = `${subjectInput.trim()}|${descriptionInput.trim()}|${ticketSuggestions
      .map((result) => result.reply.id)
      .join(',')}`

    if (
      !subjectInput.trim() &&
      !descriptionInput.trim()
    ) {
      return
    }

    if (ticketSuggestions.length === 0 || signature === lastSuggestionEventKey.current) {
      return
    }

    lastSuggestionEventKey.current = signature
    appendEvent('suggestions_shown', {
      mode,
      subject: subjectInput.trim().slice(0, 80),
      suggestions: ticketSuggestions.length,
      topConfidence: ticketSuggestions[0]?.confidence ?? 'none',
    })
    setEventLog(readEventLog())
  }, [descriptionInput, mode, subjectInput, ticketSuggestions])

  async function copyReply(text: string) {
    await navigator.clipboard.writeText(text)
    appendEvent('reply_copied', {
      mode,
      sourceTab: tabs[activeTab],
    })
    setEventLog(readEventLog())
    setCopyStatus('Copied canned reply to clipboard.')
    window.setTimeout(() => {
      setCopyStatus('')
    }, 1800)
  }

  function handleLoadSampleTicket(ticket: TicketRecord) {
    setSubjectInput(ticket.subject || ticket.name)
    setDescriptionInput(ticket.description)
    setActiveTab(0)
  }

  async function handleCreateCandidate() {
    appendEvent('candidate_submit_attempted', {
      writesEnabled: appConfig.featureFlags.enableMondayWrites,
      mode,
    })
    setEventLog(readEventLog())

    if (!token.trim()) {
      setCandidateStatus('Add a monday token before turning on writes.')
      return
    }

    if (!appConfig.featureFlags.enableMondayWrites) {
      setCandidateStatus('Writes are disabled by default in this build.')
      return
    }

    if (!confirmWrite) {
      setCandidateStatus('Confirm the write step before submitting to monday.')
      return
    }

    setIsSubmittingCandidate(true)
    setCandidateStatus('')

    try {
      const result = await createCannedReply({
        token,
        name: candidateTopic.trim() || 'New canned response',
        groupId: appConfig.cannedResponseGroupIds[candidateGroupSuggestion.group],
        replyBody: candidateAnswer.trim(),
      })

      setCandidateStatus(`Created canned item ${result.itemId}.`)
      appendEvent('candidate_created', {
        itemId: result.itemId,
        group: candidateGroupSuggestion.group,
      })
      setEventLog(readEventLog())
    } catch (error) {
      setCandidateStatus(error instanceof Error ? error.message : 'Failed to create canned item.')
    } finally {
      setIsSubmittingCandidate(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="hero__eyebrow">Business Support / Big Brain Studio</p>
          <h1>{appConfig.appName}</h1>
          <p className="hero__subtitle">
            Instant, explainable canned-reply suggestions for Business Lounge tickets, plus a
            demo-ready library browser, gap finder, and impact dashboard.
          </p>
        </div>
        <div className="hero__meta">
          <div className="mode-toggle">
            <button
              className={`mode-toggle__button ${
                mode === 'demo' ? 'mode-toggle__button--active' : ''
              }`}
              onClick={() => {
                setMode('demo')
              }}
              type="button"
            >
              Demo mode
            </button>
            <button
              className={`mode-toggle__button ${
                mode === 'live' ? 'mode-toggle__button--active' : ''
              }`}
              onClick={() => {
                setMode('live')
              }}
              type="button"
            >
              Live mode
            </button>
          </div>
          <div className="source-chip">
            <span>Data source</span>
            <strong>
              {bundle?.dataSource === 'live'
                ? 'Live monday boards'
                : 'Bundled seed + demo tickets'}
            </strong>
          </div>
          <div className="source-chip">
            <span>Boards</span>
            <strong>
              {appConfig.boardIds.cannedResponses} / {appConfig.boardIds.businessLoungeTickets}
            </strong>
          </div>
        </div>
      </header>

      <section className="panel panel--token">
        <div className="panel__header">
          <h2>Live monday data</h2>
          <p>
            Leave the token empty to keep the experience fully self-contained for demos and judging.
          </p>
        </div>
        <div className="token-row">
          <TextField
            title="Viewer API token"
            type="password"
            value={tokenDraft}
            onChange={(value) => {
              setTokenDraft(value)
            }}
            placeholder="Paste a monday API token to read live boards"
            size="large"
          />
          <Button
            onClick={() => {
              const trimmed = tokenDraft.trim()
              persistMondayToken(trimmed)
              setToken(trimmed)
            }}
          >
            Use token
          </Button>
          <Button
            kind="secondary"
            onClick={() => {
              setTokenDraft('')
              setToken('')
              persistMondayToken('')
            }}
          >
            Use bundled data
          </Button>
        </div>
        {token && bundle?.dataSource === 'seed' ? (
          <AttentionBox
            type="warning"
            title="Fell back to bundled data"
            text="The app could not read one of the monday boards with the current token, so the UI is still usable with the bundled snapshot and mock dashboard data."
          />
        ) : null}
        {loadNotice ? (
          <AttentionBox type="neutral" title="Data mode" text={loadNotice} />
        ) : null}
        {loadError ? (
          <AttentionBox type="negative" title="Load error" text={loadError} />
        ) : null}
        {copyStatus ? <p className="status-inline">{copyStatus}</p> : null}
      </section>

      <section className="tabs-shell">
        <TabList activeTabId={activeTab} onTabChange={setActiveTab}>
          {tabs.map((label, index) => (
            <Tab key={label} value={index}>
              {label}
            </Tab>
          ))}
        </TabList>
      </section>

      {isLoading ? (
        <div className="loading-shell">
          <Loader size={50} />
          <p>Loading canned replies and recent tickets…</p>
        </div>
      ) : null}

      {!isLoading && activeTab === 0 ? (
        <section className="tab-grid tab-grid--suggest">
          <article className="panel">
            <div className="panel__header">
              <h2>Ticket input</h2>
              <p>
                Paste a subject and description, or pick{' '}
                {mode === 'demo' ? 'an anonymized demo ticket' : 'a recent ticket'}.
              </p>
            </div>
            <div className="panel__stack">
              <TextField
                title="Subject"
                value={subjectInput}
                onChange={(value) => {
                  setSubjectInput(value)
                }}
                placeholder="e.g. Renewal opp creation error"
                size="large"
              />
              <TextArea
                label="Description"
                value={descriptionInput}
                onChange={(event) => {
                  setDescriptionInput(event.target.value)
                }}
                placeholder="Paste the Business Lounge description here"
                resize
                rows={10}
              />
              <div className="button-row">
                <Button
                  kind="secondary"
                  onClick={() => {
                    setSubjectInput('')
                    setDescriptionInput('')
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>
            {sampleTickets.length > 0 ? (
              <div className="sample-ticket-list">
                <h3>Recent ticket examples</h3>
                {sampleTickets.map((ticket) => (
                  <button
                    className="sample-ticket"
                    key={ticket.id}
                    onClick={() => {
                      handleLoadSampleTicket(ticket)
                    }}
                    type="button"
                  >
                    <strong>{ticket.subject || ticket.name}</strong>
                    <span>{truncate(ticket.description || ticket.name, 120)}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </article>

          <article className="panel">
            <div className="panel__header">
              <h2>Top 3 canned replies</h2>
              <p>Simple, explainable similarity over canned title, group, and full reply text.</p>
            </div>
            {ticketSuggestions.length === 0 ? (
              <p className="panel__empty">
                Start with a subject or description to see the best canned replies.
              </p>
            ) : (
              <div className="reply-grid">
                {ticketSuggestions.map((result) => (
                  <ReplyCard
                    key={result.reply.id}
                    onCopy={copyReply}
                    result={result}
                  />
                ))}
              </div>
            )}
          </article>
        </section>
      ) : null}

      {!isLoading && activeTab === 1 ? (
        <section className="panel panel--browse">
          <div className="panel__header">
            <h2>Browse the library</h2>
            <p>
              Search across canned reply names, groups, and full update text. Counts stay visible
              by group so teammates can see where the library is concentrated.
            </p>
          </div>
          <div className="browse-toolbar">
            <Search
              value={librarySearch}
              onChange={setLibrarySearch}
              placeholder="Search the canned library"
              size="medium"
            />
            <div className="group-filter-row">
              <button
                className={`group-filter ${selectedGroup === 'All' ? 'group-filter--active' : ''}`}
                onClick={() => {
                  setSelectedGroup('All')
                }}
                type="button"
              >
                All <span>{cannedReplies.length}</span>
              </button>
              {appConfig.cannedGroups.map((group) => (
                <button
                  className={`group-filter ${
                    selectedGroup === group ? 'group-filter--active' : ''
                  }`}
                  key={group}
                  onClick={() => {
                    setSelectedGroup(group)
                  }}
                  type="button"
                >
                  {group} <span>{libraryGroupCounts.get(group) ?? 0}</span>
                </button>
              ))}
            </div>
          </div>
          {filteredLibrary.length === 0 ? (
            <p className="panel__empty">No canned replies match the current search and group filter.</p>
          ) : (
            <div className="library-list">
              {filteredLibrary.map((reply) => (
                <article className="library-card" key={reply.id}>
                  <div className="library-card__header">
                    <div>
                      <span className="reply-card__group">{reply.group}</span>
                      <h3>{reply.name}</h3>
                    </div>
                    <Button
                      kind="secondary"
                      onClick={() => {
                        copyReply(reply.text)
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                  <p>{truncate(reply.text, 280)}</p>
                  <a href={reply.url} target="_blank" rel="noreferrer">
                    Open in monday
                  </a>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {!isLoading && activeTab === 2 ? (
        <section className="tab-grid tab-grid--add">
          <article className="panel">
            <div className="panel__header">
              <h2>Propose a new canned reply</h2>
              <p>
                Suggest the right group and flag duplicates before anyone writes back to the Canned
                Responses board.
              </p>
            </div>
            <div className="panel__stack">
              <TextField
                title="Topic / canned item name"
                value={candidateTopic}
                onChange={setCandidateTopic}
                placeholder="e.g. AI transformation eligibility question"
                size="large"
              />
              <TextArea
                label="Great answer"
                value={candidateAnswer}
                onChange={(event) => {
                  setCandidateAnswer(event.target.value)
                }}
                placeholder="Paste the teammate reply you want to preserve"
                rows={12}
                resize
              />
            </div>
            <AttentionBox
              type={appConfig.featureFlags.enableMondayWrites ? 'warning' : 'neutral'}
              title="Write path is gated"
              text={
                appConfig.featureFlags.enableMondayWrites
                  ? 'Writes are enabled for this build. The final submit still requires the confirm checkbox below.'
                  : 'Writes are OFF by default. This build will analyze, suggest, and de-duplicate without touching the monday board.'
              }
            />
            <div className="write-guard">
              <Checkbox
                checked={confirmWrite}
                disabled={!appConfig.featureFlags.enableMondayWrites}
                label="I reviewed the suggested group and duplicate warnings before creating the item."
                onChange={(event) => {
                  setConfirmWrite(event.target.checked)
                }}
              />
              <Button
                disabled={!candidateTopic.trim() || !candidateAnswer.trim()}
                loading={isSubmittingCandidate}
                onClick={handleCreateCandidate}
              >
                Create on monday
              </Button>
            </div>
            {candidateStatus ? <p className="status-inline">{candidateStatus}</p> : null}
          </article>

          <div className="side-stack">
            <article className="panel">
              <div className="panel__header">
                <h2>Suggested group</h2>
              </div>
              <div className="suggested-group-card">
                <div className="suggested-group-card__header">
                  <strong>{candidateGroupSuggestion.group}</strong>
                  <ConfidenceBadge confidence={candidateGroupSuggestion.confidence} />
                </div>
                <p>{candidateGroupSuggestion.rationale}</p>
              </div>
            </article>

            <article className="panel">
              <div className="panel__header">
                <h2>Likely duplicates</h2>
                <p>Nearest existing canned replies based on the proposed answer.</p>
              </div>
              {likelyDuplicates.length === 0 ? (
                <p className="panel__empty">No strong duplicates found yet.</p>
              ) : (
                <div className="duplicate-list">
                  {likelyDuplicates.map((duplicate) => (
                    <div className="duplicate-card" key={duplicate.reply.id}>
                      <div className="duplicate-card__header">
                        <strong>{duplicate.reply.name}</strong>
                        <ConfidenceBadge confidence={duplicate.confidence} />
                      </div>
                      <p>{truncate(duplicate.reply.text, 180)}</p>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </div>
        </section>
      ) : null}

      {!isLoading && activeTab === 3 ? (
        <section className="tab-grid tab-grid--gap">
          <article className="panel">
            <div className="panel__header">
              <h2>Gap finder</h2>
              <p>
                Cluster recent tickets with low or missing canned coverage, show their volume, and
                draft new responses from the best resolved examples in that topic.
              </p>
            </div>
            {gapClusters.length === 0 ? (
              <p className="panel__empty">
                No obvious gaps right now. The recent ticket set has solid canned coverage.
              </p>
            ) : (
              <div className="gap-cluster-list">
                {gapClusters.map((cluster) => (
                  <article className="gap-cluster-card" key={cluster.id}>
                    <div className="gap-cluster-card__header">
                      <div>
                        <h3>{cluster.label}</h3>
                        <p>{cluster.ticketCount} recent tickets in this gap cluster</p>
                      </div>
                      <ConfidenceBadge confidence={cluster.matchConfidence} />
                    </div>
                    <div className="token-list">
                      {cluster.keywords.map((keyword) => (
                        <span className="token-list__token" key={keyword}>
                          {keyword}
                        </span>
                      ))}
                    </div>
                    <div className="gap-cluster-card__samples">
                      {cluster.sampleTickets.map((ticket) => (
                        <div className="sample-ticket sample-ticket--static" key={ticket.id}>
                          <strong>{ticket.subject || ticket.name}</strong>
                          <span>{truncate(ticket.description, 120)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="button-row">
                      <Button
                        onClick={() => {
                          const draft = composeDraftCannedReply(cluster)
                          setGapDraft(draft)
                          appendEvent('gap_draft_generated', {
                            cluster: cluster.label,
                            sampleCount: cluster.sampleTickets.length,
                          })
                          setEventLog(readEventLog())
                        }}
                      >
                        Draft canned reply
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </article>

          <article className="panel">
            <div className="panel__header">
              <h2>Draft preview</h2>
              <p>
                Generated only for review. Saving still goes through the same write-gated flow in
                “Add a great answer”.
              </p>
            </div>
            {!gapDraft ? (
              <p className="panel__empty">
                Pick a gap cluster and generate a draft reply to review it here.
              </p>
            ) : (
              <div className="draft-preview">
                <TextField
                  title="Draft title"
                  value={gapDraft.title}
                  onChange={(value) => {
                    setGapDraft((current) => (current ? { ...current, title: value } : current))
                  }}
                  size="large"
                />
                <TextArea
                  label="Draft reply"
                  value={gapDraft.body}
                  onChange={(event) => {
                    setGapDraft((current) =>
                      current ? { ...current, body: event.target.value } : current,
                    )
                  }}
                  rows={12}
                  resize
                />
                <div className="button-row">
                  <Button
                    onClick={() => {
                      if (!gapDraft) {
                        return
                      }

                      setCandidateTopic(gapDraft.title)
                      setCandidateAnswer(gapDraft.body)
                      setActiveTab(2)
                    }}
                  >
                    Open in Add a great answer
                  </Button>
                </div>
              </div>
            )}
          </article>
        </section>
      ) : null}

      {!isLoading && activeTab === 4 ? (
        <section className="dashboard-stack">
          <div className="metrics-grid">
            <MetricCard
              label="Recent ticket volume"
              value={String(dashboard.totalTickets)}
              helper="Last 30 days"
            />
            <MetricCard
              label="Open tickets"
              value={String(dashboard.openTickets)}
              helper="Statuses excluding Resolved / Closed"
            />
            <MetricCard
              label="Resolved or closed"
              value={String(dashboard.resolvedTickets)}
              helper="Recent completed tickets"
            />
            <MetricCard
              label="Median time to resolve"
              value={formatHours(dashboard.medianResolutionHours)}
              helper="Based on Creation Date and Resolution Date"
            />
          </div>

          <section className="panel">
            <div className="panel__header">
              <h2>Impact panel</h2>
              <p>
                Estimated value from good canned coverage plus the local event model for future live
                adoption tracking.
              </p>
            </div>
            <div className="impact-panel">
              <div className="impact-panel__assumptions">
                <TextField
                  title="Minutes saved per high/medium suggestion"
                  type="number"
                  value={impactMinutesSaved}
                  onChange={setImpactMinutesSaved}
                  size="medium"
                />
                <p className="impact-panel__caption">
                  Estimate only. Time saved = minutes per suggested reply × recent tickets with
                  high or medium coverage.
                </p>
              </div>
              <div className="impact-panel__stats">
                <MetricCard
                  label="Estimated time saved"
                  value={`${impactEstimate.estimatedMinutesSaved} min`}
                  helper={`${impactEstimate.estimatedTicketsHelped} tickets with high/medium matches`}
                />
                <MetricCard
                  label="Estimated library coverage"
                  value={formatPercent(
                    dashboard.coverage.high + dashboard.coverage.medium,
                    dashboard.totalTickets,
                  )}
                  helper="High + medium confidence share"
                />
                <MetricCard
                  label="Estimated consistency"
                  value={formatPercent(
                    Math.round(impactEstimate.estimatedConsistencyShare * 100),
                    100,
                  )}
                  helper="Estimated share of replies sourced from the library"
                />
              </div>
              <div className="impact-panel__events">
                <h3>Local event model</h3>
                <p className="impact-panel__caption">
                  Real local events only. The interface is ready for future live tracking of
                  suggestions shown/used and answers added.
                </p>
                <div className="event-grid">
                  <MetricCard
                    label="Suggestions shown"
                    value={String(eventSummary.suggestions_shown ?? 0)}
                  />
                  <MetricCard
                    label="Replies copied"
                    value={String(eventSummary.reply_copied ?? 0)}
                  />
                  <MetricCard
                    label="Gap drafts generated"
                    value={String(eventSummary.gap_draft_generated ?? 0)}
                  />
                  <MetricCard
                    label="Answers added"
                    value={String(eventSummary.candidate_created ?? 0)}
                  />
                </div>
              </div>
            </div>
          </section>

          {dashboard.coverage.high + dashboard.coverage.medium + dashboard.coverage.low + dashboard.coverage.none >
          0 ? (
            <section className="panel">
              <div className="panel__header">
                <h2>Library coverage</h2>
                <p>Share of recent tickets that found a strong, partial, or missing canned answer.</p>
              </div>
              <div className="coverage-grid">
                <div className="coverage-chip coverage-chip--high">
                  <span>High</span>
                  <strong>{formatPercent(dashboard.coverage.high, dashboard.totalTickets)}</strong>
                </div>
                <div className="coverage-chip coverage-chip--medium">
                  <span>Medium</span>
                  <strong>{formatPercent(dashboard.coverage.medium, dashboard.totalTickets)}</strong>
                </div>
                <div className="coverage-chip coverage-chip--low">
                  <span>Low</span>
                  <strong>{formatPercent(dashboard.coverage.low, dashboard.totalTickets)}</strong>
                </div>
                <div className="coverage-chip coverage-chip--none">
                  <span>No match</span>
                  <strong>{formatPercent(dashboard.coverage.none, dashboard.totalTickets)}</strong>
                </div>
              </div>
            </section>
          ) : null}

          <div className="dashboard-grid">
            {dashboard.volumeByDay.length > 0 ? (
              <BarList
                compact
                emptyMessage="No recent volume data."
                items={dashboard.volumeByDay}
                title="Ticket volume by day"
              />
            ) : null}
            {dashboard.openByStatus.length > 0 ? (
              <BarList
                emptyMessage="No open tickets in the current lookback."
                items={dashboard.openByStatus}
                title="Open tickets by status"
              />
            ) : null}
            {dashboard.topSubjects.length > 0 ? (
              <BarList
                emptyMessage="No subject data available."
                items={dashboard.topSubjects}
                title="Top subjects"
              />
            ) : null}
            {dashboard.topAssignmentGroups.length > 0 ? (
              <BarList
                emptyMessage="No assignment-group data available."
                items={dashboard.topAssignmentGroups}
                title="Top assignment groups"
              />
            ) : null}
            {dashboard.gapTopics.length > 0 ? (
              <BarList
                emptyMessage="No gap topics found."
                items={dashboard.gapTopics}
                title="Top topics with no good match"
              />
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  )
}

export default App
