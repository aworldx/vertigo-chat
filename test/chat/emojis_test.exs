defmodule Chat.EmojisTest do
  use Chat.DataCase, async: true

  alias Chat.Emojis
  alias Chat.Emojis.{Emoji, Tag}
  alias Chat.Repo

  test "limits submitted emoji files to 700 KB and 100 pixels" do
    assert Emojis.max_bytes() == 700_000
    assert Emojis.max_size() == 100
  end

  test "includes an emoji shortcode in autosuggestion terms" do
    emoji =
      Repo.insert!(%Emoji{
        code: ":массаж:",
        image: <<1>>,
        content_type: "image/gif",
        status: :approved,
        width: 1,
        height: 1,
        animated: false
      })

    tag = Repo.insert!(%Tag{name: "расслабление", triggers: ["отдохнуть"]})
    Repo.insert_all("emoji_tag_assignments", [%{emoji_id: emoji.id, emoji_tag_id: tag.id}])

    suggested = Enum.find(Emojis.list(), &(&1.id == emoji.id)).suggestion_terms

    assert ":массаж:" in suggested
    assert "массаж" in suggested
    assert "расслабление" in suggested
    assert "отдохнуть" in suggested
  end

  test "finds an emoji by a Russian word stem in its tag trigger" do
    emoji =
      Repo.insert!(%Emoji{
        code: ":трясу:",
        image: <<1>>,
        content_type: "image/gif",
        status: :approved,
        width: 1,
        height: 1,
        animated: false
      })

    tag = Repo.insert!(%Tag{name: "трясу", triggers: ["трясусь"]})
    Repo.insert_all("emoji_tag_assignments", [%{emoji_id: emoji.id, emoji_tag_id: tag.id}])

    assert ":трясу:" in Emojis.autosuggest_codes("тряс")
    assert ":трясу:" in Emojis.autosuggest_codes("я трясусь")
  end
end
