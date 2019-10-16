import { Component, OnInit, OnDestroy } from '@angular/core'
import { Store, select } from '@ngrx/store';
import { ViewerConfiguration, VIEWER_CONFIG_ACTION_TYPES } from 'src/services/state/viewerConfig.store'
import { Observable, Subscription, combineLatest } from 'rxjs';
import { map, distinctUntilChanged, startWith, debounceTime, tap } from 'rxjs/operators';
import { MatSlideToggleChange, MatSliderChange } from '@angular/material';
import { NG_VIEWER_ACTION_TYPES, SUPPORTED_PANEL_MODES } from 'src/services/state/ngViewerState.store';
import { isIdentityQuat } from '../nehubaContainer/util';
import { AtlasViewerConstantsServices } from 'src/atlasViewer/atlasViewer.constantService.service';

const GPU_TOOLTIP = `Higher GPU usage can cause crashes on lower end machines`
const ANIMATION_TOOLTIP = `Animation can cause slowdowns in lower end machines`
const MOBILE_UI_TOOLTIP = `Mobile UI enables touch controls`
const ROOT_TEXT_ORDER : [string, string, string, string] = ['Coronal', 'Sagittal', 'Axial', '3D']
const OBLIQUE_ROOT_TEXT_ORDER : [string, string, string, string] = ['Slice View 1', 'Slice View 2', 'Slice View 3', '3D']

@Component({
  selector: 'config-component',
  templateUrl: './config.template.html',
  styleUrls: [
    './config.style.css'
  ]
})

export class ConfigComponent implements OnInit, OnDestroy{

  public GPU_TOOLTIP = GPU_TOOLTIP
  public ANIMATION_TOOLTIP = ANIMATION_TOOLTIP
  public MOBILE_UI_TOOLTIP = MOBILE_UI_TOOLTIP
  public supportedPanelModes = SUPPORTED_PANEL_MODES

  /**
   * in MB
   */
  public gpuLimit$: Observable<number>

  public useMobileUI$: Observable<boolean>
  public animationFlag$: Observable<boolean>
  private subscriptions: Subscription[] = []

  public gpuMin : number = 100
  public gpuMax : number = 1000

  public panelMode$: Observable<string>
  
  private panelOrder: string
  private panelOrder$: Observable<string>
  public panelTexts$: Observable<[string, string, string, string]>

  private viewerObliqueRotated$: Observable<boolean>

  constructor(
    private store: Store<ViewerConfiguration>,
    private constantService: AtlasViewerConstantsServices  
  ) {

    this.useMobileUI$ = this.constantService.useMobileUI$

    this.gpuLimit$ = this.store.pipe(
      select('viewerConfigState'),
      map((config:ViewerConfiguration) => config.gpuLimit),
      distinctUntilChanged(),
      map(v => v / 1e6)
    )

    this.animationFlag$ = this.store.pipe(
      select('viewerConfigState'),
      map((config:ViewerConfiguration) => config.animation),
    )

    this.panelMode$ = this.store.pipe(
      select('ngViewerState'),
      select('panelMode'),
      startWith(SUPPORTED_PANEL_MODES[0])
    )

    this.panelOrder$ = this.store.pipe(
      select('ngViewerState'),
      select('panelOrder')
    )
    
    this.viewerObliqueRotated$ = this.store.pipe(
      select('viewerState'),
      select('navigation'),
      map(navigation => (navigation && navigation.orientation) || [0, 0, 0, 1]),
      debounceTime(100),
      map(isIdentityQuat),
      map(flag => !flag),
      distinctUntilChanged(),
    )

    this.panelTexts$ = combineLatest(
      this.panelOrder$.pipe(
        map(string => string.split('').map(s => Number(s))),
      ),
      this.viewerObliqueRotated$
    ).pipe(
      map(([arr, isObliqueRotated]) => arr.map(idx => (isObliqueRotated ? OBLIQUE_ROOT_TEXT_ORDER : ROOT_TEXT_ORDER)[idx]) as [string, string, string, string]),
      startWith(ROOT_TEXT_ORDER)
    )
  }

  ngOnInit(){
    this.subscriptions.push(
      this.panelOrder$.subscribe(panelOrder => this.panelOrder = panelOrder)
    )
  }

  ngOnDestroy(){
    this.subscriptions.forEach(s => s.unsubscribe())
  }

  public toggleMobileUI(ev: MatSlideToggleChange){
    const { checked } = ev
    this.store.dispatch({
      type: VIEWER_CONFIG_ACTION_TYPES.SET_MOBILE_UI,
      payload: {
        useMobileUI: checked
      }
    })
  }

  public toggleAnimationFlag(ev: MatSlideToggleChange ){
    const { checked } = ev
    this.store.dispatch({
      type: VIEWER_CONFIG_ACTION_TYPES.UPDATE_CONFIG,
      config: {
        animation: checked
      }
    })
  }

  public handleMatSliderChange(ev:MatSliderChange){
    this.store.dispatch({
      type: VIEWER_CONFIG_ACTION_TYPES.UPDATE_CONFIG,
      config: {
        gpuLimit: ev.value * 1e6
      }
    })
  }
  usePanelMode(panelMode: string){
    this.store.dispatch({
      type: NG_VIEWER_ACTION_TYPES.SWITCH_PANEL_MODE,
      payload: { panelMode }
    })
  }

  handleDrop(event:DragEvent){
    event.preventDefault()
    const droppedAttri = (event.target as HTMLElement).getAttribute('panel-order')
    const draggedAttri = event.dataTransfer.getData('text/plain')
    if (droppedAttri === draggedAttri) return
    const idx1 = Number(droppedAttri)
    const idx2 = Number(draggedAttri)
    const arr = this.panelOrder.split('');

    [arr[idx1], arr[idx2]] = [arr[idx2], arr[idx1]]
    this.store.dispatch({
      type: NG_VIEWER_ACTION_TYPES.SET_PANEL_ORDER,
      payload: { panelOrder: arr.join('') }
    })
  }
  handleDragOver(event:DragEvent){
    event.preventDefault()
    const target = (event.target as HTMLElement)
    target.classList.add('onDragOver')
  }
  handleDragLeave(event:DragEvent){
    (event.target as HTMLElement).classList.remove('onDragOver')
  }
  handleDragStart(event:DragEvent){
    const target = (event.target as HTMLElement)
    const attri = target.getAttribute('panel-order')
    event.dataTransfer.setData('text/plain', attri)
    
  }
  handleDragend(event:DragEvent){
    const target = (event.target as HTMLElement)
    target.classList.remove('onDragOver')
  }

  public stepSize: number = 10
}