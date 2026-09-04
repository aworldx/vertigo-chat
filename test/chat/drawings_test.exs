# Назначение файла: тесты временной синхронизации штрихов поверх сообщений.
defmodule Chat.DrawingsTest do
  use ExUnit.Case, async: true

  alias Chat.Drawings

  test "broadcasts a normalized drawing segment to room subscribers" do
    assert :ok = Drawings.subscribe("drawing-test")

    assert :ok =
             Drawings.broadcast_segment("drawing-test", "moon", %{
               "stroke_id" => "stroke_1",
               "started" => true,
               "points" => [%{"x" => 0.12345, "y" => 0.5}, %{"x" => 0.8, "y" => 0.25}]
             })

    assert_receive {:drawing_segment,
                    %{
                      "author" => "moon",
                      "stroke_id" => "stroke_1",
                      "started" => true,
                      "points" => [%{"x" => 0.1235, "y" => 0.5} | _rest]
                    }}
  end

  test "rejects malformed segments" do
    assert {:error, :invalid_segment} =
             Drawings.broadcast_segment("drawing-test-invalid", "moon", %{
               "stroke_id" => "bad stroke",
               "points" => [%{"x" => -1, "y" => 0}, %{"x" => 0, "y" => 0}]
             })
  end
end
