defmodule ChatWeb.IconTest do
  use ExUnit.Case, async: true

  import Phoenix.LiveViewTest

  test "icons embed their shapes without CSS masks for every supported style" do
    for {name, size, fill} <- [
          {"hero-paper-clip", "24", "none"},
          {"hero-heart-solid", "24", "currentColor"},
          {"hero-heart-mini", "20", "currentColor"},
          {"hero-heart-micro", "16", "currentColor"}
        ] do
      html = render_component(&ChatWeb.CoreComponents.icon/1, name: name, class: "size-5")
      document = LazyHTML.from_fragment(html)

      assert 1 ==
               Enum.count(
                 LazyHTML.query(document, "svg[viewBox='0 0 #{size} #{size}'][fill='#{fill}']")
               )

      assert Enum.count(LazyHTML.query(document, "svg path")) > 0
      assert LazyHTML.attribute(LazyHTML.query(document, "svg"), "aria-hidden") == ["true"]

      refute name in (document
                      |> LazyHTML.query("svg")
                      |> LazyHTML.attribute("class")
                      |> hd()
                      |> String.split())
    end
  end

  test "unknown names cannot load arbitrary files or markup" do
    assert_raise KeyError, fn -> ChatWeb.Icons.fetch!("hero-../../config/runtime.exs") end
  end
end
