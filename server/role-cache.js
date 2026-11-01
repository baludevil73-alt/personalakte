import {AccessError} from './access.js';
export function createRoleCache(db) {
 return {
  async acquire(userId,hash) {
   const {data,error}=await db.rpc('nc_discord_claim',{p_user_id:userId,p_token_hash:hash});
   if(error || !data || !['cached','claimed','blocked','pending'].includes(data.state)) throw new AccessError(503,'Die neue Rollenprüfung ist noch nicht eingerichtet.');
   return data;
  },
  async complete(userId,hash,lease,role,retryAfter=0) {
   const {data,error}=await db.rpc('nc_discord_complete',{
    p_user_id:userId,p_token_hash:hash,p_lease_id:lease,p_role:role,
    p_retry_seconds:Math.min(31536000,Math.max(0,Math.ceil(retryAfter)))
   });
   if(error || data!==true) throw new AccessError(503,'Rollenprüfung konnte nicht sicher abgeschlossen werden. Bitte erneut versuchen.');
  }
 };
}
