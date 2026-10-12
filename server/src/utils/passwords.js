// Password hashing with Node's built-in scrypt (memory-hard, no native dependency).
// Stored format: scrypt$N$r$p$salt$hash  -> parameters travel with the hash so they can be raised later.
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const KEY_LEN = 64;
const N = 16384;
const R = 8;
const P = 1;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEY_LEN, { N, r: R, p: P });
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password, stored) {
  const [alg, n, r, p, saltB64, hashB64] = String(stored).split('$');
  if (alg !== 'scrypt' || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const key = await scryptAsync(password, Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return timingSafeEqual(key, expected);
}

// Verified against when the email is unknown, so "no such user" costs the same time as "wrong password".
let dummy;
export const dummyHash = () => (dummy ??= hashPassword('not-a-real-password'));
