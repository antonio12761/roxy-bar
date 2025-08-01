import type { ThemeDefinition } from "../theme-types"

export const nordTheme: ThemeDefinition = {
  id: "nord",
  name: "Nordico",
  description: "Un tema ispirato ai colori freddi del Nord",
  colors: {
    light: {
      // Background Colors
      bg: {
        dark: "#eceff4",
        card: "#e5e9f0",
        darker: "#d8dee9",
        hover: "#d8dee9",
        input: "#e5e9f0",
        accordion: "#e5e9f0",
        riepilogo: "rgba(216, 222, 233, 0.5)",
      },

      // Text Colors
      text: {
        primary: "#2e3440",
        secondary: "#3b4252",
        muted: "#4c566a",
        icon: "#4c566a",
        help: "#7b88a1",
        accent: "#5e81ac",
        success: "#a3be8c",
        error: "#bf616a",
      },

      // Border Colors
      border: {
        primary: "#d8dee9",
        secondary: "#e5e9f0",
        accent: "#5e81ac",
        success: "#a3be8c",
        error: "rgba(191, 97, 106, 0.2)",
      },

      // Button Colors
      button: {
        primary: "#5e81ac",
        primaryHover: "#4c6f94",
        primaryText: "#eceff4",
        outlineBg: "transparent",
        outlineBorder: "#d8dee9",
        outlineText: "#3b4252",
        outlineHover: "#d8dee9",
        success: "#a3be8c",
        successHover: "rgba(163, 190, 140, 0.9)",
        successText: "#2e3440",
        danger: "#bf616a",
        dangerHover: "#a54d57",
        dangerText: "#ffffff",
      },

      // Table Colors
      table: {
        occupied: "#a3be8c",
        occupiedText: "#2e3440"
      },

      // Step Colors
      step: {
        activeBg: "#5e81ac",
        activeText: "#eceff4",
        inactiveBg: "#d8dee9",
        inactiveText: "#4c566a",
        inactiveBorder: "#d8dee9",
        completedText: "#5e81ac",
        completedBorder: "#5e81ac",
      },

      // Dialog Effects (new)
      dialog: {
        bgOpacity: 1,
        backdropBlur: "0px",
        borderOpacity: 1,
      },

      // Chat Colors
      chat: {
        messageBgUser: "#5e81ac",
        messageTextUser: "#eceff4",
        messageBgOther: "#e5e9f0",
        messageTextOther: "#2e3440",
        typingIndicator: "#4c566a",
      },
    },
    dark: {
      // Background Colors
      bg: {
        dark: "#2e3440",
        card: "#3b4252",
        darker: "#272c36",
        hover: "#434c5e",
        input: "#3b4252",
        accordion: "#3b4252",
        riepilogo: "rgba(59, 66, 82, 0.5)",
      },

      // Text Colors
      text: {
        primary: "#eceff4",
        secondary: "#e5e9f0",
        muted: "#d8dee9",
        icon: "#d8dee9",
        help: "#9aa5bf",
        accent: "#88c0d0",
        success: "#a3be8c",
        error: "#bf616a",
      },

      // Border Colors
      border: {
        primary: "#4c566a",
        secondary: "#434c5e",
        accent: "#88c0d0",
        success: "#a3be8c",
        error: "rgba(191, 97, 106, 0.2)",
      },

      // Button Colors
      button: {
        primary: "#88c0d0",
        primaryHover: "#76aebe",
        primaryText: "#2e3440",
        outlineBg: "transparent",
        outlineBorder: "#4c566a",
        outlineText: "#e5e9f0",
        outlineHover: "#434c5e",
        success: "#a3be8c",
        successHover: "rgba(163, 190, 140, 0.9)",
        successText: "#2e3440",
        danger: "#bf616a",
        dangerHover: "#a54d57",
        dangerText: "#ffffff",
      },

      // Table Colors
      table: {
        occupied: "#8fbcbb",
        occupiedText: "#2e3440"
      },

      // Step Colors
      step: {
        activeBg: "#88c0d0",
        activeText: "#2e3440",
        inactiveBg: "#434c5e",
        inactiveText: "#d8dee9",
        inactiveBorder: "#4c566a",
        completedText: "#88c0d0",
        completedBorder: "#88c0d0",
      },

      // Dialog Effects (new)
      dialog: {
        bgOpacity: 0.7,
        backdropBlur: "12px",
        borderOpacity: 0.7,
      },

      // Chat Colors
      chat: {
        messageBgUser: "#5e81ac",
        messageTextUser: "#eceff4",
        messageBgOther: "#434c5e",
        messageTextOther: "#eceff4",
        typingIndicator: "#d8dee9",
      },
    },
  },
  // Impostazioni predefinite per questo tema
  defaults: {
    glassEffect: true, // Attivo di default per il tema scuro
  },
}

