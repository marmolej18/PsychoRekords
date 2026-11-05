import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-inicio',
  imports: [CommonModule, RouterModule],
  standalone: true,
  templateUrl: './inicio.component.html',
  styleUrl: './inicio.component.css'
})
export class InicioComponent implements OnInit {
    flag = false;

    ngOnInit(): void {
        const user: string | null = localStorage.getItem('currentUser');
        console.log(user)
        if(user){
            this.flag = true;
        } else {
            this.flag = false;
        }
    }
}
