import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';
import { Canton } from '../app/interfaces/canton';
import { Observable, shareReplay } from 'rxjs';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class CantonService {
  private apiUrl = environment.apiUrl + '/cantons';
  private cantons$: Observable<Canton[]> | null = null;

  constructor(private http: HttpClient) {}

  getCantons(): Observable<Canton[]> {
    if (!this.cantons$) {
      this.cantons$ = this.http.get<Canton[]>(`${this.apiUrl}/get-cantons`).pipe(
        shareReplay(1),
      );
    }
    return this.cantons$;
  }
}
