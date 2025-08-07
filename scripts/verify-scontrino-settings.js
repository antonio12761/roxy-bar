const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifySettings() {
  try {
    console.log('🔍 VERIFICA IMPOSTAZIONI SCONTRINO\n');
    
    // Trova tutte le impostazioni
    const allSettings = await prisma.impostazioniScontrino.findMany({
      orderBy: { updatedAt: 'desc' }
    });
    
    console.log(`📊 Trovate ${allSettings.length} configurazioni nel database\n`);
    
    // Mostra quelle attive
    const activeSettings = allSettings.filter(s => s.attivo);
    console.log(`✅ Configurazioni ATTIVE: ${activeSettings.length}`);
    
    if (activeSettings.length === 0) {
      console.log('⚠️  ATTENZIONE: Nessuna configurazione attiva!');
      console.log('   Attivo la più recente...\n');
      
      if (allSettings.length > 0) {
        const latest = allSettings[0];
        await prisma.impostazioniScontrino.update({
          where: { id: latest.id },
          data: { attivo: true }
        });
        console.log(`✅ Attivata configurazione ID: ${latest.id}`);
      }
    } else if (activeSettings.length > 1) {
      console.log('⚠️  ATTENZIONE: Più di una configurazione attiva!');
      console.log('   Mantengo solo la più recente attiva...\n');
      
      // Disattiva tutte tranne la più recente
      for (let i = 1; i < activeSettings.length; i++) {
        await prisma.impostazioniScontrino.update({
          where: { id: activeSettings[i].id },
          data: { attivo: false }
        });
      }
    }
    
    // Mostra la configurazione attiva corrente
    const currentActive = await prisma.impostazioniScontrino.findFirst({
      where: { attivo: true },
      orderBy: { updatedAt: 'desc' }
    });
    
    if (currentActive) {
      console.log('\n📋 CONFIGURAZIONE ATTIVA CORRENTE:');
      console.log('================================');
      console.log(`ID: ${currentActive.id}`);
      console.log(`Nome Attività: ${currentActive.nomeAttivita}`);
      console.log(`Indirizzo: ${currentActive.indirizzo || '(non configurato)'}`);
      console.log(`Telefono: ${currentActive.telefono || '(non configurato)'}`);
      console.log(`P.IVA: ${currentActive.partitaIva || '(non configurato)'}`);
      console.log(`\nMessaggi:`);
      console.log(`- Intestazione: ${currentActive.messaggioIntestazione || '(non configurato)'}`);
      console.log(`- Ringraziamento: ${currentActive.messaggioRingraziamento}`);
      console.log(`- Promozionale: ${currentActive.messaggioPromozionale || '(non configurato)'}`);
      console.log(`- Piè pagina: ${currentActive.messaggioPiePagina || '(non configurato)'}`);
      console.log(`\nSocial:`);
      console.log(`- Mostra social: ${currentActive.mostraSocial ? 'SI' : 'NO'}`);
      console.log(`- Instagram: ${currentActive.socialInstagram || '(non configurato)'}`);
      console.log(`- Facebook: ${currentActive.socialFacebook || '(non configurato)'}`);
      console.log(`\nImpostazioni stampa:`);
      console.log(`- Larghezza carta: ${currentActive.larghezzaCarta}mm`);
      console.log(`- Separatore: "${currentActive.carattereSeparatore}"`);
      console.log(`- Taglio automatico: ${currentActive.taglioAutomatico ? 'SI' : 'NO'}`);
      console.log(`- Numero copie: ${currentActive.numeroCopieScontrino}`);
      console.log('\n================================');
      console.log('✅ Configurazione verificata e pronta!');
      console.log('\n💡 Per modificare usa: /admin/scontrino');
      console.log('   oppure: /test-admin-scontrino');
    }
    
  } catch (error) {
    console.error('❌ ERRORE:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifySettings();