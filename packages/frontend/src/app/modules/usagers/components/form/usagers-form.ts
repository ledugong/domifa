import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { NgbDateAdapter, NgbDateParserFormatter, NgbDatepickerI18n, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Observable, of, Subject } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, switchMap, tap } from 'rxjs/operators';
import { Doc } from 'src/app/modules/usagers/interfaces/document';
import { Usager } from 'src/app/modules/usagers/interfaces/usager';
import { DocumentService } from 'src/app/modules/usagers/services/document.service';
import { UsagerService } from 'src/app/modules/usagers/services/usager.service';
import { AutocompleteAdresseService } from 'src/app/services/autocomplete-adresse';
import { NgbDateCustomParserFormatter } from 'src/app/services/date-formatter';
import { CustomDatepickerI18n } from 'src/app/services/date-french';
import { regexp } from '../../../../entities/validators';
import { AyantDroit } from '../../interfaces/ayant-droit';
import { StructureService } from '../../services/structure.service';

@Component({
  providers: [UsagerService, AutocompleteAdresseService,
    { provide: NgbDatepickerI18n, useClass: CustomDatepickerI18n },
    { provide: NgbDateParserFormatter, useClass: NgbDateCustomParserFormatter },
  ],
  selector: 'app-usagers-form',
  styleUrls: ['./usagers-form.css'],
  templateUrl: './usagers-form.html'
})

export class UsagersFormComponent implements OnInit {

  get f() {
    return this.usagerForm.controls;
  }
  get u(): any{
    return this.uploadForm.controls;
  }
  get r(): any{
    return this.rdvForm.controls;
  }

  get ayantsDroits() {
    return this.usagerForm.get('ayantsDroits') as FormArray
  }

  public title = "Ajouter un domicilié";

  /* Config datepickers */
  public dToday = new Date();
  public maxDateNaissance = { day: this.dToday.getDate(), month: this.dToday.getMonth()+1, year: this.dToday.getFullYear()};
  public minDateNaissance = { day: 1, month: 1, year: 1920 };

  public minDateRdv = { day: this.dToday.getDate(), month: this.dToday.getMonth()+1, year: this.dToday.getFullYear() };
  public maxDateRdv = { day: this.dToday.getDate(), month: this.dToday.getMonth()+1, year: this.dToday.getFullYear() + 2 };


  /* Recherche adresse */
  public ville: any;
  public searching = false;
  public searchFailed = false;

  public etapes = [  "État civil", "Prise de RDV", "Entretien", "Pièces justificatives", "Décision finale"];
  public etapeDemande: number;

  /* RDV */
  public httpError: any;

  /* Upload */
  public uploadError: any;
  public fileName = '';
  public userId: number;
  public uploadResponse: any;
  public documents: Doc[];

  public usager: Usager;
  public uploadForm: FormGroup;
  public registerForm: FormGroup;
  public usagerForm: FormGroup;
  public rdvForm: FormGroup;
  public entretienForm: FormGroup;

  public submitted = false;
  public structureId: number;
  public modal: any;
  public structure: any;
  public agents: any[] = [];

  public motifsRefus = {
    "refus1": "Existence d'un hébergement stable",
    "refus2": "Nombre de domiciliations de votre organisme prévu par l’agrément atteint (associations)",
    "refus3": "En dehors des critères du public domicilié (associations)",
    "refus4": "Absence de lien avec la commune (CCAS/commune)",
    "refus5": "Autres (précisez le motif)",
  };

  public motifsRefusList = Object.keys(this.motifsRefus);


  public successMessage: string;
  public errorMessage: string;

  private _success = new Subject<string>();
  private _error = new Subject<string>();



  constructor(private Autocomplete: AutocompleteAdresseService,
    private formBuilder: FormBuilder,
    private usagerService: UsagerService,
    private documentService: DocumentService,
    private structureService: StructureService,
    private route: ActivatedRoute,
    private modalService: NgbModal) {
    }

    public ngOnInit() {
      console.log(this.motifsRefusList);

      this.title = "Enregister un dossier";
      this.uploadResponse = { status: '', message: '', filePath: '' };
      this.userId = 1;
      this.structureId = 1;
      this.uploadError = {};

      this._success.subscribe((message) => { this.successMessage = message });
      this._error.subscribe((message) => { this.errorMessage = message });
      this._success.pipe(debounceTime(2000)).subscribe(() => this.successMessage = null);
      this._error.pipe(debounceTime(2000)).subscribe(() => this.errorMessage = null);

      if (this.route.snapshot.params.id) {
        const id = this.route.snapshot.params.id;

        this.usagerService.findOne(id).subscribe((usager: Usager) => {
          this.usager = new Usager(usager);
          this.initForm();
          for (const ayantDroit of this.usager.ayantsDroits) {
            this.addAyantDroit(ayantDroit);
          }
        }, (error) => {
          console.log('404 ! : ' + error);
        });
      }
      else {
        this.usager = new Usager({});
        this.initForm();
      }

      /* get structure users */
      this.structureService.getStructure(2).subscribe((structure: any) => {
        for (const agent of structure.users) {
          this.agents.push({
            id: agent.id,
            name: agent.firstName + ' ' + agent.lastName
          });
        }
      });
    }

    public initForm() {

      this.usagerForm = this.formBuilder.group({
        ayantsDroits : this.formBuilder.array([]),
        ayantsDroitsExist : [this.usager.ayantsDroitsExist, []],
        codePostalNaissance : [ this.usager.codePostalNaissance, [ Validators.required] ],
        preference : this.formBuilder.group({
          mail:[this.usager.preference.mail, [Validators.required] ],
          phone:[this.usager.preference.phone, [Validators.required] ],
        }),
        dateNaissance : [ this.usager.dateNaissance, [   ] ],
        dateNaissancePicker : [ this.usager.dateNaissancePicker, [  Validators.required ]],
        email:  [ this.usager.email, [ Validators.email]],
        etapeDemande : [ this.usager.etapeDemande, []],
        id: [this.usager.id, []],
        lieuNaissance: [this.usager.lieuNaissance, [Validators.required]],
        nom: [ this.usager.nom, Validators.required],
        phone: [ this.usager.phone, [  Validators.pattern(regexp.phone) ] ],
        prenom: [ this.usager.prenom, Validators.required],
        sexe: [this.usager.sexe, Validators.required],
        statutDemande : [ this.usager.statutDemande, []],
        structure : [ this.usager.structure, []],
        villeNaissance : [ this.usager.lieuNaissance, [ Validators.required] ],
      });

      this.uploadForm = this.formBuilder.group({
        imageInput: [this.fileName, Validators.required],
        label: ['', Validators.required]
      });

      this.rdvForm = this.formBuilder.group({
        dateRdv: [this.usager.rdv.dateRdv, [ Validators.required ] ],
        heureRdv: [this.usager.rdv.heureRdv, [ Validators.required ] ],
        isNow: [this.usager.rdv.isNow, [] ],
        jourRdv: [this.usager.rdv.jourRdv, [Validators.required ] ],
        userId: [ this.usager.id, Validators.required ]
      });

      this.entretienForm = this.formBuilder.group({
        domiciliation : [this.usager.entretien.domiciliation, [  ] ],
        revenus : [this.usager.entretien.revenus, [  ] ],
        liencommune : [this.usager.entretien.liencommune, [  ] ],
        residence : [this.usager.entretien.residence, [  ] ],
        residenceDetail : [this.usager.entretien.residenceDetail, [  ] ],
        cause : [this.usager.entretien.cause, [  ] ],
        pourquoi : [this.usager.entretien.pourquoi, [  ] ],
        pourquoiDetail : [this.usager.entretien.pourquoiDetail, [  ] ],
        accompagnement : [this.usager.entretien.accompagnement, [  ] ],
        accompagnementDetail : [this.usager.entretien.accompagnementDetail, [  ] ],
        commentaires : [this.usager.entretien.commentaires, [  ] ],
      });

    }

    public setDecision(statut: string) {
      this.usagerService.setDecision(this.usager.id, this.usager.decision, statut).subscribe((usager: Usager) => {
        this.modal.close();
        statut !== 'refus' ? this.changeSuccessMessage("Domiciliation réussie") : this.changeSuccessMessage("Domiciliation refusée");
        this.usager = new Usager(usager);
      },  (error) => {
        console.log('Erreur ! : ' + error);
      });
    }

    public open(content) {
      this.modal = this.modalService.open(content);
    }

    public addAyantDroit(ayantDroit: AyantDroit = new AyantDroit()): void {
      (this.usagerForm.controls.ayantsDroits as FormArray).push(this.newAyantDroit(ayantDroit));
    }

    public deleteAyantDroit(i: number): void {
      (this.usagerForm.controls.ayantsDroits as FormArray).removeAt(i);
    }

    public newAyantDroit(ayantDroit: AyantDroit) {
      return this.formBuilder.group({
        dateNaissance : [ayantDroit.dateNaissance, [  Validators.pattern(regexp.date), Validators.required ] ],
        lien: [ ayantDroit.lien , Validators.required],
        nom: [ ayantDroit.nom , Validators.required],
        prenom: [ ayantDroit.prenom, Validators.required],
      })
    }

    public getAttestation() {
      return this.usagerService.attestation(this.usager.id);
    }

    public changeStep(i: number) {
      if (this.usager.decision.statut === 'instruction' ) {
        this.usager.etapeDemande = i;
      }
    }

    public submitInfos() {
      this.submitted = true;
      if (this.usagerForm.invalid) {
        Object.keys(this.usagerForm.controls).forEach(key => {
          if(this.usagerForm.get(key).errors != null) {
            this.changeSuccessMessage("Un des champs du formulaire est incorrecte", true);
          }
        });
      }
      else {
        const dateNaissanceTmp = this.usagerForm.get('dateNaissancePicker').value;
        this.usagerForm.controls.dateNaissance.setValue(new Date(dateNaissanceTmp.year + '-' + dateNaissanceTmp.month + '-' + dateNaissanceTmp.day));

        /* Edit: ville de naissance  */
        if (typeof this.usagerForm.get('villeNaissance').value === "object" && this.usagerForm.get('villeNaissance').value.properties.label !== undefined) {
          this.usagerForm.controls.villeNaissance.setValue(this.usagerForm.get('villeNaissance').value.properties.label);
        }

        this.usagerService.create(this.usagerForm.value).subscribe((usager: Usager) => {
          this.changeSuccessMessage("Enregistrement réussi");
          this.usager = new Usager(usager);
        }, (error) => {
          console.log('Erreur ! : ' + error);
        });
      }
    }

    public submitEntretien() {
      this.usagerService.entretien(this.entretienForm.value, this.usager.id).subscribe((usager: Usager) => {
        this.usager = new Usager(usager);
        this.changeSuccessMessage("Enregistrement de l'entretien réussi");
      }, (error) => { this.changeSuccessMessage("Une erreur est survenu", true); });
    }

    public submitRdv() {
      if (this.rdvForm.get('isNow').value === 'oui') {
        this.rdvForm.controls.userId.setValue(12);
        this.rdvForm.controls.dateRdv.setValue(new Date().toISOString());
      }
      else {
        if (this.rdvForm.invalid) {
          Object.keys(this.rdvForm.controls).forEach(key => {
            if (this.rdvForm.get(key).errors != null) {
              this.changeSuccessMessage("Veuillez vérifier la date de rendez-vous", true);
            }
          });
        }
        else {
          const jourRdv = this.rdvForm.get("jourRdv").value;
          const heureRdv = this.rdvForm.get("heureRdv").value;
          const dateTmp = new Date(jourRdv.year + '-' + jourRdv.month + '-' + jourRdv.day + ' ' + heureRdv.hour + ':' + heureRdv.minute);
          this.rdvForm.controls.dateRdv.setValue(dateTmp.toISOString()) ;
        }
      }

      this.usagerService.createRdv(this.rdvForm.value, this.usager.id)
      .subscribe((usager: Usager) => {
        this.usager = new Usager(usager);
        this.changeSuccessMessage("Rendez-vous enregistré");
      }, (error) => {  this.changeSuccessMessage("Une erreur est survenu", true);  });
    }

    public onFileChange(event) {
      if (event.target.files.length > 0) {
        const file = event.target.files[0];
        const validFileExtensions = ["image/jpg", "application/pdf", "image/jpeg", "image/bmp", "image/gif", "image/png"];
        const type = event.target.files[0].type;
        const size = event.target.files[0].size;

        this.fileName = event.target.files[0].name;
        this.uploadError = {
          fileSize: size < 5000000,
          fileType: validFileExtensions.includes(type)
        };

        this.uploadForm.controls.imageInput.setValue(file); // <-- Set Value for Validation
        if (!this.uploadError.fileSize || !this.uploadError.fileType  ) {
          return;
        }
      }
    }

    public submitFile() {
      this.submitted = true;
      this.uploadError = {
        fileSize: true,
        fileType: true
      };

      const formData = new FormData();

      formData.append('file', this.uploadForm.get('imageInput').value);
      formData.append('label', this.uploadForm.get('label').value);

      this.documentService.upload(formData, this.usager.id).subscribe((res) => {
        this.uploadResponse = res;
        console.log(this.uploadResponse);

        if (this.uploadResponse.success !== undefined && this.uploadResponse.success) {
          this.usager.docs = new Usager(this.uploadResponse.body).docs;
          this.uploadForm.reset();
          this.fileName = '';
        }
      }, (err) => this.httpError = err);
    }

    public getDocument(i: number) {
      return this.documentService.getDocument(this.usager.id, i, this.usager.docs[i]);
    }

    public deleteDocument(i: number): void {
      this.documentService.deleteDocument(this.usager.id, i).subscribe((usager: Usager) => {
        this.usager.docs = new Usager(usager).docs;
      }, (error) => {    console.log('Erreur ! : ' + error);  });
    }

    public formatResult(properties) {
      return properties.label + ', ' + properties.postcode;
    }

    public selectVille(item) {
      this.usagerForm.controls.villeNaissance.setValue(item.item.properties.city);
      this.usagerForm.controls.codePostalNaissance.setValue(item.item.properties.postcode);
    }

    public formatter = (x:  { properties: { label: string  } }) => x.properties.label;

    public search = (text$: Observable<string>) =>
    text$.pipe(debounceTime(300), distinctUntilChanged(), tap(() => this.searching = true), switchMap(term => this.Autocomplete.search(term).pipe(tap(() => this.searchFailed = false),
    catchError(() => {
      this.searchFailed = true;
      return of([]);
    }))),
    tap(() => this.searching = false));

    public changeSuccessMessage(message: string, error?: boolean) {
      window.scroll({
        behavior: 'smooth',
        left: 0,
        top: 0,
      });
      error ? this._error.next(message) : this._success.next(message);
    }

  }
