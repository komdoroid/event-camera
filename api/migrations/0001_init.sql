CREATE TABLE events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  shot_limit INTEGER NOT NULL,
  host_token TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'shooting',
  published_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE photos (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id),
  guest_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  uploaded INTEGER NOT NULL DEFAULT 0,
  taken_at TEXT NOT NULL
);
CREATE INDEX idx_photos_event ON photos(event_id, taken_at);
CREATE INDEX idx_photos_guest ON photos(event_id, guest_id);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id),
  guest_id TEXT NOT NULL,
  product TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_orders_event ON orders(event_id);
