'use server'

import { prisma } from '@/lib/db'

export async function getCategoryEmojis() {
  try {
    // Usa la nuova tabella CategoryIcon
    const icons = await prisma.categoryIcon.findMany()
    
    // Crea una mappa per accesso rapido con supporto per tipo di icona
    const emojiMap: { [key: string]: { emoji: string | null, color: string | null, iconType?: string } } = {}
    
    icons.forEach(icon => {
      // Mappa sia il nome normale che uppercase per compatibilità
      emojiMap[icon.categoryName] = {
        emoji: icon.icon,
        color: icon.color,
        iconType: icon.iconType
      }
      emojiMap[icon.categoryName.toUpperCase()] = {
        emoji: icon.icon,
        color: icon.color,
        iconType: icon.iconType
      }
    })

    return emojiMap
  } catch (error) {
    console.error('Errore nel caricamento delle emoji:', error)
    // Ritorna emoji di default in caso di errore
    return getDefaultEmojis()
  }
}

function getDefaultEmojis() {
  return {
    'CAFFETTERIA': { emoji: '☕', color: '#6B4423' },
    'CAFFE': { emoji: '☕', color: '#6B4423' },
    'BIRRE': { emoji: '🍺', color: '#F59E0B' },
    'COCKTAIL': { emoji: '🍹', color: '#EC4899' },
    'APERITIVI': { emoji: '🥂', color: '#F59E0B' },
    'VINI': { emoji: '🍷', color: '#991B1B' },
    'BIBITE': { emoji: '🥤', color: '#3B82F6' },
    'PANINI': { emoji: '🥪', color: '#84CC16' },
    'PIZZA': { emoji: '🍕', color: '#EF4444' },
    'DOLCI': { emoji: '🍰', color: '#EC4899' },
    'GELATI': { emoji: '🍨', color: '#06B6D4' },
    'SUPERALCOLICI': { emoji: '🥃', color: '#B45309' },
    'LIQUORI': { emoji: '🥃', color: '#B45309' },
    'AMARI': { emoji: '🥃', color: '#059669' }
  }
}