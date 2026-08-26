import { Component, OnInit } from '@angular/core';
import { UserService } from '../../services/user.service';
import { tap } from 'rxjs';
import { User } from '../interfaces/user';
import { NgIf } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslatePipe } from '../pipes/translate.pipe';
import { SkeletonComponent } from '../skeleton/skeleton/skeleton.component';
import { LoadErrorStateComponent } from '../load-error-state/load-error-state.component';

@Component({
  selector: 'app-profile',
  imports: [NgIf, RouterModule, TranslatePipe, SkeletonComponent, LoadErrorStateComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  userProfile: User | null = null;
  timestamp = Date.now();

  constructor(private userService: UserService) {}

  ngOnInit(): void {
    this.timestamp = Date.now();
  }

  loadProfile = () => this.userService.getMyProfile().pipe(
    tap((data) => {
      this.userProfile = data;
    }),
  );

  handleImageError(): void {
    if (this.userProfile) {
      this.userProfile.profilePictureUrl = null;
    }
  }
}
