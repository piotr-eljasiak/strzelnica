-- Initial schema: ranges, lanes, schedules, closures, shooters, bookings.
--
-- Identifiers are English; the Polish glossary in CONTEXT.md maps onto them (ADR 0007).
--
-- Time: absolute instants are stored as UTC ISO 8601 ('2026-03-14T09:00:00Z').
-- Schedule hours are stored as plain hour numbers in the range's local time, because that
-- is what defines opening hours -- stored as UTC they would shift when the clocks change.

CREATE TABLE shooting_range (
  id                       INTEGER PRIMARY KEY,
  slug                     TEXT    NOT NULL UNIQUE,
  name                     TEXT    NOT NULL,
  phone                    TEXT    NOT NULL,
  time_zone                TEXT    NOT NULL DEFAULT 'Europe/Warsaw',
  horizon_days             INTEGER NOT NULL DEFAULT 30 CHECK (horizon_days > 0),
  max_active_bookings      INTEGER NOT NULL DEFAULT 3  CHECK (max_active_bookings > 0),
  max_slots_per_day        INTEGER NOT NULL DEFAULT 2  CHECK (max_slots_per_day > 0),
  cancellation_window_hours INTEGER NOT NULL DEFAULT 24 CHECK (cancellation_window_hours >= 0)
);

-- Sites allowed to embed this range's widget (frame-ancestors header).
CREATE TABLE embed_origin (
  range_id INTEGER NOT NULL REFERENCES shooting_range(id) ON DELETE CASCADE,
  origin   TEXT    NOT NULL,
  PRIMARY KEY (range_id, origin)
);

CREATE TABLE lane (
  id         INTEGER PRIMARY KEY,
  range_id   INTEGER NOT NULL REFERENCES shooting_range(id) ON DELETE CASCADE,
  name       TEXT    NOT NULL,
  distance_m INTEGER NOT NULL CHECK (distance_m > 0),
  UNIQUE (range_id, name)
);

-- The range's default opening hours. A weekday with no row means closed that day.
CREATE TABLE range_hours (
  range_id   INTEGER NOT NULL REFERENCES shooting_range(id) ON DELETE CASCADE,
  weekday    INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0 = Sunday
  start_hour INTEGER NOT NULL CHECK (start_hour BETWEEN 0 AND 23),
  end_hour   INTEGER NOT NULL CHECK (end_hour BETWEEN 1 AND 24),
  PRIMARY KEY (range_id, weekday),
  CHECK (end_hour > start_hour)
);

-- A lane's own schedule. A lane with no rows here inherits the range's hours.
-- A lane with at least one row defines its whole week: a weekday without a row means
-- closed for that lane, not a fall back to inheritance.
CREATE TABLE lane_hours (
  lane_id    INTEGER NOT NULL REFERENCES lane(id) ON DELETE CASCADE,
  weekday    INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_hour INTEGER NOT NULL CHECK (start_hour BETWEEN 0 AND 23),
  end_hour   INTEGER NOT NULL CHECK (end_hour BETWEEN 1 AND 24),
  PRIMARY KEY (lane_id, weekday),
  CHECK (end_hour > start_hour)
);

CREATE TABLE shooter (
  id            INTEGER PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  phone         TEXT NOT NULL,
  created_utc   TEXT NOT NULL
);

-- A lane taken out of service. The reason is internal and never reaches availability.
CREATE TABLE closure (
  id        INTEGER PRIMARY KEY,
  lane_id   INTEGER NOT NULL REFERENCES lane(id) ON DELETE CASCADE,
  start_utc TEXT    NOT NULL,
  end_utc   TEXT    NOT NULL,
  reason    TEXT    NOT NULL,
  CHECK (end_utc > start_utc)
);

CREATE INDEX idx_closure_lane_time ON closure (lane_id, start_utc, end_utc);

CREATE TABLE booking (
  id            INTEGER PRIMARY KEY,
  range_id      INTEGER NOT NULL REFERENCES shooting_range(id)  ON DELETE CASCADE,
  lane_id       INTEGER NOT NULL REFERENCES lane(id)    ON DELETE CASCADE,
  shooter_id    INTEGER NOT NULL REFERENCES shooter(id) ON DELETE CASCADE,
  start_utc     TEXT    NOT NULL,
  end_utc       TEXT    NOT NULL,
  status        TEXT    NOT NULL CHECK (status IN ('confirmed', 'cancelled')),
  created_utc   TEXT    NOT NULL,
  cancelled_utc TEXT,
  CHECK (end_utc > start_utc),
  CHECK ((status = 'cancelled') = (cancelled_utc IS NOT NULL))
);

CREATE INDEX idx_booking_shooter   ON booking (shooter_id, status);
CREATE INDEX idx_booking_lane_time ON booking (lane_id, start_utc);

-- Slots taken by confirmed bookings. A booking remains a range of time -- this table is
-- purely how exclusivity is enforced: the primary key means two concurrent bookings of the
-- same lane at the same hour cannot both be written, whatever the code does. Cancelling
-- deletes the rows and thereby frees the slots.
CREATE TABLE booked_slot (
  lane_id    INTEGER NOT NULL REFERENCES lane(id)    ON DELETE CASCADE,
  start_utc  TEXT    NOT NULL,
  booking_id INTEGER NOT NULL REFERENCES booking(id) ON DELETE CASCADE,
  PRIMARY KEY (lane_id, start_utc)
);
