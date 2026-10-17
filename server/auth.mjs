import {randomBytes, scrypt as scryptCallback, timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt = promisify(scryptCallback);
export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 256) throw new Error('Пароль должен содержать от 12 до 256 символов.');
  const salt = randomBytes(32).toString('hex');
  const key = await scrypt(password, salt, 64, {N:32768,r:8,p:3,maxmem:64*1024*1024});
  return {salt, hash:key.toString('hex')};
}
export async function verifyPassword(password, credentials) {
  if (typeof password !== 'string' || password.length > 256) return false;
  const key = await scrypt(password, credentials.salt, 64, {N:32768,r:8,p:3,maxmem:64*1024*1024});
  const expected = Buffer.from(credentials.hash, 'hex');
  return expected.length === key.length && timingSafeEqual(expected, key);
}
export const token = () => randomBytes(32).toString('hex');
