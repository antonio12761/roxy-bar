import type { ThemeDefinition } from "../theme-types"

export const readingTheme: ThemeDefinition = {
  id: "reading",
  name: "Obsidian",
  description: "Tema elegante nero profondo con dettagli grigio scurissimo e accenti celeste",
  colors: {
    light: {
      // Background Colors - Grigi chiari per modalità light
      bg: {
        dark: "#f8fafc", // Grigio molto chiaro
        card: "#ffffff", // Bianco
        darker: "#f1f5f9", // Grigio chiaro
        hover: "#f1f5f9",
        input: "#ffffff",
        accordion: "#ffffff",
        riepilogo: "rgba(241, 245, 249, 0.5)",
      },

      // Text Colors
      text: {
        primary: "#0f172a", // Quasi nero
        secondary: "#334155", // Grigio scuro
        muted: "#64748b", // Grigio medio
        icon: "#64748b",
        help: "#94a3b8", // Grigio chiaro
        accent: "#7dd3fc", // Celeste pastello
        success: "#22c55e", // Verde
        error: "#ef4444", // Rosso
      },

      // Border Colors
      border: {
        primary: "#e2e8f0",
        secondary: "#f1f5f9",
        accent: "#7dd3fc", // Celeste pastello
        success: "#22c55e",
        error: "rgba(239, 68, 68, 0.2)",
      },

      // Button Colors
      button: {
        primary: "#404040", // Grigio scuro
        primaryHover: "#525252",
        primaryText: "#ffffff",
        outlineBg: "transparent",
        outlineBorder: "#e2e8f0",
        outlineText: "#334155",
        outlineHover: "#f1f5f9",
        success: "#22c55e",
        successHover: "rgba(34, 197, 94, 0.9)",
        successText: "#ffffff",
        danger: "#ef4444",
        dangerHover: "#dc2626",
        dangerText: "#ffffff",
      },

      // Table Colors
      table: {
        occupied: "#22c55e",
        occupiedText: "#ffffff"
      },

      // Step Colors
      step: {
        activeBg: "#7dd3fc", // Celeste pastello
        activeText: "#0f172a",
        inactiveBg: "#f1f5f9",
        inactiveText: "#64748b",
        inactiveBorder: "#e2e8f0",
        completedText: "#7dd3fc",
        completedBorder: "#7dd3fc",
      },

      // Dialog Effects
      dialog: {
        bgOpacity: 1,
        backdropBlur: "0px",
        borderOpacity: 1,
      },

      // Chat Colors
      chat: {
        messageBgUser: "#7dd3fc",
        messageTextUser: "#0f172a",
        messageBgOther: "#f8fafc",
        messageTextOther: "#0f172a",
        typingIndicator: "#64748b",
      },
    },
    dark: {
      // Background Colors - Nero profondo e grigio scurissimo
      bg: {
        dark: "#000000", // Nero assoluto
        card: "#0a0a0a", // Grigio scurissimo
        darker: "#000000", // Nero profondo
        hover: "#151515", // Grigio scurissimo per hover
        input: "#0a0a0a",
        accordion: "#0a0a0a",
        riepilogo: "rgba(10, 10, 10, 0.8)",
      },

      // Text Colors - Testi chiari con accenti celeste
      text: {
        primary: "#ffffff", // Bianco puro
        secondary: "#e5e5e5", // Grigio molto chiaro
        muted: "#a3a3a3", // Grigio medio
        icon: "#a3a3a3",
        help: "#737373", // Grigio scuro
        accent: "#38bdf8", // Celeste brillante
        success: "#22c55e", // Verde
        error: "#ef4444", // Rosso
      },

      // Border Colors
      border: {
        primary: "#262626", // Grigio scurissimo per bordi
        secondary: "#171717", // Grigio ancora più scuro
        accent: "#38bdf8", // Celeste brillante
        success: "#22c55e",
        error: "rgba(239, 68, 68, 0.3)",
      },

      // Button Colors
      button: {
        primary: "#171717", // Nero/grigio molto scuro
        primaryHover: "#262626", // Grigio scuro hover
        primaryText: "#ffffff", // Testo bianco sui pulsanti scuri
        outlineBg: "transparent",
        outlineBorder: "#262626",
        outlineText: "#e5e5e5",
        outlineHover: "#151515",
        success: "#22c55e",
        successHover: "rgba(34, 197, 94, 0.9)",
        successText: "#000000",
        danger: "#ef4444",
        dangerHover: "#dc2626",
        dangerText: "#ffffff",
      },

      // Table Colors
      table: {
        occupied: "#16a34a",
        occupiedText: "#ffffff"
      },

      // Step Colors
      step: {
        activeBg: "#38bdf8", // Celeste brillante
        activeText: "#000000",
        inactiveBg: "#0a0a0a",
        inactiveText: "#a3a3a3",
        inactiveBorder: "#262626",
        completedText: "#38bdf8",
        completedBorder: "#38bdf8",
      },

      // Dialog Effects
      dialog: {
        bgOpacity: 0.9,
        backdropBlur: "12px",
        borderOpacity: 0.2,
      },

      // Chat Colors
      chat: {
        messageBgUser: "#38bdf8",
        messageTextUser: "#000000",
        messageBgOther: "#0a0a0a",
        messageTextOther: "#ffffff",
        typingIndicator: "#a3a3a3",
      },
    },
  },
  // Impostazioni predefinite per questo tema
  defaults: {
    glassEffect: true, // Attivato per dare un effetto moderno
  },
}