import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { VentasAdminComponent } from './ventas-admin.component';
import { Venta, VentasService } from '../services/ventas.service';

describe('Historial administrativo', () => {
  const venta: Venta = { idventa: 5, fecha: '2026-10-27T12:00:00', totalventa: 550, estadopedido: 'Pagado', nombrepunto: 'Centro', cliente: 'Juan Pérez', detalles: [{iddetalle:1, titulo:'Abbey Road', artista:'The Beatles', cantidad:2, precioUnitario:275}] };
  let servicio: jasmine.SpyObj<VentasService>;
  beforeEach(() => {
    servicio = jasmine.createSpyObj('VentasService', ['getTodasLasVentas', 'getDetalleVenta']);
    servicio.getTodasLasVentas.and.returnValue(of([venta]));
    servicio.getDetalleVenta.and.returnValue(of(venta));
    TestBed.configureTestingModule({ imports: [VentasAdminComponent], providers: [{provide: VentasService, useValue: servicio}] });
  });
  it('muestra listado y productos al abrir el detalle', () => {
    const fixture = TestBed.createComponent(VentasAdminComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Juan Pérez');
    fixture.nativeElement.querySelector('.btn-detalle').click();
    fixture.detectChanges();
    expect(servicio.getDetalleVenta).toHaveBeenCalledWith(5);
    expect(fixture.nativeElement.textContent).toContain('Abbey Road');
    expect(fixture.nativeElement.textContent).toContain('$550.00');
  });
  it('muestra estado vacío y permite reintentar errores', () => {
    servicio.getTodasLasVentas.and.returnValue(of([]));
    const fixture = TestBed.createComponent(VentasAdminComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Todavía no hay ventas');
    servicio.getTodasLasVentas.and.returnValue(throwError(() => new Error('error')));
    fixture.componentInstance.cargarVentas(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Reintentar');
  });
  it('muestra error de detalle y descarta respuestas anteriores al cerrar', () => {
    const fixture = TestBed.createComponent(VentasAdminComponent);
    const component = fixture.componentInstance;
    servicio.getDetalleVenta.and.returnValue(throwError(() => ({status:404})));
    component.verDetalle(9);
    expect(component.errorDetalle).toContain('no está disponible');
    const pendiente = new Subject<Venta>();
    servicio.getDetalleVenta.and.returnValue(pendiente);
    component.verDetalle(5); component.cerrarDetalle(); pendiente.next(venta);
    expect(component.seleccionada).toBeNull();
  });
});
