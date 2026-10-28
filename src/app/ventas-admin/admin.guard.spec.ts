import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom, Observable, of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { adminGuard } from './admin.guard';

describe('Acceso a ventas administrativas', () => {
  for (const admin of [true, false]) {
    it(admin ? 'permite al administrador' : 'redirige al usuario sin permisos', async () => {
      const router = jasmine.createSpyObj('Router', ['createUrlTree']);
      router.createUrlTree.and.returnValue('login');
      TestBed.configureTestingModule({providers: [
        {provide: AuthService, useValue: {isAdmin$: of(admin)}},
        {provide: Router, useValue: router}
      ]});
      const resultado = TestBed.runInInjectionContext(() => adminGuard({} as any, {} as any));
      expect(await firstValueFrom(resultado as Observable<any>)).toBe(admin ? true : 'login');
    });
  }
});
