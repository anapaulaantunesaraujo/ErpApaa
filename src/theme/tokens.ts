/**
 * APAA CONSULTORIA E DESENVOLVIMENTO
 * Manual Oficial da Marca — Design Tokens Centralizados
 * 
 * Cores, Tipografia, Logos e Slogan oficiais da APAA:
 * - Azul Tech: #0B3D91 (Tecnologia, confiança, profissionalismo)
 * - Azul Claro: #00A6FF (Agilidade, modernidade, conexão)
 * - Laranja: #FF7A00 (Energia, criatividade, soluções, resultado)
 * - Cinza: #444A50 (Equilíbrio, estabilidade, segurança)
 * - Off White: #F5F7FA (Clareza, simplicidade, leveza)
 * - Tipografia: Montserrat (Títulos/Logotipo) + Open Sans (Textos/Apoio)
 */

export const themeTokens = {
  // Paleta de Cores Oficial da Marca APAA
  colors: {
    // Cores Primárias da Identidade
    techBlue: "#0B3D91",         // Azul Tech: tecnologia, confiança, profissionalismo
    techBlueHover: "#082e6e",
    lightBlue: "#00A6FF",        // Azul Claro: agilidade, modernidade, futuro
    lightBlueHover: "#0091e0",
    orange: "#FF7A00",           // Laranja: energia, criatividade, soluções, resultado
    orangeHover: "#e06b00",
    gray: "#444A50",             // Cinza: equilíbrio, estabilidade, segurança
    offWhite: "#F5F7FA",         // Off-white: clareza, simplicidade, leveza

    // Mapeamento Semântico para o Design System
    primary: "#0B3D91",          // Azul Tech como cor primária
    primaryHover: "#082e6e",     // Azul Tech escurecido para hover
    highlight: "#00A6FF",        // Azul Claro para acentos de interface e foco
    highlightHover: "#0091e0",
    accent: "#FF7A00",           // Laranja para destaque de alta energia e CTAs
    accentHover: "#e06b00",

    // Superfícies e Fundos
    background: "#F5F7FA",       // Fundo claro oficial (Off-white)
    foreground: "#0e1624",       // Títulos e textos de alto contraste
    mutedForeground: "#444A50",  // Cinza da marca para descrições, labels secundárias
    border: "#d8e0ea",           // Linhas e contornos sutis
    input: "#ccd5e0",            // Contorno padrão de campos de entrada
    card: "#ffffff",             // Fundo dos cartões e campos de entrada

    // Painel Tecnológico Escuro
    panel: "#06152d",            // Azul-marinho profundo derivado do Azul Tech
    panelForeground: "#F5F7FA",  // Texto sobre fundo escuro
    panelHighlight: "rgba(0, 166, 255, 0.35)",

    // Semântica de Estados
    success: "#10b981",          // Verde para status concluído
    warning: "#FF7A00",          // Laranja oficial da marca para alertas
    error: "#ef4444",            // Vermelho para erros
    info: "#00A6FF",             // Azul claro oficial
  },

  // Tipografia Oficial da Marca APAA
  fonts: {
    display: '"Montserrat", sans-serif',         // Títulos, logotipo e chamadas institucionais
    sans: '"Open Sans", sans-serif',             // Textos gerais, formulários e apoio
    mono: '"JetBrains Mono", monospace',         // Selos técnicos e códigos de projetos
  },

  // Slogan e Posicionamento Institucional
  brand: {
    name: "APAA",
    subtitle: "Consultoria e Desenvolvimento",
    slogan: "Soluções em tecnologia para o seu negócio ir mais longe.",
    subSlogan: "Tecnologia e estratégia para transformar o seu negócio.",
    positioning: "Consultoria em sistemas e desenvolvimento sob medida.",
    pillars: [
      {
        title: "Consultoria em Sistemas",
        desc: "Análise de processos, levantamento de requisitos, integrações e melhoria do uso dos sistemas empresariais.",
      },
      {
        title: "Desenvolvimento sob Medida",
        desc: "Aplicações personalizadas para necessidades operacionais específicas, automações e ferramentas internas.",
      },
      {
        title: "Integrações e Automação",
        desc: "Conexão entre sistemas, APIs, dados e processos para reduzir tarefas manuais e aumentar a produtividade.",
      },
    ],
  },

  // Cantos Arredondados
  radii: {
    sm: "6px",
    md: "8px",                  // Monograma
    lg: "10px",                 // Campos de formulário e botões
    xl: "14px",
    "2xl": "16px",              // Cartões e Hero
    full: "9999px",             // Badges
  },

  // Sombras Padronizadas
  shadows: {
    sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    md: "0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05)",
    elegant: "0 20px 50px -20px rgba(11, 61, 145, 0.4)", // Sombra difusa em Azul Tech
    card: "0 10px 30px -10px rgba(11, 61, 145, 0.06)",
  },

  // Dimensões Padrão
  sizes: {
    fieldHeight: "46px",
    brandMark: "44px",
    formMax: "384px",
  },
} as const;

export type ThemeTokens = typeof themeTokens;
