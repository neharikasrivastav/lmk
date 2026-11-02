export type WalkContact = { name: string; phone: string };

// Fictional numbers from the reserved 555-0100–0199 range; never real people.
export const DEMO_CONTACTS: WalkContact[] = [
  { name: 'Mom', phone: '+15555550101' },
  { name: 'Priya', phone: '+15555550102' },
  { name: 'Alex', phone: '+15555550103' },
];

export const CONTACTS_STORAGE_KEY = 'lmk-trusted-contacts';

export function parseStoredContacts(raw: string | null): WalkContact[] {
  try {
    const list = JSON.parse(raw ?? '[]');
    return Array.isArray(list)
      ? list.filter((c) => c && typeof c.name === 'string' && typeof c.phone === 'string' && c.name.trim()).slice(0, 20)
      : [];
  } catch {
    return [];
  }
}

export function shareMessageUrl(names: string[], text: string, contacts: WalkContact[] = DEMO_CONTACTS) {
  const phones = contacts.filter((c) => names.includes(c.name)).map((c) => c.phone);
  return `sms:${phones.join(',')}?&body=${encodeURIComponent(text)}`;
}
