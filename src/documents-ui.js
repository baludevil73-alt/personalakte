const labels={profile:'Profilbild',identity:'Ausweis',driver_license:'Führerschein',firearm_license:'Waffenschein',other:'Sonstiges'};
export function attachDocuments(article,record,{api,canUpload,onError,isCurrent}) {
 const toggle=document.createElement('button');toggle.textContent='Dokumente';
 const panel=document.createElement('section');panel.hidden=true;panel.className='documents';
 const list=document.createElement('div');
 const heading=document.createElement('h3');heading.textContent='Bilder und Dokumente';panel.append(heading,list);
 article.append(toggle,panel);
 const current=()=>article.isConnected && isCurrent();
 async function refresh() {
  list.textContent='Dokumente werden geladen …';
  const data=await api('GET',undefined,'/api/documents?file_id='+encodeURIComponent(record.id));
  if(!current()) return;
  list.replaceChildren();
  if(!data.documents.length) list.textContent='Noch keine Dokumente vorhanden.';
  for(const item of data.documents) {
   const row=document.createElement('p');
   const name=document.createElement('span');name.textContent=(labels[item.kind] ?? 'Dokument')+' · '+new Date(item.created_at).toLocaleDateString('de-DE')+' ';
   const download=document.createElement('button');download.type='button';download.textContent='Herunterladen';
   download.onclick=async()=>{
    download.disabled=true;
    try {
     const blob=await api('GET',undefined,'/api/documents?document_id='+encodeURIComponent(item.id),true);
     if(!current()) return;
     const url=URL.createObjectURL(blob),link=document.createElement('a');
     const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[blob.type] ?? 'bin';
     link.href=url;link.download='dokument-'+item.id+'.'+ext;link.click();
     setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch(error){onError(error.message);}finally{download.disabled=false;}
   };
   row.append(name,download);list.append(row);
  }
 }
 toggle.onclick=async()=>{
  panel.hidden=!panel.hidden;
  if(panel.hidden) return;
  toggle.disabled=true;
  try{await refresh();}catch(error){if(current()) list.textContent='Dokumente konnten nicht geladen werden.';onError(error.message);}finally{toggle.disabled=false;}
 };
 if(!canUpload) return;
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
}
