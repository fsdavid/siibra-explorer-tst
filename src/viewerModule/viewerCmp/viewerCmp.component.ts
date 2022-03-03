import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, TemplateRef, ViewChild, ViewContainerRef } from "@angular/core";
import { select, Store } from "@ngrx/store";
import { combineLatest, NEVER, Observable, of, Subscription } from "rxjs";
import { debounceTime, map, shareReplay, startWith, switchMap } from "rxjs/operators";
import { CONST, ARIA_LABELS, QUICKTOUR_DESC } from 'common/constants'
import { OVERWRITE_SHOW_DATASET_DIALOG_TOKEN } from "src/util/interfaces";
import { animate, state, style, transition, trigger } from "@angular/animations";
import { IQuickTourData } from "src/ui/quickTour";
import { EnumViewerEvt, TContextArg, TSupportedViewers, TViewerEvent } from "../viewer.interface";
import { ContextMenuService, TContextMenuReg } from "src/contextMenuModule";
import { ComponentStore } from "../componentStore";
import { DialogService } from "src/services/dialogService.service";
import { SAPI, SapiRegionModel } from "src/atlasComponents/sapi";
import { actions } from "src/state/atlasSelection";
import { atlasSelection, userInterface, userInteraction } from "src/state";
import { SapiSpatialFeatureModel } from "src/atlasComponents/sapi/type";

type TCStoreViewerCmp = {
  overlaySideNav: any
}

@Component({
  selector: 'iav-cmp-viewer-container',
  templateUrl: './viewerCmp.template.html',
  styleUrls: [
    './viewerCmp.style.css'
  ],
  exportAs: 'iavCmpViewerCntr',
  animations: [
    trigger('openClose', [
      state('open', style({
        transform: 'translateY(0)',
        opacity: 1
      })),
      state('closed', style({
        transform: 'translateY(-100vh)',
        opacity: 0
      })),
      transition('open => closed', [
        animate('200ms cubic-bezier(0.35, 0, 0.25, 1)')
      ]),
      transition('closed => open', [
        animate('200ms cubic-bezier(0.35, 0, 0.25, 1)')
      ])
    ]),
    trigger('openCloseAnchor', [
      state('open', style({
        transform: 'translateY(0)'
      })),
      state('closed', style({
        transform: 'translateY(100vh)'
      })),
      transition('open => closed', [
        animate('200ms cubic-bezier(0.35, 0, 0.25, 1)')
      ]),
      transition('closed => open', [
        animate('200ms cubic-bezier(0.35, 0, 0.25, 1)')
      ])
    ]),
  ],
  providers: [
    {
      provide: OVERWRITE_SHOW_DATASET_DIALOG_TOKEN,
      useFactory: (cStore: ComponentStore<TCStoreViewerCmp>) => {
        return function overwriteShowDatasetDialog( arg: any ){
          cStore.setState({
            overlaySideNav: arg
          })
        }
      },
      deps: [ ComponentStore ]
    },
    ComponentStore,
    DialogService
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class ViewerCmp implements OnDestroy {

  public CONST = CONST
  public ARIA_LABELS = ARIA_LABELS

  public overlaySidenav$ = NEVER

  @ViewChild('genericInfoVCR', { read: ViewContainerRef })
  genericInfoVCR: ViewContainerRef

  public quickTourRegionSearch: IQuickTourData = {
    order: 7,
    description: QUICKTOUR_DESC.REGION_SEARCH,
  }
  public quickTourAtlasSelector: IQuickTourData = {
    order: 0,
    description: QUICKTOUR_DESC.ATLAS_SELECTOR,
  }

  @Input() ismobile = false

  private subscriptions: Subscription[] = []
  private onDestroyCb: (() => void)[]  = []
  public viewerLoaded: boolean = false

  private selectedATP = this.store$.pipe(
    select(atlasSelection.selectors.selectedATP),
    shareReplay(1)
  )

  public selectedAtlas$ = this.selectedATP.pipe(
    map(({ atlas }) => atlas)
  )
  public templateSelected$ = this.selectedATP.pipe(
    map(({ template }) => template)
  )
  public parcellationSelected$ = this.selectedATP.pipe(
    map(({ parcellation }) => parcellation)
  )

  public selectedRegions$ = this.store$.pipe(
    select(atlasSelection.selectors.selectedRegions),
  )

  public isStandaloneVolumes$ = this.store$.pipe(
    select(atlasSelection.selectors.standaloneVolumes),
    map(v => v.length > 0)
  )

  public viewerMode$: Observable<string> = this.store$.pipe(
    select(atlasSelection.selectors.viewerMode),
    shareReplay(1),
  )

  public useViewer$: Observable<TSupportedViewers | 'notsupported'> = combineLatest([
    this.store$.pipe(
      select(atlasSelection.selectors.selectedATP),
      switchMap(({ atlas, template }) => atlas && template
        ? this.sapi.getSpace(atlas["@id"], template["@id"]).getVolumes()
        : of(null)),
      map(vols => {
        const flags = {
          isNehuba: false,
          isThreeSurfer: false
        }
        if (!vols) return null
        if (vols.find(vol => vol.data.volume_type === "neuroglancer/precomputed")) {
          flags.isNehuba = true
        }

        if (vols.find(vol => vol.data.volume_type === "gii")) {
          flags.isThreeSurfer = true
        }
        return flags
      })
    ),
    this.isStandaloneVolumes$,
  ]).pipe(
    map(([flags, isSv]) => {
      if (isSv) return 'nehuba'
      if (!flags) return null
      if (flags.isNehuba) return 'nehuba'
      if (flags.isThreeSurfer) return 'threeSurfer'
      return 'notsupported'
    })
  )

  public viewerCtx$ = this.ctxMenuSvc.context$

  public selectedFeature$ = this.store$.pipe(
    select(userInteraction.selectors.selectedFeature)
  )

  /**
   * if no regions are selected, nor any additional layers (being deprecated)
   * then the "explore" btn should not show
   * and the full left side bar should not be expandable
   * if it is already expanded, it should collapse
   */
  public onlyShowMiniTray$: Observable<boolean> = combineLatest([
    this.selectedRegions$,
    this.viewerMode$.pipe(
      startWith(null as string)
    ),
    this.selectedFeature$,
  ]).pipe(
    map(([ regions, viewerMode, selectedFeature ]) => regions.length === 0 && !viewerMode && !selectedFeature)
  )

  @ViewChild('viewerStatusCtxMenu', { read: TemplateRef })
  private viewerStatusCtxMenu: TemplateRef<any>

  @ViewChild('viewerStatusRegionCtxMenu', { read: TemplateRef })
  private viewerStatusRegionCtxMenu: TemplateRef<any>

  public context: TContextArg<TSupportedViewers>
  private templateSelected: any
  private getRegionFromlabelIndexId: (arg: {labelIndexId: string}) => any

  constructor(
    private store$: Store<any>,
    private ctxMenuSvc: ContextMenuService<TContextArg<'threeSurfer' | 'nehuba'>>,
    private cStore: ComponentStore<TCStoreViewerCmp>,
    private dialogSvc: DialogService,
    private cdr: ChangeDetectorRef,
    private sapi: SAPI,
  ){

    this.subscriptions.push(
      this.selectedRegions$.subscribe(() => {
        this.clearPreviewingDataset()
      }),
      this.ctxMenuSvc.context$.subscribe(
        (ctx: any) => this.context = ctx
      ),
      this.templateSelected$.subscribe(
        t => this.templateSelected = t
      ),
      this.parcellationSelected$.subscribe(
        p => {
          this.getRegionFromlabelIndexId = null
        }
      ),
      combineLatest([
        this.templateSelected$,
        this.parcellationSelected$,
        this.selectedAtlas$,
      ]).pipe(
        debounceTime(160)
      ).subscribe(async ([tmpl, parc, atlas]) => {
        const regex = /pre.?release/i
        const checkPrerelease = (obj: any) => {
          if (obj?.name) return regex.test(obj.name)
          return false
        }
        const message: string[] = []
        if (checkPrerelease(atlas)) {
          message.push(`- _${atlas.name}_`)
        }
        if (checkPrerelease(tmpl)) {
          message.push(`- _${tmpl.fullName}_`)
        }
        if (checkPrerelease(parc)) {
          message.push(`- _${parc.name}_`)
        }
        if (message.length > 0) {
          message.unshift(`The following have been tagged pre-release, and may be updated frequently:`)
          try {
            await this.dialogSvc.getUserConfirm({
              title: `Pre-release warning`,
              markdown: message.join('\n\n'),
              confirmOnly: true
            })
          // eslint-disable-next-line no-empty
          } catch (e) {

          }
        }
      })
    )
  }

  ngAfterViewInit(){
    const cb: TContextMenuReg<TContextArg<'nehuba' | 'threeSurfer'>> = ({ append, context }) => {

      /**
       * first append general viewer info
       */
      append({
        tmpl: this.viewerStatusCtxMenu,
        data: {
          context,
          metadata: {
            template: this.templateSelected,
          }
        },
        order: 0
      })

      /**
       * check hovered region
       */
      let hoveredRegions = []
      if (context.viewerType === 'nehuba') {
        hoveredRegions = (context as TContextArg<'nehuba'>).payload.nehuba.reduce(
          (acc, curr) => acc.concat(...curr.regions),
          []
        )
      }

      if (context.viewerType === 'threeSurfer') {
        hoveredRegions = (context as TContextArg<'threeSurfer'>).payload._mouseoverRegion
      }
      console.log('hoveredRegions', hoveredRegions)

      if (hoveredRegions.length > 0) {
        append({
          tmpl: this.viewerStatusRegionCtxMenu,
          data: {
            context,
            metadata: { hoveredRegions }
          },
          order: 5
        })
      }

      return true
    }
    this.ctxMenuSvc.register(cb)
    this.onDestroyCb.push(
      () => this.ctxMenuSvc.deregister(cb)
    )
  }

  ngOnDestroy() {
    while (this.subscriptions.length) this.subscriptions.pop().unsubscribe()
    while (this.onDestroyCb.length > 0) this.onDestroyCb.pop()()
  }

  public selectRoi(roi: SapiRegionModel) {
    this.store$.dispatch(
      actions.selectRegions({
        regions: [ roi ]
      })
    )
  }

  public exitSpecialViewMode(){
    this.store$.dispatch(
      actions.clearViewerMode()
    )
  }

  public clearPreviewingDataset(){
    /**
     * clear all preview
     */
    this.cStore.setState({
      overlaySideNav: null
    })
  }

  public handleViewerEvent(event: TViewerEvent<'nehuba' | 'threeSurfer'>){
    switch(event.type) {
    case EnumViewerEvt.VIEWERLOADED:
      this.viewerLoaded = event.data
      break
    case EnumViewerEvt.VIEWER_CTX:
      this.ctxMenuSvc.context$.next(event.data)
      if (event.data.viewerType === "nehuba") {
        const { nehuba } = (event.data as TContextArg<"nehuba">).payload
        const mousingOverRegions = (nehuba || []).reduce((acc, { regions }) => acc.concat(...regions), [])
        this.store$.dispatch(
          userInteraction.actions.mouseoverRegions({
            regions: mousingOverRegions
          })
        )
      }
      break
    default:
    }
  }

  public disposeCtxMenu(){
    this.ctxMenuSvc.dismissCtxMenu()
  }

  showSpatialDataset(feature: SapiSpatialFeatureModel) {
    this.store$.dispatch(
      actions.navigateTo({
        navigation: {
          orientation: [0, 0, 0, 1],
          position: feature.location.center.coordinates.map(v => (v.unit as number) * 1e6)
        },
        animation: true
      })
    )

    this.store$.dispatch(
      userInteraction.actions.showFeature({
        feature
      })
    )
  }

  clearSelectedFeature(){
    this.store$.dispatch(
      userInteraction.actions.clearShownFeature()
    )
  }
}
