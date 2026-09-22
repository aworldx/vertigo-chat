# Назначение файла: тесты получения случайного стартового слова из Русского Викисловаря.
defmodule Chat.Games.WiktionaryTest do
  use ExUnit.Case, async: false

  alias Chat.Games.Wiktionary

  setup do
    previous_config = Application.get_env(:chat, Wiktionary)

    Application.put_env(:chat, Wiktionary,
      endpoint: "https://ru.wiktionary.org/w/api.php",
      plug: {Req.Test, __MODULE__}
    )

    on_exit(fn -> Application.put_env(:chat, Wiktionary, previous_config) end)
    :ok
  end

  setup {Req.Test, :verify_on_exit!}

  test "selects a five-letter Russian word from random pages" do
    Req.Test.expect(__MODULE__, fn conn ->
      query = URI.decode_query(conn.query_string)

      assert query["generator"] == "random"
      assert query["grnnamespace"] == "0"
      assert query["grnlimit"] == "25"

      Req.Test.json(conn, %{
        "query" => %{
          "pages" => [
            %{"title" => "Википедия"},
            %{
              "title" => "Салат",
              "revisions" => [%{"slots" => %{"main" => %{"content" => "== {{-ru-}} =="}}}]
            }
          ]
        }
      })
    end)

    assert {:ok, "САЛАТ"} = Wiktionary.random_five_letter_word()
  end
end
