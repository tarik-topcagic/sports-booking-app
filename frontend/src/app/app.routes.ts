import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { PendingChangesGuard } from './guards/pending-changes.guard';

export const routes: Routes = [
    {
      path: '',
      loadComponent: () => import('./home/home.component').then((module) => module.HomeComponent),
    },
    {
      path: 'register',
      loadComponent: () => import('./register/register.component').then((module) => module.RegisterComponent),
    },
    {
      path: 'login',
      loadComponent: () => import('./login/login.component').then((module) => module.LoginComponent),
    },
    {
      path: 'home',
      loadComponent: () => import('./dashboard/dashboard.component').then((module) => module.DashboardComponent),
      canActivate: [AuthGuard],
    },
    {
      path: 'profile',
      loadComponent: () => import('./profile/profile.component').then((module) => module.ProfileComponent),
      canActivate: [AuthGuard],
    },
    {
      path: 'profile/edit',
      loadComponent: () => import('./profile-edit/profile-edit.component').then((module) => module.ProfileEditComponent),
      canActivate: [AuthGuard],
      canDeactivate: [PendingChangesGuard],
    },
    {
      path: 'settings',
      loadComponent: () => import('./settings/settings.component').then((module) => module.SettingsComponent),
      canActivate: [AuthGuard],
    },
    {
      path: 'users',
      loadComponent: () => import('./search-users/search-users.component').then((module) => module.SearchUsersComponent),
      canActivate: [AuthGuard],
    },
    {
      path: 'users/:username',
      loadComponent: () => import('./user-profile/user-profile.component').then((module) => module.UserProfileComponent),
      canActivate: [AuthGuard],
    },
    {
      path: 'sports-arenas',
      loadComponent: () => import('./sports-arenas/sports-arenas.component').then((module) => module.SportsArenasComponent),
      canActivate: [AuthGuard],
    },
    {
      path: 'sports-arenas/:id',
      loadComponent: () => import('./arena-details/arena-details.component').then((module) => module.ArenaDetailsComponent),
      canActivate: [AuthGuard],
    },
    {
      path: 'payment',
      loadComponent: () => import('./reservation-payment/reservation-payment.component').then((module) => module.ReservationPaymentComponent),
      canActivate: [AuthGuard],
    },
    {
      path: 'my-reservations',
      loadComponent: () => import('./my-reservations/my-reservations.component').then((module) => module.MyReservationsComponent),
      canActivate: [AuthGuard],
    },
    {
      path: 'groups',
      loadComponent: () => import('./search-groups/search-groups.component').then((module) => module.SearchGroupsComponent),
      canActivate: [AuthGuard],
    },
    {
      path: 'groups/:id',
      loadComponent: () => import('./group-details/group-details.component').then((module) => module.GroupDetailsComponent),
      canActivate: [AuthGuard],
    },
    {
      path: 'groups/:id/chat',
      loadComponent: () => import('./group-chat/group-chat.component').then((module) => module.GroupChatComponent),
      canActivate: [AuthGuard],
    },
    {
      path: 'notifications',
      loadComponent: () => import('./notifications/notifications.component').then((module) => module.NotificationsComponent),
      canActivate: [AuthGuard],
    },
    {
      path: 'messages',
      loadComponent: () => import('./messages/messages.component').then((module) => module.MessagesComponent),
      canActivate: [AuthGuard],
    },
    {
      path: 'messages/private/user/:userId',
      loadComponent: () => import('./private-chat/private-chat.component').then((module) => module.PrivateChatComponent),
      canActivate: [AuthGuard],
    },
    {
      path: 'messages/private/:conversationId',
      loadComponent: () => import('./private-chat/private-chat.component').then((module) => module.PrivateChatComponent),
      canActivate: [AuthGuard],
    },
    {
      path: 'admin',
      loadComponent: () => import('./admin/admin-dashboard/admin-dashboard.component').then((module) => module.AdminDashboardComponent),
      canActivate: [AuthGuard, AdminGuard],
    },
    {
      path: 'admin/users',
      loadComponent: () => import('./admin/admin-users/admin-users.component').then((module) => module.AdminUsersComponent),
      canActivate: [AuthGuard, AdminGuard],
    },
    {
      path: 'admin/groups',
      loadComponent: () => import('./admin/admin-groups/admin-groups.component').then((module) => module.AdminGroupsComponent),
      canActivate: [AuthGuard, AdminGuard],
    },
    {
      path: 'admin/arenas',
      loadComponent: () => import('./admin/admin-arenas/admin-arenas.component').then((module) => module.AdminArenasComponent),
      canActivate: [AuthGuard, AdminGuard],
    },
    {
      path: 'admin/arenas/new',
      loadComponent: () => import('./admin/admin-arenas/admin-arenas.component').then((module) => module.AdminArenasComponent),
      canActivate: [AuthGuard, AdminGuard],
    },
    {
      path: 'admin/arenas/:id/edit',
      loadComponent: () => import('./admin/admin-arenas/admin-arenas.component').then((module) => module.AdminArenasComponent),
      canActivate: [AuthGuard, AdminGuard],
    },
    {
      path: 'admin/reservations',
      loadComponent: () => import('./admin/admin-reservations/admin-reservations.component').then((module) => module.AdminReservationsComponent),
      canActivate: [AuthGuard, AdminGuard],
    },
    {
      path: 'admin/notifications',
      loadComponent: () => import('./admin/admin-notifications/admin-notifications.component').then((module) => module.AdminNotificationsComponent),
      canActivate: [AuthGuard, AdminGuard],
    },
    { path: 'registracija', redirectTo: 'register', pathMatch: 'full' },
    { path: 'prijava', redirectTo: 'login', pathMatch: 'full' },
    { path: 'pocetna', redirectTo: 'home', pathMatch: 'full' },
    { path: 'moj-profil', redirectTo: 'profile', pathMatch: 'full' },
    { path: 'postavke-profila', redirectTo: 'profile/edit', pathMatch: 'full' },
    { path: 'postavke', redirectTo: 'settings', pathMatch: 'full' },
    { path: 'pretraga-korisnika', redirectTo: 'users', pathMatch: 'full' },
    { path: 'sportski-tereni', redirectTo: 'sports-arenas', pathMatch: 'full' },
    { path: 'placanje', redirectTo: 'payment', pathMatch: 'full' },
    { path: 'moje-rezervacije', redirectTo: 'my-reservations', pathMatch: 'full' },
    { path: 'korisnicki-profil/:username', redirectTo: 'users/:username', pathMatch: 'full' },
    { path: 'grupe', redirectTo: 'groups', pathMatch: 'full' },
    { path: 'grupe/:id', redirectTo: 'groups/:id', pathMatch: 'full' },
    { path: 'grupe/:id/chat', redirectTo: 'groups/:id/chat', pathMatch: 'full' },
    { path: 'obavijesti', redirectTo: 'notifications', pathMatch: 'full' },
    { path: 'poruke', redirectTo: 'messages', pathMatch: 'full' },
    { path: 'poruke/privatno/:conversationId', redirectTo: 'messages/private/:conversationId', pathMatch: 'full' },
    { path: '**', redirectTo: '' }
];
