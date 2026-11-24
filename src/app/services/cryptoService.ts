import { Injectable } from '@angular/core';
import * as CryptoJS from 'crypto-js';

@Injectable({
  providedIn: 'root'
})
export class CryptoService {
  private key = CryptoJS.enc.Utf8.parse('1234567890123456'); // 16-byte key
  private iv  = CryptoJS.enc.Utf8.parse('1234567890123456'); // 16-byte IV

  encrypt(value: string): string {
    const encrypted = CryptoJS.AES.encrypt(
      CryptoJS.enc.Utf8.parse(value),
      this.key,
      {
        keySize: 128 / 8,
        iv: this.iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      }
    );
    return encrypted.toString(); // Base64 string
  }
}
