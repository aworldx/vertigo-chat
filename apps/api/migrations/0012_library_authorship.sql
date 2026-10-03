-- Attribution does not grant ownership: user_id remains the publisher.
ALTER TABLE library_articles
  ADD COLUMN work_author varchar(120) NOT NULL DEFAULT '',
  ADD COLUMN source_url text NOT NULL DEFAULT '',
  ADD COLUMN cover_image text NOT NULL DEFAULT '';
