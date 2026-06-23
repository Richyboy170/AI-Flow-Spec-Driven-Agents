const http = require("node:http");

const HOST = "127.0.0.1";
const DEFAULT_PORT = 32187;
const UPSTREAM_BASE_URL = "https://deeprouter-llm.ntl.co.th:8011";
const MAX_REQUEST_BYTES = 25 * 1024 * 1024;

function getPort(args) {
  const index = args.indexOf("--port");
  if (index === -1) return DEFAULT_PORT;

  const port = Number(args[index + 1]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("--port must be a valid TCP port");
  }
  return port;
}

function isMessageStart(block) {
  return block
    .split(/\r?\n/)
    .some((line) => line.trim().toLowerCase() === "event: message_start");
}

function filterSseBlocks(input, state, flush = false) {
  state.buffer += input;
  let output = "";

  while (true) {
    const boundary = /\r?\n\r?\n/.exec(state.buffer);
    if (!boundary) break;

    const block = state.buffer.slice(0, boundary.index);
    state.buffer = state.buffer.slice(boundary.index + boundary[0].length);

    if (isMessageStart(block)) {
      if (state.seenMessageStart) continue;
      state.seenMessageStart = true;
    }
    output += `${block}\n\n`;
  }

  if (flush && state.buffer) {
    if (!isMessageStart(state.buffer) || !state.seenMessageStart) {
      output += state.buffer;
    }
    state.buffer = "";
  }

  return output;
}

async function readRequestBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_REQUEST_BYTES) {
      const error = new Error("Request body is too large");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  return chunks.length ? Buffer.concat(chunks) : undefined;
}

function copyRequestHeaders(request) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value === undefined || ["host", "content-length", "connection"].includes(name)) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else {
      headers.set(name, value);
    }
  }
  return headers;
}

function copyResponseHeaders(upstream, response) {
  const omitted = new Set(["connection", "content-encoding", "content-length", "transfer-encoding"]);
  for (const [name, value] of upstream.headers) {
    if (!omitted.has(name.toLowerCase())) response.setHeader(name, value);
  }
}

function normalizeAssistantHistory(body, requestUrl) {
  if (!body || !requestUrl.startsWith("/v1/messages")) return body;

  let payload;
  try {
    payload = JSON.parse(body.toString("utf8"));
  } catch {
    return body;
  }
  if (!Array.isArray(payload.messages)) return body;

  let changed = false;
  const messages = [];

  for (const message of payload.messages) {
    if (!message || message.role !== "assistant") {
      messages.push(message);
      continue;
    }

    const blocks = typeof message.content === "string"
      ? [{ type: "text", text: message.content }]
      : Array.isArray(message.content) ? message.content : [];
    const textBlocks = blocks.filter((block) => block?.type === "text");
    if (textBlocks.length === 0) {
      messages.push(message);
      continue;
    }

    changed = true;
    const historyText = textBlocks.map((block) => block.text || "").join("\n");
    messages.push({
      role: "user",
      content: [{
        type: "text",
        text: `<assistant_history>\n${historyText}\n</assistant_history>`,
      }],
    });

    const nonTextBlocks = blocks.filter((block) => block?.type !== "text");
    if (nonTextBlocks.length > 0) {
      messages.push({ ...message, content: nonTextBlocks });
    }
  }

  if (!changed) return body;
  payload.messages = messages;
  return Buffer.from(JSON.stringify(payload));
}

async function pipeSse(body, response) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const state = { buffer: "", seenMessageStart: false };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const output = filterSseBlocks(decoder.decode(value, { stream: true }), state);
    if (output) response.write(output);
  }

  const output = filterSseBlocks(decoder.decode(), state, true);
  if (output) response.write(output);
  response.end();
}

async function handleRequest(request, response) {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ service: "company-llm-compat-proxy", status: "ok" }));
    return;
  }

  try {
    const requestBody = ["GET", "HEAD"].includes(request.method)
      ? undefined
      : await readRequestBody(request);
    const body = normalizeAssistantHistory(requestBody, request.url);
    const upstream = await fetch(new URL(request.url, UPSTREAM_BASE_URL), {
      method: request.method,
      headers: copyRequestHeaders(request),
      body,
      redirect: "manual",
    });

    response.statusCode = upstream.status;
    response.statusMessage = upstream.statusText;
    copyResponseHeaders(upstream, response);

    const contentType = upstream.headers.get("content-type") || "";
    if (upstream.body && contentType.includes("text/event-stream")) {
      await pipeSse(upstream.body, response);
    } else if (upstream.body) {
      response.end(Buffer.from(await upstream.arrayBuffer()));
    } else {
      response.end();
    }
  } catch (error) {
    if (response.headersSent) {
      response.destroy(error);
      return;
    }

    const statusCode = error.statusCode || 502;
    response.writeHead(statusCode, { "content-type": "application/json" });
    response.end(JSON.stringify({
      type: "error",
      error: {
        type: statusCode === 413 ? "invalid_request_error" : "api_error",
        message: error.message,
      },
    }));
  }
}

function selfTest() {
  const start = "event: message_start\ndata: {\"type\":\"message_start\"}\n\n";
  const stop = "event: message_stop\ndata: {\"type\":\"message_stop\"}\n\n";
  const state = { buffer: "", seenMessageStart: false };
  const output = filterSseBlocks(`${start}${start.slice(0, 20)}`, state)
    + filterSseBlocks(`${start.slice(20)}${stop}`, state, true);
  const count = (output.match(/event: message_start/g) || []).length;
  if (count !== 1 || !output.includes("event: message_stop")) {
    throw new Error("SSE duplicate filtering self-test failed");
  }

  const body = Buffer.from(JSON.stringify({
    messages: [
      { role: "user", content: "Question" },
      {
        role: "assistant",
        content: [
          { type: "text", text: "Answer" },
          { type: "tool_use", id: "toolu_test", name: "echo", input: {} },
        ],
      },
    ],
  }));
  const normalized = JSON.parse(normalizeAssistantHistory(body, "/v1/messages"));
  if (
    normalized.messages[1].role !== "user"
    || normalized.messages[1].content[0].type !== "text"
    || normalized.messages[2].role !== "assistant"
    || normalized.messages[2].content[0].type !== "tool_use"
  ) {
    throw new Error("Assistant history normalization self-test failed");
  }

  process.stdout.write("Compatibility proxy self-test passed\n");
}

if (process.argv.includes("--self-test")) {
  selfTest();
} else {
  const port = getPort(process.argv.slice(2));
  const server = http.createServer((request, response) => {
    handleRequest(request, response);
  });
  server.listen(port, HOST);
}
