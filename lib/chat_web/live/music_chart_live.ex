# Назначение файла: LiveView страницы общего музыкального хит-парада.
defmodule ChatWeb.MusicChartLive do
  use ChatWeb, :live_view

  import ChatWeb.AccountComponents

  alias Chat.MusicChart

  @impl true
  def mount(_params, _session, socket) do
    current_user = socket.assigns.current_account_user
    if connected?(socket), do: MusicChart.subscribe()

    {:ok,
     socket
     |> assign(:page_title, "Хит-парад музыки")
     |> assign(
       :meta_description,
       "Любимые треки чатлан Vertigo: загружайте музыку и голосуйте за неё."
     )
     |> assign(:canonical_path, ~p"/music-chart")
     |> assign(:current_user, current_user)
     |> assign(:upload_form, to_form(%{}, as: :music_chart))
     |> assign(:comment_form, to_form(%{}, as: :music_comment))
     |> allow_upload(:music_track,
       accept: ~w(.mp3 .ogg .wav),
       max_entries: 1,
       max_file_size: MusicChart.max_audio_bytes()
     )
     |> stream(:tracks, MusicChart.list_tracks(current_user))}
  end

  @impl true
  def handle_event("validate_music_track", %{"music_chart" => params}, socket) do
    {:noreply, assign(socket, :upload_form, to_form(params, as: :music_chart))}
  end

  def handle_event("validate_music_track", _params, socket), do: {:noreply, socket}

  def handle_event("upload_music_track", %{"music_chart" => params}, socket) do
    with %{} = user <- socket.assigns.current_user,
         {:ok, _track} <- consume_track(socket, user, params["title"]) do
      {:noreply,
       socket
       |> assign(:upload_form, to_form(%{}, as: :music_chart))
       |> refresh_tracks()
       |> put_flash(:info, "Трек добавлен в хит-парад.")}
    else
      {:error, :track_limit_reached} ->
        {:noreply,
         put_flash(
           socket,
           :error,
           "Можно загрузить не больше #{MusicChart.max_tracks_per_user()} треков."
         )}

      {:error, :invalid_title} ->
        {:noreply,
         put_flash(
           socket,
           :error,
           "Укажи название трека до #{MusicChart.max_title_length()} символов."
         )}

      {:error, :invalid_audio} ->
        {:noreply, put_flash(socket, :error, "Выбери исправный MP3, OGG или WAV до 20 МБ.")}

      _reason ->
        {:noreply, put_flash(socket, :error, "Не удалось добавить трек.")}
    end
  end

  def handle_event("toggle_music_like", %{"id" => id}, %{assigns: %{current_user: user}} = socket)
      when not is_nil(user) do
    with {track_id, ""} <- Integer.parse(id),
         {:ok, _state} <- MusicChart.toggle_like(user, track_id) do
      {:noreply, refresh_tracks(socket)}
    else
      {:error, :own_track} ->
        {:noreply, put_flash(socket, :error, "Свой трек уже в твоём личном топе.")}

      _reason ->
        {:noreply, put_flash(socket, :error, "Не удалось изменить голос.")}
    end
  end

  def handle_event("toggle_music_like", _params, socket) do
    {:noreply, put_flash(socket, :error, "Войди с зарегистрированным ником, чтобы голосовать.")}
  end

  def handle_event(
        "add_music_comment",
        %{"track_id" => id, "music_comment" => %{"body" => body}},
        %{assigns: %{current_user: user}} = socket
      )
      when not is_nil(user) do
    with {track_id, ""} <- Integer.parse(id),
         {:ok, _comment} <- MusicChart.add_comment(user, track_id, body) do
      {:noreply, refresh_tracks(socket)}
    else
      {:error, _changeset} ->
        {:noreply,
         put_flash(
           socket,
           :error,
           "Комментарий должен содержать текст и быть не длиннее #{MusicChart.max_comment_length()} символов."
         )}

      _reason ->
        {:noreply, put_flash(socket, :error, "Не удалось добавить комментарий.")}
    end
  end

  def handle_event("add_music_comment", _params, socket) do
    {:noreply,
     put_flash(socket, :error, "Войди с зарегистрированным ником, чтобы комментировать.")}
  end

  @impl true
  def handle_info(:music_chart_changed, socket), do: {:noreply, refresh_tracks(socket)}

  def audio_url(track), do: ~p"/music-chart/tracks/#{track.id}"

  def upload_error_message(:too_large), do: "Трек больше 20 МБ."
  def upload_error_message(:not_accepted), do: "Поддерживаются MP3, OGG и WAV."
  def upload_error_message(:too_many_files), do: "Добавляй по одному треку."
  def upload_error_message(_error), do: "Не удалось подготовить аудиофайл."

  def music_upload_errors(upload) do
    Phoenix.Component.upload_errors(upload) ++
      Enum.flat_map(upload.entries, &Phoenix.Component.upload_errors(upload, &1))
  end

  defp consume_track(socket, user, title) do
    case uploaded_entries(socket, :music_track) do
      {[_entry], []} ->
        [result] =
          consume_uploaded_entries(socket, :music_track, fn %{path: path}, entry ->
            {:ok, {File.read!(path), entry.client_type, entry.client_name}}
          end)

        {audio, content_type, client_name} = result
        MusicChart.add_track(user, track_title(title, client_name), audio, content_type)

      _entries ->
        {:error, :track_not_ready}
    end
  end

  defp track_title(title, client_name) do
    case String.trim(title || "") do
      "" -> Path.rootname(client_name)
      value -> value
    end
  end

  defp refresh_tracks(socket),
    do: stream(socket, :tracks, MusicChart.list_tracks(socket.assigns.current_user), reset: true)
end
