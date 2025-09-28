#!/bin/bash
# Script per chiudere una sessione di lavoro

echo "🏁 Chiusura sessione di lavoro..."

# Aggiorna automaticamente con stato git
echo "📝 Aggiornamento finale SESSION_STATUS.md..."
npm run session-update auto

# Chiedi se vuole aggiungere note finali
echo ""
read -p "Vuoi aggiungere una nota finale? (s/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Ss]$ ]]; then
    read -p "Inserisci la nota: " nota
    npm run session-update work "$nota"
fi

# Mostra file modificati
echo ""
echo "📊 File modificati in questa sessione:"
git status --short

# Chiedi se vuole committare SESSION_STATUS
echo ""
read -p "Vuoi committare SESSION_STATUS.md? (s/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Ss]$ ]]; then
    git add SESSION_STATUS.md
    git commit -m "update: session status $(date +%Y-%m-%d)"
    
    # Chiedi se vuole pushare
    read -p "Vuoi pushare le modifiche? (s/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        git push
        echo "✅ SESSION_STATUS.md aggiornato e pushato!"
    fi
fi

echo ""
echo "👋 Sessione chiusa. A presto!"