import { Component, OnInit } from '@angular/core';
import { MetricasTienda, ReportesService } from '../services/reportes.service';
import { FormsModule } from '@angular/forms';
import { CommonModule, NgClass } from '@angular/common';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [FormsModule, NgClass, CommonModule, NgxChartsModule],
  templateUrl: './reportes.component.html',
  styleUrl: './reportes.component.css'
})
export class ReportesComponent implements OnInit {
  reporteRentables: any[] = [];
  reporteVentasFormato: any[] = [];

  loadingRentables = true;
  loadingFormato = true;

  metricas: MetricasTienda | null = null;
  loadingMetricas = true;
  errorMetricas = false;

  errorMessage: string | null = null;
  movimientoInventarioData: any[] = [];

  trazabilidadStockData: any[] = [];
  selectedProdId: number | null = null;
  loadingTrazabilidad = false;

  // id del elemento que se está exportando (null si no hay exportación en curso)
  exportando: string | null = null;

  get graficaTrazabilidadVisible(): boolean {
    return !!this.selectedProdId && this.trazabilidadStockData.length > 0;
  }

  legend = false;
  showXAxis = true;
  showYAxis = true;
  showXAxisLabel = true;
  showYAxisLabel = true;

  // Configuración específica de Trazabilidad (Eje X, Y)
  xAxisLabelTrazabilidad = 'Fecha y Hora del Cambio';
  yAxisLabelTrazabilidad = 'Nivel de Stock';

  constructor(private reportesService: ReportesService, private authService: AuthService) { }

  ngOnInit(): void {
    this.cargarMetricas();
    this.cargarReporteRentables();
    this.cargarReporteVentasFormato();
  }

  cargarMetricas(): void {
    this.loadingMetricas = true;
    this.errorMetricas = false;
    this.reportesService.getMetricas().subscribe({
      next: (data) => {
        this.metricas = data;
        this.loadingMetricas = false;
      },
      error: (err) => {
        this.loadingMetricas = false;
        this.errorMetricas = true;
        console.error('Error en métricas:', err);
      }
    });
  }

  /** Nombre del mes de las métricas, p. ej. "noviembre de 2026". */
  get nombreMes(): string {
    if (!this.metricas) return '';
    const [anio, mes] = this.metricas.periodo.split('-').map(Number);
    return new Date(anio, mes - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  }

  get ticketPromedio(): number {
    const m = this.metricas?.ventasMes;
    return m && m.pedidos > 0 ? m.ingresos / m.pedidos : 0;
  }

  /** Variación % de ingresos contra el mes anterior; null si el mes anterior no tuvo ventas. */
  get variacionIngresos(): number | null {
    const m = this.metricas;
    if (!m || m.ventasMesAnterior.ingresos === 0) return null;
    return (m.ventasMes.ingresos - m.ventasMesAnterior.ingresos) / m.ventasMesAnterior.ingresos * 100;
  }


  onSelectProduct(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const id = Number(target.value);

    this.selectedProdId = id;
    if (id) {
      this.cargarTrazabilidadStock(id);
    } else {
      this.trazabilidadStockData = [];
    }
  }

  cargarReporteRentables(): void {
    this.loadingRentables = true;
    this.reportesService.getReporteRentables().subscribe({
      next: (data) => {
        this.reporteRentables = data.map(r => ({
          ...r,
          total_ingreso_generado: Number(r.total_ingreso_generado)
        }));
        this.loadingRentables = false;
      },
      error: (err) => {
        this.loadingRentables = false;
        this.errorMessage = 'Error al cargar reporte de rentabilidad.';
        console.error('Error en rentables:', err);
      }
    });
  }

  cargarReporteVentasFormato(): void {
    this.loadingFormato = true;
    this.reportesService.getReporteVentasFormato().subscribe({
      next: (data) => {
        this.reporteVentasFormato = data.map(r => ({
          ...r,
          ingreso_bruto: Number(r.ingreso_bruto)
        }));
        this.loadingFormato = false;
      },
      error: (err) => {
        this.loadingFormato = false;
        this.errorMessage = 'Error al cargar reporte de ventas por formato.';
        console.error('Error en formato:', err);
      }
    });
  }

  // Función para determinar si una fila de ROLLUP es un subtotal o total
  esFilaRollup(artista: string | null, formato: string | null): boolean {
    return artista === null || formato === null;
  }

  /**
   * Genera un PDF con el contenido visible del elemento indicado y lo descarga.
   * Sin argumentos exporta la página completa; con el id de una sección, solo esa sección.
   * Las librerías se cargan solo al exportar.
   */
  async exportarPDF(idElemento = 'reporte-pdf', nombreArchivo = 'reportes'): Promise<void> {
    const elemento = document.getElementById(idElemento);
    if (!elemento || this.exportando) return;

    this.exportando = idElemento;
    // Si no se está mostrando la gráfica de trazabilidad, esa sección no va en el PDF general
    const incluirTrazabilidad = this.graficaTrazabilidadVisible;
    try {
      const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas')
      ]);

      const canvas = await html2canvas(elemento, {
        scale: 2,
        backgroundColor: '#ffffff',
        // Renderizar con ancho de escritorio para que las tablas salgan completas
        windowWidth: 1200,
        onclone: (doc) => {
          doc.querySelectorAll<HTMLElement>('.table-responsive').forEach(el => el.style.overflow = 'visible');
          if (!incluirTrazabilidad) {
            doc.getElementById('seccion-trazabilidad')?.remove();
          }
        }
      });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const margen = 10;
      const anchoPagina = pdf.internal.pageSize.getWidth() - margen * 2;
      const altoPagina = pdf.internal.pageSize.getHeight() - margen * 2;

      // Dividir la captura en trozos del alto de una página A4
      const pxPorPagina = Math.floor(canvas.width * altoPagina / anchoPagina);
      for (let y = 0, pagina = 0; y < canvas.height; y += pxPorPagina, pagina++) {
        const alto = Math.min(pxPorPagina, canvas.height - y);
        const trozo = document.createElement('canvas');
        trozo.width = canvas.width;
        trozo.height = alto;
        trozo.getContext('2d')!.drawImage(canvas, 0, y, canvas.width, alto, 0, 0, canvas.width, alto);

        if (pagina > 0) pdf.addPage();
        pdf.addImage(trozo.toDataURL('image/png'), 'PNG', margen, margen, anchoPagina, alto * anchoPagina / canvas.width);
      }

      const fecha = new Date().toISOString().slice(0, 10);
      pdf.save(`${nombreArchivo}-${fecha}.pdf`);
    } catch (err) {
      console.error('Error al exportar PDF:', err);
      this.errorMessage = 'No se pudo generar el PDF.';
    } finally {
      this.exportando = null;
    }
  }

  cargarTrazabilidadStock(idProd: number): void {
    this.loadingTrazabilidad = true;

    this.reportesService.getTrazabilidadStock(idProd).subscribe({
      next: (data) => {
        this.trazabilidadStockData = data;
        this.loadingTrazabilidad = false;
      },
      error: (err: any) => {
        console.error('Error al cargar trazabilidad de stock:', err);
        this.loadingTrazabilidad = false;
      }
    });
  }
}

