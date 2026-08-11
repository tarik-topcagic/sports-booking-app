import { Component, OnInit } from '@angular/core';
import { UserService } from '../../services/user.service';
import { User } from '../interfaces/user';
import { NgIf } from '@angular/common';
import { NavbarComponent } from '../navbar/navbar.component';
import { RouterModule } from '@angular/router';
import { TranslatePipe } from '../pipes/translate.pipe';
import { SkeletonComponent } from '../skeleton/skeleton/skeleton.component';
import { LoadErrorStateComponent } from '../load-error-state/load-error-state.component';

@Component({
  selector: 'app-profile',
  imports: [NgIf, NavbarComponent, RouterModule, TranslatePipe, SkeletonComponent, LoadErrorStateComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  userProfile: User | null = null;
  timestamp = Date.now();
  isLoading = true;
  errorMessage = '';

  constructor(private userService: UserService) {}

  ngOnInit(): void {
    this.timestamp = Date.now();
    this.loadProfile();
  }

  loadProfile(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.userService.getMyProfile().subscribe({
      next: (data) => {
        this.userProfile = data;
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = 'profileLoadError';
      },
    });
  }

  handleImageError(): void {
    if (this.userProfile) {
      this.userProfile.profilePictureUrl = null;
    }
  }
}
