'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
test('Firebase Auth loads and JWKS verifies a real RSA signature without require(ESM)',()=>{
 const code=`
 (async()=>{
  require('firebase-admin/auth');
  require('firebase-admin/firestore');
  const {generateKeyPairSync,createSign,createVerify}=require('node:crypto');
  const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
  const jwk=publicKey.export({format:'jwk'});
  const {retrieveSigningKeys}=require('jwks-rsa/src/utils');
  const keys=await retrieveSigningKeys([{...jwk,kid:'test',use:'sig',alg:'RS256'}]);
  if(keys.length!==1)throw Error('No signing key');
  const signature=createSign('RSA-SHA256').update('test payload').sign(privateKey);
  if(!createVerify('RSA-SHA256').update('test payload').verify(keys[0].getPublicKey(),signature))throw Error('Invalid verification');
  if(createVerify('RSA-SHA256').update('tampered payload').verify(keys[0].getPublicKey(),signature))throw Error('Tampering accepted');
 })().catch(e=>{console.error(e);process.exitCode=1;});`;
 const result=spawnSync(process.execPath,['--no-experimental-require-module','-e',code],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
});
