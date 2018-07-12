import { Component, HostBinding, ViewChild, ViewContainerRef, ComponentFactoryResolver, ComponentFactory, OnDestroy, ElementRef, Injector, ComponentRef, AfterViewInit, OnInit, TemplateRef, HostListener, Renderer2 } from "@angular/core";
import { Store, select } from "@ngrx/store";
import { ViewerStateInterface, safeFilter, OPEN_SIDE_PANEL, CLOSE_SIDE_PANEL, isDefined,UNLOAD_DEDICATED_LAYER } from "../services/stateStore.service";
import { Observable, Subscription } from "rxjs";
import { map, filter, distinctUntilChanged } from "rxjs/operators";
import { AtlasViewerDataService } from "./atlasViewer.dataService.service";
import { WidgetServices } from "./widgetUnit/widgetService.service";
import { DataBrowserUI } from "../ui/databrowser/databrowser.component";
import { LayoutMainSide } from "../layouts/mainside/mainside.component";
import { Chart } from 'chart.js'
import { AtlasViewerConstantsServices, SUPPORT_LIBRARY_MAP } from "./atlasViewer.constantService.service";
import { BsModalService } from "ngx-bootstrap/modal";
import { ModalUnit } from "./modalUnit/modalUnit.component";
import { AtlasViewerURLService } from "./atlasViewer.urlService.service";
import { ToastComponent } from "../components/toast/toast.component";
import { WidgetUnit } from "./widgetUnit/widgetUnit.component";
import { AtlasViewerAPIServices } from "./atlasViewer.apiService.service";
import { PluginServices } from "./atlasViewer.pluginService.service";

import '../res/css/extra_styles.css'
import { NehubaContainer } from "../ui/nehubaContainer/nehubaContainer.component";

@Component({
  selector: 'atlas-viewer',
  templateUrl: './atlasViewer.template.html',
  styleUrls: [
    `./atlasViewer.style.css`
  ]
})

export class AtlasViewer implements OnDestroy, OnInit, AfterViewInit {

  @ViewChild('dockedContainer', { read: ViewContainerRef }) dockedContainer: ViewContainerRef
  @ViewChild('floatingContainer', { read: ViewContainerRef }) floatingContainer: ViewContainerRef
  @ViewChild('databrowser', { read: ElementRef }) databrowser: ElementRef
  @ViewChild('temporaryContainer', { read: ViewContainerRef }) temporaryContainer: ViewContainerRef
  @ViewChild('toastContainer', { read: ViewContainerRef }) toastContainer: ViewContainerRef
  @ViewChild('dedicatedViewerToast', { read: TemplateRef }) dedicatedViewerToast: TemplateRef<any>
  @ViewChild('floatingMouseContextualContainer', { read: ViewContainerRef }) floatingMouseContextualContainer: ViewContainerRef
  @ViewChild('pluginFactory', { read: ViewContainerRef }) pluginViewContainerRef: ViewContainerRef
  @ViewChild(LayoutMainSide) layoutMainSide: LayoutMainSide

  @ViewChild(NehubaContainer) nehubaContainer: NehubaContainer

  @HostBinding('attr.darktheme')
  darktheme: boolean = false

  meetsRequirement: boolean = true

  toastComponentFactory: ComponentFactory<ToastComponent>
  databrowserComponentFactory: ComponentFactory<DataBrowserUI>
  databrowserComponentRef: ComponentRef<DataBrowserUI>
  private databrowserHostComponentRef: ComponentRef<WidgetUnit>
  private dedicatedViewComponentRef: ComponentRef<ToastComponent>

  private newViewer$: Observable<any>
  public dedicatedView$: Observable<string | null>
  public onhoverSegment$: Observable<string>
  private subscriptions: Subscription[] = []

  constructor(
    private pluginService: PluginServices,
    private rd2: Renderer2,
    private store: Store<ViewerStateInterface>,
    public dataService: AtlasViewerDataService,
    private cfr: ComponentFactoryResolver,
    private widgetServices: WidgetServices,
    private constantsService: AtlasViewerConstantsServices,
    public urlService: AtlasViewerURLService,
    public apiService: AtlasViewerAPIServices,
    private modalService: BsModalService,
    private injector: Injector
  ) {
    this.toastComponentFactory = this.cfr.resolveComponentFactory(ToastComponent)
    this.databrowserComponentFactory = this.cfr.resolveComponentFactory(DataBrowserUI)
    this.databrowserComponentRef = this.databrowserComponentFactory.create(this.injector)

    this.newViewer$ = this.store.pipe(
      select('viewerState'),
      filter(state => isDefined(state) && isDefined(state.templateSelected)),
      map(state => state.templateSelected),
      distinctUntilChanged((t1, t2) => t1.name === t2.name)
    )

    this.dedicatedView$ = this.store.pipe(
      select('viewerState'),
      filter(state => isDefined(state) && typeof state.dedicatedView !== 'undefined'),
      map(state => state.dedicatedView),
      distinctUntilChanged()
    )

    this.onhoverSegment$ = this.store.pipe(
      select('uiState'),
      /* cannot filter by state, as the template expects a default value, or it will throw ExpressionChangedAfterItHasBeenCheckedError */
      map(state => isDefined(state) ?
        state.mouseOverSegment ?
          state.mouseOverSegment.constructor === Number ?
            state.mouseOverSegment.toString() :
            state.mouseOverSegment.name :
          '' :
        ''),
      distinctUntilChanged()
    )
  }

  ngOnInit() {

    this.apiService.interactiveViewer.pluginControl.loadExternalLibraries = (libraries: string[]) => new Promise((resolve, reject) => {
      const srcHTMLElement = libraries.map(libraryName => ({
        name: libraryName,
        srcEl: SUPPORT_LIBRARY_MAP.get(libraryName)
      }))

      const rejected = srcHTMLElement.filter(scriptObj => scriptObj.srcEl === null)
      if (rejected.length > 0)
        return reject(`Some library names cannot be recognised. No libraries were loaded: ${rejected.map(srcObj => srcObj.name).join(', ')}`)

      Promise.all(srcHTMLElement.map(scriptObj => new Promise((rs, rj) => {
        if('customElements' in window && scriptObj.name === 'webcomponentsLite'){
          return rs()
        }
        const existingEntry = this.apiService.loadedLibraries.get(scriptObj.name)
        if (existingEntry) {
          this.apiService.loadedLibraries.set(scriptObj.name, { counter: existingEntry.counter + 1, src: existingEntry.src })
          rs()
        } else {
          const srcEl = scriptObj.srcEl
          srcEl.onload = () => rs()
          srcEl.onerror = (e: any) => rj(e)
          this.rd2.appendChild(document.head, srcEl)
          this.apiService.loadedLibraries.set(scriptObj.name, { counter: 1, src: srcEl })
        }
      })))
        .then(() => resolve())
        .catch(e => (console.warn(e), reject(e)))
    })

    this.apiService.interactiveViewer.pluginControl.unloadExternalLibraries = (libraries: string[]) =>
      libraries
        .filter((stringname) => SUPPORT_LIBRARY_MAP.get(stringname) !== null)
        .forEach(libname => {
          const ledger = this.apiService.loadedLibraries.get(libname!)
          if (!ledger) {
            console.warn('unload external libraries error. cannot find ledger entry...', libname, this.apiService.loadedLibraries)
            return
          }
          if (ledger.src === null) {
            console.log('webcomponents is native supported. no library needs to be unloaded')
            return
          }

          if (ledger.counter - 1 == 0) {
            this.rd2.removeChild(document.head, ledger.src)
            this.apiService.loadedLibraries.delete(libname!)
          } else {
            this.apiService.loadedLibraries.set(libname!, { counter: ledger.counter - 1, src: ledger.src })
          }
        })

    this.meetsRequirement = this.meetsRequirements()

    this.subscriptions.push(
      this.dedicatedView$.subscribe(string => {
        if (string === null) {
          if (this.dedicatedViewComponentRef)
            this.dedicatedViewComponentRef.destroy()
          return
        }
        this.dedicatedViewComponentRef = this.toastContainer.createComponent(this.toastComponentFactory)
        this.dedicatedViewComponentRef.instance.messageContainer.createEmbeddedView(this.dedicatedViewerToast)
        this.dedicatedViewComponentRef.instance.dismissable = false
      })
    )

    this.subscriptions.push(
      this.newViewer$.subscribe(template => {
        this.darktheme = this.meetsRequirement ?
          template.useTheme === 'dark' :
          false

        if (this.databrowserHostComponentRef) {
          this.databrowserHostComponentRef.instance.container.detach(0)
          this.temporaryContainer.insert(this.databrowserComponentRef.hostView)
        }
        this.widgetServices.clearAllWidgets()
        this.databrowserHostComponentRef =
          this.widgetServices.addNewWidget(this.databrowserComponentRef, {
            title: 'Data Browser',
            exitable: false,
            state: 'docked'
          })
      })
    )

    this.subscriptions.push(
      this.store.pipe(
        select('uiState'),
        safeFilter('sidePanelOpen'),
        map(state => state.sidePanelOpen)
      ).subscribe(show =>
        this.layoutMainSide.showSide = show)
    )

    /**
     * Because there is no easy way to display standard deviation natively, use a plugin 
     * */
    Chart.pluginService.register({

      /* patching background color fill, so saved images do not look completely white */
      beforeDraw: (chart) => {
        const ctx = chart.ctx as CanvasRenderingContext2D;
        ctx.fillStyle = this.darktheme ?
          `rgba(50,50,50,0.8)` :
          `rgba(255,255,255,0.8)`

        if (chart.canvas) ctx.fillRect(0, 0, chart.canvas.width, chart.canvas.height)

      },

      /* patching standard deviation for polar (potentially also line/bar etc) graph */
      afterInit: (chart) => {
        if (chart.config.options && chart.config.options.tooltips) {

          chart.config.options.tooltips.callbacks = {
            label: function (tooltipItem, data) {
              let sdValue
              if (data.datasets && typeof tooltipItem.datasetIndex != 'undefined' && data.datasets[tooltipItem.datasetIndex].label) {
                const sdLabel = data.datasets[tooltipItem.datasetIndex].label + '_sd'
                const sd = data.datasets.find(dataset => typeof dataset.label != 'undefined' && dataset.label == sdLabel)
                if (sd && sd.data && typeof tooltipItem.index != 'undefined' && typeof tooltipItem.yLabel != 'undefined') sdValue = Number(sd.data[tooltipItem.index]) - Number(tooltipItem.yLabel)
              }
              return `${tooltipItem.yLabel} ${sdValue ? '(' + sdValue + ')' : ''}`
            }
          }
        }
        if (chart.data.datasets) {
          chart.data.datasets = chart.data.datasets
            .map(dataset => {
              if (dataset.label && /\_sd$/.test(dataset.label)) {
                const originalDS = chart.data.datasets!.find(baseDS => typeof baseDS.label !== 'undefined' && (baseDS.label == dataset.label!.replace(/_sd$/, '')))
                if (originalDS) {
                  return Object.assign({}, dataset, {
                    data: (originalDS.data as number[]).map((datapoint, idx) => (Number(datapoint) + Number((dataset.data as number[])[idx]))),
                    ... this.constantsService.chartSdStyle
                  })
                } else {
                  return dataset
                }
              } else if (dataset.label) {
                const sdDS = chart.data.datasets!.find(sdDS => typeof sdDS.label !== 'undefined' && (sdDS.label == dataset.label + '_sd'))
                if (sdDS) {
                  return Object.assign({}, dataset, {
                    ...this.constantsService.chartBaseStyle
                  })
                } else {
                  return dataset
                }
              } else {
                return dataset
              }
            })
        }
      }
    })
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe())
  }

  ngAfterViewInit() {
    this.widgetServices.floatingContainer = this.floatingContainer
    this.widgetServices.dockedContainer = this.dockedContainer

    this.pluginService.pluginViewContainerRef = this.pluginViewContainerRef
    this.pluginService.appendSrc = (src: HTMLElement) => this.rd2.appendChild(document.head, src)
  }

  meetsRequirements() {

    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl')
    const message: any = {
      Error: 'Your browser does not meet the minimum requirements to run neuroglancer.'
    }

    if (!gl) {
      message['Detail'] = 'Your browser does not support WebGL.'

      this.modalService.show(ModalUnit, {
        initialState: {
          title: message.Error,
          body: message.Detail
        }
      })
      return false
    }

    const drawbuffer = gl.getExtension('WEBGL_draw_buffers')
    const texturefloat = gl.getExtension('OES_texture_float')
    const indexuint = gl.getExtension('OES_element_index_uint')
    if (!(drawbuffer && texturefloat && indexuint)) {

      const detail = `Your browser does not support 
      ${ !drawbuffer ? 'WEBGL_draw_buffers' : ''} 
      ${ !texturefloat ? 'OES_texture_float' : ''} 
      ${ !indexuint ? 'OES_element_index_uint' : ''} `
      message['Detail'] = [detail]

      this.modalService.show(ModalUnit, {
        initialState: {
          title: message.Error,
          body: message.Detail
        }
      })
      return false
    }
    return true
  }

  manualPanelToggle(show: boolean) {
    this.store.dispatch({
      type: show ? OPEN_SIDE_PANEL : CLOSE_SIDE_PANEL
    })
  }

  rafId : number | null

  panelAnimationFlag(flag:boolean){
    const redraw = ()=>{
      if( this.nehubaContainer && this.nehubaContainer.nehubaViewer && this.nehubaContainer.nehubaViewer.nehubaViewer )
        this.nehubaContainer.nehubaViewer.nehubaViewer.redraw()
      this.rafId = requestAnimationFrame(()=>redraw())
    }
    if( flag ){
      if(this.rafId)
        cancelAnimationFrame(this.rafId)
      this.rafId = requestAnimationFrame(()=>redraw())
    }else{
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  clearDedicatedView() {
    this.store.dispatch({
      type: UNLOAD_DEDICATED_LAYER
    })
  }

  mousePos: [number, number] = [0, 0]

  @HostListener('mousemove', ['$event'])
  mousemove(event: MouseEvent) {
    this.mousePos = [event.clientX, event.clientY]
  }

  get floatingMouseContextualContainerTransform() {
    return `translate(${this.mousePos[0]}px,${this.mousePos[1]}px)`
  }
}