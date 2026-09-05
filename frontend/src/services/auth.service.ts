import { Injectable } from "@angular/core";
import { environment } from "../environments/environment";
import { HttpClient } from "@angular/common/http";
import { BehaviorSubject, map, Observable } from "rxjs";
import { UserService } from "./user.service";

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private apiUrl = environment.apiUrl + '/auth';
    private currentUserSubject: BehaviorSubject<any>;
    public currentUser: Observable<any>;

    constructor(private http: HttpClient, private userService: UserService) {
        this.currentUserSubject = new BehaviorSubject<any>(JSON.parse(localStorage.getItem('user')!));
        this.currentUser = this.currentUserSubject.asObservable();
    }

    register(model: any) {
        console.log(model);
        return this.http.post<any>(`${this.apiUrl}/register`, model);
    }

    login(model: any) {
        return this.http.post<any>(`${this.apiUrl}/login`, model).pipe(
          map(user => {
            if (user && user.token) {
              localStorage.setItem('user', JSON.stringify(user));
              this.currentUserSubject.next(user);
            }
            return user;
          })
        );
    }

    logout() {
        localStorage.removeItem('user');
        this.currentUserSubject.next(null);
        this.userService.resetCityCheck();
    }

    updateCurrentUser(data: any) {
        const currentUser = this.currentUserSubject.value;
        if (!currentUser) {
            return;
        }

        const updatedUser = { ...currentUser, ...data };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        this.currentUserSubject.next(updatedUser);
    }

    updateCurrentUsername(username: string) {
        this.updateCurrentUser({ username });
    }

    get currentUserValue(): any {
        return this.currentUserSubject.value;
    }
}
