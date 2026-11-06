import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { CarritoService } from '../services/carrito.service';

@Component({
    selector: 'app-nav-bar',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './nav-bar.component.html',
    styleUrls: ['./nav-bar.component.css']
})
export class NavBarComponent implements OnInit {
    private authService = inject(AuthService);
    private carritoService = inject(CarritoService);
    menuAbierto = false;
    
    // Observables para el estado
    user$ = this.authService.currentUser$;
    cartItemCount$ = this.carritoService.itemCount$;
    
    cerrarMenu(): void { this.menuAbierto = false; }

    ngOnInit(): void {
        // Esto se usa para inicializar el conteo del carrito
        this.carritoService.loadInitialData();
    }

    logout(): void {
        this.authService.logout();
    }
}