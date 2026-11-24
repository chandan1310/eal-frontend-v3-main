import { Component, OnInit } from '@angular/core';
import { SidebarComponent } from "../sidebar/sidebar.component";

import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-usercreate',
    standalone: true,
    imports: [SidebarComponent, FormsModule],
    templateUrl: './usercreate.component.html',
    styleUrl: './usercreate.component.css'
})
export class UsercreateComponent implements OnInit {





  ngOnInit(): void {
    
  }

}
