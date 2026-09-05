import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { catchError, map, Observable, of, take } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private router: Router,
  ) {}

  canActivate(
    next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Observable<boolean> | Promise<boolean> | boolean {

    if (!this.authService.currentUserValue) {
      this.router.navigate(['/login']);
      return false;
    }

    if (this.userService.cityConfirmedThisSession) {
      return true;
    }

    return this.userService.getMyProfile().pipe(
      take(1),
      map((profile) => {
        const needsCity = profile.cityId == null;

        if (!needsCity) {
          this.userService.cityConfirmedThisSession = true;
          return true;
        }

        if (state.url.startsWith('/profile/edit')) {
          return true;
        }

        this.router.navigate(['/profile/edit'], { queryParams: { onboarding: 'true' } });
        return false;
      }),
      catchError(() => of(true)),
    );
  }
}
