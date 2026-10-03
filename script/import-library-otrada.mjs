// Reviewed, one-off library data import. Prints SQL; never connects by itself.
// Apply with psql -v ON_ERROR_STOP=1 only after the schema migration and backup.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const source = JSON.parse(readFileSync(new URL('../docs/imports/uniform-otrada/source.json', import.meta.url), 'utf8'));
const publisher = process.argv[2] || 'moon';
if (!['moon', 'fixture01', 'fixture03'].includes(publisher)) throw new Error('Publisher must be explicitly reviewed');
if (source.author !== 'Uniform' || source.parts.length !== 9 || source.source !== 'https://vertigo.august4u.ru/gb/' || !source.permission.includes('согласен безоговорочно')) throw new Error('Invalid source or permission');
const quote = value => "'" + value.replaceAll("'", "''") + "'";
const rows = source.parts.map((part, i) => {
  if (part.part !== i + 1 || Array.from(part.body).length > 12000 || !part.body.trim()) throw new Error('Invalid or incomplete part');
  const cover = ['project', 'mystery', 'farewell'][Math.floor(i / 3)];
  return `(${part.part},${quote(part.title)},${quote(part.body)},${quote(source.source + '#' + part.source_anchor)},'/images/otrada-${cover}.png')`;
});
const sql = `BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SELECT pg_advisory_xact_lock(674923012);
CREATE TEMP TABLE otrada_import(part integer PRIMARY KEY,title text,body text,source_url text,cover_image text) ON COMMIT DROP;
INSERT INTO otrada_import VALUES ${rows.join(',\n')};
DO $import$
DECLARE publisher_id bigint; existing_count integer; total_count integer; daily_count integer;
BEGIN
  SELECT id INTO STRICT publisher_id FROM registered_users WHERE nickname=${quote(publisher)} AND NOT is_game_guest FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM registered_users WHERE id=publisher_id AND public_message_count>=50 AND chat_seconds>=18000) THEN RAISE EXCEPTION 'Publisher must have Kinoman rank'; END IF;
  SELECT count(*) INTO existing_count FROM library_articles WHERE user_id=publisher_id AND series=${quote(source.series)};
  IF existing_count > 0 THEN
    IF existing_count <> 9 OR EXISTS (
      SELECT 1 FROM otrada_import i LEFT JOIN library_articles a ON a.user_id=publisher_id AND a.series=${quote(source.series)} AND a.part_number=i.part
      WHERE a.id IS NULL OR a.title<>i.title OR a.body<>i.body OR a.work_author<>'Uniform' OR a.source_url<>i.source_url OR a.cover_image<>i.cover_image
    ) THEN RAISE EXCEPTION 'Existing Otrada content differs: import refused, nothing overwritten'; END IF;
    RAISE NOTICE 'All nine parts already imported identically; no changes';
    RETURN;
  END IF;
  SELECT count(*),count(*) FILTER(WHERE inserted_at >= (NOW() AT TIME ZONE 'UTC')-INTERVAL '1 day') INTO total_count,daily_count FROM library_articles WHERE user_id=publisher_id;
  IF total_count+9>50 OR daily_count+9>10 THEN RAISE EXCEPTION 'Library quota would be exceeded'; END IF;
  INSERT INTO library_articles(user_id,title,body,series,part_number,work_author,source_url,cover_image,inserted_at,updated_at)
    SELECT publisher_id,title,body,${quote(source.series)},part,'Uniform',source_url,cover_image,NOW() AT TIME ZONE 'UTC',NOW() AT TIME ZONE 'UTC' FROM otrada_import ORDER BY part;
END $import$;
SELECT part_number,title,work_author,length(body) AS characters FROM library_articles WHERE user_id=(SELECT id FROM registered_users WHERE nickname=${quote(publisher)}) AND series=${quote(source.series)} ORDER BY part_number;
COMMIT;
`;
if (process.argv.includes('--manifest')) {
  console.log(JSON.stringify({source:source.source,publisher,author:source.author,parts:source.parts.map(p=>({part:p.part,characters:p.body.length,sha256:createHash('sha256').update(p.body).digest('hex')}))},null,2));
} else {
  process.stdout.write(sql);
}
