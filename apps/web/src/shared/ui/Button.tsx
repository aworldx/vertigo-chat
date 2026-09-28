import type { ComponentProps } from "react"

type ButtonProps = ComponentProps<"button"> & {
  variant?: "secondary" | "primary" | "quiet"
}

export function Button({ variant = "secondary", className = "", type = "button", ...props }: ButtonProps) {
  return <button {...props} type={type} className={`ui-button ui-button--${variant} ${className}`} />
}
