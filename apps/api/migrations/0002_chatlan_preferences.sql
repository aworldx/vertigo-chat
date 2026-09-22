-- Chatlans owns guest preferences. Registered preferences remain owned by Accounts.
CREATE TABLE chatlan_preferences (
 identity_key text PRIMARY KEY,
 preferences jsonb NOT NULL DEFAULT '{}',
 updated_at timestamptz NOT NULL DEFAULT now()
);
