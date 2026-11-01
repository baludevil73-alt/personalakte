import {createHash} from 'node:crypto';
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
export async function authorize({jwt, providerToken, auth, cache, fetcher = fetch, wait = ms => new Promise(resolve => setTimeout(resolve,ms))}) {
  if (!jwt || !providerToken) throw new AccessError(401,'Bitte abmelden und erneut mit Discord anmelden.');
  const {data,error} = await auth.getUser(jwt);
  const user = data?.user;
  if (error || !user) throw new AccessError(401,'Anmeldung ungültig. Bitte erneut anmelden.');
  const identity = user.identities?.find(i => i.provider === 'discord');
  // Nur von Supabase verifizierte Provider-Identität, niemals user_metadata.
  const discordId = identity?.provider_id ?? identity?.identity_data?.sub;
  if (!discordId || !/^\d{17,20}$/.test(discordId)) throw new AccessError(403,'Discord-Identität konnte nicht bestätigt werden.');
  const hash=createHash('sha256').update(guildId+'\0'+providerToken).digest('hex');
  let lease;
  if(cache) {
    const state=await cache.acquire(user.id,hash);
    if(state.state==='cached' && ['reader','editor'].includes(state.role)) return {userId:user.id,role:state.role};
    if(state.state==='blocked' || state.state==='pending') {
      const error=new AccessError(503,state.state==='blocked' ? 'Discord-Wartezeit läuft noch. Bitte später erneut versuchen. [Discord 429]' : 'Eine Rollenprüfung läuft bereits. Bitte kurz warten.');
      error.retryAfter=Math.max(1,Math.ceil(state.retryAfter || 2));throw error;
    }
    if(state.state!=='claimed' || typeof state.leaseId!=='string') throw new AccessError(503,'Rollenprüfung konnte nicht gestartet werden.');
    lease=state.leaseId;
  }
  try {
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
      const error=new AccessError(503,`Discord begrenzt gerade die Rollenabfragen. Bitte ${delay} warten und erneut versuchen. [Discord 429]`);
      error.retryAfter=retryAfter===null?60:Math.max(1,Math.ceil(retryAfter));throw error;
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
  if(cache) await cache.complete(user.id,hash,lease,role);
  return {userId:user.id,role};
  } catch(error) {
    if(cache) await cache.complete(user.id,hash,lease,null,error.retryAfter ?? 0);
    throw error;
  }
}
export function recordInput(input) {
  if (!input || typeof input !== 'object') throw new AccessError(400,'Ungültige Eingabe.');
  const fields = ['first_name','last_name','notes'];
  for (const field of fields) if(typeof input[field] !== 'string') throw new AccessError(400,'Ungültige Eingabe.');
  const first_name = input.first_name.trim(), last_name = input.last_name.trim();
  if (!(first_name || last_name) || first_name.length > 160 || last_name.length > 160 || input.notes.length > 20000)
    throw new AccessError(400,'Mindestens einen Namen eintragen; maximal 160 Zeichen je Name und 20.000 Zeichen Notizen.');
  const result={first_name,last_name,notes:input.notes};
  // Fehlende Felder bei älteren Clients nicht überschreiben; leer löscht gezielt.
  for(const field of ['gender','identity_number']) {
    if(!Object.hasOwn(input,field)) continue;
    if(input[field]!==null && typeof input[field]!=='string') throw new AccessError(400,'Geschlecht und Ausweisnummer müssen Text sein.');
    const value=input[field]?.trim() || null;
    if(value && value.length>(field==='gender'?80:160)) throw new AccessError(400,'Geschlecht: höchstens 80 Zeichen; Ausweisnummer: höchstens 160 Zeichen.');
    result[field]=value;
  }
  if(Object.hasOwn(input,'height_cm')) {
    const value=input.height_cm;
    if(value!==null && (!Number.isInteger(value) || value<50 || value>250)) throw new AccessError(400,'Körpergröße muss eine ganze Zahl von 50 bis 250 cm sein.');
    result.height_cm=value;
  }
  if(Object.hasOwn(input,'birth_date')) {
    const value=input.birth_date;
    if(value===null || value==='') result.birth_date=null;
    else {
      if(typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.slice(0,4)==='0000') throw new AccessError(400,'Bitte ein gültiges Geburtsdatum eintragen.');
      const date=new Date(value+'T00:00:00Z');
      if(!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==value) throw new AccessError(400,'Bitte ein gültiges Geburtsdatum eintragen.');
      result.birth_date=value;
    }
  }
  return result;
}
