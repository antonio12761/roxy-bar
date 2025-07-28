-- Schema database PostgreSQL per gestione prodotti unificata

-- Tabella principale prodotti
CREATE TABLE prodotti (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codice VARCHAR(50) UNIQUE NOT NULL,
    nome VARCHAR(200) NOT NULL,
    categoria VARCHAR(100) NOT NULL,
    sottocategoria VARCHAR(100),
    
    -- Dati Magazzino
    fornitore VARCHAR(200) NOT NULL,
    codice_fornitore VARCHAR(100),
    unita_misura VARCHAR(50) NOT NULL,
    quantita_per_confezione DECIMAL(10,2) NOT NULL DEFAULT 1,
    prezzo_acquisto DECIMAL(10,2) NOT NULL,
    iva DECIMAL(5,2) NOT NULL,
    imponibile DECIMAL(10,2),
    volume_magazzino VARCHAR(50),
    peso DECIMAL(10,3),
    
    -- Dati Menu
    descrizione_menu TEXT,
    prezzo_vendita DECIMAL(10,2) NOT NULL,
    volume_servizio VARCHAR(50),
    tempo_preparazione INTEGER,
    disponibile_menu BOOLEAN DEFAULT false,
    
    -- Inventario
    giacenza_attuale DECIMAL(10,2) NOT NULL DEFAULT 0,
    giacenza_minima DECIMAL(10,2) NOT NULL DEFAULT 0,
    punto_riordino DECIMAL(10,2) NOT NULL DEFAULT 0,
    
    -- Conversioni
    fattore_conversione DECIMAL(10,4) DEFAULT 1,
    unita_servizio VARCHAR(50),
    
    -- Metadata
    data_creazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_ultima_modifica TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    attivo BOOLEAN DEFAULT true,
    
    CONSTRAINT check_prezzi CHECK (prezzo_acquisto > 0 AND prezzo_vendita > 0),
    CONSTRAINT check_iva CHECK (iva >= 0 AND iva <= 100)
);

-- Indici per performance
CREATE INDEX idx_prodotti_categoria ON prodotti(categoria);
CREATE INDEX idx_prodotti_fornitore ON prodotti(fornitore);
CREATE INDEX idx_prodotti_attivo ON prodotti(attivo);
CREATE INDEX idx_prodotti_disponibile_menu ON prodotti(disponibile_menu);

-- Tabella ingredienti (relazione many-to-many)
CREATE TABLE prodotti_ingredienti (
    prodotto_id UUID REFERENCES prodotti(id) ON DELETE CASCADE,
    ingrediente VARCHAR(200) NOT NULL,
    PRIMARY KEY (prodotto_id, ingrediente)
);

-- Tabella allergeni
CREATE TABLE prodotti_allergeni (
    prodotto_id UUID REFERENCES prodotti(id) ON DELETE CASCADE,
    allergene VARCHAR(100) NOT NULL,
    PRIMARY KEY (prodotto_id, allergene)
);

-- Vista per il magazzino
CREATE VIEW vista_magazzino AS
SELECT 
    p.id,
    p.codice,
    p.nome,
    p.categoria,
    p.fornitore,
    p.codice_fornitore,
    p.unita_misura,
    p.quantita_per_confezione,
    p.prezzo_acquisto,
    p.iva,
    p.imponibile,
    p.prezzo_acquisto AS prezzo_con_iva,
    p.volume_magazzino,
    p.giacenza_attuale,
    p.giacenza_minima,
    p.punto_riordino,
    (p.giacenza_attuale * p.prezzo_acquisto) AS valore_giacenza,
    CASE 
        WHEN p.giacenza_attuale <= p.punto_riordino THEN true 
        ELSE false 
    END AS da_riordinare
FROM prodotti p
WHERE p.attivo = true
ORDER BY p.categoria, p.nome;

-- Vista per il menu
CREATE VIEW vista_menu AS
SELECT 
    p.id,
    p.nome,
    p.categoria,
    p.sottocategoria,
    COALESCE(p.descrizione_menu, p.nome) AS descrizione,
    p.prezzo_vendita,
    p.volume_servizio,
    p.tempo_preparazione,
    CASE 
        WHEN p.fattore_conversione > 1 THEN 
            FLOOR(p.giacenza_attuale * p.fattore_conversione)
        ELSE 
            p.giacenza_attuale 
    END AS disponibilita,
    CASE 
        WHEN p.fattore_conversione > 1 THEN 
            p.prezzo_vendita - (p.prezzo_acquisto / p.fattore_conversione)
        ELSE 
            p.prezzo_vendita - p.prezzo_acquisto
    END AS margine_unitario,
    array_agg(DISTINCT i.ingrediente) AS ingredienti,
    array_agg(DISTINCT a.allergene) AS allergeni
FROM prodotti p
LEFT JOIN prodotti_ingredienti i ON p.id = i.prodotto_id
LEFT JOIN prodotti_allergeni a ON p.id = a.prodotto_id
WHERE p.attivo = true AND p.disponibile_menu = true
GROUP BY p.id
ORDER BY p.categoria, p.nome;

-- Vista prodotti da riordinare
CREATE VIEW prodotti_da_riordinare AS
SELECT 
    p.*,
    (p.punto_riordino - p.giacenza_attuale) AS quantita_suggerita_ordine
FROM prodotti p
WHERE p.attivo = true 
    AND p.giacenza_attuale <= p.punto_riordino
ORDER BY (p.giacenza_attuale / NULLIF(p.giacenza_minima, 0)) ASC;

-- Funzione per registrare una vendita
CREATE OR REPLACE FUNCTION registra_vendita(
    p_prodotto_id UUID,
    p_quantita DECIMAL(10,2)
) RETURNS void AS $$
DECLARE
    v_fattore_conversione DECIMAL(10,4);
    v_quantita_magazzino DECIMAL(10,2);
BEGIN
    -- Ottieni il fattore di conversione
    SELECT fattore_conversione INTO v_fattore_conversione
    FROM prodotti
    WHERE id = p_prodotto_id;
    
    -- Calcola la quantità da scalare dal magazzino
    v_quantita_magazzino := p_quantita / v_fattore_conversione;
    
    -- Aggiorna la giacenza
    UPDATE prodotti 
    SET giacenza_attuale = giacenza_attuale - v_quantita_magazzino,
        data_ultima_modifica = CURRENT_TIMESTAMP
    WHERE id = p_prodotto_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger per aggiornare data_ultima_modifica
CREATE OR REPLACE FUNCTION update_data_modifica()
RETURNS TRIGGER AS $$
BEGIN
    NEW.data_ultima_modifica = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_data_modifica
BEFORE UPDATE ON prodotti
FOR EACH ROW
EXECUTE FUNCTION update_data_modifica();

-- Esempi di inserimento
INSERT INTO prodotti (
    codice, nome, categoria, sottocategoria,
    fornitore, unita_misura, quantita_per_confezione,
    prezzo_acquisto, iva, volume_magazzino,
    descrizione_menu, prezzo_vendita, volume_servizio,
    disponibile_menu, giacenza_attuale, giacenza_minima,
    punto_riordino, fattore_conversione, unita_servizio
) VALUES 
(
    'BEV001', 'Coca Cola', 'Bevande', 'Bibite',
    'Coca Cola HBC', 'cartone', 24,
    12.00, 10, '24x33cl',
    'Coca Cola classica', 3.50, '33cl',
    true, 10, 5,
    8, 24, 'lattina'
),
(
    'WINE001', 'Chianti Classico', 'Vini', 'Rossi',
    'Cantina Antinori', 'bottiglia', 1,
    15.00, 22, '75cl',
    'Chianti Classico DOCG, corpo medio, note di ciliegia', 35.00, '15cl',
    true, 20, 10,
    15, 5, 'calice'
);