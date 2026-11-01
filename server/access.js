export const guildId = '959404435614859264';
export function discordRole(roles) {
  if (!Array.isArray(roles)) return null;
  if (roles.includes('1566464755278024776')) return 'editor';
  if (roles.includes('1566464655340077166')) return 'reader';
  return null;
}
export class AccessError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export async function authorize({jwt, providerToken, auth, fetcher = fetch}) {
  if (!jwt || !providerToken) throw new AccessError(401,'Bitte abmelden und erneut mit Discord anmelden.');
  const {data,error} = await auth.getUser(jwt);
  const user = data?.user;
  if (error || !user) throw new AccessError(401,'Anmeldung ungültig. Bitte erneut anmelden.');
  const identity = user.identities?.find(i => i.provider === 'discord');
  // Nur von Supabase verifizierte Provider-Identität, niemals user_metadata.
  const discordId = identity?.provider_id ?? identity?.identity_data?.sub;
  if (!discordId || !/^\d{17,20}$/.test(discordId)) throw new AccessError(403,'Discord-Identität konnte nicht bestätigt werden.');
  const response = await fetcher(`https://discord.com/api/v10/users/@me/guilds/${guildId}/member`, {
    headers: {Authorization:`Bearer ${providerToken}`}, signal:AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new AccessError(response.status === 429 ? 503 : 403,'Discord-Rollenprüfung fehlgeschlagen. Bitte später erneut anmelden.');
  const member = await response.json();
  if (member.user?.id !== discordId) throw new AccessError(403,'Discord-Konto stimmt nicht mit der Anmeldung überein.');
  const role = discordRole(member.roles);
  if (!role || member.pending === true) throw new AccessError(403,'Kein Zugriff: Auf dem Discord-Server wird die Rolle Akte oder Akte 2 benötigt.');
  return {userId:user.id,role};
}
export function recordInput(input) {
  if (!input || typeof input !== 'object') throw new AccessError(400,'Ungültige Eingabe.');
  const fields = ['first_name','last_name','notes'];
  for (const field of fields) if(typeof input[field] !== 'string') throw new AccessError(400,'Ungültige Eingabe.');
  const first_name = input.first_name.trim(), last_name = input.last_name.trim();
  if (!(first_name || last_name) || first_name.length > 160 || last_name.length > 160 || input.notes.length > 20000)
    throw new AccessError(400,'Mindestens einen Namen eintragen; maximal 160 Zeichen je Name und 20.000 Zeichen Notizen.');
  return {first_name,last_name,notes:input.notes};
}
