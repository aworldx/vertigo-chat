defmodule ChatWeb.API.V1.ProfileController do
  use ChatWeb, :controller

  alias Chat.Profiles
  alias Chat.Profiles.GoAPI

  def index(conn, params) do
    if GoAPI.enabled?(), do: go_index(conn), else: elixir_index(conn, params)
  end

  def show(conn, %{"nickname" => nickname}) do
    if GoAPI.enabled?(), do: go_show(conn, nickname), else: elixir_show(conn, nickname)
  end

  defp elixir_index(conn, params) do
    with query when is_binary(query) <- Map.get(params, "q", ""),
         true <- String.length(query) <= 80,
         {page, ""} when page in 1..2_147_483_647 <- parse_page(params["page"]) do
      query = String.trim(query)
      result = Profiles.list_profiles(search: query, page: page)
      render(conn, :index, result: result, query: query)
    else
      _ ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{
          error: %{
            code: "invalid_params",
            message: "Укажи запрос до 80 символов и положительный номер страницы."
          }
        })
    end
  end

  defp elixir_show(conn, nickname) do
    case Profiles.get_by_nickname(nickname) do
      {:ok, profile} ->
        render(conn, :show, profile: profile)

      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: %{code: "not_found", message: "Анкета не найдена."}})
    end
  end

  defp go_index(conn) do
    case GoAPI.list(conn.query_string) do
      {:ok, status, body} -> conn |> put_status(status) |> json(body)
      {:error, :unavailable} -> go_unavailable(conn)
    end
  end

  defp go_show(conn, nickname) do
    case GoAPI.get(nickname) do
      {:ok, status, body} -> conn |> put_status(status) |> json(body)
      {:error, :unavailable} -> go_unavailable(conn)
    end
  end

  defp go_unavailable(conn) do
    conn
    |> put_status(:bad_gateway)
    |> json(%{error: %{code: "unavailable", message: "Сервис анкет временно недоступен."}})
  end

  defp parse_page(nil), do: {1, ""}
  defp parse_page(page) when is_binary(page), do: Integer.parse(page)
  defp parse_page(_page), do: :error
end
