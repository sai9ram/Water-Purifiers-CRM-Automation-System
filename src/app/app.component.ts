import { Component, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { CommonModule } from '@angular/common';

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
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  sidebarCollapsed = signal(false);
  mobileOpen       = signal(false);

  today = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  navItems: NavItem[] = [
    { path: '/dashboard',  icon: 'dashboard',       label: 'Dashboard'   },
    { path: '/customers',  icon: 'people',           label: 'Customers'   },
    { path: '/reminders',  icon: 'notifications',    label: 'Reminders'   },
    { path: '/services',   icon: 'build',            label: 'Services'    },
    { path: '/plans',      icon: 'card_membership',  label: 'Plans'       },
  ];

  toggleSidebar(): void {
    if (window.innerWidth <= 768) {
      this.sidebarCollapsed.update(v => !v);
    } else {
      this.sidebarCollapsed.update(v => !v);
    }
  }
}
