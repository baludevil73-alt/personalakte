import {parseIdentityText} from './ocr-parse.js';
export const narcoRegions=[
 {key:'identity_number',x:.715,y:.025,width:.28,height:.085,channel:0,label:'Ausweisnummer'},
 {key:'full_name',x:.375,y:.26,width:.60,height:.105,channel:1,label:'Namenszeile'},
 {key:'birth_date',x:.385,y:.515,width:.20,height:.095,channel:0,label:'Geburtsdatum'},
 {key:'gender',x:.58,y:.515,width:.14,height:.095,channel:0,label:'Geschlecht'},
 {key:'height_cm',x:.715,y:.515,width:.14,height:.095,channel:0,label:'Körpergröße'}
];
export function regionValue(key,text){
 const value=(text || '').normalize('NFKC').replace(/\s+/g,' ').trim();
 if(key==='identity_number'){
  const match=value.toUpperCase().replace(/\s/g,'').match(/SV[0-9OIL]{8}(?!\d)/);
  return match?match[0].replace(/O/g,'0').replace(/[IL]/g,'1'):'';
 }
 if(key==='birth_date'){
  const compact=value.replace(/\s/g,'');
  const date=/^\d{8}$/.test(compact)?compact.slice(0,2)+'.'+compact.slice(2,4)+'.'+compact.slice(4):value;
  return parseIdentityText('Geburtsdatum: '+date).birth_date ?? '';
 }
 if(key==='full_name')return /^[\p{L}\p{M}][\p{L}\p{M}'’.-]+ [\p{L}\p{M}][\p{L}\p{M}'’.-]+$/u.test(value)?value:'';
 if(key==='gender'){
  if(/^(FEMALE|WEIBLICH|F|W)$/i.test(value))return 'Weiblich';
  if(/^(MALE|M[ÄA]NNLICH|M)$/i.test(value))return 'Männlich';
  if(/^(DIVERS|D)$/i.test(value))return 'Divers';
  return '';
 }
 if(key==='height_cm'){
  const match=value.match(/^(\d{2,3})(?:\s*cm)?$/i);return match&&Number(match[1])>=50&&Number(match[1])<=250?String(Number(match[1])):'';
 }
 return '';
}
export function narcoSuggestions(results){
 const values={};
 for(const key of ['identity_number','birth_date','gender','height_cm']){
  const candidate=results[key];if(!candidate || (Number.isFinite(candidate.confidence)&&candidate.confidence<40))continue;
  const value=regionValue(key,candidate.text);if(value)values[key]=key==='height_cm'?Number(value):value;
 }
 const name=results.full_name;
 if(name && (!Number.isFinite(name.confidence)||name.confidence>=50)){
  const value=regionValue('full_name',name.text);
  if(value){const [first,last]=value.split(' ');values.first_name=first;values.last_name=last;}
 }
 return values;
}
