import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { City } from '../../app/interfaces/city';

export interface CreateCityDto {
  name: string;
  canton: string;
}

@Injectable({
  providedIn: 'root',
})
export class AdminCityService {
  private readonly apiUrl = `${environment.apiUrl}/admin/cities`;

  constructor(private http: HttpClient) {}

  getAllCities(): Observable<City[]> {
    return this.http.get<City[]>(this.apiUrl);
  }

  createCity(dto: CreateCityDto): Observable<City> {
    return this.http.post<City>(this.apiUrl, dto);
  }

  deleteCity(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
