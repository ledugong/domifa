import { Component, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { LoadingService } from "src/app/modules/loading/loading.service";
import { AuthService } from "src/app/services/auth.service";
import * as XLSX from "xlsx";
import { regexp } from "../../../../shared/validators";
import { UsagerService } from "../../services/usager.service";

export const CIVILITE = 0;
export const NOM = 1;
export const PRENOM = 2;
export const SURNOM = 3;
export const DATE_NAISSANCE = 4;
export const LIEU_NAISSANCE = 5;
export const EMAIL = 6;
export const PHONE = 7;
export const STATUT_DOM = 8;
export const TYPE_DOM = 9;
export const DATE_DEBUT_DOM = 10;
export const DATE_FIN_DOM = 11;
export const DATE_PREMIERE_DOM = 12;
export const MOTIF_REFUS = 13;
export const MOTIF_RADIATION = 14;
export const COMPOSITION_MENAGE = 15;
export const AYANT_DROIT = [16, 20, 24, 28];

type AOA = any[][];

@Component({
  providers: [UsagerService],
  selector: "app-import",
  styleUrls: ["./import.component.css"],
  templateUrl: "./import.component.html"
})
export class ImportComponent implements OnInit {
  public data: AOA = [[], []];

  public title: string;
  public prenom: string;

  public uploadForm: FormGroup;
  public fileName: string;
  public uploadResponse: any;

  public canUpload: boolean;
  public success: boolean;
  public error: boolean;
  public showTable: boolean;

  public nbreAyantsDroits: any[];

  public errorsId: any[];
  public errorsColumn = new Array(32);

  public emailErrors: number = 0;
  public phoneErrors: number = 0;

  public emails: string[];
  public phones: string[];

  public rowNumber: number;

  constructor(
    private formBuilder: FormBuilder,
    private usagerService: UsagerService,
    private authService: AuthService,
    private loadingService: LoadingService,
    private router: Router
  ) {}

  get u(): any {
    return this.uploadForm.controls;
  }

  public ngOnInit() {
    this.showTable = false;
    this.title = "Importer vos domiciliés";
    this.uploadResponse = {
      filePath: "",
      message: "",
      status: ""
    };

    this.emails = [];
    this.phones = [];
    this.errorsId = [];
    this.canUpload = false;

    this.nbreAyantsDroits = [16, 20, 24, 28];

    for (let index = 0; index < 32; index++) {
      this.errorsColumn[index] = 10;
    }

    this.uploadForm = this.formBuilder.group({
      fileInput: [this.fileName, Validators.required]
    });

    this.authService.currentUser.subscribe(user => {
      this.prenom = user !== null ? user.prenom : "";
    });
  }

  public onFileChange(evt: any) {
    this.showTable = true;
    this.data = null;

    const target: DataTransfer = evt.target as DataTransfer;
    const file = evt.target.files[0];

    if (target.files.length !== 1) {
      throw new Error("Cannot use multiple files");
    }

    this.uploadForm.controls.fileInput.setValue(file);

    const reader: FileReader = new FileReader();
    reader.onload = (e: any) => {
      const bstr: string = e.target.result;
      const wb: XLSX.WorkBook = XLSX.read(bstr, { type: "binary" });

      const wsname: string = wb.SheetNames[0];
      const ws: XLSX.WorkSheet = wb.Sheets[wsname];

      const datas = XLSX.utils.sheet_to_json(ws, {
        blankrows: false,
        header: 1
      }) as AOA;

      datas.slice(1).forEach((row, index: any) => {
        this.rowNumber = index;
        const sexeCheck = row[0] === "H" || row[0] === "F";

        this.countErrors(sexeCheck, index, CIVILITE);
        this.countErrors(this.notEmpty(row[NOM]), index, NOM);
        this.countErrors(this.notEmpty(row[PRENOM]), index, PRENOM);
        this.countErrors(
          this.validDate(row[DATE_NAISSANCE], true),
          index,
          DATE_NAISSANCE
        );
        this.countErrors(
          this.notEmpty(row[LIEU_NAISSANCE]),
          index,
          LIEU_NAISSANCE
        );
        this.countErrors(this.validEmail(row[EMAIL]), index, EMAIL);
        this.countErrors(this.validPhone(row[PHONE]), index, PHONE);
        this.countErrors(
          this.isValidValue(row[STATUT_DOM], "statut", true),
          index,
          STATUT_DOM
        );
        this.countErrors(
          this.isValidValue(row[TYPE_DOM], "demande", true),
          index,
          TYPE_DOM
        );
        this.countErrors(
          this.validDate(row[DATE_PREMIERE_DOM], false),
          index,
          DATE_PREMIERE_DOM
        );
        this.countErrors(
          this.validDate(row[DATE_FIN_DOM], true),
          index,
          DATE_FIN_DOM
        );
        this.countErrors(
          this.validDate(row[DATE_PREMIERE_DOM], false),
          index,
          DATE_PREMIERE_DOM
        );
        this.countErrors(
          this.isValidValue(row[MOTIF_REFUS], "motifRefus"),
          index,
          MOTIF_REFUS
        );
        this.countErrors(
          this.isValidValue(row[MOTIF_RADIATION], "motifRadiation"),
          index,
          MOTIF_RADIATION
        );
        this.countErrors(
          this.isValidValue(row[COMPOSITION_MENAGE], "menage"),
          index,
          COMPOSITION_MENAGE
        );

        for (const indexAD of AYANT_DROIT) {
          const nom = row[indexAD];
          const prenom = row[indexAD + 1];
          const dateNaissance = row[indexAD + 2];
          const lienParente = row[indexAD + 3];

          if (nom && prenom && dateNaissance && lienParente) {
            this.countErrors(this.notEmpty(nom), this.rowNumber, indexAD);

            this.countErrors(
              this.notEmpty(prenom),
              this.rowNumber,
              indexAD + 1
            );

            this.countErrors(
              this.validDate(dateNaissance, true),
              this.rowNumber,
              indexAD + 2
            );

            this.countErrors(
              this.isValidValue(lienParente, "lienParente", true),
              this.rowNumber,
              indexAD + 3
            );
          }
        }
      });
      this.data = datas;
    };
    reader.readAsBinaryString(target.files[0]);
  }

  public submitFile() {
    this.loadingService.startLoading();

    const formData = new FormData();
    formData.append("file", this.uploadForm.get("fileInput").value);

    this.usagerService.import(formData).subscribe(
      res => {
        this.uploadResponse = res;

        setTimeout(() => {
          this.loadingService.stopLoading();
          this.router.navigate(["/manage"]);
        }, 1000);
      },
      err => {
        this.loadingService.stopLoading();
      }
    );
  }

  public isAnError(idRow: number, idColumn: number) {
    const position = idRow.toString() + "_" + idColumn.toString();
    return this.errorsId.indexOf(position) > -1;
  }

  public countErrors(variable: boolean, idRow: any, idColumn: number) {
    if (this.errorsColumn[idColumn] === undefined) {
      this.errorsColumn[idColumn] = 1;
    }
    this.errorsColumn[idColumn]++;

    const position = idRow.toString() + "_" + idColumn.toString();
    if (variable !== true) {
      this.errorsId.push(position);
    }
    return variable;
  }

  public notEmpty(value: string): boolean {
    return value !== undefined && value !== null && value !== "";
  }

  public validDate(date: string, required: boolean): boolean {
    if ((date === undefined || date === null || date === "") && !required) {
      return true;
    }
    return RegExp(regexp.date).test(date);
  }

  public validPhone(phone: string): boolean {
    if (!phone || phone === null || phone === "") {
      return true;
    }

    if (this.phones.indexOf(phone) > -1) {
      this.phoneErrors++;
      return false;
    }

    this.phones.push(phone);

    return RegExp(regexp.phone).test(phone);
  }

  public validEmail(email: string): boolean {
    if (!email || email === null || email === "") {
      return true;
    }

    if (this.emails.indexOf(email) > -1) {
      this.emailErrors++;

      return false;
    }

    this.emails.push(email);
    return RegExp(regexp.email).test(email);
  }

  public isValidValue(data: string, rowName: string, required?: boolean) {
    if ((data === undefined || data === null || data === "") && !required) {
      return true;
    }

    const types = {
      demande: ["PREMIERE", "RENOUVELLEMENT"],
      lienParente: ["ENFANT", "CONJOINT", "PARENT", "AUTRE"],
      menage: [
        "HOMME_ISOLE_SANS_ENFANT",
        "FEMME_ISOLE_SANS_ENFANT",
        "HOMME_ISOLE_AVEC_ENFANT",
        "FEMME_ISOLE_AVEC_ENFANT",
        "COUPLE_SANS_ENFANT",
        "COUPLE_AVEC_ENFANT",
        "MINEUR"
      ],
      motifRadiation: [
        "NON_MANIFESTATION_3_MOIS",
        "A_SA_DEMANDE",
        "ENTREE_LOGEMENT",
        "PLUS_DE_LIEN_COMMUNE",
        "NON_RESPECT_REGLEMENT",
        "AUTRE"
      ],
      motifRefus: ["LIEN_COMMUNE", "SATURATION", "HORS_AGREMENT", "AUTRE"],
      statut: ["VALIDE", "REFUS", "RADIE"]
    };
    return types[rowName].indexOf(data) > -1;
  }

  public reload() {
    location.reload();
  }
}