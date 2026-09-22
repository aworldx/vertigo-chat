# Назначение файла: адаптер OpenAI Responses API для ответов и памяти Хичкока.
defmodule Chat.Bot.OpenAI do
  @behaviour Chat.Bot.Provider

  require Logger

  alias Chat.Bot.Provider.Result

  @endpoint "https://api.openai.com/v1/responses"

  @impl true
  def generate(instructions, messages, opts) do
    request_options = [
      max_output_tokens: Keyword.get(opts, :max_output_tokens, 320),
      safety_identifier: Keyword.get(opts, :safety_identifier)
    ]

    case request(instructions, messages, request_options) do
      {:error, :empty_response} ->
        Logger.warning("bot_openai_empty_response retry=current_message")
        request(instructions, recovery_messages(messages), request_options)

      result ->
        result
    end
  end

  @impl true
  def summarize(previous_summary, messages, opts) do
    instructions = """
    Обнови долговременную память о собеседнике на русском языке.
    Сохраняй только устойчивые факты, предпочтения, важные события и характер общения.
    Не сохраняй пароли, контакты, адреса и другие чувствительные данные.
    Верни только краткое резюме не длиннее 700 символов.

    Предыдущая память:
    #{previous_summary}
    """

    request(instructions, messages,
      max_output_tokens: 220,
      safety_identifier: Keyword.get(opts, :safety_identifier)
    )
  end

  defp request(instructions, messages, opts) do
    config = Application.get_env(:chat, __MODULE__, [])

    case config[:api_key] do
      api_key when is_binary(api_key) and api_key != "" ->
        case Req.post(
               config[:endpoint] || @endpoint,
               request_options(config, api_key, instructions, messages, opts)
             ) do
          {:ok, response} -> response_result(response)
          {:error, _reason} = error -> error
          _unexpected -> {:error, :provider_unavailable}
        end

      _missing_api_key ->
        {:error, :not_configured}
    end
  end

  defp response_result(response) do
    with :ok <- successful_status(response.status),
         {:ok, text} <- output_text(response.body),
         {:ok, usage} <- usage(response.body) do
      {:ok, %Result{text: text, usage: usage}}
    else
      {:error, :empty_response} = error ->
        log_empty_response(response)
        error

      {:error, _reason} = error ->
        error
    end
  end

  defp recovery_messages([]), do: []
  defp recovery_messages(messages), do: [List.last(messages)]

  defp payload(config, instructions, messages, opts) do
    %{
      "model" => config[:model] || "gpt-5.6-terra",
      "instructions" => instructions,
      "input" => Enum.map(messages, &provider_message/1),
      "max_output_tokens" => opts[:max_output_tokens],
      "reasoning" => %{"effort" => "none"},
      "text" => %{"verbosity" => "low"},
      "store" => false,
      "safety_identifier" => opts[:safety_identifier]
    }
    |> Enum.reject(fn {_key, value} -> is_nil(value) end)
    |> Map.new()
  end

  defp request_options(config, api_key, instructions, messages, opts) do
    [
      auth: {:bearer, api_key},
      json: payload(config, instructions, messages, opts),
      receive_timeout: Keyword.get(config, :receive_timeout, 120_000),
      retry: Keyword.get(config, :retry, :transient)
    ]
    |> then(fn request_options ->
      if config[:plug],
        do: Keyword.put(request_options, :plug, config[:plug]),
        else: request_options
    end)
  end

  defp provider_message(%{role: role, body: body}) do
    %{"role" => to_string(role), "content" => body}
  end

  defp successful_status(status) when status in 200..299, do: :ok
  defp successful_status(429), do: {:error, {:rate_limited, 60_000}}
  defp successful_status(_status), do: {:error, :provider_unavailable}

  defp output_text(%{"output" => output}) when is_list(output) do
    text =
      output
      |> Enum.flat_map(&Map.get(&1, "content", []))
      |> Enum.filter(&(Map.get(&1, "type") == "output_text"))
      |> Enum.map_join("", &Map.get(&1, "text", ""))
      |> String.trim()

    if text == "", do: {:error, :empty_response}, else: {:ok, text}
  end

  defp output_text(_body), do: {:error, :empty_response}

  defp log_empty_response(response) do
    output = Map.get(response.body, "output", [])

    Logger.warning(
      "bot_openai_empty_response " <>
        "http_status=#{response.status} " <>
        "response_status=#{inspect(Map.get(response.body, "status"))} " <>
        "incomplete_details=#{inspect(Map.get(response.body, "incomplete_details"))} " <>
        "output=#{inspect(output_metadata(output))}"
    )
  end

  defp output_metadata(output) when is_list(output) do
    Enum.map(output, fn item ->
      %{
        type: Map.get(item, "type"),
        status: Map.get(item, "status"),
        incomplete_details: Map.get(item, "incomplete_details"),
        content_types: Enum.map(Map.get(item, "content", []), &Map.get(&1, "type"))
      }
    end)
  end

  defp output_metadata(_output), do: :invalid

  defp usage(%{
         "usage" => %{
           "input_tokens" => input_tokens,
           "output_tokens" => output_tokens,
           "total_tokens" => total_tokens
         }
       })
       when is_integer(input_tokens) and is_integer(output_tokens) and is_integer(total_tokens) do
    {:ok, %{input_tokens: input_tokens, output_tokens: output_tokens, total_tokens: total_tokens}}
  end

  defp usage(_body), do: {:error, :usage_unavailable}
end
