import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seedMenu() {
  console.log('🌱 Seeding menu data...')
  
  try {
    // Crea gruppo Colazione
    const colazioneGroup = await prisma.menuGroup.create({
      data: {
        nome: 'Colazione al Roxy',
        descrizione: 'Inizia la giornata con gusto',
        icona: '☕',
        colore: '#FFD700',
        ordinamento: 1,
        orarioInizio: '07:00',
        orarioFine: '12:00',
        attivo: true
      }
    })
    
    // Crea categoria Cornetti
    const cornettiCategory = await prisma.menuCategory.create({
      data: {
        groupId: colazioneGroup.id,
        nome: 'Cornetti',
        descrizione: 'Freschi ogni mattina',
        ordinamento: 1,
        attivo: true
      }
    })
    
    // Crea cornetto con varianti
    const cornetto = await prisma.menuItem.create({
      data: {
        categoryId: cornettiCategory.id,
        nome: 'Cornetto',
        descrizione: 'alla Nutella, al Pistacchio, Lamponi e Yogurt, Miele e Zenzero, Curcuma e Mirtillo',
        icona: '🥐',
        ordinamento: 1,
        attivo: true,
        disponibile: true
      }
    })
    
    // Crea varianti cornetto
    await prisma.menuVariant.createMany({
      data: [
        { menuItemId: cornetto.id, nome: 'Semplice', prezzo: 0.80, ordinamento: 1 },
        { menuItemId: cornetto.id, nome: 'alla Marmellata', prezzo: 1.00, ordinamento: 2 },
        { menuItemId: cornetto.id, nome: 'alla Crema', prezzo: 1.00, ordinamento: 3 },
        { menuItemId: cornetto.id, nome: 'al Cioccolato', prezzo: 1.00, ordinamento: 4 },
        { menuItemId: cornetto.id, nome: 'Speciale (Nutella, Pistacchio, etc.)', prezzo: 1.50, ordinamento: 5 }
      ]
    })
    
    // Crea categoria Caffetteria
    const caffetteriaCategory = await prisma.menuCategory.create({
      data: {
        groupId: colazioneGroup.id,
        nome: 'Caffetteria',
        descrizione: 'Il nostro caffè selezionato',
        ordinamento: 2,
        attivo: true
      }
    })
    
    // Aggiungi alcuni caffè
    await prisma.menuItem.createMany({
      data: [
        {
          categoryId: caffetteriaCategory.id,
          nome: 'Caffè Espresso',
          prezzoBase: 1.20,
          ordinamento: 1,
          attivo: true,
          disponibile: true
        },
        {
          categoryId: caffetteriaCategory.id,
          nome: 'Cappuccino',
          prezzoBase: 1.40,
          ordinamento: 2,
          attivo: true,
          disponibile: true
        },
        {
          categoryId: caffetteriaCategory.id,
          nome: 'Latte Macchiato',
          prezzoBase: 1.50,
          ordinamento: 3,
          attivo: true,
          disponibile: true
        }
      ]
    })
    
    // Crea gruppo Aperitivo
    const aperitivoGroup = await prisma.menuGroup.create({
      data: {
        nome: 'Aperitivo al Roxy',
        descrizione: 'I nostri cocktail e aperitivi',
        icona: '🍹',
        colore: '#FF6B6B',
        ordinamento: 2,
        orarioInizio: '17:00',
        orarioFine: '21:00',
        attivo: true
      }
    })
    
    // Crea categoria Cocktails
    const cocktailsCategory = await prisma.menuCategory.create({
      data: {
        groupId: aperitivoGroup.id,
        nome: 'Cocktails Aperitivi',
        descrizione: 'I grandi classici',
        ordinamento: 1,
        attivo: true
      }
    })
    
    // Aggiungi cocktails
    await prisma.menuItem.createMany({
      data: [
        {
          categoryId: cocktailsCategory.id,
          nome: 'Americano',
          descrizione: 'Campari Bitter, Vermouth Rosso, Soda',
          prezzoBase: 4.00,
          icona: '🗽',
          coloreNome: '#FF6B6B',
          ordinamento: 1,
          attivo: true,
          disponibile: true,
          evidenziato: true
        },
        {
          categoryId: cocktailsCategory.id,
          nome: 'Negroni Sbagliato',
          descrizione: 'Campari Bitter, Vermouth Rosso, Prosecco',
          prezzoBase: 4.00,
          coloreNome: '#FFD700',
          ordinamento: 2,
          attivo: true,
          disponibile: true
        },
        {
          categoryId: cocktailsCategory.id,
          nome: 'Hugo',
          descrizione: 'Prosecco, Sciroppo di Sambuco, Succo di Lime, Foglie di Menta',
          prezzoBase: 3.50,
          icona: '🌿',
          coloreNome: '#90EE90',
          ordinamento: 3,
          attivo: true,
          disponibile: true,
          novita: true
        }
      ]
    })
    
    // Crea gruppo Long Drinks
    const longDrinksGroup = await prisma.menuGroup.create({
      data: {
        nome: 'Long Drinks',
        descrizione: 'Cocktails rinfrescanti',
        icona: '🥤',
        colore: '#4ECDC4',
        ordinamento: 3,
        attivo: true
      }
    })
    
    // Crea categoria Long Drinks
    const longDrinksCategory = await prisma.menuCategory.create({
      data: {
        groupId: longDrinksGroup.id,
        nome: 'I Nostri Long Drinks',
        ordinamento: 1,
        attivo: true
      }
    })
    
    // Aggiungi long drinks
    await prisma.menuItem.createMany({
      data: [
        {
          categoryId: longDrinksCategory.id,
          nome: 'Sex on The Beach',
          descrizione: 'Vodka alla Pesca, Succo d\'Arancia, Sciroppo di Granatina',
          prezzoBase: 5.00,
          icona: '🏖️',
          coloreNome: '#FF69B4',
          ordinamento: 1,
          attivo: true,
          disponibile: true,
          evidenziato: true
        },
        {
          categoryId: longDrinksCategory.id,
          nome: 'Gin Tonic',
          prezzoBase: 5.00,
          ordinamento: 2,
          attivo: true,
          disponibile: true
        },
        {
          categoryId: longDrinksCategory.id,
          nome: 'Cuba Libre',
          descrizione: 'Rum, Coca Cola, Lime',
          prezzoBase: 5.00,
          ordinamento: 3,
          attivo: true,
          disponibile: true
        }
      ]
    })
    
    // Crea gruppo Birre
    const birreGroup = await prisma.menuGroup.create({
      data: {
        nome: 'Birre',
        descrizione: 'Selezione di birre artigianali e industriali',
        icona: '🍺',
        colore: '#F39C12',
        ordinamento: 4,
        attivo: true
      }
    })
    
    console.log('✅ Menu seeded successfully!')
    console.log(`Created:`)
    console.log(`- 4 Menu Groups`)
    console.log(`- 5 Categories`)
    console.log(`- Multiple items with variants`)
    
  } catch (error) {
    console.error('❌ Error seeding menu:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

seedMenu()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })