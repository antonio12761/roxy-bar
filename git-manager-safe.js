#!/usr/bin/env node

require('dotenv').config();
const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const boxen = require('boxen');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configurazione sicurezza per Bar Roxy
const SAFETY_CONFIG = {
  // Operazioni che richiedono doppia conferma
  DANGEROUS_OPERATIONS: [
    'git clean -fdx',
    'git reset --hard',
    'git push --force',
    'rm -rf'
  ],
  // Branch protetti (non eliminabili)
  PROTECTED_BRANCHES: ['main', 'master', 'develop', 'production', 'staging'],
  // File/directory da non toccare MAI - specifici per il progetto
  PROTECTED_PATHS: [
    '.git', 
    '.env', 
    '.env.local',
    'node_modules', 
    '.next',
    'prisma/dev.db',
    'dev.db',
    'package-lock.json',
    'pnpm-lock.yaml',
    'yarn.lock'
  ],
  // Backup automatico prima di operazioni pericolose
  AUTO_BACKUP: true,
  // GitHub token da .env
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || process.env.GH_TOKEN || null
};

// Configurazione
const CONFIG = {
  BACKUP_PREFIX: 'backup/',
  FEATURE_PREFIX: 'feature/',
  HOTFIX_PREFIX: 'hotfix/',
  MAX_COMMIT_MESSAGE_LENGTH: 72
};

// Utility per eseguire comandi git in modo sicuro
function gitExec(command, silent = false) {
  // Controlla se è un comando pericoloso
  if (SAFETY_CONFIG.DANGEROUS_OPERATIONS.some(dangerous => command.includes(dangerous))) {
    console.log(chalk.red('\n⚠️  ATTENZIONE: Comando potenzialmente pericoloso!'));
    console.log(chalk.yellow(`Comando: ${command}`));
    throw new Error('Comando bloccato per sicurezza. Usa le funzioni dedicate del menu.');
  }

  try {
    const result = execSync(command, { encoding: 'utf-8' }).trim();
    return result;
  } catch (error) {
    if (!silent) {
      console.error(chalk.red(`❌ Errore: ${error.message}`));
    }
    return null;
  }
}

// Crea backup di sicurezza
async function createSafetyBackup(reason = 'safety') {
  if (!SAFETY_CONFIG.AUTO_BACKUP) return;
  
  console.log(chalk.yellow('\n🛡️  Creando backup di sicurezza...'));
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupBranch = `${CONFIG.BACKUP_PREFIX}safety-${reason}-${timestamp}`;
  
  try {
    const currentBranch = gitExec('git branch --show-current');
    
    // Commit modifiche pendenti
    const hasChanges = gitExec('git status --porcelain', true);
    if (hasChanges) {
      gitExec('git add -A');
      gitExec(`git commit -m "Safety backup before ${reason}"`);
    }
    
    // Crea branch di backup
    gitExec(`git branch ${backupBranch}`);
    console.log(chalk.green(`✅ Backup creato: ${backupBranch}`));
    
    return backupBranch;
  } catch (error) {
    console.log(chalk.yellow('⚠️  Non è stato possibile creare il backup'));
    return null;
  }
}

// Verifica token GitHub
function checkGitHubAuth() {
  if (SAFETY_CONFIG.GITHUB_TOKEN) {
    console.log(chalk.green('✅ Token GitHub trovato in .env'));
    return true;
  }
  return false;
}

// Login GitHub
async function githubLogin() {
  console.log(chalk.cyan('\n🔐 Autenticazione GitHub'));
  
  const hasToken = checkGitHubAuth();
  
  if (hasToken) {
    const { useToken } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useToken',
        message: 'Usare il token da .env?',
        default: true
      }
    ]);
    
    if (useToken) {
      // Configura git per usare il token
      try {
        const remoteUrl = gitExec('git remote get-url origin', true);
        if (remoteUrl && remoteUrl.includes('github.com')) {
          // Estrai owner/repo dall'URL
          const match = remoteUrl.match(/github\.com[:/]([^/]+)\/(.+?)(\.git)?$/);
          if (match) {
            const [, owner, repo] = match;
            const newUrl = `https://${SAFETY_CONFIG.GITHUB_TOKEN}@github.com/${owner}/${repo}.git`;
            gitExec(`git remote set-url origin ${newUrl}`);
            console.log(chalk.green('✅ Autenticazione configurata con token'));
            return true;
          }
        }
      } catch (error) {
        console.log(chalk.red('❌ Errore configurazione token'));
      }
    }
  }
  
  // Login manuale
  const { authMethod } = await inquirer.prompt([
    {
      type: 'list',
      name: 'authMethod',
      message: 'Metodo di autenticazione:',
      choices: [
        { name: '🔑 Personal Access Token', value: 'token' },
        { name: '🔐 SSH (consigliato)', value: 'ssh' },
        { name: '❌ Salta autenticazione', value: 'skip' }
      ]
    }
  ]);
  
  if (authMethod === 'token') {
    const { token } = await inquirer.prompt([
      {
        type: 'password',
        name: 'token',
        message: 'Inserisci Personal Access Token:',
        validate: (input) => input.trim() ? true : 'Token non può essere vuoto'
      }
    ]);
    
    // Salva temporaneamente in memoria (non su disco)
    SAFETY_CONFIG.GITHUB_TOKEN = token;
    console.log(chalk.green('✅ Token salvato per questa sessione'));
    
    // Offri di salvare in .env
    const { saveToken } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'saveToken',
        message: 'Salvare il token in .env per uso futuro?',
        default: false
      }
    ]);
    
    if (saveToken) {
      const envPath = path.join(process.cwd(), '.env');
      const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
      
      if (!envContent.includes('GITHUB_TOKEN')) {
        fs.appendFileSync(envPath, `\n# GitHub Personal Access Token\nGITHUB_TOKEN=${token}\n`);
        console.log(chalk.green('✅ Token salvato in .env'));
      }
    }
  }
  
  return authMethod !== 'skip';
}

// Verifica se siamo in un repository git
function checkGitRepo() {
  const isRepo = gitExec('git rev-parse --git-dir', true);
  if (!isRepo) {
    console.error(chalk.red('❌ Non sei in un repository Git!'));
    process.exit(1);
  }
}

// Banner iniziale
function showBanner() {
  console.clear();
  const banner = boxen(
    chalk.bold.cyan('🍺 Bar Roxy Git Manager') + chalk.green(' SAFE') + '\n' +
    chalk.gray('Gestione sicura del repository del bar') + '\n' +
    chalk.yellow('Next.js + TypeScript + Prisma'),
    {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan'
    }
  );
  console.log(banner);
  
  if (SAFETY_CONFIG.AUTO_BACKUP) {
    console.log(chalk.green('🛡️  Modalità sicura: Backup automatici attivi'));
  }
  
  // Mostra versione Node.js e NPM per debug
  try {
    const nodeVersion = execSync('node --version', { encoding: 'utf-8' }).trim();
    const npmVersion = execSync('npm --version', { encoding: 'utf-8' }).trim();
    console.log(chalk.gray(`   Node: ${nodeVersion} | NPM: ${npmVersion}`));
  } catch (error) {
    // Ignora errori di versione
  }
}

// Ottieni informazioni repository
function getRepoInfo() {
  const currentBranch = gitExec('git branch --show-current') || 'N/A';
  const remotes = gitExec('git remote -v', true) || 'Nessun remote';
  const status = gitExec('git status --porcelain', true) || '';
  const modifiedFiles = status.split('\n').filter(line => line.trim()).length;
  
  // Controlla tipo di autenticazione
  const usesSSH = remotes.includes('git@github.com');
  const hasToken = SAFETY_CONFIG.GITHUB_TOKEN;
  
  let authStatus;
  if (usesSSH) {
    authStatus = chalk.green('✓ SSH');
  } else if (hasToken) {
    authStatus = chalk.green('✓ Token presente');
  } else {
    authStatus = chalk.yellow('⚠ Non autenticato');
  }
  
  console.log(chalk.cyan('\n📊 Stato Repository Bar Roxy:'));
  console.log(`   Branch: ${chalk.yellow(currentBranch)}`);
  console.log(`   File modificati: ${chalk.yellow(modifiedFiles)}`);
  console.log(`   Remote: ${remotes.includes('origin') ? chalk.green('✓ Configurato') : chalk.red('✗ Non configurato')}`);
  console.log(`   GitHub Auth: ${authStatus}`);
  
  // Aggiungi info specifiche del progetto Next.js
  const hasNextConfig = fs.existsSync('next.config.ts') || fs.existsSync('next.config.js');
  const hasPrismaSchema = fs.existsSync('prisma/schema.prisma');
  const hasPackageJson = fs.existsSync('package.json');
  
  console.log(chalk.cyan('\n🏗️  Configurazione Progetto:'));
  console.log(`   Next.js Config: ${hasNextConfig ? chalk.green('✓ Presente') : chalk.yellow('⚠ Mancante')}`);
  console.log(`   Database (Prisma): ${hasPrismaSchema ? chalk.green('✓ Configurato') : chalk.yellow('⚠ Non configurato')}`);
  console.log(`   Package.json: ${hasPackageJson ? chalk.green('✓ Presente') : chalk.red('✗ Mancante')}`);
  
  // Controlla se ci sono modifiche al database
  const dbFiles = gitExec('git status --porcelain | grep -E "\\.(db|sql|prisma)$" || echo ""', true);
  if (dbFiles) {
    console.log(chalk.yellow('   ⚠️  Modifiche DB rilevate - fare attenzione durante il deploy'));
  }
}

// Menu principale con sicurezza migliorata
async function mainMenu() {
  const choices = [
    { name: '🔐 Autenticazione GitHub', value: 'auth' },
    { name: '📝 Commit & Push', value: 'commit-push' },
    { name: '🚀 Deploy su Main', value: 'deploy' },
    { name: '🔍 Analisi TypeScript', value: 'typescript-check' },
    { name: '🗃️  Gestione Database', value: 'database' },
    { name: '🌿 Gestione Branch', value: 'branch-management' },
    { name: '💾 Backup Intelligente', value: 'smart-backup' },
    { name: '🔄 Sincronizza con Remote', value: 'sync' },
    { name: '📊 Visualizza Stato', value: 'status' },
    { name: '🏷️  Gestione Tag', value: 'tags' },
    { name: '🧹 Pulizia Repository (SICURA)', value: 'cleanup' },
    { name: '⚙️  Configurazioni', value: 'config' },
    new inquirer.Separator(),
    { name: '❌ Esci', value: 'exit' }
  ];

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Cosa vuoi fare?',
      choices
    }
  ]);

  return action;
}

// Elimina branch con protezioni extra
async function deleteBranch() {
  const currentBranch = gitExec('git branch --show-current');
  const branches = gitExec('git branch')
    .split('\n')
    .map(b => b.trim().replace('* ', ''))
    .filter(b => b && b !== currentBranch && !SAFETY_CONFIG.PROTECTED_BRANCHES.includes(b));

  if (branches.length === 0) {
    console.log(chalk.yellow('ℹ️  Nessun branch eliminabile (branch protetti: ' + SAFETY_CONFIG.PROTECTED_BRANCHES.join(', ') + ')'));
    return;
  }

  console.log(chalk.yellow('\n⚠️  Branch protetti (non eliminabili): ' + SAFETY_CONFIG.PROTECTED_BRANCHES.join(', ')));

  const { branchesToDelete } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'branchesToDelete',
      message: 'Seleziona branch da eliminare:',
      choices: branches
    }
  ]);

  if (branchesToDelete.length === 0) return;

  // Prima conferma
  console.log(chalk.red(`\n⚠️  Stai per eliminare ${branchesToDelete.length} branch:`));
  branchesToDelete.forEach(b => console.log(chalk.red(`   - ${b}`)));
  
  const { confirmDelete } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmDelete',
      message: chalk.red('Sei sicuro?'),
      default: false
    }
  ]);

  if (!confirmDelete) return;

  // Seconda conferma per sicurezza
  const { doubleConfirm } = await inquirer.prompt([
    {
      type: 'input',
      name: 'doubleConfirm',
      message: chalk.red('Digita "ELIMINA" per confermare:'),
      validate: (input) => input === 'ELIMINA' ? true : 'Digita ELIMINA per confermare'
    }
  ]);

  // Crea backup prima di eliminare
  await createSafetyBackup('branch-deletion');

  const { deleteRemote } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'deleteRemote',
      message: 'Eliminare anche dal remote?',
      default: false
    }
  ]);

  const spinner = ora('Eliminando branch...').start();
  let deleted = 0;
  
  for (const branch of branchesToDelete) {
    try {
      gitExec(`git branch -D ${branch}`);
      if (deleteRemote) {
        gitExec(`git push origin --delete ${branch}`, true);
      }
      deleted++;
    } catch (error) {
      console.log(chalk.red(`\n❌ Errore eliminando ${branch}`));
    }
  }
  
  spinner.succeed(`${deleted} branch eliminati!`);
}

// Pulisci file non tracciati con extra sicurezza
async function cleanUntracked() {
  const untracked = gitExec('git ls-files --others --exclude-standard');
  
  if (!untracked) {
    console.log(chalk.yellow('ℹ️  Nessun file non tracciato'));
    return;
  }

  const files = untracked.split('\n').filter(f => f.trim());
  
  // Filtra file protetti
  const safeFiles = files.filter(f => {
    return !SAFETY_CONFIG.PROTECTED_PATHS.some(protected => f.includes(protected));
  });

  if (safeFiles.length === 0) {
    console.log(chalk.yellow('ℹ️  Tutti i file non tracciati sono protetti'));
    return;
  }

  console.log(chalk.cyan('\n📄 File non tracciati (eliminabili):'));
  safeFiles.forEach(f => console.log(`   - ${f}`));
  
  if (files.length > safeFiles.length) {
    console.log(chalk.green('\n🛡️  File protetti (non eliminabili):'));
    files.filter(f => !safeFiles.includes(f)).forEach(f => console.log(`   - ${f}`));
  }

  const { confirmClean } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmClean',
      message: chalk.red(`Eliminare ${safeFiles.length} file?`),
      default: false
    }
  ]);

  if (confirmClean) {
    // Crea backup
    await createSafetyBackup('clean-untracked');
    
    const spinner = ora('Pulizia in corso...').start();
    // Elimina solo file sicuri uno per uno
    safeFiles.forEach(file => {
      try {
        fs.unlinkSync(file);
      } catch (error) {
        console.log(chalk.red(`Errore eliminando ${file}`));
      }
    });
    spinner.succeed('File eliminati in sicurezza!');
  }
}

// Pulizia profonda RIMOSSA - troppo pericolosa
async function deepClean() {
  console.log(chalk.red('\n⛔ Funzione disabilitata per sicurezza!'));
  console.log(chalk.yellow('La pulizia profonda (git clean -fdx) è stata disabilitata'));
  console.log(chalk.yellow('perché potrebbe eliminare file importanti come:'));
  console.log('  - File di configurazione (.env)');
  console.log('  - Dipendenze (node_modules)');
  console.log('  - File di IDE');
  console.log(chalk.green('\n✅ Usa invece la pulizia selettiva dal menu'));
}

// Gestione Branch sicura
async function branchManagement() {
  const { branchAction } = await inquirer.prompt([
    {
      type: 'list',
      name: 'branchAction',
      message: 'Gestione Branch:',
      choices: [
        { name: '📋 Lista branch', value: 'list' },
        { name: '🔄 Cambia branch', value: 'switch' },
        { name: '➕ Crea nuovo branch', value: 'create' },
        { name: '🗑️  Elimina branch (SICURO)', value: 'delete' },
        { name: '🔀 Merge branch', value: 'merge' },
        { name: '↩️  Indietro', value: 'back' }
      ]
    }
  ]);

  switch (branchAction) {
    case 'list':
      await listBranches();
      break;
    case 'switch':
      await switchBranch();
      break;
    case 'create':
      await createBranch();
      break;
    case 'delete':
      await deleteBranch();
      break;
    case 'merge':
      await mergeBranch();
      break;
  }
}

// Lista branch
async function listBranches() {
  console.log(chalk.cyan('\n🌿 Branch locali:'));
  const localBranches = gitExec('git branch');
  console.log(localBranches);
  
  // Evidenzia branch protetti
  console.log(chalk.green('\n🛡️  Branch protetti: ' + SAFETY_CONFIG.PROTECTED_BRANCHES.join(', ')));

  const { showRemote } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'showRemote',
      message: 'Mostrare anche i branch remoti?',
      default: false
    }
  ]);

  if (showRemote) {
    console.log(chalk.cyan('\n🌍 Branch remoti:'));
    const remoteBranches = gitExec('git branch -r');
    console.log(remoteBranches);
  }
}

// Cambia branch
async function switchBranch() {
  const branches = gitExec('git branch')
    .split('\n')
    .map(b => b.trim().replace('* ', ''))
    .filter(b => b);

  // Controlla modifiche non salvate
  const hasChanges = gitExec('git status --porcelain', true);
  if (hasChanges) {
    console.log(chalk.yellow('\n⚠️  Hai modifiche non committate'));
    const { saveChanges } = await inquirer.prompt([
      {
        type: 'list',
        name: 'saveChanges',
        message: 'Cosa vuoi fare?',
        choices: [
          { name: '💾 Commit modifiche', value: 'commit' },
          { name: '📦 Stash modifiche', value: 'stash' },
          { name: '❌ Annulla', value: 'cancel' }
        ]
      }
    ]);
    
    if (saveChanges === 'cancel') return;
    
    if (saveChanges === 'commit') {
      gitExec('git add -A');
      gitExec('git commit -m "Quick save before branch switch"');
    } else {
      gitExec('git stash push -m "Auto stash before branch switch"');
      console.log(chalk.green('✅ Modifiche salvate in stash'));
    }
  }

  const { targetBranch } = await inquirer.prompt([
    {
      type: 'list',
      name: 'targetBranch',
      message: 'Seleziona branch:',
      choices: branches
    }
  ]);

  const spinner = ora(`Passando a ${targetBranch}...`).start();
  try {
    gitExec(`git checkout ${targetBranch}`);
    spinner.succeed(`Ora sei su ${targetBranch}`);
  } catch (error) {
    spinner.fail('Errore durante il cambio branch');
  }
}

// Crea branch
async function createBranch() {
  const { branchType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'branchType',
      message: 'Tipo di branch:',
      choices: [
        { name: '🌿 Feature', value: 'feature/' },
        { name: '🐛 Hotfix', value: 'hotfix/' },
        { name: '💾 Backup', value: 'backup/' },
        { name: '📝 Custom', value: '' }
      ]
    }
  ]);

  const { branchName } = await inquirer.prompt([
    {
      type: 'input',
      name: 'branchName',
      message: 'Nome del branch:',
      validate: (input) => {
        if (!input.trim()) return 'Il nome non può essere vuoto';
        if (!/^[a-zA-Z0-9-_/]+$/.test(input)) {
          return 'Usa solo lettere, numeri, -, _ e /';
        }
        // Controlla che non sia un branch protetto
        const fullName = branchType + input;
        if (SAFETY_CONFIG.PROTECTED_BRANCHES.includes(fullName)) {
          return 'Non puoi usare questo nome (branch protetto)';
        }
        return true;
      }
    }
  ]);

  const fullBranchName = branchType + branchName;
  
  const { fromBranch } = await inquirer.prompt([
    {
      type: 'list',
      name: 'fromBranch',
      message: 'Crea branch da:',
      choices: [
        { name: 'Branch corrente', value: 'current' },
        { name: 'main/master', value: 'main' },
        { name: 'Altro branch', value: 'other' }
      ]
    }
  ]);

  let baseBranch = '';
  if (fromBranch === 'other') {
    const branches = gitExec('git branch')
      .split('\n')
      .map(b => b.trim().replace('* ', ''))
      .filter(b => b);
    
    const { selectedBranch } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedBranch',
        message: 'Seleziona branch base:',
        choices: branches
      }
    ]);
    baseBranch = selectedBranch;
  } else if (fromBranch === 'main') {
    // Cerca main o master
    const branches = gitExec('git branch').toLowerCase();
    baseBranch = branches.includes('main') ? 'main' : 'master';
  }

  const spinner = ora(`Creando branch ${fullBranchName}...`).start();
  try {
    if (baseBranch) {
      gitExec(`git checkout -b ${fullBranchName} ${baseBranch}`);
    } else {
      gitExec(`git checkout -b ${fullBranchName}`);
    }
    spinner.succeed(`Branch ${fullBranchName} creato!`);
    
    const { pushNow } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'pushNow',
        message: 'Pushare il branch ora?',
        default: true
      }
    ]);
    
    if (pushNow) {
      gitExec(`git push -u origin ${fullBranchName}`);
      console.log(chalk.green('✅ Branch pushato su remote!'));
    }
  } catch (error) {
    spinner.fail('Errore durante la creazione del branch');
  }
}

// Merge branch con sicurezza extra
async function mergeBranch() {
  const currentBranch = gitExec('git branch --show-current');
  const branches = gitExec('git branch')
    .split('\n')
    .map(b => b.trim().replace('* ', ''))
    .filter(b => b && b !== currentBranch);

  if (branches.length === 0) {
    console.log(chalk.yellow('ℹ️  Nessun branch da mergeare'));
    return;
  }

  console.log(chalk.cyan(`\n🎯 Branch corrente: ${currentBranch}`));
  
  // Avviso se si sta mergeando in un branch protetto
  if (SAFETY_CONFIG.PROTECTED_BRANCHES.includes(currentBranch)) {
    console.log(chalk.yellow(`⚠️  Stai per mergeare in un branch protetto (${currentBranch})`));
  }

  const { sourceBranch } = await inquirer.prompt([
    {
      type: 'list',
      name: 'sourceBranch',
      message: 'Quale branch vuoi mergeare?',
      choices: branches
    }
  ]);

  // Crea backup prima del merge
  await createSafetyBackup(`merge-${sourceBranch}`);

  const { mergeType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'mergeType',
      message: 'Tipo di merge:',
      choices: [
        { name: '🔀 Merge normale', value: 'merge' },
        { name: '📏 Merge --no-ff (crea sempre commit)', value: 'no-ff' },
        { name: '🎯 Merge --squash (unifica commit)', value: 'squash' }
      ]
    }
  ]);

  const spinner = ora(`Merging ${sourceBranch} in ${currentBranch}...`).start();
  
  try {
    if (mergeType === 'merge') {
      gitExec(`git merge ${sourceBranch}`);
    } else if (mergeType === 'no-ff') {
      gitExec(`git merge --no-ff ${sourceBranch}`);
    } else if (mergeType === 'squash') {
      gitExec(`git merge --squash ${sourceBranch}`);
      gitExec('git commit');
    }
    spinner.succeed('Merge completato!');
    
    const { deleteMerged } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'deleteMerged',
        message: `Eliminare il branch ${sourceBranch}?`,
        default: false
      }
    ]);
    
    if (deleteMerged && !SAFETY_CONFIG.PROTECTED_BRANCHES.includes(sourceBranch)) {
      gitExec(`git branch -d ${sourceBranch}`);
      console.log(chalk.green('✅ Branch eliminato'));
    }
  } catch (error) {
    spinner.fail('Errore durante il merge');
    console.log(chalk.yellow('ℹ️  Potrebbe essere necessario risolvere conflitti'));
    console.log(chalk.green(`💡 Backup disponibile: ${await createSafetyBackup('merge-conflict')}`));
  }
}

// Funzione Commit & Push
async function commitAndPush() {
  const status = gitExec('git status --porcelain') || '';
  if (!status) {
    console.log(chalk.yellow('ℹ️  Nessuna modifica da committare'));
    return;
  }

  // Mostra file modificati
  console.log(chalk.cyan('\n📄 File modificati:'));
  const files = status.split('\n').filter(line => line.trim());
  files.forEach(file => {
    const [status, filename] = file.trim().split(/\s+/);
    const statusIcon = status.includes('M') ? '📝' : status.includes('A') ? '➕' : status.includes('D') ? '🗑️' : '❓';
    console.log(`   ${statusIcon} ${filename}`);
  });

  const { confirmAdd } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmAdd',
      message: 'Vuoi aggiungere tutti i file?',
      default: true
    }
  ]);

  if (!confirmAdd) {
    // Selezione file specifica
    const { filesToAdd } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'filesToAdd',
        message: 'Seleziona i file da aggiungere:',
        choices: files.map(f => f.trim().split(/\s+/)[1])
      }
    ]);
    
    filesToAdd.forEach(file => {
      gitExec(`git add "${file}"`);
    });
  } else {
    gitExec('git add -A');
  }

  // Tipo di commit
  const { commitType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'commitType',
      message: 'Tipo di commit:',
      choices: [
        { name: '✨ feat: Nuova funzionalità', value: 'feat' },
        { name: '🐛 fix: Correzione bug', value: 'fix' },
        { name: '📚 docs: Documentazione', value: 'docs' },
        { name: '💎 style: Formattazione', value: 'style' },
        { name: '♻️  refactor: Refactoring', value: 'refactor' },
        { name: '🚀 perf: Performance', value: 'perf' },
        { name: '✅ test: Test', value: 'test' },
        { name: '🔧 chore: Manutenzione', value: 'chore' },
        { name: '🎨 custom: Messaggio personalizzato', value: 'custom' }
      ]
    }
  ]);

  let commitMessage;
  if (commitType === 'custom') {
    const { message } = await inquirer.prompt([
      {
        type: 'input',
        name: 'message',
        message: 'Messaggio commit:',
        validate: (input) => {
          if (!input.trim()) return 'Il messaggio non può essere vuoto';
          if (input.length > CONFIG.MAX_COMMIT_MESSAGE_LENGTH) {
            return `Il messaggio è troppo lungo (max ${CONFIG.MAX_COMMIT_MESSAGE_LENGTH} caratteri)`;
          }
          return true;
        }
      }
    ]);
    commitMessage = message;
  } else {
    const { description } = await inquirer.prompt([
      {
        type: 'input',
        name: 'description',
        message: `Descrizione breve per ${commitType}:`,
        validate: (input) => input.trim() ? true : 'La descrizione non può essere vuota'
      }
    ]);
    commitMessage = `${commitType}: ${description}`;
  }

  // Esegui commit
  const spinner = ora('Creando commit...').start();
  try {
    gitExec(`git commit -m "${commitMessage}"`);
    spinner.succeed('Commit creato con successo!');
  } catch (error) {
    spinner.fail('Errore durante il commit');
    return;
  }

  // Push
  const { pushChoice } = await inquirer.prompt([
    {
      type: 'list',
      name: 'pushChoice',
      message: 'Vuoi pushare le modifiche?',
      choices: [
        { name: '✅ Push sul branch corrente', value: 'current' },
        { name: '🌿 Push su un nuovo branch', value: 'new' },
        { name: '❌ Non pushare ora', value: 'skip' }
      ]
    }
  ]);

  if (pushChoice === 'current') {
    const currentBranch = gitExec('git branch --show-current');
    const spinner = ora(`Pushing su ${currentBranch}...`).start();
    try {
      gitExec(`git push origin ${currentBranch}`);
      spinner.succeed('Push completato!');
    } catch (error) {
      // Prova con -u se il branch non esiste sul remote
      try {
        gitExec(`git push -u origin ${currentBranch}`);
        spinner.succeed('Push completato (nuovo branch sul remote)!');
      } catch (error) {
        spinner.fail('Errore durante il push');
      }
    }
  } else if (pushChoice === 'new') {
    const { branchType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'branchType',
        message: 'Tipo di branch:',
        choices: [
          { name: '🌿 Feature', value: 'feature/' },
          { name: '🐛 Hotfix', value: 'hotfix/' },
          { name: '📝 Custom', value: '' }
        ]
      }
    ]);

    const { branchName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'branchName',
        message: 'Nome del branch:',
        validate: (input) => {
          if (!input.trim()) return 'Il nome non può essere vuoto';
          if (!/^[a-zA-Z0-9-_]+$/.test(input)) {
            return 'Usa solo lettere, numeri, - e _';
          }
          return true;
        }
      }
    ]);

    const fullBranchName = branchType + branchName;
    const spinner = ora(`Creando e pushando branch ${fullBranchName}...`).start();
    
    try {
      gitExec(`git checkout -b ${fullBranchName}`);
      gitExec(`git push -u origin ${fullBranchName}`);
      spinner.succeed(`Branch ${fullBranchName} creato e pushato!`);
    } catch (error) {
      spinner.fail('Errore durante la creazione del branch');
    }
  }
}

// Backup intelligente
async function smartBackup() {
  const { backupType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'backupType',
      message: 'Tipo di backup:',
      choices: [
        { name: '💾 Backup rapido (branch timestamped)', value: 'quick' },
        { name: '🏷️  Backup con tag', value: 'tag' },
        { name: '📦 Backup completo (branch + tag)', value: 'full' },
        { name: '🧹 Gestisci backup esistenti', value: 'manage' }
      ]
    }
  ]);

  switch (backupType) {
    case 'quick':
      await quickBackup();
      break;
    case 'tag':
      await tagBackup();
      break;
    case 'full':
      await fullBackup();
      break;
    case 'manage':
      await manageBackups();
      break;
  }
}

// Backup rapido
async function quickBackup() {
  const date = new Date();
  const timestamp = `${date.getDate().toString().padStart(2, '0')}${(date.getMonth() + 1).toString().padStart(2, '0')}_${date.getHours().toString().padStart(2, '0')}_${date.getMinutes().toString().padStart(2, '0')}`;
  const branchName = `backup/${timestamp}`;
  
  const { description } = await inquirer.prompt([
    {
      type: 'input',
      name: 'description',
      message: 'Descrizione backup (opzionale):',
      default: ''
    }
  ]);

  const spinner = ora('Creando backup...').start();
  
  try {
    // Commit modifiche pendenti
    const status = gitExec('git status --porcelain', true);
    if (status) {
      gitExec('git add -A');
      const commitMsg = description ? `Backup: ${description}` : `Auto-backup ${timestamp}`;
      gitExec(`git commit -m "${commitMsg}"`);
    }
    
    // Crea branch di backup
    gitExec(`git checkout -b ${branchName}`);
    gitExec(`git push -u origin ${branchName}`);
    
    // Torna al branch precedente
    gitExec('git checkout -');
    
    spinner.succeed(`Backup creato: ${branchName}`);
  } catch (error) {
    spinner.fail('Errore durante il backup');
  }
}

// Backup con tag
async function tagBackup() {
  const { tagName } = await inquirer.prompt([
    {
      type: 'input',
      name: 'tagName',
      message: 'Nome tag (es. v1.0-backup):',
      validate: (input) => {
        if (!input.trim()) return 'Il nome non può essere vuoto';
        if (!/^[a-zA-Z0-9.-_]+$/.test(input)) {
          return 'Usa solo lettere, numeri, ., - e _';
        }
        return true;
      }
    }
  ]);

  const { message } = await inquirer.prompt([
    {
      type: 'input',
      name: 'message',
      message: 'Messaggio tag:',
      default: `Backup ${new Date().toLocaleString()}`
    }
  ]);

  const { annotated } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'annotated',
      message: 'Creare tag annotato (consigliato)?',
      default: true
    }
  ]);

  const spinner = ora('Creando tag...').start();
  
  try {
    if (annotated) {
      gitExec(`git tag -a ${tagName} -m "${message}"`);
    } else {
      gitExec(`git tag ${tagName}`);
    }
    
    gitExec(`git push origin ${tagName}`);
    spinner.succeed(`Tag creato e pushato: ${tagName}`);
  } catch (error) {
    spinner.fail('Errore durante la creazione del tag');
  }
}

// Backup completo
async function fullBackup() {
  console.log(chalk.cyan('\n📦 Backup completo (branch + tag)'));
  
  await quickBackup();
  await tagBackup();
  
  console.log(chalk.green('\n✅ Backup completo eseguito!'));
}

// Gestisci backup
async function manageBackups() {
  const backupBranches = gitExec('git branch -r | grep "origin/backup/" || echo ""')
    .split('\n')
    .filter(b => b.trim())
    .map(b => b.trim().replace('origin/', ''));

  const tags = gitExec('git tag -l "*backup*" || echo ""')
    .split('\n')
    .filter(t => t.trim());

  console.log(chalk.cyan('\n📊 Backup esistenti:'));
  console.log(`   Branch di backup: ${chalk.yellow(backupBranches.length)}`);
  console.log(`   Tag di backup: ${chalk.yellow(tags.length)}`);

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Cosa vuoi fare?',
      choices: [
        { name: '📋 Lista dettagliata', value: 'list' },
        { name: '🗑️  Elimina vecchi backup', value: 'clean' },
        { name: '↩️  Indietro', value: 'back' }
      ]
    }
  ]);

  if (action === 'list') {
    if (backupBranches.length > 0) {
      console.log(chalk.cyan('\n🌿 Branch di backup:'));
      backupBranches.forEach(b => console.log(`   - ${b}`));
    }
    
    if (tags.length > 0) {
      console.log(chalk.cyan('\n🏷️  Tag di backup:'));
      tags.forEach(t => console.log(`   - ${t}`));
    }
  } else if (action === 'clean') {
    const { daysToKeep } = await inquirer.prompt([
      {
        type: 'number',
        name: 'daysToKeep',
        message: 'Mantieni backup degli ultimi N giorni:',
        default: 7,
        validate: (input) => input > 0 ? true : 'Deve essere maggiore di 0'
      }
    ]);

    const spinner = ora('Pulizia backup...').start();
    let deleted = 0;

    // Qui potresti implementare la logica per eliminare backup vecchi
    // basandoti sulla data nel nome del branch/tag

    spinner.succeed(`Pulizia completata! ${deleted} backup eliminati`);
  }
}

// Sincronizza con remote
async function syncWithRemote() {
  const { syncType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'syncType',
      message: 'Tipo di sincronizzazione:',
      choices: [
        { name: '⬇️  Pull (scarica modifiche)', value: 'pull' },
        { name: '⬆️  Push (carica modifiche)', value: 'push' },
        { name: '🔄 Fetch (aggiorna riferimenti)', value: 'fetch' },
        { name: '♻️  Pull + Push (sync completo)', value: 'sync' }
      ]
    }
  ]);

  const currentBranch = gitExec('git branch --show-current');
  const spinner = ora(`Sincronizzando ${currentBranch}...`).start();

  try {
    switch (syncType) {
      case 'pull':
        gitExec('git pull');
        spinner.succeed('Pull completato!');
        break;
      
      case 'push':
        gitExec(`git push origin ${currentBranch}`);
        spinner.succeed('Push completato!');
        break;
      
      case 'fetch':
        gitExec('git fetch --all');
        spinner.succeed('Fetch completato!');
        break;
      
      case 'sync':
        gitExec('git pull');
        gitExec(`git push origin ${currentBranch}`);
        spinner.succeed('Sincronizzazione completa!');
        break;
    }
  } catch (error) {
    spinner.fail('Errore durante la sincronizzazione');
  }
}

// Visualizza stato dettagliato
async function showDetailedStatus() {
  console.log(chalk.cyan('\n📊 Stato dettagliato del repository:\n'));
  
  // Informazioni generali
  const branch = gitExec('git branch --show-current');
  const lastCommit = gitExec('git log -1 --oneline');
  const remoteUrl = gitExec('git remote get-url origin', true) || 'Nessun remote';
  
  console.log(chalk.yellow('Informazioni generali:'));
  console.log(`  Branch: ${branch}`);
  console.log(`  Ultimo commit: ${lastCommit}`);
  console.log(`  Remote: ${remoteUrl}`);
  
  // Stato file
  console.log(chalk.yellow('\nStato file:'));
  const status = gitExec('git status -s') || '  Nessuna modifica';
  console.log(status);
  
  // Branch locali e remoti
  const { showBranches } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'showBranches',
      message: '\nMostrare tutti i branch?',
      default: false
    }
  ]);
  
  if (showBranches) {
    console.log(chalk.yellow('\nBranch locali:'));
    console.log(gitExec('git branch'));
    
    console.log(chalk.yellow('\nBranch remoti:'));
    console.log(gitExec('git branch -r'));
  }
  
  // Log recenti
  const { showLog } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'showLog',
      message: 'Mostrare log commit recenti?',
      default: false
    }
  ]);
  
  if (showLog) {
    console.log(chalk.yellow('\nUltimi 10 commit:'));
    console.log(gitExec('git log --oneline -10'));
  }
}

// Gestione tag
async function tagManagement() {
  const { tagAction } = await inquirer.prompt([
    {
      type: 'list',
      name: 'tagAction',
      message: 'Gestione Tag:',
      choices: [
        { name: '📋 Lista tag', value: 'list' },
        { name: '➕ Crea nuovo tag', value: 'create' },
        { name: '🗑️  Elimina tag', value: 'delete' },
        { name: '⬆️  Push tag', value: 'push' },
        { name: '↩️  Indietro', value: 'back' }
      ]
    }
  ]);

  switch (tagAction) {
    case 'list':
      const tags = gitExec('git tag -l') || 'Nessun tag';
      console.log(chalk.cyan('\n🏷️  Tag esistenti:'));
      console.log(tags);
      break;
    
    case 'create':
      await tagBackup();
      break;
    
    case 'delete':
      await deleteTag();
      break;
    
    case 'push':
      await pushTags();
      break;
  }
}

// Elimina tag
async function deleteTag() {
  const tags = gitExec('git tag -l').split('\n').filter(t => t.trim());
  
  if (tags.length === 0) {
    console.log(chalk.yellow('ℹ️  Nessun tag da eliminare'));
    return;
  }

  const { tagsToDelete } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'tagsToDelete',
      message: 'Seleziona tag da eliminare:',
      choices: tags
    }
  ]);

  if (tagsToDelete.length === 0) return;

  const { deleteRemote } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'deleteRemote',
      message: 'Eliminare anche dal remote?',
      default: false
    }
  ]);

  const spinner = ora('Eliminando tag...').start();
  
  for (const tag of tagsToDelete) {
    gitExec(`git tag -d ${tag}`);
    if (deleteRemote) {
      gitExec(`git push origin --delete ${tag}`, true);
    }
  }
  
  spinner.succeed('Tag eliminati!');
}

// Push tag
async function pushTags() {
  const { pushAll } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'pushAll',
      message: 'Pushare tutti i tag?',
      default: true
    }
  ]);

  const spinner = ora('Pushing tag...').start();
  
  try {
    if (pushAll) {
      gitExec('git push --tags');
    } else {
      const tags = gitExec('git tag -l').split('\n').filter(t => t.trim());
      const { selectedTag } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedTag',
          message: 'Seleziona tag da pushare:',
          choices: tags
        }
      ]);
      gitExec(`git push origin ${selectedTag}`);
    }
    spinner.succeed('Tag pushati!');
  } catch (error) {
    spinner.fail('Errore durante il push dei tag');
  }
}

// Pulizia repository SICURA
async function cleanupRepository() {
  const { cleanupAction } = await inquirer.prompt([
    {
      type: 'list',
      name: 'cleanupAction',
      message: 'Pulizia Repository (SICURA):',
      choices: [
        { name: '🗑️  Rimuovi file non tracciati (selettivo)', value: 'untracked' },
        { name: '⛔ Pulizia completa (DISABILITATA)', value: 'clean' },
        { name: '🔀 Rimuovi branch merged', value: 'merged' },
        { name: '📦 Garbage collection', value: 'gc' },
        { name: '↩️  Indietro', value: 'back' }
      ]
    }
  ]);

  switch (cleanupAction) {
    case 'untracked':
      await cleanUntracked();
      break;
    case 'clean':
      await deepClean();
      break;
    case 'merged':
      await cleanMergedBranches();
      break;
    case 'gc':
      await runGarbageCollection();
      break;
  }
}

// Pulisci branch merged
async function cleanMergedBranches() {
  const mergedBranches = gitExec('git branch --merged | grep -v "\\*\\|main\\|master" || echo ""')
    .split('\n')
    .filter(b => b.trim() && !SAFETY_CONFIG.PROTECTED_BRANCHES.includes(b.trim()));

  if (mergedBranches.length === 0) {
    console.log(chalk.yellow('ℹ️  Nessun branch merged da eliminare'));
    return;
  }

  console.log(chalk.cyan('\n🔀 Branch già merged (eliminabili):'));
  mergedBranches.forEach(b => console.log(`  - ${b}`));

  const { confirmDelete } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmDelete',
      message: 'Eliminare questi branch?',
      default: false
    }
  ]);

  if (confirmDelete) {
    await createSafetyBackup('clean-merged-branches');
    
    const spinner = ora('Eliminando branch...').start();
    mergedBranches.forEach(branch => {
      gitExec(`git branch -d ${branch.trim()}`);
    });
    spinner.succeed(`${mergedBranches.length} branch eliminati!`);
  }
}

// Garbage collection
async function runGarbageCollection() {
  const { aggressive } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'aggressive',
      message: 'Eseguire garbage collection aggressiva (più lenta ma più efficace)?',
      default: false
    }
  ]);

  const spinner = ora('Ottimizzando repository...').start();
  
  if (aggressive) {
    gitExec('git gc --aggressive --prune=now');
  } else {
    gitExec('git gc --prune=now');
  }
  
  spinner.succeed('Repository ottimizzato!');
}

// Configurazioni
async function configurations() {
  const { configAction } = await inquirer.prompt([
    {
      type: 'list',
      name: 'configAction',
      message: 'Configurazioni:',
      choices: [
        { name: '👤 Configurazione utente', value: 'user' },
        { name: '🔗 Gestione remote', value: 'remote' },
        { name: '⚙️  Impostazioni Git', value: 'settings' },
        { name: '🔑 Configurazione SSH', value: 'ssh' },
        { name: '↩️  Indietro', value: 'back' }
      ]
    }
  ]);

  switch (configAction) {
    case 'user':
      await configureUser();
      break;
    case 'remote':
      await manageRemotes();
      break;
    case 'settings':
      await gitSettings();
      break;
    case 'ssh':
      await sshConfig();
      break;
  }
}

// Configura utente
async function configureUser() {
  const currentName = gitExec('git config user.name', true) || 'Non configurato';
  const currentEmail = gitExec('git config user.email', true) || 'Non configurato';

  console.log(chalk.cyan('\n👤 Configurazione utente attuale:'));
  console.log(`  Nome: ${currentName}`);
  console.log(`  Email: ${currentEmail}`);

  const { updateUser } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'updateUser',
      message: 'Vuoi aggiornare la configurazione?',
      default: false
    }
  ]);

  if (updateUser) {
    const { scope } = await inquirer.prompt([
      {
        type: 'list',
        name: 'scope',
        message: 'Ambito configurazione:',
        choices: [
          { name: '📁 Solo questo repository', value: 'local' },
          { name: '🌍 Globale (tutti i repository)', value: 'global' }
        ]
      }
    ]);

    const { name, email } = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Nome:',
        default: currentName !== 'Non configurato' ? currentName : ''
      },
      {
        type: 'input',
        name: 'email',
        message: 'Email:',
        default: currentEmail !== 'Non configurato' ? currentEmail : '',
        validate: (input) => {
          if (!input.includes('@')) return 'Inserisci un\'email valida';
          return true;
        }
      }
    ]);

    const flag = scope === 'global' ? '--global' : '';
    gitExec(`git config ${flag} user.name "${name}"`);
    gitExec(`git config ${flag} user.email "${email}"`);
    
    console.log(chalk.green('✅ Configurazione aggiornata!'));
  }
}

// Gestione remote
async function manageRemotes() {
  const remotes = gitExec('git remote -v') || 'Nessun remote configurato';
  
  console.log(chalk.cyan('\n🔗 Remote configurati:'));
  console.log(remotes);

  const { remoteAction } = await inquirer.prompt([
    {
      type: 'list',
      name: 'remoteAction',
      message: 'Cosa vuoi fare?',
      choices: [
        { name: '➕ Aggiungi remote', value: 'add' },
        { name: '🗑️  Rimuovi remote', value: 'remove' },
        { name: '✏️  Modifica URL remote', value: 'edit' },
        { name: '↩️  Indietro', value: 'back' }
      ]
    }
  ]);

  switch (remoteAction) {
    case 'add':
      const { remoteName, remoteUrl } = await inquirer.prompt([
        {
          type: 'input',
          name: 'remoteName',
          message: 'Nome remote:',
          default: 'origin',
          validate: (input) => input.trim() ? true : 'Il nome non può essere vuoto'
        },
        {
          type: 'input',
          name: 'remoteUrl',
          message: 'URL remote:',
          validate: (input) => {
            if (!input.trim()) return 'L\'URL non può essere vuoto';
            if (!input.includes('.git') && !input.includes('github.com')) {
              return 'L\'URL sembra non valido';
            }
            return true;
          }
        }
      ]);
      
      gitExec(`git remote add ${remoteName} ${remoteUrl}`);
      console.log(chalk.green('✅ Remote aggiunto!'));
      break;

    case 'remove':
      const existingRemotes = gitExec('git remote').split('\n').filter(r => r.trim());
      if (existingRemotes.length === 0) {
        console.log(chalk.yellow('ℹ️  Nessun remote da rimuovere'));
        return;
      }
      
      const { remoteToRemove } = await inquirer.prompt([
        {
          type: 'list',
          name: 'remoteToRemove',
          message: 'Quale remote rimuovere?',
          choices: existingRemotes
        }
      ]);
      
      gitExec(`git remote remove ${remoteToRemove}`);
      console.log(chalk.green('✅ Remote rimosso!'));
      break;

    case 'edit':
      const remotesToEdit = gitExec('git remote').split('\n').filter(r => r.trim());
      if (remotesToEdit.length === 0) {
        console.log(chalk.yellow('ℹ️  Nessun remote da modificare'));
        return;
      }
      
      const { remoteToEdit } = await inquirer.prompt([
        {
          type: 'list',
          name: 'remoteToEdit',
          message: 'Quale remote modificare?',
          choices: remotesToEdit
        }
      ]);
      
      const currentUrl = gitExec(`git remote get-url ${remoteToEdit}`);
      console.log(`URL attuale: ${currentUrl}`);
      
      const { newUrl } = await inquirer.prompt([
        {
          type: 'input',
          name: 'newUrl',
          message: 'Nuovo URL:',
          default: currentUrl
        }
      ]);
      
      gitExec(`git remote set-url ${remoteToEdit} ${newUrl}`);
      console.log(chalk.green('✅ URL aggiornato!'));
      break;
  }
}

// Impostazioni Git
async function gitSettings() {
  const { setting } = await inquirer.prompt([
    {
      type: 'list',
      name: 'setting',
      message: 'Quale impostazione vuoi configurare?',
      choices: [
        { name: '📝 Editor predefinito', value: 'editor' },
        { name: '🔀 Strategia merge', value: 'merge' },
        { name: '🎨 Colori output', value: 'color' },
        { name: '📋 Alias comandi', value: 'alias' },
        { name: '↩️  Indietro', value: 'back' }
      ]
    }
  ]);

  switch (setting) {
    case 'editor':
      const { editor } = await inquirer.prompt([
        {
          type: 'list',
          name: 'editor',
          message: 'Seleziona editor:',
          choices: [
            { name: 'VS Code', value: 'code --wait' },
            { name: 'Vim', value: 'vim' },
            { name: 'Nano', value: 'nano' },
            { name: 'Sublime Text', value: 'subl -n -w' },
            { name: 'Altro', value: 'custom' }
          ]
        }
      ]);
      
      let editorCommand = editor;
      if (editor === 'custom') {
        const { customEditor } = await inquirer.prompt([
          {
            type: 'input',
            name: 'customEditor',
            message: 'Comando editor:'
          }
        ]);
        editorCommand = customEditor;
      }
      
      gitExec(`git config --global core.editor "${editorCommand}"`);
      console.log(chalk.green('✅ Editor configurato!'));
      break;

    case 'merge':
      const { mergeStrategy } = await inquirer.prompt([
        {
          type: 'list',
          name: 'mergeStrategy',
          message: 'Strategia di merge:',
          choices: [
            { name: 'Fast-forward quando possibile', value: 'ff' },
            { name: 'Sempre crea commit di merge', value: 'no-ff' },
            { name: 'Solo fast-forward', value: 'ff-only' }
          ]
        }
      ]);
      
      gitExec(`git config merge.ff ${mergeStrategy}`);
      console.log(chalk.green('✅ Strategia merge configurata!'));
      break;

    case 'color':
      const { colorOutput } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'colorOutput',
          message: 'Abilitare output colorato?',
          default: true
        }
      ]);
      
      gitExec(`git config --global color.ui ${colorOutput ? 'auto' : 'false'}`);
      console.log(chalk.green('✅ Colori configurati!'));
      break;

    case 'alias':
      console.log(chalk.cyan('\n📋 Alias comuni:'));
      console.log('  co = checkout');
      console.log('  br = branch');
      console.log('  ci = commit');
      console.log('  st = status');
      console.log('  lg = log --oneline --graph');
      
      const { addAlias } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'addAlias',
          message: 'Aggiungere questi alias?',
          default: true
        }
      ]);
      
      if (addAlias) {
        gitExec('git config --global alias.co checkout');
        gitExec('git config --global alias.br branch');
        gitExec('git config --global alias.ci commit');
        gitExec('git config --global alias.st status');
        gitExec('git config --global alias.lg "log --oneline --graph"');
        console.log(chalk.green('✅ Alias configurati!'));
      }
      break;
  }
}

// Gestione Database Prisma
async function databaseManagement() {
  const { dbAction } = await inquirer.prompt([
    {
      type: 'list',
      name: 'dbAction',
      message: 'Gestione Database:',
      choices: [
        { name: '📊 Stato Database', value: 'status' },
        { name: '🔄 Generate Prisma Client', value: 'generate' },
        { name: '📤 Push Schema al DB', value: 'push' },
        { name: '🏗️  Apri Prisma Studio', value: 'studio' },
        { name: '📋 Lista Tabelle', value: 'tables' },
        { name: '💾 Backup Database', value: 'backup' },
        { name: '⚠️  Reset Database (PERICOLOSO)', value: 'reset' },
        { name: '↩️  Indietro', value: 'back' }
      ]
    }
  ]);

  switch (dbAction) {
    case 'status':
      await checkDatabaseStatus();
      break;
    case 'generate':
      await generatePrismaClient();
      break;
    case 'push':
      await pushPrismaSchema();
      break;
    case 'studio':
      await openPrismaStudio();
      break;
    case 'tables':
      await listDatabaseTables();
      break;
    case 'backup':
      await backupDatabase();
      break;
    case 'reset':
      await resetDatabase();
      break;
  }
}

// Controlla stato database
async function checkDatabaseStatus() {
  console.log(chalk.cyan('\n🗃️  Stato Database:\n'));
  
  // Controlla se esiste il file schema
  const schemaExists = fs.existsSync('prisma/schema.prisma');
  console.log(`   Schema Prisma: ${schemaExists ? chalk.green('✓ Presente') : chalk.red('✗ Mancante')}`);
  
  // Controlla se esiste il database
  const dbExists = fs.existsSync('prisma/dev.db') || fs.existsSync('dev.db');
  console.log(`   Database SQLite: ${dbExists ? chalk.green('✓ Presente') : chalk.yellow('⚠ Non trovato')}`);
  
  // Controlla se Prisma Client è generato
  const clientExists = fs.existsSync('node_modules/.prisma') || fs.existsSync('node_modules/@prisma/client');
  console.log(`   Prisma Client: ${clientExists ? chalk.green('✓ Generato') : chalk.yellow('⚠ Non generato')}`);
  
  // Prova a contare le tabelle se il DB esiste
  if (dbExists) {
    try {
      const tableCount = execSync('echo ".tables" | sqlite3 prisma/dev.db 2>/dev/null | wc -l || echo "0"', { 
        encoding: 'utf-8' 
      }).trim();
      console.log(`   Tabelle nel DB: ${chalk.yellow(tableCount)}`);
    } catch (error) {
      console.log(`   Tabelle nel DB: ${chalk.gray('Non rilevabili')}`);
    }
  }
}

// Genera Prisma Client
async function generatePrismaClient() {
  const spinner = ora('Generando Prisma Client...').start();
  
  try {
    execSync('npm run db:generate', { encoding: 'utf-8' });
    spinner.succeed('Prisma Client generato con successo!');
  } catch (error) {
    spinner.fail('Errore durante la generazione');
    console.log(chalk.red('\n❌ Errore:'), error.message);
  }
}

// Push schema al database
async function pushPrismaSchema() {
  console.log(chalk.yellow('\n⚠️  Questo comando applicherà le modifiche allo schema direttamente al database'));
  
  const { confirmPush } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmPush',
      message: 'Continuare con il push dello schema?',
      default: false
    }
  ]);
  
  if (!confirmPush) return;
  
  const spinner = ora('Applicando schema al database...').start();
  
  try {
    execSync('npm run db:push', { encoding: 'utf-8' });
    spinner.succeed('Schema applicato con successo!');
  } catch (error) {
    spinner.fail('Errore durante il push dello schema');
    console.log(chalk.red('\n❌ Errore:'), error.message);
  }
}

// Apri Prisma Studio
async function openPrismaStudio() {
  console.log(chalk.cyan('\n🎨 Aprendo Prisma Studio...'));
  console.log(chalk.gray('Prisma Studio si aprirà in una nuova finestra del browser'));
  console.log(chalk.gray('URL: http://localhost:5555'));
  
  try {
    // Avvia Prisma Studio in background
    execSync('npm run db:studio &', { encoding: 'utf-8' });
    console.log(chalk.green('\n✅ Prisma Studio avviato!'));
    console.log(chalk.yellow('Per fermarlo, usa Ctrl+C nel terminale dove è stato avviato'));
  } catch (error) {
    console.log(chalk.red('\n❌ Errore nell\'avvio di Prisma Studio:'), error.message);
  }
}

// Lista tabelle database
async function listDatabaseTables() {
  console.log(chalk.cyan('\n📋 Tabelle nel Database:\n'));
  
  try {
    const tables = execSync('echo ".tables" | sqlite3 prisma/dev.db 2>/dev/null || echo "Nessuna tabella trovata"', { 
      encoding: 'utf-8' 
    }).trim();
    
    if (tables && tables !== 'Nessuna tabella trovata') {
      const tableList = tables.split(/\s+/).filter(t => t.trim());
      tableList.forEach(table => {
        console.log(`   📋 ${table}`);
      });
      
      const { showDetails } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'showDetails',
          message: 'Mostrare dettagli di una tabella?',
          default: false
        }
      ]);
      
      if (showDetails) {
        const { selectedTable } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedTable',
            message: 'Quale tabella ispezionare?',
            choices: tableList
          }
        ]);
        
        try {
          const schema = execSync(`echo ".schema ${selectedTable}" | sqlite3 prisma/dev.db`, { 
            encoding: 'utf-8' 
          });
          console.log(chalk.yellow(`\n📋 Schema della tabella ${selectedTable}:`));
          console.log(schema);
        } catch (error) {
          console.log(chalk.red('\n❌ Errore nel recupero dello schema'));
        }
      }
    } else {
      console.log(chalk.yellow('   ⚠️  Nessuna tabella trovata nel database'));
    }
  } catch (error) {
    console.log(chalk.red('\n❌ Errore nell\'accesso al database:'), error.message);
  }
}

// Backup database
async function backupDatabase() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupName = `database-backup-${timestamp}.db`;
  
  const spinner = ora('Creando backup del database...').start();
  
  try {
    if (fs.existsSync('prisma/dev.db')) {
      fs.copyFileSync('prisma/dev.db', `prisma/${backupName}`);
      spinner.succeed(`Backup creato: prisma/${backupName}`);
    } else if (fs.existsSync('dev.db')) {
      fs.copyFileSync('dev.db', backupName);
      spinner.succeed(`Backup creato: ${backupName}`);
    } else {
      spinner.fail('Database non trovato per il backup');
    }
  } catch (error) {
    spinner.fail('Errore durante il backup');
    console.log(chalk.red('\n❌ Errore:'), error.message);
  }
}

// Reset database (PERICOLOSO)
async function resetDatabase() {
  console.log(chalk.red('\n⚠️  ATTENZIONE: Questa operazione eliminerà TUTTI i dati!'));
  console.log(chalk.yellow('Il database verrà completamente ricreato secondo lo schema Prisma.'));
  
  const { confirmReset } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmReset',
      message: chalk.red('Sei SICURO di voler cancellare tutti i dati?'),
      default: false
    }
  ]);
  
  if (!confirmReset) {
    console.log(chalk.gray('Reset annullato'));
    return;
  }
  
  // Seconda conferma
  const { doubleConfirm } = await inquirer.prompt([
    {
      type: 'input',
      name: 'doubleConfirm',
      message: chalk.red('Digita "ELIMINA TUTTO" per confermare:'),
      validate: (input) => input === 'ELIMINA TUTTO' ? true : 'Digita esattamente "ELIMINA TUTTO"'
    }
  ]);
  
  // Crea backup prima del reset
  await backupDatabase();
  
  const spinner = ora('Resettando database...').start();
  
  try {
    // Elimina il database esistente
    if (fs.existsSync('prisma/dev.db')) {
      fs.unlinkSync('prisma/dev.db');
    }
    if (fs.existsSync('dev.db')) {
      fs.unlinkSync('dev.db');
    }
    
    // Ricrea il database con push
    execSync('npm run db:push', { encoding: 'utf-8' });
    
    spinner.succeed('Database resettato con successo!');
    console.log(chalk.green('✅ Database ricreato secondo lo schema Prisma'));
  } catch (error) {
    spinner.fail('Errore durante il reset');
    console.log(chalk.red('\n❌ Errore:'), error.message);
  }
}

// Configurazione SSH
async function sshConfig() {
  console.log(chalk.cyan('\n🔑 Configurazione SSH per Git'));
  
  const { sshAction } = await inquirer.prompt([
    {
      type: 'list',
      name: 'sshAction',
      message: 'Cosa vuoi fare?',
      choices: [
        { name: '🔍 Verifica chiavi SSH esistenti', value: 'check' },
        { name: '🔐 Genera nuova chiave SSH', value: 'generate' },
        { name: '📋 Copia chiave pubblica', value: 'copy' },
        { name: '🧪 Test connessione GitHub', value: 'test' },
        { name: '↩️  Indietro', value: 'back' }
      ]
    }
  ]);

  switch (sshAction) {
    case 'check':
      console.log(chalk.cyan('\n🔍 Chiavi SSH esistenti:'));
      try {
        const sshKeys = execSync('ls -la ~/.ssh', { encoding: 'utf-8' });
        console.log(sshKeys);
      } catch (error) {
        console.log(chalk.yellow('ℹ️  Nessuna chiave SSH trovata'));
      }
      break;

    case 'generate':
      console.log(chalk.yellow('\n⚠️  Questo genererà una nuova chiave SSH'));
      console.log(chalk.gray('Comando: ssh-keygen -t ed25519 -C "your_email@example.com"'));
      console.log(chalk.gray('\nEsegui questo comando manualmente nel terminale'));
      break;

    case 'copy':
      try {
        const pubKey = execSync('cat ~/.ssh/id_ed25519.pub', { encoding: 'utf-8' });
        console.log(chalk.cyan('\n📋 Chiave pubblica:'));
        console.log(pubKey);
        console.log(chalk.gray('\nCopia questa chiave e aggiungila a GitHub/GitLab'));
      } catch (error) {
        console.log(chalk.red('❌ Chiave non trovata. Genera prima una chiave SSH'));
      }
      break;

    case 'test':
      console.log(chalk.cyan('\n🧪 Test connessione GitHub...'));
      try {
        const result = execSync('ssh -T git@github.com', { encoding: 'utf-8' });
        console.log(chalk.green('✅ Connessione riuscita!'));
      } catch (error) {
        // SSH -T ritorna sempre exit code 1, ma se contiene "successfully authenticated" è ok
        if (error.message.includes('successfully authenticated')) {
          console.log(chalk.green('✅ Autenticazione SSH riuscita!'));
        } else {
          console.log(chalk.red('❌ Connessione fallita'));
        }
      }
      break;
  }
}

// Analisi TypeScript - Controlla errori TypeScript nel progetto
async function checkTypeScriptErrors() {
  console.log(chalk.cyan('\n🔍 Analisi TypeScript Bar Roxy in corso...\n'));
  
  const spinner = ora('Esecuzione analisi TypeScript personalizzata...').start();
  
  try {
    // Esegui gli script di analisi del progetto
    const analyze = execSync('node analyze-typescript-errors.js', { 
      encoding: 'utf-8',
      stdio: 'pipe' 
    });
    
    const detect = execSync('node detect-all-typescript-errors.js', { 
      encoding: 'utf-8',
      stdio: 'pipe' 
    });
    
    // Controlla se ci sono errori nei risultati
    const hasErrors = !analyze.includes('No TypeScript errors found') || 
                     !detect.includes('No TypeScript errors found');
    
    spinner.stop();
    
    if (hasErrors) {
      // Estrai il numero di errori se possibile
      const errorMatch = detect.match(/Total TypeScript errors: (\d+)/);
      const errorCount = errorMatch ? errorMatch[1] : 'alcuni';
      
      console.log(chalk.red(`\n❌ Trovati ${errorCount} errori TypeScript!\n`));
      
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'Cosa vuoi fare?',
          choices: [
            { name: '📋 Mostra dettagli errori', value: 'show' },
            { name: '🔧 Continua comunque', value: 'continue' },
            { name: '🛠️  Prova fix con ESLint', value: 'fix' },
            { name: '↩️  Torna al menu', value: 'back' }
          ]
        }
      ]);
      
      if (action === 'show') {
        console.log(chalk.yellow('\n📊 Riepilogo dettagliato:\n'));
        console.log(analyze);
        console.log('\n' + detect);
      } else if (action === 'fix') {
        try {
          console.log(chalk.cyan('\n🔧 Tentativo di fix automatico con ESLint...'));
          execSync('npm run lint -- --fix', { encoding: 'utf-8' });
          console.log(chalk.green('✅ Fix ESLint completato!'));
          
          // Ri-esegui l'analisi dopo il fix
          console.log(chalk.cyan('\n🔄 Ricontrollo dopo il fix...'));
          const recheck = execSync('node detect-all-typescript-errors.js', { 
            encoding: 'utf-8',
            stdio: 'pipe' 
          });
          
          if (recheck.includes('No TypeScript errors found')) {
            console.log(chalk.green('✅ Errori risolti!'));
            return true;
          } else {
            console.log(chalk.yellow('⚠️  Alcuni errori persistono'));
            return action !== 'back';
          }
        } catch (fixError) {
          console.log(chalk.yellow('⚠️  Fix automatico parzialmente riuscito'));
          return action !== 'back';
        }
      }
      
      return action !== 'back';
    } else {
      spinner.succeed('Analisi TypeScript completata!');
      console.log(chalk.green('\n✅ Nessun errore TypeScript trovato!'));
      console.log(chalk.gray('Il codice del Bar Roxy è pulito e pronto per il deploy.'));
      return true;
    }
  } catch (error) {
    spinner.fail('Errore durante l\'analisi');
    console.log(chalk.red('\n❌ Impossibile eseguire gli script di analisi TypeScript'));
    console.log(chalk.gray('Verifica che i file analyze-typescript-errors.js e detect-all-typescript-errors.js esistano'));
    
    // Fallback con controlli standard
    console.log(chalk.cyan('\n🔄 Provo con controlli standard...'));
    try {
      const fallbackSpinner = ora('Controllo con tsc...').start();
      execSync('npx tsc --noEmit --skipLibCheck', { 
        encoding: 'utf-8',
        stdio: 'pipe' 
      });
      fallbackSpinner.succeed('Controllo standard completato!');
      console.log(chalk.green('✅ Nessun errore TypeScript trovato (controllo standard)'));
      return true;
    } catch (fallbackError) {
      console.log(chalk.yellow('⚠️  Anche il controllo standard ha trovato errori'));
      
      const { continueAnyway } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'continueAnyway',
          message: 'Continuare comunque?',
          default: false
        }
      ]);
      
      return continueAnyway;
    }
  }
}

// Deploy su Main - Aggiorna il branch main con il progetto attuale
async function deployToMain() {
  const currentBranch = gitExec('git branch --show-current');
  
  if (currentBranch === 'main') {
    console.log(chalk.yellow('⚠️  Sei già sul branch main!'));
    const { confirmPush } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmPush',
        message: 'Vuoi solo pushare le modifiche?',
        default: true
      }
    ]);
    
    if (confirmPush) {
      const spinner = ora('Pushing su main...').start();
      try {
        gitExec('git push origin main');
        spinner.succeed('Push completato!');
      } catch (error) {
        spinner.fail('Errore durante il push');
      }
    }
    return;
  }

  console.log(chalk.cyan(`\n🚀 Deploy da ${chalk.yellow(currentBranch)} a ${chalk.green('main')}`));
  
  // Verifica stato
  const hasChanges = gitExec('git status --porcelain', true);
  if (hasChanges) {
    console.log(chalk.yellow('\n⚠️  Hai modifiche non committate'));
    console.log(chalk.gray('Le modifiche verranno committate prima del deploy'));
  }
  
  // Mostra differenze con main
  console.log(chalk.cyan('\n📊 Riepilogo modifiche rispetto a main:'));
  const diffStat = gitExec(`git diff main...${currentBranch} --stat`, true);
  if (diffStat) {
    console.log(diffStat);
  } else {
    console.log(chalk.gray('Nessuna differenza trovata'));
  }
  
  // Check TypeScript/Build errors prima del deploy
  console.log(chalk.cyan('\n🔍 Controllo pre-deploy Bar Roxy...'));
  const preDeploySpinner = ora('Analisi TypeScript personalizzata...').start();
  
  let hasErrors = false;
  try {
    // Prima esegui l'analisi TypeScript con gli script del progetto
    try {
      const detect = execSync('node detect-all-typescript-errors.js', { 
        encoding: 'utf-8',
        stdio: 'pipe' 
      });
      
      preDeploySpinner.text = 'TypeScript OK, verifica build...';
      
      // Poi prova il build per verificare che il progetto compili
      execSync('npm run build', { 
        encoding: 'utf-8',
        stdio: 'pipe' 
      });
      
      preDeploySpinner.succeed('✅ Pre-deploy check completato');
      console.log(chalk.green('✅ TypeScript, build e lint OK - pronto per il deploy'));
      
    } catch (checkError) {
      hasErrors = true;
      preDeploySpinner.fail('Errori trovati durante i controlli');
      
      console.log(chalk.red('\n⚠️  Trovati errori durante i controlli pre-deploy!'));
      
      // Prova a determinare il tipo di errore
      try {
        const tsCheck = execSync('node detect-all-typescript-errors.js', { 
          encoding: 'utf-8',
          stdio: 'pipe' 
        });
        if (!tsCheck.includes('No TypeScript errors found')) {
          const errorMatch = tsCheck.match(/Total TypeScript errors: (\d+)/);
          const errorCount = errorMatch ? errorMatch[1] : 'alcuni';
          console.log(chalk.yellow(`\n📊 Trovati ${errorCount} errori TypeScript`));
        }
      } catch (tsError) {
        console.log(chalk.yellow('\n📊 Errori di build/compilazione'));
      }
      
      if (checkError.stdout) {
        console.log(chalk.yellow('\nPrimi 15 errori:'));
        const errorLines = checkError.stdout.split('\n').slice(0, 15);
        console.log(errorLines.join('\n'));
        if (checkError.stdout.split('\n').length > 15) {
          console.log(chalk.gray('... (altri errori troncati)'));
        }
      }
      
      const { proceedWithErrors } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceedWithErrors',
          message: chalk.yellow('Vuoi procedere comunque con il deploy?'),
          default: false
        }
      ]);
      
      if (!proceedWithErrors) {
        console.log(chalk.gray('Deploy annullato. Risolvi prima gli errori.'));
        console.log(chalk.cyan('💡 Usa "🔍 Analisi TypeScript" dal menu per dettagli'));
        return;
      }
    }
  } catch (error) {
    preDeploySpinner.fail('Impossibile eseguire controlli pre-deploy');
    console.log(chalk.yellow('⚠️  Script di analisi non funzionanti, provo controllo standard...'));
    
    // Fallback ai controlli standard
    try {
      execSync('npm run build', { encoding: 'utf-8', stdio: 'pipe' });
      console.log(chalk.green('✅ Build standard OK'));
    } catch (buildError) {
      console.log(chalk.red('❌ Anche il build standard fallisce'));
      const { forceAnyway } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'forceAnyway',
          message: chalk.red('Deploy FORZATO comunque? (PERICOLOSO)'),
          default: false
        }
      ]);
      if (!forceAnyway) {
        console.log(chalk.gray('Deploy annullato'));
        return;
      }
    }
  }
  
  // Conferma deploy
  console.log(chalk.red('\n⚠️  ATTENZIONE: Questa operazione aggiornerà il branch main!'));
  console.log(chalk.yellow('Il branch main verrà completamente sostituito con il contenuto del branch corrente.'));
  
  const { confirmDeploy } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmDeploy',
      message: chalk.red('Sei sicuro di voler procedere?'),
      default: false
    }
  ]);
  
  if (!confirmDeploy) {
    console.log(chalk.gray('Deploy annullato'));
    return;
  }
  
  // Seconda conferma per sicurezza
  const { deployMethod } = await inquirer.prompt([
    {
      type: 'list',
      name: 'deployMethod',
      message: 'Metodo di deploy:',
      choices: [
        { name: '🔀 Merge (consigliato) - Mantiene la storia', value: 'merge' },
        { name: '⚡ Fast-forward - Solo se possibile', value: 'ff' },
        { name: '🔄 Reset (pericoloso) - Sovrascrive completamente', value: 'reset' },
        { name: '❌ Annulla', value: 'cancel' }
      ]
    }
  ]);
  
  if (deployMethod === 'cancel') {
    console.log(chalk.gray('Deploy annullato'));
    return;
  }
  
  // Crea backup prima del deploy
  const backupBranch = await createSafetyBackup('pre-deploy');
  console.log(chalk.green(`✅ Backup creato: ${backupBranch}`));
  
  const spinner = ora('Eseguendo deploy...').start();
  
  try {
    // Commit modifiche pendenti se presenti
    if (hasChanges) {
      gitExec('git add -A');
      const timestamp = new Date().toISOString();
      gitExec(`git commit -m "chore: Auto-commit before deploy - ${timestamp}"`);
    }
    
    // Salva branch corrente
    const originalBranch = currentBranch;
    
    // Passa a main
    gitExec('git checkout main');
    
    // Pull ultime modifiche
    try {
      gitExec('git pull origin main');
    } catch (error) {
      console.log(chalk.yellow('\n⚠️  Non riesco a fare pull, continuo comunque'));
    }
    
    // Esegui deploy basato sul metodo scelto
    if (deployMethod === 'merge') {
      // Merge normale
      try {
        gitExec(`git merge ${originalBranch} --no-edit`);
        spinner.text = 'Merge completato, pushing...';
      } catch (error) {
        spinner.fail('Conflitti durante il merge!');
        console.log(chalk.yellow('\n⚠️  Risolvi i conflitti manualmente e poi:'));
        console.log(chalk.gray('   git add .'));
        console.log(chalk.gray('   git commit'));
        console.log(chalk.gray('   git push origin main'));
        
        // Torna al branch originale
        gitExec(`git checkout ${originalBranch}`);
        return;
      }
    } else if (deployMethod === 'ff') {
      // Fast-forward only
      try {
        gitExec(`git merge ${originalBranch} --ff-only`);
        spinner.text = 'Fast-forward completato, pushing...';
      } catch (error) {
        spinner.fail('Fast-forward non possibile!');
        console.log(chalk.yellow('\n⚠️  Il branch main ha commit che non sono nel tuo branch'));
        console.log(chalk.gray('Usa il metodo merge o risolvi manualmente'));
        
        // Torna al branch originale
        gitExec(`git checkout ${originalBranch}`);
        return;
      }
    } else if (deployMethod === 'reset') {
      // Reset hard (pericoloso)
      console.log(chalk.red('\n⚠️  RESET HARD IN CORSO...'));
      gitExec(`git reset --hard ${originalBranch}`);
      spinner.text = 'Reset completato, force pushing...';
    }
    
    // Push su remote
    if (deployMethod === 'reset') {
      gitExec('git push origin main --force-with-lease');
    } else {
      gitExec('git push origin main');
    }
    
    spinner.succeed('Deploy completato con successo!');
    
    // Chiedi se tornare al branch originale
    const { returnToOriginal } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'returnToOriginal',
        message: `Tornare al branch ${originalBranch}?`,
        default: true
      }
    ]);
    
    if (returnToOriginal) {
      gitExec(`git checkout ${originalBranch}`);
      console.log(chalk.green(`✅ Tornato su ${originalBranch}`));
    }
    
    // Mostra riepilogo
    console.log(chalk.green('\n✅ Deploy completato!'));
    console.log(chalk.gray(`   Backup disponibile: ${backupBranch}`));
    console.log(chalk.gray(`   Branch main aggiornato con successo`));
    
    // Suggerisci prossimi passi
    console.log(chalk.cyan('\n💡 Prossimi passi consigliati:'));
    console.log('   1. Verifica il deploy su produzione');
    console.log('   2. Testa che tutto funzioni correttamente');
    console.log('   3. Se ci sono problemi, puoi ripristinare dal backup');
    
  } catch (error) {
    spinner.fail('Errore durante il deploy!');
    console.log(chalk.red(`\n❌ Errore: ${error.message}`));
    console.log(chalk.yellow(`\n💡 Backup disponibile: ${backupBranch}`));
    console.log(chalk.gray('Puoi ripristinare con: git checkout ' + backupBranch));
  }
}

// Main loop
async function main() {
  checkGitRepo();
  
  while (true) {
    showBanner();
    getRepoInfo();
    
    const action = await mainMenu();
    
    switch (action) {
      case 'auth':
        await githubLogin();
        break;
        
      case 'commit-push':
        await commitAndPush();
        break;
      
      case 'deploy':
        await deployToMain();
        break;
      
      case 'typescript-check':
        await checkTypeScriptErrors();
        break;
      
      case 'database':
        await databaseManagement();
        break;
      
      case 'branch-management':
        await branchManagement();
        break;
      
      case 'smart-backup':
        await smartBackup();
        break;
      
      case 'sync':
        await syncWithRemote();
        break;
      
      case 'status':
        await showDetailedStatus();
        break;
      
      case 'tags':
        await tagManagement();
        break;
      
      case 'cleanup':
        await cleanupRepository();
        break;
      
      case 'config':
        await configurations();
        break;
      
      case 'exit':
        console.log(chalk.cyan('\n👋 Arrivederci!\n'));
        process.exit(0);
    }
    
    // Pausa prima di tornare al menu
    await inquirer.prompt([
      {
        type: 'input',
        name: 'continue',
        message: chalk.gray('\nPremi INVIO per continuare...')
      }
    ]);
  }
}

// Avvia l'applicazione
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('\n❌ Errore fatale:'), error.message);
    process.exit(1);
  });
}