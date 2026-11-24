import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'numberToWords',
    standalone: false
})
export class NumberToWordsPipe implements PipeTransform {
  private belowTwenty = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  private tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  private thousandUnits = ["", "Thousand", "Million", "Billion"];

  private convertChunk(n: number): string {
    if (n === 0) return "";
    else if (n < 20) return this.belowTwenty[n] + " ";
    else if (n < 100) return this.tens[Math.floor(n / 10)] + " " + this.convertChunk(n % 10);
    else return this.belowTwenty[Math.floor(n / 100)] + " Hundred " + this.convertChunk(n % 100);
  }

  transform(value: number): string {
    if (value === 0) return "Zero";
    
    let words = "";
    let unitIndex = 0;

    while (value > 0) {
      let chunk = value % 1000;
      if (chunk > 0) {
        words = this.convertChunk(chunk) + this.thousandUnits[unitIndex] + " " + words;
      }
      value = Math.floor(value / 1000);
      unitIndex++;
    }

    return words.trim();
  }
}
