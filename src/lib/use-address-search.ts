import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { searchPlaces } from "./geo.functions";
import { SEARCH_DEBOUNCE_MS, type AddressPlace } from "./address-search";

export function useAddressSearch(query: string, bias: [number, number]) {
  const search = useServerFn(searchPlaces);
  const [results, setResults] = useState<AddressPlace[]>([]);
  const [state, setState] = useState<"idle" | "searching" | "ready" | "empty" | "error">("idle");
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [lng, lat] = bias;
  useEffect(() => {
    let active = true;
    setResults([]);
    setMessage("");
    if (query.trim().length < 2) { setState("idle"); return; }
    setState("searching");
    const timer = setTimeout(async () => {
      try {
        const result = await search({ data: { q: query.trim(), bias: [lng, lat] } });
        if (!active) return;
        setResults(result.places);
        setState(result.status);
        setMessage(result.message);
      } catch {
        if (!active) return;
        setState("error");
        setMessage("Address search couldn’t connect. Please try again in a moment.");
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => { active = false; clearTimeout(timer); };
  }, [query, lng, lat, attempt, search]);
  return { results, state, message, retry: () => setAttempt((n) => n + 1) };
}