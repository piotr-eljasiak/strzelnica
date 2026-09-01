-- migration: foreign-keys-off
--
-- Bookings taken over the phone by range staff (ADR 0009).
--
-- A booking may now belong to a shooter account OR to a guest known only by name and
-- phone. SQLite cannot make `shooter_id` nullable in place, so the table is rebuilt.

CREATE TABLE booking_rebuilt (
  id                    INTEGER PRIMARY KEY,
  range_id              INTEGER NOT NULL REFERENCES shooting_range(id) ON DELETE CASCADE,
  lane_id               INTEGER NOT NULL REFERENCES lane(id)           ON DELETE CASCADE,
  shooter_id            INTEGER          REFERENCES shooter(id)        ON DELETE CASCADE,
  guest_name            TEXT,
  guest_phone           TEXT,
  created_by_staff_id   INTEGER          REFERENCES staff(id),
  start_utc             TEXT    NOT NULL,
  end_utc               TEXT    NOT NULL,
  status                TEXT    NOT NULL CHECK (status IN ('confirmed', 'cancelled')),
  created_utc           TEXT    NOT NULL,
  cancelled_utc         TEXT,
  cancelled_by_staff_id INTEGER          REFERENCES staff(id),
  cancellation_note     TEXT,
  CHECK (end_utc > start_utc),
  CHECK ((status = 'cancelled') = (cancelled_utc IS NOT NULL)),
  -- Exactly one of the two: an account, or a guest's details. Never both, never neither --
  -- otherwise "whose booking is this" would have no answer the code could rely on.
  CHECK ((shooter_id IS NOT NULL) <> (guest_name IS NOT NULL)),
  CHECK ((guest_name IS NULL) = (guest_phone IS NULL)),
  -- A guest booking has no account to sign in with, so someone must own it on the range's
  -- side. A booking made by a shooter has no staff author.
  CHECK ((guest_name IS NULL) OR (created_by_staff_id IS NOT NULL))
);

INSERT INTO booking_rebuilt
  (id, range_id, lane_id, shooter_id, start_utc, end_utc, status, created_utc,
   cancelled_utc, cancelled_by_staff_id, cancellation_note)
SELECT
   id, range_id, lane_id, shooter_id, start_utc, end_utc, status, created_utc,
   cancelled_utc, cancelled_by_staff_id, cancellation_note
  FROM booking;

DROP TABLE booking;
ALTER TABLE booking_rebuilt RENAME TO booking;

CREATE INDEX idx_booking_shooter   ON booking (shooter_id, status);
CREATE INDEX idx_booking_lane_time ON booking (lane_id, start_utc);
CREATE INDEX idx_booking_range_time ON booking (range_id, start_utc);
