import React from "react";
import Image from "next/image";

export interface ApaaSymbolProps {
  className?: string;
  size?: number;
}

/**
 * Símbolo Oficial da APAA:
 * O "A" estilizado composto pelos arcos Azul Claro (#00A6FF),
 * Azul Tech (#0B3D91) e o detalhe dinâmico em Laranja (#FF7A00).
 */
export function ApaaSymbol({ className = "", size = 44 }: ApaaSymbolProps) {
  return (
    <div
      style={{ width: size, height: size }}
      className={`relative inline-flex items-center justify-center flex-shrink-0 select-none ${className}`}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-sm"
      >
        <defs>
          <linearGradient id="apaa-cyan-grad" x1="0%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%" stopColor="#00A6FF" />
            <stop offset="100%" stopColor="#2CD1FF" />
          </linearGradient>
          <linearGradient id="apaa-blue-grad" x1="30%" y1="0%" x2="70%" y2="100%">
            <stop offset="0%" stopColor="#0B3D91" />
            <stop offset="100%" stopColor="#0066CC" />
          </linearGradient>
          <linearGradient id="apaa-orange-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF9124" />
            <stop offset="100%" stopColor="#FF7A00" />
          </linearGradient>
        </defs>

        {/* Lado Esquerdo: Arco Curvo Azul Claro */}
        <path
          d="M 50 6 L 14 94 L 29 94 C 36 78, 44 60, 50 46 C 54 38, 54 22, 50 6 Z"
          fill="url(#apaa-cyan-grad)"
        />

        {/* Lâmina interna de sobreposição ciano/azul */}
        <path
          d="M 50 6 C 52 24, 46 44, 34 68 L 22 94 L 38 94 C 48 72, 55 48, 54 20 Z"
          fill="#0091E6"
          opacity="0.85"
        />

        {/* Separador e Lado Direito Superior: Azul Tech */}
        <path
          d="M 50 6 L 56 20 C 58 32, 55 46, 48 60 L 42 72 C 48 62, 55 52, 62 46 L 68 56 C 60 64, 52 74, 46 84 L 54 84 C 58 76, 64 68, 71 62 L 62 46 L 50 6 Z"
          fill="url(#apaa-blue-grad)"
        />

        {/* Lado Direito Inferior: Onda Dinâmica Laranja Oficial (#FF7A00) */}
        <path
          d="M 60 54 C 54 62, 48 72, 44 82 L 40 94 L 86 94 L 70 66 C 66 60, 62 56, 60 54 Z"
          fill="url(#apaa-orange-grad)"
        />

        {/* Curvatura orgânica do topo da chama laranja */}
        <path
          d="M 44 82 C 48 72, 56 62, 64 60 C 72 58, 78 68, 86 94 L 62 94 C 56 86, 50 82, 44 82 Z"
          fill="#FF7A00"
        />
      </svg>
    </div>
  );
}

export interface BrandMarkProps {
  className?: string;
  tone?: "dark" | "light";
  size?: number;
}

/**
 * BrandMark: O símbolo oficial da APAA encapsulado no container característico da marca
 */
export function BrandMark({ className = "", tone = "light", size = 44 }: BrandMarkProps) {
  const isDark = tone === "dark";

  return (
    <div
      style={{ width: size, height: size }}
      className={`relative flex items-center justify-center rounded-xl border select-none flex-shrink-0 transition-transform ${
        isDark
          ? "border-[#00A6FF]/40 bg-[#06152d]/80 shadow-sm"
          : "border-[#0B3D91]/15 bg-white shadow-sm"
      } ${className}`}
    >
      <div className="relative w-8 h-8 flex items-center justify-center">
        <ApaaSymbol size={32} />
      </div>
    </div>
  );
}

export interface WordmarkProps {
  className?: string;
  tone?: "dark" | "light";
}

/**
 * Wordmark Oficial da APAA:
 * Tipografia Montserrat com o acento laranja no último 'A' e
 * subtítulo institucional CONSULTORIA E DESENVOLVIMENTO.
 */
export function Wordmark({ className = "", tone = "light" }: WordmarkProps) {
  const isDark = tone === "dark";
  const mainColor = isDark ? "text-white" : "text-[#0B3D91]";
  const subColor = isDark ? "text-[#F5F7FA]/70" : "text-[#444A50]";

  return (
    <div className={`leading-none select-none ${className}`}>
      {/* Nome APAA em Montserrat com acento laranja oficial */}
      <div className="flex items-center text-lg font-display font-extrabold tracking-[0.25em] uppercase">
        <span className={mainColor}>APA</span>
        {/* Letra A com acento de triângulo laranja oficial */}
        <span className="relative inline-block">
          <span className={mainColor}>A</span>
          <span
            className="absolute top-[35%] left-[30%] w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-b-[5px] border-b-[#FF7A00]"
            aria-hidden
          />
        </span>
      </div>

      {/* Subtítulo Institucional */}
      <span className={`block text-[9.5px] tracking-[0.22em] uppercase font-medium mt-1 ${subColor}`}>
        Consultoria e Desenvolvimento
      </span>
    </div>
  );
}

export interface ApaaLogoProps {
  className?: string;
  tone?: "dark" | "light";
  size?: "sm" | "md" | "lg";
  layout?: "horizontal" | "vertical";
}

/**
 * Logo Completo Oficial (Símbolo + Wordmark)
 */
export function ApaaLogo({
  className = "",
  tone = "light",
  size = "md",
  layout = "horizontal",
}: ApaaLogoProps) {
  const symbolSizes = {
    sm: 34,
    md: 44,
    lg: 56,
  };

  const isVertical = layout === "vertical";

  return (
    <div
      className={`inline-flex ${
        isVertical ? "flex-col items-center text-center gap-3" : "items-center gap-3.5"
      } ${className}`}
    >
      <BrandMark tone={tone} size={symbolSizes[size]} />
      <Wordmark tone={tone} />
    </div>
  );
}

/**
 * Traços de circuito tecnológicos integrando Azul Claro e Laranja Oficial
 */
export function Circuit({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 340 220" fill="none" aria-hidden>
      <g stroke="currentColor" strokeWidth="1">
        <path d="M0 34h74l22-22h118" />
        <path d="M0 96h58l26-26h96l20-20h60" />
        <path d="M14 168h92l24-24h118" />
        <path d="M96 220v-34l22-22" />
        <path d="M210 220v-58l24-24h64" />
        <path d="M270 12h58" />
        <path d="M282 96h46" />
      </g>
      {/* Conexões e nós */}
      <g fill="currentColor">
        <circle cx="214" cy="12" r="3.5" />
        <circle cx="260" cy="50" r="3.5" />
        <circle cx="330" cy="96" r="3.5" />
        <circle cx="330" cy="12" r="3.5" />
        <circle cx="236" cy="138" r="3.5" />
        <circle cx="118" cy="142" r="3.5" />
        <circle cx="96" cy="186" r="3.5" />
        <circle cx="132" cy="70" r="2" />
      </g>
      {/* Destaque em Laranja da Marca nos nós principais */}
      <circle cx="214" cy="12" r="2" fill="#FF7A00" />
      <circle cx="236" cy="138" r="2" fill="#FF7A00" />
      <rect x="290" y="160" width="16" height="16" stroke="#FF7A00" strokeWidth="1" opacity="0.6" />
      <rect x="18" y="20" width="10" height="10" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
