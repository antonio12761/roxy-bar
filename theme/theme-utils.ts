import type { ThemeDefinition, ThemeMode, ThemeSettings } from "./theme-types"

// Funzione per inizializzare gli stili delle icone SVG
function initializeSvgIconStyles(): void {
  // Assicurati che il codice venga eseguito solo nel browser
  if (typeof document === "undefined") return

  // Verifica se gli stili sono già stati aggiunti
  if (document.getElementById("svg-icon-styles")) return

  // Crea un elemento style
  const styleElement = document.createElement("style")
  styleElement.id = "svg-icon-styles"

  // Aggiungi le regole CSS per le icone SVG
  styleElement.textContent = `
    .svg-icon-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .svg-icon {
      filter: brightness(0) saturate(100%);
      opacity: 0;
    }
    
    .svg-icon-wrapper::after {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: var(--text-accent);
      mask-image: var(--mask-image);
      -webkit-mask-image: var(--mask-image);
      mask-size: contain;
      -webkit-mask-size: contain;
      mask-position: center;
      -webkit-mask-position: center;
      mask-repeat: no-repeat;
      -webkit-mask-repeat: no-repeat;
    }
    
    .svg-icon-wrapper[data-icon="truck"]::after {
      --mask-image: url(/svg/truck.svg);
    }
    
    .svg-icon-wrapper[data-icon="rim"]::after {
      --mask-image: url(/svg/rim1.svg);
    }
  `

  // Aggiungi lo stile al documento
  document.head.appendChild(styleElement)
}

// Applica le variabili CSS del tema al documento
export function applyThemeVariables(theme: ThemeDefinition, mode: ThemeMode): void {
  const root = document.documentElement
  const colors = mode === "dark" ? theme.colors.dark : theme.colors.light

  // Background Colors
  root.style.setProperty("--bg-dark", colors.bg.dark)
  root.style.setProperty("--bg-card", colors.bg.card)
  root.style.setProperty("--bg-darker", colors.bg.darker)
  root.style.setProperty("--bg-hover", colors.bg.hover)
  root.style.setProperty("--bg-input", colors.bg.input)
  root.style.setProperty("--bg-accordion", colors.bg.accordion)
  root.style.setProperty("--bg-riepilogo", colors.bg.riepilogo)

  // Text Colors
  root.style.setProperty("--text-primary", colors.text.primary)
  root.style.setProperty("--text-secondary", colors.text.secondary)
  root.style.setProperty("--text-muted", colors.text.muted)
  root.style.setProperty("--text-icon", colors.text.icon)
  root.style.setProperty("--text-help", colors.text.help)
  root.style.setProperty("--text-accent", colors.text.accent)
  root.style.setProperty("--text-success", colors.text.success)
  root.style.setProperty("--text-error", colors.text.error)

  // Border Colors
  root.style.setProperty("--border-primary", colors.border.primary)
  root.style.setProperty("--border-secondary", colors.border.secondary)
  root.style.setProperty("--border-accent", colors.border.accent)
  root.style.setProperty("--border-success", colors.border.success)
  root.style.setProperty("--border-error", colors.border.error)

  // Button Colors
  root.style.setProperty("--button-primary", colors.button.primary)
  root.style.setProperty("--button-primary-hover", colors.button.primaryHover)
  root.style.setProperty("--button-primary-text", colors.button.primaryText)
  root.style.setProperty("--button-outline-bg", colors.button.outlineBg)
  root.style.setProperty("--button-outline-border", colors.button.outlineBorder)
  root.style.setProperty("--button-outline-text", colors.button.outlineText)
  root.style.setProperty("--button-outline-hover", colors.button.outlineHover)
  root.style.setProperty("--button-success", colors.button.success)
  root.style.setProperty("--button-success-hover", colors.button.successHover)
  root.style.setProperty("--button-success-text", colors.button.successText)

  // Step Colors
  root.style.setProperty("--step-active-bg", colors.step.activeBg)
  root.style.setProperty("--step-active-text", colors.step.activeText)
  root.style.setProperty("--step-inactive-bg", colors.step.inactiveBg)
  root.style.setProperty("--step-inactive-text", colors.step.inactiveText)
  root.style.setProperty("--step-inactive-border", colors.step.inactiveBorder)
  root.style.setProperty("--step-completed-text", colors.step.completedText)
  root.style.setProperty("--step-completed-border", colors.step.completedBorder)

  // Dialog Effects (new)
  if (colors.dialog) {
    root.style.setProperty("--dialog-bg-opacity", colors.dialog.bgOpacity.toString())
    root.style.setProperty("--dialog-backdrop-blur", colors.dialog.backdropBlur)
    root.style.setProperty("--dialog-border-opacity", colors.dialog.borderOpacity.toString())
  }

  // Chat Colors
  if (colors.chat) {
    root.style.setProperty("--chat-message-bg-user", colors.chat.messageBgUser)
    root.style.setProperty("--chat-message-text-user", colors.chat.messageTextUser)
    root.style.setProperty("--chat-message-bg-other", colors.chat.messageBgOther)
    root.style.setProperty("--chat-message-text-other", colors.chat.messageTextOther)
    root.style.setProperty("--chat-typing-indicator", colors.chat.typingIndicator)
  }

  // Estrai i valori RGB per l'opacità
  const extractRGB = (color: string): string => {
    // Gestisce colori hex
    if (color.startsWith("#")) {
      const r = Number.parseInt(color.slice(1, 3), 16)
      const g = Number.parseInt(color.slice(3, 5), 16)
      const b = Number.parseInt(color.slice(5, 7), 16)
      return `${r}, ${g}, ${b}`
    }
    // Gestisce colori rgba
    else if (color.startsWith("rgba")) {
      return color
        .replace(/rgba$$|$$/g, "")
        .split(",")
        .slice(0, 3)
        .join(",")
    }
    // Gestisce colori rgb
    else if (color.startsWith("rgb")) {
      return color.replace(/rgb$$|$$/g, "")
    }
    return "15, 26, 46" // Fallback per bg-card
  }

  // Imposta le variabili RGB per l'opacità
  root.style.setProperty("--bg-card-rgb", extractRGB(colors.bg.card))
  root.style.setProperty("--border-primary-rgb", extractRGB(colors.border.primary))

  // Inizializza gli stili delle icone SVG
  initializeSvgIconStyles()
}

// Determina se il sistema preferisce il tema scuro
export function getSystemThemePreference(): "light" | "dark" {
  if (typeof window === "undefined") return "dark"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

// Applica le impostazioni del tema (dimensione font, effetto glass)
export function applyThemeSettings(settings: ThemeSettings): void {
  const root = document.documentElement

  // Applica la dimensione del font
  root.classList.remove("text-normal", "text-large", "text-x-large")
  root.classList.add(`text-${settings.fontSize}`)

  // Applica l'effetto glass
  if (settings.glassEffect) {
    root.classList.add("glass-mode")
  } else {
    root.classList.remove("glass-mode")
  }
}

// Carica le impostazioni del tema dal localStorage
export function loadThemeSettings(): ThemeSettings {
  if (typeof window === "undefined") {
    return { fontSize: "normal", glassEffect: false }
  }

  try {
    const savedSettings = localStorage.getItem("theme-settings")
    if (savedSettings) {
      return JSON.parse(savedSettings) as ThemeSettings
    }
  } catch (error) {
    console.error("Errore nel caricamento delle impostazioni del tema:", error)
  }

  return { fontSize: "normal", glassEffect: false }
}

// Salva le impostazioni del tema nel localStorage
export function saveThemeSettings(settings: ThemeSettings): void {
  if (typeof window === "undefined") return

  try {
    localStorage.setItem("theme-settings", JSON.stringify(settings))
  } catch (error) {
    console.error("Errore nel salvataggio delle impostazioni del tema:", error)
  }
}
