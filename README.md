# NotebookLM Clone (Kazakh / Perplexity)

Open clone of Google NotebookLM in **Kazakh (kk-KZ)**, powered by the
**Perplexity API** (`sonar`, `sonar-pro`, `sonar-deep-research`).

> ⚠️ This is **not** an official NotebookLM. It's a Next.js application that
> implements a similar UX on top of Perplexity. Some features (e.g. realistic
> AI hosted podcasts, AI-generated video) are emulated with browser TTS /
> slideshow workarounds since they require dedicated paid models.

## Features

- **Notebooks** with auto-generated emoji + manual emoji picker.
- **Sources** — drag-and-drop PDFs, DOCX, PPTX, TXT, MD, CSV, images (with OCR
  in EN/RU), copy-paste, URLs (cheerio-based scraping), YouTube transcripts.
  Each source gets an auto-summary and tag list.
- **Chat** with the Perplexity API, grounded in the enabled sources. Inline
  `[N]` citations are clickable and open the source text. Two styles:
  *Default* and *Learning Guide* (Socratic).
- **Discover Sources / Fast Research** with keyless Parallel Search MCP or
  configured Perplexity (`sonar-pro` / `sonar`). **Deep Research** generates
  reports with `sonar-deep-research`.
- **Studio** generators:
  - Reports (Custom / FAQ / Study guide / Briefing)
  - Data Tables (CSV export)
  - Mind Map (Markmap, SVG download)
  - Flashcards (CSV export, study mode with shuffle / missed-only review)
  - Quizzes (hint, explain, score)
  - Slide Decks (PPTX download via pptxgenjs, JSON, fullscreen slideshow)
  - Infographic (HTML in iframe, PNG via html2canvas)
  - Audio Overview (Web Speech API — free browser TTS)
  - Video Overview (slideshow with TTS narration; JSON export)
- **Notes** with quick actions (combine, feedback, overview, outline, study
  guide, related ideas) and convert-to-source.
- **Persistence** via IndexedDB (`idb-keyval`), 100 % client-side. No backend
  DB required for MVP.
- **Kazakh** interface throughout; chat replies adapt to the source language.

## Setup

```bash
npm install
echo "PERPLEXITY_API_KEY=pplx-..." >> .env.local
npm run dev
```

Open <http://localhost:3000>.

### Source discovery without an API key

With no `PERPLEXITY_API_KEY` configured, **Discover Sources** and **Fast Research**
use [Parallel Search MCP](https://docs.parallel.ai/integrations/mcp/search-mcp)
for free web search in Fast mode, with no account or API key. Enter a topic in
Discover Sources, select results, and import them into your notebook. The result
summaries are excerpts from the pages. Searches have a 30-second deadline;
service errors are shown in the dialog. Free access is intended for light use
and is subject to service limits.

An existing `PERPLEXITY_API_KEY` keeps source discovery on Perplexity. Set the
server environment variable `RESEARCH_PROVIDER` to override source discovery:

| Value | Behavior |
|-------|----------|
| Unset | Perplexity when its key is configured; otherwise anonymous Parallel |
| `parallel` | Anonymous Parallel, even with a Perplexity key configured |
| `perplexity` | Perplexity only; requires `PERPLEXITY_API_KEY` |
| `disabled` | Reject all research requests, including Deep Research |

Provider errors never cause a switch to another provider. Queries are sent to
the selected service. Parallel uses the Streamable HTTP MCP endpoint
`https://search.parallel.ai/mcp`; it does not read or forward API keys.
URL imports continue through the existing page parser.

**Deep Research, chat, source auto-summaries, Studio and note generation still
require `PERPLEXITY_API_KEY`.** Deep Research uses Perplexity regardless of the
source discovery provider. To run only source discovery, omit the key from the
setup above and start the app with `npm run dev`.

Run the research route tests with `npm test`.

### Deploying to Vercel

1. Import the repo on <https://vercel.com/new>.
2. Add `PERPLEXITY_API_KEY` as an environment variable (Production + Preview).
3. Deploy — that's it. The repo ships with a `vercel.json` that bumps the
   serverless function memory to 1 GB so PDF / DOCX parsing fits.

## Tech stack

- **Next.js 16** (App Router, Turbopack) — server actions and API routes for
  parsing & Perplexity calls.
- **TypeScript** strict mode.
- **Tailwind CSS v4** + minimal hand-written components (no UI kit).
- **Zustand** + **idb-keyval** for state and persistence.
- **mammoth**, **jszip**, **cheerio**, **tesseract.js**, **pdfjs-dist**,
  **youtube-transcript** for source ingestion.
- **markmap-lib**/**markmap-view**, **pptxgenjs**, **html2canvas**,
  **papaparse** for Studio artefacts.

## Limitations vs. real NotebookLM

| Area | This clone | Real NotebookLM |
|------|-------------|------------------|
| Audio Overview | Web Speech API (browser TTS) | Custom audio model with two AI hosts |
| Video Overview | Slideshow + TTS narration | Veo-class generated visuals |
| Interactive voice mode | Not implemented | Realtime voice loop |
| Google Drive / Docs / Sheets / Slides import | Not implemented (no OAuth) | First-class |
| Source word limit | 500k chars per source | 500k words |
| Max sources per notebook | Soft 50 | 50 |
| Collaboration / real-time sync | None | Shared notebooks |

## Project structure

```
src/
  app/
    api/
      chat/route.ts           Perplexity-grounded chat
      sources/upload/route.ts File parsers
      sources/url/route.ts    URL + YouTube ingestion
      sources/summarize/route.ts Auto-summary
      studio/route.ts         Studio artifact generation
      notes/quick/route.ts    Quick actions on notes
      research/route.ts       Discover / Fast / Deep Research
    layout.tsx, page.tsx, globals.css
  components/                 UI shell + dialogs + StudioViewer
  lib/
    perplexity.ts             Perplexity API wrapper
    grounding.ts              System prompt + citation extraction
    parsers/                  File parsers
    db.ts, store.ts, i18n.ts, types.ts, emoji.ts
```
