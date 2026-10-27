"use client";

import React, { forwardRef, InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  extra?: React.ReactNode;
  icon?: React.ReactNode;
  rightAction?: React.ReactNode;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      extra,
      icon,
      rightAction,
      error,
      helperText,
      className = "",
      id,
      required,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full">
        {/* Cabeçalho do campo (Rótulo + Ação extra) */}
        {(label || extra) && (
          <div className="mb-2 flex items-center justify-between">
            {label && (
              <label
                htmlFor={inputId}
                className="text-sm font-medium text-foreground select-none"
              >
                {label}
              </label>
            )}
            {extra && <div>{extra}</div>}
          </div>
        )}

        {/* Container do Campo com Halo de foco oficial */}
        <div
          className={`flex h-[46px] items-center rounded-[10px] border bg-card transition-all focus-ring-apaa ${
            error ? "border-red-400 focus-within:border-red-500" : "border-input"
          }`}
        >
          {icon && (
            <span className="pl-3.5 pr-2 text-muted-foreground flex items-center justify-center flex-shrink-0">
              {icon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            required={required}
            className={`w-full bg-transparent py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 ${
              icon ? "pl-0" : "pl-3.5"
            } ${rightAction ? "pr-1" : "pr-3.5"} ${className}`}
            {...props}
          />

          {rightAction && (
            <div className="pr-2 flex items-center flex-shrink-0">
              {rightAction}
            </div>
          )}
        </div>

        {/* Mensagem de Erro ou Ajuda */}
        {error ? (
          <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1 animate-in fade-in duration-150">
            <span>•</span> {error}
          </p>
        ) : helperText ? (
          <p className="mt-1.5 text-xs text-muted-foreground">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = "Input";
