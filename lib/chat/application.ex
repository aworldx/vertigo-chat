# Назначение файла: OTP supervision tree, запускает Repo, PubSub, Presence и Phoenix Endpoint.
defmodule Chat.Application do
  # See https://elixir.hexdocs.pm/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = base_children() ++ role_children(Application.get_env(:chat, :runtime_role, :chat))
    Supervisor.start_link(children, strategy: :one_for_one, name: Chat.Supervisor)
  end

  defp base_children,
    do: [ChatWeb.Telemetry, Chat.Repo, Chat.LogFileHandler, {Phoenix.PubSub, name: Chat.PubSub}]

  defp role_children(:admin), do: [ChatWeb.Endpoint]

  defp role_children(_role) do
    [
      {DNSCluster, query: Application.get_env(:chat, :dns_cluster_query) || :ignore},
      Chat.Presence,
      Chat.Listening,
      Chat.Messages.Registry,
      {Chat.Sessions.Reaper, Application.get_env(:chat, Chat.Sessions.Reaper, [])},
      Chat.Visits.Janitor,
      Chat.Games.Janitor,
      Chat.Security.RateLimiter,
      Chat.Music.ProxyPool,
      Chat.YouTube.Cache,
      Chat.Bot.Status,
      {Task.Supervisor, name: Chat.Bot.TaskSupervisor},
      Chat.MediaShares.Registry,
      {Task.Supervisor, name: Chat.Karmik.TaskSupervisor},
      Chat.Karmik.Worker,
      ChatWeb.Endpoint
    ]
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    ChatWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
