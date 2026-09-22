# Назначение файла: проверка русских слов через общедоступный API Русского Викисловаря.
defmodule Chat.Games.Wiktionary do
  @behaviour Chat.Games.Dictionary

  @endpoint "https://ru.wiktionary.org/w/api.php"
  @random_word_attempts 2
  @random_word_limit 25

  @impl true
  def valid?(word) when is_binary(word) do
    with {:ok, response} <- Req.get(endpoint(), valid_word_request_options(word)),
         true <- response.status in 200..299,
         {:ok, body} <- decode_body(response.body) do
      {:ok, russian_entry?(body)}
    else
      _ -> {:error, :unavailable}
    end
  end

  @impl true
  def random_five_letter_word do
    Enum.reduce_while(1..@random_word_attempts, :error, fn _, _result ->
      case random_five_letter_word_once() do
        {:ok, word} -> {:halt, {:ok, word}}
        :error -> {:cont, :error}
      end
    end)
  end

  defp endpoint do
    Application.get_env(:chat, __MODULE__, []) |> Keyword.get(:endpoint, @endpoint)
  end

  defp valid_word_request_options(word) do
    request_options(
      action: "query",
      format: "json",
      formatversion: 2,
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
      redirects: 1,
      titles: String.downcase(word)
    )
  end

  defp random_five_letter_word_once do
    with {:ok, response} <- Req.get(endpoint(), random_word_request_options()),
         true <- response.status in 200..299,
         {:ok, body} <- decode_body(response.body) do
      random_russian_word(body)
    else
      _ -> :error
    end
  end

  defp random_word_request_options do
    request_options(
      action: "query",
      format: "json",
      formatversion: 2,
      generator: "random",
      grnnamespace: 0,
      grnlimit: @random_word_limit,
      prop: "revisions",
      rvprop: "content",
      rvslots: "main"
    )
    |> Keyword.put(:receive_timeout, random_receive_timeout())
  end

  defp request_options(params) do
    config = Application.get_env(:chat, __MODULE__, [])

    options = [
      params: params,
      headers: [{"api-user-agent", "VertigoChat/1.0 (word validation)"}],
      receive_timeout: Keyword.get(config, :receive_timeout, 3_000),
      retry: false
    ]

    if config[:plug], do: Keyword.put(options, :plug, config[:plug]), else: options
  end

  defp random_receive_timeout do
    Application.get_env(:chat, __MODULE__, [])
    |> Keyword.get(:random_receive_timeout, 1_000)
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

  defp random_russian_word(%{"query" => %{"pages" => pages}}) when is_list(pages) do
    Enum.find_value(pages, :error, fn page ->
      word = page |> Map.get("title", "") |> String.trim() |> String.upcase()
      content = get_in(page, ["revisions", Access.at(0), "slots", "main", "content"])

      if String.match?(word, ~r/^[А-ЯЁ]{5}$/u) and russian_section?(content),
        do: {:ok, word}
    end)
  end

  defp random_russian_word(_body), do: :error
end
