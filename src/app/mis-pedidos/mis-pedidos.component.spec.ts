import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MisPedidosComponent } from './mis-pedidos.component';
import { AuthService } from '../services/auth.service';
import { Venta, VentasService } from '../services/ventas.service';

describe('Mis pedidos del cliente', () => {
  const pedido = (idventa: number, estadopedido: string): Venta => ({
    idventa, estadopedido, fecha: '2026-10-27T12:00:00', totalventa: 550, nombrepunto: 'Plaza Central',
    direccioncompleta: 'Av. Madero 123', horarioatencion: 'Lun-Sab 10am-8pm',
    detalles: [{ iddetalle: idventa, titulo: 'Abbey Road', artista: 'The Beatles', cantidad: 2, precioUnitario: 275 }]
  });
  let servicio: jasmine.SpyObj<VentasService>;
  let auth: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    servicio = jasmine.createSpyObj('VentasService', ['getMisPedidos']);
    servicio.getMisPedidos.and.returnValue(of([pedido(3, 'Pagado'), pedido(2, 'Entregado'), pedido(1, 'CANCELADO')]));
    auth = jasmine.createSpyObj('AuthService', ['getAuthHeader']);
    auth.getAuthHeader.and.returnValue('4');
    TestBed.configureTestingModule({
      imports: [MisPedidosComponent],
      providers: [{ provide: VentasService, useValue: servicio }, { provide: AuthService, useValue: auth }, provideRouter([])]
    });
  });

  it('redirige al login si no hay sesión', () => {
    auth.getAuthHeader.and.returnValue(null);
    const navigate = spyOn(TestBed.inject(Router), 'navigate');
    TestBed.createComponent(MisPedidosComponent).detectChanges();
    expect(navigate).toHaveBeenCalledWith(['/login']);
    expect(servicio.getMisPedidos).not.toHaveBeenCalled();
  });

  it('muestra los pedidos con su etapa actual y el detalle al abrirlos', () => {
    const fixture = TestBed.createComponent(MisPedidosComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('li.pedido').length).toBe(3);
    expect(el.querySelector('[aria-current="step"]')?.textContent).toContain('Pagado');
    expect(el.textContent).toContain('fue cancelado');
    (el.querySelector('.pedido-resumen') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Abbey Road');
    expect(el.textContent).toContain('Lun-Sab 10am-8pm');
  });

  it('ofrece WhatsApp para cancelar solo en pedidos en curso', () => {
    const fixture = TestBed.createComponent(MisPedidosComponent);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    const el: HTMLElement = fixture.nativeElement;
    c.alternar(3); fixture.detectChanges();
    expect(el.querySelector('.cancelacion a')?.getAttribute('href')).toBe(c.whatsappNegocio);
    expect(el.querySelector('.cancelacion')?.textContent).toContain('#3');
    for (const id of [2, 1]) {
      c.alternar(id); fixture.detectChanges();
      expect(el.querySelector('.cancelacion')).toBeNull();
    }
  });

  it('filtra por estado', () => {
    const fixture = TestBed.createComponent(MisPedidosComponent);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    expect(c.contar('pagados')).toBe(1);
    expect(c.contar('listos')).toBe(0);
    c.filtro = 'pagados';
    expect(c.pedidosFiltrados.map(p => p.idventa)).toEqual([3]);
    c.filtro = 'entregados';
    expect(c.pedidosFiltrados.map(p => p.idventa)).toEqual([2]);
    c.filtro = 'cancelados';
    expect(c.pedidosFiltrados.map(p => p.idventa)).toEqual([1]);
  });

  it('muestra estado vacío y permite reintentar errores', () => {
    servicio.getMisPedidos.and.returnValue(of([]));
    const fixture = TestBed.createComponent(MisPedidosComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Todavía no tienes pedidos');
    servicio.getMisPedidos.and.returnValue(throwError(() => new Error('error')));
    fixture.componentInstance.cargarPedidos(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Reintentar');
  });
});
