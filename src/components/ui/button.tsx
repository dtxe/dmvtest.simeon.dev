import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "default" | "outline" | "ghost" | "destructive";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "default" | "sm" | "icon";
}

export function Button({ className = "", variant = "default", size = "default", ...props }: ButtonProps) {
  return <button className={`button button-${variant} button-${size} ${className}`.trim()} {...props} />;
}
