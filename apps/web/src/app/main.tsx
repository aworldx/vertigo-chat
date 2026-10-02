import { MessageHistoryPage } from "../pages/MessageHistoryPage"
import { TetrisPage } from "../pages/TetrisPage"
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
import { NotesPage } from "../pages/NotesPage"
import { PollsPage } from "../pages/PollsPage"
const container = document.getElementById("root")
const path = window.location.pathname
const help = path === "/help" || path === "/ranks"
const login = path.startsWith("/account/")
if (!path.startsWith("/articles"))
  document.title = `${path === "/history" ? "История сообщений" : path === "/admin" ? "Админка" : path === "/library" ? "Библиотека" : path === "/notes" ? "Записная книжка" : path === "/polls" ? "Опросы" : path === "/gallery" ? "Фотоальбом" : path === "/visits" ? "Кто был" : path === "/account" ? "Настройки аккаунта" : help ? "Помощь" : login ? "Вход" : path === "/music-chart" ? "Хит-парад" : path === "/profiles" ? "Анкеты" : path === "/chat" ? "Чат" : "Общение, знакомства и игры"} · Vertigo chat`
if (container)
  createRoot(container).render(
    path.startsWith("/games/tetris") ? (
      <TetrisPage />
    ) : path === "/admin" ? (
      <AdminPage />
    ) : path.startsWith("/articles") ? (
      <ArticlesPage />
    ) : path === "/library" ? (
      <LibraryPage />
    ) : path === "/notes" ? (
      <NotesPage />
    ) : path === "/polls" ? (
      <PollsPage />
    ) : path === "/gallery" ? (
      <GalleryPage />
    ) : path === "/history" ? (
      <MessageHistoryPage />
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
