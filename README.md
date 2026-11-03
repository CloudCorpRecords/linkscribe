# linkscribe

Hand linkscribe a link and get words back. linkscribe talks to
a txscribe account: paste a link to a recording — a YouTube
video, a Google Drive file, a Dropbox share — and the service
transcribes it (the recording itself is transcribed in place,
never downloaded). From there you can read the finished
transcript in the format you need, ask for a summary, search
every recording for the moment a word or phrase was said, and
clean up recordings you no longer want.

The eight tools:

- `list_transcriptions` — your transcriptions, newest first,
  with `limit` / `cursor` paging and an optional `status`
  filter.
- `search_transcriptions` — search what was said, not titles:
  up to five matches per recording, each with the second it
  starts at.
- `transcribe_link` — create a transcription from a link
  (YouTube, TikTok, Instagram, X (Twitter), Facebook, Vimeo,
  Loom, Dropbox). Optional `language` (`"auto"` or a code such
  as `en-US`), `diarization`, and `captions` (YouTube only: use
  the video's own captions when they fit). Uses your minutes.
- `get_transcription` — status and metadata of one
  transcription.
- `get_transcript` — the finished transcript as `json`
  (segments, word timings, speakers), `txt`, `docx`, `pdf`,
  `srt`, `vtt`, `fcpxml`, `premiere`, `nvivo`, `maxqda`, or
  `atlasti`; optional `timestamps` and `speakers`, and `from` /
  `to` in seconds to return only the paragraphs around a
  moment.
- `get_summary` — the summary and its status.
- `request_summary` — ask for a summary, or a new one, in an
  output `language` and for a kind of recording (`scene`, e.g.
  meeting, interview, lecture; omit to let the model choose).
- `delete_transcription` — delete a transcription and
  everything made from it. Cannot be undone.

Every call is made with your own txscribe API key:

```bash
export TXSCRIBE_API_KEY="txs_live_…"   # sent as Authorization: Bearer <key>
# optional: export TXSCRIBE_API_BASE="https://txscribe.ai/api/v1"
```

With `TXSCRIBE_API_KEY` unset the server still starts and
lists its tools, but every tool call fails with
`TXSCRIBE_API_KEY is not set` and no request is made. On
success a tool returns the upstream JSON body verbatim. An
upstream error surfaces as `txscribe error: <code> (HTTP
<status>)` when the error body carries a code, otherwise
`txscribe error: HTTP <status>`; an unreachable service
surfaces as `txscribe unreachable`.

Not built, by design: the REST webhooks endpoints and the
file-upload flow are not MCP tools in the original service,
so linkscribe does not expose them either. The README of the
original also mentions a `summaryOnly` flag for
`get_transcript`; it does not exist in the published OpenAPI
document, so it is not exposed here.

## CLI

Each tool is a subcommand taking one JSON argument string:

```bash
npx @reneturcios/linkscribe list_transcriptions '{"limit":10}'
npx @reneturcios/linkscribe search_transcriptions '{"q":"budget"}'
npx @reneturcios/linkscribe transcribe_link '{"url":"https://youtu.be/…","diarization":true}'
npx @reneturcios/linkscribe get_transcript '{"id":"<id>","format":"srt"}'
npx @reneturcios/linkscribe request_summary '{"id":"<id>","scene":"meeting"}'
npx @reneturcios/linkscribe --version
```

Output is the tool's result text. Exit codes: `0` on
success, `1` on a runtime error (including a validation or
txscribe failure), `2` on a usage error.

## MCP server

```bash
npx -y @reneturcios/linkscribe mcp
```

MCP client config:

```json
{
  "mcpServers": {
    "linkscribe": {
      "command": "npx",
      "args": ["-y", "@reneturcios/linkscribe", "mcp"],
      "env": {
        "TXSCRIBE_API_KEY": "txs_live_…"
      }
    }
  }
}
```

## Docker

```bash
docker run -i -e TXSCRIBE_API_KEY="txs_live_…" ghcr.io/cloudcorprecords/linkscribe
docker run --rm -e TXSCRIBE_API_KEY="txs_live_…" ghcr.io/cloudcorprecords/linkscribe list_transcriptions '{}'
```

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # tsx --test test/*.test.ts (fake fetch only, no network)
npm run dev     # run the CLI from source
```

## License

MIT — Copyright (c) 2026 Rene Turcios
