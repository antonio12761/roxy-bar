"use server";

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, mkdir, unlink, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { prisma } from "@/lib/db";
import { createHash } from 'crypto';
import { gzip, gunzip } from 'zlib';

const execAsync = promisify(exec);
const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export interface BackupMetadata {
  id: string;
  filename: string;
  timestamp: Date;
  size: number;
  compressed: boolean;
  checksum: string;
  type: 'FULL' | 'INCREMENTAL' | 'SCHEMA';
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  error?: string;
  tables: string[];
  recordCount: Record<string, number>;
  duration: number;
  triggeredBy: 'SCHEDULE' | 'MANUAL' | 'EMERGENCY';
}

export interface BackupConfig {
  backupPath: string;
  maxBackups: number;
  compressionEnabled: boolean;
  fullBackupInterval: number; // ore
  incrementalInterval: number; // minuti
  retentionDays: number;
  excludeTables: string[];
  enableEncryption: boolean;
  notifyOnFailure: boolean;
  serviceHours: { start: number; end: number }; // 0-23
}

export class DatabaseBackupManager {
  private config: BackupConfig = {
    backupPath: process.env.BACKUP_PATH || '/tmp/bar-roxy-backups',
    maxBackups: 50,
    compressionEnabled: true,
    fullBackupInterval: 6, // Ogni 6 ore
    incrementalInterval: 60, // Ogni ora
    retentionDays: 30,
    excludeTables: ['AuditLog'], // Log di audit troppo voluminosi per backup frequenti
    enableEncryption: false,
    notifyOnFailure: true,
    serviceHours: { start: 6, end: 24 } // 6:00 - 24:00
  };

  private isBackupInProgress = false;
  private lastFullBackup: Date | null = null;
  private lastIncrementalBackup: Date | null = null;

  constructor(config?: Partial<BackupConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    this.ensureBackupDirectory();
  }

  // Assicura che la directory di backup esista
  private async ensureBackupDirectory(): Promise<void> {
    try {
      await mkdir(this.config.backupPath, { recursive: true });
      console.log(`[Backup] Directory ${this.config.backupPath} pronta`);
    } catch (error) {
      console.error('[Backup] Errore creazione directory:', error);
      throw error;
    }
  }

  // Verifica se siamo in orario di servizio
  private isServiceHours(): boolean {
    const now = new Date();
    const hour = now.getHours();
    return hour >= this.config.serviceHours.start && hour < this.config.serviceHours.end;
  }

  // Backup completo del database
  async createFullBackup(triggeredBy: 'SCHEDULE' | 'MANUAL' | 'EMERGENCY' = 'SCHEDULE'): Promise<BackupMetadata> {
    if (this.isBackupInProgress) {
      throw new Error('Backup già in corso');
    }

    this.isBackupInProgress = true;
    const startTime = Date.now();
    const timestamp = new Date();
    const backupId = `full_${timestamp.toISOString().replace(/[:.]/g, '-')}`;
    const filename = `${backupId}.sql${this.config.compressionEnabled ? '.gz' : ''}`;
    const filepath = join(this.config.backupPath, filename);

    console.log(`[Backup] Inizio backup completo: ${backupId}`);

    try {
      // Ottieni informazioni sul database
      const tables = await this.getDatabaseTables();
      const recordCounts = await this.getRecordCounts(tables);
      
      // Crea il backup usando pg_dump
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error('DATABASE_URL non configurata');
      }

      // Estrai componenti dall'URL del database
      const url = new URL(databaseUrl);
      const dumpCommand = [
        'pg_dump',
        `--host=${url.hostname}`,
        `--port=${url.port || 5432}`,
        `--username=${url.username}`,
        `--dbname=${url.pathname.slice(1)}`,
        '--verbose',
        '--clean',
        '--if-exists',
        '--create',
        '--format=plain'
      ];

      // Escludi tabelle se specificato
      for (const table of this.config.excludeTables) {
        dumpCommand.push(`--exclude-table=${table}`);
      }

      const dumpResult = await execAsync(dumpCommand.join(' '), {
        env: { ...process.env, PGPASSWORD: url.password }
      });

      let backupData = dumpResult.stdout;
      let compressed = false;

      // Comprimi se abilitato
      if (this.config.compressionEnabled) {
        const compressedBuffer = await gzipAsync(Buffer.from(backupData));
        await writeFile(filepath, compressedBuffer);
        compressed = true;
      } else {
        await writeFile(filepath, backupData);
      }

      // Calcola checksum
      const fileContent = await readFile(filepath);
      const checksum = createHash('sha256').update(fileContent).digest('hex');
      
      // Ottieni dimensione file
      const stats = await stat(filepath);
      const size = stats.size;

      const duration = Date.now() - startTime;
      this.lastFullBackup = new Date();

      const metadata: BackupMetadata = {
        id: backupId,
        filename,
        timestamp,
        size,
        compressed,
        checksum,
        type: 'FULL',
        status: 'COMPLETED',
        tables,
        recordCount: recordCounts,
        duration,
        triggeredBy
      };

      // Salva metadata
      await this.saveBackupMetadata(metadata);

      console.log(`[Backup] Backup completo completato in ${duration}ms: ${filename} (${this.formatSize(size)})`);
      
      return metadata;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
      
      console.error('[Backup] Errore backup completo:', error);

      const metadata: BackupMetadata = {
        id: backupId,
        filename: '',
        timestamp,
        size: 0,
        compressed: false,
        checksum: '',
        type: 'FULL',
        status: 'FAILED',
        error: errorMessage,
        tables: [],
        recordCount: {},
        duration,
        triggeredBy
      };

      await this.saveBackupMetadata(metadata);
      throw error;
    } finally {
      this.isBackupInProgress = false;
    }
  }

  // Backup incrementale (solo dati modificati di recente)
  async createIncrementalBackup(): Promise<BackupMetadata> {
    if (this.isBackupInProgress) {
      throw new Error('Backup già in corso');
    }

    this.isBackupInProgress = true;
    const startTime = Date.now();
    const timestamp = new Date();
    const backupId = `incr_${timestamp.toISOString().replace(/[:.]/g, '-')}`;
    const filename = `${backupId}.json${this.config.compressionEnabled ? '.gz' : ''}`;
    const filepath = join(this.config.backupPath, filename);

    console.log(`[Backup] Inizio backup incrementale: ${backupId}`);

    try {
      // Determina il punto di partenza per il backup incrementale
      const since = this.lastIncrementalBackup || new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 ore fa se first run
      
      // Raccogli dati modificati recentemente
      const incrementalData = await this.collectIncrementalData(since);
      
      let backupContent = JSON.stringify({
        type: 'INCREMENTAL',
        timestamp: timestamp.toISOString(),
        since: since.toISOString(),
        data: incrementalData
      }, null, 2);

      let compressed = false;

      // Comprimi se abilitato
      if (this.config.compressionEnabled) {
        const compressedBuffer = await gzipAsync(Buffer.from(backupContent));
        await writeFile(filepath, compressedBuffer);
        compressed = true;
      } else {
        await writeFile(filepath, backupContent);
      }

      // Calcola checksum e dimensione
      const fileContent = await readFile(filepath);
      const checksum = createHash('sha256').update(fileContent).digest('hex');
      const stats = await stat(filepath);
      const size = stats.size;

      const duration = Date.now() - startTime;
      this.lastIncrementalBackup = new Date();

      const recordCounts = Object.fromEntries(
        Object.entries(incrementalData).map(([table, records]) => [
          table, 
          Array.isArray(records) ? records.length : 0
        ])
      );

      const metadata: BackupMetadata = {
        id: backupId,
        filename,
        timestamp,
        size,
        compressed,
        checksum,
        type: 'INCREMENTAL',
        status: 'COMPLETED',
        tables: Object.keys(incrementalData),
        recordCount: recordCounts,
        duration,
        triggeredBy: 'SCHEDULE'
      };

      await this.saveBackupMetadata(metadata);

      console.log(`[Backup] Backup incrementale completato in ${duration}ms: ${filename} (${this.formatSize(size)})`);
      
      return metadata;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
      
      console.error('[Backup] Errore backup incrementale:', error);

      const metadata: BackupMetadata = {
        id: backupId,
        filename: '',
        timestamp,
        size: 0,
        compressed: false,
        checksum: '',
        type: 'INCREMENTAL',
        status: 'FAILED',
        error: errorMessage,
        tables: [],
        recordCount: {},
        duration,
        triggeredBy: 'SCHEDULE'
      };

      await this.saveBackupMetadata(metadata);
      throw error;
    } finally {
      this.isBackupInProgress = false;
    }
  }

  // Raccogli dati modificati di recente per backup incrementale
  private async collectIncrementalData(since: Date): Promise<Record<string, any[]>> {
    const data: Record<string, any[]> = {};

    try {
      // Ordinazioni modificate
      const ordinazioni = await prisma.ordinazione.findMany({
        where: {
          updatedAt: { gte: since }
        },
        include: {
          righe: true,
          pagamenti: true
        }
      });
      if (ordinazioni.length > 0) data.ordinazioni = ordinazioni;

      // Pagamenti recenti
      const pagamenti = await prisma.pagamento.findMany({
        where: {
          timestamp: { gte: since }
        },
        include: {
          ordinazione: {
            select: {
              id: true,
              numero: true,
              tavoloId: true
            }
          }
        }
      });
      if (pagamenti.length > 0) data.pagamenti = pagamenti;

      // Tavoli modificati
      const tavoli = await prisma.tavolo.findMany({
        where: {
          updatedAt: { gte: since }
        }
      });
      if (tavoli.length > 0) data.tavoli = tavoli;

      // Movimenti cassa recenti
      const movimentiCassa = await prisma.movimentoConto.findMany({
        where: {
          data: { gte: since }
        }
      });
      if (movimentiCassa.length > 0) data.movimenti_cassa = movimentiCassa;

      // Log di audit critici
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          createdAt: { gte: since },
          severity: { in: ['HIGH', 'CRITICAL'] }
        }
      });
      if (auditLogs.length > 0) data.audit_logs = auditLogs;

      console.log(`[Backup] Raccolti dati incrementali: ${Object.keys(data).length} tabelle`);
      
      return data;

    } catch (error) {
      console.error('[Backup] Errore raccolta dati incrementali:', error);
      throw error;
    }
  }

  // Ottieni lista tabelle del database
  private async getDatabaseTables(): Promise<string[]> {
    try {
      const result = await prisma.$queryRaw<{ table_name: string }[]>`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `;
      
      return result.map(row => row.table_name);
    } catch (error) {
      console.error('[Backup] Errore ottenimento tabelle:', error);
      return [];
    }
  }

  // Conta record per tabella
  private async getRecordCounts(tables: string[]): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    
    for (const table of tables) {
      try {
        if (this.config.excludeTables.includes(table)) {
          counts[table] = 0;
          continue;
        }

        // Usa nomi tabella Prisma mappati
        const tableName = this.mapTableName(table);
        if (tableName && (prisma as any)[tableName]) {
          const count = await (prisma as any)[tableName].count();
          counts[table] = count;
        } else {
          counts[table] = 0;
        }
      } catch (error) {
        console.warn(`[Backup] Impossibile contare ${table}:`, error);
        counts[table] = 0;
      }
    }
    
    return counts;
  }

  // Mappa nomi tabella database a modelli Prisma
  private mapTableName(dbTableName: string): string | null {
    const mapping: Record<string, string> = {
      'Ordinazione': 'ordinazione',
      'RigaOrdinazione': 'rigaOrdinazione',
      'Pagamento': 'pagamento',
      'Tavolo': 'tavolo',
      'Cliente': 'cliente',
      'User': 'user',
      'Prodotto': 'prodotto',
      'CategoriaMenu': 'categoriaMenu',
      'MovimentoConto': 'movimentoConto',
      'AuditLog': 'auditLog'
    };
    
    return mapping[dbTableName] || null;
  }

  // Salva metadata del backup
  private async saveBackupMetadata(metadata: BackupMetadata): Promise<void> {
    const metadataPath = join(this.config.backupPath, `${metadata.id}.metadata.json`);
    
    try {
      await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    } catch (error) {
      console.error('[Backup] Errore salvataggio metadata:', error);
    }
  }

  // Carica metadata di un backup
  async loadBackupMetadata(backupId: string): Promise<BackupMetadata | null> {
    const metadataPath = join(this.config.backupPath, `${backupId}.metadata.json`);
    
    try {
      const content = await readFile(metadataPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`[Backup] Errore caricamento metadata ${backupId}:`, error);
      return null;
    }
  }

  // Lista tutti i backup disponibili
  async listBackups(): Promise<BackupMetadata[]> {
    try {
      const files = await readdir(this.config.backupPath);
      const metadataFiles = files.filter(f => f.endsWith('.metadata.json'));
      
      const backups: BackupMetadata[] = [];
      
      for (const file of metadataFiles) {
        try {
          const content = await readFile(join(this.config.backupPath, file), 'utf-8');
          const metadata = JSON.parse(content);
          backups.push(metadata);
        } catch (error) {
          console.warn(`[Backup] Metadata corrotto: ${file}`);
        }
      }
      
      return backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      console.error('[Backup] Errore lista backup:', error);
      return [];
    }
  }

  // Pulisci backup vecchi
  async cleanupOldBackups(): Promise<{ deleted: number; freedSpace: number }> {
    try {
      const backups = await this.listBackups();
      const cutoffDate = new Date(Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000);
      
      let deleted = 0;
      let freedSpace = 0;
      
      for (const backup of backups) {
        if (new Date(backup.timestamp) < cutoffDate && backup.status === 'COMPLETED') {
          try {
            // Elimina file backup
            if (backup.filename) {
              const backupPath = join(this.config.backupPath, backup.filename);
              const stats = await stat(backupPath);
              await unlink(backupPath);
              freedSpace += stats.size;
            }
            
            // Elimina metadata
            const metadataPath = join(this.config.backupPath, `${backup.id}.metadata.json`);
            await unlink(metadataPath);
            
            deleted++;
            console.log(`[Backup] Eliminato backup obsoleto: ${backup.id}`);
          } catch (error) {
            console.warn(`[Backup] Errore eliminazione ${backup.id}:`, error);
          }
        }
      }
      
      // Mantieni solo gli ultimi N backup anche se non scaduti
      const remainingBackups = await this.listBackups();
      if (remainingBackups.length > this.config.maxBackups) {
        const toDelete = remainingBackups
          .slice(this.config.maxBackups)
          .filter(b => b.status === 'COMPLETED');
        
        for (const backup of toDelete) {
          try {
            if (backup.filename) {
              const backupPath = join(this.config.backupPath, backup.filename);
              const stats = await stat(backupPath);
              await unlink(backupPath);
              freedSpace += stats.size;
            }
            
            const metadataPath = join(this.config.backupPath, `${backup.id}.metadata.json`);
            await unlink(metadataPath);
            
            deleted++;
            console.log(`[Backup] Eliminato backup per limite: ${backup.id}`);
          } catch (error) {
            console.warn(`[Backup] Errore eliminazione ${backup.id}:`, error);
          }
        }
      }
      
      console.log(`[Backup] Pulizia completata: ${deleted} backup eliminati, ${this.formatSize(freedSpace)} liberati`);
      
      return { deleted, freedSpace };
    } catch (error) {
      console.error('[Backup] Errore pulizia backup:', error);
      return { deleted: 0, freedSpace: 0 };
    }
  }

  // Verifica integrità di un backup
  async verifyBackup(backupId: string): Promise<{
    valid: boolean;
    checksumMatch: boolean;
    fileExists: boolean;
    canDecompress: boolean;
    error?: string;
  }> {
    try {
      const metadata = await this.loadBackupMetadata(backupId);
      if (!metadata) {
        return {
          valid: false,
          checksumMatch: false,
          fileExists: false,
          canDecompress: false,
          error: 'Metadata non trovato'
        };
      }

      if (!metadata.filename) {
        return {
          valid: false,
          checksumMatch: false,
          fileExists: false,
          canDecompress: false,
          error: 'Backup fallito'
        };
      }

      const backupPath = join(this.config.backupPath, metadata.filename);
      
      // Verifica esistenza file
      try {
        await stat(backupPath);
      } catch {
        return {
          valid: false,
          checksumMatch: false,
          fileExists: false,
          canDecompress: false,
          error: 'File backup non trovato'
        };
      }

      // Verifica checksum
      const fileContent = await readFile(backupPath);
      const currentChecksum = createHash('sha256').update(fileContent).digest('hex');
      const checksumMatch = currentChecksum === metadata.checksum;

      // Verifica decompressione se compresso
      let canDecompress = true;
      if (metadata.compressed) {
        try {
          await gunzipAsync(fileContent);
        } catch {
          canDecompress = false;
        }
      }

      const valid = checksumMatch && canDecompress;

      return {
        valid,
        checksumMatch,
        fileExists: true,
        canDecompress,
        error: valid ? undefined : 'Backup corrotto'
      };

    } catch (error) {
      return {
        valid: false,
        checksumMatch: false,
        fileExists: false,
        canDecompress: false,
        error: error instanceof Error ? error.message : 'Errore verifica'
      };
    }
  }

  // Processo automatico di backup
  async runScheduledBackup(): Promise<{
    fullBackup?: BackupMetadata;
    incrementalBackup?: BackupMetadata;
    cleanup?: { deleted: number; freedSpace: number };
    error?: string;
  }> {
    try {
      console.log('[Backup] Inizio processo backup programmato');
      
      const results: any = {};
      
      // Determina se serve backup completo
      const needsFullBackup = !this.lastFullBackup || 
        (Date.now() - this.lastFullBackup.getTime()) > (this.config.fullBackupInterval * 60 * 60 * 1000);
      
      if (needsFullBackup) {
        console.log('[Backup] Esecuzione backup completo programmato');
        results.fullBackup = await this.createFullBackup('SCHEDULE');
      } else {
        // Solo backup incrementale
        console.log('[Backup] Esecuzione backup incrementale');
        results.incrementalBackup = await this.createIncrementalBackup();
      }
      
      // Pulizia backup vecchi
      results.cleanup = await this.cleanupOldBackups();
      
      console.log('[Backup] Processo backup programmato completato');
      return results;
      
    } catch (error) {
      console.error('[Backup] Errore processo backup programmato:', error);
      return {
        error: error instanceof Error ? error.message : 'Errore sconosciuto'
      };
    }
  }

  // Statistiche backup
  async getBackupStats(): Promise<{
    totalBackups: number;
    totalSize: number;
    oldestBackup: Date | null;
    newestBackup: Date | null;
    successRate: number;
    averageSize: number;
    averageDuration: number;
    byType: Record<string, number>;
    diskUsage: number;
  }> {
    try {
      const backups = await this.listBackups();
      
      if (backups.length === 0) {
        return {
          totalBackups: 0,
          totalSize: 0,
          oldestBackup: null,
          newestBackup: null,
          successRate: 0,
          averageSize: 0,
          averageDuration: 0,
          byType: {},
          diskUsage: 0
        };
      }
      
      const successful = backups.filter(b => b.status === 'COMPLETED');
      const totalSize = successful.reduce((sum, b) => sum + b.size, 0);
      const totalDuration = successful.reduce((sum, b) => sum + b.duration, 0);
      
      const byType = backups.reduce((acc, b) => {
        acc[b.type] = (acc[b.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      return {
        totalBackups: backups.length,
        totalSize,
        oldestBackup: new Date(backups[backups.length - 1]?.timestamp || 0),
        newestBackup: new Date(backups[0]?.timestamp || 0),
        successRate: (successful.length / backups.length) * 100,
        averageSize: successful.length > 0 ? totalSize / successful.length : 0,
        averageDuration: successful.length > 0 ? totalDuration / successful.length : 0,
        byType,
        diskUsage: totalSize
      };
      
    } catch (error) {
      console.error('[Backup] Errore statistiche:', error);
      throw error;
    }
  }

  // Utilità
  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  // Aggiorna configurazione
  updateConfig(newConfig: Partial<BackupConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('[Backup] Configurazione aggiornata:', this.config);
  }

  // Ottieni configurazione
  getConfig(): BackupConfig {
    return { ...this.config };
  }

  // Stato backup
  getStatus(): {
    isBackupInProgress: boolean;
    lastFullBackup: Date | null;
    lastIncrementalBackup: Date | null;
    nextScheduledBackup: Date | null;
  } {
    const nextScheduled = this.lastIncrementalBackup 
      ? new Date(this.lastIncrementalBackup.getTime() + this.config.incrementalInterval * 60 * 1000)
      : new Date(Date.now() + 5 * 60 * 1000); // 5 minuti se mai eseguito
    
    return {
      isBackupInProgress: this.isBackupInProgress,
      lastFullBackup: this.lastFullBackup,
      lastIncrementalBackup: this.lastIncrementalBackup,
      nextScheduledBackup: nextScheduled
    };
  }
}

// Istanza globale
export const databaseBackupManager = new DatabaseBackupManager();

// Job per esecuzione programmata
export async function runDatabaseBackupJob(): Promise<void> {
  try {
    // Solo durante orario di servizio o ogni 6 ore per backup completo
    const shouldRun = databaseBackupManager.getConfig().serviceHours 
      ? databaseBackupManager['isServiceHours']()
      : true;
    
    if (shouldRun) {
      await databaseBackupManager.runScheduledBackup();
    } else {
      console.log('[Backup] Backup saltato - fuori orario servizio');
    }
    
  } catch (error) {
    console.error('[Backup] Errore job backup:', error);
  }
}

// Backup di emergenza (da chiamare prima di operazioni critiche)
export async function createEmergencyBackup(): Promise<BackupMetadata> {
  console.log('[Backup] Backup di emergenza richiesto');
  return await databaseBackupManager.createFullBackup('EMERGENCY');
}
