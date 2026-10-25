/**
 * Minimal Web Push sender (RFC 8291 payload encryption + RFC 8292 VAPID)
 * implemented on WebCrypto so it runs in the serverless Worker runtime.
 * No Node-only APIs are used.
 */

const textEncoder = new TextEncoder();

export function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function base64UrlEncode(bytes: Uint8Array | ArrayBuffer): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<CryptoKey> {
  const key = await crypto.subtle.importKey("raw", salt as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const prk = await crypto.subtle.sign("HMAC", key, ikm as BufferSource);
  return crypto.subtle.importKey("raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

async function hkdfExpand(prk: CryptoKey, info: Uint8Array, length: number): Promise<Uint8Array> {
  // length is always <= 32 here, so a single HMAC block suffices.
  const block = await crypto.subtle.sign("HMAC", prk, concat(info, new Uint8Array([1])) as BufferSource);
  return new Uint8Array(block).slice(0, length);
}

async function signVapidJwt(endpoint: string, subject: string, privateJwkJson: string): Promise<string> {
  const jwk = JSON.parse(privateJwkJson) as JsonWebKey;
  const key = await crypto.subtle.importKey("jwk", { ...jwk, ext: true }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const header = base64UrlEncode(textEncoder.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = base64UrlEncode(
    textEncoder.encode(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: subject,
      }),
    ),
  );
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, textEncoder.encode(`${header}.${claims}`));
  return `${header}.${claims}.${base64UrlEncode(signature)}`;
}

async function encryptPayload(p256dh: string, auth: string, payload: string): Promise<Uint8Array> {
  const subscriberPublicRaw = base64UrlDecode(p256dh);
  const authSecret = base64UrlDecode(auth);

  const subscriberKey = await crypto.subtle.importKey("raw", subscriberPublicRaw as BufferSource, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const localKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const localPublicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", localKeys.publicKey));

  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: subscriberKey }, localKeys.privateKey, 256));

  // RFC 8291 key derivation.
  const prk1 = await hkdfExtract(authSecret, sharedSecret);
  const keyInfo = concat(textEncoder.encode("WebPush: info\0"), subscriberPublicRaw, localPublicRaw);
  const ikm = await hkdfExpand(prk1, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk2 = await hkdfExtract(salt, ikm);
  const cekBytes = await hkdfExpand(prk2, textEncoder.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdfExpand(prk2, textEncoder.encode("Content-Encoding: nonce\0"), 12);

  // RFC 8188 final record: content, 0x02 delimiter, then optional zero padding.
  const plaintext = concat(textEncoder.encode(payload), new Uint8Array([0x02]));
  const cek = await crypto.subtle.importKey("raw", cekBytes as BufferSource, { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce as BufferSource }, cek, plaintext as BufferSource));

  // Header: salt(16) || record size uint32be || key id length uint8 || sender public key.
  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096, false);
  return concat(salt, recordSize, new Uint8Array([localPublicRaw.length]), localPublicRaw, ciphertext);
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushResult {
  ok: boolean;
  status: number;
  gone: boolean;
  detail: string;
}

export async function sendWebPush(
  target: PushTarget,
  payload: string,
  vapid: { publicKey: string; privateJwk: string; subject: string },
): Promise<PushResult> {
  const [jwt, body] = await Promise.all([
    signVapidJwt(target.endpoint, vapid.subject, vapid.privateJwk),
    encryptPayload(target.p256dh, target.auth, payload),
  ]);

  const response = await fetch(target.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
    },
    body: body as BodyInit,
  });

  const detail = (await response.text().catch(() => "")).slice(0, 300);
  return {
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    gone: response.status === 404 || response.status === 410,
    detail,
  };
}

