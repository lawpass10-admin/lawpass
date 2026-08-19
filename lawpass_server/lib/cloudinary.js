"use strict";

// Cloudinary uploads — the handwritten answer pages.
//
// ── Why the upload is here and not in the browser ──────────────────────────
// Cloudinary also accepts unsigned uploads straight from a page, which would
// save this file entirely. It also means anyone who reads the JavaScript can
// upload anything they like to our account, for as long as the preset exists.
// So the photo goes to this server first, the server signs the request with the
// API secret, and the secret never leaves the machine.
//
// ── Why there is no `cloudinary` npm package here ──────────────────────────
// The upload endpoint is one signed multipart POST. The SDK's value is in the
// parts we do not use (transformation builders, admin API, streaming). Signing
// is twenty lines of node:crypto, and not adding a dependency to the server for
// twenty lines is the cheaper trade. If we later want the admin API (listing,
// bulk delete, usage), pull the SDK in then and delete this.
//
// The signature rule, from Cloudinary's docs: take every parameter being sent
// EXCEPT file, cloud_name, resource_type and api_key; sort by key; join as
// k=v&k=v; append the API secret; SHA-1 the result.

const crypto = require("node:crypto");

const { env } = require("../config/env");

/** Photos out of a phone camera are big. This is the per-page ceiling. */
const HANDWRITING_MAX_BYTES = 10 * 1024 * 1024; // 10 MiB

/**
 * Formats a phone will actually produce. HEIC/HEIF is on the list because that
 * is what an iPhone hands over when the browser does not transcode, and
 * Cloudinary converts it on ingest — refusing it would mean telling a student
 * their own camera's format is unsupported.
 */
const HANDWRITING_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

/** True when all three credentials are present. */
function isConfigured() {
  const c = env.cloudinary;
  return Boolean(c.cloudName && c.apiKey && c.apiSecret);
}

function signParams(params, apiSecret) {
  const toSign = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== "")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return crypto.createHash("sha1").update(toSign + apiSecret).digest("hex");
}

/**
 * Upload one image buffer. Resolves to the stored asset's reference, which is
 * exactly what gets written to open_question_answers.hand_writing.
 *
 * Throws on a Cloudinary error or a network failure — the caller turns that
 * into a Hebrew message. The thrown message carries Cloudinary's own reason
 * because it is the only way to tell "bad credentials" from "file rejected"
 * from "account over quota", and all three land in the server log.
 *
 * @param {Buffer} buffer      the image bytes
 * @param {object} opts
 * @param {string} opts.folder    Cloudinary folder to file it under
 * @param {string} opts.publicId  asset id WITHIN that folder
 * @param {string} [opts.mimetype]
 */
async function uploadImage(buffer, { folder, publicId, mimetype }) {
  const { cloudName, apiKey, apiSecret } = env.cloudinary;
  if (!isConfigured()) {
    throw new Error("cloudinary is not configured (CLOUDINARY_* env vars)");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const params = {
    folder,
    public_id: publicId,
    timestamp,
    // Never trust the uploaded bytes to be an image just because the request
    // said so: Cloudinary decodes the file and rejects anything that is not one.
    // `overwrite=false` keeps a retry from silently replacing an earlier page.
    overwrite: "false",
  };
  const signature = signParams(params, apiSecret);

  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mimetype || "image/jpeg" }), publicId);
  form.append("api_key", apiKey);
  for (const [k, v] of Object.entries(params)) form.append(k, String(v));
  form.append("signature", signature);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`,
    { method: "POST", body: form }
  );

  let body;
  try {
    body = await res.json();
  } catch {
    throw new Error(`cloudinary returned a non-JSON response (status ${res.status})`);
  }

  if (!res.ok || body.error) {
    const reason = body?.error?.message || `status ${res.status}`;
    throw new Error(`cloudinary upload failed: ${reason}`);
  }

  return {
    url: body.secure_url,
    public_id: body.public_id,
    width: body.width ?? null,
    height: body.height ?? null,
    bytes: body.bytes ?? null,
    format: body.format ?? null,
  };
}

/**
 * Does this URL actually point at OUR Cloudinary account?
 *
 * The browser uploads first and submits the returned links with the answer, so
 * by the time the submit arrives the links are just strings in a request body —
 * a client could send any URL at all. This is what stops open_question_answers
 * from becoming a place to park arbitrary links.
 */
function isOwnAssetUrl(url) {
  const { cloudName } = env.cloudinary;
  if (!cloudName || typeof url !== "string") return false;
  return url.startsWith(`https://res.cloudinary.com/${cloudName}/`);
}

module.exports = {
  isConfigured,
  uploadImage,
  isOwnAssetUrl,
  HANDWRITING_MAX_BYTES,
  HANDWRITING_MIME_TYPES,
};
