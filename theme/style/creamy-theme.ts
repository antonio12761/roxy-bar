import type { ThemeDefinition } from "../theme-types"

export const creamyTheme: ThemeDefinition = {
  id: "creamy",
  name: "Crema",
  description: "Un tema caldo e cremoso con tonalità beige e marroni",
  colors: {
    light: {
      // Background Colors
      bg: {
        dark: "#fdf6e3",
        card: "#fff8e6",
        darker: "#f5edd6",
        hover: "#f5edd6",
        input: "#fff8e6",
        accordion: "#fff8e6",
        riepilogo: "rgba(245, 237, 214, 0.5)",
      },

      // Text Colors
      text: {
        primary: "#5c4b37",
        secondary: "#7c6855",
        muted: "#a89985",
        icon: "#a89985",
        help: "#bfb19f",
        accent: "#d08770",
        success: "#8fb573",
        error: "#bf616a",
      },

      // Border Colors
      border: {
        primary: "#e6d9c2",
        secondary: "#f5edd6",
        accent: "#d08770",
        success: "#8fb573",
        error: "rgba(191, 97, 106, 0.2)",
      },

      // Button Colors
      button: {
        primary: "#d08770",
        primaryHover: "#c17a63",
        primaryText: "#ffffff",
        outlineBg: "transparent",
        outlineBorder: "#e6d9c2",
        outlineText: "#7c6855",
        outlineHover: "#f5edd6",
        success: "#8fb573",
        successHover: "rgba(143, 181, 115, 0.9)",
        successText: "#ffffff",
        danger: "#bf616a",
        dangerHover: "#a54d57",
        dangerText: "#ffffff",
      },

      // Table Colors
      table: {
        occupied: "#8fb573",
        occupiedText: "#ffffff"
      },

      // Step Colors
      step: {
        activeBg: "#d08770",
        activeText: "#ffffff",
        inactiveBg: "#f5edd6",
        inactiveText: "#a89985",
        inactiveBorder: "#e6d9c2",
        completedText: "#d08770",
        completedBorder: "#d08770",
      },

      // Dialog Effects (new)
      dialog: {
        bgOpacity: 1,
        backdropBlur: "0px",
        borderOpacity: 1,
      },

      // Chat Colors
      chat: {
        messageBgUser: "#d08770",
        messageTextUser: "#ffffff",
        messageBgOther: "#fff8e6",
        messageTextOther: "#5c4b37",
        typingIndicator: "#a89985",
      },
    },
    dark: {
      // Background Colors
      bg: {
        dark: "#32302f",
        card: "#3c3836",
        darker: "#282828",
        hover: "#45403d",
        input: "#3c3836",
        accordion: "#3c3836",
        riepilogo: "rgba(60, 56, 54, 0.5)",
      },

      // Text Colors
      text: {
        primary: "#ebdbb2",
        secondary: "#d5c4a1",
        muted: "#bdae93",
        icon: "#bdae93",
        help: "#a89984",
        accent: "#fe8019",
        success: "#b8bb26",
        error: "#fb4934",
      },

      // Border Colors
      border: {
        primary: "#504945",
        secondary: "#3c3836",
        accent: "#fe8019",
        success: "#b8bb26",
        error: "rgba(251, 73, 52, 0.2)",
      },

      // Button Colors
      button: {
        primary: "#fe8019",
        primaryHover: "#e67509",
        primaryText: "#282828",
        outlineBg: "transparent",
        outlineBorder: "#504945",
        outlineText: "#d5c4a1",
        outlineHover: "#45403d",
        success: "#b8bb26",
        successHover: "rgba(184, 187, 38, 0.9)",
        successText: "#282828",
        danger: "#fb4934",
        dangerHover: "#e03d2b",
        dangerText: "#ffffff",
      },

      // Table Colors
      table: {
        occupied: "#689d6a",
        occupiedText: "#ffffff"
      },

      // Step Colors
      step: {
        activeBg: "#fe8019",
        activeText: "#282828",
        inactiveBg: "#45403d",
        inactiveText: "#bdae93",
        inactiveBorder: "#504945",
        completedText: "#fe8019",
        completedBorder: "#fe8019",
      },

      // Dialog Effects (new)
      dialog: {
        bgOpacity: 0.7,
        backdropBlur: "12px",
        borderOpacity: 0.7,
      },

      // Chat Colors
      chat: {
        messageBgUser: "#fe8019",
        messageTextUser: "#282828",
        messageBgOther: "#3c3836",
        messageTextOther: "#ebdbb2",
        typingIndicator: "#bdae93",
      },
    },
  },
  // Impostazioni predefinite per questo tema
  defaults: {
    glassEffect: true, // Attivo di default per il tema scuro
  },
}

