import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Arena, ArenaFilterOptions, CreateArenaDto, UpdateArenaDto } from '../../app/interfaces/arena.model';
import { AdminArenaDto } from '../../app/interfaces/admin/admin-arena.model';

@Injectable({
  providedIn: 'root',
})
export class AdminArenaService {
  private readonly apiUrl = `${environment.apiUrl}/admin/arenas`;

  constructor(private http: HttpClient) {}

  getAllArenas(filters?: {
    name?: string;
    city?: string;
    sportType?: string;
  }): Observable<AdminArenaDto[]> {
    let params = new HttpParams();

    if (filters?.name?.trim()) {
      params = params.set('name', filters.name.trim());
    }

    if (filters?.city) {
      params = params.set('city', filters.city);
    }

    if (filters?.sportType) {
      params = params.set('sportType', filters.sportType);
    }

    return this.http.get<AdminArenaDto[]>(this.apiUrl, { params });
  }

  getFilterOptions(): Observable<ArenaFilterOptions> {
    return this.http.get<ArenaFilterOptions>(`${this.apiUrl}/filter-options`);
  }

  createArena(dto: CreateArenaDto): Observable<Arena> {
    return this.http.post<Arena>(this.apiUrl, dto);
  }

  updateArena(id: number, dto: UpdateArenaDto): Observable<Arena> {
    return this.http.put<Arena>(`${this.apiUrl}/${id}`, dto);
  }

  deleteArena(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  uploadArenaPicture(id: number, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${this.apiUrl}/${id}/upload-picture`, formData);
  }
}
