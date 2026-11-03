import { DISTRESS, stopGuidance, type CompanionStop } from './companion-stops';

// Actions the companion can propose. They render as buttons; nothing is sent,
// shared or dialed until the walker taps one.
export type CompanionAction =
  | { type: 'go_to_stop'; stop: CompanionStop }
  | { type: 'reroute' }
  | { type: 'share_walk' }
  | { type: 'alert_contacts' }
  | { type: 'call_911' };
export type ActionType = CompanionAction['type'];
export const ACTION_TYPES = ['go_to_stop', 'reroute', 'share_walk', 'alert_contacts', 'call_911'] as const;

export type WalkState = { active: boolean; sharing: boolean; canReroute: boolean };

const SAFE_CLAIM = /\b(?:(?:it|this|that|the area|the block|the street|the route|this block|this area|this route|here)\s+(?:is|'s|’s|looks|seems|feels)\s+(?:totally |completely |perfectly |very |quite )?safe\b|you(?:'re| are|’re)\s+(?:totally |completely |perfectly )?safe\b|safe (?:area|neighbou?rhood|street|block|route)\b)/i;

export function isDistress(message: string, history: { role: string; text: string }[] = []) {
  return DISTRESS.test(message) || (/\bthere\b|\bwhere\b/i.test(message) && history.some((m) => m.role === 'you' && DISTRESS.test(m.text)));
}

export function claimsSafety(text: string) {
  return SAFE_CLAIM.test(text);
}

// Which proposals make sense right now; the agent's own proposals are filtered through this.
export function actionAllowed(type: ActionType, walk: WalkState) {
  if (type === 'reroute') return walk.active && walk.canReroute;
  if (type === 'share_walk') return walk.active && !walk.sharing;
  return true;
}

const ORDER: ActionType[] = ['go_to_stop', 'reroute', 'share_walk', 'alert_contacts', 'call_911'];

/**
 * Deterministic guardrails applied after the model. Emergency options never depend on
 * the model: distress always gets the nearest stop, an alert and 911, and any reply that
 * calls an area safe or omits the recommended stop is replaced with scripted guidance.
 */
export function applySafetyRules(input: {
  text: string;
  actions: CompanionAction[];
  message: string;
  history?: { role: string; text: string }[] | undefined;
  nearest: CompanionStop | undefined;
  walk: WalkState;
}) {
  const distress = isDistress(input.message, input.history);
  const actions = input.actions.filter((a) => actionAllowed(a.type, input.walk));
  const add = (a: CompanionAction) => { if (!actions.some((x) => x.type === a.type)) actions.push(a); };
  if (distress) {
    if (input.nearest) add({ type: 'go_to_stop', stop: input.nearest });
    add({ type: 'alert_contacts' });
    add({ type: 'call_911' });
  }
  const recommended = actions.find((a): a is Extract<CompanionAction, { type: 'go_to_stop' }> => a.type === 'go_to_stop')?.stop;
  let text = input.text.trim();
  let replaced = false;
  if (!text || claimsSafety(text) || (distress && recommended && !text.toLowerCase().includes(recommended.name.toLowerCase()))) {
    text = stopGuidance(recommended ?? input.nearest);
    replaced = true;
  }
  const seen = new Set<ActionType>();
  const ordered = actions
    .filter((a) => (seen.has(a.type) ? false : (seen.add(a.type), true)))
    .sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));
  return { text, actions: ordered, replaced, distress };
}
