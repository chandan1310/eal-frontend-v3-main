import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HoloserviceService } from '../services/holoservice.service';
import { Router } from '@angular/router';
import { FormsModule, FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { ToastService } from '../services/toast.service';
import { jwtDecode } from 'jwt-decode';
import { landingRoute } from '../guards/landing-route';
import * as CryptoJS from 'crypto-js';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule
  ],
  templateUrl: './login.component.html',
  providers: [HoloserviceService],
  styleUrls: [
    './login.component.css',
    'assets/css/main.css',
    'assets/css/util.css',
    'assets/vendor/bootstrap/css/bootstrap.min.css',
    'assets/fonts/font-awesome-4.7.0/css/font-awesome.min.css'
  ]
})
export class LoginComponent implements OnInit, AfterViewInit, OnDestroy {
  myLogin!: FormGroup;
  captchaCode: string = '';
  enteredCaptcha: string = '';
  parallaxStyle: string = '';
  isSubmitting: boolean = false;

  // OTP State Configuration Elements
  isOtpStep: boolean = false;
  enteredOtp: string = '';
  tempHashedUser: string = '';

  private retryTimer: any = null;

  @ViewChild('captchaCanvas', { static: false }) captchaCanvas?: ElementRef<HTMLCanvasElement>;

  constructor(
    private router: Router,
    private holoservice: HoloserviceService,
    private toastService: ToastService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    this.myLogin = new FormGroup({
      usrIDtxt: new FormControl('', [Validators.required, Validators.minLength(3)]),
      usrPWDtxt: new FormControl('', [Validators.required, Validators.minLength(4)]),
    });

    if (isPlatformBrowser(this.platformId)) {
      document.addEventListener('contextmenu', this.preventContextMenu);
    }
  }

  ngAfterViewInit(): void {
    this.ensureCaptchaDrawn(false);
  }

  ngOnDestroy(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
    if (isPlatformBrowser(this.platformId)) {
      document.removeEventListener('contextmenu', this.preventContextMenu);
    }
  }

  private preventContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  ensureCaptchaDrawn(clearInput: boolean): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const drawn = this.drawCaptcha(clearInput);
    if (!drawn) {
      if (this.retryTimer) clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(() => {
        this.drawCaptcha(clearInput);
      }, 100);
    }
  }

  private drawCaptcha(clearInput: boolean): boolean {
    const canvas = this.captchaCanvas?.nativeElement;
    if (!canvas) return false;

    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let result = '';
    const captchaLength = 6;

    for (let i = 0; i < captchaLength; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    this.captchaCode = result;
    if (clearInput) {
      this.enteredCaptcha = '';
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = `rgba(${Math.floor(Math.random() * 255)},${Math.floor(Math.random() * 255)},${Math.floor(Math.random() * 255)},0.6)`;
      ctx.beginPath();
      ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.stroke();
    }

    ctx.font = '24px Arial';
    ctx.fillStyle = '#000';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.captchaCode, 20, canvas.height / 2);

    return true;
  }

  generateCaptcha(): void {
    this.ensureCaptchaDrawn(true);
  }

  backToLoginForm(): void {
    this.isOtpStep = false;
    this.isSubmitting = false;
    this.enteredOtp = '';
    this.ensureCaptchaDrawn(true);
  }

  private sha512(value: string): string {
    return CryptoJS.SHA512(value.trim().toLowerCase()).toString(CryptoJS.enc.Hex);
  }

  onMouseMove(event: MouseEvent): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const x = (window.innerWidth / 2 - event.pageX) / 50;
    const y = (window.innerHeight / 2 - event.pageY) / 50;
    this.parallaxStyle = `translate(${x}px, ${y}px)`;
  }

  // STEP 1: Verify credentials and switch to OTP screen
  getLogin(): void {
    if (this.isSubmitting) return;

    if (this.enteredCaptcha.trim() !== this.captchaCode) {
      this.toastService.show('Invalid CAPTCHA', { class: 'danger' });
      this.generateCaptcha();
      return;
    }

    if (this.myLogin.invalid) {
      this.toastService.show('Please fill all fields correctly', { class: 'danger' });
      return;
    }

    const username = String(this.myLogin.get('usrIDtxt')?.value || '');
    const password = String(this.myLogin.get('usrPWDtxt')?.value || '');

    this.tempHashedUser = this.sha512(username);
    const hashedPassword = this.sha512(password);

    this.isSubmitting = true;

    this.holoservice.login(this.tempHashedUser, hashedPassword).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        console.log('Step 1 Server Response:', response);

        if (response?.requiresOtp) {
          this.isOtpStep = true;
          this.enteredOtp = '';
          this.toastService.show('OTP sent to your registered mobile number', { class: 'success' });
        } else {
          this.toastService.show('Unexpected error configuration detected', { class: 'danger' });
          this.generateCaptcha();
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        console.error('Login processing failed:', err);
        this.generateCaptcha();
        // 429 = API login rate limit (3 attempts per minute for the whole app) – not a wrong password
        const msg = err?.status === 429
          ? 'Too many login attempts. Please wait 1 minute and try again.'
          : (err?.error?.message || 'Invalid Username or Password');
        this.toastService.show(msg, { class: 'danger' });
      }
    });
  }

  // STEP 2: Handle Final OTP Verification
  verifyOtp(): void {
    if (this.isSubmitting) return;

    if (!this.enteredOtp || this.enteredOtp.trim().length < 4) {
      this.toastService.show('Please enter a valid OTP', { class: 'danger' });
      return;
    }

    this.isSubmitting = true;

    this.holoservice.verifyOtp(this.tempHashedUser, this.enteredOtp.trim()).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        if (response?.token) {
          this.handleSuccessfulLogin(response.token, response?.SupplierId);
        } else {
          this.toastService.show('Verification authorization rejected', { class: 'danger' });
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        console.error('OTP Validation Failure:', err);
        this.toastService.show(err?.error?.message || 'Invalid OTP or Verification Expired', { class: 'danger' });
      }
    });
  }

  private handleSuccessfulLogin(token: string, responseSupplierId?: any): void {
    this.holoservice.saveToken(token);

    const decodedToken: any = jwtDecode(token);
    console.log('Decoded Authenticated JWT Token Schema:', decodedToken);

    if (isPlatformBrowser(this.platformId)) {
      if (decodedToken?.SupplierId) {
        sessionStorage.setItem('SupplierId', String(decodedToken.SupplierId));
      } else if (responseSupplierId) {
        sessionStorage.setItem('SupplierId', String(responseSupplierId));
      }
    }

    this.toastService.show('Login successful!', { class: 'success' });
    this.navigateToLandingPage(decodedToken);
  }

  /**
   * Home for everyone, except roles whose only menu is Check Demand Raise (approval-level officers):
   * they land directly on Check Demand Raise.
   */
  private navigateToLandingPage(decodedToken: any): void {
    const roleId = Number(decodedToken?.RoleId || decodedToken?.roleId || 0);
    if (!roleId) { this.router.navigate(['/home']); return; }

    const norm = (u: any) => String(u || '').trim().replace(/^\/+/, '');
    this.holoservice.getDynamicMenus(roleId).subscribe({
      next: (menus: any) => {
        const urls: string[] = (Array.isArray(menus) ? menus : []).map((m: any) => norm(m.PageUrl)).filter(Boolean);
        if (isPlatformBrowser(this.platformId)) sessionStorage.setItem('allowed_routes', JSON.stringify(urls));
        this.router.navigate([landingRoute()]);
      },
      error: () => this.router.navigate(['/home'])
    });
  }
}

// import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
// import { HoloserviceService } from '../services/holoservice.service';
// import { Router } from '@angular/router';

// import { FormsModule, FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
// import {} from '@angular/common/http';
// import { ToastService } from '../services/toast.service';
// import { jwtDecode } from 'jwt-decode';
// import * as CryptoJS from 'crypto-js';

// import { ApplicationfromClComponent } from '../applicationfrom-cl/applicationfrom-cl.component';
// import { ApplicationfromCLFLComponent } from '../applicationfrom-clfl/applicationfrom-clfl.component';
// import { ApplicationformflComponent } from '../applicationform-fl/applicationform-fl.component';

// // @Component({
// //     selector: 'app-login',
// //     imports: [
// //         CommonModule, FormsModule,
// //         HttpClientModule, ReactiveFormsModule,
// //         ApplicationfromClComponent, ApplicationfromCLFLComponent, ApplicationformflComponent
// //     ],
// //     templateUrl: './login.component.html',
// //     providers: [HoloserviceService],
// //     styleUrls: [
// //         './login.component.css',
// //         'assets/css/main.css',
// //         'assets/css/util.css',
// //         'assets/vendor/bootstrap/css/bootstrap.min.css',
// //         'assets/fonts/font-awesome-4.7.0/css/font-awesome.min.css',
// //     ]
// // })
// @Component({
//     selector: 'app-login',
//     standalone: true, 
//     imports: [
//     FormsModule,
//     ReactiveFormsModule
// ],
//     templateUrl: './login.component.html',
//     providers: [HoloserviceService],
//     styleUrls: [
//         './login.component.css',
//         'assets/css/main.css',
//         'assets/css/util.css',
//         'assets/vendor/bootstrap/css/bootstrap.min.css',
//         'assets/fonts/font-awesome-4.7.0/css/font-awesome.min.css'
//     ]
// })
// export class LoginComponent implements OnInit, AfterViewInit {
//   myLogin!: FormGroup;
//   captchaCode: string = '';
//   enteredCaptcha: string = '';
//   parallaxStyle: string = '';
  
//   // 🔐 OTP State Configuration Elements
//   isOtpStep: boolean = false;
//   enteredOtp: string = '';
//   tempHashedUser: string = ''; 

//   @ViewChild('captchaCanvas', { static: false }) captchaCanvas!: ElementRef<HTMLCanvasElement>;

//   constructor(
//     private Routes: Router,
//     private holoservice: HoloserviceService,
//     private toastService: ToastService
//   ) { }

//   ngOnInit(): void {
//     this.myLogin = new FormGroup({
//       usrIDtxt: new FormControl('', [Validators.required, Validators.minLength(4)]),
//       usrPWDtxt: new FormControl('', [Validators.required, Validators.minLength(4)]),
//     });

//     document.addEventListener('contextmenu', (event) => event.preventDefault());
//     // document.addEventListener('keydown', (event) => {
//     //   if (event.key === 'F12') event.preventDefault();
//     //   if ((event.ctrlKey && event.shiftKey && (event.key === 'I' || event.key === 'J')) ||
//     //     (event.ctrlKey && event.key === 'U')) event.preventDefault();
//     //   if (event.ctrlKey && ['c', 'v', 'x', 'a'].includes(event.key.toLowerCase()))
//     //     event.preventDefault();
//     // });
//   }

//   ngAfterViewInit(): void {
//     this.generateCaptcha();
//   }

//   disableRightClick(event: MouseEvent) {
//     event.preventDefault();
//   }

//   generateCaptcha() {
//     const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
//     let result = '';
//     const captchaLength = 6;

//     for (let i = 0; i < captchaLength; i++) {
//       result += chars.charAt(Math.floor(Math.random() * chars.length));
//     }

//     this.captchaCode = result;
//     this.enteredCaptcha = '';

//     const canvas = this.captchaCanvas.nativeElement;
//     const ctx = canvas.getContext('2d');
//     if (ctx) {
//       ctx.clearRect(0, 0, canvas.width, canvas.height);
//       ctx.fillStyle = '#f2f2f2';
//       ctx.fillRect(0, 0, canvas.width, canvas.height);

//       for (let i = 0; i < 5; i++) {
//         ctx.strokeStyle = `rgba(${Math.floor(Math.random() * 255)},${Math.floor(Math.random() * 255)},${Math.floor(Math.random() * 255)},0.6)`;
//         ctx.beginPath();
//         ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
//         ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
//         ctx.stroke();
//       }

//       ctx.font = '24px Arial';
//       ctx.fillStyle = '#000';
//       ctx.textBaseline = 'middle';
//       ctx.fillText(this.captchaCode, 20, canvas.height / 2);
//     }
//   }

//   private sha512(value: string): string {
//     return CryptoJS.SHA512(value.trim().toLowerCase()).toString(CryptoJS.enc.Hex);
//   }

//   onMouseMove(event: MouseEvent) {
//     const x = (window.innerWidth / 2 - event.pageX) / 50;
//     const y = (window.innerHeight / 2 - event.pageY) / 50;
//     this.parallaxStyle = `translate(${x}px, ${y}px)`;
//   }

//   // STEP 1: Verify credentials and navigate to OTP screen
//   getLogin() {
//     if (this.enteredCaptcha !== this.captchaCode) {
//       this.toastService.show('Invalid CAPTCHA', { class: 'danger' });
//       this.generateCaptcha();
//       return;
//     }

//     if (this.myLogin.invalid) {
//       this.toastService.show('Please fill all fields correctly', { class: 'danger' });
//       return;
//     }

//     const username = this.myLogin.get('usrIDtxt')?.value;
//     const password = this.myLogin.get('usrPWDtxt')?.value;

//     this.tempHashedUser = this.sha512(username);
//     const hashedPassword = this.sha512(password);

//     this.holoservice.login(this.tempHashedUser, hashedPassword).subscribe({
//       next: (response) => {
//         // console.log('Step 1 Server Response:', response);

//         if (response?.requiresOtp) {
//           // Switch display layouts seamlessly
//           this.isOtpStep = true;
//           this.toastService.show('OTP sent to your registered mobile number', { class: 'success' });
//         } else {
//           this.toastService.show('Unexpected error configuration detected', { class: 'danger' });
//           this.generateCaptcha();
//         }
//       },
//       error: (err) => {
//         this.generateCaptcha();
//         this.toastService.show('Invalid Username or Password', { class: 'danger' });
//         console.error('Login processing failed:', err);
//       }
//     });
//   }

//   // STEP 2: Handle Final OTP Verification
//   verifyOtp() {
//     if (!this.enteredOtp || this.enteredOtp.length < 4) {
//       this.toastService.show('Please enter a valid OTP', { class: 'danger' });
//       return;
//     }

//     this.holoservice.verifyOtp(this.tempHashedUser, this.enteredOtp).subscribe({
//       next: (response) => {
//         if (response?.token) {
//           this.handleSuccessfulLogin(response.token, response?.SupplierId);
//         } else {
//           this.toastService.show('Verification authorization rejected', { class: 'danger' });
//         }
//       },
//       error: (err) => {
//         this.toastService.show('Invalid OTP or Verification Expired', { class: 'danger' });
//         console.error('OTP Validation Failure:', err);
//       }
//     });
//   }

//   private handleSuccessfulLogin(token: string, responseSupplierId?: any) {
//     this.holoservice.saveToken(token);
    
//     const decodedToken: any = jwtDecode(token);
//     // console.log('Decoded Authenticated JWT Token Schema:', decodedToken);
    
//     if (decodedToken.SupplierId) {
//       sessionStorage.setItem('SupplierId', decodedToken.SupplierId);
//     } else if (responseSupplierId) {
//       sessionStorage.setItem('SupplierId', responseSupplierId); 
//     }

//     this.toastService.show('Login successful!', { class: 'success' });
//     this.Routes.navigate(['/home']);
//   }
// }

