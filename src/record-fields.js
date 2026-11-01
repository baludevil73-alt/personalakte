export const detailsForm = `<div class="field-grid"><label>Geburtsdatum<input id="birth_date" type="date" min="0001-01-01" max="9999-12-31"></label><label>Geschlecht<input id="gender" maxlength="80" autocomplete="off" placeholder="Optional"></label><label>Körpergröße in cm<input id="height_cm" type="number" min="50" max="250" step="1" placeholder="50–250"></label><label>Ausweisnummer<input id="identity_number" maxlength="160" autocomplete="off" placeholder="Optional"></label></div>`;
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
