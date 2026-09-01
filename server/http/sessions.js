import { randomBytes } from 'node:crypto';

/**
 * Sessions held in the process, keyed by an opaque cookie value.
 *
 * They vanish when the server restarts, which is the right trade for a local test app and
 * keeps the store out of the schema. The cookie is HttpOnly and SameSite=Lax: it is
 * deliberately NOT sent from inside a third-party frame, which is exactly why the widget
 * finishes a booking by leaving the frame rather than posting from inside it (ADR 0002).
 */

export const COOKIE_NAME = 'sid';

export function createSessions() {
  const byToken = new Map();

  return {
    open(shooterId) {
      const token = randomBytes(24).toString('base64url');
      byToken.set(token, shooterId);
      return token;
    },
    shooterIdFor(token) {
      return token ? byToken.get(token) : undefined;
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

export function sessionCookie(token) {
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`;
}

export const clearedCookie = `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
