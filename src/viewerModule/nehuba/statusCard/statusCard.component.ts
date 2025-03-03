import {
  Component,
  OnInit,
  OnChanges,
  TemplateRef,
  HostBinding,
  Optional,
  Inject,
} from "@angular/core";
import { select, Store } from "@ngrx/store";
import { LoggingService } from "src/logging";
import { NehubaViewerUnit } from "../nehubaViewer/nehubaViewer.component";
import { Observable, Subscription, of, combineLatest } from "rxjs";
import { map, filter, startWith, throttleTime } from "rxjs/operators";
import { MatBottomSheet } from "@angular/material/bottom-sheet";
import { MatDialog } from "@angular/material/dialog";
import { ARIA_LABELS, QUICKTOUR_DESC } from 'common/constants'
import { UntypedFormControl } from "@angular/forms";

import { NEHUBA_INSTANCE_INJTKN } from '../util'
import { IQuickTourData } from "src/ui/quickTour/constrants";
import { actions } from "src/state/atlasSelection";
import { atlasSelection } from "src/state";
import { SapiSpaceModel } from "src/atlasComponents/sapi";
import { getNehubaConfig } from "../config.service";

@Component({
  selector : 'iav-cmp-viewer-nehuba-status',
  templateUrl : './statusCard.template.html',
  styleUrls : ['./statusCard.style.css'],
})
export class StatusCardComponent implements OnInit, OnChanges{

  private _nehubaViewer: NehubaViewerUnit;

  get nehubaViewer(): NehubaViewerUnit{
    return this._nehubaViewer
  }
  set nehubaViewer(v: NehubaViewerUnit) {
    this._nehubaViewer = v
    this.ngOnChanges()
  }

  @HostBinding('attr.aria-label')
  public arialabel = ARIA_LABELS.STATUS_PANEL
  public showFull = false

  private selectedTemplate: SapiSpaceModel
  private currentNavigation: any
  private subscriptions: Subscription[] = []

  public navVal$: Observable<string>
  public mouseVal$: Observable<string>


  public quickTourData: IQuickTourData = {
    description: QUICKTOUR_DESC.STATUS_CARD,
    order: 6,
  }

  public SHARE_BTN_ARIA_LABEL = ARIA_LABELS.SHARE_BTN
  public SHOW_FULL_STATUS_PANEL_ARIA_LABEL = ARIA_LABELS.SHOW_FULL_STATUS_PANEL
  public HIDE_FULL_STATUS_PANEL_ARIA_LABEL = ARIA_LABELS.HIDE_FULL_STATUS_PANEL
  constructor(
    private store$: Store<any>,
    private log: LoggingService,
    private bottomSheet: MatBottomSheet,
    private dialog: MatDialog,
    @Optional() @Inject(NEHUBA_INSTANCE_INJTKN) nehubaViewer$: Observable<NehubaViewerUnit>
  ) {

    if (nehubaViewer$) {
      this.subscriptions.push(
        nehubaViewer$.subscribe(
          viewer => this.nehubaViewer = viewer
        )
      )
    } else {
      this.log.warn(`NEHUBA_INSTANCE_INJTKN not injected!`)
    }
  }

  ngOnInit(): void {
    this.subscriptions.push(
      this.statusPanelFormCtrl.valueChanges.subscribe(val => {
        this.statusPanelRealSpace = val
      })
    )

    this.subscriptions.push(
      this.store$.pipe(
        select(atlasSelection.selectors.selectedTemplate)
      ).subscribe(n => this.selectedTemplate = n)
    )

    this.subscriptions.push(
      this.store$.pipe(
        select(atlasSelection.selectors.navigation)
      ).subscribe(nav => this.currentNavigation = nav)
    )
  }

  ngOnChanges(): void {
    if (this.nehubaViewer?.viewerPosInReal$ && this.nehubaViewer?.viewerPosInVoxel$) {
      this.navVal$ = combineLatest([
        this.statusPanelRealSpace$,
        this.nehubaViewer.viewerPosInReal$.pipe(
          filter(v => !!v)
        ),
        this.nehubaViewer.viewerPosInVoxel$.pipe(
          filter(v => !!v)
        )
      ]).pipe(
        map(([realFlag, real, voxel]) => realFlag
          ? real.map(v => `${ (v / 1e6).toFixed(3) }mm`).join(', ')
          : voxel.map(v => v.toFixed(3)).join(', ') ),
        startWith(`nehubaViewer initialising`)
      )
    } else {
      this.navVal$ = of(`neubaViewer is undefined`)
    }

    if ( this.nehubaViewer?.mousePosInReal$ && this.nehubaViewer?.mousePosInVoxel$ ) {

      this.mouseVal$ = combineLatest([
        this.statusPanelRealSpace$,
        this.nehubaViewer.mousePosInReal$.pipe(
          filter(v => !!v),
          throttleTime(16)
        ),
        this.nehubaViewer.mousePosInVoxel$.pipe(
          filter(v => !!v),
          throttleTime(16)
        )
      ]).pipe(
        map(([realFlag, real, voxel]) => realFlag
          ? real.map(v => `${ (v/1e6).toFixed(3) }mm`).join(', ')
          : voxel.map(v => v.toFixed(3)).join(', ')),
        startWith(``)
      )
    } else {
      this.mouseVal$ = of(`neubaViewer is undefined`)
    }

  }

  public statusPanelFormCtrl = new UntypedFormControl(true, [])
  public statusPanelRealSpace = true
  public statusPanelRealSpace$ = this.statusPanelFormCtrl.valueChanges.pipe(
    startWith(true)
  )

  public textNavigateTo(string: string): void {
    if (string.split(/[\s|,]+/).length >= 3 && string.split(/[\s|,]+/).slice(0, 3).every(entry => !isNaN(Number(entry.replace(/mm/, ''))))) {
      const pos = (string.split(/[\s|,]+/).slice(0, 3).map((entry) => Number(entry.replace(/mm/, '')) * (this.statusPanelRealSpace ? 1000000 : 1)))
      this.nehubaViewer.setNavigationState({
        position : (pos as [number, number, number]),
        positionReal : this.statusPanelRealSpace,
      })
    } else {
      this.log.log('input did not parse to coordinates ', string)
    }
  }

  showBottomSheet(tmpl: TemplateRef<any>): void{
    this.bottomSheet.open(tmpl)
  }

  /**
   * TODO
   * maybe have a nehuba manager service
   * so that reset navigation logic can stay there
   *
   * When that happens, we don't even need selectTemplate input
   *
   * the info re: nehubaViewer can stay there, too
   */
  public resetNavigation({rotation: rotationFlag = false, position: positionFlag = false, zoom : zoomFlag = false}: {rotation?: boolean, position?: boolean, zoom?: boolean}): void {
    const config = getNehubaConfig(this.selectedTemplate)

    const {
      zoomFactor: zoom
    } = config.dataset.initialNgState.navigation

    this.store$.dispatch(
      actions.navigateTo({
        navigation: {
          ...this.currentNavigation,
          ...(rotationFlag ? { orientation: [0, 0, 0, 1] } : {}),
          ...(positionFlag ? { position: [0, 0, 0] } : {}),
          ...(zoomFlag ? { zoom: zoom } : {}),
        },
        physical: true,
        animation: true
      })
    )
  }

  openDialog(tmpl: TemplateRef<any>, options: { ariaLabel: string }): void {
    const { ariaLabel } = options
    this.dialog.open(tmpl, {
      ariaLabel
    })
  }
}
