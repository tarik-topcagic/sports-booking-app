import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';
import { City } from '../app/interfaces/city';
import { Observable } from 'rxjs';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class CityService {
  private apiUrl = environment.apiUrl + '/cities';

  constructor(private http: HttpClient) {}

  getCities(): Observable<City[]> {
    return this.http.get<City[]>(`${this.apiUrl}/get-cities`);
  }
}
