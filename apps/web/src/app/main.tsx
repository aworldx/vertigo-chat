import { AdminPage } from "../pages/AdminPage"
import { ArticlesPage } from "../pages/ArticlesPage"
import { LibraryPage } from "../pages/LibraryPage"
import { GalleryPage } from "../pages/GalleryPage"
import { VisitsPage } from "../pages/VisitsPage"
import { AccountPage } from "../pages/AccountPage"
import { HelpPage } from "../pages/HelpPage"
import { MusicChartPage } from "../pages/MusicChartPage"
import React from "react"
import { createRoot } from "react-dom/client"
import { LoginPage } from "../pages/LoginPage"
import { ProfilesPage } from "../pages/ProfilesPage"
import { LandingPage } from "../pages/LandingPage"
import { ChatPage } from "../pages/ChatPage"
const container = document.getElementById("root")
const path = window.location.pathname
const help = path === "/help" || path === "/ranks"
const login = path.startsWith("/account/")
if (!path.startsWith("/articles"))
  document.title = `${path === "/admin" ? "Админка" : path === "/library" ? "Библиотека" : path === "/gallery" ? "Фотоальбом" : path === "/visits" ? "Кто был" : path === "/account" ? "Настройки аккаунта" : help ? "Помощь" : login ? "Вход" : path === "/music-chart" ? "Хит-парад" : path === "/profiles" ? "Анкеты" : path === "/chat" ? "Чат" : "Общение, знакомства и игры"} · Vertigo chat`
if (container)
  createRoot(container).render(
    path === "/admin" ? (
      <AdminPage />
    ) : path.startsWith("/articles") ? (
      <ArticlesPage />
    ) : path === "/library" ? (
      <LibraryPage />
    ) : path === "/gallery" ? (
      <GalleryPage />
    ) : path === "/visits" ? (
      <VisitsPage />
    ) : path === "/account" ? (
      <AccountPage />
    ) : help ? (
      <HelpPage />
    ) : path === "/music-chart" ? (
      <MusicChartPage />
    ) : login ? (
      <LoginPage registering={path === "/account/register"} />
    ) : path === "/profiles" ? (
      <ProfilesPage />
    ) : path === "/chat" ? (
      <ChatPage />
    ) : (
      <LandingPage />
    ),
  )
