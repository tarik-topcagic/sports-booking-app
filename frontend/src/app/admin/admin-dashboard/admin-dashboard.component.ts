import { Component } from '@angular/core';
import { NgFor } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [NgFor, RouterModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
})
export class AdminDashboardComponent {
  readonly sections = [
    {
      title: 'Users',
      description: 'View all users, lock or unlock accounts.',
      icon: 'bi-people',
      link: '/admin/users',
    },
    {
      title: 'Groups',
      description: 'View all groups, edit, delete or manage members.',
      icon: 'bi-collection',
      link: '/admin/groups',
    },
    {
      title: 'Arenas',
      description: 'Create, edit or delete sports arenas.',
      icon: 'bi-geo-alt',
      link: '/admin/arenas',
    },
    {
      title: 'Reservations',
      description: 'View all reservations and cancel if needed.',
      icon: 'bi-calendar-check',
      link: '/admin/reservations',
    },
    {
      title: 'Notifications',
      description: 'View and delete system notifications.',
      icon: 'bi-bell',
      link: '/admin/notifications',
    },
    {
      title: 'Cities',
      description: 'View, add or delete cities.',
      icon: 'bi-map',
      link: '/admin/cities',
    },
  ];
}
