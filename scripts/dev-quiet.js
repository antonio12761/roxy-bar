#!/usr/bin/env node

const { spawn } = require('child_process');
const readline = require('readline');

// Avvia next dev
const nextProcess = spawn('npx', ['next', 'dev'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true,
  env: { ...process.env }
});

// Filtra l'output
const filterOutput = (stream, isError = false) => {
  const rl = readline.createInterface({
    input: stream,
    crlfDelay: Infinity
  });

  rl.on('line', (line) => {
    // Filtra le linee con /api/sse
    if (!line.includes('/api/sse') && 
        !line.includes('GET /api/sse') &&
        !line.includes('POST /api/sse')) {
      if (isError) {
        console.error(line);
      } else {
        console.log(line);
      }
    }
  });
};

// Applica il filtro a stdout e stderr
filterOutput(nextProcess.stdout, false);
filterOutput(nextProcess.stderr, true);

// Gestisci l'uscita del processo
nextProcess.on('close', (code) => {
  process.exit(code || 0);
});

// Gestisci CTRL+C
process.on('SIGINT', () => {
  nextProcess.kill('SIGINT');
  process.exit(0);
});

// Gestisci errori
nextProcess.on('error', (err) => {
  console.error('Errore avvio Next.js:', err);
  process.exit(1);
});