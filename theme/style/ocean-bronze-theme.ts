import type { ThemeDefinition } from "../theme-types"

export const oceanBronzeTheme: ThemeDefinition = {
  id: "ocean-bronze",
  name: "Corallo",
  description: "Un tema che unisce i toni profondi dell'oceano con accenti bronzo caldi",
  colors: {
    light: {
      bg: {
        dark: "#FFFFFF",
        card: "#FEF9F5",
        darker: "#FDF3EB",
        hover: "#FAEEE3",
        input: "#FFFFFE",
        accordion: "#FEF6F0",
        riepilogo: "#FEF9F5"
      },
      text: {
        primary: "#082C38",
        secondary: "#1A4552",
        muted: "#3A6472",
        icon: "#3A6472",
        help: "#5A8394",
        accent: "#A67D5D",
        success: "#22C55E",
        error: "#EF4444"
      },
      border: {
        primary: "#E0D4C8",
        secondary: "#EBE0D6",
        accent: "#C19976",
        success: "#86EFAC",
        error: "#FCA5A5"
      },
      button: {
        primary: "#082C38",
        primaryHover: "#0A3644",
        primaryText: "#FFFFFF",
        outlineBg: "transparent",
        outlineBorder: "#C19976",
        outlineText: "#082C38",
        outlineHover: "#FDF3EB",
        success: "#22C55E",
        successHover: "#16A34A",
        successText: "#FFFFFF",
        danger: "#EF4444",
        dangerHover: "#DC2626",
        dangerText: "#FFFFFF"
      },
      table: {
        occupied: "#3A8B7A",
        occupiedText: "#FFFFFF"
      },
      step: {
        activeBg: "#082C38",
        activeText: "#FFFFFF",
        inactiveBg: "transparent",
        inactiveText: "#5A8394",
        inactiveBorder: "#E0D4C8",
        completedText: "#FFFFFF",
        completedBorder: "#C19976"
      },
      scrollbar: {
        track: "#FEF6F0",
        thumb: "#C19976",
        thumbHover: "#AD8562"
      },
      dialog: {
        bgOpacity: 0.95,
        backdropBlur: "16px",
        borderOpacity: 0.2
      },
      
      // Chat Colors
      chat: {
        messageBgUser: "#082C38",
        messageTextUser: "#FFFFFF",
        messageBgOther: "#FEF9F5",
        messageTextOther: "#082C38",
        typingIndicator: "#3A6472",
      },
      // toast: {
      //   success: "#4ADE80",
      //   error: "#F87171",
      //   warning: "#FBBF24",
      //   info: "#60A5FA"
      // },
      input: {
        focus: "#C19976",
        error: "#EF4444",
        placeholder: "#8B7B6B"
      }
    },
    dark: {
      bg: {
        dark: "#051821",
        card: "#082C38",
        darker: "#03101A",
        hover: "#0A3644",
        input: "#093440",
        accordion: "#062430",
        riepilogo: "#082C38"
      },
      text: {
        primary: "#FCD8B4",
        secondary: "#C19976",
        muted: "#9A7B63",
        icon: "#9A7B63",
        help: "#7D6251",
        accent: "#F4E0C7",
        success: "#4ADE80",
        error: "#F87171"
      },
      border: {
        primary: "#1A4552",
        secondary: "#0F3A47",
        accent: "#C19976",
        success: "#34D399",
        error: "#F87171"
      },
      button: {
        primary: "#C19976",
        primaryHover: "#D1A986",
        primaryText: "#082C38",
        outlineBg: "transparent",
        outlineBorder: "#C19976",
        outlineText: "#FCD8B4",
        outlineHover: "#0A3644",
        success: "#4ADE80",
        successHover: "#22C55E",
        successText: "#FFFFFF",
        danger: "#F87171",
        dangerHover: "#EF4444",
        dangerText: "#FFFFFF"
      },
      table: {
        occupied: "#2D7A6A",
        occupiedText: "#FFFFFF"
      },
      step: {
        activeBg: "#C19976",
        activeText: "#082C38",
        inactiveBg: "transparent",
        inactiveText: "#7D6251",
        inactiveBorder: "#1A4552",
        completedText: "#082C38",
        completedBorder: "#9A7B63"
      },
      scrollbar: {
        track: "#062430",
        thumb: "#3A6472",
        thumbHover: "#4A7482"
      },
      dialog: {
        bgOpacity: 0.85,
        backdropBlur: "20px",
        borderOpacity: 0.3
      },
      
      // Chat Colors
      chat: {
        messageBgUser: "#C19976",
        messageTextUser: "#082C38",
        messageBgOther: "#082C38",
        messageTextOther: "#FCD8B4",
        typingIndicator: "#9A7B63",
      },
      // toast: {
      //   success: "#22C55E",
      //   error: "#EF4444",
      //   warning: "#F59E0B",
      //   info: "#3B82F6"
      // },
      input: {
        focus: "#C19976",
        error: "#DC2626",
        placeholder: "#5A8394"
      }
    }
  },
  defaults: {
    glassEffect: true
  }
}