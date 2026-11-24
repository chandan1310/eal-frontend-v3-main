import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class GlobalService {
  searchText: any = "";
  
  constructor() { }

  manageSearchData(data, searchText) {
    let row1 = null;
    let returnVal = [];
    for (let i in data) {
        row1 = JSON.stringify(data[i]);
        if (searchText) {
            row1 = row1.toLocaleLowerCase();
            if (row1.indexOf(searchText.toLocaleLowerCase()) != -1) {
                returnVal.push(data[i]);
            }
        } else {
            returnVal.push(data[i]);
        }
    }
    return returnVal;
}

}
