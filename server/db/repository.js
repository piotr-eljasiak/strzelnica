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
    rangeById: db.prepare('SELECT * FROM shooting_range WHERE id = ?'),
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
        (range_id, lane_id, shooter_id, guest_name, guest_phone, created_by_staff_id,
         start_utc, end_utc, status, created_utc)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?)
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
    markCancelledByStaff: db.prepare(`
      UPDATE booking
         SET status = 'cancelled', cancelled_utc = ?,
             cancelled_by_staff_id = ?, cancellation_note = ?
       WHERE id = ? AND status = 'confirmed'
    `),
    deleteBookedSlots: db.prepare('DELETE FROM booked_slot WHERE booking_id = ?'),

    // --- Staff and the panel ---

    staffByEmail: db.prepare('SELECT * FROM staff WHERE email = ?'),
    staffById: db.prepare('SELECT * FROM staff WHERE id = ?'),
    insertStaff: db.prepare(`
      INSERT INTO staff (range_id, email, password_hash, name, created_utc)
      VALUES (?, ?, ?, ?, ?)
    `),
    insertRange: db.prepare(`
      INSERT INTO shooting_range (slug, name, phone, time_zone)
      VALUES (?, ?, ?, ?)
    `),
    allRanges: db.prepare('SELECT * FROM shooting_range ORDER BY name'),
    insertLane: db.prepare(
      'INSERT INTO lane (range_id, name, distance_m) VALUES (?, ?, ?)',
    ),
    updateLane: db.prepare(
      'UPDATE lane SET name = ?, distance_m = ? WHERE id = ? AND range_id = ?',
    ),
    deleteLane: db.prepare('DELETE FROM lane WHERE id = ? AND range_id = ?'),
    laneHasBookings: db.prepare(`
      SELECT COUNT(*) AS n FROM booking
       WHERE lane_id = ? AND status = 'confirmed' AND end_utc > ?
    `),
    clearLaneHours: db.prepare('DELETE FROM lane_hours WHERE lane_id = ?'),
    insertLaneHours: db.prepare(`
      INSERT INTO lane_hours (lane_id, weekday, start_hour, end_hour) VALUES (?, ?, ?, ?)
    `),
    clearRangeHours: db.prepare('DELETE FROM range_hours WHERE range_id = ?'),
    insertRangeHours: db.prepare(`
      INSERT INTO range_hours (range_id, weekday, start_hour, end_hour) VALUES (?, ?, ?, ?)
    `),
    insertClosure: db.prepare(
      'INSERT INTO closure (lane_id, start_utc, end_utc, reason) VALUES (?, ?, ?, ?)',
    ),
    closureById: db.prepare(`
      SELECT c.* FROM closure c JOIN lane l ON l.id = c.lane_id
       WHERE c.id = ? AND l.range_id = ?
    `),
    deleteClosure: db.prepare('DELETE FROM closure WHERE id = ?'),
    closuresOfRange: db.prepare(`
      SELECT c.*, l.name AS lane_name
        FROM closure c JOIN lane l ON l.id = c.lane_id
       WHERE l.range_id = ? AND c.end_utc > ?
       ORDER BY c.start_utc
    `),
    /**
     * Bookings of one range, with the contact details staff need in order to call.
     * The shooter is joined loosely: a booking taken over the phone has no account.
     */
    bookingsOfRange: db.prepare(`
      SELECT b.*, l.name AS lane_name, l.distance_m,
             r.name AS range_name, r.slug AS range_slug, r.phone AS range_phone,
             r.time_zone, r.cancellation_window_hours,
             s.first_name, s.last_name, s.phone AS shooter_phone, s.email AS shooter_email
        FROM booking b
        JOIN lane l           ON l.id = b.lane_id
        JOIN shooting_range r ON r.id = b.range_id
        LEFT JOIN shooter s   ON s.id = b.shooter_id
       WHERE b.range_id = ? AND b.end_utc > ?
       ORDER BY b.start_utc
    `),
    /** Confirmed bookings a proposed closure would collide with. */
    bookingsCollidingWith: db.prepare(`
      SELECT b.*, l.name AS lane_name, s.first_name, s.last_name,
             s.phone AS shooter_phone, s.email AS shooter_email
        FROM booking b
        JOIN lane l         ON l.id = b.lane_id
        LEFT JOIN shooter s ON s.id = b.shooter_id
       WHERE b.lane_id = ? AND b.status = 'confirmed'
         AND b.start_utc < ? AND b.end_utc > ?
       ORDER BY b.start_utc
    `),
    /**
     * Shooters this range already knows, matched on name, e-mail or phone.
     *
     * Scoped to people who have booked here before -- staff must not be able to search
     * the platform's whole user base (ADR 0009).
     */
    knownShooters: db.prepare(`
      SELECT DISTINCT s.id, s.first_name, s.last_name, s.email, s.phone
        FROM shooter s
        JOIN booking b ON b.shooter_id = s.id
       WHERE b.range_id = :rangeId
         AND (s.email LIKE :q OR s.phone LIKE :q
              OR (s.first_name || ' ' || s.last_name) LIKE :q)
       ORDER BY s.last_name, s.first_name
       LIMIT 20
    `),
    updateRangeSettings: db.prepare(`
      UPDATE shooting_range
         SET phone = ?, horizon_days = ?, max_active_bookings = ?,
             max_slots_per_day = ?, cancellation_window_hours = ?
       WHERE id = ?
    `),
  };

  return {
    rangeBySlug: (slug) => q.rangeBySlug.get(slug),
    rangeById: (id) => q.rangeById.get(id),
    rangeHours: (rangeId) => q.rangeHours.all(rangeId),
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
    insertBooking({
      rangeId,
      laneId,
      shooterId = null,
      guest = null,
      createdByStaffId = null,
      slots,
      startUtc,
      endUtc,
      nowUtc,
    }) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const result = q.insertBooking.run(
          rangeId,
          laneId,
          shooterId,
          guest?.name ?? null,
          guest?.phone ?? null,
          createdByStaffId,
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
    cancelBooking(bookingId, nowUtc, by = null) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const result = by
          ? q.markCancelledByStaff.run(nowUtc, by.staffId, by.note ?? null, bookingId)
          : q.markCancelled.run(nowUtc, bookingId);
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

    // --- Staff and the panel ---

    staffByEmail: (email) => q.staffByEmail.get(email),
    staffById: (id) => q.staffById.get(id),
    insertStaff({ rangeId, email, passwordHash, name, nowUtc }) {
      const result = q.insertStaff.run(rangeId, email, passwordHash, name, nowUtc);
      return q.staffById.get(result.lastInsertRowid);
    },

    allRanges: () => q.allRanges.all(),
    insertRange({ slug, name, phone, timeZone = 'Europe/Warsaw' }) {
      q.insertRange.run(slug, name, phone, timeZone);
      return q.rangeBySlug.get(slug);
    },

    addLane: (rangeId, name, distanceM) => q.insertLane.run(rangeId, name, distanceM).lastInsertRowid,
    updateLane: (laneId, rangeId, name, distanceM) =>
      q.updateLane.run(name, distanceM, laneId, rangeId).changes > 0,
    removeLane: (laneId, rangeId) => q.deleteLane.run(laneId, rangeId).changes > 0,
    laneHasFutureBookings: (laneId, nowUtc) => q.laneHasBookings.get(laneId, nowUtc).n > 0,

    /** Replaces a lane's whole week at once; an empty list restores inheritance. */
    replaceLaneHours(laneId, days) {
      db.exec('BEGIN IMMEDIATE');
      try {
        q.clearLaneHours.run(laneId);
        for (const day of days) {
          q.insertLaneHours.run(laneId, day.weekday, day.startHour, day.endHour);
        }
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },

    replaceRangeHours(rangeId, days) {
      db.exec('BEGIN IMMEDIATE');
      try {
        q.clearRangeHours.run(rangeId);
        for (const day of days) {
          q.insertRangeHours.run(rangeId, day.weekday, day.startHour, day.endHour);
        }
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },

    addClosure: (laneId, startUtc, endUtc, reason) =>
      q.insertClosure.run(laneId, startUtc, endUtc, reason).lastInsertRowid,
    closureInRange: (closureId, rangeId) => q.closureById.get(closureId, rangeId),
    removeClosure: (closureId) => q.deleteClosure.run(closureId).changes > 0,
    closuresOfRange: (rangeId, nowUtc) => q.closuresOfRange.all(rangeId, nowUtc),

    bookingsOfRange: (rangeId, nowUtc) => q.bookingsOfRange.all(rangeId, nowUtc),
    bookingsCollidingWith: (laneId, startUtc, endUtc) =>
      q.bookingsCollidingWith.all(laneId, endUtc, startUtc),
    knownShooters: (rangeId, term) =>
      q.knownShooters.all({ rangeId, q: `%${term}%` }),

    updateRangeSettings(rangeId, settings) {
      q.updateRangeSettings.run(
        settings.phone,
        settings.horizonDays,
        settings.maxActiveBookings,
        settings.maxSlotsPerDay,
        settings.cancellationWindowHours,
        rangeId,
      );
    },
  };
}
