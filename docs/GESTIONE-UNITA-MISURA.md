# Gestione Unità di Misura e Conversioni

## Panoramica

Il sistema gestisce automaticamente le conversioni tra:
- **Unità di Acquisto** (come si compra dal fornitore)
- **Unità di Stoccaggio** (come si conserva in magazzino)
- **Unità di Vendita** (come si vende al cliente)

## Esempi di Conversioni

### 1. Bibite in Cartoni → Bottiglie

**Acquisto:**
- Unità acquisto: `cartone`
- Pezzi per unità: `24`
- Prezzo acquisto: €15.00/cartone

**Vendita:**
- Unità vendita: `bottiglia`
- Prezzo vendita: €3.00/bottiglia

**Conversione:**
```
1 cartone (€15.00) → 24 bottiglie
Costo unitario: €0.625/bottiglia
Ricarico: €2.375/bottiglia (380%)
```

### 2. Alcolici in Bottiglia → Porzioni

**Acquisto:**
- Unità acquisto: `bottiglia`
- Contenuto: `700ml`
- Prezzo acquisto: €25.00/bottiglia

**Vendita:**
- Unità vendita: `porzione`
- Quantità porzione: `40ml`
- Prezzo vendita: €8.00/cocktail

**Conversione:**
```
1 bottiglia (700ml) → 17.5 porzioni (40ml)
Costo porzione: €1.43
Ricarico cocktail: €6.57/porzione (460%)
```

### 3. Caffè in Buste → Tazzine

**Acquisto:**
- Unità acquisto: `busta`
- Peso: `1kg`
- Prezzo acquisto: €15.00/kg

**Vendita:**
- Unità vendita: `tazzina`
- Grammatura: `7g`
- Prezzo vendita: €1.20/caffè

**Conversione:**
```
1 kg (1000g) → 142 caffè (7g)
Costo caffè: €0.105
Ricarico: €1.095/caffè (1043%)
```

## Configurazione nel Sistema

### Tabella ProdottoMagazzino

```typescript
{
  // Esempio: Coca Cola
  prodottoId: 1,
  unitaAcquisto: "cartone",
  pezziPerUnita: 24,
  codiceFornitore: "COCA-33CL-24",
  
  // Esempio: Gin Bombay
  prodottoId: 2,
  unitaAcquisto: "bottiglia",
  pezziPerUnita: 1,
  mlBottiglia: 700,
  mlPorzione: 40,
  
  // Esempio: Caffè
  prodottoId: 3,
  unitaAcquisto: "busta",
  pezziPerUnita: 1,
  pesoUnitario: 1.0, // kg
  grammaturaPorzione: 7
}
```

### Movimenti Automatici

#### Carico da Fornitore
```
Fattura: 10 cartoni Coca Cola
↓
MovimentoTrasferimento:
- tipo: CARICO_FORNITORE
- quantita: 10
- unitaMisura: "cartone"
↓
GiacenzaUbicazione (Magazzino):
- giacenzaAttuale: +240 (10 × 24)
- unitaMisura: "bottiglia"
```

#### Trasferimento al Bar
```
Distinta Prelievo: 48 bottiglie Coca Cola
↓
MovimentoTrasferimento:
- tipo: TRASFERIMENTO
- quantita: 48
- unitaMisura: "bottiglia"
↓
GiacenzaUbicazione (Magazzino): -48 bottiglie
GiacenzaUbicazione (Bar): +48 bottiglie
```

#### Vendita
```
Ordine Cliente: 1 Coca Cola
↓
MovimentoTrasferimento:
- tipo: VENDITA
- quantita: 1
- unitaMisura: "bottiglia"
↓
GiacenzaUbicazione (Bar): -1 bottiglia
```

## Gestione Prodotti Complessi

### Cocktail
Un Gin Tonic richiede:
- 40ml Gin (da bottiglia 700ml)
- 200ml Tonica (1 bottiglietta)
- Ghiaccio e limone (non tracciati)

Il sistema scarica:
- 0.057 bottiglie di gin (40/700)
- 1 bottiglietta tonica

### Birra alla Spina
- Acquisto: fusti da 30L
- Vendita: bicchieri da 0.2L, 0.4L, 0.5L
- Conversione: 1 fusto = 150 birre piccole

## Report e Analisi

### Food Cost per Ubicazione
```sql
-- Costo medio porzione per prodotto
SELECT 
  p.nome,
  pm.unita_acquisto,
  pm.pezzi_per_unita,
  pf.prezzo_unitario as prezzo_acquisto,
  (pf.prezzo_unitario / pm.pezzi_per_unita) as costo_unitario,
  p.prezzo as prezzo_vendita,
  ((p.prezzo - (pf.prezzo_unitario / pm.pezzi_per_unita)) / p.prezzo * 100) as margine_percentuale
FROM Prodotto p
JOIN ProdottoMagazzino pm ON pm.prodotto_id = p.id
JOIN ProdottoFornitore pf ON pf.prodotto_id = p.id
```

### Analisi Rotazione
```sql
-- Consumo medio giornaliero per ubicazione
SELECT 
  u.nome as ubicazione,
  p.nome as prodotto,
  AVG(mt.quantita) as consumo_medio_giornaliero,
  gu.giacenza_attuale,
  (gu.giacenza_attuale / AVG(mt.quantita)) as giorni_copertura
FROM MovimentoTrasferimento mt
JOIN Ubicazione u ON u.id = mt.ubicazione_origine_id
JOIN Prodotto p ON p.id = mt.prodotto_id
JOIN GiacenzaUbicazione gu ON gu.prodotto_id = p.id AND gu.ubicazione_id = u.id
WHERE mt.tipo_movimento = 'VENDITA'
  AND mt.data_movimento > CURRENT_DATE - INTERVAL '30 days'
GROUP BY u.nome, p.nome, gu.giacenza_attuale
```

## Vantaggi del Sistema

1. **Precisione Costi**: Calcolo esatto del costo per porzione venduta
2. **Controllo Sprechi**: Tracciamento differenze tra teorico e reale
3. **Ottimizzazione Acquisti**: Ordini basati su consumi effettivi
4. **Analisi Margini**: Margine preciso per ogni prodotto/porzione
5. **Gestione Scadenze**: FIFO automatico con lotti

## Casi Speciali

### Prodotti Sfusi
- Patatine, arachidi: acquisto in buste da 1kg, vendita a porzioni
- Conversione stimata basata su porzioni medie

### Prodotti Composti
- Panini: tracciamento ingredienti principali
- Aperitivi: kit con più componenti

### Omaggi e Assaggi
- Movimento tipo: OMAGGIO
- Impatto su food cost ma non su ricavi

## Configurazione Iniziale

Per ogni prodotto definire:
1. Come si acquista (cartone, bottiglia, busta, fusto)
2. Quanti pezzi/porzioni per unità acquisto
3. Come si vende (pezzo, bicchiere, porzione)
4. Fattore di conversione
5. Eventuali scarti/perdite medie