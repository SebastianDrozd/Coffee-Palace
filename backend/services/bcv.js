// ------------------------------------------------------------------
// BCV official US dollar rate (https://www.bcv.org.ve/)
//
// Plain Node.js, no Next.js imports and no dependencies, so this file can be
// shared with the frontend repo (lib/bcv.js). Runs on the server only: the
// tablet and dashboard can't call bcv.org.ve from the browser (CORS).
//
//   const { rate, valueDate } = await fetchBcvUsdRate();
//   // rate: 891.1054 (Bs. per US$), valueDate: "2026-11-03"
//
// The BCV page has no API, so we read the published HTML:
//   <div id="dolar"> ... <strong class="strong-tb">891,10540000</strong>
//   Fecha Valor: <span ... content="2026-11-03T00:00:00-04:00">
// ------------------------------------------------------------------

import http from "node:http";
import https from "node:https";
import tls from "node:tls";
import { X509Certificate } from "node:crypto";

export const BCV_URL = process.env.BCV_URL || "https://www.bcv.org.ve/";

const USER_AGENT = "Mozilla/5.0 (compatible; CoffeePalace/1.0; +tasa BCV)";
const TIMEOUT_MS = 20_000;
const MAX_BYTES = 3 * 1024 * 1024;

// Errors that mean "the server didn't send its full certificate chain".
// bcv.org.ve has had this problem for years; browsers hide it by downloading
// the missing certificate themselves, and so do we (see fetchMissingIssuers).
const INCOMPLETE_CHAIN = new Set([
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "UNABLE_TO_GET_ISSUER_CERT",
]);

export class BcvError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "BcvError";
    this.cause = cause;
  }
}

/* ---------------- parsing ---------------- */

// "891,10540000" -> 891.1054   "1.234,5678" -> 1234.5678
function parseBcvNumber(text) {
  return Number(String(text).trim().replace(/\./g, "").replace(",", "."));
}

export function parseBcvHtml(html) {
  const usd = html.match(/id=["']dolar["'][\s\S]{0,1500}?<strong[^>]*>\s*([\d.,]+)\s*<\/strong>/i);
  if (!usd) throw new BcvError("La página del BCV cambió: no se encontró la tasa del dólar.");

  const rate = parseBcvNumber(usd[1]);
  if (!Number.isFinite(rate) || rate <= 0 || rate > 1e9) {
    throw new BcvError(`La tasa del dólar en la página del BCV no es válida ("${usd[1]}").`);
  }

  const date = html.match(/Fecha\s*Valor:?\s*<span[^>]*content=["'](\d{4}-\d{2}-\d{2})/i);
  if (!date) throw new BcvError("La página del BCV cambió: no se encontró la fecha valor.");

  return { rate, valueDate: date[1] };
}

/* ---------------- fetching ---------------- */

// Intermediate certificates learned from the server's AIA extension, per host.
const learnedIssuers = new Map();

/**
 * Downloads the BCV home page and returns the official US dollar rate.
 * @param {{ url?: string, roots?: string[] }} [options]
 *   roots: trusted root certificates (PEM). Defaults to Node's built-in list.
 * @returns {Promise<{ rate: number, valueDate: string, source: "bcv", fetchedAt: string }>}
 */
export async function fetchBcvUsdRate({ url = BCV_URL, roots } = {}) {
  const html = await getText(url, { roots });
  return { ...parseBcvHtml(html), source: "bcv", fetchedAt: new Date().toISOString() };
}

async function getText(url, { roots, redirectsLeft = 3 } = {}) {
  const { hostname } = new URL(url);
  try {
    return await request(url, { ca: caFor(hostname, roots), roots, redirectsLeft });
  } catch (err) {
    if (!INCOMPLETE_CHAIN.has(err.code) || learnedIssuers.has(hostname)) throw describe(err);
    // The server skipped its intermediate certificate. Fetch it from the URL the
    // certificate itself names, then retry. The connection is still fully
    // verified: the chain must end at one of the trusted roots.
    let issuers;
    try {
      issuers = await fetchMissingIssuers(url, roots);
    } catch {
      throw describe(err); // nothing to download: report the original certificate problem
    }
    learnedIssuers.set(hostname, issuers);
    try {
      return await request(url, { ca: caFor(hostname, roots), roots, redirectsLeft });
    } catch (retryErr) {
      learnedIssuers.delete(hostname);
      throw describe(retryErr);
    }
  }
}

function caFor(hostname, roots) {
  const extra = learnedIssuers.get(hostname);
  if (!roots && !extra) return undefined; // Node defaults (also honors NODE_EXTRA_CA_CERTS)
  return [...(roots ?? tls.rootCertificates), ...(extra ?? [])];
}

function request(url, { ca, roots, redirectsLeft }) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("http:") ? http : https;
    const req = lib.get(
      url,
      {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
        timeout: TIMEOUT_MS,
        ...(lib === https && ca ? { ca } : {}),
      },
      (res) => {
        const { statusCode, headers } = res;
        if (statusCode >= 300 && statusCode < 400 && headers.location) {
          res.resume();
          if (redirectsLeft <= 0) return reject(new BcvError("La página del BCV redirige demasiadas veces."));
          const next = new URL(headers.location, url).toString();
          return resolve(getText(next, { roots, redirectsLeft: redirectsLeft - 1 }));
        }
        if (statusCode !== 200) {
          res.resume();
          return reject(new BcvError(`La página del BCV respondió con error ${statusCode}.`));
        }
        let size = 0;
        const chunks = [];
        res.on("data", (chunk) => {
          size += chunk.length;
          if (size > MAX_BYTES) req.destroy(new BcvError("La página del BCV es demasiado grande."));
          else chunks.push(chunk);
        });
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        res.on("error", reject);
      }
    );
    req.on("timeout", () => req.destroy(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" })));
    req.on("error", reject);
  });
}

// Reads the certificate the server presents (without trusting it) and follows its
// "CA Issuers" links to download the missing intermediate certificate(s).
async function fetchMissingIssuers(url, roots) {
  const { hostname, port } = new URL(url);
  const presented = await new Promise((resolve, reject) => {
    const socket = tls.connect(
      { host: hostname, port: Number(port) || 443, servername: hostname, rejectUnauthorized: false },
      () => {
        const cert = socket.getPeerCertificate(true);
        socket.end();
        resolve(cert);
      }
    );
    socket.setTimeout(TIMEOUT_MS, () => socket.destroy(new Error("timeout")));
    socket.on("error", reject);
  });

  // Walk to the last certificate the server actually sent
  let last = presented;
  const seen = new Set();
  while (last?.issuerCertificate && last.issuerCertificate !== last && !seen.has(last.fingerprint256)) {
    seen.add(last.fingerprint256);
    last = last.issuerCertificate;
  }

  const trusted = new Set((roots ?? tls.rootCertificates).map((pem) => new X509Certificate(pem).subject));
  const issuers = [];
  let issuerUrl = aiaIssuerUrl(last);
  for (let hop = 0; issuerUrl && hop < 3; hop++) {
    const der = await download(issuerUrl);
    const cert = new X509Certificate(der);
    issuers.push(cert.toString());
    if (trusted.has(cert.issuer) || cert.issuer === cert.subject) break;
    issuerUrl = aiaIssuerUrlFromX509(cert);
  }
  if (issuers.length === 0) {
    throw new BcvError("El certificado del BCV está incompleto y no indica dónde descargar el que falta.");
  }
  return issuers;
}

function aiaIssuerUrl(peerCert) {
  const uris = peerCert?.infoAccess?.["CA Issuers - URI"];
  return uris?.find((u) => /^https?:/i.test(u)) ?? null;
}

function aiaIssuerUrlFromX509(cert) {
  const m = cert.infoAccess?.match(/CA Issuers - URI:(\S+)/);
  return m ? m[1] : null;
}

function download(url, redirectsLeft = 3) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https:") ? https : http;
    lib
      .get(url, { timeout: TIMEOUT_MS, headers: { "User-Agent": USER_AGENT } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectsLeft > 0) {
          res.resume();
          return resolve(download(new URL(res.headers.location, url).toString(), redirectsLeft - 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new BcvError(`No se pudo descargar el certificado del BCV (error ${res.statusCode}).`));
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      })
      .on("timeout", function () {
        this.destroy(new Error("timeout"));
      })
      .on("error", reject);
  });
}

function describe(err) {
  if (err instanceof BcvError) return err;
  const code = err.code || "";
  if (code === "ETIMEDOUT" || err.message === "timeout") {
    return new BcvError("La página del BCV tardó demasiado en responder.", err);
  }
  if (["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ECONNRESET", "ENETUNREACH"].includes(code)) {
    return new BcvError("No se pudo conectar con la página del BCV.", err);
  }
  if (/CERT|SELF_SIGNED|UNABLE_TO/.test(code)) {
    return new BcvError(`El certificado de seguridad del BCV no es válido (${code}).`, err);
  }
  return new BcvError(`No se pudo leer la página del BCV (${code || err.message}).`, err);
}
