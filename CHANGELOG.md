# Changelog

## 0.1.0 (2026-10-27)

- Initial release: eight MCP tools and matching CLI subcommands
  for a txscribe account — `list_transcriptions` (paging),
  `search_transcriptions` (search what was said), `transcribe_link`
  (create a transcription from a link), `get_transcription`,
  `get_transcript` (json, txt, docx, pdf, srt, vtt and the other
  documented export formats, with optional from/to windowing),
  `get_summary`, `request_summary`, and `delete_transcription`.
- Every call carries the caller's `TXSCRIBE_API_KEY` as a Bearer
  token; with the key unset every tool fails with
  `TXSCRIBE_API_KEY is not set` and no request is made.
- Upstream JSON is returned verbatim on success; upstream error
  bodies surface as `txscribe error: <code> (HTTP <status>)`.
