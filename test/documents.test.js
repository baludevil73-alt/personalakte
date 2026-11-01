import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeDocumentsHandler,uploadInput,maxBytes} from '../server/documents.js';
const fileId='00000000-0000-0000-0000-000000000001',docId='00000000-0000-0000-0000-000000000002';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const body={file_id:fileId,kind:'identity',base64:png.toString('base64')};
test('Bildformat, Größe, Art und Pfad werden serverseitig geprüft',()=>{
 assert.equal(uploadInput(body).mime,'image/png');
 for(const value of [{...body,file_id:'../path'},{...body,kind:'admin'},{...body,base64:'<svg/>'},{...body,base64:Buffer.from('<html></html>').toString('base64')},{...body,base64:Buffer.alloc(maxBytes+1).toString('base64')}]) assert.throws(()=>uploadInput(value));
 const full=Buffer.alloc(maxBytes);png.subarray(0,24).copy(full);assert.equal(uploadInput({...body,base64:full.toString('base64')}).bytes.length,maxBytes);
});
test('Dokument-API prüft Rollen, Aktenzuordnung, private Ablage und Aufräumen',async()=>{
 let roles=['1566464755278024776'],ready=true,exists=true,insertError=false,size=png.length;
 const calls=[],headers={};
 const auth={getUser:async()=>({data:{user:{id:fileId,identities:[{provider:'discord',provider_id:'123456789012345678'}]}}})};
 const storage={upload:async(path,bytes,options)=>{calls.push({op:'upload',path,options});return{};},remove:async paths=>{calls.push({op:'remove',paths});return{};},info:async()=>({data:{size}}),download:async()=>{calls.push({op:'download'});return {data:new Blob([png])};}};
 const db={auth,rpc:async()=>({data:ready}),storage:{from:name=>{assert.equal(name,'personal-documents');return storage;}},from:table=>{
  let insert=false;
  const chain={select:()=>chain,eq:()=>chain,is:()=>chain,order:()=>chain,limit:()=>chain,maybeSingle:()=>chain,
   insert:payload=>{insert=true;calls.push({op:'insert',payload});return chain;},
   then:resolve=>resolve(table==='person_files'?{data:exists?{id:fileId}:null}:insert?{data:insertError?null:[{id:docId}],error:insertError}:{data:{id:docId,file_id:fileId,kind:'identity',storage_path:'trusted/server/path.png'}})};return chain;
 }};
 const handler=makeDocumentsHandler({getClient:()=>db,fetcher:async()=>({ok:true,json:async()=>({user:{id:'123456789012345678'},roles})})});
 async function call(method,query={},input=body) {
  const res={setHeader(k,v){headers[k]=v;},status(code){this.code=code;return this;},json(data){this.data=data;return this;},send(data){this.bytes=data;return this;}};
  await handler({method,query,body:input,headers:{authorization:'Bearer valid','x-discord-token':'provider'}},res);return res;
 }
 assert.equal((await call('POST')).code,201);
 const uploaded=calls.find(c=>c.op==='upload');assert.match(uploaded.path,new RegExp('^'+fileId+'/[0-9a-f-]+\\.png$'));assert.equal(uploaded.options.upsert,false);
 assert.equal(calls.find(c=>c.op==='insert').payload.uploaded_by,fileId);
 insertError=true;assert.equal((await call('POST')).code,503);assert.equal(calls.filter(c=>c.op==='remove').length,1);insertError=false;
 roles=['1566464655340077166'];assert.equal((await call('POST')).code,403);
 const result=await call('GET',{document_id:docId});assert.equal(result.code,200);assert.deepEqual(result.bytes,png);assert.match(headers['Content-Disposition'],/^attachment;/);assert.equal(headers['Cache-Control'],'no-store');
 exists=false;assert.equal((await call('GET',{document_id:docId})).code,404);exists=true;
 size=maxBytes+1;assert.equal((await call('GET',{document_id:docId})).code,413);size=png.length;
 roles=[];assert.equal((await call('GET',{document_id:docId})).code,403);
 roles=['1566464655340077166'];ready=false;assert.equal((await call('GET',{file_id:fileId})).code,503);
 assert.equal((await call('DELETE')).code,405);
});
