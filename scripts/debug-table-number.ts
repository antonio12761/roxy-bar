#!/usr/bin/env node
import { prisma } from '../lib/db';

async function debugTableNumbers() {
  console.log('🔍 Debug Numeri Tavolo nel Database');
  console.log('='.repeat(50));

  try {
    // 1. Verifica alcuni tavoli
    const tavoli = await prisma.tavolo.findMany({
      take: 10,
      orderBy: { numero: 'asc' }
    });

    console.log('\n📋 Primi 10 tavoli:');
    tavoli.forEach(t => {
      console.log(`ID: ${t.id}, Numero: "${t.numero}", Tipo: ${typeof t.numero}`);
    });

    // 2. Verifica ordinazioni recenti
    const ordinazioni = await prisma.ordinazione.findMany({
      where: {
        stato: { in: ['ORDINATO', 'IN_PREPARAZIONE'] }
      },
      include: {
        Tavolo: true
      },
      take: 5,
      orderBy: { dataApertura: 'desc' }
    });

    console.log('\n📦 Ordinazioni recenti:');
    ordinazioni.forEach(o => {
      console.log(`Ordine #${o.numero}:`);
      console.log(`  - ID: ${o.id}`);
      console.log(`  - Tavolo ID: ${o.tavoloId}`);
      console.log(`  - Tavolo Numero: ${o.Tavolo?.numero || 'N/A'}`);
      console.log(`  - Note: ${o.note}`);
    });

    // 3. Cerca tavoli con numeri non standard
    const tavoliSpeciali = await prisma.tavolo.findMany({
      where: {
        numero: {
          not: {
            in: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']
          }
        }
      },
      take: 10
    });

    if (tavoliSpeciali.length > 0) {
      console.log('\n🌟 Tavoli con numeri speciali:');
      tavoliSpeciali.forEach(t => {
        console.log(`ID: ${t.id}, Numero: "${t.numero}"`);
      });
    }

    // 4. Verifica se ci sono ID che potrebbero essere confusi con numeri tavolo
    console.log('\n⚠️  Verifica possibili confusioni:');
    console.log('Se vedi stringhe alfanumeriche lunghe nelle notifiche, probabilmente');
    console.log('viene usato il tavoloId (numero intero) invece del campo numero (stringa).');

  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugTableNumbers().catch(console.error);