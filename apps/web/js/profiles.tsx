import React from "react"
import { createRoot } from "react-dom/client"
import ProfilesApp from "../src/features/profiles"

const container = document.getElementById("react-profiles-root")
if (container)
  createRoot(container).render(
    <ProfilesApp csrfToken={document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? ""} />,
  )
