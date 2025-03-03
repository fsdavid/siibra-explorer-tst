import { ChangeDetectionStrategy, Component, EventEmitter, Inject, OnDestroy, Optional, Output, TemplateRef, ViewChild } from "@angular/core";
import { select, Store } from "@ngrx/store";
import { ClickInterceptor, CLICK_INTERCEPTOR_INJECTOR } from "src/util";
import { distinctUntilChanged } from "rxjs/operators";
import { IViewer, TViewerEvent } from "../../viewer.interface";
import { NehubaMeshService } from "../mesh.service";
import { NehubaLayerControlService, SET_COLORMAP_OBS, SET_LAYER_VISIBILITY } from "../layerCtrl.service";
import { NG_LAYER_CONTROL, SET_SEGMENT_VISIBILITY } from "../layerCtrl.service/layerCtrl.util";
import { SapiRegionModel } from "src/atlasComponents/sapi";
import { NehubaConfig } from "../config.service";
import { SET_MESHES_TO_LOAD } from "../constants";
import { atlasSelection, userInteraction } from "src/state";


@Component({
  selector: 'iav-cmp-viewer-nehuba-glue',
  templateUrl: './nehubaViewerGlue.template.html',
  styleUrls: [
    './nehubaViewerGlue.style.css'
  ],
  exportAs: 'iavCmpViewerNehubaGlue',
  providers: [
    {
      provide: SET_MESHES_TO_LOAD,
      useFactory: (meshService: NehubaMeshService) => meshService.loadMeshes$,
      deps: [ NehubaMeshService ]
    },
    NehubaMeshService,
    {
      provide: SET_COLORMAP_OBS,
      useFactory: (layerCtrl: NehubaLayerControlService) => layerCtrl.setColorMap$,
      deps: [ NehubaLayerControlService ]
    },
    {
      provide: SET_LAYER_VISIBILITY,
      useFactory: (layerCtrl: NehubaLayerControlService) => layerCtrl.visibleLayer$,
      deps: [ NehubaLayerControlService ]
    },
    {
      provide: SET_SEGMENT_VISIBILITY,
      useFactory: (layerCtrl: NehubaLayerControlService) => layerCtrl.segmentVis$,
      deps: [ NehubaLayerControlService ]
    },
    {
      provide: NG_LAYER_CONTROL,
      useFactory: (layerCtrl: NehubaLayerControlService) => layerCtrl.ngLayersController$,
      deps: [ NehubaLayerControlService ]
    },
    NehubaLayerControlService,
    NehubaMeshService,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class NehubaGlueCmp implements IViewer<'nehuba'>, OnDestroy {

  private onhoverSegments: SapiRegionModel[] = []
  private onDestroyCb: (() => void)[] = []

  public nehubaConfig: NehubaConfig

  ngOnDestroy(): void {
    while (this.onDestroyCb.length) this.onDestroyCb.pop()()
  }

  @Output()
  public viewerEvent = new EventEmitter<TViewerEvent<'nehuba'>>()

  constructor(
    private store$: Store<any>,
    @Optional() @Inject(CLICK_INTERCEPTOR_INJECTOR) clickInterceptor: ClickInterceptor,
  ){

    /**
     * define onclick behaviour
     */
    if (clickInterceptor) {
      const { deregister, register } = clickInterceptor
      const selOnhoverRegion = this.selectHoveredRegion.bind(this)
      register(selOnhoverRegion, { last: true })
      this.onDestroyCb.push(() => deregister(selOnhoverRegion))
    }

    /**
     * on hover segment
     */
    const onhovSegSub = this.store$.pipe(
      select(userInteraction.selectors.mousingOverRegions),
      distinctUntilChanged(),
    ).subscribe(arr => {
      this.onhoverSegments = arr
    })
    this.onDestroyCb.push(() => onhovSegSub.unsubscribe())
  }

  private selectHoveredRegion(_ev: any): boolean{
    /**
     * If label indicies are not defined by the ontology, it will be a string in the format of `{ngId}#{labelIndex}`
     */
    const trueOnhoverSegments = this.onhoverSegments && this.onhoverSegments.filter(v => typeof v === 'object')
    if (!trueOnhoverSegments || (trueOnhoverSegments.length === 0)) return true
    this.store$.dispatch(
      atlasSelection.actions.selectRegion({
        region: trueOnhoverSegments[0]
      })
    )
    return true
  }
}
