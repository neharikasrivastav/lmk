import { describe, expect, it } from "vitest";
import { optionalShare } from "./walk-start";
describe("optional walk sharing", () => {
  it("returns no link on failure without rejecting or blocking the walk", async () => expect(await optionalShare(async () => { throw new Error("Insert failed"); })).toBeNull());
  it("allows a later sharing retry to succeed", async () => {
    await optionalShare(async () => { throw new Error("Offline"); });
    expect(await optionalShare(async () => ({ token:"viewer",owner:"private" }))).toEqual({token:"viewer",owner:"private"});
  });
  it("does not wait indefinitely for sharing", async () => expect(await optionalShare(() => new Promise(()=>{}),10)).toBeNull());
});