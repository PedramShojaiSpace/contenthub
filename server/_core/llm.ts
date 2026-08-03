import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

const resolveApiUrl = () =>
  ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
    ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
    : "https://forge.manus.im/v1/chat/completions";

const assertApiKey = () => {
  if (!ENV.forgeApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
};

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

const INVOKE_LLM_MAX_RETRIES = 5;
const INVOKE_LLM_BASE_DELAY_MS = 1000; // 1s → 2s → 4s → 8s → 16s

/**
 * The flagship model every invokeLLM call uses. Overridable with LLM_MODEL so a
 * sandbox can be pointed at a cheaper tier without a code change.
 *
 * Chosen for a long-form copywriting workload (15-minute YouTube scripts), where
 * prose quality matters more than latency.
 */
export const LLM_MODEL = process.env.LLM_MODEL || "gpt-5.5";

/**
 * `max_tokens` vs `max_completion_tokens` is model-dependent, so it is derived
 * from the model name rather than hardcoded. The gpt-5 family and the o-series
 * reasoning models accept only `max_completion_tokens`; gpt-4o / gpt-4.1 and
 * earlier accept only `max_tokens`. Sending the wrong one is a hard 400.
 */
const usesCompletionTokensParam = (model: string) =>
  /^(gpt-5|o1|o3|o4)/.test(model);

const MAX_TOKENS_PARAM = usesCompletionTokensParam(LLM_MODEL)
  ? "max_completion_tokens"
  : "max_tokens";

/**
 * On reasoning-capable models this budget is shared between internal reasoning
 * and the visible answer, so the previous 8192 could be consumed before a
 * 15-minute script (~2,000+ words) finished — returning truncated prose with
 * finish_reason "length". Raised for the completion-tokens family only; the
 * older families keep the 8192 that was tuned for their gateway timeouts.
 */
const DEFAULT_MAX_TOKENS = MAX_TOKENS_PARAM === "max_completion_tokens" ? 32768 : 8192;

export async function invokeLLM(params: InvokeParams, _retryCount = 0): Promise<InvokeResult> {
  assertApiKey();

  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
  } = params;

  const payload: Record<string, unknown> = {
    // Single-point model config. Verified present on the operator's account via
    // GET /v1/models (2026-08). Changing the flagship model is a one-line edit
    // here — no caller passes a model, so this is the only place it is decided.
    model: LLM_MODEL,
    messages: messages.map(normalizeMessage),
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  // Default max_tokens — callers can override via maxTokens/max_tokens param.
  // 8192 is sufficient for full blog posts and avoids gateway timeouts that
  // occurred with the previous 32768 value on the Cloud Run infrastructure.
  const callerMaxTokens = params.maxTokens ?? params.max_tokens;
  // PARAMETER NAME IS MODEL-DEPENDENT. The gpt-5 family REJECTS `max_tokens`
  // outright:
  //   400 "Unsupported parameter: 'max_tokens' is not supported with this
  //        model. Use 'max_completion_tokens' instead."
  // Older chat models (gpt-4o, gpt-4.1) accept `max_tokens`. The public
  // maxTokens/max_tokens caller API is unchanged — only the wire name differs.
  //
  // The budget also covers reasoning tokens on this family, so it must be
  // generous: a starved budget returns finish_reason "length" with empty
  // content, which reads as a silent failure rather than an error.
  payload[MAX_TOKENS_PARAM] = callerMaxTokens ?? DEFAULT_MAX_TOKENS;
  // NOTE: The 'thinking' parameter was removed — it caused intermittent
  // 'Service Unavailable' gateway errors on the Forge API proxy.


  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }

  const response = await fetch(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  // Read the raw body first so we can inspect it before parsing
  const rawBody = await response.text();

  if (!response.ok) {
    // Detect rate limit responses specifically
    if (
      response.status === 429 ||
      rawBody.toLowerCase().includes("rate") ||
      rawBody.toLowerCase().includes("exceeded") ||
      rawBody.toLowerCase().includes("quota")
    ) {
      throw new Error("RATE_LIMIT: AI generation limit reached. Please wait a moment and try again.");
    }
    // Detect transient server errors (500/502/503/504) OR body contains 'Service Unavailable' / HTML error page
    const bodyLower = rawBody.toLowerCase();
    const isTransientBody =
      bodyLower.includes("service unavailable") ||
      bodyLower.includes("bad gateway") ||
      bodyLower.includes("gateway timeout") ||
      bodyLower.includes("temporarily unavailable") ||
      rawBody.trim().startsWith("<html") ||
      rawBody.trim().startsWith("<HTML");
    if (response.status === 503 || response.status === 502 || response.status === 504 || response.status === 500 || isTransientBody) {
      if (_retryCount < INVOKE_LLM_MAX_RETRIES) {
        const delay = INVOKE_LLM_BASE_DELAY_MS * Math.pow(2, _retryCount);
        console.warn(`[invokeLLM] ${response.status} transient error — retrying in ${delay}ms (attempt ${_retryCount + 1}/${INVOKE_LLM_MAX_RETRIES})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return invokeLLM(params, _retryCount + 1);
      }
      throw new Error(`SERVICE_UNAVAILABLE: The AI service is temporarily unavailable (${response.status}). Please try again in a moment.`);
    }
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} – ${rawBody}`
    );
  }

  // Even on HTTP 200, the API sometimes returns a plain-text error (e.g. "Rate exceeded.", "Service Unavailable")
  // Detect this before attempting JSON.parse to avoid cryptic parse errors
  const trimmed = rawBody.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    const lower = trimmed.toLowerCase();
    if (
      lower.includes("rate") ||
      lower.includes("exceeded") ||
      lower.includes("quota") ||
      lower.includes("limit")
    ) {
      // Use a distinctive prefix so callers can detect this specifically
      throw new Error(`RATE_LIMIT: AI generation limit reached. Please wait 30–60 seconds and try again. (raw: ${trimmed.slice(0, 80)})`);
    }
    // Detect plain-text service unavailable responses (e.g. "Service Unavailable")
    if (
      lower.includes("service unavailable") ||
      lower.includes("bad gateway") ||
      lower.includes("gateway timeout") ||
      lower.includes("temporarily unavailable")
    ) {
      if (_retryCount < INVOKE_LLM_MAX_RETRIES) {
        const delay = INVOKE_LLM_BASE_DELAY_MS * Math.pow(2, _retryCount);
        console.warn(`[invokeLLM] Plain-text service unavailable — retrying in ${delay}ms (attempt ${_retryCount + 1}/${INVOKE_LLM_MAX_RETRIES})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return invokeLLM(params, _retryCount + 1);
      }
      throw new Error(`SERVICE_UNAVAILABLE: The AI service is temporarily unavailable. Please try again in a moment. (raw: ${trimmed.slice(0, 80)})`);
    }
    throw new Error(`LLM returned non-JSON response: ${trimmed.slice(0, 200)}`);
  }

  let parsed: InvokeResult;
  try {
    parsed = JSON.parse(trimmed) as InvokeResult;
  } catch {
    throw new Error(`LLM response JSON parse failed: ${trimmed.slice(0, 200)}`);
  }

  // Guard: sometimes the API returns a valid JSON envelope but the content field
  // contains a plain-text or HTML error instead of the actual response.
  // Detect this and treat it as a transient error so callers don't crash on JSON.parse.
  const firstContent = parsed?.choices?.[0]?.message?.content;
  if (typeof firstContent === "string") {
    const trimmedContent = firstContent.trim();
    const lower = trimmedContent.toLowerCase();
    const isErrorContent =
      lower === "service unavailable" ||
      lower === "bad gateway" ||
      lower === "gateway timeout" ||
      lower.startsWith("503") ||
      lower.startsWith("502") ||
      lower.startsWith("504") ||
      lower.startsWith("500") ||
      trimmedContent.startsWith("<!DOCTYPE") ||
      trimmedContent.startsWith("<!doctype") ||
      trimmedContent.startsWith("<html") ||
      trimmedContent.startsWith("<HTML") ||
      lower.includes("service unavailable") ||
      lower.includes("bad gateway") ||
      lower.includes("temporarily unavailable");
    if (isErrorContent) {
      if (_retryCount < INVOKE_LLM_MAX_RETRIES) {
        const delay = INVOKE_LLM_BASE_DELAY_MS * Math.pow(2, _retryCount);
        console.warn(`[invokeLLM] Content field contains error/HTML — retrying in ${delay}ms (attempt ${_retryCount + 1}/${INVOKE_LLM_MAX_RETRIES}): ${trimmedContent.slice(0, 60)}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return invokeLLM(params, _retryCount + 1);
      }
      throw new Error(`SERVICE_UNAVAILABLE: The AI service returned an error in the response content. Please try again in a moment.`);
    }
  }

  // Guard: API returned a valid JSON object but it's an error envelope (e.g. {"error": "Service Unavailable"})
  // or the choices array is missing/empty — both indicate a transient upstream failure.
  const hasChoices = Array.isArray(parsed?.choices) && parsed.choices.length > 0;
  if (!hasChoices) {
    const errorField = (parsed as any)?.error;
    const errorMsg = typeof errorField === 'string' ? errorField.toLowerCase() :
      typeof errorField === 'object' ? JSON.stringify(errorField).toLowerCase() : '';
    const isTransient =
      errorMsg.includes('service unavailable') ||
      errorMsg.includes('bad gateway') ||
      errorMsg.includes('temporarily unavailable') ||
      errorMsg.includes('gateway timeout') ||
      errorMsg.includes('unavailable') ||
      !hasChoices; // any response without choices is unexpected — treat as transient
    if (isTransient) {
      if (_retryCount < INVOKE_LLM_MAX_RETRIES) {
        const delay = INVOKE_LLM_BASE_DELAY_MS * Math.pow(2, _retryCount);
        console.warn(`[invokeLLM] Malformed/error response (no choices) — retrying in ${delay}ms (attempt ${_retryCount + 1}/${INVOKE_LLM_MAX_RETRIES}): ${JSON.stringify(parsed).slice(0, 80)}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return invokeLLM(params, _retryCount + 1);
      }
      throw new Error(`SERVICE_UNAVAILABLE: The AI service returned an unexpected response. Please try again in a moment.`);
    }
  }

  return parsed;
}
