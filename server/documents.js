import {randomUUID} from 'node:crypto';
import {AccessError,authorize} from './access.js';
export const bucket = 'personal-documents';
export const maxBytes = 2 * 1024 * 1024;
export const kinds = ['profile','identity','driver_license','firearm_license','other'];
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function imageType(bytes) {
 if(bytes.length >= 24 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return {mime:'image/png',ext:'png'};
 if(bytes.length >= 4 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255) return {mime:'image/jpeg',ext:'jpg'};
 if(bytes.length >= 12 && bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP') return {mime:'image/webp',ext:'webp'};
 throw new AccessError(400,'Nur PNG-, JPEG- und WebP-Bilder sind erlaubt.');
}
export function uploadInput(body) {
 if(!body || !uuid(body.file_id) || !kinds.includes(body.kind) || typeof body.base64 !== 'string') throw new AccessError(400,'Ungültige Dokumentangaben.');
 if(body.base64.length > Math.ceil(maxBytes/3)*4) throw new AccessError(413,'Das Bild darf höchstens 2 MiB groß sein.');
 if(!body.base64 || body.base64.length%4!==0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(body.base64)) throw new AccessError(400,'Ungültige Bilddaten.');
 const bytes=Buffer.from(body.base64,'base64');
 if(bytes.toString('base64')!==body.base64) throw new AccessError(400,'Ungültige Bilddaten.');
 if(!bytes.length || bytes.length>maxBytes) throw new AccessError(413,'Das Bild darf höchstens 2 MiB groß sein.');
 return {bytes,...imageType(bytes),fileId:body.file_id,kind:body.kind};
}
export function makeDocumentsHandler({getClient,fetcher}) {
 return async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  try {
   if(!['GET','POST'].includes(req.method)) {res.setHeader('Allow','GET, POST');throw new AccessError(405,'Methode nicht erlaubt.');}
   if(req.headers.origin && req.headers.origin !== 'https://narco-city-akten.vercel.app') throw new AccessError(403,'Anfrage nicht erlaubt.');
   const db=getClient();
   const jwt=/^Bearer ([^\s]+)$/.exec(req.headers.authorization ?? '')?.[1];
   const access=await authorize({jwt,providerToken:req.headers['x-discord-token'],auth:db.auth,fetcher});
   for(const functionName of ['nc_gateway_ready','nc_documents_ready']) {
    const ready=await db.rpc(functionName);
    if(ready.error || ready.data !== true) throw new AccessError(503,'Die sichere Dokumentablage ist noch nicht eingerichtet.');
   }
   const storage=db.storage.from(bucket);
   if(req.method==='POST') {
    if(access.role !== 'editor') throw new AccessError(403,'Zum Hochladen ist Akte 2 erforderlich.');
    const input=uploadInput(req.body);
    const record=await db.from('person_files').select('id').eq('id',input.fileId).is('deleted_at',null).maybeSingle();
    if(record.error) throw new Error('database');
    if(!record.data) throw new AccessError(404,'Akte nicht gefunden.');
    // Zufälliger Pfad ohne Personennamen; kein Überschreiben vorhandener Objekte.
    const path=`${input.fileId}/${randomUUID()}.${input.ext}`;
    const uploaded=await storage.upload(path,input.bytes,{contentType:input.mime,upsert:false,cacheControl:'0'});
    if(uploaded.error) throw new Error('storage');
    const inserted=await db.from('file_documents').insert({file_id:input.fileId,kind:input.kind,storage_path:path,uploaded_by:access.userId}).select('id');
    if(inserted.error || !inserted.data?.length) {
     // Nur das gerade durch diese Anfrage erzeugte Objekt aufräumen.
     await storage.remove([path]);
     throw new Error('database');
    }
    return res.status(201).json({ok:true});
   }
   const documentId=req.query?.document_id;
   const fileId=req.query?.file_id;
   if(documentId) {
    if(!uuid(documentId)) throw new AccessError(400,'Ungültige Dokumentreferenz.');
    const document=await db.from('file_documents').select('id,file_id,kind,storage_path').eq('id',documentId).maybeSingle();
    if(document.error) throw new Error('database');
    if(!document.data) throw new AccessError(404,'Dokument nicht gefunden.');
    const record=await db.from('person_files').select('id').eq('id',document.data.file_id).is('deleted_at',null).maybeSingle();
    if(record.error) throw new Error('database');
    if(!record.data) throw new AccessError(404,'Akte nicht gefunden.');
    const info=await storage.info(document.data.storage_path);
    if(info.error) throw new Error('storage');
    if(!Number.isFinite(info.data?.size) || info.data.size>maxBytes) throw new AccessError(413,'Dieses Bestandsdokument überschreitet das Downloadlimit von 2 MiB.');
    const downloaded=await storage.download(document.data.storage_path);
    if(downloaded.error) throw new Error('storage');
    if(downloaded.data.size>maxBytes) throw new AccessError(413,'Dokument zu groß.');
    const bytes=Buffer.from(await downloaded.data.arrayBuffer());
    const type=imageType(bytes);
    // Kein Signed Link: jeder Download muss die aktuelle Discord-Prüfung bestehen.
    res.setHeader('Content-Type',type.mime);
    res.setHeader('Content-Disposition',`attachment; filename="dokument-${documentId}.${type.ext}"`);
    res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox");
    return res.status(200).send(bytes);
   }
   if(!uuid(fileId)) throw new AccessError(400,'Ungültige Aktenreferenz.');
   const record=await db.from('person_files').select('id').eq('id',fileId).is('deleted_at',null).maybeSingle();
   if(record.error) throw new Error('database');
   if(!record.data) throw new AccessError(404,'Akte nicht gefunden.');
   const result=await db.from('file_documents').select('id,kind,created_at').eq('file_id',fileId).order('created_at',{ascending:false}).limit(100);
   if(result.error) throw new Error('database');
   return res.status(200).json({documents:result.data});
  } catch(error) {
   return res.status(error instanceof AccessError ? error.status : 503).json({error:error instanceof AccessError ? error.message : 'Dokumentzugriff fehlgeschlagen. Bitte später erneut versuchen.'});
  }
 };
}
