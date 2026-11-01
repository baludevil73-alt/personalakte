import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canEdit,validateRecord} from '../src/policy.js';
test('unbekannte und lesende Rollen können nicht bearbeiten',()=>{
 for(const role of [undefined,null,'viewer','owner','ADMIN']) assert.equal(canEdit(role),false);
 for(const role of ['editor','admin']) assert.equal(canEdit(role),true);
});
test('Dateneingaben haben feste Grenzen',()=>{
 for(const [name,notes] of [['   ',''],['x'.repeat(161),''],['A','x'.repeat(20001)]]) assert.throws(()=>validateRecord(name,notes));
 assert.deepEqual(validateRecord('  Alice  ','Notiz'),{name:'Alice',notes:'Notiz'});
 assert.equal(validateRecord('x'.repeat(160),'x'.repeat(20000)).notes.length,20000);
});
