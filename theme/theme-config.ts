// Theme configuration file that centralizes all styling variables
// Components will import from this file instead of having hardcoded values

export const themeConfig = {
    // Color Palette
    colors: {
      // Background Colors
      bg: {
        dark: "#0f172a", // Main background
        card: "#0f1a2e", // Card background
        darker: "#0f172a", // Input background
        hover: "#1e293b", // Hover state background
        input: "#0f172a", // Form input background
        accordion: "#0f172a", // Accordion item background
        riepilogo: "rgba(15, 23, 42, 0.5)", // Riepilogo background with transparency
      },
  
      // Text Colors
      text: {
        primary: "#e2e8f0", // Main text color
        secondary: "#cbd5e1", // Secondary text color
        muted: "#94a3b8", // Muted text for labels, hints
        icon: "#94a3b8", // Icon color
        help: "#64748b", // Help icon color
        accent: "#3b82f6", // Accent text color (blue)
        success: "#14f195", // Success text color
        error: "#ef4444", // Error text color
        warning: "#f59e0b", // Warning text color
      },
  
      // Border Colors
      border: {
        primary: "#334155", // Primary border color
        secondary: "#1e293b", // Secondary border color (lighter)
        accent: "#3b82f6", // Accent border (blue)
        success: "#14f195", // Success border color
        error: "rgba(239, 68, 68, 0.2)", // Error border color
      },
  
      // Button Colors
      button: {
        primary: "#3b82f6", // Primary button background
        primaryHover: "#3b82f6e6", // Primary button hover state
        primaryText: "#ffffff", // Primary button text color
        outlineBg: "transparent", // Outline button background
        outlineBorder: "#334155", // Outline button border
        outlineText: "#cbd5e1", // Outline button text
        outlineHover: "#1e293b", // Outline button hover
        success: "#14f195", // Success button
        successHover: "rgba(20, 241, 149, 0.9)", // Success button hover
        successText: "#0f172a", // Success button text
        danger: "#ef4444", // Danger button
        dangerHover: "rgba(239, 68, 68, 0.9)", // Danger button hover
        dangerText: "#ffffff", // Danger button text
        error: "#ef4444", // Error button (alias for danger)
        warning: "#f59e0b", // Warning button
        warningHover: "rgba(245, 158, 11, 0.9)", // Warning button hover
        warningText: "#ffffff", // Warning button text
        secondary: "#6b7280", // Secondary button
        secondaryHover: "rgba(107, 114, 128, 0.9)", // Secondary button hover
        secondaryText: "#ffffff", // Secondary button text
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
    },
  
    // Typography
    typography: {
      // Font Family
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
  
      // Font Sizes
      fontSize: {
        xs: "0.75rem", // 12px
        sm: "0.875rem", // 14px
        base: "1rem", // 16px
        lg: "1.125rem", // 18px
        xl: "1.25rem", // 20px
        "2xl": "1.5rem", // 24px
        "3xl": "1.875rem", // 30px
      },
  
      // Font Weights
      fontWeight: {
        normal: "400",
        medium: "500",
        semibold: "600",
        bold: "700",
      },
  
      // Line Heights
      lineHeight: {
        tight: "1.25",
        normal: "1.5",
        relaxed: "1.75",
      },
    },
  
    // Spacing
    spacing: {
      0: "0rem", // 0px
      0.5: "0.125rem", // 2px
      1: "0.25rem", // 4px
      1.5: "0.375rem", // 6px
      2: "0.5rem", // 8px
      3: "0.75rem", // 12px
      4: "1rem", // 16px
      5: "1.25rem", // 20px
      6: "1.5rem", // 24px
      8: "2rem", // 32px
      10: "2.5rem", // 40px
      12: "3rem", // 48px
    },
  
    // Dimensions
    dimensions: {
      // Form Elements
      input: {
        height: "2.5rem", // 40px
        paddingX: "0.75rem",
        paddingY: "0.5rem",
      },
  
      // Buttons
      button: {
        heightDefault: "3rem", // 48px - large buttons
        heightSm: "2.5rem", // 40px
        paddingX: "1rem",
        paddingY: "0.5rem",
      },
  
      // Layout
      card: {
        padding: "1.25rem", // 20px
        borderRadius: "0.5rem", // 8px
      },
  
      // Grid
      grid: {
        gap: "1rem", // 16px
        gapMd: "1.5rem", // 24px
      },
  
      // Icons
      icon: {
        sm: "0.875rem", // 14px
        base: "1rem", // 16px
        lg: "1.25rem", // 20px
      },
  
      // Step indicator
      step: {
        indicatorSize: "2.5rem", // 40px
        indicatorSpacing: "0.75rem", // 12px
      },
    },
  
    // Borders and Radii
    borders: {
      // Border widths
      width: {
        default: "1px",
        2: "2px",
      },
  
      // Border radii
      radius: {
        sm: "0.125rem", // 2px
        md: "0.375rem", // 6px
        lg: "0.5rem", // 8px
        xl: "0.75rem", // 12px
        "2xl": "1rem", // 16px
        full: "9999px", // For rounded elements like avatars
      },
    },
  
    // Shadows
    shadows: {
      sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
      md: "0 4px 6px -1px rgba(0, 0, 0, 0.15)",
      lg: "0 4px 20px rgba(0, 0, 0, 0.15)",
      inner: "inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)",
    },
  
    // Animations and Transitions
    animations: {
      // Durations
      duration: {
        75: "75ms",
        100: "100ms",
        150: "150ms",
        200: "200ms",
        300: "300ms",
        400: "400ms",
        500: "500ms",
        700: "700ms",
        1000: "1000ms",
      },
  
      // Timing Functions
      easing: {
        linear: "linear",
        in: "cubic-bezier(0.4, 0, 1, 1)",
        out: "cubic-bezier(0, 0, 0.2, 1)",
        inOut: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  
    // Responsive Breakpoints
    breakpoints: {
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
  
    // Form Controls
    form: {
      label: {
        spacing: "0.25rem", // 4px
        textColor: "#cbd5e1",
        iconColor: "#94a3b8",
      },
      validation: {
        minHeight: "1rem", // 16px
        errorColor: "#ef4444",
        errorSize: "0.75rem", // 12px
      },
    },
  
    // Cards and Panels
    cards: {
      bg: "#0f1a2e",
      padding: "1.25rem", // 20px
      borderRadius: "0.5rem", // 8px
      borderColor: "transparent",
      shadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
    },
  
    // Accordion
    accordion: {
      headerPadding: "0.5rem",
      contentSpacing: "0.5rem", // 8px
      bg: "transparent",
      itemSpacing: "1rem", // 16px
    },
  }
  
  // Export types for better TypeScript support
  export type ThemeConfig = typeof themeConfig
  export type ColorTheme = typeof themeConfig.colors
  export type TypographyTheme = typeof themeConfig.typography
  export type SpacingTheme = typeof themeConfig.spacing
  
  