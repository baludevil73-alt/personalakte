import {AccessError,authorize} from './access.js';
const uuid=value=>typeof value==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)?value:null;
export function auditEntry(row) {
 const details=row.details && typeof row.details==='object'?row.details:{};
 const phase=['requested','completed'].includes(details.phase)?details.phase:null;
 let action='other';
 if(details.operation==='document_delete') action=phase==='requested'?'document_delete_requested':phase==='completed'?'document_deleted':'other';
 else if(details.operation==='record_delete') action=phase==='requested'?'record_delete_requested':phase==='completed'?'record_deleted':'other';
 else if(details.operation==='document_upload') action='document_uploaded';
 else action=row.action==='INSERT'?'record_created':row.action==='UPDATE'?'record_updated':row.action==='DELETE'?'record_deleted':'other';
 return {
  id:String(row.id),created_at:row.created_at,actor:uuid(row.actor),
  record_id:uuid(row.file_id) ?? uuid(details.deleted_record_id) ?? uuid(details.record_id),
  document_id:uuid(details.document_id),
  kind:['profile','identity','driver_license','firearm_license','other'].includes(details.kind)?details.kind:null,
  action
 };
}
export function makeAuditHandler({getClient,fetcher,cacheFor}) {
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{
   if(req.method!=='GET'){res.setHeader('Allow','GET');throw new AccessError(405,'Methode nicht erlaubt.');}
   if(req.headers.origin && req.headers.origin!=='https://narco-city-akten.vercel.app') throw new AccessError(403,'Anfrage nicht erlaubt.');
   const db=getClient();
   const jwt=/^Bearer ([^\s]+)$/.exec(req.headers.authorization ?? '')?.[1];
   const access=await authorize({jwt,providerToken:req.headers['x-discord-token'],auth:db.auth,fetcher,cache:cacheFor?.(db)});
   if(access.role!=='editor') throw new AccessError(403,'Das Änderungsprotokoll ist nur mit Akte 2 verfügbar.');
   const ready=await db.rpc('nc_gateway_ready');
   if(ready.error || ready.data!==true) throw new AccessError(503,'Die sichere Datenbankeinrichtung ist noch nicht abgeschlossen.');
   const {data,error}=await db.from('audit_events').select('id,actor,file_id,action,details,created_at').order('created_at',{ascending:false}).order('id',{ascending:false}).limit(100);
   if(error) throw new AccessError(503,'Das Protokoll konnte nicht geladen werden. Bitte die Protokoll-Einrichtung prüfen.');
   return res.status(200).json({entries:data.map(auditEntry)});
  }catch(error){
   if(error.retryAfter) res.setHeader('Retry-After',String(error.retryAfter));
   return res.status(error instanceof AccessError?error.status:503).json({error:error instanceof AccessError?error.message:'Protokollzugriff fehlgeschlagen.',...(error.retryAfter?{retryAfter:error.retryAfter}:{})});
  }
 };
}
