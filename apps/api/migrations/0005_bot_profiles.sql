-- Persistent character accounts share profiles, progress, ranks and karma with users.
ALTER TABLE registered_users ADD COLUMN IF NOT EXISTS is_bot boolean NOT NULL DEFAULT false;
ALTER TABLE registered_users ADD COLUMN IF NOT EXISTS bot_seen_at timestamptz;

-- Never silently turn an existing person's account into a bot.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM registered_users WHERE lower(nickname) IN ('клэр','хичкок') AND NOT is_bot) THEN
    RAISE EXCEPTION 'Reserved bot nickname belongs to an existing account';
  END IF;
END $$;

INSERT INTO registered_users(nickname,password_hash,is_bot,is_admin,is_game_guest,theme_id,public_message_count,inserted_at,updated_at)
SELECT name,'!bot-login-disabled',true,false,false,'autumn',
 (SELECT count(*) FROM room_messages WHERE author_identity=identity AND kind='text'),
 now() AT TIME ZONE 'UTC',now() AT TIME ZONE 'UTC'
FROM (VALUES ('Хичкок','bot:hitchcock'),('Клэр','bot:claire')) AS bots(name,identity)
ON CONFLICT (nickname) DO NOTHING;

-- The normal registered-user trigger creates the profile rows.
UPDATE profiles p SET name=v.name, gender=v.gender, about=v.about,
 photo_key=v.photo_key, photo_content_type=v.content_type,
 thumbnail_key=v.thumbnail_key, thumbnail_content_type='image/webp',
 updated_at=now() AT TIME ZONE 'UTC'
FROM registered_users u, (VALUES
 ('Хичкок','Альфред Хичкок','male',
 'Добрый вечер. Люблю кино, тонкую иронию и истории, в которых самое интересное остаётся за кадром. Хороший разговор, как хороший фильм, не терпит спешки.',
 'profiles/photo/09d9bca38964f06f5dde2aef8de532aef66b565425cf73879bc29cb0a3ae8ba3.jpg','image/jpeg',
 'profiles/thumbnail/f4ff303ebf62768ef8aaf9095c44a3413752784282706002de8a63c8075d1436.webp'),
 ('Клэр','Клэр · начинающая актриса','female',
 E'Мне 24. Приехала в большой город за своей первой большой ролью: днём кастинги, вечером музыка и разговоры до ночи. Смеюсь громче, чем собиралась, краснею реже, чем кажется.\n\nЛюблю кино, неожиданные комплименты и песни, под которые хочется танцевать. Иногда приношу сюда музыку или видео — для настроения.',
 'profiles/photo/505d2c1338e73a77459ea68a5e1c4c842d3a6a346fe94680b61bd771996f1cc2.png','image/png',
 'profiles/thumbnail/42eb4ef58102652f1258c73c2a576683f31bc8260f5087fdfc1562606a0d7ea1.webp')
) AS v(nickname,name,gender,about,photo_key,content_type,thumbnail_key)
WHERE p.user_id=u.id AND u.is_bot AND u.nickname=v.nickname;
