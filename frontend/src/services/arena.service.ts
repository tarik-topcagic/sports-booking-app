import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';
import { Arena } from '../app/interfaces/arena.model';

export interface ArenaFilterOptions {
  cities: string[];
  sports: string[];
}

@Injectable({
  providedIn: 'root',
})
export class ArenaService {
  private readonly apiUrl = `${environment.apiUrl}/arenas`;

  constructor(private http: HttpClient) {}

  getArenas(filters?: {
    city?: string;
    sportType?: string;
    searchTerm?: string;
  }): Observable<Arena[]> {
    let params = new HttpParams();

    if (filters?.city) {
      params = params.set('city', filters.city);
    }

    if (filters?.sportType) {
      params = params.set('sportType', filters.sportType);
    }

    if (filters?.searchTerm?.trim()) {
      params = params.set('searchTerm', filters.searchTerm.trim());
    }

    return this.http.get<Arena[]>(this.apiUrl, { params });
  }

  getArenaById(id: number): Observable<Arena> {
    return this.http.get<Arena>(`${this.apiUrl}/${id}`);
  }

  getFilterOptions(): Observable<ArenaFilterOptions> {
    return this.http.get<ArenaFilterOptions>(`${this.apiUrl}/filter-options`);
  }
}
