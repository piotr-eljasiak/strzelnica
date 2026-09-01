import { randomBytes } from 'node:crypto';

/**
 * Sessions held in the process, keyed by an opaque cookie value.
 *
 * Shooters and staff get different cookies, not different values of one cookie (ADR 0008).
 * A staff cookie can never be mistaken for a shooter's, and one person can be signed into
 * both at once without either session standing in for the other.
 *
 * Both cookies are HttpOnly and SameSite=Lax, so neither travels from inside a
 * third-party frame -- which is exactly why booking is finished outside the widget
 * (ADR 0002).
 */

export const SHOOTER_COOKIE = 'sid';
export const STAFF_COOKIE = 'psid';

export function createSessions() {
  const byToken = new Map();

  return {
    open(kind, id) {
      const token = randomBytes(24).toString('base64url');
      byToken.set(token, { kind, id });
      return token;
    },
    /** Returns the id only when the session is of the kind being asked about. */
    idFor(kind, token) {
      const session = token ? byToken.get(token) : undefined;
      return session?.kind === kind ? session.id : undefined;
    },
    close(token) {
      byToken.delete(token);
    },
  };
}

export function readCookie(header, name) {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export const sessionCookie = (name, token) =>
  `${name}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`;

export const clearedCookie = (name) =>
  `${name}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
