#!/usr/bin/env node
import { prisma } from '../lib/db';
import { sseService } from '../lib/sse';
import { notificationManager } from '../lib/notifications/NotificationManager';

async function testNotifiche() {
  console.log('🔔 Test Sistema Notifiche PREPARA <-> CAMERIERE');
  console.log('='.repeat(50));

  try {
    // Trova un utente PREPARA e un CAMERIERE per il test
    const prepara = await prisma.user.findFirst({
      where: { ruolo: 'PREPARA' }
    });

    const cameriere = await prisma.user.findFirst({
      where: { ruolo: 'CAMERIERE' }
    });

    if (!prepara || !cameriere) {
      console.error('❌ Errore: Non trovati utenti PREPARA o CAMERIERE nel database');
      return;
    }

    const tenantId = prepara.tenantId;
    console.log(`👥 Utenti test: PREPARA=${prepara.nome}, CAMERIERE=${cameriere.nome}`);
    console.log(`🏢 Tenant: ${tenantId}`);

    // Trova un tavolo e crea un ordine di test
    const tavolo = await prisma.tavolo.findFirst({
      where: { tenantId }
    });

    if (!tavolo) {
      console.error('❌ Errore: Nessun tavolo trovato');
      return;
    }

    console.log(`\n📍 Creazione ordine di test per Tavolo ${tavolo.numero}...`);

    // Crea un ordine di test
    const ordine = await prisma.ordinazione.create({
      data: {
        numero: Date.now(),
        tipo: 'TAVOLO',
        stato: 'ORDINATO',
        totale: 10.00,
        tavoloId: tavolo.id,
        utenteId: cameriere.id,
        tenantId,
        RigaOrdinazione: {
          create: [
            {
              prodottoId: '1', // Assumiamo che esista un prodotto con ID 1
              nomeProdotto: 'Caffè',
              prezzo: 1.50,
              quantita: 2,
              totaleRiga: 3.00,
              stato: 'ORDINATO',
              destinazione: 'BANCO',
              timestampOrdine: new Date()
            },
            {
              prodottoId: '2', 
              nomeProdotto: 'Cornetto',
              prezzo: 2.00,
              quantita: 1,
              totaleRiga: 2.00,
              stato: 'ORDINATO',
              destinazione: 'PREPARA',
              timestampOrdine: new Date()
            }
          ]
        }
      },
      include: {
        RigaOrdinazione: true,
        Tavolo: true
      }
    });

    console.log(`✅ Ordine #${ordine.numero} creato con ${ordine.RigaOrdinazione.length} righe`);

    // Test 1: Notifica nuovo ordine per PREPARA
    console.log('\n📢 TEST 1: Invio notifica nuovo ordine a PREPARA...');
    
    notificationManager.notifyNewOrder({
      orderId: ordine.id,
      orderNumber: ordine.numero,
      tableNumber: tavolo.numero,
      items: ordine.RigaOrdinazione.map(r => ({
        id: r.id,
        name: r.nomeProdotto,
        quantity: r.quantita,
        destination: r.destinazione as 'BANCO' | 'PREPARA' | 'CUCINA'
      }))
    });

    sseService.emit('order:new', {
      orderId: ordine.id,
      orderNumber: ordine.numero,
      tableNumber: tavolo.numero,
      items: ordine.RigaOrdinazione.map(r => ({
        id: r.id,
        name: r.nomeProdotto,
        quantity: r.quantita,
        destination: r.destinazione
      })),
      timestamp: new Date().toISOString()
    }, { tenantId, broadcast: true });

    console.log('✅ Notifica nuovo ordine inviata');

    // Attendi 2 secondi
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2: PREPARA inizia la lavorazione
    console.log('\n📢 TEST 2: PREPARA inizia lavorazione (IN_LAVORAZIONE)...');
    
    const rigaInLavorazione = ordine.RigaOrdinazione[0];
    
    notificationManager.notifyItemStatusChange({
      orderId: ordine.id,
      orderNumber: ordine.numero,
      itemId: rigaInLavorazione.id,
      itemName: rigaInLavorazione.nomeProdotto,
      newStatus: 'IN_LAVORAZIONE',
      tableNumber: tavolo.numero
    });

    sseService.emit('order:item:update', {
      orderId: ordine.id,
      orderNumber: ordine.numero,
      itemId: rigaInLavorazione.id,
      status: 'IN_LAVORAZIONE',
      tableNumber: tavolo.numero,
      timestamp: new Date().toISOString()
    }, { tenantId, broadcast: true });

    console.log('✅ Notifica IN_LAVORAZIONE inviata a CAMERIERE');

    // Attendi 2 secondi
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 3: PREPARA completa l'ordine (PRONTO)
    console.log('\n📢 TEST 3: PREPARA completa ordine (PRONTO)...');
    
    notificationManager.notifyOrderReady({
      orderId: ordine.id,
      orderNumber: ordine.numero,
      tableNumber: tavolo.numero,
      orderType: 'TAVOLO'
    });

    sseService.emit('order:ready', {
      orderId: ordine.id,
      orderNumber: ordine.numero,
      tableNumber: tavolo.numero,
      readyItems: ordine.RigaOrdinazione.map(r => r.nomeProdotto),
      timestamp: new Date().toISOString()
    }, { tenantId, broadcast: true });

    console.log('✅ Notifica PRONTO inviata a CAMERIERE (alta priorità + suono)');

    // Attendi 2 secondi
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 4: CAMERIERE ritira l'ordine (CONSEGNATO)
    console.log('\n📢 TEST 4: CAMERIERE ritira ordine (CONSEGNATO)...');
    
    notificationManager.notifyOrderDelivered({
      orderId: ordine.id,
      orderNumber: ordine.numero,
      tableNumber: tavolo.numero,
      orderType: 'TAVOLO',
      amount: parseFloat(ordine.totale.toString())
    });

    sseService.emit('order:delivered', {
      orderId: ordine.id,
      orderNumber: ordine.numero,
      tableNumber: tavolo.numero,
      deliveredBy: cameriere.nome,
      timestamp: new Date().toISOString()
    }, { tenantId, broadcast: true });

    console.log('✅ Notifica CONSEGNATO inviata (bassa priorità)');

    // Test 5: Prodotto esaurito
    console.log('\n📢 TEST 5: Notifica prodotto esaurito...');
    
    const prodottoEsaurito = {
      id: '3',
      nome: 'Brioche alla crema',
      disponibile: false
    };

    notificationManager.notifyProductAvailability(
      prodottoEsaurito.id,
      prodottoEsaurito.nome,
      false
    );

    sseService.emit('product:availability', {
      productId: prodottoEsaurito.id,
      productName: prodottoEsaurito.nome,
      available: false,
      timestamp: new Date().toISOString()
    }, { tenantId, broadcast: true });

    console.log('✅ Notifica prodotto esaurito inviata a tutti');

    // Pulisci l'ordine di test
    console.log('\n🧹 Pulizia ordine di test...');
    await prisma.rigaOrdinazione.deleteMany({
      where: { ordinazioneId: ordine.id }
    });
    await prisma.ordinazione.delete({
      where: { id: ordine.id }
    });

    console.log('\n✅ Test completato con successo!');
    console.log('\n📋 Riepilogo notifiche inviate:');
    console.log('1. 🆕 Nuovo ordine → PREPARA (con toast + suono)');
    console.log('2. 🔄 In lavorazione → CAMERIERE');
    console.log('3. ✨ Ordine pronto → CAMERIERE (alta priorità + suono)');
    console.log('4. ✓ Ordine consegnato → Log per tutti');
    console.log('5. ⚠️ Prodotto esaurito → TUTTI (urgente + suono)');

  } catch (error) {
    console.error('❌ Errore durante il test:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

// Esegui il test
testNotifiche().catch(console.error);