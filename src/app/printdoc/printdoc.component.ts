import { Component } from '@angular/core';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { CommonModule } from '@angular/common'; // <-- Yeh import add karein
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-printdoc',
    standalone: true,
    imports: [SidebarComponent, FormsModule,CommonModule],
    templateUrl: './printdoc.component.html',
    styleUrl: './printdoc.component.css'
})
export class PrintdocComponent {

  financialYears: string[] = [];



  ngOnInit(): void {
    this.fillFinancialYears();
  }

  // Function to calculate and fill the financial years (current and previous)
  fillFinancialYears(): void {
    const currentDate = new Date();
    let currentYear = currentDate.getFullYear();
    const month = currentDate.getMonth(); // Get the current month (0 = January, 11 = December)

    // If the current month is before April, the financial year will be in the previous year
    if (month < 3) { // March is month 2, so before April is less than 3
      currentYear--;
    }

    const previousFinancialYear = currentYear - 1;
    const currentFinancialYear = currentYear;

    // Add the financial years to the array
    this.financialYears = [`${previousFinancialYear}-${currentFinancialYear}`, `${currentFinancialYear}-${currentFinancialYear + 1}`];
  }
}
