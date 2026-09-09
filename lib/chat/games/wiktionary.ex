# Назначение файла: проверка русских слов через общедоступный API Русского Викисловаря.
defmodule Chat.Games.Wiktionary do
  @behaviour Chat.Games.Dictionary

  @endpoint "https://ru.wiktionary.org/w/api.php"

  @impl true
  def valid?(word) when is_binary(word) do
    with {:ok, response} <- Req.get(endpoint(), request_options(word)),
         true <- response.status in 200..299,
         {:ok, body} <- decode_body(response.body) do
      {:ok, russian_entry?(body)}
    else
      _ -> {:error, :unavailable}
    end
  end

  defp endpoint do
    Application.get_env(:chat, __MODULE__, []) |> Keyword.get(:endpoint, @endpoint)
  end

  defp request_options(word) do
    config = Application.get_env(:chat, __MODULE__, [])

    options = [
      params: [
        action: "query",
        format: "json",
        formatversion: 2,
        prop: "revisions",
        rvprop: "content",
        rvslots: "main",
        redirects: 1,
        titles: String.downcase(word)
      ],
      headers: [{"api-user-agent", "VertigoChat/1.0 (word validation)"}],
      receive_timeout: Keyword.get(config, :receive_timeout, 3_000),
      retry: false
    ]

    if config[:plug], do: Keyword.put(options, :plug, config[:plug]), else: options
  end

  defp decode_body(body) when is_map(body), do: {:ok, body}
  defp decode_body(body) when is_binary(body), do: Jason.decode(body)
  defp decode_body(_body), do: {:error, :invalid_response}

  defp russian_entry?(%{"query" => %{"pages" => pages}}) when is_list(pages) do
    Enum.any?(pages, fn page ->
      page
      |> get_in(["revisions", Access.at(0), "slots", "main", "content"])
      |> russian_section?()
    end)
  end

  defp russian_entry?(_body), do: false

  defp russian_section?(content) when is_binary(content) do
    Regex.match?(~r/^={1,6}\s*\{\{-ru-\}\}\s*={1,6}$/mu, content)
  end

  defp russian_section?(_content), do: false
end
