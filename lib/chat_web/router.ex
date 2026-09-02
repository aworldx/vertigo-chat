# Назначение файла: маршруты приложения и browser/api pipelines.
defmodule ChatWeb.Router do
  use ChatWeb, :router

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_live_flash
    plug :put_root_layout, html: {ChatWeb.Layouts, :root}
    plug :protect_from_forgery

    plug :put_secure_browser_headers, %{
      "content-security-policy" =>
        "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' ws: wss:"
    }
  end

  pipeline :media do
    plug :put_secure_browser_headers
  end

  scope "/", ChatWeb do
    pipe_through :media

    get "/gif-proxy", GifProxyController, :show
    get "/music-proxy", MusicProxyController, :show
  end

  scope "/", ChatWeb do
    pipe_through :browser

    live "/", RoomLive, :show
    live "/profiles", ProfilesLive, :index
    live "/gallery", GalleryLive, :index
    live "/visits", VisitsLive, :index
    live "/help", RanksLive, :index
    live "/ranks", RanksLive, :index
    live "/library", LibraryLive, :index
    live "/checkers", CheckersLive, :index
  end

  # Enable LiveDashboard in development
  if Application.compile_env(:chat, :dev_routes) do
    # If you want to use the LiveDashboard in production, you should put
    # it behind authentication and allow only admins to access it.
    # If your application does not have an admins-only section yet,
    # you can use Plug.BasicAuth to set up some basic authentication
    # as long as you are also using SSL (which you should anyway).
    import Phoenix.LiveDashboard.Router

    scope "/dev" do
      pipe_through :browser

      live_dashboard "/dashboard", metrics: ChatWeb.Telemetry
    end
  end
end
