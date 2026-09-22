defmodule ChatWeb.AdminHTML do
  use ChatWeb, :html
  embed_templates "admin_html/*"

  def admin_value(value) when is_binary(value) do
    if String.valid?(value), do: value, else: "<binary #{byte_size(value)} bytes>"
  end

  def admin_value(value), do: inspect(value)
end
