import React from "react"
import {createRoot} from "react-dom/client"
import ProfilesApp from "./profiles/ProfilesApp"

const container = document.getElementById("react-profiles-root")
if (container) createRoot(container).render(<ProfilesApp />)
