const encoder=new TextEncoder();
const hex=bytes=>Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
export const randomSecret=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
export async function digest(value){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))));}
export async function hashPassword(password){
 if(typeof password!=='string'||password.length<12||password.length>256)throw Object.assign(new Error('Пароль должен содержать от 12 до 256 символов.'),{status:422});
 const salt=randomSecret(),iterations=100000;
 return {salt,iterations,hash:await derive(password,salt,iterations)};
}
async function derive(password,salt,iterations){
 const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
 return hex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations},key,256)));
}
export async function verifyPassword(password,credential){
 if(typeof password!=='string'||password.length>256||!credential||!/^[a-f0-9]{64}$/.test(credential.salt)||!/^[a-f0-9]{64}$/.test(credential.hash)||credential.iterations!==100000)return false;
 const actual=await derive(password,credential.salt,credential.iterations);let difference=0;
 for(let i=0;i<actual.length;i++)difference|=actual.charCodeAt(i)^credential.hash.charCodeAt(i);
 return difference===0;
}
