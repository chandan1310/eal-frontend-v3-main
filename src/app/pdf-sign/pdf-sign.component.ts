import { Component } from '@angular/core';
import { PdfSignService } from '../../../src/app/services/pdf-sign.service';


@Component({
  selector: 'app-pdf-sign',
  templateUrl: './pdf-sign.component.html'
})
export class PdfSignComponent {
  selectedFile: File | null = null;
  isProcessing: boolean = false;

  constructor(private pdfSignService: PdfSignService) {}

  onFileChange(event: any) {
    if (event.target.files && event.target.files.length > 0) {
      this.selectedFile = event.target.files[0];
    }
  }

  onUploadAndSign() {
    if (!this.selectedFile) {
      alert('Pehle ek PDF file choose karein!');
      return;
    }

    this.isProcessing = true;

    this.pdfSignService.signPdf(this.selectedFile, 'Pass@123').subscribe({
      next: (signedBlob: Blob) => {
        this.isProcessing = false;

        const blobUrl = window.URL.createObjectURL(signedBlob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `Signed_${this.selectedFile?.name}`;
        link.click();
        window.URL.revokeObjectURL(blobUrl);
      },
      error: (err) => {
        this.isProcessing = false;
        console.error('Signing failed:', err);
        alert('Digital signing failed! Check token or certificate setup.');
      }
    });
  }
}