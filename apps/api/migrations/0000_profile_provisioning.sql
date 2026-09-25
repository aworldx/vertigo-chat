-- The final legacy trigger was not deployed on all Phoenix installations.
-- Install it before bot accounts and Go registration need profile provisioning.
CREATE OR REPLACE FUNCTION create_profile_for_registered_user()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO profiles (user_id, inserted_at, updated_at)
  VALUES (NEW.id, NOW(), NOW())
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'registered_users'::regclass
      AND tgname = 'create_profile_for_registered_user' AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER create_profile_for_registered_user
    AFTER INSERT ON registered_users FOR EACH ROW
    WHEN (NEW.is_game_guest = false)
    EXECUTE FUNCTION create_profile_for_registered_user();
  END IF;
END $$;
