# Tab Bookmarks & Fused Cards Style Guide

## Concetto Design

Il sistema di tab-linguette e card fuse è ispirato alle linguette dei libri e ai divisori fisici, creando un'interfaccia che simula elementi del mondo reale con un'estetica moderna e digitale.

## Tab-Linguette (Tab Bookmarks)

### Caratteristiche Principali

#### 1. **Struttura Base**
```css
- Bordi arrotondati superiori: rounded-t-2xl
- Bordi: border-t-2, border-r-2, border-l-2 (solo prima tab)
- Padding: px-4 py-3
- Font: text-sm font-medium
- Transizioni: transition-all duration-300 ease-out
```

#### 2. **Stati e Colori**
- **Tab Attiva**: 
  - Background: `colors.bg.card`
  - Bordo: `colors.border.primary`
  - Testo: `colors.text.primary`
  - Bordo inferiore: `transparent` (per fusione con card)
  - Margin bottom: `-2px` (sovrapposizione con card)
  - Z-index: `20`

- **Tab Non Attive**:
  - Background: `colors.bg.dark`
  - Bordo: `colors.border.secondary`
  - Testo: `colors.text.secondary`
  - Bordo inferiore: `colors.border.secondary`
  - Z-index: `10`

#### 3. **Effetto Hover**
```javascript
onMouseEnter: backgroundColor → colors.bg.hover
onMouseLeave: backgroundColor → colors.bg.dark
hover:scale-105
```

#### 4. **Layout**
- Container: `flex mb-0` (nessun gap tra tab)
- Prima tab: `border-l-2 rounded-tl-2xl`
- Ultima tab: `rounded-tr-2xl`
- Tab intermedie: solo `border-r-2`

### Esempio Implementazione Tab
```jsx
<TabBookmarks 
  tabs={[
    {
      id: 'attesa',
      title: 'Attesa (5)',
      icon: Clock,
      isActive: activeTab === 'attesa',
      onClick: () => setActiveTab('attesa')
    }
  ]}
  className="mb-0"
/>
```

## Card Fuse (Order Cards)

### Caratteristiche Principali

#### 1. **Struttura Base**
```css
- Prima card: rounded-t-2xl border-t-2
- Ultima card: rounded-b-2xl border-b-2
- Card intermedie: border-t-0 border-b-0
- Tutti: border-l-2 border-r-2
- Padding interno: p-3 sm:p-4
```

#### 2. **Stati e Colori** (Invertiti)
- **Card Selezionata**:
  - Background: `colors.bg.dark` ⚡ (Scuro per enfasi)
  - Bordo: `colors.border.primary`
  - Bordo inferiore: `transparent` (fusione con card sotto)
  - Margin bottom: `-2px` (sovrapposizione)
  - Z-index: `10`

- **Card Non Selezionate**:
  - Background: `colors.bg.card` ⚡ (Chiaro per contrasto)
  - Bordo: `colors.border.secondary`
  - Z-index: `1`

- **Card Stato PRONTO**:
  - Background: `colors.button.success`
  - Bordo: `colors.button.success`

#### 3. **Effetto Hover**
```javascript
onMouseEnter: {
  borderColor: colors.accent + '60',
  backgroundColor: colors.bg.hover
}
onMouseLeave: {
  borderColor: colors.border.secondary,
  backgroundColor: colors.bg.card  // Ritorna al chiaro
}
```

#### 4. **Layout Container**
- Container: `space-y-0` (nessun gap tra card)
- Le card si toccano e condividono i bordi

### Esempio Implementazione Card
```jsx
<div className="space-y-0">
  {orders.map((order, index) => (
    <OrderListCard
      cardIndex={index}
      totalCards={orders.length}
      isSelected={selectedOrder?.id === order.id}
      // ... altri props
    />
  ))}
</div>
```

## TabContentCard (Contenitore Principale)

### Caratteristiche
```css
- Border: border-2
- Arrotondamento: rounded-2xl (ma borderTopLeftRadius: 0)
- Shadow: shadow-lg
- Backdrop: backdrop-blur-sm
- Background: colors.bg.card
- Border color: colors.border.primary
```

## Principi di Design

### 1. **Fusione Visiva**
- Tab attiva e card selezionata eliminano i bordi tra loro
- Uso di margini negativi per sovrapposizione
- Bordi trasparenti nei punti di connessione

### 2. **Gerarchia Visiva**
- Z-index gestisce il layering (attivo > inattivo)
- Contrasto di colore (card vs dark background)
- Stati hover per feedback interattivo

### 3. **Continuità**
- Le tab sono attaccate senza spazi
- Le card sono impilate senza gap
- Bordi condivisi tra elementi adiacenti

### 4. **Responsività**
- Padding adattivo (p-3 sm:p-4)
- Testi abbreviati su mobile
- Layout flessibile

## Palette Colori (Theme-aware)

```javascript
// Background (Card con colori invertiti)
bg.card      // Card NON selezionate (chiaro)
bg.dark      // Card SELEZIONATE e tab non attive (scuro)
bg.hover     // Stati hover

// Bordi
border.primary    // Elementi attivi
border.secondary  // Elementi inattivi

// Testo
text.primary     // Testo principale
text.secondary   // Testo secondario
text.muted       // Testo disabilitato

// Accenti
accent           // Hover e focus
button.success   // Stati completati
```

## Animazioni e Transizioni

```css
transition-all duration-300 ease-out  // Tab
transition-all cursor-pointer         // Card
hover:scale-105                       // Tab hover
```

## Best Practices

1. **Mantenere la coerenza**: Usare sempre gli stessi colori dal tema
2. **Feedback visivo**: Hover states chiari e immediati
3. **Accessibilità**: Contrasti sufficienti tra stati
4. **Performance**: Usare React.memo per card con molti elementi
5. **Responsive**: Testare su diversi viewport

## Esempio Completo

```jsx
// Tab e contenuto fusi
<div>
  {/* Tab-linguette */}
  <TabBookmarks tabs={tabsConfig} />
  
  {/* Contenuto con card fuse */}
  <TabContentCard>
    <div className="space-y-0">
      {items.map((item, index) => (
        <FusedCard
          key={item.id}
          cardIndex={index}
          totalCards={items.length}
          isSelected={selected === item.id}
        />
      ))}
    </div>
  </TabContentCard>
</div>
```

## Note Tecniche

- Il sistema supporta temi dinamici attraverso `useTheme`
- I colori si adattano automaticamente al tema corrente
- Le transizioni CSS garantiscono fluidità
- Z-index gestisce correttamente la sovrapposizione
- I margini negativi creano l'effetto di fusione