import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, switchMap } from 'rxjs';
import { User } from '../app/interfaces/user';

export interface UserSettings {
  username: string;
  email: string;
  phoneNumber: string;
  emailNotificationsEnabled: boolean;
  languagePreference: string;
}

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private apiUrl = environment.apiUrl + '/users';

  private profileRefresh = new BehaviorSubject<void>(undefined);

  constructor(private http: HttpClient) {}

  getMyProfile(): Observable<User> {
    return this.profileRefresh.pipe(
      switchMap(() => this.http.get<User>(`${this.apiUrl}/my-profile`)),
    );
  }

  refreshProfile(): void {
    this.profileRefresh.next();
  }

  updateProfile(data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/update-user`, data);
  }

  getSettings(): Observable<UserSettings> {
    return this.http.get<UserSettings>(`${this.apiUrl}/settings`);
  }

  updateEmailNotifications(emailNotificationsEnabled: boolean): Observable<any> {
    return this.http.put(`${this.apiUrl}/settings/email-notifications`, {
      emailNotificationsEnabled,
    });
  }

  updateLanguagePreference(languagePreference: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/settings/language`, {
      languagePreference,
    });
  }

  updateUsername(username: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/settings/username`, {
      username,
    });
  }

  uploadProfilePicture(formData: FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}/upload-profile-picture`, formData);
  }

  deleteProfilePicture(): Observable<any> {
    return this.http.delete(`${this.apiUrl}/delete-profile-picture`);
  }

  getUserProfileByUsername(username: string): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${encodeURIComponent(username)}`);
  }

  searchUsers(query: string = ''): Observable<User[]> {
    let url = `${this.apiUrl}/get-users`;
    if (query.trim()) {
      url += `?query=${encodeURIComponent(query.trim())}`;
    }
    return this.http.get<User[]>(url);
  }
}
