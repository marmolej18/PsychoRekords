import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService, UserAuth } from '../services/auth.service';
import { CarritoService } from '../services/carrito.service';

@Component({
  selector: 'app-nav-bar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './nav-bar.component.html',
  styleUrls: ['./nav-bar.component.css']
})
export class NavBarComponent implements OnInit {
  // Observables para el estado
  isLoggedIn$: Observable<boolean>;
  isAdmin$: Observable<boolean>;
  cartItemCount$: Observable<number>;
  username$: Observable<UserAuth | null>;

  constructor(
    private authService: AuthService,
    private carritoService: CarritoService
  ) {
    this.isLoggedIn$ = this.authService.isLoggedIn$;
    this.isAdmin$ = this.authService.isAdmin$;
    this.cartItemCount$ = this.carritoService.itemCount$;
    this.username$ = this.authService.currentUser$;
  }

  ngOnInit(): void {
    // Esto se usa para inicializar el conteo del carrito
    this.carritoService.loadInitialData();
  }

  logout(): void {
    this.authService.logout();
  }
}