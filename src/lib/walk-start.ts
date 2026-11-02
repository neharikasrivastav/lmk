export async function optionalShare<T>(create: () => Promise<T>, timeoutMs = 8000): Promise<T | null> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([create(), new Promise<null>((resolve) => { timeout = setTimeout(() => resolve(null), timeoutMs); })]);
  } catch { return null; }
  finally { if (timeout) clearTimeout(timeout); }
}