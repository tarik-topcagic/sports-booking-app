import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';
import { City } from '../app/interfaces/city';
import { Observable, shareReplay } from 'rxjs';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class CityService {
  private apiUrl = environment.apiUrl + '/cities';
  private cities$: Observable<City[]> | null = null;

  constructor(private http: HttpClient) {}

  getCities(): Observable<City[]> {
    if (!this.cities$) {
      this.cities$ = this.http.get<City[]>(`${this.apiUrl}/get-cities`).pipe(
        shareReplay(1),
      );
    }
    return this.cities$;
  }

  invalidateCache(): void {
    this.cities$ = null;
  }
}
