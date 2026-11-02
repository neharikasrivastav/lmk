import { distance, type Coord, type Stop } from './walk';

export type CompanionStop = Stop & { distanceM: number; direction: string; openUntil: string };
export function closingTime(hour: number) {
  if (hour === 24 || hour === 0) return 'midnight';
  return `${hour % 12 || 12}${hour < 12 ? 'am' : 'pm'}`;
}
export function nearestCompanionStops(stops: Stop[], position: Coord): CompanionStop[] {
  const seen = new Set<string>();
  return stops.filter((s) => {
    const key = `${s.name.toLowerCase()}|${s.address.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).map((s) => {
    const lat = position[1] * Math.PI / 180, targetLat = s.lat * Math.PI / 180;
    const delta = (s.lng - position[0]) * Math.PI / 180;
    const bearing = (Math.atan2(Math.sin(delta) * Math.cos(targetLat), Math.cos(lat) * Math.sin(targetLat) - Math.sin(lat) * Math.cos(targetLat) * Math.cos(delta)) * 180 / Math.PI + 360) % 360;
    const cardinal = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'][Math.round(bearing / 45) % 8] ?? 'toward the stop';
    const street = s.address.replace(/^\d+[\w-]*\s+/, '').split(',')[0] ?? s.address;
    return { ...s, distanceM: Math.round(distance(position, [s.lng, s.lat])), direction: `${cardinal} toward ${street}`, openUntil: s.demo === false ? (s.opening_hours || 'unknown') : closingTime(s.closes_at) };
  }).sort((a, b) => a.distanceM - b.distanceM).slice(0, 3);
}
export function needsStop(message: string, history: { role: string; text: string }[] = []) {
  const distress = /unsafe|follow(?:ing|ed|s)?|scared|afraid|threat|danger|harass/i;
  return distress.test(message) || /where|go.*stop|should.*go|need.*(?:place|stop)|coffee/i.test(message) || (/\bthere\b/i.test(message) && history.some((m) => m.role === 'you' && distress.test(m.text)));
}
export function stopGuidance(stop: CompanionStop | undefined) {
  if (!stop) return 'No stop listings could load. Ask a staffed business for help; do not confront anyone. If you’re in immediate danger, call 911.';
  const far = stop.distanceM > 500 ? 'No listed stop is within 500m; this is the nearest citywide listing. ' : '';
  const badge = stop.verified ? ' ✅ Verified (demo)' : stop.closes_at > 22 ? ' 🌙 Late-night friendly (demo)' : '';
  return `${far}Head to ${stop.name}, approximately ${stop.distanceM}m ${stop.direction}, ${stop.demo === false ? `hours: ${stop.openUntil}` : `demo hours until ${stop.openUntil}`}${badge}. Go inside and ask the staff for help; don’t confront anyone. Alert a contact, and call 911 if you’re in immediate danger.`;
}