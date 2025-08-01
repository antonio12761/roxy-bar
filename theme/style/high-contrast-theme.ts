import type { ThemeDefinition } from "../theme-types"

export const highContrastTheme: ThemeDefinition = {
  id: "high-contrast",
  name: "Contrasto Elevato",
  description: "Un tema con contrasto elevato per una migliore accessibilità",
  colors: {
    light: {
      // Background Colors - Bianco puro per massimo contrasto
      bg: {
        dark: "#ffffff", // Bianco puro
        card: "#f8f8f8", // Bianco quasi puro
        darker: "#f0f0f0", // Grigio molto chiaro
        hover: "#e8e8e8", // Grigio chiaro
        input: "#ffffff",
        accordion: "#f8f8f8",
        riepilogo: "rgba(240, 240, 240, 0.8)",
      },

      // Text Colors - Nero puro e colori ad alto contrasto
      text: {
        primary: "#000000", // Nero puro
        secondary: "#121212", // Quasi nero
        muted: "#333333", // Grigio molto scuro
        icon: "#000000", // Nero per le icone
        help: "#555555", // Grigio scuro
        accent: "#0000ee", // Blu standard per i link
        success: "#006600", // Verde scuro
        error: "#cc0000", // Rosso scuro
      },

      // Border Colors - Bordi scuri e ben definiti
      border: {
        primary: "#000000", // Nero
        secondary: "#333333", // Grigio scuro
        accent: "#0000ee", // Blu standard
        success: "#006600", // Verde scuro
        error: "#cc0000", // Rosso scuro
      },

      // Button Colors - Alto contrasto per i pulsanti
      button: {
        primary: "#0000ee", // Blu standard
        primaryHover: "#0000cc", // Blu più scuro
        primaryText: "#ffffff", // Bianco
        outlineBg: "#ffffff", // Bianco
        outlineBorder: "#000000", // Nero
        outlineText: "#000000", // Nero
        outlineHover: "#f0f0f0", // Grigio molto chiaro
        success: "#006600", // Verde scuro
        successHover: "#005500", // Verde più scuro
        successText: "#ffffff", // Bianco
        danger: "#cc0000", // Rosso scuro
        dangerHover: "#aa0000", // Rosso più scuro
        dangerText: "#ffffff", // Bianco
      },

      // Table Colors
      table: {
        occupied: "#006600",
        occupiedText: "#ffffff"
      },

      // Step Colors
      step: {
        activeBg: "#0000ee", // Blu standard
        activeText: "#ffffff", // Bianco
        inactiveBg: "#f0f0f0", // Grigio molto chiaro
        inactiveText: "#000000", // Nero
        inactiveBorder: "#000000", // Nero
        completedText: "#0000ee", // Blu standard
        completedBorder: "#0000ee", // Blu standard
      },

      // Dialog Effects - No glassmorphism per massima leggibilità
      dialog: {
        bgOpacity: 1,
        backdropBlur: "0px",
        borderOpacity: 1,
      },
    },
    dark: {
      // Background Colors - Nero puro per massimo contrasto
      bg: {
        dark: "#000000", // Nero puro
        card: "#121212", // Quasi nero
        darker: "#000000", // Nero puro
        hover: "#1a1a1a", // Grigio molto scuro
        input: "#121212", // Quasi nero
        accordion: "#121212", // Quasi nero
        riepilogo: "rgba(18, 18, 18, 0.8)",
      },

      // Text Colors - Bianco puro e colori ad alto contrasto
      text: {
        primary: "#ffffff", // Bianco puro
        secondary: "#f0f0f0", // Bianco quasi puro
        muted: "#dddddd", // Grigio molto chiaro
        icon: "#ffffff", // Bianco per le icone
        help: "#bbbbbb", // Grigio chiaro
        accent: "#55aaff", // Blu chiaro
        success: "#55ff55", // Verde chiaro
        error: "#ff5555", // Rosso chiaro
      },

      // Border Colors - Bordi chiari e ben definiti
      border: {
        primary: "#ffffff", // Bianco
        secondary: "#dddddd", // Grigio molto chiaro
        accent: "#55aaff", // Blu chiaro
        success: "#55ff55", // Verde chiaro
        error: "#ff5555", // Rosso chiaro
      },

      // Button Colors - Alto contrasto per i pulsanti
      button: {
        primary: "#55aaff", // Blu chiaro
        primaryHover: "#77bbff", // Blu più chiaro
        primaryText: "#000000", // Nero
        outlineBg: "#000000", // Nero
        outlineBorder: "#ffffff", // Bianco
        outlineText: "#ffffff", // Bianco
        outlineHover: "#1a1a1a", // Grigio molto scuro
        success: "#55ff55", // Verde chiaro
        successHover: "#77ff77", // Verde più chiaro
        successText: "#000000", // Nero
        danger: "#ff5555", // Rosso chiaro
        dangerHover: "#ff7777", // Rosso più chiaro
        dangerText: "#000000", // Nero
      },

      // Table Colors
      table: {
        occupied: "#55ff55",
        occupiedText: "#000000"
      },

      // Step Colors
      step: {
        activeBg: "#55aaff", // Blu chiaro
        activeText: "#000000", // Nero
        inactiveBg: "#1a1a1a", // Grigio molto scuro
        inactiveText: "#ffffff", // Bianco
        inactiveBorder: "#ffffff", // Bianco
        completedText: "#55aaff", // Blu chiaro
        completedBorder: "#55aaff", // Blu chiaro
      },

      // Dialog Effects - No glassmorphism per massima leggibilità
      dialog: {
        bgOpacity: 1,
        backdropBlur: "0px",
        borderOpacity: 1,
      },
    },
  },
  // Impostazioni predefinite per questo tema
  defaults: {
    glassEffect: false, // Disattivato per massima leggibilità e contrasto
    lineHeight: 1.5, // Interlinea standard
    letterSpacing: "0.03em", // Maggiore spaziatura tra le lettere per leggibilità
  },
}

