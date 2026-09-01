import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Hashowanie haseł na scrypt z biblioteki standardowej — bez zależności zewnętrznych.
 *
 * Uwaga (ADR 0004): to uwierzytelnianie powstało na potrzeby testu lokalnego. Brak tu
 * limitu prób logowania, polityki haseł i odzyskiwania dostępu; przed wystawieniem
 * czegokolwiek do internetu wymaga osobnego przeglądu.
 */

const DLUGOSC_SOLI = 16;
const DLUGOSC_KLUCZA = 64;

export function zahashuj(haslo) {
  const sol = randomBytes(DLUGOSC_SOLI);
  const klucz = scryptSync(haslo, sol, DLUGOSC_KLUCZA);
  return `scrypt$${sol.toString('hex')}$${klucz.toString('hex')}`;
}

export function zgodneZHashem(haslo, hash) {
  const [algorytm, solHex, kluczHex] = String(hash).split('$');
  if (algorytm !== 'scrypt' || !solHex || !kluczHex) return false;

  const oczekiwany = Buffer.from(kluczHex, 'hex');
  const obliczony = scryptSync(haslo, Buffer.from(solHex, 'hex'), oczekiwany.length);
  return timingSafeEqual(oczekiwany, obliczony);
}
