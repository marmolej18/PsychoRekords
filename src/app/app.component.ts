import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from "./header/header.component";
import { FooterComponent } from "./footer/footer.component";
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent, NgxChartsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'PsychoRecords';

  constructor(private authService: AuthService) {}

  // Al abrir la app, el servidor confirma la sesión guardada en el navegador.
  ngOnInit(): void {
    this.authService.verificarSesion();
  }
}
