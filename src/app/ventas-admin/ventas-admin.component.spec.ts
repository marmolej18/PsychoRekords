import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { VentasAdminComponent } from './ventas-admin.component';
import { Venta, VentasService } from '../services/ventas.service';

describe('Historial administrativo', () => {
  const venta: Venta = { idventa: 5, fecha: '2026-10-27T12:00:00', totalventa: 550, estadopedido: 'Pagado', nombrepunto: 'Centro', cliente: 'Juan Pérez', detalles: [{iddetalle:1, titulo:'Abbey Road', artista:'The Beatles', cantidad:2, precioUnitario:275}] };
  let servicio: jasmine.SpyObj<VentasService>;
  beforeEach(() => {
    servicio = jasmine.createSpyObj('VentasService', ['getTodasLasVentas', 'getDetalleVenta', 'actualizarEstado', 'cancelarVenta']);
    servicio.getTodasLasVentas.and.returnValue(of([venta]));
    servicio.getDetalleVenta.and.returnValue(of({ ...venta }));
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
  it('filtra las ventas por estado con sus conteos', () => {
    servicio.getTodasLasVentas.and.returnValue(of([
      { ...venta, idventa: 1 }, { ...venta, idventa: 2, estadopedido: 'En preparación' },
      { ...venta, idventa: 3, estadopedido: 'Entregado' }, { ...venta, idventa: 4, estadopedido: 'CANCELADO' }
    ]));
    const fixture = TestBed.createComponent(VentasAdminComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const filtro = (texto: string) => [...el.querySelectorAll<HTMLButtonElement>('.filtros button')]
      .find(b => b.textContent?.includes(texto))!;
    expect(filtro('Pagados').textContent).toContain('1');
    filtro('Pagados').click(); fixture.detectChanges();
    expect([...el.querySelectorAll('tbody th')].map(t => t.textContent)).toEqual(['#1']);
    filtro('En preparación').click(); fixture.detectChanges();
    expect([...el.querySelectorAll('tbody th')].map(t => t.textContent)).toEqual(['#2']);
    filtro('Cancelados').click(); fixture.detectChanges();
    expect([...el.querySelectorAll('tbody th')].map(t => t.textContent)).toEqual(['#4']);
    expect(el.textContent).toContain('Mostrando 1 de 4');
  });
  it('desplaza la página hasta el detalle al abrirlo', fakeAsync(() => {
    const fixture = TestBed.createComponent(VentasAdminComponent);
    fixture.detectChanges();
    const scroll = spyOn(fixture.componentInstance.detalle!.nativeElement, 'scrollIntoView');
    fixture.nativeElement.querySelector('.btn-detalle').click();
    fixture.detectChanges();
    tick();
    expect(scroll).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  }));
  it('avanza el pedido a la siguiente etapa y actualiza la lista', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    servicio.getTodasLasVentas.and.returnValue(of([{ ...venta }]));
    servicio.actualizarEstado.and.returnValue(of({ idventa: 5, estadopedido: 'En preparación' }));
    const fixture = TestBed.createComponent(VentasAdminComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.verDetalle(5); fixture.detectChanges();
    const boton: HTMLButtonElement = [...fixture.nativeElement.querySelectorAll('button')]
      .find((b: HTMLButtonElement) => b.textContent?.includes('Marcar como En preparación'));
    boton.click(); fixture.detectChanges();
    expect(servicio.actualizarEstado).toHaveBeenCalledWith(5, 'En preparación', undefined);
    expect(component.ventas[0].estadopedido).toBe('En preparación');
    expect(fixture.nativeElement.textContent).toContain('Marcar como En tránsito');
    expect(component.siguienteEtapa({ ...venta, estadopedido: 'Entregado' })).toBeNull();
    expect(component.siguienteEtapa({ ...venta, estadopedido: 'CANCELADO' })).toBeNull();
  });
  it('pide paquetería y guía antes de marcar "En tránsito"', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    servicio.actualizarEstado.and.returnValue(of({ idventa: 5, estadopedido: 'En tránsito', paqueteria: 'DHL', numero_guia: 'AB123456' }));
    const component = TestBed.createComponent(VentasAdminComponent).componentInstance;
    const enPreparacion = { ...venta, estadopedido: 'En preparación' };
    expect(component.requiereGuia(enPreparacion)).toBeTrue();
    component.avanzarEstado(enPreparacion);
    expect(servicio.actualizarEstado).not.toHaveBeenCalled();
    expect(component.errorDetalle).toContain('número de guía');
    component.paqueteria = 'DHL';
    component.numeroGuia = ' AB123456 ';
    component.avanzarEstado(enPreparacion);
    expect(servicio.actualizarEstado).toHaveBeenCalledWith(5, 'En tránsito', { paqueteria: 'DHL', numeroGuia: 'AB123456' });
    expect(enPreparacion.estadopedido).toBe('En tránsito');
    expect(component.urlRastreo({ ...enPreparacion, paqueteria: 'DHL', numero_guia: 'AB123456' })).toContain('tracking-id=AB123456');
    expect(component.puedeCancelar({ ...venta, estadopedido: 'En tránsito' })).toBeFalse();
  });
  it('cancela el pedido, actualiza la lista y oculta las acciones', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    servicio.getTodasLasVentas.and.returnValue(of([{ ...venta }]));
    servicio.cancelarVenta.and.returnValue(of({}));
    const fixture = TestBed.createComponent(VentasAdminComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.verDetalle(5); fixture.detectChanges();
    const boton: HTMLButtonElement = [...fixture.nativeElement.querySelectorAll('button')]
      .find((b: HTMLButtonElement) => b.textContent?.includes('Cancelar pedido'));
    boton.click(); fixture.detectChanges();
    expect(servicio.cancelarVenta).toHaveBeenCalledWith(5);
    expect(component.ventas[0].estadopedido).toBe('CANCELADO');
    expect(component.ventas[0].totalventa).toBe(0);
    expect(fixture.nativeElement.textContent).not.toContain('Cancelar pedido');
    expect(fixture.nativeElement.textContent).toContain('no tiene más etapas');
    expect(component.puedeCancelar({ ...venta, estadopedido: 'Entregado' })).toBeFalse();
  });
  it('no cancela si el admin no confirma', () => {
    spyOn(window, 'confirm').and.returnValue(false);
    const component = TestBed.createComponent(VentasAdminComponent).componentInstance;
    component.cancelarPedido({ ...venta });
    expect(servicio.cancelarVenta).not.toHaveBeenCalled();
  });
  it('muestra el error del backend si no se puede avanzar', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    servicio.actualizarEstado.and.returnValue(throwError(() => ({ error: { message: 'El pedido está en "Entregado"' } })));
    const component = TestBed.createComponent(VentasAdminComponent).componentInstance;
    component.avanzarEstado({ ...venta });
    expect(component.errorDetalle).toContain('Entregado');
    expect(component.actualizando).toBeFalse();
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
