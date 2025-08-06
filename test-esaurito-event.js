// Test script to verify esaurito event flow
const { sseService } = require('./lib/sse/sse-service');

// Get first user with CAMERIERE role
async function testEsauritoEvent() {
  const { prisma } = require('./lib/db');
  
  try {
    // Find a CAMERIERE user
    const user = await prisma.user.findFirst({
      where: { 
        ruolo: 'CAMERIERE',
        attivo: true
      }
    });
    
    if (!user) {
      console.log('No active CAMERIERE user found');
      return;
    }
    
    console.log(`Testing with user: ${user.nome} (${user.id}), tenant: ${user.tenantId}`);
    
    // Find a recent order
    const order = await prisma.ordinazione.findFirst({
      where: {
        tenantId: user.tenantId,
        stato: { notIn: ['ANNULLATO', 'PAGATO'] }
      },
      include: {
        Tavolo: true,
        RigaOrdinazione: {
          include: {
            Prodotto: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    if (!order) {
      console.log('No active orders found');
      return;
    }
    
    console.log(`\nUsing order #${order.numero} with ${order.RigaOrdinazione.length} items`);
    console.log(`Table: ${order.Tavolo?.numero || 'N/A'}`);
    
    // Emit test event
    console.log('\n=== EMITTING order:esaurito:alert EVENT ===');
    
    const eventData = {
      orderId: order.id,
      orderNumber: order.numero,
      tableNumber: order.Tavolo?.numero || 0,
      outOfStockItems: order.RigaOrdinazione.slice(0, 1).map(item => ({
        id: item.id,
        productName: item.Prodotto?.nome || 'Test Product',
        quantity: item.quantita
      })),
      timestamp: new Date().toISOString()
    };
    
    console.log('Event data:', JSON.stringify(eventData, null, 2));
    
    // Emit with targetStations for CAMERIERE and PREPARA
    sseService.emit('order:esaurito:alert', eventData, {
      broadcast: true,
      skipRateLimit: true,
      tenantId: user.tenantId,
      targetStations: ['CAMERIERE', 'PREPARA']
    });
    
    console.log('\n✅ Event emitted successfully');
    console.log('Check the browser console for received events');
    
    // Keep process alive for a moment
    setTimeout(() => {
      console.log('\nTest complete');
      process.exit(0);
    }, 2000);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the test
testEsauritoEvent();