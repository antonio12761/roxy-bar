#!/bin/bash
# Script per installare l'alias claude globalmente

# Colori
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Percorso assoluto dello script
SCRIPT_PATH="$(cd "$(dirname "$0")" && pwd)/claude-session.sh"

# Determina il file di configurazione della shell
if [ -n "$ZSH_VERSION" ]; then
    SHELL_CONFIG="$HOME/.zshrc"
    SHELL_NAME="zsh"
elif [ -n "$BASH_VERSION" ]; then
    SHELL_CONFIG="$HOME/.bashrc"
    SHELL_NAME="bash"
else
    echo -e "${YELLOW}⚠️  Shell non supportata. Aggiungi manualmente l'alias.${NC}"
    exit 1
fi

echo -e "${BLUE}📦 Installazione alias Claude con sessione automatica...${NC}"

# Rimuovi vecchi alias se esistono
sed -i.bak '/# Claude with session management/d' "$SHELL_CONFIG"
sed -i.bak '/alias claude=/d' "$SHELL_CONFIG"

# Aggiungi nuovo alias
echo "" >> "$SHELL_CONFIG"
echo "# Claude with session management" >> "$SHELL_CONFIG"
echo "alias claude='cd $(pwd) && $SCRIPT_PATH'" >> "$SHELL_CONFIG"

echo -e "${GREEN}✅ Alias installato in $SHELL_CONFIG${NC}"
echo ""
echo -e "${YELLOW}Per attivare l'alias, esegui:${NC}"
echo -e "${BLUE}source $SHELL_CONFIG${NC}"
echo ""
echo -e "${GREEN}Poi potrai usare semplicemente:${NC}"
echo -e "${BLUE}claude${NC}"
echo ""
echo -e "${YELLOW}💡 L'alias funzionerà solo quando sei nella cartella del progetto${NC}"