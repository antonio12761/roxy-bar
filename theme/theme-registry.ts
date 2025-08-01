import { defaultTheme } from "./style/default-theme"
import { nordTheme } from "./style/nord-theme"
import { creamyTheme } from "./style/creamy-theme"
import { readingTheme } from "./style/reading-theme"
import { lavenderDuskTheme } from "./style/lavender-dusk-theme"
import { darkGoldTheme } from "./style/dark-gold-theme"
import { oceanBronzeTheme } from "./style/ocean-bronze-theme"
import type { ThemeDefinition } from "./theme-types"

// Array di tutti i temi disponibili - ordinati dal più chiaro al più scuro (tema scuro)
// Default sempre primo, poi gli altri in ordine di luminosità decrescente
const themes: ThemeDefinition[] = [
  defaultTheme,      // Sempre primo
  creamyTheme,       // #32302f - più chiaro
  nordTheme,         // #2e3440
  lavenderDuskTheme, // #1A1B26
  darkGoldTheme,     // #1A1A1A
  oceanBronzeTheme,  // #051821
  readingTheme       // #000000 - più scuro
]

// Funzione per ottenere tutti i temi disponibili
export function getAllThemes(): ThemeDefinition[] {
  return themes
}

// Funzione per ottenere un tema specifico per ID
export function getThemeById(id: string): ThemeDefinition | undefined {
  return themes.find((theme) => theme.id === id)
}

// Funzione per ottenere il tema predefinito
export function getDefaultTheme(): ThemeDefinition {
  return defaultTheme
}

