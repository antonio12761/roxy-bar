#!/bin/bash
# Wrapper per Claude che gestisce automaticamente le sessioni

# Colori per output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Avvia la sessione automaticamente
echo -e "${BLUE}🚀 Avvio Claude con gestione sessione automatica...${NC}"
echo ""

# Esegui session:start in background
npm run session:start 2>/dev/null

echo ""
echo -e "${GREEN}✅ Sessione avviata!${NC}"
echo -e "${YELLOW}💡 Usa 'npm run session:quick work \"descrizione\"' per tracciare i progressi${NC}"
echo ""

# Avvia Claude con tutti i parametri passati
claude-chat "$@"

# Quando Claude termina, chiedi se salvare la sessione
echo ""
echo -e "${BLUE}🏁 Claude terminato. Chiusura sessione...${NC}"

# Chiedi se vuole salvare lo stato
read -p "Vuoi salvare lo stato della sessione? (s/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Ss]$ ]]; then
    npm run session:end
else
    echo -e "${YELLOW}⚠️  Sessione non salvata. Usa 'npm run session:end' per salvare manualmente.${NC}"
fi