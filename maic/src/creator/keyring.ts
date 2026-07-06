import {
  createPrivateKey,
  createPublicKey,
  sign as cryptoSign,
  verify as cryptoVerify,
  generateKeyPairSync,
  type KeyObject,
} from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJSON } from "../axioms/signing.js";
import type { CreatorSignature } from "../types.js";

/**
 * CreatorKeyring, Ed25519 keypair for the Creator (David C. Cavalcante).
 *
 * Only the holder of the private key may mutate MAIC axioms or terminate entities.
 * Verification is open: any party with the Creator's public key can verify a signature.
 *
 * Signed payload format: canonicalJSON({ payload, nonce }) → Ed25519 → base64url
 */
export class CreatorKeyring {
  private constructor(
    private readonly privateKey: KeyObject | null,
    private readonly pubKeyB64u: string,
  ) {}

  /** Generate a fresh Ed25519 keypair. */
  static generate(): CreatorKeyring {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    return new CreatorKeyring(privateKey, publicKeyToBase64Url(publicKey));
  }

  /** Load a Creator keyring from a PEM file containing the private key. */
  static async fromFile(path: string): Promise<CreatorKeyring> {
    const pem = await readFile(path, "utf-8");
    const privateKey = createPrivateKey({ key: pem, format: "pem" });
    const publicKey = createPublicKey(privateKey);
    return new CreatorKeyring(privateKey, publicKeyToBase64Url(publicKey));
  }

  /** Load a Creator keyring from a PEM private key string in an env var. */
  static fromEnv(varName: string): CreatorKeyring {
    const pem = process.env[varName];
    if (!pem) {
      throw new Error(`CreatorKeyring: env var ${varName} is empty`);
    }
    const privateKey = createPrivateKey({ key: pem, format: "pem" });
    const publicKey = createPublicKey(privateKey);
    return new CreatorKeyring(privateKey, publicKeyToBase64Url(publicKey));
  }

  /** Construct a verify-only keyring from a public key (base64url). */
  static fromPublicKey(pubKeyB64u: string): CreatorKeyring {
    return new CreatorKeyring(null, pubKeyB64u);
  }

  /** Persist the private key to a PEM file (0600 permissions on POSIX). */
  async saveTo(path: string): Promise<void> {
    if (!this.privateKey) {
      throw new Error("CreatorKeyring: no private key to save");
    }
    const pem = this.privateKey.export({ format: "pem", type: "pkcs8" }) as string;
    await writeFile(path, pem, { mode: 0o600 });
  }

  publicKey(): string {
    return this.pubKeyB64u;
  }

  /** Sign a payload with a monotonic nonce. Both are bound into the signature. */
  sign(payload: unknown, nonce: number): CreatorSignature {
    if (!this.privateKey) {
      throw new Error("CreatorKeyring: this keyring has no private key (verify-only)");
    }
    if (!Number.isInteger(nonce) || nonce < 0) {
      throw new Error("CreatorKeyring.sign: nonce must be a non-negative integer");
    }
    const message = canonicalJSON({ payload, nonce });
    const sig = cryptoSign(null, Buffer.from(message), this.privateKey);
    return {
      algorithm: "ed25519",
      publicKey: this.pubKeyB64u,
      value: bufToBase64Url(sig),
      nonce,
    };
  }

  /** Verify a signature against the keyring's own public key. */
  static verify(payload: unknown, sig: CreatorSignature): boolean {
    return CreatorKeyring.verifyWith(sig.publicKey, payload, sig);
  }

  /** Verify a signature against a specific public key (base64url). */
  static verifyWith(publicKeyB64u: string, payload: unknown, sig: CreatorSignature): boolean {
    if (sig.algorithm !== "ed25519") return false;
    if (sig.publicKey !== publicKeyB64u) return false;
    const message = canonicalJSON({ payload, nonce: sig.nonce });
    try {
      // Decode the signature value and the pinned public key inside the guard:
      // a malformed key or value must yield `false`, never a thrown DER-parse
      // error that would crash every mutation path.
      const value = base64UrlToBuf(sig.value);
      const pubKey = base64UrlToPublicKey(publicKeyB64u);
      return cryptoVerify(null, Buffer.from(message), pubKey, value);
    } catch {
      return false;
    }
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────

function publicKeyToBase64Url(pub: KeyObject): string {
  const raw = pub.export({ format: "der", type: "spki" });
  return bufToBase64Url(raw);
}

function base64UrlToPublicKey(b64u: string): KeyObject {
  const der = base64UrlToBuf(b64u);
  return createPublicKey({ key: der, format: "der", type: "spki" });
}

function bufToBase64Url(buf: Buffer | Uint8Array): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBuf(b64u: string): Buffer {
  const pad = b64u.length % 4 === 0 ? "" : "=".repeat(4 - (b64u.length % 4));
  const b64 = (b64u + pad).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64");
}
