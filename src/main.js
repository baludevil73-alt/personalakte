import { createClient } from '@supabase/supabase-js';
import { canEdit } from './policy.js';
import { attachDocuments } from './documents-ui.js';
import {auditMarkup,createAuditView} from './audit-ui.js';
import { detailsForm, detailsPayload, matchesRecord, setDetailValue } from './record-fields.js';
import {renderRecordList} from './record-list.js';
import {createRecordSheet} from './record-sheet.js';
import {ocrMarkup,createOcrView} from './ocr-ui.js';
import './style.css';

const root = document.querySelector('#app');
root.innerHTML = `<header><div class="brand">NC<span>NARCO CITY / VERWALTUNG</span></div><button id="logout" hidden>Abmelden</button></header><main><p class="eyebrow">GESCHÜTZTER ARBEITSBEREICH</p><h1>Personalakten</h1><p id="status" role="status" aria-live="polite">Verbindung wird geprüft …</p><button id="login" hidden>Mit Discord anmelden</button><button id="retry" hidden>Erneut versuchen</button><section id="workspace" hidden><div class="toolbar"><label>Akten durchsuchen<input id="search" type="search" maxlength="160" placeholder="Name oder Ausweisnummer eingeben"></label><button id="new" hidden>Neue Akte</button><button id="auditToggle" type="button" hidden>Änderungsprotokoll</button></div><p id="count"></p><div id="records"></div><section id="recordDetail" hidden><button id="backToList" type="button">← Zur Aktenübersicht</button><div id="recordContent"></div></section><form id="editor" hidden><h2 id="formtitle">Akte bearbeiten</h2>${ocrMarkup}<label>Vorname<input id="first_name" maxlength="160" autocomplete="off"></label><label>Nachname<input id="last_name" maxlength="160" autocomplete="off"></label>${detailsForm}<label>Notizen<textarea id="notes" maxlength="20000" rows="10"></textarea></label><div class="actions"><button type="submit">Speichern</button><button type="button" id="cancel">Abbrechen</button></div></form>${auditMarkup}</section></main><footer>Nur für ausdrücklich freigeschaltete Mitarbeitende.</footer>`;
const el = id => document.getElementById(id);
const status = message => { el('status').textContent = message; };
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
let db, role, records = [], editing = null, generation = 0;
let retryUntil = Number(sessionStorage.getItem('nc_retry_until')) || 0;
let documentCleanups=[];
let selectedRecord=null,viewVersion=0;
const auditView=createAuditView({api,getRecords:()=>records,isAllowed:()=>role==='editor',onError:status});
const ocrView=createOcrView({isAllowed:()=>canEdit(role)&&!el('editor').hidden,onApply:values=>{for(const [field,value] of Object.entries(values))el(field).value=value;}});
function clearDocumentPreviews(){for(const dispose of documentCleanups)dispose();documentCleanups=[];}
function clear() {
  ocrView.clear();
  auditView.clear();
  clearDocumentPreviews();
  generation++; viewVersion++; selectedRecord=null; role = null; records = []; editing = null;
  el('records').replaceChildren(); el('recordContent').replaceChildren();el('editor').reset();
  for (const id of ['workspace','editor','new','logout','retry','auditToggle','recordDetail']) el(id).hidden = true;
}
function render() {
  const filtered=records.filter(record=>matchesRecord(record,el('search').value));
  el('count').textContent=filtered.length+' Akten angezeigt (maximal 200 geladen)';
  renderRecordList(el('records'),filtered,openRecord);
}
function showList() {
  ocrView.clear();
  viewVersion++;selectedRecord=null;editing=null;clearDocumentPreviews();
  el('recordContent').replaceChildren();el('recordDetail').hidden=true;
  el('editor').hidden=true;el('editor').reset();el('records').hidden=false;
  el('count').hidden=false;el('search').closest('label').hidden=false;
  render();el('search').focus();
}
async function openRecord(id) {
  ocrView.clear();
  const request=++viewVersion,turn=generation;clearDocumentPreviews();selectedRecord=null;editing=null;
  el('editor').hidden=true;el('editor').reset();el('records').hidden=true;el('count').hidden=true;
  el('search').closest('label').hidden=true;el('recordDetail').hidden=false;
  el('recordContent').textContent='Akte wird geladen …';el('backToList').focus();
  try {
    const result=await api('GET',undefined,'/api/records?record_id='+encodeURIComponent(id));
    if(request!==viewVersion || turn!==generation) return;
    selectedRecord=result.record;role=result.role;el('new').hidden=!canEdit(role);el('auditToggle').hidden=role!=='editor';
    if(role!=='editor')auditView.clear();
    status(role==='editor'?'Discord-Rolle geprüft · Lesen und Bearbeiten':'Discord-Rolle geprüft · Nur Lesen');
    renderDetail(result.record);
  }catch(error){
    if(request!==viewVersion || turn!==generation)return;
    el('recordContent').textContent=error.message;status(error.message);
  }
}
function renderDetail(record) {
  clearDocumentPreviews();const turn=generation,view=viewVersion;
    const {article,actions}=createRecordSheet(record);
    if (canEdit(role)) {
      const edit = document.createElement('button'); edit.textContent = 'Bearbeiten';
      edit.onclick = () => openEditor(record); actions.append(edit);
      const remove=document.createElement('button');remove.type='button';remove.className='danger';remove.textContent='Akte löschen';
      remove.onclick=async()=>{
        const name=[record.first_name,record.last_name].filter(Boolean).join(' ');
        if(!confirm('Akte „'+name+'“ und ALLE zugehörigen Bilder endgültig löschen? Es gibt keinen Papierkorb.')) return;
        remove.disabled=true;
        try{await api('DELETE',undefined,'/api/records?record_id='+encodeURIComponent(record.id));await load();}
        catch(error){status(error.message);}finally{remove.disabled=false;}
      };
      actions.append(remove);
    }
    el('recordContent').replaceChildren(article);
    documentCleanups.push(attachDocuments(article,record,{api,canUpload:canEdit(role),onError:status,isCurrent:()=>turn===generation && view===viewVersion,onRecognize:async image=>{openEditor(record);await ocrView.recognize(image);}}));
}
el('backToList').onclick=showList;

function openEditor(record) {
  ocrView.clear();
  if(!record){viewVersion++;selectedRecord=null;clearDocumentPreviews();el('recordContent').replaceChildren();el('recordDetail').hidden=true;el('records').hidden=true;el('count').hidden=true;el('search').closest('label').hidden=true;}
  editing = record; el('editor').hidden = false;
  el('formtitle').textContent = record ? 'Akte bearbeiten' : 'Neue Akte';
  el('first_name').value = record?.first_name ?? ''; el('last_name').value = record?.last_name ?? ''; el('notes').value = record?.notes ?? ''; el('first_name').focus();
  for(const field of ['birth_date','gender','height_cm','identity_number']) setDetailValue(el(field),record?.[field]);
}
async function load() {
  clear(); const turn = generation;
  const {data:{user},error} = await db.auth.getUser();
  if(turn !== generation) return;
  el('login').hidden = !!user;
  if(error || !user) return status('Bitte melde dich mit deinem Discord-Konto an.');
  el('logout').hidden = false;
  try {
    const result = await api('GET');
    if(turn !== generation) return;
    role = result.role; records = result.records;
    el('workspace').hidden = false; el('new').hidden = !canEdit(role);
    el('auditToggle').hidden=role!=='editor';
    status(role === 'editor' ? 'Discord-Rolle geprüft · Lesen und Bearbeiten' : 'Discord-Rolle geprüft · Nur Lesen'); showList();
  } catch(error) {
    if(turn !== generation) return;
    status(error.message);
  }
}
el('search').oninput = render;
el('new').onclick = () => openEditor(null);
el('cancel').onclick = () => { ocrView.clear();el('editor').hidden = true; el('editor').reset(); editing = null; if(!selectedRecord)showList(); };
el('editor').onsubmit = async event => {
  ocrView.clear();
  event.preventDefault(); const button = event.submitter; button.disabled = true;
  try {
    const saved=await api(editing ? 'PATCH' : 'POST',{
      first_name:el('first_name').value,last_name:el('last_name').value,notes:el('notes').value,
      ...detailsPayload(field=>el(field).value),
      ...(editing ? {id:editing.id,updated_at:editing.updated_at} : {})
    });
    await load();
    if(role && saved.id)await openRecord(saved.id);
  } catch(error) { status(error.message); } finally { button.disabled = false; }
};
function showRetry() {
  const seconds = Math.max(0,Math.ceil((retryUntil-Date.now())/1000));
  el('retry').hidden = false; el('retry').disabled = seconds>0;
  el('retry').textContent = seconds>0 ? 'Erneut versuchen in '+seconds+' Sekunden' : 'Erneut versuchen';
}
el('retry').onclick = () => load().catch(error=>status(error.message));
setInterval(()=>{if(!el('retry').hidden) showRetry();},1000);
async function api(method,body,path='/api/records',download=false) {
  if(retryUntil>Date.now()) {
    showRetry(); throw new Error('Die vorgegebene Wartezeit läuft noch. Bitte den Countdown abwarten.');
  }
  const {data:{session}} = await db.auth.getSession();
  const providerToken = sessionStorage.getItem('nc_discord_access');
  if(!session || !providerToken) throw new Error('Bitte abmelden und erneut mit Discord anmelden, um die Rollenprüfung zu erlauben.');
  const response = await fetch(path,{
    method,headers:{Authorization:'Bearer '+session.access_token,'X-Discord-Token':providerToken,'Content-Type':'application/json'},
    ...(body ? {body:JSON.stringify(body)} : {}),cache:'no-store'
  });
  if(response.ok && download) return response.blob();
  const result = await response.json();
  if(!response.ok) {
    if([401,403,503].includes(response.status)) {clear();el('logout').hidden=false;}
    if(Number.isFinite(result.retryAfter) && result.retryAfter>0) {
      retryUntil=Date.now()+Math.ceil(result.retryAfter)*1000;
      sessionStorage.setItem('nc_retry_until',String(retryUntil));showRetry();
    }
    status(result.error || 'Zugriff verweigert.');
    throw new Error(result.error || 'Zugriff verweigert.');
  }
  return result;
}
async function start() {
  if(url !== 'https://gplasajxitwifndxjxjf.supabase.co' || !key?.startsWith('sb_publishable_')) {
    status('Die Anwendung ist noch nicht eingerichtet. Es werden keine Akten geladen.'); return;
  }
  db = createClient(url,key,{auth:{flowType:'pkce',persistSession:true,storage:sessionStorage,detectSessionInUrl:false}});
  el('login').onclick = async () => {
    el('login').disabled = true;
    const {error} = await db.auth.signInWithOAuth({provider:'discord',options:{redirectTo:location.origin+'/',scopes:'identify email guilds.members.read'}});
    if(error) {status('Discord-Anmeldung konnte nicht gestartet werden.');el('login').disabled = false;}
  };
  el('logout').onclick = async () => {
    clear(); sessionStorage.removeItem('nc_discord_access');
    const {error} = await db.auth.signOut({scope:'local'});
    if(error) { status('Abmeldung fehlgeschlagen. Bitte diesen Tab schließen.'); return; }
    await load();
  };
  const params = new URLSearchParams(location.search);
  const code = params.get('code'); const failed = params.has('error');
  history.replaceState(null,'','/');
  if(failed) { status('Discord-Anmeldung abgebrochen oder fehlgeschlagen.'); el('login').hidden = false; return; }
  if(code) {
    const {data,error} = await db.auth.exchangeCodeForSession(code);
    sessionStorage.removeItem('nc_discord_access');
    if(!error && data.session?.provider_token) sessionStorage.setItem('nc_discord_access',data.session.provider_token);
    if(error) { status('Anmeldung abgelaufen. Bitte erneut anmelden.'); el('login').hidden = false; return; }
  }
  db.auth.onAuthStateChange(event => {
    if(event === 'SIGNED_OUT') { sessionStorage.removeItem('nc_discord_access'); clear(); status('Abgemeldet.'); el('login').hidden = false; }
    if(event === 'TOKEN_REFRESHED') setTimeout(() => load().catch(() => {clear();status('Verbindung fehlgeschlagen.');}),0);
  });
  await load();
}
start().catch(() => {clear();status('Verbindung fehlgeschlagen. Bitte später erneut versuchen.');});
