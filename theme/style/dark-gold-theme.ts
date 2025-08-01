import type { ThemeDefinition } from "../theme-types"

export const darkGoldTheme: ThemeDefinition = {
  id: "dark-gold",
  name: "Oro Scuro",
  description: "Un tema elegante con tonalità dorate su sfondo scuro",
  colors: {
    light: {
      bg: {
        dark: "#FFFFFF",
        card: "#FDF8F3",
        darker: "#FAF0E6",
        hover: "#F5E6D3",
        input: "#FFFEFA",
        accordion: "#FDF6ED",
        riepilogo: "#FDF8F3"
      },
      text: {
        primary: "#272727",
        secondary: "#4A4A4A",
        muted: "#6B6B6B",
        icon: "#6B6B6B",
        help: "#888888",
        accent: "#B08D57",
        success: "#22C55E",
        error: "#EF4444"
      },
      border: {
        primary: "#E5D5C7",
        secondary: "#F0E6DC",
        accent: "#D4AA7D",
        success: "#86EFAC",
        error: "#FCA5A5"
      },
      button: {
        primary: "#D4AA7D",
        primaryHover: "#C09560",
        primaryText: "#FFFFFF",
        outlineBg: "transparent",
        outlineBorder: "#D4AA7D",
        outlineText: "#B08D57",
        outlineHover: "#FAF0E6",
        success: "#22C55E",
        successHover: "#16A34A",
        successText: "#FFFFFF",
        danger: "#EF4444",
        dangerHover: "#DC2626",
        dangerText: "#FFFFFF"
      },
      table: {
        occupied: "#45A373",
        occupiedText: "#FFFFFF"
      },
      step: {
        activeBg: "#D4AA7D",
        activeText: "#FFFFFF",
        inactiveBg: "transparent",
        inactiveText: "#A08060",
        inactiveBorder: "#E5D5C7",
        completedText: "#FFFFFF",
        completedBorder: "#B08D57"
      },
      scrollbar: {
        track: "#FDF6ED",
        thumb: "#D4AA7D",
        thumbHover: "#C09560"
      },
      dialog: {
        bgOpacity: 0.95,
        backdropBlur: "16px",
        borderOpacity: 0.2
      },
      
      // Chat Colors
      chat: {
        messageBgUser: "#D4AA7D",
        messageTextUser: "#FFFFFF",
        messageBgOther: "#FDF8F3",
        messageTextOther: "#272727",
        typingIndicator: "#6B6B6B",
      },
      // toast: {
      //   success: "#4ADE80",
      //   error: "#F87171",
      //   warning: "#FBBF24",
      //   info: "#60A5FA"
      // },
      input: {
        focus: "#D4AA7D",
        error: "#EF4444",
        placeholder: "#A08060"
      }
    },
    dark: {
      bg: {
        dark: "#1A1A1A",
        card: "#272727",
        darker: "#0F0F0F",
        hover: "#333333",
        input: "#2D2D2D",
        accordion: "#202020",
        riepilogo: "#272727"
      },
      text: {
        primary: "#EFD09E",
        secondary: "#D4AA7D",
        muted: "#A08060",
        icon: "#A08060",
        help: "#8B7355",
        accent: "#F4E4C1",
        success: "#4ADE80",
        error: "#F87171"
      },
      border: {
        primary: "#3D3D3D",
        secondary: "#333333",
        accent: "#D4AA7D",
        success: "#34D399",
        error: "#F87171"
      },
      button: {
        primary: "#D4AA7D",
        primaryHover: "#E0BA8D",
        primaryText: "#1A1A1A",
        outlineBg: "transparent",
        outlineBorder: "#D4AA7D",
        outlineText: "#EFD09E",
        outlineHover: "#333333",
        success: "#4ADE80",
        successHover: "#22C55E",
        successText: "#FFFFFF",
        danger: "#F87171",
        dangerHover: "#EF4444",
        dangerText: "#FFFFFF"
      },
      table: {
        occupied: "#3F8E66",
        occupiedText: "#FFFFFF"
      },
      step: {
        activeBg: "#D4AA7D",
        activeText: "#1A1A1A",
        inactiveBg: "transparent",
        inactiveText: "#8B7355",
        inactiveBorder: "#3D3D3D",
        completedText: "#1A1A1A",
        completedBorder: "#B08D57"
      },
      scrollbar: {
        track: "#202020",
        thumb: "#5C5C5C",
        thumbHover: "#707070"
      },
      dialog: {
        bgOpacity: 0.85,
        backdropBlur: "20px",
        borderOpacity: 0.3
      },
      
      // Chat Colors
      chat: {
        messageBgUser: "#D4AA7D",
        messageTextUser: "#1A1A1A",
        messageBgOther: "#272727",
        messageTextOther: "#EFD09E",
        typingIndicator: "#A08060",
      },
      // toast: {
      //   success: "#22C55E",
      //   error: "#EF4444",
      //   warning: "#F59E0B",
      //   info: "#3B82F6"
      // },
      input: {
        focus: "#D4AA7D",
        error: "#DC2626",
        placeholder: "#6B6B6B"
      }
    }
  },
  defaults: {
    glassEffect: true
  }
}