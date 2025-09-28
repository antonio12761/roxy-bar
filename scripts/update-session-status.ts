#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const SESSION_FILE = path.join(process.cwd(), 'SESSION_STATUS.md');

interface SessionUpdate {
  completedWork?: string[];
  newIssues?: string[];
  todoItems?: { text: string; priority: 'high' | 'medium' | 'low' }[];
  notes?: string[];
}

function getCurrentDateTime(): string {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0].substring(0, 5);
  return `${date} ${time}`;
}

function getGitStatus(): string {
  try {
    const modifiedFiles = execSync('git diff --name-only', { encoding: 'utf-8' });
    const untrackedFiles = execSync('git ls-files --others --exclude-standard', { encoding: 'utf-8' });
    
    let status = '';
    if (modifiedFiles.trim()) {
      status += `### File Modificati (non committati)\n${modifiedFiles.split('\n').filter(f => f).map(f => `- ${f}`).join('\n')}\n\n`;
    }
    if (untrackedFiles.trim()) {
      status += `### Nuovi File (non tracciati)\n${untrackedFiles.split('\n').filter(f => f).map(f => `- ${f}`).join('\n')}\n\n`;
    }
    return status;
  } catch (error) {
    return '';
  }
}

function updateSessionStatus(updates: SessionUpdate): void {
  let content = '';
  
  if (fs.existsSync(SESSION_FILE)) {
    content = fs.readFileSync(SESSION_FILE, 'utf-8');
  } else {
    // Crea template iniziale
    content = `# STATO SESSIONE - Bar Roxy Clean
**Data ultima sessione**: ${getCurrentDateTime().split(' ')[0]}
**Ultimo aggiornamento**: ${getCurrentDateTime().split(' ')[1]}

## 🔧 LAVORI COMPLETATI IN QUESTA SESSIONE

## 📂 NUOVE FUNZIONALITÀ AGGIUNTE (Non ancora committate)

## 🐛 PROBLEMI NOTI

## 📋 TODO PROSSIMA SESSIONE

### Alta Priorità

### Media Priorità

### Bassa Priorità

## 🔍 COMANDI UTILI PER VERIFICHE

\`\`\`bash
# Verifica errori TypeScript
node scripts/top/detect-all-typescript-errors.js

# Analizza errori TypeScript
node scripts/top/analyze-typescript-errors.js

# Verifica stato git
git status
\`\`\`

## 📝 NOTE IMPORTANTI

## 🎯 FOCUS PROSSIMA SESSIONE
`;
  }

  // Aggiorna data e ora
  const dateTime = getCurrentDateTime();
  content = content.replace(/\*\*Ultimo aggiornamento\*\*: .+/, `**Ultimo aggiornamento**: ${dateTime.split(' ')[1]}`);
  content = content.replace(/\*\*Data ultima sessione\*\*: .+/, `**Data ultima sessione**: ${dateTime.split(' ')[0]}`);

  // Aggiungi lavori completati
  if (updates.completedWork && updates.completedWork.length > 0) {
    const completedSection = content.match(/## 🔧 LAVORI COMPLETATI IN QUESTA SESSIONE\n\n([\s\S]*?)(?=\n##)/);
    if (completedSection) {
      const newCompleted = updates.completedWork.map(work => `- ✅ ${work}`).join('\n');
      content = content.replace(
        completedSection[0],
        `## 🔧 LAVORI COMPLETATI IN QUESTA SESSIONE\n\n${completedSection[1]}${newCompleted}\n\n`
      );
    }
  }

  // Aggiungi problemi
  if (updates.newIssues && updates.newIssues.length > 0) {
    const issuesSection = content.match(/## 🐛 PROBLEMI NOTI\n\n([\s\S]*?)(?=\n##)/);
    if (issuesSection) {
      const newIssues = updates.newIssues.map(issue => `- ❌ ${issue}`).join('\n');
      content = content.replace(
        issuesSection[0],
        `## 🐛 PROBLEMI NOTI\n\n${issuesSection[1]}${newIssues}\n\n`
      );
    }
  }

  // Aggiungi TODO
  if (updates.todoItems && updates.todoItems.length > 0) {
    updates.todoItems.forEach(todo => {
      const prioritySection = `### ${todo.priority.charAt(0).toUpperCase() + todo.priority.slice(1)} Priorità`;
      const regex = new RegExp(`${prioritySection}\\n([\\s\\S]*?)(?=\\n###|\\n##|$)`);
      const match = content.match(regex);
      
      if (match) {
        const newTodo = `- [ ] ${todo.text}`;
        content = content.replace(
          match[0],
          `${prioritySection}\n${match[1]}${newTodo}\n`
        );
      }
    });
  }

  // Aggiungi stato Git
  const gitStatus = getGitStatus();
  if (gitStatus) {
    const functionalitySection = content.match(/## 📂 NUOVE FUNZIONALITÀ AGGIUNTE \(Non ancora committate\)\n\n([\s\S]*?)(?=\n##)/);
    if (functionalitySection) {
      content = content.replace(
        functionalitySection[0],
        `## 📂 NUOVE FUNZIONALITÀ AGGIUNTE (Non ancora committate)\n\n${gitStatus}`
      );
    }
  }

  // Salva il file aggiornato
  fs.writeFileSync(SESSION_FILE, content, 'utf-8');
  console.log(`✅ SESSION_STATUS.md aggiornato con successo!`);
  console.log(`📅 Data: ${dateTime}`);
}

// Esempio di utilizzo da CLI
if (process.argv.length > 2) {
  const command = process.argv[2];
  
  switch(command) {
    case 'work':
      const workDone = process.argv.slice(3).join(' ');
      if (workDone) {
        updateSessionStatus({ completedWork: [workDone] });
      }
      break;
      
    case 'issue':
      const issue = process.argv.slice(3).join(' ');
      if (issue) {
        updateSessionStatus({ newIssues: [issue] });
      }
      break;
      
    case 'todo':
      const priority = process.argv[3] as 'high' | 'medium' | 'low' || 'medium';
      const todoText = process.argv.slice(4).join(' ');
      if (todoText) {
        updateSessionStatus({ todoItems: [{ text: todoText, priority }] });
      }
      break;
      
    case 'auto':
      // Aggiornamento automatico con stato git
      updateSessionStatus({});
      break;
      
    default:
      console.log(`
Uso: npm run session-update <comando> [argomenti]

Comandi:
  work <descrizione>     - Aggiunge lavoro completato
  issue <descrizione>    - Aggiunge un problema
  todo <priority> <desc> - Aggiunge un TODO (priority: high|medium|low)
  auto                   - Aggiorna automaticamente con stato git

Esempi:
  npm run session-update work "Risolto errore TypeScript in supervisore"
  npm run session-update issue "Build fallisce su produzione"
  npm run session-update todo high "Implementare sistema notifiche"
  npm run session-update auto
      `);
  }
}

export { updateSessionStatus };