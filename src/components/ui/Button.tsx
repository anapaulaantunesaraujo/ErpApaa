"use client";

import React, { forwardRef, ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "accent" | "highlight" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  fullWidth?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className = "",
      variant = "primary",
      size = "md",
      loading = false,
      fullWidth = false,
      disabled,
      iconLeft,
      iconRight,
      ...props
    },
    ref
  ) => {
    // Variantes baseadas no Manual de Identidade Visual da APAA
    const variantStyles = {
      // Azul Tech Oficial (#0B3D91)
      primary:
        "bg-primary text-white shadow-elegant hover:bg-primary-hover active:scale-[0.99] border border-transparent",
      // Laranja Oficial da Marca (#FF7A00)
      accent:
        "bg-accent text-white shadow-accent hover:bg-accent-hover active:scale-[0.99] border border-transparent",
      // Azul Claro Oficial (#00A6FF)
      highlight:
        "bg-highlight text-white font-medium hover:bg-highlight-hover shadow-sm border border-transparent",
      // Secundário Suave
      secondary:
        "bg-[#0B3D91]/10 text-primary hover:bg-[#0B3D91]/15 border border-primary/20",
      // Contorno / Neutro
      outline:
        "border border-border bg-card text-foreground hover:bg-slate-50 hover:border-slate-300 shadow-sm",
      ghost:
        "text-muted-foreground hover:text-foreground hover:bg-slate-100 border border-transparent",
      danger:
        "bg-red-600 text-white hover:bg-red-700 border border-transparent",
    };

    // Estilos de tamanho
    const sizeStyles = {
      sm: "h-9 px-3.5 text-xs rounded-lg gap-1.5",
      md: "h-[46px] px-5 text-sm rounded-[10px] gap-2",
      lg: "h-12 px-6 text-base rounded-xl gap-2.5",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`group inline-flex items-center justify-center font-medium transition-all duration-200 select-none cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed ${
          fullWidth ? "w-full" : ""
        } ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-current" />
            <span>{typeof children === "string" && !children.endsWith("...") ? `${children}...` : children}</span>
          </>
        ) : (
          <>
            {iconLeft && <span className="flex-shrink-0">{iconLeft}</span>}
            <span>{children}</span>
            {iconRight && (
              <span className="flex-shrink-0 transition-transform duration-200 group-hover:translate-x-1">
                {iconRight}
              </span>
            )}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
