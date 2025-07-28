// Importa le funzioni di migrazione
import { migraCategorieEsistenti } from '../lib/actions/categorie-v2.js';

async function main() {
  console.log('🚀 Avvio migrazione categorie esistenti...');
  
  try {
    const result = await migraCategorieEsistenti();
    
    if (result.success) {
      console.log('✅ Migrazione completata:', result.message);
    } else {
      console.error('❌ Errore migrazione:', result.error);
    }
  } catch (error) {
    console.error('❌ Errore durante la migrazione:', error);
  }
}

main().catch(console.error);