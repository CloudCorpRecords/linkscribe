/**
 * linkscribe types.
 *
 * Eight tools against the txscribe REST API: list and search
 * transcriptions, create one from a link, read one
 * transcription, its transcript and its summary, request a
 * summary, and delete a transcription. Every tool answers
 * with the upstream JSON body as a single text string, or
 * fails with one of the documented error strings.
 */

export interface ListTranscriptionsArgs {
  limit?: number;
  cursor?: string;
  status?: string;
}

export interface SearchTranscriptionsArgs {
  q: string;
}

export interface TranscribeLinkArgs {
  url: string;
  language?: string;
  diarization?: boolean;
  captions?: boolean;
}

export interface GetTranscriptionArgs {
  id: string;
}

export interface GetTranscriptArgs {
  id: string;
  format?: string;
  timestamps?: boolean;
  speakers?: boolean;
  from?: number;
  to?: number;
}

export interface GetSummaryArgs {
  id: string;
}

export interface RequestSummaryArgs {
  id: string;
  language?: string;
  scene?: string;
}

export interface DeleteTranscriptionArgs {
  id: string;
}

/** The minimal slice of a fetch Response this client relies on. */
export interface FetchResponseLike {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

/** Injectable fetch, so tests never touch the live network. */
export type FetchFn = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<FetchResponseLike>;

/** Runtime dependencies for the core, all injectable in tests. */
export interface ScribeDeps {
  /** Fetch implementation. Defaults to the global fetch. */
  fetchFn?: FetchFn;
  /** API key. Defaults to env TXSCRIBE_API_KEY. */
  apiKey?: string;
  /** API base URL. Defaults to env TXSCRIBE_API_BASE, then the documented default. */
  baseUrl?: string;
  /** Environment to read TXSCRIBE_API_KEY / TXSCRIBE_API_BASE from. Defaults to process.env. */
  env?: Record<string, string | undefined>;
}
