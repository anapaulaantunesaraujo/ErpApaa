"use client";

import React, { forwardRef, InputHTMLAttributes } from "react";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
  description?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, className = "", id, ...props }, ref) => {
    const inputId = id || (typeof label === "string" ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <label
        htmlFor={inputId}
        className="flex items-start gap-2.5 text-sm text-muted-foreground select-none cursor-pointer group"
      >
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          className={`h-4 w-4 mt-0.5 rounded border-input text-primary focus:ring-highlight/30 accent-primary cursor-pointer transition-colors ${className}`}
          {...props}
        />
        {(label || description) && (
          <div className="flex flex-col">
            {label && (
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors leading-tight">
                {label}
              </span>
            )}
            {description && (
              <span className="text-xs text-muted-foreground/75 mt-0.5">{description}</span>
            )}
          </div>
        )}
      </label>
    );
  }
);

Checkbox.displayName = "Checkbox";
