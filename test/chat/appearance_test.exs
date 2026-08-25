# Назначение файла: тесты нормализации настроек внешнего вида чатланина.
defmodule Chat.AppearanceTest do
  use ExUnit.Case, async: true

  alias Chat.Appearance

  test "falls back to defaults for invalid appearance values" do
    assert Appearance.normalize(nil) == Appearance.default()

    assert Appearance.from_params(%{"appearance" => "invalid"}, Appearance.default()) ==
             Appearance.default()
  end

  test "normalizes submitted colors and ignores unknown modes" do
    appearance =
      Appearance.from_params(
        %{
          "appearance" => %{
            "dark" => %{"nickname_color" => "#AABBCC", "text_color" => "invalid"},
            "unknown" => %{"nickname_color" => "#000000"}
          }
        },
        Appearance.default()
      )

    assert appearance["dark"]["nickname_color"] == "#aabbcc"
    assert appearance["dark"]["text_color"] == "#e4e4e7"
    refute Map.has_key?(appearance, "unknown")
  end

  test "normalizes the message frame preference" do
    refute Appearance.message_frame?(
             Appearance.from_params(
               %{"appearance" => %{"message_frame" => "false"}},
               Appearance.default()
             )
           )

    assert Appearance.message_frame?(Appearance.normalize(%{"message_frame" => "invalid"}))
  end
end
