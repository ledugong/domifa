import { HttpClient } from "@angular/common/http";
import { Component, OnInit, TemplateRef, ViewChild } from "@angular/core";
import { NgbActiveModal, NgbModal } from "@ng-bootstrap/ng-bootstrap";
import { MatomoInjector, MatomoTracker } from "ngx-matomo";
import { Observable } from "rxjs";
import { AuthService } from "src/app/services/auth.service";
import { fadeInOut } from "./shared/animations";
@Component({
  animations: [fadeInOut],
  selector: "app-root",
  styleUrls: ["./app.component.css"],
  templateUrl: "./app.component.html"
})
export class AppComponent implements OnInit {
  public title: string;
  public help: boolean = false;
  public isNavbarCollapsed: boolean = false;
  public isAllowed: any;

  public domifaNews: [];
  public newsLabels: any;

  public modal: any;

  @ViewChild("newsCenter", { static: true })
  public newsCenter!: TemplateRef<any>;

  private newsJson = "assets/files/news.json";

  constructor(
    public readonly authService: AuthService,
    private matomoInjector: MatomoInjector,
    private matomoTracker: MatomoTracker,
    private modalService: NgbModal,
    private http: HttpClient
  ) {
    this.title = "Domifa";
    this.help = false;
    this.newsLabels = {
      bug: "Améliorations",
      new: "Nouveauté"
    };

    this.domifaNews = [];

    this.matomoInjector.init("https://matomo.fabrique.social.gouv.fr/", 17);

    this.authService.isAuth().subscribe(isAuth => {
      if (isAuth) {
        this.getJSON().subscribe(domifaNews => {
          this.domifaNews = domifaNews[0];
          const lastNews = localStorage.getItem("lastNews");
          if (
            !lastNews ||
            (lastNews && new Date(lastNews) <= new Date(domifaNews[0].date))
          ) {
            this.modal = this.modalService.open(this.newsCenter, {
              backdrop: "static"
            });
          }
        });
      }
    });
  }
  public ngOnInit() {
    this.matomoTracker.setUserId("0");
  }

  public getJSON(): Observable<any> {
    return this.http.get(this.newsJson);
  }

  public closeModal() {
    this.modal.close();
    localStorage.setItem("lastNews", new Date().toISOString());
  }
}
