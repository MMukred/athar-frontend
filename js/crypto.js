/**
 * Athar Cryptography Layer
 * AES-256-GCM encryption for sensitive volunteer fields.
 * Key derived from user password via PBKDF2 (100k iterations, SHA-256).
 *
 * Encrypted value format: "enc:v1:<b64-iv>:<b64-ciphertext>"
 * Global salt stored in localStorage (not secret) at "athar_crypto_salt_v1".
 * Derived key cached in sessionStorage at "athar_crypto_key_v1" (base64 raw).
 *
 * Protects against: casual localStorage inspection, disk forensics.
 * Does NOT protect against: XSS, malicious extensions, in-memory inspection.
 */
window.AtharCrypto = (function () {
  "use strict";

  const SALT_KEY = "athar_crypto_salt_v1";
  const SESSION_KEY = "athar_crypto_key_v1";
  const ENC_PREFIX = "enc:v1:";
  const PBKDF2_ITERATIONS = 100000;
  const SENSITIVE_FIELDS = ["national_id", "phone", "whatsapp", "email"];

  let _key = null;
  let _rawKeyB64 = null;

  // ============================================================
  // Base64 helpers
  // ============================================================
  function bytesToB64(bytes) {
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function b64ToBytes(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  // ============================================================
  // Salt management
  // ============================================================
  function getOrCreateSalt() {
    let saltB64 = localStorage.getItem(SALT_KEY);
    if (!saltB64) {
      const salt = new Uint8Array(16);
      crypto.getRandomValues(salt);
      saltB64 = bytesToB64(salt);
      localStorage.setItem(SALT_KEY, saltB64);
    }
    return b64ToBytes(saltB64);
  }

  // ============================================================
  // Key derivation (PBKDF2 → AES-GCM 256)
  // ============================================================
  async function deriveKey(password, salt) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: PBKDF2_ITERATIONS,
        hash: "SHA-256"
      },
      baseKey,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
  }

  // ============================================================
  // Key lifecycle
  // ============================================================
  async function deriveAndSetKey(password) {
    const salt = getOrCreateSalt();
    const key = await deriveKey(password, salt);
    _key = key;
    try {
      const raw = await crypto.subtle.exportKey("raw", key);
      _rawKeyB64 = bytesToB64(new Uint8Array(raw));
      sessionStorage.setItem(SESSION_KEY, _rawKeyB64);
    } catch (e) {
      console.warn("Could not cache crypto key", e);
    }
    return key;
  }

  async function loadKeyFromSession() {
    if (_key) return _key;
    const cached = sessionStorage.getItem(SESSION_KEY);
    if (!cached) return null;
    try {
      const raw = b64ToBytes(cached);
      _key = await crypto.subtle.importKey(
        "raw",
        raw,
        { name: "AES-GCM" },
        true,
        ["encrypt", "decrypt"]
      );
      _rawKeyB64 = cached;
      return _key;
    } catch (e) {
      console.warn("Failed to restore crypto key", e);
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
  }

  function clearKey() {
    _key = null;
    _rawKeyB64 = null;
    sessionStorage.removeItem(SESSION_KEY);
  }

  function hasKey() {
    return !!_key;
  }

  // ============================================================
  // Encrypt / Decrypt primitives
  // ============================================================
  async function encryptValue(plaintext, keyOverride) {
    const k = keyOverride || _key;
    if (!k) throw new Error("Encryption key not available");
    if (plaintext === null || plaintext === undefined || plaintext === "") return plaintext;
    const enc = new TextEncoder();
    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);
    const ct = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      k,
      enc.encode(String(plaintext))
    );
    return ENC_PREFIX + bytesToB64(iv) + ":" + bytesToB64(new Uint8Array(ct));
  }

  async function decryptValue(blob, keyOverride) {
    const k = keyOverride || _key;
    if (!k) throw new Error("Decryption key not available");
    if (typeof blob !== "string" || !blob.startsWith(ENC_PREFIX)) return blob;
    const parts = blob.substring(ENC_PREFIX.length).split(":");
    if (parts.length !== 2) throw new Error("Malformed encrypted value");
    const iv = b64ToBytes(parts[0]);
    const ct = b64ToBytes(parts[1]);
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      k,
      ct
    );
    return new TextDecoder().decode(pt);
  }

  function isEncrypted(value) {
    return typeof value === "string" && value.startsWith(ENC_PREFIX);
  }

  // ============================================================
  // State-level helpers (operate on volunteers)
  // ============================================================
  async function encryptState(state) {
    if (!_key) return state;
    const activeKey = _key;
    const clone = JSON.parse(JSON.stringify(state));
    if (Array.isArray(clone.volunteers)) {
      for (const v of clone.volunteers) {
        for (const field of SENSITIVE_FIELDS) {
          if (v[field] && !isEncrypted(v[field])) {
            try {
              v[field] = await encryptValue(v[field], activeKey);
            } catch (e) {
              console.warn("Encrypt failed for", field, e);
            }
          }
        }
      }
    }
    return clone;
  }

  async function decryptStateInPlace(state) {
    if (!_key) return false;
    const activeKey = _key;
    if (!Array.isArray(state.volunteers)) return false;
    let anyDecrypted = false;
    for (const v of state.volunteers) {
      for (const field of SENSITIVE_FIELDS) {
        if (v[field] && isEncrypted(v[field])) {
          try {
            v[field] = await decryptValue(v[field], activeKey);
            anyDecrypted = true;
          } catch (e) {
            console.warn("Decrypt failed for", field, "— possibly wrong key", e);
          }
        }
      }
    }
    return anyDecrypted;
  }

  // ============================================================
  // Public API
  // ============================================================
  return {
    deriveAndSetKey,
    loadKeyFromSession,
    clearKey,
    hasKey,
    encryptValue,
    decryptValue,
    encryptState,
    decryptStateInPlace,
    isEncrypted,
    SENSITIVE_FIELDS
  };
})();
