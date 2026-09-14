defmodule ChatWeb.AdminHTML do
  use ChatWeb, :html
  embed_templates "admin_html/*"

  def admin_value(value) when is_binary(value) do
    if String.valid?(value), do: value, else: "<binary #{byte_size(value)} bytes>"
  end

  def admin_value(value), do: inspect(value)

  def emoji_preview_style(%{width: width, height: height}, maximum)
      when is_integer(width) and width > 0 and is_integer(height) and height > 0 do
    scale = maximum / max(width, height)

    "width: #{Float.round(width * scale, 2)}px; height: #{Float.round(height * scale, 2)}px"
  end

  def emoji_preview_style(_emoji, maximum), do: "width: #{maximum}px; height: #{maximum}px"
end
