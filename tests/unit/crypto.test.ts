import { describe, it, expect, beforeAll } from "vitest";

// Set a fake key before importing the module so getKey() doesn't throw
beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = "a".repeat(64); // 32 bytes hex
});

const { encrypt, decrypt } = await import("@/lib/crypto");

describe("crypto", () => {
  it("round-trips plaintext correctly", () => {
    const original = "canvas_pat_abc123";
    const ciphertext = encrypt(original);
    expect(decrypt(ciphertext)).toBe(original);
  });

  it("produces different ciphertext each call (unique IV)", () => {
    const a = encrypt("same");
    const b = encrypt("same");
    expect(a).not.toBe(b);
    // Both still decrypt correctly
    expect(decrypt(a)).toBe("same");
    expect(decrypt(b)).toBe("same");
  });

  it("throws on malformed ciphertext", () => {
    expect(() => decrypt("notvalid")).toThrow();
  });

  it("throws on tampered auth tag", () => {
    const ct = encrypt("hello");
    const parts = ct.split(":");
    parts[1] = Buffer.alloc(16).toString("base64"); // zero out auth tag
    expect(() => decrypt(parts.join(":"))).toThrow();
  });
});
