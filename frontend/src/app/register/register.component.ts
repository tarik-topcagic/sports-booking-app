import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '../pipes/translate.pipe';
import { LanguageService } from '../../services/language.service';

@Component({
  selector: 'app-register',
  imports: [FormsModule, CommonModule, RouterLink, TranslatePipe],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent implements OnInit, OnDestroy {
  registerModel = {
    fullName: '',
    email: '',
    phoneNumber: '',
    username: '',
    password: ''
  };

  passwordStrengthError = false;
  passwordVisible: boolean = false;
  usernameTakenError = false;
  emailTakenError = false;
  phoneNumberTakenError = false;
  usernameSpaceError = false;
  isLoading = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private languageService: LanguageService,
  ) {}
  
  ngOnInit(): void {
    document.body.classList.add('register-page');
  }

  validateUsername(): void {
    this.usernameTakenError = false;
    this.usernameSpaceError = false;
    const username = this.registerModel.username || '';
    const spaceRegex = /\s/;  

    if (spaceRegex.test(username)) {
      this.usernameSpaceError = true;
    }
  }

  validatePassword(): void {
    this.passwordStrengthError = false;  
    const password = this.registerModel.password || '';  
    const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*]).{6,}$/;  
    const spaceRegex = /\s/;  

    if (spaceRegex.test(password)) {
      this.passwordStrengthError = true;  
    } else if (password.length < 6) {
      this.passwordStrengthError = true;  
    } else if (!passwordRegex.test(password)) {
      this.passwordStrengthError = true;  
    }
  }

  clearEmailTakenError(): void {
    this.emailTakenError = false;
  }

  clearPhoneNumberTakenError(): void {
    this.phoneNumberTakenError = false;
  }

  register(form: NgForm) {
    if (form.invalid || this.passwordStrengthError || this.usernameSpaceError) {
      return;
    }

    this.usernameTakenError = false;
    this.emailTakenError = false;
    this.phoneNumberTakenError = false;
    this.isLoading = true;

    this.authService.register(this.registerModel).subscribe({
      next: (response) => {
        this.authService.login({ username: this.registerModel.username, password: this.registerModel.password })
          .subscribe({
            next: () => {
              this.languageService.syncLanguageFromBackend().subscribe(() => {
                this.isLoading = false;
                this.router.navigate(['/profile/edit'], { queryParams: { onboarding: 'true' } });
              });
            },
            error: (error) => {
              this.isLoading = false;
              console.error('Login error:', error);
            }
          });
      },
      error: (error) => {
        this.isLoading = false;

        if (error.error?.field === 'username' || error.error?.message === "Username is already taken.") {
          this.usernameTakenError = true;
        }
        if (error.error?.field === 'email') {
          this.emailTakenError = true;
        }
        if (error.error?.field === 'phoneNumber') {
          this.phoneNumberTakenError = true;
        }
        console.error('Registration error:', error);
        console.log('Full error details:', error.error);
      }
    });
  }

  togglePasswordVisibility() {
    this.passwordVisible = !this.passwordVisible;
  }

  ngOnDestroy(): void {
    document.body.classList.remove('register-page');
  }
}
