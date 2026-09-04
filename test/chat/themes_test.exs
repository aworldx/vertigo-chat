# Назначение файла: тесты списка доступных тем и преобразования удалённых тем.
defmodule Chat.ThemesTest do
  use ExUnit.Case, async: true

  alias Chat.Themes

  test "does not expose the retired light theme" do
    refute Enum.any?(Themes.list(), &(&1.id == "light"))
    assert Themes.normalize_theme_id("light") == "newspaper"
  end
end
