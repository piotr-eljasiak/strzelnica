-- Range staff: the people who run a range's calendar (ADR 0008).
--
-- Deliberately not a role on `shooter`. Staff belong to exactly one range, never book, and
-- sign in somewhere else. Keeping them in their own table means a shooter's request cannot
-- reach a staff endpoint by way of a forgotten role check -- it is a different session
-- against a different table.

CREATE TABLE staff (
  id            INTEGER PRIMARY KEY,
  range_id      INTEGER NOT NULL REFERENCES shooting_range(id) ON DELETE CASCADE,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  name          TEXT    NOT NULL,
  created_utc   TEXT    NOT NULL
);

CREATE INDEX idx_staff_range ON staff (range_id);

-- Who cancelled a booking, when staff did it rather than the shooter. Null for a shooter's
-- own cancellation, which keeps "the shooter cancelled" and "the range cancelled"
-- distinguishable without a second status.
ALTER TABLE booking ADD COLUMN cancelled_by_staff_id INTEGER REFERENCES staff(id);
ALTER TABLE booking ADD COLUMN cancellation_note TEXT;
