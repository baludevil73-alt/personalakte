import {createClient} from '@supabase/supabase-js';
import {makeDocumentsHandler} from '../server/documents.js';
import {createRoleCache} from '../server/role-cache.js';
export default makeDocumentsHandler({cacheFor:createRoleCache,getClient:()=>{
 const key=process.env.SUPABASE_SECRET_KEY;
 if(!key) throw new Error('missing server configuration');
 return createClient('https://gplasajxitwifndxjxjf.supabase.co',key,{auth:{persistSession:false,autoRefreshToken:false}});
}});
