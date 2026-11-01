export function renderRecordList(container,records,onOpen) {
 container.replaceChildren();
 if(!records.length){const empty=document.createElement('p');empty.textContent='Keine passenden Akten gefunden.';container.append(empty);return;}
 const list=document.createElement('ul');list.className='records-overview';
 for(const record of records){
  const row=document.createElement('li');const info=document.createElement('div');
  const title=document.createElement('h2');const name=[record.first_name,record.last_name].filter(Boolean).join(' ') || 'Ohne Namen';title.textContent=name;
  const number=document.createElement('p');number.textContent=record.identity_number?'Ausweisnummer: '+record.identity_number:'Keine Ausweisnummer';
  const open=document.createElement('button');open.type='button';open.textContent='Akte öffnen';open.setAttribute('aria-label','Akte von '+name+' öffnen');open.onclick=()=>onOpen(record.id);
  info.append(title,number);row.append(info,open);list.append(row);
 }
 container.append(list);
}
