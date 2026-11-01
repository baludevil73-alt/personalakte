import {createLocalRecognizer} from './ocr-engine.js';
import {parseIdentityText} from './ocr-parse.js';
const fields=[['first_name','Vorname'],['last_name','Nachname'],['birth_date','Geburtsdatum'],['identity_number','Ausweisnummer'],['gender','Geschlecht'],['height_cm','Körpergröße']];
function suggestionInput(field,label){
 const attributes=`id="ocrValue_${field}" aria-label="Erkannter Wert: ${label}"`;
 if(field==='gender')return `<select ${attributes}><option value="">Keine Angabe</option><option>Männlich</option><option>Weiblich</option><option>Divers</option></select>`;
 if(field==='height_cm')return `<select ${attributes}><option value="">Keine Angabe</option>${Array.from({length:201},(_,i)=>`<option value="${i+50}">${i+50} cm</option>`).join('')}</select>`;
 return `<input ${attributes} type="${field==='birth_date'?'date':'text'}" maxlength="160">`;
}
export const ocrMarkup=`<section class="ocr-panel"><h3>Ausweis auslesen</h3><p>Ein scharfes, zugeschnittenes Ausweisbild auswählen. Die Erkennung läuft im Browser; beim ersten Start werden Sprachdateien geladen. Vorschläge vor dem Speichern prüfen.</p><label>Ausweisvorlage<select id="ocrTemplate"><option value="narco">Narco City · gezeigte Karte</option><option value="whole">Andere Vorlage · vollständiges Bild</option></select></label><label>Ausweisbild<input id="ocrFile" type="file" accept="image/png,image/jpeg,image/webp"></label><div class="actions"><button id="ocrStart" type="button">Text erkennen</button><button id="ocrCancel" type="button" hidden>Erkennung abbrechen</button></div><p id="ocrStatus" role="status" aria-live="polite"></p><div id="ocrResults" hidden><h4>Erkannte Angaben prüfen</h4><p>Nur markierte Angaben werden übernommen. Bereits ausgefüllte Felder werden nur nach Bestätigung überschrieben.</p><div class="field-grid">${fields.map(([field,label])=>`<div><label class="ocr-check"><input id="ocrUse_${field}" type="checkbox">${label} übernehmen</label>${suggestionInput(field,label)}</div>`).join('')}</div><button id="ocrApply" type="button">Ausgewählte Angaben übernehmen</button><details><summary>Erkannten Text prüfen</summary><textarea id="ocrText" readonly rows="7" aria-label="Erkannter Text"></textarea></details></div></section>`;
export function createOcrView({isAllowed,onApply}){
 const el=id=>document.getElementById(id),recognizer=createLocalRecognizer();let version=0;
 function clear(keepFile=false){version++;recognizer.cancel();if(!keepFile)el('ocrFile').value='';el('ocrResults').hidden=true;el('ocrText').value='';el('ocrStatus').textContent='';el('ocrStart').disabled=false;el('ocrCancel').hidden=true;for(const [field] of fields){el('ocrValue_'+field).value='';el('ocrUse_'+field).checked=false;}}
 async function recognize(image){
  if(!isAllowed())return;
  clear(true);const request=version;
  if(!image || image.size>2*1024*1024 || !['image/png','image/jpeg','image/webp'].includes(image.type)){el('ocrStatus').textContent='Bitte ein PNG-, JPEG- oder WebP-Bild mit höchstens 2 MiB auswählen.';return;}
  el('ocrStart').disabled=true;el('ocrCancel').hidden=false;el('ocrStatus').textContent='Texterkennung wird vorbereitet …';
  try{
   const result=await recognizer.recognize(image,(stage,progress)=>{
    if(request!==version)return;
    el('ocrStatus').textContent=stage==='preparing image'?'Bild wird vergrößert und der Kontrast angepasst …':stage==='second pass'?'Zweiter Erkennungsversuch für das Kartenlayout …':stage==='recognizing text'?'Text wird erkannt · '+Math.round(progress*100)+' %':'Texterkennung und Sprachdateien werden vorbereitet …';
   },{template:el('ocrTemplate').value});
   if(request!==version || !isAllowed())return;
   const values=result.values ?? parseIdentityText(result.text);
   for(const [field] of fields){el('ocrValue_'+field).value=values[field] ?? '';el('ocrUse_'+field).checked=!!values[field];}
   el('ocrText').value=result.text;el('ocrResults').hidden=false;
   el('ocrStatus').textContent=Object.keys(values).length?'Vorschläge erkannt. Bitte mit dem Ausweis vergleichen und gegebenenfalls korrigieren.':result.text.trim()?'Text erkannt, aber keine Felder sicher zugeordnet. Bitte den erkannten Text prüfen.':'Kein Text erkannt. Bitte nur den Ausweis ausschneiden und ein schärferes Bild verwenden.';
  }catch(error){if(request===version)el('ocrStatus').textContent=error.name==='AbortError'?'Erkennung abgebrochen.':'Erkennung fehlgeschlagen. Internetverbindung prüfen oder ein schärferes, zugeschnittenes Bild verwenden.';}
  finally{if(request===version){el('ocrStart').disabled=false;el('ocrCancel').hidden=true;}}
 }
 el('ocrStart').onclick=()=>recognize(el('ocrFile').files?.[0]);
 el('ocrCancel').onclick=()=>{clear();el('ocrStatus').textContent='Erkennung abgebrochen.';};
 el('ocrTemplate').onchange=()=>clear(true);
 el('ocrFile').onchange=()=>{version++;recognizer.cancel();el('ocrResults').hidden=true;el('ocrText').value='';el('ocrStatus').textContent='';el('ocrStart').disabled=false;el('ocrCancel').hidden=true;};
 el('ocrApply').onclick=()=>{
  if(!isAllowed())return;
  const values={};for(const [field] of fields)if(el('ocrUse_'+field).checked && el('ocrValue_'+field).value.trim())values[field]=el('ocrValue_'+field).value.trim();
  if(!Object.keys(values).length){el('ocrStatus').textContent='Keine Angaben übernommen: Bitte zuerst einen erkannten Wert eintragen und markieren.';return;}
  const changed=Object.entries(values).filter(([field,value])=>el(field).value && el(field).value!==value);
  if(changed.length && !confirm('Vorhandene Angaben in '+changed.length+' Feldern durch die geprüften Vorschläge ersetzen?'))return;
  onApply(values);const count=Object.keys(values).length;el('ocrStatus').textContent=count+(count===1?' Angabe wurde':' Angaben wurden')+' ins Formular übernommen. Bitte prüfen und mit Speichern bestätigen.';
 };
 return {clear,recognize};
}
