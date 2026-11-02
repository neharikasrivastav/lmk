export function ownerCanUpdate(
  storedHash: string,
  suppliedHash: string,
  expiry: string,
  now: number,
) {
  return (
    storedHash.length === 64 && storedHash === suppliedHash && new Date(expiry).getTime() > now
  );
}
export function viewerCanRead(
  sharing: boolean,
  storedHash: string,
  suppliedHash: string,
  expiry: string,
  now: number,
) {
  return (
    sharing &&
    storedHash.length === 64 &&
    storedHash === suppliedHash &&
    new Date(expiry).getTime() > now
  );
}
