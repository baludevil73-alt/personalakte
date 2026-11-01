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
export async function authorize({jwt, providerToken, auth, fetcher = fetch, wait = ms => new Promise(resolve => setTimeout(resolve,ms))}) {
  if (!jwt || !providerToken) throw new AccessError(401,'Bitte abmelden und erneut mit Discord anmelden.');
  const {data,error} = await auth.getUser(jwt);
  const user = data?.user;
  if (error || !user) throw new AccessError(401,'Anmeldung ungültig. Bitte erneut anmelden.');
  const identity = user.identities?.find(i => i.provider === 'discord');
  // Nur von Supabase verifizierte Provider-Identität, niemals user_metadata.
  const discordId = identity?.provider_id ?? identity?.identity_data?.sub;
  if (!discordId || !/^\d{17,20}$/.test(discordId)) throw new AccessError(403,'Discord-Identität konnte nicht bestätigt werden.');
  const request = () => fetcher(`https://discord.com/api/v10/users/@me/guilds/${guildId}/member`, {
    headers: {Authorization:`Bearer ${providerToken}`}, signal:AbortSignal.timeout(8000)
  });
  let response;
  try { response = await request(); }
  catch { throw new AccessError(503,'Discord ist gerade nicht erreichbar. Bitte später erneut versuchen. [Discord Netzwerk]'); }
  async function retrySeconds(result) {
    const header = result.headers?.get?.('retry-after');
    if(header !== null && header !== undefined && /^\d+(\.\d+)?$/.test(header)) return Number(header);
    try {
      const body = await result.json();
      return typeof body.retry_after === 'number' && Number.isFinite(body.retry_after) && body.retry_after>=0 ? body.retry_after : null;
    } catch { return null; }
  }
  let retryAfter = null;
  if(response.status === 429) {
    retryAfter = await retrySeconds(response);
    // Nur eine kurze, von Discord vorgegebene Wartezeit überbrücken.
    // Niemals alte Rollen wiederverwenden oder ungeprüften Zugriff erlauben.
    if(retryAfter !== null && retryAfter<=2) {
      await wait(Math.ceil(retryAfter*1000)+100);
      try { response = await request(); }
      catch { throw new AccessError(503,'Discord ist gerade nicht erreichbar. [Discord Netzwerk]'); }
      if(response.status===429) retryAfter=await retrySeconds(response);
    }
  }
  if (!response.ok) {
    if(response.status===429) {
      const delay=retryAfter===null?'etwas':Math.ceil(retryAfter)+' Sekunden';
      throw new AccessError(503,`Discord begrenzt gerade die Rollenabfragen. Bitte ${delay} warten und erneut versuchen. [Discord 429]`);
    }
    if(response.status===401) throw new AccessError(401,'Die Discord-Anmeldung ist abgelaufen oder ungültig. Bitte abmelden und neu anmelden. [Discord 401]');
    if(response.status===403) throw new AccessError(403,'Discord verweigert die Rollenabfrage. Bitte erneut anmelden und die Berechtigung zum Lesen der Servermitgliedschaft erlauben. [Discord 403]');
    if(response.status===404) throw new AccessError(403,'Discord findet deine Mitgliedschaft auf dem eingerichteten Server nicht. Bitte Discord-Konto und Server prüfen. [Discord 404]');
    const code=Number.isInteger(response.status)?response.status:'unbekannt';
    throw new AccessError(503,`Discord-Rollenabfrage momentan nicht möglich. Bitte später erneut versuchen. [Discord ${code}]`);
  }
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
