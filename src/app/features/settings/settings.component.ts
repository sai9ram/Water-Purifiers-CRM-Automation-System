import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { BackupSyncService } from '../../core/services/backup-sync.service';
import { CustomerReportExportService } from '../../core/services/customer-report-export.service';
import { RealtimeCrmService } from '../../core/services/realtime-crm.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatSnackBarModule],
  template: `
    <div class="page-container fade-in">
      <div class="page-header">
        <div>
          <h2>Settings & Data Backup</h2>
          <p class="subtitle">Manage database backups, restore data files, and download Excel reports</p>
        </div>
      </div>

      <div class="settings-grid">
        <!-- Card 1: Save Backup -->
        <div class="setting-card">
          <div class="setting-icon icon-blue">
            <mat-icon>{{ getBackupIcon() }}</mat-icon>
          </div>
          <div class="setting-info">
            <h3>Save Backup File</h3>
            <p>Download a complete SQL backup file of all your customers, plans, payments, services, and complaints.</p>
          </div>
          <button
            class="setting-action-btn"
            type="button"
            (click)="saveBackupAndSync()"
            [disabled]="backupStatus().state === 'running'">
            <mat-icon>{{ getBackupIcon() }}</mat-icon>
            <span>{{ backupStatus().state === 'running' ? 'Saving...' : 'Save Backup' }}</span>
          </button>
        </div>

        <!-- Card 2: Open / Restore Backup -->
        <div class="setting-card">
          <div class="setting-icon icon-amber">
            <mat-icon>upload_file</mat-icon>
          </div>
          <div class="setting-info">
            <h3>Open & Restore Backup</h3>
            <p>Upload a previously saved <code>.sql</code> backup file to restore your customer and payment records.</p>
          </div>
          <button
            class="setting-action-btn"
            type="button"
            (click)="triggerBackupImport()">
            <mat-icon>upload_file</mat-icon>
            <span>Open Backup</span>
          </button>
          <input #backupFileInput type="file" accept=".sql,.txt" hidden (change)="handleBackupImport($event)" />
        </div>

        <!-- Card 3: Download Excel Report -->
        <div class="setting-card">
          <div class="setting-icon icon-green">
            <mat-icon>download</mat-icon>
          </div>
          <div class="setting-info">
            <h3>Download Excel Report</h3>
            <p>Export all customer details, monthly rent history, and service records into an Excel spreadsheet.</p>
          </div>
          <button
            class="setting-action-btn btn-green"
            type="button"
            (click)="exportCustomerReport()">
            <mat-icon>download</mat-icon>
            <span>Download Excel</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .settings-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 12px;
      margin-top: 8px;
    }
    .setting-card {
      background: #ffffff;
      border: 1px solid var(--border-clean);
      border-radius: var(--radius-box);
      padding: 16px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 12px;
      box-shadow: var(--shadow-card);
    }
    .setting-icon {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .setting-icon mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .icon-blue {
      background: #e0f2fe;
      color: #0284c7;
    }
    .icon-amber {
      background: #fef3c7;
      color: #d97706;
    }
    .icon-green {
      background: #dcfce7;
      color: #16a34a;
    }
    .setting-info h3 {
      margin: 0 0 4px;
      font-size: 0.86rem;
      font-weight: 700;
      color: var(--text-main);
    }
    .setting-info p {
      margin: 0;
      font-size: 0.74rem;
      color: var(--text-muted);
      line-height: 1.45;
    }
    .setting-action-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      height: 32px;
      padding: 0 14px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--border-clean);
      background: #ffffff;
      color: var(--text-main);
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.12s ease;
      align-self: flex-start;
    }
    .setting-action-btn mat-icon {
      font-size: 15px;
      width: 15px;
      height: 15px;
      color: var(--text-muted);
    }
    .setting-action-btn:hover:not(:disabled) {
      background: #f8fafc;
      border-color: #cbd5e1;
    }
    .setting-action-btn.btn-green {
      background: #f0fdf4;
      border-color: #bbf7d0;
      color: #15803d;
    }
    .setting-action-btn.btn-green mat-icon {
      color: #16a34a;
    }
    .setting-action-btn.btn-green:hover {
      background: #dcfce7;
    }
  `]
})
export class SettingsComponent {
  @ViewChild('backupFileInput') backupFileInput?: ElementRef<HTMLInputElement>;

  private readonly backupSyncSvc = inject(BackupSyncService);
  private readonly exportSvc = inject(CustomerReportExportService);
  private readonly crm = inject(RealtimeCrmService);
  private readonly snack = inject(MatSnackBar);

  readonly backupStatus = this.backupSyncSvc.status;

  getBackupIcon(): string {
    return {
      idle: 'cloud_queue',
      running: 'sync',
      synced: 'cloud_done',
      queued: 'cloud_upload',
      error: 'cloud_off'
    }[this.backupStatus().state] ?? 'cloud_queue';
  }

  saveBackupAndSync(): void {
    void this.backupSyncSvc.saveBackupAndSync().then(() => {
      this.snack.open('Backup file saved!', 'OK', { duration: 3000 });
    });
  }

  triggerBackupImport(): void {
    this.backupFileInput?.nativeElement.click();
  }

  handleBackupImport(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (file) {
      void this.backupSyncSvc.importBackupFile(file).then(() => {
        this.crm.invalidateAndRefresh();
        this.snack.open(`Restored backup from ${file.name}`, 'OK', { duration: 3500 });
      });
    }

    input.value = '';
  }

  exportCustomerReport(): void {
    void this.exportSvc.exportCustomerReport({
      fileName: 'aqua-purifier-rentals-report.xlsx'
    });
  }
}
