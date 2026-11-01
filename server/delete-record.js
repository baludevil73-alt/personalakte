import {AccessError} from './access.js';
export async function deleteRecord({db,recordId,actor}) {
 if(typeof recordId!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recordId)) throw new AccessError(400,'Ungültige Aktenreferenz.');
 const ready=await db.rpc('nc_documents_ready');
 if(ready.error || ready.data!==true) throw new AccessError(503,'Die sichere Dokumentablage ist nicht eingerichtet.');
 const prepared=await db.rpc('nc_record_delete_prepare',{p_record_id:recordId,p_actor:actor});
 if(prepared.error) throw new AccessError(503,'Die Akten-Löschfunktion ist noch nicht eingerichtet oder das Protokoll nicht erreichbar. Es wurde keine Datei gelöscht.');
 if(!prepared.data) throw new AccessError(404,'Akte nicht gefunden. Bitte neu laden.');
 const paths=prepared.data.paths;
 if(!Array.isArray(paths) || paths.some(path=>typeof path!=='string' || !path)) throw new Error('invalid storage references');
 const storage=db.storage.from('personal-documents');
 for(let offset=0;offset<paths.length;offset+=100) {
  const removed=await storage.remove(paths.slice(offset,offset+100));
  if(removed.error) throw new AccessError(503,'Die Bilder konnten nicht vollständig gelöscht werden. Die Akte bleibt vorhanden. Bitte die Löschung erneut versuchen.');
 }
 const finished=await db.rpc('nc_record_delete_finish',{p_record_id:recordId,p_actor:actor,p_expected_paths:paths});
 if(finished.error) throw new AccessError(503,'Die Bilder wurden entfernt, die Akte konnte noch nicht gelöscht werden. Bitte die Löschung erneut versuchen.');
 if(finished.data!==true) throw new AccessError(409,'Während der Löschung wurde ein neues Bild hinzugefügt. Bitte die Akte erneut löschen, um auch dieses Bild zu entfernen.');
}
