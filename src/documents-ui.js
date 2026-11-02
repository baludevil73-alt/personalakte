import {createImagePreview} from './image-preview.js';
const labels={profile:'Profilbild',identity:'Ausweis',driver_license:'Führerschein',firearm_license:'Waffenschein',other:'Sonstiges'};
export function attachDocuments(article,record,{api,canUpload,onError,isCurrent,onRecognize}) {
 const toggle=document.createElement('button');toggle.textContent='Galerie ausblenden';toggle.className='gallery-toggle';
 const panel=document.createElement('section');panel.hidden=false;panel.className='documents';
 const list=document.createElement('div');list.className='document-grid';
 const navigation=document.createElement('nav');navigation.className='gallery-pagination';navigation.setAttribute('aria-label','Bildergalerie Seiten');
 const heading=document.createElement('h3');heading.className='section-title';heading.textContent='Bilder und Dokumente';panel.append(heading,list,navigation);
 article.append(toggle,panel);
 const current=()=>article.isConnected && !panel.hidden && isCurrent();
 let previews=[];
 let documents=[],page=0,galleryVersion=0;
 const clearPreviews=()=>{galleryVersion++;for(const preview of previews) preview.clear();previews=[];};
 async function refresh() {
  clearPreviews();
  list.textContent='Dokumente werden geladen …';
  const data=await api('GET',undefined,'/api/documents?file_id='+encodeURIComponent(record.id));
  if(!current()) return;
  const order=Object.keys(labels);
  documents=data.documents.sort((a,b)=>order.indexOf(a.kind)-order.indexOf(b.kind));page=0;
  drawGallery();
 }
 function drawGallery(){
  clearPreviews();const draw=++galleryVersion;
  list.replaceChildren();
  navigation.replaceChildren();
  if(!documents.length) list.textContent='Noch keine Bilder hinterlegt.';
  for(const item of documents.slice(page*6,page*6+6)) {
   let deleting=false,removed=false;
   const row=document.createElement('div');row.className='document-entry';
   const name=document.createElement('span');name.textContent=(labels[item.kind] ?? 'Dokument')+' · '+new Date(item.created_at).toLocaleDateString('de-DE')+' ';
   const download=document.createElement('button');download.type='button';download.textContent='Herunterladen';
   download.onclick=async()=>{
    download.disabled=true;
    try {
     const blob=await api('GET',undefined,'/api/documents?document_id='+encodeURIComponent(item.id),true);
     if(!current() || deleting || removed) return;
     const url=URL.createObjectURL(blob),link=document.createElement('a');
     const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[blob.type] ?? 'bin';
     link.href=url;link.download='dokument-'+item.id+'.'+ext;link.click();
     setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch(error){onError(error.message);}finally{download.disabled=false;}
   };
   const preview=createImagePreview({label:labels[item.kind] ?? 'Dokument',isCurrent:()=>current() && !deleting && !removed,onError,
    load:()=>api('GET',undefined,'/api/documents?document_id='+encodeURIComponent(item.id),true)});
   const controls=document.createElement('div');controls.className='document-actions';controls.append(preview.button,download);
   previews.push(preview);row.append(name,preview.view,controls);list.append(row);
   if(canUpload && item.kind==='identity' && onRecognize){
    const recognize=document.createElement('button');recognize.type='button';recognize.textContent='Daten auslesen';
    recognize.onclick=async()=>{
     recognize.disabled=true;
     try{const image=await api('GET',undefined,'/api/documents?document_id='+encodeURIComponent(item.id),true);if(current()&&!removed&&!deleting)await onRecognize(image);}
     catch(error){onError(error.message);}finally{recognize.disabled=false;}
    };controls.append(recognize);
   }
   if(canUpload) {
    const remove=document.createElement('button');remove.type='button';remove.textContent='Bild löschen';remove.className='danger';
    remove.onclick=async()=>{
     if(!confirm((labels[item.kind] ?? 'Bild')+' endgültig löschen? Die Datei wird sofort entfernt. Es gibt keinen Papierkorb.')) return;
     deleting=true;preview.clear();remove.disabled=true;download.disabled=true;preview.button.disabled=true;remove.textContent='Wird gelöscht …';
     try {
      await api('DELETE',undefined,'/api/documents?document_id='+encodeURIComponent(item.id));
      removed=true;preview.clear();documents=documents.filter(document=>document.id!==item.id);page=Math.min(page,Math.max(0,Math.ceil(documents.length/6)-1));
      if(current())drawGallery();
     }catch(error){onError(error.message);}
     finally{deleting=false;remove.disabled=false;download.disabled=false;preview.button.disabled=false;remove.textContent='Bild löschen';}
    };
    controls.append(remove);
   }
  }
  if(documents.length>6){
   const previous=document.createElement('button'),next=document.createElement('button'),position=document.createElement('span');
   previous.type=next.type='button';previous.textContent='← Zurück';next.textContent='Weitere Bilder →';
   previous.disabled=page===0;next.disabled=(page+1)*6>=documents.length;position.textContent=(page*6+1)+'–'+Math.min(page*6+6,documents.length)+' von '+documents.length;
   previous.onclick=()=>{page--;drawGallery();};next.onclick=()=>{page++;drawGallery();};navigation.append(previous,position,next);
  }
  const visible=[...previews];
  void(async()=>{for(const preview of visible){if(!current() || draw!==galleryVersion)return;await preview.autoOpen();}})();
 }
 toggle.onclick=async()=>{
  panel.hidden=!panel.hidden;
  toggle.textContent=panel.hidden?'Galerie anzeigen':'Galerie ausblenden';
  if(panel.hidden) {galleryVersion++;clearPreviews();return;}
  toggle.disabled=true;
  try{await refresh();}catch(error){if(current()) list.textContent='Dokumente konnten nicht geladen werden.';onError(error.message);}finally{toggle.disabled=false;}
 };
 queueMicrotask(()=>{if(current())refresh().catch(error=>{if(current())list.textContent='Bilder konnten nicht geladen werden.';onError(error.message);});});
 if(!canUpload) return clearPreviews;
 const form=document.createElement('form');
 const kindLabel=document.createElement('label');kindLabel.textContent='Dokumentart';
 const kind=document.createElement('select');
 for(const [value,label] of Object.entries(labels)) {const option=document.createElement('option');option.value=value;option.textContent=label;kind.append(option);}
 kindLabel.append(kind);
 const fileLabel=document.createElement('label');fileLabel.textContent='Bild auswählen · PNG, JPEG oder WebP, maximal 2 MiB';
 const file=document.createElement('input');file.type='file';file.accept='image/png,image/jpeg,image/webp';file.required=true;fileLabel.append(file);
 const submit=document.createElement('button');submit.type='submit';submit.textContent='Bild hochladen';
 const state=document.createElement('p');state.setAttribute('role','status');
 form.append(kindLabel,fileLabel,submit,state);panel.append(form);
 form.onsubmit=async event=>{
  event.preventDefault();
  const image=file.files?.[0];
  if(!image || image.size>2*1024*1024 || !['image/png','image/jpeg','image/webp'].includes(image.type)) {state.textContent='Bitte ein PNG-, JPEG- oder WebP-Bild mit höchstens 2 MiB auswählen.';return;}
  submit.disabled=true;state.textContent='Bild wird hochgeladen …';
  try {
   const base64=await new Promise((resolve,reject)=>{
    const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(new Error('Bild konnte nicht gelesen werden.'));reader.readAsDataURL(image);
   });
   if(!current()) return;
   await api('POST',{file_id:record.id,kind:kind.value,base64},'/api/documents');
   if(!current()) return;
   file.value='';state.textContent='Bild wurde gespeichert.';await refresh();
  } catch(error){if(current()) state.textContent=error.message;onError(error.message);}finally{submit.disabled=false;}
 };
 return clearPreviews;
}
