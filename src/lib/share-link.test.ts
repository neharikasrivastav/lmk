import { describe, expect, it } from "vitest";
import { isPreviewHost, shareLink } from "./share-link";

describe("shareLink", () => {
  it("uses the current site origin when it is the published domain", () => {
    expect(shareLink("abc123", "https://safter-city-steps.lovable.app")).toBe(
      "https://safter-city-steps.lovable.app/t/abc123",
    );
  });

  it("uses the current site origin on a custom domain", () => {
    expect(shareLink("abc123", "https://walk.example.com")).toBe(
      "https://walk.example.com/t/abc123",
    );
  });

  it("falls back to the published domain when no origin is available", () => {
    expect(shareLink("abc123")).toBe("https://safter-city-steps.lovable.app/t/abc123");
  });
});

describe("isPreviewHost", () => {
  it("flags Lovable preview, editor, and local hosts", () => {
    expect(isPreviewHost("id-preview--abc123.lovable.app")).toBe(true);
    expect(isPreviewHost("id-preview-6--abc123.lovable.app")).toBe(true);
    expect(isPreviewHost("preview--my-app.lovable.app")).toBe(true);
    expect(isPreviewHost("project--abc123-dev.lovable.app")).toBe(true);
    expect(isPreviewHost("my-app.lovableproject.com")).toBe(true);
    expect(isPreviewHost("my-app.lovableproject-dev.com")).toBe(true);
    expect(isPreviewHost("localhost")).toBe(true);
    expect(isPreviewHost("127.0.0.1")).toBe(true);
  });

  it("treats published and custom domains as public", () => {
    expect(isPreviewHost("safter-city-steps.lovable.app")).toBe(false);
    expect(isPreviewHost("walk.example.com")).toBe(false);
  });
});
