# Назначение файла: web-представление бинарных изображений в формате data URL.
defmodule ChatWeb.Media do
  @moduledoc false

  def data_url(nil, _content_type), do: nil

  def data_url(bytes, content_type) when is_binary(bytes) and is_binary(content_type) do
    "data:#{content_type};base64,#{Base.encode64(bytes)}"
  end
end
