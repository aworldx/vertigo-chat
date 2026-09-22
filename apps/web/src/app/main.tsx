import React from "react"
import { createRoot } from "react-dom/client"
import { LoginPage } from "../pages/LoginPage"
import { ProfilesPage } from "../pages/ProfilesPage"
import { LandingPage } from "../pages/LandingPage"
import { ChatPage } from "../pages/ChatPage"
const container = document.getElementById("root")
const path = window.location.pathname
const login = path.startsWith("/account/")
document.title = `${login ? "Вход" : path === "/profiles" ? "Анкеты" : path === "/chat" ? "Чат" : "Общение, знакомства и игры"} · Vertigo chat`
if (container)
  createRoot(container).render(
    login ? (
      <LoginPage registering={path === "/account/register"} />
    ) : path === "/profiles" ? (
      <ProfilesPage />
    ) : path === "/chat" ? (
      <ChatPage />
    ) : (
      <LandingPage />
    ),
  )
