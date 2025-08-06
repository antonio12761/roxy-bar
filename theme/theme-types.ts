// Definizione dei tipi per il sistema di temi

export type ThemeMode = "light" | "dark" | "system"
export type FontSize = "normal" | "large" | "x-large"

export interface ThemeSettings {
  fontSize: FontSize
  glassEffect: boolean
}

export interface ThemeColors {
  // Background Colors
  bg: {
    dark: string
    card: string
    darker: string
    hover: string
    input: string
    accordion: string
    riepilogo: string
    main?: string
  }

  // Text Colors
  text: {
    primary: string
    secondary: string
    muted: string
    icon: string
    help: string
    accent: string
    success: string
    error: string
    warning?: string
    info?: string
  }

  // Border Colors
  border: {
    primary: string
    secondary: string
    accent: string
    success: string
    error: string
  }

  // Button Colors
  button: {
    primary: string
    primaryHover: string
    primaryText: string
    outlineBg: string
    outlineBorder: string
    outlineText: string
    outlineHover: string
    success: string
    successHover: string
    successText: string
    danger: string
    dangerHover: string
    dangerText: string
    warning?: string
    warningHover?: string
    warningText?: string
    secondary?: string
    secondaryHover?: string
    secondaryText?: string
  }

  // Table Colors
  table?: {
    occupied: string
    occupiedText: string
  }

  // Step Colors
  step: {
    activeBg: string
    activeText: string
    inactiveBg: string
    inactiveText: string
    inactiveBorder: string
    completedText: string
    completedBorder: string
  }

  // Dialog Effects
  dialog: {
    bgOpacity: number
    backdropBlur: string
    borderOpacity: number
  }

  // Scrollbar Colors
  scrollbar?: {
    track: string
    thumb: string
    thumbHover: string
  }

  // Toast Colors
  toast?: {
    bg: string
    text: string
    border: string
  }

  // Input Colors
  input?: {
    focus: string
    error: string
    placeholder: string
  }

  // Chat Colors
  chat?: {
    messageBgUser: string
    messageTextUser: string
    messageBgOther: string
    messageTextOther: string
    typingIndicator: string
  }

  // Accent color (root level)
  accent?: string

  // Status colors
  status?: {
    success: string
    error: string
    warning?: string
    info?: string
    pending?: string
  }
}

export interface ThemeDefinition {
  id: string
  name: string
  description?: string
  colors: {
    light: ThemeColors
    dark: ThemeColors
  }
  // Nuova proprietà per le impostazioni predefinite del tema
  defaults?: {
    glassEffect: boolean
    lineHeight?: number
    letterSpacing?: string
  }
}

