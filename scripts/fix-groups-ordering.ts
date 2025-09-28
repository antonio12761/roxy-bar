import { prisma } from "@/lib/db";
import { sseService } from "@/lib/sse/sse-service";

async function fixGroupsOrdering() {
  try {
    console.log("\n=== CORREZIONE ORDINAMENTO GRUPPI TAVOLI ===\n");
    
    // Definisci l'ordine desiderato
    const ordineDesiderato = [
      { nome: "Tavoli dentro", ordinamento: 1 },
      { nome: "Marciapiede", ordinamento: 2 },
      { nome: "Gazebo", ordinamento: 3 },
      { nome: "Piazza", ordinamento: 4 }
    ];
    
    // Recupera tutti i gruppi
    const gruppi = await prisma.gruppoTavoli.findMany({
      where: { attivo: true }
    });
    
    console.log("Gruppi trovati:", gruppi.map(g => g.nome).join(", "));
    console.log("\nAggiornamento ordinamento...\n");
    
    // Aggiorna l'ordinamento
    for (const { nome, ordinamento } of ordineDesiderato) {
      const gruppo = gruppi.find(g => g.nome.toLowerCase() === nome.toLowerCase());
      
      if (gruppo) {
        await prisma.gruppoTavoli.update({
          where: { id: gruppo.id },
          data: { ordinamento }
        });
        
        console.log(`✅ ${gruppo.nome}: ordinamento = ${ordinamento}`);
      } else {
        console.log(`⚠️  Gruppo "${nome}" non trovato`);
      }
    }
    
    // Verifica il risultato
    console.log("\n=== VERIFICA RISULTATO ===\n");
    const gruppiAggiornati = await prisma.gruppoTavoli.findMany({
      where: { attivo: true },
      orderBy: { ordinamento: 'asc' },
      select: { nome: true, ordinamento: true }
    });
    
    console.log("Nuovo ordine:");
    gruppiAggiornati.forEach((gruppo, index) => {
      console.log(`${index + 1}. ${gruppo.nome} (ordinamento: ${gruppo.ordinamento})`);
    });
    
    // Invia evento SSE per notificare il cambio
    console.log("\n📢 Invio evento SSE per aggiornare le interfacce...");
    
    // Ottieni il primo utente admin per simulare l'aggiornamento
    const adminUser = await prisma.user.findFirst({
      where: { ruolo: "SUPERVISORE" }
    });
    
    if (adminUser) {
      sseService.emit('groups:reordered', {
        groups: gruppiAggiornati,
        updatedBy: 'Sistema',
        timestamp: new Date().toISOString()
      }, {
        tenantId: adminUser.tenantId
      });
      
      console.log("✅ Evento SSE inviato!");
    }
    
    console.log("\n✨ Ordinamento corretto! Ricarica le pagine per vedere le modifiche.");
    console.log("\nNOTA: Se l'ordine non si aggiorna nell'interfaccia cameriere:");
    console.log("1. Fai un hard refresh (Ctrl+F5 o Cmd+Shift+R)");
    console.log("2. Oppure clicca sul pulsante di aggiornamento nella pagina");
    
  } catch (error) {
    console.error("Errore:", error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

fixGroupsOrdering();