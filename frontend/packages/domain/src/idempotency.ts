/**
 * Keys that make a write safe to retry (see supabase/migrations/20261106035650_idempotency.sql).
 *
 * The app makes ONE key per intended action and sends the same key on every retry
 * of that action. The database then places the order once, whatever the network does.
 * A key is 8 to 128 characters of letters, digits and . _ : -
 */

/** A new random key. `c` is for tests; by default the browser's crypto is used. */
export function newIdempotencyKey(c: Crypto | null | undefined = globalThis.crypto): string {
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  // 16 random bytes as hex, with a counter so two calls in a row never collide
  counter = (counter + 1) % 0xffffff;
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("") + "-" + counter.toString(16);
}
let counter = 0;

/**
 * Holds the key for the order being placed. The same description of the order
 * gets the same key (so a retry is recognised); a different order, or a fresh
 * one after a success, gets a new key.
 */
export function useSameKeyWhile(): { keyFor(signature: string): string; reset(): void } {
  let current: { signature: string; key: string } | null = null;
  return {
    keyFor(signature) {
      if (!current || current.signature !== signature) current = { signature, key: newIdempotencyKey() };
      return current.key;
    },
    reset() {
      current = null;
    },
  };
}
