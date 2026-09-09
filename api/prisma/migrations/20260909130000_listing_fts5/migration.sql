-- Full-text search over listings.
-- SQLite has no case-insensitive Prisma filter (`mode: "insensitive"` throws on
-- this connector), so free-text search goes through an FTS5 virtual table that
-- is kept in sync with the Listing table by triggers.
--
-- This is an external-content table (content='Listing'): FTS5 stores only the
-- index, and rowid maps to Listing.rowid.

CREATE VIRTUAL TABLE "listing_fts" USING fts5(
  title,
  description,
  addressLine,
  content='Listing',
  content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);

-- Keep the index in sync. External-content FTS5 tables require the 'delete'
-- command to carry the OLD values, otherwise the index corrupts silently.
CREATE TRIGGER "listing_fts_insert" AFTER INSERT ON "Listing" BEGIN
  INSERT INTO "listing_fts"(rowid, title, description, addressLine)
  VALUES (new.rowid, new.title, new.description, new.addressLine);
END;

CREATE TRIGGER "listing_fts_delete" AFTER DELETE ON "Listing" BEGIN
  INSERT INTO "listing_fts"("listing_fts", rowid, title, description, addressLine)
  VALUES ('delete', old.rowid, old.title, old.description, old.addressLine);
END;

CREATE TRIGGER "listing_fts_update" AFTER UPDATE ON "Listing" BEGIN
  INSERT INTO "listing_fts"("listing_fts", rowid, title, description, addressLine)
  VALUES ('delete', old.rowid, old.title, old.description, old.addressLine);
  INSERT INTO "listing_fts"(rowid, title, description, addressLine)
  VALUES (new.rowid, new.title, new.description, new.addressLine);
END;
