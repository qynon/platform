---
name: testing-notebooklm-clone
description: End-to-end test the NotebookLM clone (Perplexity-powered, Kazakh UI). Use when verifying any change to sources ingestion, chat grounding, citations, or Studio artifacts.
---

# Testing the NotebookLM clone

App under test: Next.js 16 + Perplexity API + Kazakh-only UI. Three-pane
layout (Sources / Chat / Studio). Data is client-side only (IndexedDB via
`idb-keyval`); there is no backend database to seed.

## Setup

```bash
cd /home/ubuntu/repos/notebooklm-clone
npm install            # only on first run
# .env.local must contain PERPLEXITY_API_KEY=pplx-...
npm run dev            # foreground in its own shell; ready in ~300 ms with Turbopack
```

Open <http://localhost:3000> in the in-VM Chrome (already running on the
desktop). Maximize the window before recording with:

```bash
wmctrl -r :ACTIVE: -b add,maximized_vert,maximized_horz
```

## Devin Secrets Needed

- `PERPLEXITY_API_KEY` (org secret) — every chat / studio / research route
  fails fast without it.

## Golden-path flow (covers the four pillars)

Use an **invented Kazakh fact** so the assertions catch web-mode regressions.
Example seed text: `"Атанас 12 сағат бойы үздіксіз жаттығады. Ол маратон жүгіруге дайындалады."`.

1. Header → **Блокнот жасау**. URL should change to `#nb=<id>` and a
   notebook shell with emoji + editable title should render.
2. Sources panel → **Қосу** → **Көшірілген мәтін** tab. Type a title,
   then paste the seed text **via the JS console** (see Gotchas), then «Қосу».
3. Chat input: paste a Kazakh question, click send. Verify the reply
   contains the unique fact and renders a `[1]` citation chip whose drawer
   expands to the original source text.
4. Studio → **Флэш-карталар** → **Жасау**. Modal should open within ~10 s
   with 3+ cards whose questions reference only the seed text.

## Gotchas

- **Cyrillic + xdotool**: `computer(act, type="...")` drops Cyrillic
  characters when typing into a focused field (Latin/digits/punctuation
  pass through). Use the JS console instead to set the value through React's
  native setter and dispatch an `input` event:

  ```js
  const el = document.querySelector('textarea[placeholder="Мәтінді осы жерге қойыңыз"]');
  const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  set.call(el, '<your Cyrillic text>');
  el.dispatchEvent(new Event('input', { bubbles: true }));
  ```

  Don't rely on `document.execCommand('insertText')` — it does not trigger
  React's `onChange` on controlled inputs.
- **Citation chip vs drawer**: the `[N]` chip and the right-hand drawer are
  rendered from two different code paths (`citationsFromResponse` extractor
  vs the `Source` lookup in the store). Always verify both — a broken
  citation regex tends to render only one.
- **Web-mode regressions**: if the chat reply seems plausible *without*
  referencing the invented fact, source grounding may have broken. The fix
  lives in `src/lib/perplexity.ts` (`web_search_options.search_context_size`
  + `search_domain_filter`) and `src/lib/grounding.ts` (system prompt).
- **Audio Overview in Linux Chrome**: the sandbox typically has no Kazakh
  voice installed, so `speechSynthesis` falls back to a default voice or
  stays silent. Don't assert on audio output unless a Kazakh voice is
  present (`speechSynthesis.getVoices().filter(v => v.lang.startsWith('kk'))`).
- **Deep Research** takes ~60 s and exercises the same store → chat →
  citation paths as a regular chat answer, so skip it from the recorded
  golden-path run and verify separately if needed.
- **Studio generation latency**: typical Studio artifact (flashcards / quiz
  / mindmap / report) finishes in 5–15 s on `sonar-pro`; if it spins for
  >30 s suspect a Perplexity rate-limit or model-name typo in
  `src/app/api/studio/route.ts`.

## Quick verification commands (no UI required)

```bash
# Chat grounded in a one-line source
curl -s http://localhost:3000/api/chat -H 'Content-Type: application/json' -d '{
  "messages":[{"role":"user","content":"Атанас қанша сағат жаттығады?"}],
  "sources":[{"id":"1","title":"Atanas","content":"Атанас 12 сағат жаттығады.","enabled":true}],
  "style":"default"}' | jq .

# Studio flashcards
curl -s http://localhost:3000/api/studio -H 'Content-Type: application/json' -d '{
  "kind":"flashcards",
  "sources":[{"id":"1","title":"Atanas","content":"Атанас 12 сағат жаттығады.","enabled":true}]}' | jq .
```

Useful pre-checks when something looks broken: `npm run lint` and
`npm run build`. Both must pass; the build catches missing imports the dev
server tolerates.

## Reporting

Write a single `test-report.md` with one screenshot per assertion (A1 … An)
and attach it to the user message. Post a single PR comment with collapsed
`<details>` per assertion plus the Devin session link.
