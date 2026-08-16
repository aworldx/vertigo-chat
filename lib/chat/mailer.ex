# Назначение файла: модуль отправки email через Swoosh, пригодится для регистрации и уведомлений.
defmodule Chat.Mailer do
  use Swoosh.Mailer, otp_app: :chat
end
