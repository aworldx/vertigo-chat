# Назначение файла: маршруты приложения и browser/api pipelines.
defmodule ChatWeb.Router do
  use ChatWeb, :router

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_live_flash
    plug :put_root_layout, html: {ChatWeb.Layouts, :root}
    plug :protect_from_forgery

    plug ChatWeb.MediaPolicy
  end

  pipeline :media do
    plug :put_secure_browser_headers
  end

  scope "/", ChatWeb do
    pipe_through :media

    get "/robots.txt", RobotsController, :show
    get "/sitemap.xml", SitemapController, :show
    get "/gif-proxy", GifProxyController, :show
    get "/music-proxy", MusicProxyController, :show
    get "/profiles/:nickname/photo/thumbnail", ProfilePhotoController, :thumbnail
    get "/profiles/:nickname/photo", ProfilePhotoController, :show
    get "/gallery/photos/:id/thumbnail", GalleryPhotoController, :thumbnail
    get "/gallery/photos/:id", GalleryPhotoController, :show
    get "/music-chart/tracks/:id", MusicChartTrackController, :show
    get "/emojis/:id", EmojiController, :show
  end

  scope "/", ChatWeb do
    pipe_through :browser

    post "/account/login", AccountController, :login
    post "/account/chat-login", AccountController, :chat_login
    post "/account/logout", AccountController, :logout

    live_session :account, on_mount: [{ChatWeb.AccountAuth, :default}] do
      live "/", LandingLive, :show
      live "/about", LandingLive, :show
      live "/articles", ArticlesLive, :index
      live "/articles/chats-vs-messengers", ArticlesLive, :show
      live "/articles/chat-platforms-russia", ArticlesLive, :history
      live "/articles/how-vertigo-chat-works", ArticlesLive, :technology
      live "/chat", RoomLive, :show
      get "/admin", AdminController, :index
      post "/admin/login", AdminController, :login
      post "/admin/emojis", AdminController, :upload_emoji
      post "/admin/emojis/:id", AdminController, :moderate_emoji
      delete "/admin/emojis/:id", AdminController, :delete_emoji
      post "/admin/emoji-tags", AdminController, :create_emoji_tag
      post "/admin/emoji-tags/:id", AdminController, :update_emoji_tag
      delete "/admin/emoji-tags/:id", AdminController, :delete_emoji_tag
      live "/profiles", ProfilesLive, :index
      live "/gallery", GalleryLive, :index
      live "/music-chart", MusicChartLive, :index
      live "/visits", VisitsLive, :index
      live "/help", RanksLive, :index
      live "/ranks", RanksLive, :index
      live "/library", LibraryLive, :index
      live "/games", GamesLive, :index
      live "/games/:kind", GamesLive, :show
      live "/checkers", CheckersLive, :index
    end
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
