import type { ThemeDefinition } from "../theme-types"

export const midnightTheme: ThemeDefinition = {
  id: "midnight",
  name: "Midnight",
  description: "Tema scuro minimalista con palette grigia e accenti blu",
  colors: {
    light: {
      // Light mode - utilizzo colori leggermente più chiari per il giorno
      bg: {
        dark: "#fafafa",
        card: "#f5f5f5",
        darker: "#eeeeee",
        hover: "#e8e8e8",
        input: "#f5f5f5",
        accordion: "#f5f5f5",
        riepilogo: "rgba(238, 238, 238, 0.5)",
      },

      text: {
        primary: "#222222",
        secondary: "#444444",
        muted: "#666666",
        icon: "#666666",
        help: "#888888",
        accent: "#3b82f6",
        success: "#10b981",
        error: "#ef4444",
      },

      border: {
        primary: "#dddddd",
        secondary: "#eeeeee",
        accent: "#3b82f6",
        success: "#10b981",
        error: "rgba(239, 68, 68, 0.2)",
      },

      button: {
        primary: "#3b82f6",
        primaryHover: "#2563eb",
        primaryText: "#ffffff",
        outlineBg: "transparent",
        outlineBorder: "#dddddd",
        outlineText: "#444444",
        outlineHover: "#eeeeee",
        success: "#10b981",
        successHover: "rgba(16, 185, 129, 0.9)",
        successText: "#ffffff",
        danger: "#ef4444",
        dangerHover: "#dc2626",
        dangerText: "#ffffff",
      },

      table: {
        occupied: "#10b981",
        occupiedText: "#ffffff"
      },

      step: {
        activeBg: "#3b82f6",
        activeText: "#ffffff",
        inactiveBg: "#eeeeee",
        inactiveText: "#666666",
        inactiveBorder: "#dddddd",
        completedText: "#3b82f6",
        completedBorder: "#3b82f6",
      },

      dialog: {
        bgOpacity: 1,
        backdropBlur: "0px",
        borderOpacity: 1,
      },
    },
    dark: {
      // Dark mode - i colori specificati dall'utente
      bg: {
        dark: "#111111",        // Sidebar/header
        card: "#222222",        // Pagine/cards
        darker: "#0a0a0a",      // Background ancora più scuro (per contrasto)
        hover: "#2a2a2a",       // Hover state (leggermente più chiaro di card)
        input: "#1a1a1a",       // Input fields (tra dark e card)
        accordion: "#1a1a1a",   // Accordion background
        riepilogo: "rgba(34, 34, 34, 0.5)", // Riepilogo semi-trasparente
      },

      text: {
        primary: "#cccccc",     // Font primario
        secondary: "#bbbbbb",   // Font secondario
        muted: "#aaaaaa",       // Font terziario
        icon: "#aaaaaa",        // Icone con colore terziario
        help: "#999999",        // Testo di aiuto (ancora più muted)
        accent: "#3b82f6",      // Blu per accenti
        success: "#10b981",     // Verde successo
        error: "#ef4444",       // Rosso errore
      },

      border: {
        primary: "#333333",     // Bordi principali (contrasto con bg)
        secondary: "#2a2a2a",   // Bordi secondari
        accent: "#3b82f6",      // Bordi accent blu
        success: "#10b981",     // Bordi successo
        error: "rgba(239, 68, 68, 0.2)", // Bordi errore
      },

      button: {
        primary: "#3b82f6",     // Bottone primario blu
        primaryHover: "#2563eb", // Hover più scuro
        primaryText: "#ffffff",  // Testo bianco su bottoni blu
        outlineBg: "transparent",
        outlineBorder: "#333333",
        outlineText: "#bbbbbb",
        outlineHover: "#2a2a2a",
        success: "#10b981",
        successHover: "rgba(16, 185, 129, 0.9)",
        successText: "#ffffff",
        danger: "#ef4444",
        dangerHover: "#dc2626",
        dangerText: "#ffffff",
      },

      table: {
        occupied: "#059669",
        occupiedText: "#ffffff"
      },

      step: {
        activeBg: "#3b82f6",    // Step attivo blu
        activeText: "#ffffff",
        inactiveBg: "#2a2a2a",  // Step inattivo
        inactiveText: "#aaaaaa",
        inactiveBorder: "#333333",
        completedText: "#3b82f6",
        completedBorder: "#3b82f6",
      },

      dialog: {
        bgOpacity: 0.95,        // Dialoghi quasi opachi
        backdropBlur: "8px",    // Blur leggero per effetto glass
        borderOpacity: 0.8,     // Bordi semi-trasparenti
      },
    },
  },
  defaults: {
    glassEffect: true,          // Effetto glass attivo di default
  },
}