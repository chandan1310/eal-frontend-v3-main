import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  toasts: any[] = [];

  // Show toast message
  show(message: string, options: any = {}) {
    this.toasts.push({ message, ...options });
    setTimeout(() => this.remove(this.toasts[0]), 1200); // Auto close in 5s
  }

  // Show error toast message
  showError(message: string) {
    this.show(message, { classname: 'bg-danger text-light' });
  }

  // Remove toast
  remove(toast: any) {
    this.toasts = this.toasts.filter(t => t !== toast);
  }

  // Clear all toasts
  clear() {
    this.toasts = [];
  }
}
