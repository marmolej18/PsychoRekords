import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Producto, ProductosService } from '../services/productos.service';

@Component({
  selector: 'app-detalles',
  imports: [],
  templateUrl: './detalles.component.html',
  styleUrl: './detalles.component.css'
})
export class DetallesComponent implements OnInit{
    producto: Producto | undefined;

    constructor(
        private route: ActivatedRoute,
        private productosService: ProductosService
    ) {}

    ngOnInit(): void {
        const id=Number(this.route.snapshot.paramMap.get('id'));
        this.productosService.getProducto(id).subscribe({
            next:(producto: Producto) => {
                this.producto=producto;
            },
            error: (error) => {
                console.log('Error al obtener el producto');
            }
        });
    }

    onImageError(event: Event): void {
        const img = event.target as HTMLImageElement;
        img.src = '/logo_rana.png';
        img.onerror = null;
    }
}