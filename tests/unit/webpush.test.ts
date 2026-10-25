import { afterEach, expect, it, vi } from 'vitest';
import { sendWebPush } from '../../services/push/webpush';

afterEach(() => vi.unstubAllGlobals());

it('encrypts a payload that an independent RFC 8291 receiver can decrypt', async () => {
  const receiver = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const receiverPublic = new Uint8Array(await crypto.subtle.exportKey('raw', receiver.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const vapid = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const publicKey = Buffer.from(await crypto.subtle.exportKey('raw', vapid.publicKey)).toString('base64url');
  const privateJwk = JSON.stringify(await crypto.subtle.exportKey('jwk', vapid.privateKey));
  const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 201 }));
  vi.stubGlobal('fetch', fetchMock);
  const payload = JSON.stringify({ title: 'WeatherBoard', body: 'Your forecast is ready ☀' });
  const result = await sendWebPush({ endpoint: 'https://fcm.googleapis.com/fcm/send/test-only', p256dh: Buffer.from(receiverPublic).toString('base64url'), auth: Buffer.from(auth).toString('base64url') }, payload, { publicKey, privateJwk, subject: 'mailto:test@example.com' });
  expect(result.ok).toBe(true);
  const options = fetchMock.mock.calls[0][1];
  const body = new Uint8Array(options.body);
  const salt = body.slice(0, 16);
  expect(new DataView(body.buffer).getUint32(16, false)).toBe(4096);
  const senderPublic = body.slice(21, 21 + body[20]);
  const senderKey = await crypto.subtle.importKey('raw', senderPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: senderKey }, receiver.privateKey, 256);
  const enc = new TextEncoder();
  async function hkdf(input: ArrayBuffer | Uint8Array, saltBytes: Uint8Array, info: Uint8Array, bytes: number) {
    const key = await crypto.subtle.importKey('raw', input as BufferSource, 'HKDF', false, ['deriveBits']);
    return crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: saltBytes as BufferSource, info: info as BufferSource }, key, bytes * 8);
  }
  const ikm = await hkdf(shared, auth, Buffer.concat([enc.encode('WebPush: info\0'), receiverPublic, senderPublic]), 32);
  const cek = await hkdf(ikm, salt, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(ikm, salt, enc.encode('Content-Encoding: nonce\0'), 12);
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plaintext = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, aes, body.slice(21 + body[20])));
  expect(plaintext.at(-1)).toBe(2);
  expect(new TextDecoder().decode(plaintext.slice(0, -1))).toBe(payload);
  const token = options.headers.Authorization.match(/t=([^,]+)/)[1];
  const [header, claims, signature] = token.split('.');
  expect(JSON.parse(Buffer.from(claims, 'base64url').toString()).aud).toBe('https://fcm.googleapis.com');
  expect(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, vapid.publicKey, Buffer.from(signature, 'base64url'), enc.encode(`${header}.${claims}`))).toBe(true);
});
