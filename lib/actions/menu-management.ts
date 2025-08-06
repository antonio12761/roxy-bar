'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

// ============================================
// MENU GROUPS
// ============================================

export async function getMenuGroups() {
  try {
    const groups = await prisma.menuGroup.findMany({
      where: { attivo: true },
      orderBy: { ordinamento: 'asc' },
      include: {
        MenuCategories: {
          where: { attivo: true },
          orderBy: { ordinamento: 'asc' },
          include: {
            _count: {
              select: { MenuItems: true }
            }
          }
        }
      }
    })
    
    // Convert any JSON fields to plain objects
    const plainGroups = groups.map(group => ({
      ...group,
      MenuCategories: group.MenuCategories.map(category => ({
        ...category,
        stileSpeciale: category.stileSpeciale ? JSON.parse(JSON.stringify(category.stileSpeciale)) : null
      }))
    }))
    
    return { success: true, groups: plainGroups }
  } catch (error) {
    console.error('Errore nel recupero dei gruppi menu:', error)
    return { success: false, error: 'Errore nel recupero dei gruppi menu', groups: [] }
  }
}

export async function createMenuGroup(data: {
  nome: string
  descrizione?: string
  icona?: string
  colore?: string
  ordinamento?: number
  orarioInizio?: string
  orarioFine?: string
  giorniSettimana?: number[]
}) {
  try {
    const group = await prisma.menuGroup.create({
      data: {
        ...data,
        ordinamento: data.ordinamento || 0,
        giorniSettimana: data.giorniSettimana || [1, 2, 3, 4, 5, 6, 7]
      }
    })
    
    revalidatePath('/dashboard/menu-builder')
    revalidatePath('/menu')
    
    return { success: true, group }
  } catch (error) {
    console.error('Errore nella creazione del gruppo menu:', error)
    return { success: false, error: 'Errore nella creazione del gruppo menu' }
  }
}

export async function updateMenuGroup(id: string, data: {
  nome?: string
  descrizione?: string
  icona?: string
  colore?: string
  ordinamento?: number
  attivo?: boolean
  orarioInizio?: string
  orarioFine?: string
  giorniSettimana?: number[]
}) {
  try {
    const group = await prisma.menuGroup.update({
      where: { id },
      data
    })
    
    revalidatePath('/dashboard/menu-builder')
    revalidatePath('/menu')
    
    return { success: true, group }
  } catch (error) {
    console.error('Errore nell\'aggiornamento del gruppo menu:', error)
    return { success: false, error: 'Errore nell\'aggiornamento del gruppo menu' }
  }
}

export async function deleteMenuGroup(id: string) {
  try {
    await prisma.menuGroup.delete({
      where: { id }
    })
    
    revalidatePath('/dashboard/menu-builder')
    revalidatePath('/menu')
    
    return { success: true }
  } catch (error) {
    console.error('Errore nell\'eliminazione del gruppo menu:', error)
    return { success: false, error: 'Errore nell\'eliminazione del gruppo menu' }
  }
}

// ============================================
// MENU CATEGORIES
// ============================================

export async function createMenuCategory(data: {
  groupId: string
  nome: string
  descrizione?: string
  ordinamento?: number
  stileSpeciale?: any
}) {
  try {
    const category = await prisma.menuCategory.create({
      data: {
        ...data,
        ordinamento: data.ordinamento || 0
      }
    })
    
    revalidatePath('/dashboard/menu-builder')
    revalidatePath('/menu')
    
    return { success: true, category }
  } catch (error) {
    console.error('Errore nella creazione della categoria menu:', error)
    return { success: false, error: 'Errore nella creazione della categoria menu' }
  }
}

export async function updateMenuCategory(id: string, data: {
  nome?: string
  descrizione?: string
  ordinamento?: number
  attivo?: boolean
  stileSpeciale?: any
}) {
  try {
    const category = await prisma.menuCategory.update({
      where: { id },
      data
    })
    
    revalidatePath('/dashboard/menu-builder')
    revalidatePath('/menu')
    
    return { success: true, category }
  } catch (error) {
    console.error('Errore nell\'aggiornamento della categoria menu:', error)
    return { success: false, error: 'Errore nell\'aggiornamento della categoria menu' }
  }
}

export async function deleteMenuCategory(id: string) {
  try {
    await prisma.menuCategory.delete({
      where: { id }
    })
    
    revalidatePath('/dashboard/menu-builder')
    revalidatePath('/menu')
    
    return { success: true }
  } catch (error) {
    console.error('Errore nell\'eliminazione della categoria menu:', error)
    return { success: false, error: 'Errore nell\'eliminazione della categoria menu' }
  }
}

// ============================================
// MENU ITEMS
// ============================================

export async function createMenuItem(data: {
  categoryId: string
  prodottoId?: number
  nome: string
  descrizione?: string
  prezzoBase?: number
  icona?: string
  coloreNome?: string
  ordinamento?: number
  evidenziato?: boolean
  novita?: boolean
}) {
  try {
    const menuItem = await prisma.menuItem.create({
      data: {
        ...data,
        prezzoBase: data.prezzoBase ? data.prezzoBase : undefined,
        ordinamento: data.ordinamento || 0
      }
    })
    
    revalidatePath('/dashboard/menu-builder')
    revalidatePath('/menu')
    
    return { success: true, menuItem }
  } catch (error) {
    console.error('Errore nella creazione del menu item:', error)
    return { success: false, error: 'Errore nella creazione del menu item' }
  }
}

export async function updateMenuItem(id: string, data: {
  nome?: string
  descrizione?: string
  prezzoBase?: number
  icona?: string
  coloreNome?: string
  ordinamento?: number
  attivo?: boolean
  disponibile?: boolean
  evidenziato?: boolean
  novita?: boolean
}) {
  try {
    const menuItem = await prisma.menuItem.update({
      where: { id },
      data: {
        ...data,
        prezzoBase: data.prezzoBase !== undefined ? data.prezzoBase : undefined
      }
    })
    
    revalidatePath('/dashboard/menu-builder')
    revalidatePath('/menu')
    
    return { success: true, menuItem }
  } catch (error) {
    console.error('Errore nell\'aggiornamento del menu item:', error)
    return { success: false, error: 'Errore nell\'aggiornamento del menu item' }
  }
}

export async function deleteMenuItem(id: string) {
  try {
    await prisma.menuItem.delete({
      where: { id }
    })
    
    revalidatePath('/dashboard/menu-builder')
    revalidatePath('/menu')
    
    return { success: true }
  } catch (error) {
    console.error('Errore nell\'eliminazione del menu item:', error)
    return { success: false, error: 'Errore nell\'eliminazione del menu item' }
  }
}

// ============================================
// MENU VARIANTS
// ============================================

export async function createMenuVariant(data: {
  menuItemId: string
  nome: string
  prezzo: number
  disponibile?: boolean
  ordinamento?: number
}) {
  try {
    const variant = await prisma.menuVariant.create({
      data: {
        ...data,
        disponibile: data.disponibile ?? true,
        ordinamento: data.ordinamento || 0
      }
    })
    
    revalidatePath('/dashboard/menu-builder')
    revalidatePath('/menu')
    
    return { success: true, variant }
  } catch (error) {
    console.error('Errore nella creazione della variante:', error)
    return { success: false, error: 'Errore nella creazione della variante' }
  }
}

export async function updateMenuVariant(id: string, data: {
  nome?: string
  prezzo?: number
  disponibile?: boolean
  ordinamento?: number
}) {
  try {
    const variant = await prisma.menuVariant.update({
      where: { id },
      data
    })
    
    revalidatePath('/dashboard/menu-builder')
    revalidatePath('/menu')
    
    return { success: true, variant }
  } catch (error) {
    console.error('Errore nell\'aggiornamento della variante:', error)
    return { success: false, error: 'Errore nell\'aggiornamento della variante' }
  }
}

export async function deleteMenuVariant(id: string) {
  try {
    await prisma.menuVariant.delete({
      where: { id }
    })
    
    revalidatePath('/dashboard/menu-builder')
    revalidatePath('/menu')
    
    return { success: true }
  } catch (error) {
    console.error('Errore nell\'eliminazione della variante:', error)
    return { success: false, error: 'Errore nell\'eliminazione della variante' }
  }
}

// ============================================
// IMPORT FROM PRODUCTS
// ============================================

export async function importProductsToMenu(categoryId: string, productIds: number[]) {
  try {
    const products = await prisma.prodotto.findMany({
      where: {
        id: { in: productIds },
        isDeleted: false
      }
    })
    
    const menuItems = await Promise.all(
      products.map((product, index) => 
        prisma.menuItem.create({
          data: {
            categoryId,
            prodottoId: product.id,
            nome: product.nome,
            descrizione: product.descrizione,
            prezzoBase: product.prezzo,
            ordinamento: index,
            disponibile: product.disponibile && !product.terminato
          }
        })
      )
    )
    
    revalidatePath('/dashboard/menu-builder')
    revalidatePath('/menu')
    
    return { 
      success: true, 
      itemsCreated: menuItems.length,
      message: `${menuItems.length} prodotti importati nel menu` 
    }
  } catch (error) {
    console.error('Errore nell\'importazione dei prodotti:', error)
    return { success: false, error: 'Errore nell\'importazione dei prodotti' }
  }
}

// ============================================
// GET FULL MENU (FOR PUBLIC PAGE)
// ============================================

export async function getPublicMenu() {
  try {
    const now = new Date()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()
    const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`
    const currentDay = now.getDay() || 7 // Sunday is 0, convert to 7
    
    const groups = await prisma.menuGroup.findMany({
      where: { 
        attivo: true,
        giorniSettimana: { has: currentDay }
      },
      orderBy: { ordinamento: 'asc' },
      include: {
        MenuCategories: {
          where: { attivo: true },
          orderBy: { ordinamento: 'asc' },
          include: {
            MenuItems: {
              where: { 
                attivo: true,
                disponibile: true
              },
              orderBy: { ordinamento: 'asc' },
              include: {
                MenuVariants: {
                  where: { disponibile: true },
                  orderBy: { ordinamento: 'asc' }
                },
                Prodotto: {
                  select: {
                    disponibile: true,
                    terminato: true
                  }
                }
              }
            }
          }
        }
      }
    })
    
    // Filter by time if specified
    const filteredGroups = groups.filter(group => {
      if (!group.orarioInizio || !group.orarioFine) return true
      return currentTime >= group.orarioInizio && currentTime <= group.orarioFine
    })
    
    // Filter out items linked to terminated or unavailable products and convert Decimals
    const menuData = filteredGroups.map(group => ({
      ...group,
      MenuCategories: group.MenuCategories.map(category => ({
        ...category,
        MenuItems: category.MenuItems.filter(item => {
          if (item.Prodotto) {
            return item.Prodotto.disponibile && !item.Prodotto.terminato
          }
          return true
        }).map(item => ({
          ...item,
          prezzoBase: item.prezzoBase ? Number(item.prezzoBase) : null,
          MenuVariants: item.MenuVariants.map(variant => ({
            ...variant,
            prezzo: Number(variant.prezzo)
          }))
        }))
      })).filter(category => category.MenuItems.length > 0)
    })).filter(group => group.MenuCategories.length > 0)
    
    return { success: true, menu: menuData }
  } catch (error) {
    console.error('Errore nel recupero del menu pubblico:', error)
    return { success: false, error: 'Errore nel recupero del menu', menu: [] }
  }
}