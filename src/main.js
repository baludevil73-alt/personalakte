import { createClient } from '@supabase/supabase-js';
import { canEdit, validateRecord } from './policy.js';
import './style.css';

const root = document.querySelector('#app');
root.innerHTML = `<header><div class="brand">NC<span>NARCO CITY / VERWALTUNG</span></div><button id="logout" hidden>Abmelden</button></header><main><p class="eyebrow">GESCHÜTZTER ARBEITSBEREICH</p><h1>Personalakten</h1><p id="status" role="status" aria-live="polite">Verbindung wird geprüft …</p><button id="login" hidden>Mit Discord anmelden</button><section id="workspace" hidden><div class="toolbar"><label>Akten durchsuchen<input id="search" type="search" maxlength="160" placeholder="Name eingeben"></label><button id="new" hidden>Neue Akte</button></div><p id="count"></p><div id="records"></div><form id="editor" hidden><h2 id="formtitle">Akte bearbeiten</h2><label>Name<input id="name" required maxlength="160" autocomplete="off"></label><label>Notizen<textarea id="notes" maxlength="20000" rows="10"></textarea></label><div class="actions"><button type="submit">Speichern</button><button type="button" id="cancel">Abbrechen</button></div></form></section></main><footer>Nur für ausdrücklich freigeschaltete Mitarbeitende.</footer>`;
const el = id => document.getElementById(id);
const status = message => { el('status').textContent = message; };
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
let db, role, records = [], editing = null, generation = 0;
function clear() {
  generation++; role = null; records = []; editing = null;
  el('records').replaceChildren(); el('editor').reset();
  for (const id of ['workspace','editor','new','logout']) el(id).hidden = true;
}
function render() {
  el('records').replaceChildren();
  const filtered = records.filter(r => r.name.toLocaleLowerCase('de').includes(el('search').value.toLocaleLowerCase('de')));
  el('count').textContent = `${filtered.length} Akten angezeigt (maximal 200 geladen)`;
  for (const record of filtered) {
    const article = document.createElement('article');
    const title = document.createElement('h2'); title.textContent = record.name;
    const notes = document.createElement('p'); notes.className = 'notes'; notes.textContent = record.notes;
    article.append(title, notes);
    if (canEdit(role)) {
      const edit = document.createElement('button'); edit.textContent = 'Bearbeiten';
      edit.onclick = () => openEditor(record); article.append(edit);
    }
    if (role === 'admin') {
      const remove = document.createElement('button'); remove.textContent = 'Löschen';
      remove.onclick = async () => {
        if (!confirm('Diese Akte endgültig löschen?')) return;
        remove.disabled = true;
        const {data,error} = await db.from('nc_records').delete().eq('id',record.id).eq('updated_at',record.updated_at).select('id');
        remove.disabled = false;
        if(error || !data?.length) return status('Löschen nicht möglich. Rechte prüfen oder neu laden.');
        await load();
      }; article.append(remove);
    }
    el('records').append(article);
  }
}
function openEditor(record) {
  editing = record; el('editor').hidden = false;
  el('formtitle').textContent = record ? 'Akte bearbeiten' : 'Neue Akte';
  el('name').value = record?.name ?? ''; el('notes').value = record?.notes ?? ''; el('name').focus();
}
async function load() {
  clear(); const turn = generation;
  const {data:{user},error} = await db.auth.getUser();
  if(turn !== generation) return;
  el('login').hidden = !!user;
  if(error || !user) return status('Bitte melde dich mit deinem Discord-Konto an.');
  el('logout').hidden = false;
  const membership = await db.from('nc_members').select('role').eq('user_id',user.id).maybeSingle();
  if(turn !== generation) return;
  if(membership.error) return status('Zugriffsprüfung fehlgeschlagen. Bitte die Einrichtung prüfen lassen.');
  role = membership.data?.role;
  if(!['viewer','editor','admin'].includes(role)) return status('Angemeldet. Dein Konto wartet auf Freischaltung.');
  const result = await db.from('nc_records').select('id,name,notes,updated_at').order('name').limit(200);
  if(turn !== generation) return;
  if(result.error) return status('Akten konnten nicht geladen werden. Bitte Rechte und Verbindung prüfen.');
  records = result.data; el('workspace').hidden = false; el('new').hidden = !canEdit(role);
  status(`Angemeldet · ${ {viewer:'Leserechte',editor:'Bearbeitungsrechte',admin:'Administrator'}[role] }`); render();
}
el('search').oninput = render;
el('new').onclick = () => openEditor(null);
el('cancel').onclick = () => { el('editor').hidden = true; el('editor').reset(); editing = null; };
el('editor').onsubmit = async event => {
  event.preventDefault(); const button = event.submitter; button.disabled = true;
  try {
    const payload = validateRecord(el('name').value,el('notes').value);
    const query = editing ? db.from('nc_records').update(payload).eq('id',editing.id).eq('updated_at',editing.updated_at) : db.from('nc_records').insert(payload);
    const {data,error} = await query.select('id');
    if(error || !data?.length) throw new Error('Speichern fehlgeschlagen. Möglicherweise wurde die Akte inzwischen geändert oder dein Zugriff entzogen.');
    await load();
  } catch(error) { status(error.message); } finally { button.disabled = false; }
};
async function start() {
  if(url !== 'https://gplasajxitwifndxjxjf.supabase.co' || !key?.startsWith('sb_publishable_')) {
    status('Die Anwendung ist noch nicht eingerichtet. Es werden keine Akten geladen.'); return;
  }
  db = createClient(url,key,{auth:{flowType:'pkce',persistSession:true,storage:sessionStorage,detectSessionInUrl:false}});
  el('login').onclick = async () => {
    el('login').disabled = true;
    const {error} = await db.auth.signInWithOAuth({provider:'discord',options:{redirectTo:location.origin+'/'}});
    if(error) {status('Discord-Anmeldung konnte nicht gestartet werden.');el('login').disabled = false;}
  };
  el('logout').onclick = async () => {
    clear();
    const {error} = await db.auth.signOut({scope:'local'});
    if(error) { status('Abmeldung fehlgeschlagen. Bitte diesen Tab schließen.'); return; }
    await load();
  };
  const params = new URLSearchParams(location.search);
  const code = params.get('code'); const failed = params.has('error');
  history.replaceState(null,'','/');
  if(failed) { status('Discord-Anmeldung abgebrochen oder fehlgeschlagen.'); el('login').hidden = false; return; }
  if(code) {
    const {error} = await db.auth.exchangeCodeForSession(code);
    if(error) { status('Anmeldung abgelaufen. Bitte erneut anmelden.'); el('login').hidden = false; return; }
  }
  db.auth.onAuthStateChange(event => {
    if(event === 'SIGNED_OUT') { clear(); status('Abgemeldet.'); el('login').hidden = false; }
    if(event === 'TOKEN_REFRESHED') setTimeout(() => load().catch(() => {clear();status('Verbindung fehlgeschlagen.');}),0);
  });
  await load();
}
start().catch(() => {clear();status('Verbindung fehlgeschlagen. Bitte später erneut versuchen.');});
