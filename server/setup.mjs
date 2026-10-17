import {mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {hashPassword} from './auth.mjs';
const dir=resolve(process.env.DATA_DIR||'.data');await mkdir(dir,{recursive:true,mode:0o700});
const password=process.env.ADMIN_PASSWORD||randomBytes(24).toString('base64url');
const credentials=await hashPassword(password);
await writeFile(resolve(dir,'credentials.tmp'),JSON.stringify(credentials),{mode:0o600});await rename(resolve(dir,'credentials.tmp'),resolve(dir,'credentials.json'));
if(!process.env.ADMIN_PASSWORD){await writeFile(resolve(dir,'initial-admin-password.txt'),password+'\n',{mode:0o600});console.log('Новый пароль сохранён в .data/initial-admin-password.txt (файл доступен только на этом компьютере).');}
console.log('Пароль настроен. Перезапустите сервер, чтобы завершить существующие сеансы.');
