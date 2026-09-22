# Назначение файла: настройки тестового окружения и изолированной тестовой базы данных.
import Config

# Configure your database
#
# The MIX_TEST_PARTITION environment variable can be used
# to provide built-in test partitioning in CI environment.
# Run `mix help test` for more information.
config :chat, Chat.Repo,
  username: "amirhasanov",
  hostname: "localhost",
  database: "chat_test#{System.get_env("MIX_TEST_PARTITION")}",
  pool: Ecto.Adapters.SQL.Sandbox,
  pool_size: System.schedulers_online() * 2

# We don't run a server during test. If one is required,
# you can enable the server option below.
config :chat, ChatWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4002],
  secret_key_base: "SPy67nV7sYbBklrXT7oKe7B7wtWS5rO3ds2R9mEAfBhz0JQoQYonNnphDhI4y5fA",
  server: false

# Print only warnings and errors during test
config :logger, level: :warning

config :chat, Chat.Bot,
  provider: Chat.Bot.TestProvider,
  reply_delay_range_ms: {0, 0}

config :chat, Chat.Bot.Usage, daily_token_limit: 1_000_000, warning_percent: 90

config :chat, Chat.Karmik, enabled?: false
config :chat, Chat.Sessions.Reaper, enabled?: false
config :chat, :metrics_token, "test-metrics-token"

config :chat, Chat.Games.Dictionary, provider: Chat.Games.TestDictionary

# Initialize plugs at runtime for faster test compilation
config :phoenix, :plug_init_mode, :runtime

# Enable helpful, but potentially expensive runtime checks
config :phoenix_live_view,
  enable_expensive_runtime_checks: true

# Sort query params output of verified routes for robust url comparisons
config :phoenix,
  sort_verified_routes_query_params: true
