# Назначение файла: тесты разбора текстовых команд чата.
defmodule Chat.CommandsTest do
  use ExUnit.Case, async: true

  alias Chat.Commands

  test "parses supported commands" do
    assert {:ok, :help} = Commands.parse("/помощь")
    assert {:ok, :who} = Commands.parse("/кто")
    assert {:ok, :exit} = Commands.parse("/выход")
    assert {:ok, :ignores} = Commands.parse("/игноры")
    assert {:ok, :clear} = Commands.parse("/очистить")
    assert {:ok, {:info, "Чатлан_1"}} = Commands.parse("/инфо Чатлан_1")
    assert {:ok, {:toggle_ignore, "Чатлан_1"}} = Commands.parse("/игнор Чатлан_1")
    assert {:ok, {:music, "Bakr Привет"}} = Commands.parse("/музыка Bakr Привет")
    assert {:ok, {:music, "Daft Punk"}} = Commands.parse("/music Daft Punk")
    assert {:ok, {:gif, "аплодисменты"}} = Commands.parse("/гиф аплодисменты")
  end

  test "does not treat ordinary messages as commands" do
    assert :not_command = Commands.parse("Привет, чат!")
  end

  test "reports invalid commands and nicknames" do
    assert {:error, :unknown_command} = Commands.parse("/неизвестно")
    assert {:error, :nickname_required} = Commands.parse("/инфо")
    assert {:error, :nickname_required} = Commands.parse("/игнор не подходит")
    assert {:error, :music_query_required} = Commands.parse("/музыка")
    assert {:error, :gif_query_required} = Commands.parse("/гиф")
  end
end
