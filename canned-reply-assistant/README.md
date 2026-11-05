# Canned Reply Assistant

Demo-ready Big Brain Studio app for monday.com's Business Support team.

## Pitch

### Problem
Business Support agents often have to leave the ticket they are working on, open a separate monday board of canned responses, search manually, and then decide whether the wording is still right. That costs time and leads to inconsistent answers when different teammates phrase similar guidance differently.

### Solution
Canned Reply Assistant brings the canned library into one polished app experience:

- suggest the top canned replies directly from a ticket subject + description
- browse the full library by group with fast search
- identify recurring ticket gaps where no good canned answer exists
- draft new canned replies from the best resolved examples
- estimate impact through coverage and time-saved metrics

### Impact
- faster first-pass answers from high/medium-confidence suggestions
- more consistent wording because replies are sourced from the shared library
- clearer prioritization of new canned content via clustered coverage gaps
- demo mode for judges and stakeholders without needing a monday token

## Features

- **Suggest replies**
  - explainable top-3 matching using TF-IDF style keyword overlap over canned title + group + text
  - confidence labels: high / medium / low
  - copy button and link back to the source canned item
- **Browse the library**
  - searchable full list
  - group filters with counts
  - full text taken from monday item updates
- **Add a great answer**
  - suggests the most likely group
  - flags likely duplicate canned items
  - write path is behind a **clear confirm step** and an **OFF-by-default feature flag**
- **Gap finder**
  - clusters low/no-match recent tickets into gap topics
  - shows volume and sample tickets
  - drafts a canned reply from the best resolved examples in that cluster
- **Dashboard**
  - recent ticket volume
  - open tickets by status
  - top subjects and assignment groups
  - median time to resolve
  - library coverage
  - impact panel with estimated time saved and local event-model design
- **Demo mode**
  - runs entirely from the bundled canned library and anonymized sample tickets
  - no monday token required

## Data sources

### Preferred live boards
- Canned Responses board: `9844972619`
- Business Lounge 2.0 board: `9576203144`

Board IDs are centralized in:

- [`src/config/appConfig.ts`](./src/config/appConfig.ts)

### Bundled fallback / seed
The app bundles the uploaded canned library snapshot as:

- [`src/data/cannedLibrary.seed.json`](./src/data/cannedLibrary.seed.json)

That snapshot is used for:
- demo mode
- local development with no token
- matcher tests

## Demo mode vs live mode

### Demo mode
Uses:
- bundled canned-library snapshot
- anonymized sample tickets

Best for:
- judges
- screenshots
- local product review

### Live mode
Uses:
- monday GraphQL API
- the viewer's own monday API token

The app:
- reads the canned board live, including reply text from item updates
- reads Business Lounge tickets for the last 30 days
- handles `items_page` pagination
- retries on rate-limit-like responses
- falls back to demo data if a live read fails

## Configuration

Primary config file:

- [`src/config/appConfig.ts`](./src/config/appConfig.ts)

Important values:
- `boardIds.cannedResponses`
- `boardIds.businessLoungeTickets`
- `liveData.ticketLookbackDays`
- `liveData.pageSize`
- `featureFlags.enableMondayWrites`
- canned-response group ID mapping used by the future write path

### Environment variables

Optional local env vars:

```bash
VITE_MONDAY_TOKEN=your-token
VITE_ENABLE_MONDAY_WRITES=false
```

Notes:
- writes should stay **false** unless explicitly enabled for a safe test environment
- the UI also supports pasting a token at runtime

## Local development

```bash
cd canned-reply-assistant
npm install
npm run dev
```

Then open the local Vite URL.

### Recommended local flow
1. Start in **Demo mode**
2. Try the sample tickets in the Suggest Replies tab
3. Browse groups and search the library
4. Open Gap Finder and generate a draft
5. Switch to Live mode and paste a monday token if you want live board reads

## Build, lint, and test

```bash
npm run test
npm run lint
npm run build
```

Current automated test coverage focuses on the matcher:
- good canned match for a deal-room ticket
- tools/access suggestion routing
- renewals group suggestion
- duplicate detection

## Publishing to Big Brain Studio

This repo could not be verified directly against the internal `DaPulse/bigbrain-z2h` template during this run, so the app was structured as a **drop-in standalone React + TypeScript app folder** with the requested slug-compatible folder name:

- `canned-reply-assistant`

Expected publish flow:

```bash
cd ~/zth-projects/canned-reply-assistant
npm install
z2h-cli deploy --preview
```

Review the preview link, then publish:

```bash
z2h-cli deploy
```

Recommended post-publish checklist:
1. Confirm the app slug is `canned-reply-assistant`
2. Confirm the internal app name becomes `mf-canned-reply-assistant`
3. Set visibility according to the competition / Business Support audience
4. Add relevant tags, for example:
   - `business-support`
   - `big-brain`
   - `demo-mode`
   - `knowledge`
5. Validate live-mode token behavior in the host environment

## monday writes

Writes are intentionally **OFF by default**.

The app includes the future write path for:
1. create a new item on the Canned Responses board
2. create the reply body as the item's update

That path is protected by:
- `VITE_ENABLE_MONDAY_WRITES`
- a runtime confirm checkbox

This app does **not** write to the reserved Business Lounge “Suggested reply” column.

## Event model / future analytics design

The app includes a local event-log interface for future live tracking:

- `suggestions_shown`
- `reply_copied`
- `gap_draft_generated`
- `candidate_submit_attempted`
- `candidate_created`

Implementation lives in:

- [`src/services/eventLog.ts`](./src/services/eventLog.ts)

Today this is stored locally for demo/testing. It is intentionally not used to fake production adoption numbers.

## Notes on Big Brain Studio template assumptions

Because the internal `poc/hello-app/` template and the existing `contract-mismatch-tracker` app were not accessible in this repo during the run, this project mirrors the requested conventions as closely as possible:

- standalone folder named `canned-reply-assistant`
- React + TypeScript
- Vibe UI components
- SCSS styling
- `src/main.tsx` entry
- config-driven board IDs

If the internal template has required host SDK bootstrapping, manifest metadata, or deployment wrappers beyond this structure, those would be the only expected integration follow-ups.
# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
