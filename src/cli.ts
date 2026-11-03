#!/usr/bin/env node
/**
 * linkscribe CLI.
 *
 *   linkscribe list_transcriptions '<json>'
 *   linkscribe search_transcriptions '<json>'
 *   linkscribe transcribe_link '<json>'
 *   linkscribe get_transcription '<json>'
 *   linkscribe get_transcript '<json>'
 *   linkscribe get_summary '<json>'
 *   linkscribe request_summary '<json>'
 *   linkscribe delete_transcription '<json>'
 *   linkscribe mcp
 *   linkscribe --version
 *
 * Each tool subcommand takes one JSON argument string with the
 * tool's arguments and prints the tool's result text. Exit
 * codes: 0 success, 1 runtime error, 2 usage error.
 */
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

const TOOL_NAMES = [
  "list_transcriptions",
  "search_transcriptions",
  "transcribe_link",
  "get_transcription",
  "get_transcript",
  "get_summary",
  "request_summary",
  "delete_transcription",
] as const;

function usage(): never {
  console.error(`Usage:
  linkscribe <tool> '<json-args>'     one of: ${TOOL_NAMES.join(", ")}
  linkscribe mcp
  linkscribe --version`);
  process.exit(2);
}

async function runTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "list_transcriptions":
      return listTranscriptions(args as never);
    case "search_transcriptions":
      return searchTranscriptions(args as never);
    case "transcribe_link":
      return transcribeLink(args as never);
    case "get_transcription":
      return getTranscription(args as never);
    case "get_transcript":
      return getTranscript(args as never);
    case "get_summary":
      return getSummary(args as never);
    case "request_summary":
      return requestSummary(args as never);
    case "delete_transcription":
      return deleteTranscription(args as never);
    default:
      usage();
  }
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "--version" || cmd === "-v") {
    console.log(VERSION);
    return;
  }
  if (cmd === "mcp") {
    if (rest.length !== 0) usage();
    await import("./mcp.js");
    return;
  }
  if (!(TOOL_NAMES as readonly string[]).includes(cmd ?? "")) usage();
  if (rest.length > 1) usage();
  let args: Record<string, unknown> = {};
  if (rest.length === 1) {
    try {
      const parsed: unknown = JSON.parse(rest[0]);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) usage();
      args = parsed as Record<string, unknown>;
    } catch {
      console.error("error: argument must be a JSON object string");
      process.exit(2);
    }
  }
  try {
    const out = await runTool(cmd, args);
    console.log(out);
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

void main();
