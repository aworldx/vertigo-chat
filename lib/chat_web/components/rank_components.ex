defmodule ChatWeb.RankComponents do
  @moduledoc false

  use Phoenix.Component

  attr :rank, :map, required: true
  attr :class, :string, default: "size-4"

  def rank_icon(assigns) do
    ~H"""
    <img
      src={"/images/ranks/#{@rank.icon}.svg"}
      alt=""
      aria-hidden="true"
      class={["chat-rank-icon", @class]}
    />
    """
  end
end
