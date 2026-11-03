import { describe, it, expect } from 'vitest';
import { applySafetyRules, claimsSafety, isDistress } from './companion-safety';
import { nearestCompanionStops } from './companion-stops';
import type { Stop } from './walk';

const stop = (id: string, lat: number): Stop => ({ id, name: id, lat, lng: -122.4, address: '1 Mint Plaza', note: '', verified: true, closes_at: 21, specialty: 'Coffee', demo: true });
const [mill] = nearestCompanionStops([stop('The Mill', 37.781)], [-122.4, 37.78]);
const idle = { active: false, sharing: false, canReroute: false };
const walking = { active: true, sharing: false, canReroute: true };

describe('companion safety rules', () => {
  it('detects distress, including follow-ups that point back to it', () => {
    expect(isDistress('Someone’s following me')).toBe(true);
    expect(isDistress('where?', [{ role: 'you', text: 'I feel unsafe' }])).toBe(true);
    expect(isDistress('I want a coffee')).toBe(false);
  });
  it('flags replies that call an area or person safe', () => {
    for (const t of ['This block is safe.', "You're safe here.", 'It looks perfectly safe', 'This is a safe neighborhood.']) expect(claimsSafety(t)).toBe(true);
    for (const t of ['Head to The Mill, 120m north.', 'Two reports of poor lighting nearby.', 'Stay on well-lit streets.']) expect(claimsSafety(t)).toBe(false);
  });
  it('always offers the nearest stop, an alert and 911 in distress, even if the model proposed nothing', () => {
    const r = applySafetyRules({ text: 'Head to The Mill, 110m north. Go inside and ask staff.', actions: [], message: 'Someone is following me', nearest: mill, walk: idle });
    expect(r.actions.map((a) => a.type)).toEqual(['go_to_stop', 'alert_contacts', 'call_911']);
    expect(r.replaced).toBe(false);
  });
  it('replaces a reply that claims safety or skips the recommended stop', () => {
    expect(applySafetyRules({ text: 'You are safe, keep walking.', actions: [], message: 'is this block okay?', nearest: mill, walk: idle }).replaced).toBe(true);
    const r = applySafetyRules({ text: 'Keep walking toward your destination.', actions: [], message: 'I’m scared', nearest: mill, walk: idle });
    expect(r.replaced).toBe(true);
    expect(r.text).toContain('The Mill');
  });
  it('drops actions that do not fit the walk, and orders and de-duplicates the rest', () => {
    const r = applySafetyRules({ text: 'Okay.', actions: [{ type: 'call_911' }, { type: 'share_walk' }, { type: 'reroute' }, { type: 'call_911' }], message: 'hi', nearest: mill, walk: { ...walking, sharing: true } });
    expect(r.actions.map((a) => a.type)).toEqual(['reroute', 'call_911']);
    expect(applySafetyRules({ text: 'Okay.', actions: [{ type: 'reroute' }], message: 'hi', nearest: mill, walk: idle }).actions).toEqual([]);
  });
});
