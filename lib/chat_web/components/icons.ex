defmodule ChatWeb.Icons do
  @moduledoc false

  # Only trusted, bundled SVGs are embedded. Names never become filesystem paths
  # at runtime, and no user-supplied markup is rendered.
  @icons (for {suffix, directory} <- [
                {"", "24/outline"},
                {"-solid", "24/solid"},
                {"-mini", "20/solid"},
                {"-micro", "16/solid"}
              ],
              path <- Path.wildcard("deps/heroicons/optimized/#{directory}/*.svg"),
              into: %{} do
            @external_resource path
            [_, root, body] = Regex.run(~r/\A<svg\s+([^>]+)>(.*)<\/svg>\s*\z/s, File.read!(path))

            attributes =
              for [_, key, value] <- Regex.scan(~r/([\w-]+)="([^"]*)"/, root),
                  key not in ["aria-hidden"],
                  into: %{},
                  do: {key, value}

            {"hero-" <> Path.basename(path, ".svg") <> suffix, {attributes, body}}
          end)

  def fetch!(name), do: Map.fetch!(@icons, name)
end
