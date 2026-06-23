#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const dns = require("node:dns").promises;
const fs = require("node:fs");
const https = require("node:https");
const net = require("node:net");
const path = require("node:path");
const zlib = require("node:zlib");

const RIGHTS = new Set(["reference-only", "permissive", "licensed", "owned", "unknown"]);
const TYPES = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
  ["image/bmp", ".bmp"],
  ["image/svg+xml", ".svg"],
  ["image/avif", ".avif"],
]);

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error(`Expected --name value arguments; stopped at ${key || "end of command"}.`);
    }
    result[key.slice(2)] = value;
  }
  return result;
}

function isPublicIp(address) {
  const family = net.isIP(address);
  if (family === 4) {
    const bytes = address.split(".").map(Number);
    if (bytes[0] === 0 || bytes[0] === 10 || bytes[0] === 127 || bytes[0] >= 224) return false;
    if (bytes[0] === 169 && bytes[1] === 254) return false;
    if (bytes[0] === 172 && bytes[1] >= 16 && bytes[1] <= 31) return false;
    if (bytes[0] === 192 && bytes[1] === 168) return false;
    if (bytes[0] === 100 && bytes[1] >= 64 && bytes[1] <= 127) return false;
    if (bytes[0] === 198 && (bytes[1] === 18 || bytes[1] === 19)) return false;
    return true;
  }
  if (family === 6) {
    const normalized = address.toLowerCase();
    if (normalized === "::" || normalized === "::1") return false;
    if (normalized.startsWith("fc") || normalized.startsWith("fd") || /^fe[89ab]/.test(normalized)) return false;
    if (normalized.startsWith("ff")) return false;
    if (normalized.startsWith("::ffff:")) return isPublicIp(normalized.slice(7));
    return true;
  }
  return false;
}

async function resolvePublicHttps(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error(`Only credential-free HTTPS URLs are allowed: ${value}`);
  }
  if (url.hostname === "localhost" || url.hostname.endsWith(".local")) {
    throw new Error(`Local hosts are not allowed: ${value}`);
  }
  const addresses = await dns.lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicIp(address))) {
    throw new Error(`URL resolves to a non-public address: ${value}`);
  }
  const selected = addresses.find(({ family }) => family === 4) || addresses[0];
  return { url, selected };
}

function requestOnce(resolved, maxBytes, accept = "image/*", referer = "") {
  const { url, selected } = resolved;
  return new Promise((resolve, reject) => {
    const request = https.request({
      protocol: "https:",
      hostname: url.hostname,
      servername: url.hostname,
      port: url.port || 443,
      path: `${url.pathname}${url.search}`,
      method: "GET",
      headers: {
        "User-Agent": "TidlorVisualResearch/1.1",
        Accept: accept,
        "Accept-Encoding": "gzip, deflate, br",
        ...(referer ? { Referer: referer } : {}),
      },
      lookup(_hostname, options, callback) {
        if (options?.all) callback(null, [selected]);
        else callback(null, selected.address, selected.family);
      },
    }, (response) => {
      const chunks = [];
      let total = 0;
      response.on("data", (chunk) => {
        total += chunk.length;
        if (total > maxBytes) {
          request.destroy(new Error(`Image exceeds max bytes (${maxBytes}).`));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => resolve({ response, body: Buffer.concat(chunks) }));
    });
    request.setTimeout(45000, () => request.destroy(new Error("Image request timed out.")));
    request.on("error", reject);
    request.end();
  });
}

async function fetchResource(value, maxBytes, accept, referer = "") {
  let resolved = await resolvePublicHttps(value);
  for (let redirects = 0; redirects <= 5; redirects += 1) {
    const { response, body } = await requestOnce(resolved, maxBytes, accept, referer);
    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
      if (redirects === 5 || !response.headers.location) throw new Error("Too many or invalid redirects.");
      resolved = await resolvePublicHttps(new URL(response.headers.location, resolved.url).href);
      continue;
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`Image request failed with HTTP ${response.statusCode}.`);
    }
    return { finalUrl: resolved.url, response, body };
  }
  throw new Error("Download did not complete.");
}

async function downloadImage(value, maxBytes, referer = "") {
  const result = await fetchResource(value, maxBytes, "image/*", referer);
  const mediaType = String(result.response.headers["content-type"] || "").split(";", 1)[0].trim().toLowerCase();
  if (!TYPES.has(mediaType)) throw new Error(`Unsupported Content-Type: ${mediaType || "missing"}`);
  return { finalUrl: result.finalUrl, mediaType, body: result.body };
}

function safeSlug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "visual-reference";
}

function hasExpectedSignature(mediaType, body) {
  if (!body.length) return false;
  if (mediaType === "image/jpeg") return body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff;
  if (mediaType === "image/png") return body.length >= 8 && body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mediaType === "image/gif") return body.subarray(0, 6).toString("ascii") === "GIF87a" || body.subarray(0, 6).toString("ascii") === "GIF89a";
  if (mediaType === "image/bmp") return body.subarray(0, 2).toString("ascii") === "BM";
  if (mediaType === "image/webp") return body.length >= 12 && body.subarray(0, 4).toString("ascii") === "RIFF" && body.subarray(8, 12).toString("ascii") === "WEBP";
  if (mediaType === "image/avif") return body.length >= 12 && body.subarray(4, 8).toString("ascii") === "ftyp" && /avi[fs]/.test(body.subarray(8, 32).toString("ascii"));
  if (mediaType === "image/svg+xml") return /^(?:<\?xml[\s\S]*?\?>\s*)?<svg\b/i.test(body.subarray(0, 4096).toString("utf8").trimStart());
  return false;
}

function decodeResponseBody(response, body) {
  const encoding = String(response.headers["content-encoding"] || "").toLowerCase();
  if (encoding === "gzip") return zlib.gunzipSync(body);
  if (encoding === "deflate") return zlib.inflateSync(body);
  if (encoding === "br") return zlib.brotliDecompressSync(body);
  return body;
}

function parseTagAttributes(tag) {
  const attributes = {};
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    attributes[match[1].toLowerCase()] = (match[2] ?? match[3] ?? match[4] ?? "")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"');
  }
  return attributes;
}

function extractPageVisuals(html, pageUrl) {
  const candidates = new Map();
  const pageColors = new Map();

  function addCandidate(rawUrl, score, label, kind, width = null, height = null) {
    if (!rawUrl || rawUrl.startsWith("data:") || rawUrl.startsWith("blob:")) return;
    let url;
    try { url = new URL(rawUrl, pageUrl); } catch { return; }
    if (url.protocol !== "https:") return;
    const href = url.href;
    if (/\b(?:pixel|spacer|tracking|analytics|favicon)\b/i.test(href)) score -= 80;
    if (width && height && width <= 8 && height <= 8) score -= 100;
    const previous = candidates.get(href);
    const item = { url: href, score, label: label || kind, kind, width, height };
    if (!previous || previous.score < score) candidates.set(href, item);
  }

  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attrs = parseTagAttributes(tag);
    const key = String(attrs.property || attrs.name || "").toLowerCase();
    if (key === "og:image" || key === "og:image:secure_url") addCandidate(attrs.content, 120, "Open Graph image", key);
    if (key === "twitter:image" || key === "twitter:image:src") addCandidate(attrs.content, 115, "Twitter card image", key);
  }

  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    const attrs = parseTagAttributes(tag);
    if (/\bimage_src\b/i.test(attrs.rel || "")) addCandidate(attrs.href, 105, attrs.title || "Page image", "image_src");
  }

  for (const tag of html.match(/<(?:img|source)\b[^>]*>/gi) || []) {
    const attrs = parseTagAttributes(tag);
    const width = Number.parseInt(attrs.width, 10) || null;
    const height = Number.parseInt(attrs.height, 10) || null;
    const areaScore = width && height ? Math.min(45, Math.log2(Math.max(1, width * height))) : 0;
    const label = attrs.alt || attrs.title || "Page image";
    for (const key of ["src", "data-src", "data-original", "data-lazy-src"]) {
      if (attrs[key]) addCandidate(attrs[key], 55 + areaScore, label, key, width, height);
    }
    for (const key of ["srcset", "data-srcset"]) {
      if (!attrs[key]) continue;
      for (const part of attrs[key].split(",")) {
        const pieces = part.trim().split(/\s+/);
        const descriptor = pieces[1] || "";
        const descriptorScore = descriptor.endsWith("w") ? Math.min(40, Number.parseInt(descriptor, 10) / 80) : descriptor.endsWith("x") ? Number.parseFloat(descriptor) * 10 : 0;
        addCandidate(pieces[0], 65 + areaScore + descriptorScore, label, key, width, height);
      }
    }
  }

  for (const match of html.matchAll(/(?:background(?:-image)?\s*:\s*)?url\(\s*['"]?([^'"\)]+)['"]?\s*\)/gi)) {
    addCandidate(match[1], 35, "CSS background", "css-background");
  }
  for (const match of html.matchAll(/"image"\s*:\s*"(https:\/\/[^"\s]+)"/gi)) {
    addCandidate(match[1], 90, "Structured-data image", "json-ld");
  }
  for (const match of html.matchAll(/#[0-9a-f]{6}\b/gi)) {
    const color = match[0].toUpperCase();
    pageColors.set(color, (pageColors.get(color) || 0) + 1);
  }

  return {
    candidates: [...candidates.values()].filter((item) => item.score > 0).sort((a, b) => b.score - a.score),
    pageColors: [...pageColors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([color]) => color),
  };
}

async function discoverPageVisuals(sourcePage, maxBytes) {
  const fetched = await fetchResource(sourcePage, Math.min(maxBytes, 4194304), "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1");
  const mediaType = String(fetched.response.headers["content-type"] || "").split(";", 1)[0].trim().toLowerCase();
  if (!new Set(["text/html", "application/xhtml+xml"]).has(mediaType)) {
    throw new Error(`Source page returned ${mediaType || "no Content-Type"}, not HTML.`);
  }
  const html = decodeResponseBody(fetched.response, fetched.body).toString("utf8");
  return { finalPageUrl: fetched.finalUrl, ...extractPageVisuals(html, fetched.finalUrl) };
}

function analyzeSvg(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const svgTag = source.match(/<svg\b[^>]*>/i)?.[0] || "";
  const width = Number(svgTag.match(/\bwidth=["']([0-9.]+)/i)?.[1]) || null;
  const height = Number(svgTag.match(/\bheight=["']([0-9.]+)/i)?.[1]) || null;
  const counts = new Map();
  for (const match of source.matchAll(/#[0-9a-f]{3,8}\b/gi)) {
    let color = match[0].toUpperCase();
    if (color.length === 4) color = `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
    counts.set(color, (counts.get(color) || 0) + 1);
  }
  const dominantColors = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([color]) => color);
  return { width, height, dominantColors, analysisStatus: "complete-svg" };
}

function readManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) return [];
  const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8").replace(/^\uFEFF/, ""));
  return Array.isArray(parsed) ? parsed : [];
}

function saveVisual({ downloaded, title, sourcePage, usageRights, attribution, outputDirectory, projectRoot }) {
  if (!hasExpectedSignature(downloaded.mediaType, downloaded.body)) {
    throw new Error(`Response body does not match declared Content-Type ${downloaded.mediaType}.`);
  }
  const urlHash = crypto.createHash("sha256").update(downloaded.finalUrl.href).digest("hex").slice(0, 10);
  const fileName = `${safeSlug(title)}-${urlHash}${TYPES.get(downloaded.mediaType)}`;
  const filePath = path.join(outputDirectory, fileName);
  fs.writeFileSync(filePath, downloaded.body, { flag: "w" });

  const details = downloaded.mediaType === "image/svg+xml"
    ? analyzeSvg(filePath)
    : { width: null, height: null, dominantColors: [], analysisStatus: "pending-local-analysis" };
  const relativePath = path.relative(projectRoot, filePath).split(path.sep).join("/");
  const record = {
    schemaVersion: 1,
    title,
    localPath: relativePath,
    imageUrl: downloaded.finalUrl.href,
    sourcePage,
    usageRights,
    attribution,
    retrievedAt: new Date().toISOString(),
    mediaType: downloaded.mediaType,
    bytes: downloaded.body.length,
    sha256: crypto.createHash("sha256").update(downloaded.body).digest("hex"),
    width: details.width,
    height: details.height,
    dominantColors: details.dominantColors,
    analysisStatus: details.analysisStatus,
  };

  fs.writeFileSync(`${filePath}.json`, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  const manifestPath = path.join(outputDirectory, "visual-manifest.json");
  const manifest = readManifest(manifestPath).filter((item) => item.localPath !== relativePath);
  manifest.push(record);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return record;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  for (const required of ["source-page", "title"]) {
    if (!args[required]) throw new Error(`Missing required --${required} argument.`);
  }
  const usageRights = args["usage-rights"] || "reference-only";
  if (!RIGHTS.has(usageRights)) throw new Error(`Invalid --usage-rights value: ${usageRights}`);
  const maxBytes = Number(args["max-bytes"] || 12582912);
  if (!Number.isInteger(maxBytes) || maxBytes < 1024 || maxBytes > 26214400) throw new Error("--max-bytes must be between 1024 and 26214400.");

  const projectRoot = path.resolve(__dirname, "..", "..");
  const outputDirectory = path.resolve(projectRoot, args["output-directory"] || "assets");
  if (!outputDirectory.startsWith(`${projectRoot}${path.sep}`)) throw new Error("Output directory must remain inside the project workspace.");
  fs.mkdirSync(outputDirectory, { recursive: true });

  const source = await resolvePublicHttps(args["source-page"]);
  const common = {
    sourcePage: source.url.href,
    usageRights,
    attribution: args.attribution || "",
    outputDirectory,
    projectRoot,
  };

  if (args.url) {
    const downloaded = await downloadImage(args.url, maxBytes, source.url.href);
    const record = saveVisual({ downloaded, title: args.title, ...common });
    process.stdout.write(`${JSON.stringify(record, null, 2)}\n`);
    return;
  }

  const requestedCount = Number(args["discover-count"] || 4);
  if (!Number.isInteger(requestedCount) || requestedCount < 1 || requestedCount > 8) {
    throw new Error("--discover-count must be between 1 and 8.");
  }
  const discovery = await discoverPageVisuals(source.url.href, maxBytes);
  const records = [];
  const failures = [];
  for (const candidate of discovery.candidates.slice(0, 24)) {
    if (records.length >= requestedCount) break;
    try {
      const downloaded = await downloadImage(candidate.url, maxBytes, discovery.finalPageUrl.href);
      const record = saveVisual({
        downloaded,
        title: `${args.title} - ${candidate.label}`,
        sourcePage: discovery.finalPageUrl.href,
        usageRights,
        attribution: args.attribution || candidate.label,
        outputDirectory,
        projectRoot,
      });
      records.push({ ...record, discoveryKind: candidate.kind, discoveryScore: candidate.score });
    } catch (error) {
      failures.push({ url: candidate.url, reason: error.message });
    }
  }
  if (!records.length) throw new Error(`No downloadable images found on page. Candidates: ${discovery.candidates.length}; failures: ${failures.slice(0, 3).map((item) => item.reason).join(" | ")}`);
  process.stdout.write(`${JSON.stringify({
    mode: "page-discovery",
    sourcePage: discovery.finalPageUrl.href,
    pageColors: discovery.pageColors,
    candidatesFound: discovery.candidates.length,
    downloaded: records,
    failures,
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`collect-visual-reference: ${error.message}\n`);
  process.exitCode = 1;
});
