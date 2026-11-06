import { Component, ElementRef, signal, ViewChild } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { CommonModule } from '@angular/common';
import { BackupSyncService } from './core/services/backup-sync.service';
import { CustomerReportExportService } from './core/services/customer-report-export.service';

interface NavItem {
  path: string;
  icon: string;
  label: string;
  badge?: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule, MatRippleModule, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  @ViewChild('backupFileInput') backupFileInput?: ElementRef<HTMLInputElement>;

  sidebarCollapsed = signal(false);
  mobileOpen       = signal(false);
  backupStatus;

  today = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  navItems: NavItem[] = [
    { path: '/dashboard',  icon: 'home',             label: 'Home' },
    { path: '/customers',  icon: 'people',           label: 'Customers' },
    { path: '/reminders',  icon: 'chat',             label: 'WhatsApp Reminders' },
    { path: '/payments',   icon: 'payments',         label: 'Payments Collected' },
    { path: '/services',   icon: 'build',            label: 'Filter & Repairs' },
    { path: '/complaints', icon: 'report_problem',   label: 'Complaints' },
    { path: '/technicians', icon: 'engineering',      label: 'Technicians' },
    { path: '/plans',      icon: 'card_membership',  label: 'Rental Plans' },
  ];

  constructor(
    private backupSyncSvc: BackupSyncService,
    private exportSvc: CustomerReportExportService
  ) {
    this.backupStatus = this.backupSyncSvc.status;
  }

  toggleSidebar(): void {
    if (window.innerWidth <= 768) {
      this.sidebarCollapsed.update(v => !v);
    } else {
      this.sidebarCollapsed.update(v => !v);
    }
  }

  getBackupIcon(): string {
    return {
      idle: 'cloud_queue',
      running: 'sync',
      synced: 'cloud_done',
      queued: 'cloud_upload',
      error: 'cloud_off'
    }[this.backupStatus().state] ?? 'cloud_queue';
  }

  retryBackupSync(): void {
    void this.backupSyncSvc.retrySync();
  }

  saveBackupAndSync(): void {
    void (this.backupSyncSvc as any).saveBackupAndSync();
  }

  triggerBackupImport(): void {
    this.backupFileInput?.nativeElement.click();
  }

  handleBackupImport(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (file) {
      void this.backupSyncSvc.importBackupFile(file);
    }

    input.value = '';
  }

  exportCustomerReport(): void {
    void this.exportSvc.exportCustomerReport({
      fileName: 'customer-report.xlsx'
    });
  }
}
