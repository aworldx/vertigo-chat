# Strict, line-specific legacy baseline captured on 2026-09-22 with Dialyxir 1.4.8.
# Remove an entry in the same change that resolves its warning; `--list-unused-filters`
# in precommit makes stale entries fail the gate.
[
  {"lib/chat/admin.ex", "Unknown type: Chat.Accounts.User.t/0."},
  {"lib/chat/admin.ex", "Unknown type: Chat.Feedback.Entry.t/0."},
  {"lib/chat/bot/open_ai.ex",
   "The pattern variable __unexpected@1 can never match the type, because it is covered by previous clauses."},
  {"lib/chat/games.ex", "Type mismatch in call without opaque term in member?."},
  {"lib/chat/games.ex", "Type mismatch in call with opaque term in path_from?."},
  {"lib/chat/gifs.ex",
   "The pattern variable __unexpected@1 can never match the type, because it is covered by previous clauses."},
  {"lib/chat/music.ex",
   "The pattern variable __unexpected@1 can never match the type, because it is covered by previous clauses."},
  {"lib/chat/sessions.ex",
   "The pattern variable _result@1 can never match the type, because it is covered by previous clauses."},
  {"lib/chat/you_tube.ex",
   "The pattern variable __query@1 can never match the type, because it is covered by previous clauses."},
  {"test/support/conn_case.ex", "Function ExUnit.Callbacks.__merge__/4 does not exist."},
  {"test/support/conn_case.ex", "Function ExUnit.Callbacks.__noop__/0 does not exist."},
  {"test/support/conn_case.ex", "Function ExUnit.CaseTemplate.__proxy__/2 does not exist."},
  {"test/support/data_case.ex", "Function ExUnit.Callbacks.__merge__/4 does not exist."},
  {"test/support/data_case.ex", "Function ExUnit.Callbacks.__noop__/0 does not exist."},
  {"test/support/data_case.ex", "Function ExUnit.CaseTemplate.__proxy__/2 does not exist."},
  {"test/support/data_case.ex", "Function ExUnit.Callbacks.on_exit/1 does not exist."}
]
