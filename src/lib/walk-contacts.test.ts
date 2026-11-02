import { expect, it } from 'vitest';
import { DEMO_CONTACTS, parseStoredContacts, shareMessageUrl } from './walk-contacts';

it('demo contacts use only reserved fictional 555-01xx numbers', () => {
  for (const c of DEMO_CONTACTS) expect(c.phone).toMatch(/^\+155555501\d\d$/);
});
it('addresses selected Mom at her fictional number', () => {
  expect(shareMessageUrl(['Mom'], 'Follow my walk')).toBe('sms:+15555550101?&body=Follow%20my%20walk');
});
it('does not address unselected contacts', () => {
  expect(shareMessageUrl([], 'Follow')).toBe('sms:?&body=Follow');
});
it('ignores malformed stored contacts', () => {
  expect(parseStoredContacts('not json')).toEqual([]);
  expect(parseStoredContacts('[{"name":"Sam","phone":"+15555550104"},{"name":5}]')).toEqual([{ name: 'Sam', phone: '+15555550104' }]);
});
