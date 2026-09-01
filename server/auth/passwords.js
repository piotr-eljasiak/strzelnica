import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Password hashing on scrypt from the standard library -- no external dependencies.
 *
 * Note (ADR 0004): this authentication exists for a local test. There is no login rate
 * limiting, no password policy and no account recovery; putting any of this on the public
 * internet requires a separate review first.
 */

const SALT_BYTES = 16;
const KEY_BYTES = 64;

export function hashPassword(password) {
  const salt = randomBytes(SALT_BYTES);
  const key = scryptSync(password, salt, KEY_BYTES);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

export function verifyPassword(password, hash) {
  const [algorithm, saltHex, keyHex] = String(hash).split('$');
  if (algorithm !== 'scrypt' || !saltHex || !keyHex) return false;

  const expected = Buffer.from(keyHex, 'hex');
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(expected, actual);
}
