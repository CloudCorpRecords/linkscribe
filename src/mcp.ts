/**
 * linkscribe MCP server. Tools: list_transcriptions,
 * search_transcriptions, transcribe_link, get_transcription,
 * get_transcript, get_summary, request_summary,
 * delete_transcription.
 *
 * Why the low-level Server instead of McpServer: the
 * high-level helper converts zod schemas to JSON Schema and
 * injects keys that are not in this tool set's documented
 * spec ("$schema" and "additionalProperties"), which breaks
 * exact tool-list/schema parity with the spec. This file
 * serves tools/list with the spec's exact input schemas as
 * explicit literals, and the core validates every tools/call
 * argument set itself.
 *
 * Every tool returns a single text item carrying the
 * upstream JSON verbatim; validation and upstream failures
 * come back as isError results carrying the documented
 * error strings.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import {
  deleteTranscription,
  getSummary,
  getTranscription,
  getTranscript,
  listTranscriptions,
  requestSummary,
  searchTranscriptions,
  transcribeLink,
  VERSION,
} from "./scribe.js";

const TOOLS = [
  {
    name: "list_transcriptions",
    description: "Your transcriptions, newest first, with paging.",
    inputSchema: {
      type: "object" as const,
      properties: {
        cursor: { type: "string" , description: "Pagination cursor from a previous response (optional)." },
        limit: { type: "integer" , description: "Maximum number of results to return (optional)." },
        status: { type: "string" , description: "Status filter for this call." },
      },
    },
  },
  {
    name: "search_transcriptions",
    description:
      "Which recordings said a word or phrase, and when: up to five matches each, with the second they start at. Searches what was said, not titles.",
    inputSchema: {
      type: "object" as const,
      properties: {
        q: {
          type: "string",
          description: "The word or phrase to search for.",
        },
      },
      required: ["q"],
    },
  },
  {
    name: "transcribe_link",
    description:
      "Create a transcription from a link (YouTube, Google Drive, Dropbox …). The recording is transcribed, never downloaded. Uses your minutes.",
    inputSchema: {
      type: "object" as const,
      properties: {
        captions: {
          type: "boolean",
          description: "YouTube only: use the video's own captions when they fit.",
        },
        diarization: { type: "boolean" , description: "The diarization for this call." },
        language: {
          type: "string",
          description: "\"auto\", or a language code such as en-US",
        },
        url: {
          type: "string",
          description:
            "A link to a video or recording on YouTube, TikTok, Instagram, X (Twitter), Facebook, Vimeo, Loom, Dropbox.",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "get_transcription",
    description: "Status and metadata of one transcription.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string" , description: "Identifier of the record to operate on." },
      },
      required: ["id"],
    },
  },
  {
    name: "get_transcript",
    description:
      "The finished transcript as json (segments, word timings, speakers), txt, srt or vtt; from and to (seconds) for only the paragraphs around a moment.",
    inputSchema: {
      type: "object" as const,
      properties: {
        format: {
          type: "string",
          enum: [
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
          ],
         description: "Output format (optional)." },
        from: {
          type: "number",
          description: "Seconds into the recording.",
        },
        id: { type: "string" , description: "Identifier of the record to operate on." },
        speakers: {
          type: "boolean",
          description: "Include speaker names.",
        },
        timestamps: {
          type: "boolean",
          description: "txt and docx: include times.",
        },
        to: {
          type: "number",
          description: "Seconds into the recording; must be after from.",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "get_summary",
    description: "The summary and its status.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string" , description: "Identifier of the record to operate on." },
      },
      required: ["id"],
    },
  },
  {
    name: "request_summary",
    description:
      "Ask for a summary, or a new one, in a language and for a kind of recording.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string" , description: "Identifier of the record to operate on." },
        language: {
          type: "string",
          description: "Output language; defaults to the transcript's.",
        },
        scene: {
          type: "string",
          description: "meeting, interview, lecture, … Omit to let the model choose.",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_transcription",
    description: "Delete a transcription and everything made from it. Cannot be undone.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string" , description: "Identifier of the record to operate on." },
      },
      required: ["id"],
    },
  },
];

function textResult(text: string) {
  return {
    content: [{ type: "text" as const, text }],
  };
}

function errorResult(err: unknown) {
  return {
    content: [
      { type: "text" as const, text: err instanceof Error ? err.message : String(err) },
    ],
    isError: true,
  };
}

const server = new Server(
  { name: "linkscribe", version: VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = (args ?? {}) as Record<string, unknown>;
  try {
    let out: string;
    switch (name) {
      case "list_transcriptions":
        out = await listTranscriptions(a as never);
        break;
      case "search_transcriptions":
        out = await searchTranscriptions(a as never);
        break;
      case "transcribe_link":
        out = await transcribeLink(a as never);
        break;
      case "get_transcription":
        out = await getTranscription(a as never);
        break;
      case "get_transcript":
        out = await getTranscript(a as never);
        break;
      case "get_summary":
        out = await getSummary(a as never);
        break;
      case "request_summary":
        out = await requestSummary(a as never);
        break;
      case "delete_transcription":
        out = await deleteTranscription(a as never);
        break;
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    return textResult(out);
  } catch (err) {
    if (err instanceof McpError) throw err;
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

void main();
