import { describe, it, expect } from 'vitest';
import { nearestCompanionStops, needsStop, stopGuidance, closingTime } from './companion-stops';
import type { Stop } from './walk';
const stop = (id: string, lat: number, verified = false): Stop => ({ id, name: id, lat, lng: -122.438, address: '736 Divisadero St', note: '', verified, closes_at: 21, specialty: 'Coffee', demo: true });
describe('position-based companion stops', () => {
  it('always selects the nearest 3 by position, not verification or route', () => {
    const result = nearestCompanionStops([stop('far verified', 37.79, true), stop('The Mill', 37.776), stop('second', 37.777), stop('third', 37.778)], [-122.438, 37.775]);
    expect(result.map((s) => s.name)).toEqual(['The Mill', 'second', 'third']);
    expect(result[0]?.distanceM).toBeGreaterThan(100);
    expect(result[0]?.distanceM).toBeLessThan(120);
    expect(result[0]?.direction).toBe('north toward Divisadero St');
  });
  it('uses citywide stops and discloses beyond 500m', () => {
    const result = nearestCompanionStops([stop('The Mill', 37.79), stop('B', 37.80), stop('C', 37.81)], [-122.438, 37.775]);
    expect(result).toHaveLength(3);
    expect(result[0]?.distanceM).toBeGreaterThan(500);
    expect(stopGuidance(result[0])).toContain('nearest citywide listing');
  });
  it('distress and where requests target a stop rather than destination', () => {
    for (const message of ['Someone’s following me', 'I feel unsafe', 'where should I go', 'where should I stop', 'where?']) expect(needsStop(message)).toBe(true);
    expect(needsStop('What is the weather?')).toBe(false);
  });
  it('formats stop closing hours including morning and midnight', () => {
    expect(closingTime(21)).toBe('9pm'); expect(closingTime(24)).toBe('midnight'); expect(closingTime(8)).toBe('8am');
  });
});