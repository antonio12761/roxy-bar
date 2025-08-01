import type { ThemeDefinition } from "../theme-types"

export const defaultTheme: ThemeDefinition = {
  id: "default",
  name: "Blu",
  description: "Il tema predefinito dell'applicazione",
  colors: {
    light: {
      // Background Colors
      bg: {
        dark: "#ffffff",
        card: "#f8fafc",
        darker: "#f1f5f9",
        hover: "#f1f5f9",
        input: "#f8fafc",
        accordion: "#f8fafc",
        riepilogo: "rgba(241, 245, 249, 0.5)",
      },

      // Text Colors
      text: {
        primary: "#0f172a",
        secondary: "#334155",
        muted: "#64748b",
        icon: "#64748b",
        help: "#94a3b8",
        accent: "#3b82f6",
        success: "#10b981",
        error: "#ef4444",
      },

      // Border Colors
      border: {
        primary: "#e2e8f0",
        secondary: "#f1f5f9",
        accent: "#3b82f6",
        success: "#10b981",
        error: "rgba(239, 68, 68, 0.2)",
      },

      // Button Colors
      button: {
        primary: "#3b82f6",
        primaryHover: "#2563eb",
        primaryText: "#ffffff",
        outlineBg: "transparent",
        outlineBorder: "#e2e8f0",
        outlineText: "#334155",
        outlineHover: "#f1f5f9",
        success: "#10b981",
        successHover: "rgba(16, 185, 129, 0.9)",
        successText: "#ffffff",
        danger: "#ef4444",
        dangerHover: "#dc2626",
        dangerText: "#ffffff",
      },
      
      // Table Colors
      table: {
        occupied: "#3F8E66",
        occupiedText: "#FFFFFF"
      },

      // Step Colors
      step: {
        activeBg: "#3b82f6",
        activeText: "#ffffff",
        inactiveBg: "#f1f5f9",
        inactiveText: "#64748b",
        inactiveBorder: "#e2e8f0",
        completedText: "#3b82f6",
        completedBorder: "#3b82f6",
      },

      // Dialog Effects (new)
      dialog: {
        bgOpacity: 1,
        backdropBlur: "0px",
        borderOpacity: 1,
      },

      // Chat Colors
      chat: {
        messageBgUser: "#3b82f6",
        messageTextUser: "#ffffff",
        messageBgOther: "#f1f5f9",
        messageTextOther: "#0f172a",
        typingIndicator: "#64748b",
      },
    },
    dark: {
      // Background Colors
      bg: {
        dark: "#0f172a",
        card: "#0f1a2e",
        darker: "#0f172a",
        hover: "#1e293b",
        input: "#0f172a",
        accordion: "#0f172a",
        riepilogo: "rgba(15, 23, 42, 0.5)",
      },

      // Text Colors
      text: {
        primary: "#e2e8f0",
        secondary: "#cbd5e1",
        muted: "#94a3b8",
        icon: "#94a3b8",
        help: "#64748b",
        accent: "#3b82f6",
        success: "#14f195",
        error: "#ef4444",
      },

      // Border Colors
      border: {
        primary: "#334155",
        secondary: "#1e293b",
        accent: "#3b82f6",
        success: "#14f195",
        error: "rgba(239, 68, 68, 0.2)",
      },

      // Button Colors
      button: {
        primary: "#3b82f6",
        primaryHover: "#3b82f6e6",
        primaryText: "#ffffff",
        outlineBg: "transparent",
        outlineBorder: "#334155",
        outlineText: "#cbd5e1",
        outlineHover: "#1e293b",
        success: "#14f195",
        successHover: "rgba(20, 241, 149, 0.9)",
        successText: "#0f172a",
        danger: "#ef4444",
        dangerHover: "#dc2626",
        dangerText: "#ffffff",
      },
      
      // Table Colors
      table: {
        occupied: "#2D7A57",
        occupiedText: "#FFFFFF"
      },

      // Step Colors
      step: {
        activeBg: "#3b82f6",
        activeText: "#ffffff",
        inactiveBg: "#1e293b",
        inactiveText: "#94a3b8",
        inactiveBorder: "#334155",
        completedText: "#3b82f6",
        completedBorder: "#3b82f6",
      },

      // Dialog Effects (new)
      dialog: {
        bgOpacity: 0.7,
        backdropBlur: "12px",
        borderOpacity: 0.7,
      },

      // Chat Colors
      chat: {
        messageBgUser: "#3b82f6",
        messageTextUser: "#ffffff",
        messageBgOther: "#1e293b",
        messageTextOther: "#e2e8f0",
        typingIndicator: "#94a3b8",
      },
    },
  },
  // Impostazioni predefinite per questo tema
  defaults: {
    glassEffect: true, // Attivo di default per il tema scuro
  },
}

