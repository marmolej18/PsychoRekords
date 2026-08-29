import { Routes } from '@angular/router';
import { InicioComponent } from './inicio/inicio.component';
import { QyAComponent } from './qy-a/qy-a.component';
import { SobreNosostrosComponent } from './sobre-nosostros/sobre-nosostros.component';
import { LoginComponent } from './login/login.component';
import { RegistroUsuarioComponent } from './registro-usuario/registro-usuario.component';
import { CatalogoComponent } from './catalogo/catalogo.component';
import { CarritoComponent } from './carrito/carrito.component';
import { CheckoutComponent } from './checkout/checkout.component';
import { HistorialComponent } from './historial/historial.component';
import { InventarioComponent } from './inventario/inventario.component';
import { ReportesComponent } from './reportes/reportes.component';
import { GestionUsuariosComponent } from './gestion-usuarios/gestion-usuarios.component';

export const routes: Routes = [
    { path: 'inicio', component: InicioComponent },
    { path: 'qya', component: QyAComponent },
    { path: 'nosotros', component: SobreNosostrosComponent },
    { path: 'login', component: LoginComponent },
    { path: 'registro', component: RegistroUsuarioComponent },
    { path: 'catalogo', component: CatalogoComponent },
    { path: 'carrito', component: CarritoComponent },
    { path: 'checkout', component: CheckoutComponent },
    { path: 'historial', component: HistorialComponent },
    { path: 'admin/inventario', component: InventarioComponent },
    { path: 'admin/reportes', component: ReportesComponent },
    { path: 'admin/usuarios', component: GestionUsuariosComponent },
    { path: '**', pathMatch: 'full', redirectTo: 'inicio' },
];
