#!/bin/bash
# Script per sincronizzare SESSION_STATUS durante il lavoro

echo "🔄 Sincronizzazione SESSION_STATUS..."

# Pull per evitare conflitti
git pull

# Se ci sono conflitti in SESSION_STATUS.md
if git status | grep -q "SESSION_STATUS.md"; then
    echo "⚠️  Conflitto rilevato in SESSION_STATUS.md"
    echo "Risoluzione automatica in corso..."
    
    # Backup del file locale
    cp SESSION_STATUS.md SESSION_STATUS.md.backup
    
    # Accetta la versione remota
    git checkout --theirs SESSION_STATUS.md
    
    echo "✅ Conflitto risolto (versione remota mantenuta)"
    echo "📄 Backup salvato in SESSION_STATUS.md.backup"
fi

# Aggiorna con stato corrente
npm run session-update auto

echo "✅ Sincronizzazione completata!"