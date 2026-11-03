import { describe, it, expect } from 'vitest';
import { MockLanguageModelV4 } from 'ai/test';
import type { LanguageModelV4Content } from '@ai-sdk/provider';
import { runCompanionAgent, type AgentContext } from './companion-agent';
import { nearestCompanionStops } from '../companion-stops';
import type { Stop } from '../walk';

const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 10, text: 10, reasoning: undefined } };
const call = (toolName: string, input: object, id: string) => ({ type: 'tool-call' as const, toolCallId: id, toolName, input: JSON.stringify(input) });
const step = (content: LanguageModelV4Content[], unified: 'tool-calls' | 'stop') => ({ content, finishReason: { unified, raw: undefined }, usage, warnings: [] });

const stop = (id: string, lat: number): Stop => ({ id, name: id, lat, lng: -122.4, address: '1 Mint Plaza', note: '', verified: true, closes_at: 21, specialty: 'Coffee', demo: true });
const context: AgentContext = {
  position: [-122.4, 37.78],
  destination: 'Salesforce Park',
  walk: { active: true, sharing: true, canReroute: true },
  stops: nearestCompanionStops([stop('The Mill', 37.781), stop('Blue Door', 37.783)], [-122.4, 37.78]),
  reports: [],
};

describe('companion agent', () => {
  it('looks up stops, proposes actions through tools, and keeps the stop in its reply', async () => {
    const model = new MockLanguageModelV4({
      doGenerate: [
        step([call('find_safe_stops', { need: 'help' }, 'a'), call('propose_action', { action: 'go_to_stop', stopId: 'The Mill' }, 'b'), call('propose_action', { action: 'share_walk' }, 'c')], 'tool-calls'),
        step([{ type: 'text', text: 'Head to The Mill, 110m north, and ask staff for help.' }], 'stop'),
      ],
    });
    const r = await runCompanionAgent({ model, context, message: 'Someone is following me' });
    expect(r.toolCalls).toEqual(['find_safe_stops', 'propose_action:go_to_stop', 'propose_action:share_walk']);
    // share_walk is refused because sharing is already on; distress adds alert + 911.
    expect(r.actions.map((a) => a.type)).toEqual(['go_to_stop', 'alert_contacts', 'call_911']);
    expect(r.text).toContain('The Mill');
    expect(r.replaced).toBe(false);
  });
  it('overrides a model reply that calls the area safe', async () => {
    const model = new MockLanguageModelV4({ doGenerate: step([{ type: 'text', text: 'This block is totally safe, keep going.' }], 'stop') });
    const r = await runCompanionAgent({ model, context, message: 'Is this block okay?' });
    expect(r.replaced).toBe(true);
    expect(r.text).not.toMatch(/totally safe/);
  });
});
