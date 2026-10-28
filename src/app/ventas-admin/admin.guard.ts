import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthService).isAdmin$.pipe(
    take(1),
    map(admin => admin || router.createUrlTree(['/login']))
  );
};
