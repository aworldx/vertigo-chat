# Назначение файла: разбор текстовых команд, которые не публикуются как сообщения в общей комнате.
defmodule Chat.Commands do
  @moduledoc """
  Parses chat commands entered with a leading slash.
  """

  @type command ::
          :help
          | :who
          | :exit
          | :ignores
          | :clear
          | {:info | :toggle_ignore | :music | :gif, String.t()}

  @spec parse(String.t()) :: :not_command | {:ok, command()} | {:error, atom()}
  def parse(body) when is_binary(body) do
    body = String.trim(body)

    case String.split(body, ~r/\s+/, parts: 2, trim: true) do
      [<<"/", command::binary>>] -> parse_command(command, nil)
      [<<"/", command::binary>>, argument] -> parse_command(command, argument)
      _other -> :not_command
    end
  end

  def parse(_body), do: :not_command

  defp parse_command("помощь", nil), do: {:ok, :help}
  defp parse_command("кто", nil), do: {:ok, :who}
  defp parse_command("выход", nil), do: {:ok, :exit}
  defp parse_command("игноры", nil), do: {:ok, :ignores}
  defp parse_command("очистить", nil), do: {:ok, :clear}

  defp parse_command(command, argument) when command in ["музыка", "music", "гиф", "gif"] do
    case argument && String.trim(argument) do
      query when is_binary(query) and query != "" ->
        command = if command in ["музыка", "music"], do: :music, else: :gif
        {:ok, {command, query}}

      _ ->
        error =
          if command in ["музыка", "music"], do: :music_query_required, else: :gif_query_required

        {:error, error}
    end
  end

  defp parse_command(command, argument) when command in ["инфо", "игнор"] do
    case normalize_nickname(argument) do
      nil -> {:error, :nickname_required}
      nickname -> {:ok, {if(command == "инфо", do: :info, else: :toggle_ignore), nickname}}
    end
  end

  defp parse_command(_command, _argument), do: {:error, :unknown_command}

  defp normalize_nickname(nil), do: nil

  defp normalize_nickname(nickname) do
    nickname = String.trim(nickname)

    if Regex.match?(~r/\A[\p{L}\p{N}_-]{3,24}\z/u, nickname), do: nickname, else: nil
  end
end
