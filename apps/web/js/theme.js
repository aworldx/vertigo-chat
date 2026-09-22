// Назначение файла: синхронизирует тему интерфейса с настройкой пользователя и системой.
const systemTheme = () => matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"

const setTheme = theme => {
  if (theme === "system") {
    localStorage.removeItem("phx:theme")
    document.documentElement.setAttribute("data-theme", systemTheme())
    document.documentElement.setAttribute("data-theme-source", "system")
  } else {
    localStorage.setItem("phx:theme", theme)
    document.documentElement.setAttribute("data-theme", theme)
    document.documentElement.setAttribute("data-theme-source", "user")
  }
}

if (!document.documentElement.hasAttribute("data-theme")) {
  setTheme(localStorage.getItem("phx:theme") || "system")
}

window.addEventListener("storage", event => {
  if (event.key === "phx:theme") setTheme(event.newValue || "system")
})

window.addEventListener("phx:set-theme", event => setTheme(event.target.dataset.phxTheme))

matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (document.documentElement.getAttribute("data-theme-source") === "system") {
    document.documentElement.setAttribute("data-theme", systemTheme())
  }
})
