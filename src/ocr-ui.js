import {createLocalRecognizer} from './ocr-engine.js';
import {parseIdentityText} from './ocr-parse.js';
const fields=[['first_name','Vorname'],['last_name','Nachname'],['birth_date','Geburtsdatum'],['identity_number','Ausweisnummer']];
export const ocrMarkup=`<section class="ocr-panel"><h3>Ausweis auslesen</h3><p>Ein scharfes, zugeschnittenes Ausweisbild auswählen. Die Erkennung läuft im Browser; beim ersten Start werden Sprachdateien geladen. Vorschläge vor dem Speichern prüfen.</p><label>Ausweisbild<input id="ocrFile" type="file" accept="image/png,image/jpeg,image/webp"></label><div class="actions"><button id="ocrStart" type="button">Text erkennen</button><button id="ocrCancel" type="button" hidden>Abbrechen</button></div><p id="ocrStatus" role="status" aria-live="polite"></p><div id="ocrResults" hidden><h4>Erkannte Angaben prüfen</h4><p>Nur markierte Angaben werden übernommen. Bereits ausgefüllte Felder werden nur nach Bestätigung überschrieben.</p><div class="field-grid">${fields.map(([field,label])=>`<div><label class="ocr-check"><input id="ocrUse_${field}" type="checkbox">${label} übernehmen</label><input id="ocrValue_${field}" aria-label="Erkannter Wert: ${label}" type="${field==='birth_date'?'date':'text'}" maxlength="160"></div>`).join('')}</div><button id="ocrApply" type="button">Ausgewählte Angaben übernehmen</button><details><summary>Erkannten Text prüfen</summary><textarea id="ocrText" readonly rows="7" aria-label="Erkannter Text"></textarea></details></div></section>`;
export function createOcrView({isAllowed,onApply}){
 const el=id=>document.getElementById(id),recognizer=createLocalRecognizer();let version=0;
 function clear(){version++;recognizer.cancel();el('ocrFile').value='';el('ocrResults').hidden=true;el('ocrText').value='';el('ocrStatus').textContent='';el('ocrStart').disabled=false;el('ocrCancel').hidden=true;for(const [field] of fields){el('ocrValue_'+field).value='';el('ocrUse_'+field).checked=false;}}
 async function recognize(image){
  if(!isAllowed())return;
  clear();const request=version;
  if(!image || image.size>2*1024*1024 || !['image/png','image/jpeg','image/webp'].includes(image.type)){el('ocrStatus').textContent='Bitte ein PNG-, JPEG- oder WebP-Bild mit höchstens 2 MiB auswählen.';return;}
  el('ocrStart').disabled=true;el('ocrCancel').hidden=false;el('ocrStatus').textContent='Texterkennung wird vorbereitet …';
  try{
   const result=await recognizer.recognize(image,(stage,progress)=>{
    if(request!==version)return;
    el('ocrStatus').textContent=stage==='recognizing text'?'Text wird erkannt · '+Math.round(progress*100)+' %':'Texterkennung und Sprachdateien werden vorbereitet …';
   });
   if(request!==version || !isAllowed())return;
   const values=parseIdentityText(result.text);
   for(const [field] of fields){el('ocrValue_'+field).value=values[field] ?? '';el('ocrUse_'+field).checked=!!values[field];}
   el('ocrText').value=result.text;el('ocrResults').hidden=false;
   el('ocrStatus').textContent=Object.keys(values).length?'Vorschläge erkannt. Bitte mit dem Ausweis vergleichen und gegebenenfalls korrigieren.':'Keine Angaben sicher zugeordnet. Bitte den erkannten Text prüfen und die Felder manuell ausfüllen.';
  }catch(error){if(request===version)el('ocrStatus').textContent=error.name==='AbortError'?'Erkennung abgebrochen.':'Erkennung fehlgeschlagen. Internetverbindung prüfen oder ein schärferes, zugeschnittenes Bild verwenden.';}
  finally{if(request===version){el('ocrStart').disabled=false;el('ocrCancel').hidden=true;}}
 }
 el('ocrStart').onclick=()=>recognize(el('ocrFile').files?.[0]);
 el('ocrCancel').onclick=()=>{clear();el('ocrStatus').textContent='Erkennung abgebrochen.';};
 el('ocrFile').onchange=()=>{version++;recognizer.cancel();el('ocrResults').hidden=true;el('ocrText').value='';el('ocrStatus').textContent='';el('ocrStart').disabled=false;el('ocrCancel').hidden=true;};
 el('ocrApply').onclick=()=>{
  if(!isAllowed())return;
  const values={};for(const [field] of fields)if(el('ocrUse_'+field).checked && el('ocrValue_'+field).value.trim())values[field]=el('ocrValue_'+field).value.trim();
  const changed=Object.entries(values).filter(([field,value])=>el(field).value && el(field).value!==value);
  if(changed.length && !confirm('Vorhandene Angaben in '+changed.length+' Feldern durch die geprüften Vorschläge ersetzen?'))return;
  onApply(values);el('ocrStatus').textContent='Angaben ins Formular übernommen. Bitte prüfen und mit Speichern bestätigen.';
 };
 return {clear,recognize};
}
