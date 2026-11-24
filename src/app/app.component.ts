import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './sidebar/sidebar.component';
import { StockentryComponent } from './stockentry/stockentry.component';
import { LoginComponent } from "./login/login.component";
import { ToastComponent } from './toast/toast.component';



@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet, ToastComponent],
    templateUrl: './app.component.html',
    styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'EAL';
}
