const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function monitorSessions() {
  try {
    console.log('🔍 MONITOR SESSIONI (Ctrl+C per fermare)');
    console.log('=========================================');
    
    setInterval(async () => {
      const sessions = await prisma.session.findMany({
        include: {
          user: {
            select: { nome: true, ruolo: true }
          }
        }
      });
      
      const now = new Date();
      console.log(`\n[${now.toLocaleTimeString()}] Sessioni attive: ${sessions.length}`);
      
      sessions.forEach((session, i) => {
        const isExpired = session.expires < now;
        console.log(`  ${i+1}. ${session.user.nome} (${session.user.ruolo}) - ${isExpired ? '❌ SCADUTA' : '✅ VALIDA'}`);
        console.log(`     Token: ${session.token.substring(0, 25)}...`);
      });
      
      if (sessions.length === 0) {
        console.log('  📭 Nessuna sessione attiva');
      }
    }, 5000); // Check ogni 5 secondi
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
  }
}

monitorSessions();