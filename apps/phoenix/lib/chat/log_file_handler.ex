# Назначение файла: постоянный файловый журнал production-приложения с ротацией средствами Erlang Logger.
defmodule Chat.LogFileHandler do
  @moduledoc false

  use GenServer

  require Logger

  @handler :chat_file_handler

  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts)
  end

  def handler_name, do: @handler

  @impl true
  def init(_opts) do
    case Application.get_env(:chat, __MODULE__) do
      nil ->
        :ignore

      config ->
        with :ok <- File.mkdir_p(Path.dirname(config[:path])),
             :ok <- :logger.add_handler(@handler, :logger_std_h, handler_config(config)) do
          {:ok, config}
        else
          {:error, reason} ->
            Logger.warning("file_log_handler_unavailable reason=#{inspect(reason)}")
            :ignore
        end
    end
  end

  @impl true
  def terminate(_reason, _config) do
    _result = :logger.remove_handler(@handler)
    :ok
  end

  defp handler_config(config) do
    %{
      config: %{
        file: String.to_charlist(config[:path]),
        max_no_bytes: config[:max_bytes],
        max_no_files: config[:max_files],
        compress_on_rotate: true,
        file_check: 1_000,
        filesync_repeat_interval: 5_000
      }
    }
  end
end
