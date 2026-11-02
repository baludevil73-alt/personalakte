import {recordDetails} from './record-fields.js';
export function createRecordSheet(record) {
 const article=document.createElement('article');article.className='dossier';
 const hero=document.createElement('div');hero.className='dossier-hero';
 const identity=document.createElement('div');identity.className='dossier-identity';
 const eyebrow=document.createElement('p');eyebrow.className='eyebrow';eyebrow.textContent='NARCO CITY · PERSONENAKTE';
 const title=document.createElement('h2');title.textContent=[record.first_name,record.last_name].filter(Boolean).join(' ') || 'Ohne Namen';
 const reference=document.createElement('p');reference.className='dossier-reference';reference.textContent=record.identity_number?'Ausweisnummer · '+record.identity_number:'Ausweisnummer nicht hinterlegt';
 identity.append(eyebrow,title,reference);
 const seal=document.createElement('div');seal.className='dossier-seal';seal.setAttribute('aria-hidden','true');
 seal.textContent=([...(record.first_name || '')][0] || '')+([...(record.last_name || '')][0] || '') || 'NC';
 hero.append(identity,seal);
 const actions=document.createElement('div');actions.className='dossier-actions';
 const dataSection=document.createElement('section');dataSection.className='dossier-data';
 const heading=document.createElement('h3');heading.className='section-title';heading.textContent='Personendaten';
 const details=document.createElement('dl');details.className='record-details';
 const formatted=new Map(recordDetails(record));
 for(const [label,value] of [['Vorname',record.first_name],['Nachname',record.last_name],['Geburtsdatum',formatted.get('Geburtsdatum')],['Geschlecht',record.gender],['Körpergröße',formatted.get('Körpergröße')],['Ausweisnummer',record.identity_number]]) {
  const field=document.createElement('div');field.className='record-field';
  const term=document.createElement('dt'),description=document.createElement('dd');term.textContent=label;
  description.textContent=value==null || value===''?'Nicht hinterlegt':String(value);if(value==null || value==='')description.className='empty-value';
  field.append(term,description);details.append(field);
 }
 dataSection.append(heading,details);
 const notesSection=document.createElement('section');notesSection.className='dossier-notes';
 const notesTitle=document.createElement('h3');notesTitle.className='section-title';notesTitle.textContent='Notizen und Vermerke';
 const notes=document.createElement('p');notes.className='notes';notes.textContent=record.notes || 'Keine Vermerke hinterlegt.';notesSection.append(notesTitle,notes);
 article.append(hero,actions,dataSection,notesSection);
 return {article,actions};
}
