import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "primary" | "highlight" | "accent" | "tech" | "success" | "warning" | "danger" | "neutral";
  size?: "sm" | "md";
  dot?: boolean;
}

export function Badge({
  children,
  className = "",
  variant = "tech",
  size = "md",
  dot = false,
  ...props
}: BadgeProps) {
  const variantStyles = {
    // Selo Técnico JetBrains Mono
    tech: "font-mono bg-[#0B3D91]/5 text-muted-foreground border-border uppercase tracking-wider",
    // Azul Tech Oficial (#0B3D91)
    primary: "bg-[#0B3D91]/10 text-[#0B3D91] border-[#0B3D91]/25",
    // Azul Claro Oficial (#00A6FF)
    highlight: "bg-[#00A6FF]/15 text-[#0077CC] border-[#00A6FF]/35",
    // Laranja Oficial da Marca (#FF7A00)
    accent: "bg-[#FF7A00]/15 text-[#D96800] border-[#FF7A00]/40 font-semibold",
    // Estados Semânticos
    success: "bg-emerald-500/10 text-emerald-600 border-emerald-500/25",
    warning: "bg-[#FF7A00]/10 text-[#D96800] border-[#FF7A00]/30",
    danger: "bg-red-500/10 text-red-600 border-red-500/25",
    neutral: "bg-slate-100 text-slate-600 border-slate-200",
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-[10px] rounded-md",
    md: "px-2.5 py-1 text-[11px] rounded-md",
  };

  const dotColors = {
    tech: "bg-muted-foreground",
    primary: "bg-[#0B3D91]",
    highlight: "bg-[#00A6FF]",
    accent: "bg-[#FF7A00]",
    success: "bg-emerald-500",
    warning: "bg-[#FF7A00]",
    danger: "bg-red-500",
    neutral: "bg-slate-400",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium border ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotColors[variant]}`} />}
      <span>{children}</span>
    </span>
  );
}
