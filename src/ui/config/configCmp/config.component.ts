import {Component, Inject, OnDestroy, OnInit, Optional} from '@angular/core'
import { select, Store } from '@ngrx/store';
import { combineLatest, Observable, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, map, startWith } from 'rxjs/operators';
import { SUPPORTED_PANEL_MODES } from 'src/services/state/ngViewerState.store';
import { ngViewerActionSetPanelOrder } from 'src/services/state/ngViewerState.store.helper';
import { VIEWER_CONFIG_ACTION_TYPES, StateInterface as ViewerConfiguration } from 'src/services/state/viewerConfig.store'
import { IavRootStoreInterface } from 'src/services/stateStore.service';
import {isIdentityQuat, NEHUBA_INSTANCE_INJTKN} from 'src/viewerModule/nehuba/util';
import {MatSlideToggleChange} from "@angular/material/slide-toggle";
import {MatSliderChange} from "@angular/material/slider";
import { PureContantService } from 'src/util';
import { ngViewerActionSwitchPanelMode } from 'src/services/state/ngViewerState/actions';
import { ngViewerSelectorPanelMode, ngViewerSelectorPanelOrder } from 'src/services/state/ngViewerState/selectors';
import { viewerStateSelectorNavigation } from 'src/services/state/viewerState/selectors';
import {VIEWER_INJECTION_TOKEN} from "src/ui/layerbrowser/layerDetail/layerDetail.component";
import {NehubaViewerUnit} from "src/viewerModule/nehuba";

const GPU_TOOLTIP = `Higher GPU usage can cause crashes on lower end machines`
const ANIMATION_TOOLTIP = `Animation can cause slowdowns in lower end machines`
const MOBILE_UI_TOOLTIP = `Mobile UI enables touch controls`
const AXIS_LINE_TOOLTIP = `Show axis lines on the slice views`
const BACKGROUND_COLORING_TOOLTIP = `Show ble background coloring on the perspective view`
const SCALE_BAR = `Show scale bar`
const ROOT_TEXT_ORDER: [string, string, string, string] = ['Coronal', 'Sagittal', 'Axial', '3D']
const OBLIQUE_ROOT_TEXT_ORDER: [string, string, string, string] = ['Slice View 1', 'Slice View 2', 'Slice View 3', '3D']

@Component({
  selector: 'config-component',
  templateUrl: './config.template.html',
  styleUrls: [
    './config.style.css',
  ],
})

export class ConfigComponent implements OnInit, OnDestroy {

  public GPU_TOOLTIP = GPU_TOOLTIP
  public ANIMATION_TOOLTIP = ANIMATION_TOOLTIP
  public MOBILE_UI_TOOLTIP = MOBILE_UI_TOOLTIP
  public AXIS_LINE_TOOLTIP = AXIS_LINE_TOOLTIP
  public BACKGROUND_COLORING_TOOLTIP = BACKGROUND_COLORING_TOOLTIP
  public SCALE_BAR = SCALE_BAR
  public supportedPanelModes = SUPPORTED_PANEL_MODES

  /**
   * in MB
   */
  public gpuLimit$: Observable<number>

  public useMobileUI$: Observable<boolean>
  public animationFlag$: Observable<boolean>
  private subscriptions: Subscription[] = []

  public gpuMin: number = 100
  public gpuMax: number = 1000

  public panelMode$: Observable<string>

  private panelOrder: string
  private panelOrder$: Observable<string>
  public panelTexts$: Observable<[string, string, string, string]>

  private viewerObliqueRotated$: Observable<boolean>

  private nehubaViewer: NehubaViewerUnit
  private get viewer(){
    return this.injectedViewer || (window as any).viewer
  }

  constructor(
    private store: Store<IavRootStoreInterface>,
    private pureConstantService: PureContantService,
    @Optional() @Inject(VIEWER_INJECTION_TOKEN) private injectedViewer,
    @Optional() @Inject(NEHUBA_INSTANCE_INJTKN) nehubaViewer$: Observable<NehubaViewerUnit>
  ) {

    this.subscriptions.push(
      nehubaViewer$.subscribe(viewer => this.nehubaViewer = viewer)
    )

    this.useMobileUI$ = this.pureConstantService.useTouchUI$

    this.gpuLimit$ = this.store.pipe(
      select('viewerConfigState'),
      map((config: ViewerConfiguration) => config.gpuLimit),
      distinctUntilChanged(),
      map(v => v / 1e6),
    )

    this.animationFlag$ = this.store.pipe(
      select('viewerConfigState'),
      map((config: ViewerConfiguration) => config.animation),
    )

    this.panelMode$ = this.store.pipe(
      select(ngViewerSelectorPanelMode),
      startWith(SUPPORTED_PANEL_MODES[0]),
    )

    this.panelOrder$ = this.store.pipe(
      select(ngViewerSelectorPanelOrder),
    )

    this.viewerObliqueRotated$ = this.store.pipe(
      select(viewerStateSelectorNavigation),
      map(navigation => (navigation && navigation.orientation) || [0, 0, 0, 1]),
      debounceTime(100),
      map(isIdentityQuat),
      map(flag => !flag),
      distinctUntilChanged(),
    )

    this.panelTexts$ = combineLatest([
      this.panelOrder$.pipe(
        map(string => string.split('').map(s => Number(s))),
      ),
      this.viewerObliqueRotated$,
    ]).pipe(
      map(([arr, isObliqueRotated]) => arr.map(idx => (isObliqueRotated ? OBLIQUE_ROOT_TEXT_ORDER : ROOT_TEXT_ORDER)[idx]) as [string, string, string, string]),
      startWith(ROOT_TEXT_ORDER),
    )
  }

  public ngOnInit() {
    this.subscriptions.push(
      this.panelOrder$.subscribe(panelOrder => this.panelOrder = panelOrder),
    )
  }

  public ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe())
  }

  public toggleMobileUI(ev: MatSlideToggleChange) {
    const { checked } = ev
    this.store.dispatch({
      type: VIEWER_CONFIG_ACTION_TYPES.SET_MOBILE_UI,
      payload: {
        useMobileUI: checked,
      },
    })
  }

  public toggleAnimationFlag(ev: MatSlideToggleChange ) {
    const { checked } = ev
    this.store.dispatch({
      type: VIEWER_CONFIG_ACTION_TYPES.UPDATE_CONFIG,
      config: {
        animation: checked,
      },
    })
  }

  public handleMatSliderChange(ev: MatSliderChange) {
    this.store.dispatch({
      type: VIEWER_CONFIG_ACTION_TYPES.UPDATE_CONFIG,
      config: {
        gpuLimit: ev.value * 1e6,
      },
    })
  }
  public usePanelMode(panelMode: string) {
    this.store.dispatch(
      ngViewerActionSwitchPanelMode({
        payload: { panelMode }
      })
    )
  }

  public handleDrop(event: DragEvent) {
    event.preventDefault()
    const droppedAttri = (event.target as HTMLElement).getAttribute('panel-order')
    const draggedAttri = event.dataTransfer.getData('text/plain')
    if (droppedAttri === draggedAttri) { return }
    const idx1 = Number(droppedAttri)
    const idx2 = Number(draggedAttri)
    const arr = this.panelOrder.split('');

    [arr[idx1], arr[idx2]] = [arr[idx2], arr[idx1]]
    this.store.dispatch(
      ngViewerActionSetPanelOrder({
        payload: { panelOrder: arr.join('') }
      })
    )
  }
  public handleDragOver(event: DragEvent) {
    event.preventDefault()
    const target = (event.target as HTMLElement)
    target.classList.add('onDragOver')
  }
  public handleDragLeave(event: DragEvent) {
    (event.target as HTMLElement).classList.remove('onDragOver')
  }
  public handleDragStart(event: DragEvent) {
    const target = (event.target as HTMLElement)
    const attri = target.getAttribute('panel-order')
    event.dataTransfer.setData('text/plain', attri)

  }
  public handleDragend(event: DragEvent) {
    const target = (event.target as HTMLElement)
    target.classList.remove('onDragOver')
  }

  public stepSize: number = 10

  public get axisLineVisible() {
    const panel: any = Array.from(this.viewer.display.panels)[0]
    return panel?.viewer?.showAxisLines?.value
  }

  public set axisLineVisible(value) {
    const panel: any = Array.from(this.viewer.display.panels)[0]
    if (panel && panel.viewer) {
      panel.viewer.showAxisLines.value = value
    }
  }

  public toggleAxisLines(value) {
    this.axisLineVisible = value
  }


  public get showScaleBar() {
    const panel: any = Array.from(this.viewer.display.panels).find((p: any) => p.viewer?.orthographicProjection)
    return panel?.viewer?.showScaleBar?.value
  }

  public set showScaleBar(value) {
    const panel: any = Array.from(this.viewer.display.panels).find((p: any) => p.viewer?.orthographicProjection)
    if (panel && panel.viewer) {
      panel.viewer.showScaleBar.value = value
    }
  }

  public toggleScaleBar(value) {
    this.showScaleBar = value
  }
  

  public get sliceBackgroundRgb() {
    const color = this.sliceBackground
    return '#' + [color[0], color[1], color[2]].map(x => x.toString(16).length === 1 ? '0' + x.toString(16) : x.toString(16))
      .join('')
  }
  
  public get sliceBackground() {
    const panel: any = Array.from(this.viewer.display.panels).find((p: any) => p.viewer?.orthographicProjection)
    return panel?.config?.layout.useNehubaPerspective.drawSubstrates.color
  }

  public set sliceBackground(value) {
    const panel: any = Array.from(this.viewer.display.panels).find((p: any) => p.viewer?.orthographicProjection)
    if (panel && panel.config) {
      panel.config.layout.useNehubaPerspective.drawSubstrates.color = value
    }
    this.nehubaViewer.redraw()
  }

  public setSliceBackground(value) {
    this.sliceBackground = [...this.hexToRgb(value), 0.2]
  }

  public get showBackground() {
    return this.sliceBackground[3] > 0
  }

  public set showBackground(value) {
    const panel: any = Array.from(this.viewer.display.panels).find((p: any) => p.viewer?.orthographicProjection)
    if (panel && panel.config) {
      panel.config.layout.useNehubaPerspective.drawSubstrates.color[3] = value ? 0.2 : 0
    }
    this.nehubaViewer.redraw()
  }

  public toggleShowBackground(value) {
    this.showBackground = value
  }

  public hexToRgb = hex => hex.replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i,(m, r, g, b) => '#' + r + r + g + g + b + b)
    .substring(1).match(/.{2}/g).map(x => parseInt(x, 16))

}
