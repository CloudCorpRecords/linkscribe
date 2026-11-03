import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  deleteTranscription,
  getSummary,
  getTranscription,
  getTranscript,
  listTranscriptions,
  requestSummary,
  searchTranscriptions,
  transcribeLink,
} from "../src/scribe.js";
import type { FetchFn, ScribeDeps } from "../src/types.js";

/**
 * Every test runs against an injected fake fetch: no live
 * network, no live txscribe call is made.
 */

type Reply = { status?: number; body: unknown };
type Handler = (url: string, init?: CapturedInit) => Reply;
type CapturedInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

interface Capture {
  urls: string[];
  inits: CapturedInit[];
}

function makeFetch(handler: Handler, capture: Capture): FetchFn {
  return async (url, init) => {
    capture.urls.push(url);
    capture.inits.push(init ?? {});
    const r = handler(url, init);
    const status = r.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => (typeof r.body === "string" ? r.body : JSON.stringify(r.body)),
    };
  };
}

function newCapture(): Capture {
  return { urls: [], inits: [] };
}

function deps(fetchFn: FetchFn, extra: Partial<ScribeDeps> = {}): ScribeDeps {
  return { fetchFn, apiKey: "txs_live_test", ...extra };
}

function okFetch(capture: Capture, body: unknown = { ok: true }): FetchFn {
  return makeFetch(() => ({ body }), capture);
}

const throwingFetch: FetchFn = async () => {
  throw new Error("connection refused");
};

async function expectError(promise: Promise<unknown>, message: string): Promise<void> {
  await assert.rejects(promise, (err: unknown) => {
    assert.equal(err instanceof Error ? err.message : String(err), message);
    return true;
  });
}

describe("list_transcriptions", () => {
  it("GETs /transcriptions with no query when no args are given", async () => {
    const capture = newCapture();
    const out = await listTranscriptions({}, deps(okFetch(capture, { items: [] })));
    assert.equal(out, '{"items":[]}');
    assert.deepEqual(capture.urls, ["https://txscribe.ai/api/v1/transcriptions"]);
    assert.equal(capture.inits[0].method, "GET");
  });

  it("sends present paging args as query params", async () => {
    const capture = newCapture();
    await listTranscriptions(
      { limit: 10, cursor: "cur 1", status: "done" },
      deps(okFetch(capture)),
    );
    assert.deepEqual(capture.urls, [
      "https://txscribe.ai/api/v1/transcriptions?limit=10&cursor=cur+1&status=done",
    ]);
  });

  it("sends the API key as a Bearer header", async () => {
    const capture = newCapture();
    await listTranscriptions({}, deps(okFetch(capture)));
    assert.equal(capture.inits[0].headers?.Authorization, "Bearer txs_live_test");
  });

  it("honours an injected base URL", async () => {
    const capture = newCapture();
    await listTranscriptions(
      {},
      deps(okFetch(capture), { baseUrl: "https://example.test/api/" }),
    );
    assert.deepEqual(capture.urls, ["https://example.test/api/transcriptions"]);
  });
});

describe("search_transcriptions", () => {
  it("GETs /search with the encoded phrase", async () => {
    const capture = newCapture();
    const out = await searchTranscriptions({ q: "hello world" }, deps(okFetch(capture)));
    assert.equal(out, '{"ok":true}');
    assert.deepEqual(capture.urls, ["https://txscribe.ai/api/v1/search?q=hello+world"]);
  });

  it("rejects a missing q before any request", async () => {
    const capture = newCapture();
    await expectError(
      searchTranscriptions({} as never, deps(okFetch(capture))),
      "q must be a non-empty string",
    );
    assert.deepEqual(capture.urls, []);
  });

  it("rejects an empty q", async () => {
    const capture = newCapture();
    await expectError(
      searchTranscriptions({ q: "" }, deps(okFetch(capture))),
      "q must be a non-empty string",
    );
    assert.deepEqual(capture.urls, []);
  });
});

describe("transcribe_link", () => {
  it("POSTs /transcriptions with only the present args in the body", async () => {
    const capture = newCapture();
    await transcribeLink(
      { url: "https://youtu.be/abc", diarization: true },
      deps(okFetch(capture, { id: "t1" })),
    );
    assert.deepEqual(capture.urls, ["https://txscribe.ai/api/v1/transcriptions"]);
    assert.equal(capture.inits[0].method, "POST");
    assert.deepEqual(JSON.parse(capture.inits[0].body ?? "{}"), {
      url: "https://youtu.be/abc",
      diarization: true,
    });
    assert.equal(capture.inits[0].headers?.["Content-Type"], "application/json");
  });

  it("sends every present optional arg", async () => {
    const capture = newCapture();
    await transcribeLink(
      {
        url: "https://vimeo.com/1",
        language: "en-US",
        diarization: false,
        captions: true,
      },
      deps(okFetch(capture)),
    );
    assert.deepEqual(JSON.parse(capture.inits[0].body ?? "{}"), {
      url: "https://vimeo.com/1",
      language: "en-US",
      diarization: false,
      captions: true,
    });
  });

  it("rejects a missing url before any request", async () => {
    const capture = newCapture();
    await expectError(
      transcribeLink({} as never, deps(okFetch(capture))),
      "url must be a non-empty string",
    );
    assert.deepEqual(capture.urls, []);
  });
});

describe("get_transcription / get_summary / delete_transcription", () => {
  it("GETs one transcription by id", async () => {
    const capture = newCapture();
    await getTranscription({ id: "t 1" }, deps(okFetch(capture)));
    assert.deepEqual(capture.urls, ["https://txscribe.ai/api/v1/transcriptions/t%201"]);
    assert.equal(capture.inits[0].method, "GET");
  });

  it("GETs the summary of one transcription", async () => {
    const capture = newCapture();
    await getSummary({ id: "t1" }, deps(okFetch(capture)));
    assert.deepEqual(capture.urls, [
      "https://txscribe.ai/api/v1/transcriptions/t1/summary",
    ]);
  });

  it("DELETEs one transcription", async () => {
    const capture = newCapture();
    await deleteTranscription({ id: "t1" }, deps(okFetch(capture)));
    assert.deepEqual(capture.urls, ["https://txscribe.ai/api/v1/transcriptions/t1"]);
    assert.equal(capture.inits[0].method, "DELETE");
  });

  it("rejects a missing id before any request", async () => {
    const capture = newCapture();
    await expectError(
      getTranscription({} as never, deps(okFetch(capture))),
      "id must be a non-empty string",
    );
    assert.deepEqual(capture.urls, []);
  });

  it("rejects a non-string id", async () => {
    const capture = newCapture();
    await expectError(
      deleteTranscription({ id: 7 } as never, deps(okFetch(capture))),
      "id must be a non-empty string",
    );
    assert.deepEqual(capture.urls, []);
  });
});

describe("get_transcript", () => {
  it("GETs the transcript with no query by default", async () => {
    const capture = newCapture();
    await getTranscript({ id: "t1" }, deps(okFetch(capture)));
    assert.deepEqual(capture.urls, [
      "https://txscribe.ai/api/v1/transcriptions/t1/transcript",
    ]);
  });

  it("sends present args as query params", async () => {
    const capture = newCapture();
    await getTranscript(
      { id: "t1", format: "srt", timestamps: true, speakers: false, from: 12.5, to: 40 },
      deps(okFetch(capture)),
    );
    assert.deepEqual(capture.urls, [
      "https://txscribe.ai/api/v1/transcriptions/t1/transcript?format=srt&timestamps=true&speakers=false&from=12.5&to=40",
    ]);
  });

  it("accepts every documented format value", async () => {
    for (const format of [
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
    ]) {
      const capture = newCapture();
      await getTranscript({ id: "t1", format }, deps(okFetch(capture)));
      assert.equal(capture.urls.length, 1);
    }
  });

  it("rejects an undocumented format with the pinned message, before any request", async () => {
    const capture = newCapture();
    await expectError(
      getTranscript({ id: "t1", format: "mp3" }, deps(okFetch(capture))),
      "format must be one of: json, txt, docx, pdf, srt, vtt, fcpxml, premiere, nvivo, maxqda, atlasti",
    );
    assert.deepEqual(capture.urls, []);
  });

  it("does not expose a summaryOnly argument (absent from the query)", async () => {
    const capture = newCapture();
    await getTranscript(
      { id: "t1", summaryOnly: true } as never,
      deps(okFetch(capture)),
    );
    assert.deepEqual(capture.urls, [
      "https://txscribe.ai/api/v1/transcriptions/t1/transcript",
    ]);
  });
});

describe("request_summary", () => {
  it("POSTs the summary endpoint with an empty body when no options are given", async () => {
    const capture = newCapture();
    await requestSummary({ id: "t1" }, deps(okFetch(capture)));
    assert.deepEqual(capture.urls, [
      "https://txscribe.ai/api/v1/transcriptions/t1/summary",
    ]);
    assert.equal(capture.inits[0].method, "POST");
    assert.deepEqual(JSON.parse(capture.inits[0].body ?? "{}"), {});
  });

  it("sends only the present options in the body", async () => {
    const capture = newCapture();
    await requestSummary(
      { id: "t1", language: "es", scene: "meeting" },
      deps(okFetch(capture)),
    );
    assert.deepEqual(JSON.parse(capture.inits[0].body ?? "{}"), {
      language: "es",
      scene: "meeting",
    });
  });

  it("rejects a missing id before any request", async () => {
    const capture = newCapture();
    await expectError(
      requestSummary({} as never, deps(okFetch(capture))),
      "id must be a non-empty string",
    );
    assert.deepEqual(capture.urls, []);
  });
});

describe("shared behaviour", () => {
  it("returns the upstream JSON body verbatim", async () => {
    const capture = newCapture();
    const verbatim = '{ "a": 1,\n  "b": [true, null] }';
    const out = await getTranscription({ id: "t1" }, deps(okFetch(capture, verbatim)));
    assert.equal(out, verbatim);
  });

  it("fails with TXSCRIBE_API_KEY is not set and makes no request when the key is unset", async () => {
    const capture = newCapture();
    await expectError(
      listTranscriptions({}, { fetchFn: okFetch(capture), env: {} }),
      "TXSCRIBE_API_KEY is not set",
    );
    assert.deepEqual(capture.urls, []);
  });

  it("reads the base URL from the environment", async () => {
    const capture = newCapture();
    await listTranscriptions(
      {},
      {
        fetchFn: okFetch(capture),
        env: {
          TXSCRIBE_API_KEY: "env-key",
          TXSCRIBE_API_BASE: "https://env.test/v9/",
        },
      },
    );
    assert.deepEqual(capture.urls, ["https://env.test/v9/transcriptions"]);
    assert.equal(capture.inits[0].headers?.Authorization, "Bearer env-key");
  });

  it("maps an upstream error body to txscribe error: <code> (HTTP <status>)", async () => {
    const capture = newCapture();
    const fetchFn = makeFetch(
      () => ({
        status: 404,
        body: { error: { code: "not_found", message: "no such transcription", requestId: "r1" } },
      }),
      capture,
    );
    await expectError(
      getTranscription({ id: "nope" }, deps(fetchFn)),
      "txscribe error: not_found (HTTP 404)",
    );
  });

  it("maps an unparseable error body to txscribe error: HTTP <status>", async () => {
    const capture = newCapture();
    const fetchFn = makeFetch(() => ({ status: 502, body: "bad gateway" }), capture);
    await expectError(
      getTranscription({ id: "t1" }, deps(fetchFn)),
      "txscribe error: HTTP 502",
    );
  });

  it("maps an error body without the documented shape to txscribe error: HTTP <status>", async () => {
    const capture = newCapture();
    const fetchFn = makeFetch(
      () => ({ status: 500, body: { message: "boom" } }),
      capture,
    );
    await expectError(
      getTranscription({ id: "t1" }, deps(fetchFn)),
      "txscribe error: HTTP 500",
    );
  });

  it("maps a throwing fetch to txscribe unreachable", async () => {
    await expectError(
      getTranscription({ id: "t1" }, deps(throwingFetch)),
      "txscribe unreachable",
    );
  });
});
