defmodule ChatWeb.API.V1.AccountProfileJSON do
  alias ChatWeb.API.V1.ProfileJSON

  def show(assigns), do: ProfileJSON.show(assigns)
end
