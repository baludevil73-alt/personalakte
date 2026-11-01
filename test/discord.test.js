import {test} from 'node:test';
import assert from 'node:assert/strict';
import {authorize,discordRole,recordInput} from '../server/access.js';
import {makeHandler} from '../server/handler.js';
const id='123456789012345678';
const auth={getUser:async()=>({data:{user:{id:'user-1',identities:[{provider:'discord',provider_id:id}]}}})};
const discord=roles=>async url=>{
 assert.equal(url,'https://discord.com/api/v10/users/@me/guilds/959404435614859264/member');
 return {ok:true,json:async()=>({user:{id},roles})};
};
test('Discord-Rollen: unbekannt gesperrt; Akte 2 hat Vorrang',()=>{
 assert.equal(discordRole([]),null);
 assert.equal(discordRole(['admin']),null);
 assert.equal(discordRole(['1566464655340077166']),'reader');
 assert.equal(discordRole(['1566464655340077166','1566464755278024776']),'editor');
});
test('Identität, Token, Servermitgliedschaft und Live-Rollen werden geprüft',async()=>{
 const args={jwt:'valid',providerToken:'provider',auth,fetcher:discord(['1566464655340077166'])};
 assert.equal((await authorize(args)).role,'reader');
 await assert.rejects(authorize({...args,jwt:null}));
 await assert.rejects(authorize({...args,auth:{getUser:async()=>({error:true})}}));
 await assert.rejects(authorize({...args,fetcher:discord([])}));
 await assert.rejects(authorize({...args,fetcher:async()=>({ok:false,status:404})}));
 await assert.rejects(authorize({...args,fetcher:async()=>({ok:false,status:429})}));
 await assert.rejects(authorize({...args,fetcher:async()=>({ok:true,json:async()=>({user:{id:'someone-else'},roles:['1566464755278024776']})})}));
 await assert.rejects(authorize({...args,auth:{getUser:async()=>({data:{user:{id:'forged',user_metadata:{sub:id,role:'admin'}}}})}}));
});
test('API sperrt Umgehungsversuche und prüft vor jedem Zugriff erneut',async()=>{
 let roles=['1566464755278024776'],ready=true,rows=[{id:'record-1'}],writes=[];
 const db={auth,rpc:async()=>({data:ready}),from:table=>{
  assert.equal(table,'person_files');
  const chain={select:()=>chain,is:()=>chain,eq:()=>chain,order:()=>chain,limit:()=>chain,
   insert:p=>{writes.push(p);return chain;},update:p=>{writes.push(p);return chain;},
   then:resolve=>resolve({data:rows})};return chain;
 }};
 const handle=makeHandler({getClient:()=>db,fetcher:async(...args)=>discord(roles)(...args)});
 async function call(method,body,extra={}) {
  const res={setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;return this;}};
  await handle({method,body,headers:{authorization:'Bearer valid','x-discord-token':'provider',...extra}},res);return res;
 }
 assert.equal((await call('DELETE')).code,405);
 assert.equal((await call('GET',null,{origin:'https://evil.example'})).code,403);
 ready=false;assert.equal((await call('GET')).code,503);ready=true;
 assert.equal((await call('POST',{first_name:'Alice',last_name:'Test',notes:'',created_by:'forged',role:'admin'})).code,200);
 assert.deepEqual(writes[0],{first_name:'Alice',last_name:'Test',notes:'',created_by:'user-1',updated_by:'user-1'});
 roles=['1566464655340077166'];
 assert.equal((await call('GET')).data.role,'reader');
 assert.equal((await call('POST',{first_name:'A',last_name:'',notes:''})).code,403);
 roles=[];assert.equal((await call('GET')).code,403);
 assert.equal(writes.length,1);
 roles=['1566464755278024776'];rows=[];
 assert.equal((await call('PATCH',{id:'00000000-0000-0000-0000-000000000001',updated_at:'2026-11-01T00:00:00Z',first_name:'A',last_name:'',notes:''})).code,409);
});
test('Server validiert Eingaben und übernimmt nur erlaubte Felder',()=>{
 for(const input of [null,{}, {first_name:'',last_name:'',notes:''},{first_name:'A',last_name:'B',notes:'x'.repeat(20001)}]) assert.throws(()=>recordInput(input));
 assert.deepEqual(recordInput({first_name:' A ',last_name:'B',notes:'',deleted_at:'forged'}),{first_name:'A',last_name:'B',notes:''});
});
