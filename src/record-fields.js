const heightOptions = Array.from({length:201},(_,index)=>{
 const cm=index+50;return `<option value="${cm}">${cm} cm</option>`;
}).join('');
export const detailsForm = `<div class="field-grid"><label>Geburtsdatum<input id="birth_date" type="date" min="0001-01-01" max="9999-12-31"></label><label>Geschlecht<select id="gender"><option value="">Keine Angabe</option><option value="Männlich">Männlich</option><option value="Weiblich">Weiblich</option><option value="Divers">Divers</option></select></label><label>Körpergröße<select id="height_cm"><option value="">Keine Angabe</option>${heightOptions}</select></label><label>Ausweisnummer<input id="identity_number" maxlength="160" autocomplete="off" placeholder="Optional"></label></div>`;
export function setDetailValue(control,value) {
 const saved=value==null?'':String(value);
 if(control.tagName==='SELECT') {
  for(const option of [...control.options]) if(option.dataset.saved==='true') option.remove();
  // Frühere Freitextangaben nicht durch einen leeren Auswahlwert verlieren.
  if(saved && ![...control.options].some(option=>option.value===saved)) {
   const option=control.ownerDocument.createElement('option');
   option.value=saved;option.textContent=saved+' (gespeichert)';option.dataset.saved='true';control.append(option);
  }
 }
 control.value=saved;
}
export function detailsPayload(getValue) {
 return {
  birth_date:getValue('birth_date') || null,
  gender:getValue('gender'),identity_number:getValue('identity_number'),
  height_cm:getValue('height_cm')===''?null:Number(getValue('height_cm'))
 };
}
export function recordDetails(record) {
 const date=record.birth_date;
 return [
  ['Geburtsdatum',date && /^\d{4}-\d{2}-\d{2}$/.test(date)?date.slice(8,10)+'.'+date.slice(5,7)+'.'+date.slice(0,4):date],
  ['Geschlecht',record.gender],['Körpergröße',record.height_cm==null?null:record.height_cm+' cm'],
  ['Ausweisnummer',record.identity_number]
 ].filter(([,value])=>value!==null && value!==undefined && value!=='');
}
export function matchesRecord(record,search) {
 return [record.first_name,record.last_name,record.identity_number].filter(Boolean).join(' ').toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de'));
}
