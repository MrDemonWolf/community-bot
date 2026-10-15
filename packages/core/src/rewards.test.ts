import { expect, test } from "bun:test";
import { redemptionStatus, rewardMessage } from "./rewards";

test("reward inputs are bounded single-line data, never nested templates", () => {
  expect(rewardMessage("@{user}: {input} / {reward}", { login: "viewer", input: "{user}\nhello", title: "Hydrate" })).toBe("@viewer: {user} hello / Hydrate");
  expect(rewardMessage("{input}", { login: "a", input: "a".repeat(900), title: "b" })).toHaveLength(500);
  expect(redemptionStatus("UNFULFILLED")).toBe("pending");
  expect(redemptionStatus("FULFILLED")).toBe("fulfilled");
  expect(redemptionStatus("CANCELED")).toBe("canceled");
});
