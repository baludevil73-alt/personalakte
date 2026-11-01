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
   if(field==='birth_date'){
    value=/G[ÜU]LTIG|EXPIR|VALID|ISSUED|AUSGESTELLT|ABLAUF/i.test(value)?'':dateValue(value);
    if(!value)for(let next=index+1;next<=Math.min(index+3,lines.length-1);next++){if(/G[ÜU]LTIG|EXPIR|VALID|ISSUED|AUSGESTELLT|ABLAUF/i.test(lines[next]))break;value=dateValue(lines[next]);if(value)break;}
   }
   else if(field==='identity_number'){
    value=value.replace(/\s+/g,'');if(!/^[A-Za-z0-9][A-Za-z0-9/-]{1,159}$/.test(value))value='';
   }else{
    value=value.replace(/^["'“”]+|["'“”]+$/g,'').trim();
    if(value.length>160 || /\b(?:SURNAME|GIVEN|PR[ÉE]NOMS?|NAISSANCE|DATE|BIRTH|NOM|NAME|VORNAME|NACHNAME)\b/i.test(value) || !/^[\p{L}\p{M}][\p{L}\p{M} .'’\-]*$/u.test(value))value='';
   }
   if(value){values[field]=value;break;}
  }
 }
 // Gezeigte Narco-City-Karte: kombinierte Namenszeile und Nummer SV + acht Ziffern.
 const card=lines.some(line=>/NARCO\s*CITY|GIVEN\s*NAMES|PR[ÉE]NOMS|SURNAME|DATE\s*DE\s*NAISSANCE/i.test(line));
 if(card){
  if(!values.identity_number){const number=text.toUpperCase().match(/\bSV[0-9OIl]{8}\b/i);if(number)values.identity_number=number[0].toUpperCase().replace(/O/g,'0').replace(/[IL]/g,'1');}
  if(!values.last_name){
   const index=lines.findIndex(line=>/VORNAME|GIVEN\s*NAMES|PR[ÉE]NOMS/i.test(line));
   if(index>=0){
    for(const line of lines.slice(index+1,index+4)){
     if(/GEBURT|BIRTH|NAISSANCE|GESCHLECHT|GR[ÖO]SSE|SURNAME|VORNAME|GIVEN|SIGNATURE|UNTERSCHRIFT/i.test(line))continue;
     const names=line.match(/^([\p{L}\p{M}][\p{L}\p{M}'’.-]*)\s+([\p{L}\p{M}][\p{L}\p{M}'’.-]*)$/u);
     if(names && (!values.first_name || values.first_name===line)){values.first_name=names[1];values.last_name=names[2];break;}
    }
   }
  }
 }
 return values;
}
