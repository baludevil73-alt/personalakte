const labels={
 first_name:'(?:Vorname(?:n)?|First\\s*name|Given\\s*names?)',
 last_name:'(?:Nachname|Familienname|Surname|Last\\s*name)',
 birth_date:'(?:Geburtsdatum|Geburtstag|Geboren(?:\\s+am)?|Date\\s+of\\s+birth|DOB)',
 identity_number:'(?:Ausweis(?:nummer|[- ]?Nr\\.?)|Dokument(?:en)?nummer|Identit[aä]tsnummer|ID[- ]?(?:Nummer|No\\.?|Number)|Document\\s+(?:No\\.?|Number))'
};
const anyLabel=new RegExp('^\\s*(?:'+Object.values(labels).join('|')+')\\s*[:|]?\\s*$','i');
function dateValue(value){
 let match=value.match(/\b(\d{4})-(\d{2})-(\d{2})\b/),date;
 if(match)date=match[1]+'-'+match[2]+'-'+match[3];
 else{match=value.match(/\b(\d{1,2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{4})\b/);if(match)date=match[3]+'-'+match[2].padStart(2,'0')+'-'+match[1].padStart(2,'0');}
 if(!date || date.startsWith('0000'))return '';
 const parsed=new Date(date+'T00:00:00Z');return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===date?date:'';
}
export function parseIdentityText(text){
 if(typeof text!=='string')return {};
 const lines=text.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g,'').replace(new RegExp('[ \\t]+(?=(?:'+Object.values(labels).join('|')+')\\s*:)','gi'),'\n').split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
 const values={};
 for(const [field,label] of Object.entries(labels)){
  const pattern=new RegExp('^'+label+'(?:\\s*[:|]\\s*|\\s+|$)(.*)$','i');
  for(let index=0;index<lines.length;index++){
   const match=lines[index].match(pattern);if(!match)continue;
   let value=match[1].trim();
   if(!value && lines[index+1] && !anyLabel.test(lines[index+1]))value=lines[index+1];
   value=value.split(new RegExp('\\s+(?=(?:'+Object.values(labels).join('|')+')\\s*:)','i'))[0].trim();
   if(field==='birth_date')value=dateValue(value);
   else if(field==='identity_number'){
    value=value.replace(/\s+/g,'');if(!/^[A-Za-z0-9][A-Za-z0-9/-]{1,159}$/.test(value))value='';
   }else{
    value=value.replace(/^["'“”]+|["'“”]+$/g,'').trim();
    if(value.length>160 || !/^[\p{L}\p{M}][\p{L}\p{M} .'’\-]*$/u.test(value))value='';
   }
   if(value){values[field]=value;break;}
  }
 }
 return values;
}
