defmodule Chat.LogFileHandlerTest do
  use ExUnit.Case, async: false

  require Logger

  alias Chat.LogFileHandler

  setup do
    path = Path.join(System.tmp_dir!(), "chat-log-#{System.unique_integer([:positive])}.log")
    previous_config = Application.get_env(:chat, LogFileHandler)

    Application.put_env(:chat, LogFileHandler,
      path: path,
      max_bytes: 128,
      max_files: 2
    )

    on_exit(fn ->
      Application.put_env(:chat, LogFileHandler, previous_config)
      File.rm(path)
      File.rm(path <> ".0.gz")
      File.rm(path <> ".1.gz")
    end)

    %{path: path}
  end

  test "writes logs to a rotating file handler", %{path: path} do
    start_supervised!(LogFileHandler)

    Logger.warning("persistent_chat_log_test")
    Logger.flush()
    assert :ok = :logger_std_h.filesync(LogFileHandler.handler_name())

    assert File.read!(path) =~ "persistent_chat_log_test"

    assert {:ok, %{config: config}} = :logger.get_handler_config(LogFileHandler.handler_name())
    assert config.max_no_bytes == 128
    assert config.max_no_files == 2
    assert config.compress_on_rotate
  end
end
