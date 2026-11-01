export const auditMarkup=`<section id="auditPanel" hidden aria-labelledby="auditHeading"><h2 id="auditHeading">Änderungsprotokoll</h2><p>Die neuesten 100 Einträge. Benutzer werden mit ihrer eindeutigen Benutzer-ID angezeigt. Angeforderte und abgeschlossene Löschungen sind getrennt gekennzeichnet.</p><button id="auditRefresh" type="button">Aktualisieren</button><p id="auditStatus" role="status"></p><div id="auditEntries"></div></section>`;
const labels={record_created:'Akte angelegt',record_updated:'Akte bearbeitet',record_delete_requested:'Aktenlöschung angefordert',record_deleted:'Akte gelöscht',document_uploaded:'Bild hochgeladen',document_delete_requested:'Bildlöschung angefordert',document_deleted:'Bild gelöscht',other:'Sonstige Aktion'};
const kinds={profile:'Profilbild',identity:'Ausweis',driver_license:'Führerschein',firearm_license:'Waffenschein',other:'Sonstiges'};
export function createAuditView({api,getRecords,isAllowed,onError}) {
 const el=id=>document.getElementById(id);
 let version=0;
 function clear(){version++;el('auditEntries').replaceChildren();el('auditStatus').textContent='';el('auditPanel').hidden=true;el('auditToggle').textContent='Änderungsprotokoll';el('auditRefresh').disabled=false;}
 async function refresh(){
  const request=++version;
  el('auditEntries').replaceChildren();el('auditStatus').textContent='Protokoll wird geladen …';el('auditRefresh').disabled=true;
  try{
   const data=await api('GET',undefined,'/api/audit');
   if(request!==version || !isAllowed() || el('auditPanel').hidden) return;
   el('auditStatus').textContent=data.entries.length+' Einträge angezeigt.';
   const records=new Map(getRecords().map(record=>[record.id,[record.first_name,record.last_name].filter(Boolean).join(' ')]));
   for(const entry of data.entries){
    const article=document.createElement('article');article.className='audit-entry';
    const title=document.createElement('h3');title.textContent=labels[entry.action] ?? labels.other;
    const time=document.createElement('p');const date=new Date(entry.created_at);
    time.textContent=Number.isFinite(date.getTime())?date.toLocaleString('de-DE'):'Zeitpunkt unbekannt';
    const actor=document.createElement('p');actor.textContent='Benutzer-ID: '+(entry.actor ?? 'Nicht mehr zugeordnet');
    const record=document.createElement('p');
    record.textContent='Akte: '+(records.get(entry.record_id)?records.get(entry.record_id)+' · ':'')+(entry.record_id ?? 'Nicht zugeordnet');
    article.append(title,time,actor,record);
    if(entry.document_id){const details=document.createElement('p');details.textContent=(kinds[entry.kind] ?? 'Dokument')+' · '+entry.document_id;article.append(details);}
    el('auditEntries').append(article);
   }
  }catch(error){if(request===version)el('auditStatus').textContent='Protokoll konnte nicht geladen werden.';onError(error.message);}
  finally{if(request===version)el('auditRefresh').disabled=false;}
 }
 el('auditRefresh').onclick=refresh;
 el('auditToggle').onclick=async()=>{
  if(!el('auditPanel').hidden){clear();return;}
  if(!isAllowed())return;
  el('auditPanel').hidden=false;el('auditToggle').textContent='Protokoll schließen';await refresh();
 };
 return {clear};
}
