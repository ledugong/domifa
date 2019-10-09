import { Injectable } from "@angular/core";
import {
  ActivatedRouteSnapshot,
  CanActivate,
  Router,
  RouterStateSnapshot
} from "@angular/router";
import jwtDecode from "jwt-decode";
import { Observable, of } from "rxjs";
import { map } from "rxjs/operators";
import { User } from "../modules/users/interfaces/user";
import { AuthService } from "../services/auth.service";

@Injectable({ providedIn: "root" })
export class AuthGuard implements CanActivate {
  constructor(private router: Router, private authService: AuthService) {}

  public canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | boolean {
    return this.authService.isAuth().pipe(
      map(isLogged => {
        if (isLogged) {
          return true;
        } else {
          this.router.navigate(["/connexion"], {
            queryParams: { returnUrl: state.url }
          });
          return false;
        }
      })
    );
  }
}