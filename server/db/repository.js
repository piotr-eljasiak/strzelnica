/**
 * The only place in the system that knows SQL and the shape of the tables (ADR 0004).
 *
 * Operations are named after the domain, not after the database: the rest of the app asks
 * for "the lanes of a range" or "a shooter's bookings", never for table rows. That is what
 * makes moving back to Postgres a replacement of this module rather than a rewrite.
 *
 * English identifiers map onto the Polish glossary in CONTEXT.md (ADR 0007):
 * shooting_range = strzelnica, lane = oś, closure = blokada, booking = rezerwacja,
 * shooter = strzelec.
 */

/** Thrown when another booking took the slot between the availability check and the write. */
export class SlotTakenError extends Error {
  constructor() {
    super('Slot was taken by another booking');
    this.name = 'SlotTakenError';
  }
}

export function createRepository(db) {
  const q = {
    rangeBySlug: db.prepare('SELECT * FROM shooting_range WHERE slug = ?'),
    lanesOfRange: db.prepare(
      'SELECT * FROM lane WHERE range_id = ? ORDER BY distance_m, name',
    ),
    laneInRange: db.prepare('SELECT * FROM lane WHERE id = ? AND range_id = ?'),
    embedOrigins: db.prepare(
      'SELECT origin FROM embed_origin WHERE range_id = ? ORDER BY origin',
    ),
    rangeHours: db.prepare(
      'SELECT weekday, start_hour, end_hour FROM range_hours WHERE range_id = ?',
    ),
    laneHours: db.prepare(
      'SELECT weekday, start_hour, end_hour FROM lane_hours WHERE lane_id = ?',
    ),
    closuresOfLane: db.prepare(`
      SELECT id, lane_id, start_utc, end_utc
        FROM closure
       WHERE lane_id = ? AND start_utc < ? AND end_utc > ?
    `),
    bookedSlotsOfLane: db.prepare(`
      SELECT start_utc
        FROM booked_slot
       WHERE lane_id = ? AND start_utc >= ? AND start_utc < ?
    `),
    shooterByEmail: db.prepare('SELECT * FROM shooter WHERE email = ?'),
    shooterById: db.prepare('SELECT * FROM shooter WHERE id = ?'),
    insertShooter: db.prepare(`
      INSERT INTO shooter (email, password_hash, first_name, last_name, phone, created_utc)
      VALUES (?, ?, ?, ?, ?, ?)
    `),
    insertBooking: db.prepare(`
      INSERT INTO booking
        (range_id, lane_id, shooter_id, start_utc, end_utc, status, created_utc)
      VALUES (?, ?, ?, ?, ?, 'confirmed', ?)
    `),
    insertBookedSlot: db.prepare(
      'INSERT INTO booked_slot (lane_id, start_utc, booking_id) VALUES (?, ?, ?)',
    ),
    bookingById: db.prepare(`
      SELECT b.*, l.name AS lane_name, l.distance_m, r.name AS range_name,
             r.slug AS range_slug, r.phone AS range_phone,
             r.time_zone, r.cancellation_window_hours
        FROM booking b
        JOIN lane l           ON l.id = b.lane_id
        JOIN shooting_range r ON r.id = b.range_id
       WHERE b.id = ?
    `),
    bookingsOfShooter: db.prepare(`
      SELECT b.*, l.name AS lane_name, l.distance_m, r.name AS range_name,
             r.slug AS range_slug, r.phone AS range_phone,
             r.time_zone, r.cancellation_window_hours
        FROM booking b
        JOIN lane l           ON l.id = b.lane_id
        JOIN shooting_range r ON r.id = b.range_id
       WHERE b.shooter_id = ?
       ORDER BY b.start_utc DESC
    `),
    activeBookingCount: db.prepare(`
      SELECT COUNT(*) AS n
        FROM booking
       WHERE shooter_id = ? AND range_id = ?
         AND status = 'confirmed' AND end_utc > ?
    `),
    shooterSlotCount: db.prepare(`
      SELECT COUNT(*) AS n
        FROM booked_slot s
        JOIN booking b ON b.id = s.booking_id
       WHERE b.shooter_id = ? AND b.range_id = ?
         AND s.start_utc >= ? AND s.start_utc < ?
    `),
    markCancelled: db.prepare(`
      UPDATE booking SET status = 'cancelled', cancelled_utc = ?
       WHERE id = ? AND status = 'confirmed'
    `),
    deleteBookedSlots: db.prepare('DELETE FROM booked_slot WHERE booking_id = ?'),
  };

  return {
    rangeBySlug: (slug) => q.rangeBySlug.get(slug),
    lanesOfRange: (rangeId) => q.lanesOfRange.all(rangeId),
    laneInRange: (laneId, rangeId) => q.laneInRange.get(laneId, rangeId),
    embedOrigins: (rangeId) => q.embedOrigins.all(rangeId).map((r) => r.origin),

    /**
     * A lane's schedule: its own if it has any rows, otherwise the range's. Also reports
     * where it came from -- availability does not care, but the panel and the tests do.
     */
    scheduleForLane(laneId, rangeId) {
      const own = q.laneHours.all(laneId);
      if (own.length > 0) return { source: 'lane', days: own };
      return { source: 'range', days: q.rangeHours.all(rangeId) };
    },

    closuresForLane: (laneId, fromUtc, toUtc) => q.closuresOfLane.all(laneId, toUtc, fromUtc),
    bookedSlotsForLane: (laneId, fromUtc, toUtc) =>
      q.bookedSlotsOfLane.all(laneId, fromUtc, toUtc).map((r) => r.start_utc),

    shooterByEmail: (email) => q.shooterByEmail.get(email),
    shooterById: (id) => q.shooterById.get(id),
    insertShooter({ email, passwordHash, firstName, lastName, phone, nowUtc }) {
      const result = q.insertShooter.run(
        email,
        passwordHash,
        firstName,
        lastName,
        phone,
        nowUtc,
      );
      return q.shooterById.get(result.lastInsertRowid);
    },

    bookingById: (id) => q.bookingById.get(id),
    bookingsOfShooter: (shooterId) => q.bookingsOfShooter.all(shooterId),
    activeBookingCount: (shooterId, rangeId, nowUtc) =>
      q.activeBookingCount.get(shooterId, rangeId, nowUtc).n,
    shooterSlotCount: (shooterId, rangeId, fromUtc, toUtc) =>
      q.shooterSlotCount.get(shooterId, rangeId, fromUtc, toUtc).n,

    /**
     * Writes a booking together with its slots in one transaction.
     *
     * The primary key of `booked_slot` is the last line of defence: if someone takes the
     * same slot between the availability check and this write, the insert fails and the
     * whole transaction rolls back.
     */
    insertBooking({ rangeId, laneId, shooterId, slots, startUtc, endUtc, nowUtc }) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const result = q.insertBooking.run(
          rangeId,
          laneId,
          shooterId,
          startUtc,
          endUtc,
          nowUtc,
        );
        const bookingId = result.lastInsertRowid;
        for (const slot of slots) {
          q.insertBookedSlot.run(laneId, slot, bookingId);
        }
        db.exec('COMMIT');
        return q.bookingById.get(bookingId);
      } catch (error) {
        db.exec('ROLLBACK');
        if (/UNIQUE constraint failed: booked_slot/i.test(error.message)) {
          throw new SlotTakenError();
        }
        throw error;
      }
    },

    /** Cancels a booking and frees its slots. Returns false if it was already cancelled. */
    cancelBooking(bookingId, nowUtc) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const result = q.markCancelled.run(nowUtc, bookingId);
        if (result.changes === 0) {
          db.exec('ROLLBACK');
          return false;
        }
        q.deleteBookedSlots.run(bookingId);
        db.exec('COMMIT');
        return true;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}
