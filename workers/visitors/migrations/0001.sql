CREATE TABLE counters (key TEXT PRIMARY KEY, total INTEGER NOT NULL DEFAULT 0 CHECK(total >= 0));
INSERT INTO counters(key,total) VALUES ('observers',0);
-- UUID digests are permanent deduplication tombstones. Pruning them would recount a returning browser.
CREATE TABLE visitors(id TEXT PRIMARY KEY, first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL);
CREATE INDEX idx_last_seen ON visitors(last_seen);
CREATE TABLE networks(hash TEXT PRIMARY KEY, seen INTEGER NOT NULL);
CREATE INDEX idx_network_seen ON networks(seen);
CREATE TABLE rate_limits(hash TEXT NOT NULL, hour INTEGER NOT NULL, requests INTEGER NOT NULL, PRIMARY KEY(hash,hour));
CREATE TRIGGER count_arrival AFTER INSERT ON visitors BEGIN
 UPDATE counters SET total=total+1 WHERE key='observers';
END;
