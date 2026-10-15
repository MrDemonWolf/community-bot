import { timingSafeEqual } from "node:crypto";

export function validOAuthState(
  received: string | null,
  expected: string,
): boolean {
  if (!received) return false;
  const receivedBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  return (
    receivedBytes.length === expectedBytes.length &&
    timingSafeEqual(receivedBytes, expectedBytes)
  );
}
