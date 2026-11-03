/**
 * linkscribe core: a thin client for the txscribe REST API.
 *
 * Shared rules, as documented:
 * - Base URL: env `TXSCRIBE_API_BASE`, default
 *   `https://txscribe.ai/api/v1`.
 * - Auth: env `TXSCRIBE_API_KEY`, sent as
 *   `Authorization: Bearer <key>`. If the key is unset, every
 *   tool fails with `TXSCRIBE_API_KEY is not set` and no
 *   request is made.
 * - All upstream access goes through an injectable fetch;
 *   tests use fake fetch only.
 * - A successful call returns the upstream JSON body
 *   verbatim as the result text.
 * - Upstream error bodies have the shape
 *   `{error: {code, message, requestId}}`; a non-2xx response
 *   fails with `txscribe error: <code> (HTTP <status>)` when
 *   the body parses to that shape, else
 *   `txscribe error: HTTP <status>`. A throwing fetch fails
 *   with `txscribe unreachable`.
 * - Argument validation happens before any request: a
 *   required argument missing or not a non-empty string
 *   fails with `<name> must be a non-empty string`;
 *   `get_transcript`'s `format`, when present, must be one
 *   of the documented enum values, else it fails with
 *   `format must be one of: json, txt, docx, pdf, srt, vtt,
 *   fcpxml, premiere, nvivo, maxqda, atlasti`.
 * - POST bodies send only the arguments that are present.
 */
import type {
  DeleteTranscriptionArgs,
  FetchFn,
  FetchResponseLike,
  GetSummaryArgs,
  GetTranscriptionArgs,
  GetTranscriptArgs,
  ListTranscriptionsArgs,
  RequestSummaryArgs,
  ScribeDeps,
  SearchTranscriptionsArgs,
  TranscribeLinkArgs,
} from "./types.js";

export const VERSION = "0.1.0";

export const DEFAULT_BASE_URL = "https://txscribe.ai/api/v1";

export const TRANSCRIPT_FORMATS = [
  "json",
  "txt",
  "docx",
  "pdf",
  "srt",
  "vtt",
  "fcpxml",
  "premiere",
  "nvivo",
  "maxqda",
  "atlasti",
] as const;

const FORMAT_ERROR =
  "format must be one of: json, txt, docx, pdf, srt, vtt, fcpxml, premiere, nvivo, maxqda, atlasti";

function requireNonEmptyString(name: string, value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value;
}

function requireApiKey(deps: ScribeDeps): string {
  const env = deps.env ?? process.env;
  const key = deps.apiKey ?? env.TXSCRIBE_API_KEY;
  if (!key) throw new Error("TXSCRIBE_API_KEY is not set");
  return key;
}

function baseUrl(deps: ScribeDeps): string {
  const env = deps.env ?? process.env;
  return (deps.baseUrl ?? env.TXSCRIBE_API_BASE ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
}

const defaultFetch: FetchFn = async (url, init) => {
  const res = await fetch(url, init);
  return { ok: res.ok, status: res.status, text: () => res.text() };
};

function queryString(
  pairs: Array<[string, string | number | boolean | undefined]>,
): string {
  const params = new URLSearchParams();
  for (const [name, value] of pairs) {
    if (value === undefined) continue;
    params.append(name, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Run one request against the API and return the body text
 * verbatim. The API key is checked before the request is
 * made (callers validate arguments before calling this).
 */
async function callApi(
  deps: ScribeDeps,
  method: string,
  path: string,
  opts: { query?: string; body?: Record<string, unknown> } = {},
): Promise<string> {
  const key = requireApiKey(deps);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
  };
  let body: string | undefined;
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  const fetchFn = deps.fetchFn ?? defaultFetch;
  let res: FetchResponseLike;
  try {
    res = await fetchFn(`${baseUrl(deps)}${path}${opts.query ?? ""}`, {
      method,
      headers,
      body,
    });
  } catch {
    throw new Error("txscribe unreachable");
  }
  const text = await res.text();
  if (res.status < 200 || res.status >= 300) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (typeof parsed === "object" && parsed !== null) {
        const err = (parsed as Record<string, unknown>).error;
        if (typeof err === "object" && err !== null) {
          const code = (err as Record<string, unknown>).code;
          if (typeof code === "string" || typeof code === "number") {
            throw new Error(`txscribe error: ${code} (HTTP ${res.status})`);
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && !(err instanceof SyntaxError)) throw err;
    }
    throw new Error(`txscribe error: HTTP ${res.status}`);
  }
  return text;
}

/** Only the entries whose value is present, in the given order. */
function presentBody(
  pairs: Array<[string, unknown]>,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const [name, value] of pairs) {
    if (value !== undefined) body[name] = value;
  }
  return body;
}

/* ------------------------------------------------------------------ */
/* 1. list_transcriptions                                              */
/* ------------------------------------------------------------------ */

/** Your transcriptions, newest first, with paging. */
export async function listTranscriptions(
  args: ListTranscriptionsArgs = {},
  deps: ScribeDeps = {},
): Promise<string> {
  const a = (args ?? {}) as unknown as Record<string, unknown>;
  const query = queryString([
    ["limit", a.limit as number | undefined],
    ["cursor", a.cursor as string | undefined],
    ["status", a.status as string | undefined],
  ]);
  return callApi(deps, "GET", "/transcriptions", { query });
}

/* ------------------------------------------------------------------ */
/* 2. search_transcriptions                                            */
/* ------------------------------------------------------------------ */

/** Which recordings said a word or phrase, and when. */
export async function searchTranscriptions(
  args: SearchTranscriptionsArgs,
  deps: ScribeDeps = {},
): Promise<string> {
  const a = (args ?? {}) as unknown as Record<string, unknown>;
  const q = requireNonEmptyString("q", a.q);
  const query = queryString([["q", q]]);
  return callApi(deps, "GET", "/search", { query });
}

/* ------------------------------------------------------------------ */
/* 3. transcribe_link                                                  */
/* ------------------------------------------------------------------ */

/** Create a transcription from a link. */
export async function transcribeLink(
  args: TranscribeLinkArgs,
  deps: ScribeDeps = {},
): Promise<string> {
  const a = (args ?? {}) as unknown as Record<string, unknown>;
  const url = requireNonEmptyString("url", a.url);
  const body = presentBody([
    ["url", url],
    ["language", a.language],
    ["diarization", a.diarization],
    ["captions", a.captions],
  ]);
  return callApi(deps, "POST", "/transcriptions", { body });
}

/* ------------------------------------------------------------------ */
/* 4. get_transcription                                                */
/* ------------------------------------------------------------------ */

/** Status and metadata of one transcription. */
export async function getTranscription(
  args: GetTranscriptionArgs,
  deps: ScribeDeps = {},
): Promise<string> {
  const a = (args ?? {}) as unknown as Record<string, unknown>;
  const id = requireNonEmptyString("id", a.id);
  return callApi(deps, "GET", `/transcriptions/${encodeURIComponent(id)}`);
}

/* ------------------------------------------------------------------ */
/* 5. get_transcript                                                   */
/* ------------------------------------------------------------------ */

/** The finished transcript in the requested format. */
export async function getTranscript(
  args: GetTranscriptArgs,
  deps: ScribeDeps = {},
): Promise<string> {
  const a = (args ?? {}) as unknown as Record<string, unknown>;
  const id = requireNonEmptyString("id", a.id);
  if (
    a.format !== undefined &&
    !(TRANSCRIPT_FORMATS as readonly unknown[]).includes(a.format)
  ) {
    throw new Error(FORMAT_ERROR);
  }
  const query = queryString([
    ["format", a.format as string | undefined],
    ["timestamps", a.timestamps as boolean | undefined],
    ["speakers", a.speakers as boolean | undefined],
    ["from", a.from as number | undefined],
    ["to", a.to as number | undefined],
  ]);
  return callApi(deps, "GET", `/transcriptions/${encodeURIComponent(id)}/transcript`, {
    query,
  });
}

/* ------------------------------------------------------------------ */
/* 6. get_summary                                                      */
/* ------------------------------------------------------------------ */

/** The summary and its status. */
export async function getSummary(
  args: GetSummaryArgs,
  deps: ScribeDeps = {},
): Promise<string> {
  const a = (args ?? {}) as unknown as Record<string, unknown>;
  const id = requireNonEmptyString("id", a.id);
  return callApi(deps, "GET", `/transcriptions/${encodeURIComponent(id)}/summary`);
}

/* ------------------------------------------------------------------ */
/* 7. request_summary                                                  */
/* ------------------------------------------------------------------ */

/** Ask for a summary, or a new one. */
export async function requestSummary(
  args: RequestSummaryArgs,
  deps: ScribeDeps = {},
): Promise<string> {
  const a = (args ?? {}) as unknown as Record<string, unknown>;
  const id = requireNonEmptyString("id", a.id);
  const body = presentBody([
    ["language", a.language],
    ["scene", a.scene],
  ]);
  return callApi(deps, "POST", `/transcriptions/${encodeURIComponent(id)}/summary`, {
    body,
  });
}

/* ------------------------------------------------------------------ */
/* 8. delete_transcription                                             */
/* ------------------------------------------------------------------ */

/** Delete a transcription and everything made from it. */
export async function deleteTranscription(
  args: DeleteTranscriptionArgs,
  deps: ScribeDeps = {},
): Promise<string> {
  const a = (args ?? {}) as unknown as Record<string, unknown>;
  const id = requireNonEmptyString("id", a.id);
  return callApi(deps, "DELETE", `/transcriptions/${encodeURIComponent(id)}`);
}
