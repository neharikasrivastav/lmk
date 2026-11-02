import { expect, it } from "vitest";
import { ownerCanUpdate, viewerCanRead } from "./trip-rules";
const owner = "a".repeat(64),
  viewer = "b".repeat(64),
  expiry = "2026-10-24T23:00:00Z",
  now = Date.parse("2026-10-24T22:00:00Z");
it("viewer capability cannot write owner updates", () => {
  expect(ownerCanUpdate(owner, viewer, expiry, now)).toBe(false);
  expect(ownerCanUpdate(owner, owner, expiry, now)).toBe(true);
});
it("turning sharing off blocks a valid viewer", () =>
  expect(viewerCanRead(false, viewer, viewer, expiry, now)).toBe(false));
it("expired links cannot read or write", () => {
  expect(viewerCanRead(true, viewer, viewer, expiry, now + 7200000)).toBe(false);
  expect(ownerCanUpdate(owner, owner, expiry, now + 7200000)).toBe(false);
});
it("a different token cannot read the trip", () => {
  expect(viewerCanRead(true, viewer, owner, expiry, now)).toBe(false);
  expect(viewerCanRead(true, viewer, viewer, expiry, now)).toBe(true);
});
