import type { ThemeDefinition } from "../theme-types"

export const lavenderDuskTheme: ThemeDefinition = {
  id: "lavender-dusk",
  name: "Ametista",
  description: "Un tema elegante con tonalità lavanda e grigio-blu",
  colors: {
    light: {
      bg: {
        dark: "#FFFFFF",
        card: "#F8F7F9",
        darker: "#F0EEF2",
        hover: "#F0EEF2",
        input: "#FEFEFE",
        accordion: "#F5F4F6",
        riepilogo: "#F8F7F9"
      },
      text: {
        primary: "#2D3142",
        secondary: "#525566",
        muted: "#6E7189",
        icon: "#6E7189",
        help: "#8B89A0",
        accent: "#5E5A7D",
        success: "#22C55E",
        error: "#EF4444"
      },
      border: {
        primary: "#E6E3E8",
        secondary: "#EDE8ED",
        accent: "#7B759A",
        success: "#86EFAC",
        error: "#FCA5A5"
      },
      button: {
        primary: "#5E5A7D",
        primaryHover: "#4A4766",
        primaryText: "#FFFFFF",
        outlineBg: "transparent",
        outlineBorder: "#7B759A",
        outlineText: "#5E5A7D",
        outlineHover: "#F0EEF2",
        success: "#22C55E",
        successHover: "#16A34A",
        successText: "#FFFFFF",
        danger: "#EF4444",
        dangerHover: "#DC2626",
        dangerText: "#FFFFFF"
      },
      table: {
        occupied: "#7B759A",
        occupiedText: "#FFFFFF"
      },
      step: {
        activeBg: "#5E5A7D",
        activeText: "#FFFFFF",
        inactiveBg: "transparent",
        inactiveText: "#ADACB5",
        inactiveBorder: "#E6E3E8",
        completedText: "#FFFFFF",
        completedBorder: "#7B759A"
      },
      scrollbar: {
        track: "#F5F4F6",
        thumb: "#ADACB5",
        thumbHover: "#9897A3"
      },
      dialog: {
        bgOpacity: 0.95,
        backdropBlur: "16px",
        borderOpacity: 0.2
      },
      
      // Chat Colors
      chat: {
        messageBgUser: "#5E5A7D",
        messageTextUser: "#FFFFFF",
        messageBgOther: "#F8F7F9",
        messageTextOther: "#2D3142",
        typingIndicator: "#6E7189",
      },
      // toast: {
      //   success: "#4ADE80",
      //   error: "#F87171",
      //   warning: "#FBBF24",
      //   info: "#60A5FA"
      // },
      input: {
        focus: "#7B759A",
        error: "#EF4444",
        placeholder: "#ADACB5"
      }
    },
    dark: {
      bg: {
        dark: "#1A1B26",
        card: "#2D3142",
        darker: "#161721",
        hover: "#383C52",
        input: "#343849",
        accordion: "#252838",
        riepilogo: "#2D3142"
      },
      text: {
        primary: "#D8D5DB",
        secondary: "#ADACB5",
        muted: "#8B89A0",
        icon: "#8B89A0",
        help: "#6E7189",
        accent: "#A39FC7",
        success: "#4ADE80",
        error: "#F87171"
      },
      border: {
        primary: "#434760",
        secondary: "#383C52",
        accent: "#7B759A",
        success: "#34D399",
        error: "#F87171"
      },
      button: {
        primary: "#7B759A",
        primaryHover: "#8E88AA",
        primaryText: "#FFFFFF",
        outlineBg: "transparent",
        outlineBorder: "#7B759A",
        outlineText: "#A39FC7",
        outlineHover: "#383C52",
        success: "#4ADE80",
        successHover: "#22C55E",
        successText: "#FFFFFF",
        danger: "#F87171",
        dangerHover: "#EF4444",
        dangerText: "#FFFFFF"
      },
      table: {
        occupied: "#5E5A7D",
        occupiedText: "#FFFFFF"
      },
      step: {
        activeBg: "#7B759A",
        activeText: "#FFFFFF",
        inactiveBg: "transparent",
        inactiveText: "#8B89A0",
        inactiveBorder: "#434760",
        completedText: "#FFFFFF",
        completedBorder: "#5E5A7D"
      },
      scrollbar: {
        track: "#252838",
        thumb: "#525670",
        thumbHover: "#626685"
      },
      dialog: {
        bgOpacity: 0.85,
        backdropBlur: "20px",
        borderOpacity: 0.3
      },
      
      // Chat Colors
      chat: {
        messageBgUser: "#7B759A",
        messageTextUser: "#FFFFFF",
        messageBgOther: "#2D3142",
        messageTextOther: "#D8D5DB",
        typingIndicator: "#8B89A0",
      },
      // toast: {
      //   success: "#22C55E",
      //   error: "#EF4444",
      //   warning: "#F59E0B",
      //   info: "#3B82F6"
      // },
      input: {
        focus: "#7B759A",
        error: "#DC2626",
        placeholder: "#6E7189"
      }
    }
  },
  defaults: {
    glassEffect: true
  }
}