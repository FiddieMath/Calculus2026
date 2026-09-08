/*!
 * crypto-core.js —— 学生记录加密/解密核心
 * 同时支持：浏览器（window.CalcCrypto）与 Node（module.exports）
 * 算法：PBKDF2(HMAC-SHA-256, 210000 轮) 派生 AES-256-GCM 密钥
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.CalcCrypto = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const enc = new TextEncoder();
  const dec = new TextDecoder("utf-8");
  const PBKDF2_ITERATIONS = 210000;
  const SALT_BYTES = 16;
  const IV_BYTES = 12;
  const CODE_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

  function bytesToB64(bytes) {
    let bin = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  }

  function b64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function deriveKey(code, saltBytes) {
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode(String(code)),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: saltBytes,
        iterations: PBKDF2_ITERATIONS,
        hash: "SHA-256"
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  async function encryptPayload(obj, code, saltB64) {
    const saltBytes = saltB64
      ? b64ToBytes(saltB64)
      : crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const key = await deriveKey(code, saltBytes);
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const ct = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      enc.encode(JSON.stringify(obj))
    );
    return {
      salt: bytesToB64(saltBytes),
      iv: bytesToB64(iv),
      data: bytesToB64(new Uint8Array(ct))
    };
  }

  async function decryptPayload(rec, code) {
    const key = await deriveKey(code, b64ToBytes(rec.salt));
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64ToBytes(rec.iv) },
      key,
      b64ToBytes(rec.data)
    );
    return JSON.parse(dec.decode(pt));
  }

  function randomCode(length) {
    const n = length || 10;
    const out = [];
    const arr = new Uint8Array(n);
    crypto.getRandomValues(arr);
    for (let i = 0; i < n; i++) {
      out.push(CODE_ALPHABET[arr[i] % CODE_ALPHABET.length]);
    }
    return out.join("");
  }

  return {
    PBKDF2_ITERATIONS: PBKDF2_ITERATIONS,
    bytesToB64: bytesToB64,
    b64ToBytes: b64ToBytes,
    deriveKey: deriveKey,
    encryptPayload: encryptPayload,
    decryptPayload: decryptPayload,
    randomCode: randomCode
  };
});

