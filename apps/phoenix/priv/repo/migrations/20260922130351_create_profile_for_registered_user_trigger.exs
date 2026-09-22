defmodule Chat.Repo.Migrations.CreateProfileForRegisteredUserTrigger do
  use Ecto.Migration

  def up do
    execute("""
    CREATE FUNCTION create_profile_for_registered_user()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      INSERT INTO profiles (user_id, inserted_at, updated_at)
      VALUES (NEW.id, NOW(), NOW())
      ON CONFLICT (user_id) DO NOTHING;

      RETURN NEW;
    END;
    $$;
    """)

    execute("""
    CREATE TRIGGER create_profile_for_registered_user
    AFTER INSERT ON registered_users
    FOR EACH ROW
    WHEN (NEW.is_game_guest = false)
    EXECUTE FUNCTION create_profile_for_registered_user();
    """)
  end

  def down do
    execute("DROP TRIGGER create_profile_for_registered_user ON registered_users")
    execute("DROP FUNCTION create_profile_for_registered_user()")
  end
end
