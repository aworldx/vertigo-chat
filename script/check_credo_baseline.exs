defmodule CredoBaseline do
  @baseline_path Path.expand("../apps/phoenix/.credo-baseline", __DIR__)

  def verify!(report_path) do
    expected = @baseline_path |> File.read!() |> entries()

    actual =
      report_path
      |> File.read!()
      |> Jason.decode!()
      |> Map.fetch!("issues")
      |> Enum.map(&issue_entry/1)
      |> MapSet.new()

    added = MapSet.difference(actual, expected)
    removed = MapSet.difference(expected, actual)

    if MapSet.size(added) > 0 or MapSet.size(removed) > 0 do
      report_difference("new", added)
      report_difference("resolved; remove it from .credo-baseline", removed)
      System.halt(1)
    end

    IO.puts("Credo baseline matches #{MapSet.size(expected)} recorded legacy issues.")
  end

  defp entries(contents) do
    contents
    |> String.split("\n", trim: true)
    |> Enum.reject(&String.starts_with?(&1, "#"))
    |> MapSet.new()
  end

  defp issue_entry(issue) do
    [issue["check"], issue["filename"], to_string(issue["line_no"]), issue["scope"]]
    |> Enum.join("\t")
  end

  defp report_difference(label, issues) do
    if MapSet.size(issues) > 0 do
      IO.puts(:stderr, "Credo issues #{label}:")
      issues |> Enum.sort() |> Enum.each(&IO.puts(:stderr, "  #{&1}"))
    end
  end
end

case System.argv() do
  [report_path] -> CredoBaseline.verify!(report_path)
  _ -> raise "usage: elixir script/check_credo_baseline.exs CREDO_JSON_REPORT"
end
