import { LocalLinter, Dialect } from "harper.js"
import { binaryInlined } from "harper.js/binaryInlined"

// Harper (Automattic, Apache-2.0) - a free, open-source, OFFLINE grammar and
// spell checker. It runs entirely in-process via WebAssembly: no external
// API calls, no per-request billing, no text ever leaves this server. This
// is deliberately unlike the earlier AI-polish idea (real Anthropic API
// calls, metered/billed per use, removed at the user's request over cost) -
// Harper has zero marginal cost per check.
//
// LocalLinter (not WorkerLinter - Harper's own docs: "This class will not
// work properly in Node. In that case, just use LocalLinter") runs
// synchronously in the current JS context, which is fine for a server route;
// it just means a very large document could briefly block the event loop,
// unlike in a browser tab where WorkerLinter offloads to a Web Worker.
//
// binaryInlined ships the ~16MB WASM binary as a base64 data URL baked into
// the JS module itself, rather than a separate .wasm asset - no webpack/
// Next.js bundler configuration needed for WebAssembly, at the cost of a
// larger server bundle. If that trade-off ever needs revisiting (e.g. cold
// start time), harper.js/binary + Next's `serverExternalPackages`/webpack
// `asyncWebAssembly` is the alternative path.
//
// Constructing the linter compiles the WASM module and builds Harper's
// curated dictionary - "the most expensive operation in Harper" per its own
// docs - so this is a lazy, module-level singleton: built once per warm
// server instance (not once per request) and reused for the process's
// lifetime.
//
// Dialect: British, not American - matches South African English spelling
// conventions (this platform's own currency/city references are South
// African: Rand, Pretoria, Cape Town...). Change to Dialect.American (or
// .Australian/.Canadian/.Indian) here if that's not the right call.
let linterPromise: Promise<LocalLinter> | null = null

function getLinter(): Promise<LocalLinter> {
  if (!linterPromise) {
    linterPromise = (async () => {
      const linter = new LocalLinter({ binary: binaryInlined, dialect: Dialect.British })
      await linter.setup()
      return linter
    })()
  }
  return linterPromise
}

export type GrammarSuggestion = { kind: "Replace" | "Remove" | "InsertAfter"; text: string }
export type GrammarIssue = {
  message: string
  kind: string
  problemText: string
  span: { start: number; end: number }
  suggestions: GrammarSuggestion[]
}

const SUGGESTION_KIND_NAMES = ["Replace", "Remove", "InsertAfter"] as const

// Every Lint/Suggestion/Span object here is a WASM-backed class instance
// (wasm-bindgen), not a plain JS object - .free() releases its WASM-side
// memory. The linter itself is a long-lived singleton we deliberately never
// dispose, but these per-call result objects are freed once their plain
// (JSON-serializable) data has been copied out, so a long-running server
// process doesn't slowly accumulate WASM memory across many checks.
export async function checkGrammar(text: string): Promise<GrammarIssue[]> {
  const linter = await getLinter()
  const lints = await linter.lint(text, { language: "plaintext" })
  try {
    return lints.map((lint) => {
      const span = lint.span()
      const suggestions = lint.suggestions().map((s) => {
        const result: GrammarSuggestion = { kind: SUGGESTION_KIND_NAMES[s.kind()] ?? "Replace", text: s.get_replacement_text() }
        s.free()
        return result
      })
      const issue: GrammarIssue = {
        message: lint.message(),
        kind: lint.lint_kind(),
        problemText: lint.get_problem_text(),
        span: { start: span.start, end: span.end },
        suggestions,
      }
      span.free()
      return issue
    })
  } finally {
    for (const lint of lints) lint.free()
  }
}
