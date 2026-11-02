import { act, renderHook, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAddressSearch } from "./use-address-search";
import { SEARCH_DEBOUNCE_MS, type AddressSearchResult } from "./address-search";
const { search } = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => search }));
vi.mock("./geo.functions", () => ({ searchPlaces: search }));
afterEach(() => { cleanup(); vi.useRealTimers(); search.mockReset(); });
describe("address autocomplete requests", () => {
  it("debounces keystrokes for 500 milliseconds", async () => {
    vi.useFakeTimers();
    search.mockResolvedValue({ places: [], status: "empty", message: "" });
    const hook = renderHook(({ query }) => useAddressSearch(query, [-122.4, 37.78]), { initialProps: { query: "123" } });
    await act(async () => vi.advanceTimersByTime(499));
    expect(search).not.toHaveBeenCalled();
    hook.rerender({ query: "1231 Market Street" });
    await act(async () => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith({ data: { q: "1231 Market Street", bias: [-122.4, 37.78] } });
  });
  it("ignores a late response after the input changes or clears", async () => {
    vi.useFakeTimers();
    let resolveOld: ((value: AddressSearchResult) => void) | undefined;
    search.mockImplementation(() => new Promise<AddressSearchResult>((resolve) => { resolveOld = resolve; }));
    const hook = renderHook(({ query }) => useAddressSearch(query, [-122.4, 37.78]), { initialProps: { query: "Market Street" } });
    await act(async () => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));
    hook.rerender({ query: "" });
    await act(async () => resolveOld?.({ places: [{ id: "old", name: "Market Street", address: "San Francisco", lat: 37.78, lng: -122.4, match: "street" }], status: "ready", message: "" }));
    expect(hook.result.current.results).toEqual([]);
    expect(hook.result.current.state).toBe("idle");
  });
});