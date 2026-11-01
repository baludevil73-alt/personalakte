import {AccessError,authorize,recordInput} from './access.js';
const fields = 'id,first_name,last_name,notes,updated_at';
export function makeHandler({getClient,fetcher}) {
 return async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  try {
   if(!['GET','POST','PATCH'].includes(req.method)) {res.setHeader('Allow','GET, POST, PATCH');throw new AccessError(405,'Methode nicht erlaubt.');}
   if(req.headers.origin && req.headers.origin !== 'https://narco-city-akten.vercel.app') throw new AccessError(403,'Anfrage nicht erlaubt.');
   const db = getClient();
   const jwt = /^Bearer ([^\s]+)$/.exec(req.headers.authorization ?? '')?.[1];
   const access = await authorize({jwt,providerToken:req.headers['x-discord-token'],auth:db.auth,fetcher});
   // Kein Datenzugriff, bevor direkte Client-Zugriffe sicher gesperrt sind.
   const ready = await db.rpc('nc_gateway_ready');
   if(ready.error || ready.data !== true) throw new AccessError(503,'Die sichere Datenbankeinrichtung ist noch nicht abgeschlossen.');
   if(req.method === 'GET') {
    const {data,error} = await db.from('person_files').select(fields).is('deleted_at',null).order('last_name').order('id').limit(200);
    if(error) throw new Error('database');
    return res.status(200).json({role:access.role,records:data});
   }
   if(access.role !== 'editor') throw new AccessError(403,'Die Rolle Akte 2 ist zum Bearbeiten erforderlich.');
   const body = req.body;
   if(Buffer.byteLength(JSON.stringify(body ?? {})) > 100000) throw new AccessError(413,'Eingabe zu groß.');
   const payload = recordInput(body);
   let query;
   if(req.method === 'POST') {
    query = db.from('person_files').insert({...payload,created_by:access.userId,updated_by:access.userId});
   } else {
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id ?? '') ||
       typeof body.updated_at !== 'string' || !Number.isFinite(Date.parse(body.updated_at))) throw new AccessError(400,'Ungültige Aktenreferenz.');
    query = db.from('person_files').update({...payload,updated_by:access.userId}).eq('id',body.id).eq('updated_at',body.updated_at).is('deleted_at',null);
   }
   const {data,error} = await query.select('id');
   if(error) throw new Error('database');
   if(!data?.length) throw new AccessError(409,'Akte wurde inzwischen geändert. Bitte neu laden.');
   return res.status(200).json({ok:true});
  } catch(error) {
   return res.status(error instanceof AccessError ? error.status : 503).json({error:error instanceof AccessError ? error.message : 'Verbindung fehlgeschlagen. Es wurden keine Daten freigegeben.'});
  }
 };
}
