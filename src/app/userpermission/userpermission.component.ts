import { AfterViewInit, Component, OnInit } from '@angular/core';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

 // Declare jQuery

@Component({
  selector: 'app-userpermission',
  standalone: true,
  imports: [SidebarComponent,CommonModule],
  templateUrl: './userpermission.component.html',
  styleUrl: './userpermission.component.css'
})
export class UserpermissionComponent implements OnInit {

 constructor(private routes:Router)
 {}

ngOnInit(): void {
  
  // this.routes.navigateByUrl('userpermission');

}


}
