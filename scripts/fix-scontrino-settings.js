const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixSettings() {
  try {
    console.log('🔧 SISTEMAZIONE FORZATA IMPOSTAZIONI SCONTRINO');
    
    // Prima disattiva tutte le impostazioni esistenti
    await prisma.impostazioniScontrino.updateMany({
      where: { attivo: true },
      data: { attivo: false }
    });
    
    // Crea o aggiorna le impostazioni corrette
    const impostazioniCorrette = {
      // INTESTAZIONE - QUELLO CHE L'UTENTE VUOLE
      nomeAttivita: "Roxy Cocktail Bar",
      indirizzo: "Via del Mare 123, Rimini",  
      telefono: "0541 123456",
      partitaIva: "IT12345678901",
      codiceFiscale: "RSSCKT90A01H294K",
      
      // LAYOUT E GRAFICA
      larghezzaCarta: 58, // 58mm standard
      allineamentoTitolo: "center",
      carattereSeparatore: "=",
      fontScontrino: "bold", // Font grande e bold per il titolo
      
      // COSA MOSTRARE
      mostraData: true,
      mostraOra: true, 
      mostraOperatore: true,
      mostraTavolo: true,
      mostraNumeroOrdine: true,
      mostraCliente: true,
      
      // MESSAGGI
      messaggioIntestazione: "*** SCONTRINO NON FISCALE ***",
      messaggioRingraziamento: "Grazie e arrivederci!",
      messaggioPromozionale: "Seguici su Instagram @roxycocktailbar",
      messaggioPiePagina: "www.roxycocktailbar.it",
      
      // DETTAGLI PRODOTTI
      mostraDettagliProdotti: true,
      mostraQuantita: true,
      mostraPrezzoUnitario: true,
      mostraTotaleRiga: true,
      
      // FORMATTAZIONE
      separatoreDecimale: ",",
      simboloValuta: "€",
      posizioneValuta: "suffix",
      
      // SOCIAL E QR
      mostraBarcode: false,
      mostraQRCode: false,
      mostraSocial: true,
      socialFacebook: "@roxybar",
      socialInstagram: "@roxycocktailbar",
      
      // FISCALE
      mostraInfoFiscali: false,
      
      // IMPOSTAZIONI STAMPA
      taglioAutomatico: true,
      numeroCopieScontrino: 1,
      ritardoTaglio: 100,
      densitaStampa: 3, // Più scuro
      
      // ATTIVA QUESTE IMPOSTAZIONI
      attivo: true
    };
    
    // Crea le nuove impostazioni
    const created = await prisma.impostazioniScontrino.create({
      data: impostazioniCorrette
    });
    
    console.log('✅ IMPOSTAZIONI SALVATE:');
    console.log('   Nome:', created.nomeAttivita);
    console.log('   Indirizzo:', created.indirizzo);
    console.log('   Telefono:', created.telefono);
    console.log('   Messaggio:', created.messaggioRingraziamento);
    console.log('   Social:', created.socialInstagram);
    console.log('');
    console.log('🎉 FATTO! Ora gli scontrini useranno QUESTE impostazioni!');
    
  } catch (error) {
    console.error('❌ ERRORE:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixSettings();