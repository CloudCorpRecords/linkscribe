# BUILD-REPORT — linkscribe 0.1.0

Rebuild of npm `@txscribe/mcp` as `@reneturcios/linkscribe`
(MCP name `io.github.CloudCorpRecords/linkscribe`), built from
`specs-batch22/linkscribe.md` against the parity fixture
`harness/fixtures/txscribe-mcp-tools-original.json`.

## Tools built (8)

All eight tools are implemented in `src/scribe.ts` behind an
injectable fetch, served by `src/mcp.ts` through the low-level
`Server` API with the fixture's exact JSON-schema literals,
and mirrored as CLI subcommands in `src/cli.ts`:

- `list_transcriptions` — GET /transcriptions, present
  `limit` / `cursor` / `status` as query params.
- `search_transcriptions` — GET /search?q=…
- `transcribe_link` — POST /transcriptions, body sends only
  present args (`url`, `language`, `diarization`, `captions`).
- `get_transcription` — GET /transcriptions/<id>.
- `get_transcript` — GET /transcriptions/<id>/transcript,
  present args as query params; `format` validated against
  the documented enum with the pinned error message.
- `get_summary` — GET /transcriptions/<id>/summary.
- `request_summary` — POST /transcriptions/<id>/summary,
  body sends only present args (`language`, `scene`).
- `delete_transcription` — DELETE /transcriptions/<id>.

Behaviour: `TXSCRIBE_API_KEY` sent as `Authorization: Bearer`;
unset → every tool fails `TXSCRIBE_API_KEY is not set` with no
request made (server still lists tools). Base URL from
`TXSCRIBE_API_BASE`, default `https://txscribe.ai/api/v1`.
Success returns the upstream JSON body verbatim. Error bodies
`{error:{code,message,requestId}}` → `txscribe error: <code>
(HTTP <status>)`; unparseable/shape-mismatched → `txscribe
error: HTTP <status>`; throwing fetch → `txscribe
unreachable`. Required-string validation →
`<name> must be a non-empty string`, before any request.

## Verification

- `npm run build` — exit 0.
- `npx tsc --noEmit` — exit 0.
- `npm test` — 30 tests, 30 pass, 0 fail (fake fetch only; no
  live network call anywhere).
- `node dist/cli.js --version` — prints `0.1.0`.
- Unknown subcommand — usage, exit 2. A tool call with no API
  key — exit 1 with `TXSCRIBE_API_KEY is not set`.
- Parity: `python3 harness/parity.py --original
  harness/fixtures/txscribe-mcp-tools-original.json --rebuild
  "stdio:node builds/linkscribe/dist/cli.js mcp" --out
  builds/linkscribe/parity-out` → **PASS, parity 100.0,
  identical_tools 8 / total 8**, no missing, extra, or
  schema-differing tools.
- Lockfile (Route 3, clean from birth): generated in a temp
  dir containing only `package.json` via
  `npm install --package-lock-only --ignore-scripts --offline`;
  verified it parses, `name` == `@reneturcios/linkscribe`,
  **128 package entries**; copied in as `package-lock.json`,
  then `npm install --offline --ignore-scripts` in the build
  dir for `node_modules`.
- Version `0.1.0` consistent across `package.json`,
  `server.json` (top level, npm entry, OCI tag
  `ghcr.io/cloudcorprecords/linkscribe:0.1.0`), the core
  `VERSION` constant, and the CHANGELOG heading. The OCI
  entry in `server.json` carries no `version` field; the
  `server.json` description is exactly 86 characters.

## Recorded non-builds

- **Webhooks** — the REST webhooks endpoints
  (GET/POST/DELETE /webhooks) are not MCP tools in the
  original and are not built.
- **Upload flow** — the OpenAPI upload flow (CreateForUpload
  + PUT + /start) is not a tool and is not built; the
  original's README pins that uploading a file is not a tool.
- **`summaryOnly`** — the original README mentions a
  `summaryOnly` flag for `get_transcript`, but it does not
  exist in the published OpenAPI, so it is NOT exposed (a
  test pins that it never reaches the query string).

No live txscribe call was made; all behaviour is proven
against fake fetch only.
