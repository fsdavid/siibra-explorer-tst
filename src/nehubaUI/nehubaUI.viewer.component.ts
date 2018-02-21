import { Input,AfterViewInit, HostListener,OnDestroy,ComponentRef,Directive,Type,OnInit,Component,ComponentFactoryResolver,ViewChild,ViewContainerRef, ElementRef }from '@angular/core'
import { Observable } from 'rxjs/Rx'

import { Config as NehubaViewerConfig,NehubaViewer,createNehubaViewer,vec3, sliceRenderEventType, SliceRenderEventDetail } from 'nehuba/exports'

import { Animation,EXTERNAL_CONTROL as gExternalControl, MainController, TEMP_RECEPTORDATA_BASE_URL } from './nehubaUI.services'
import { RegionDescriptor, ParcellationDescriptor, TemplateDescriptor, Landmark } from './nehuba.model'
import { FloatingPopOver } from 'nehubaUI/nehubaUI.floatingPopover.component';
import { UI_CONTROL,VIEWER_CONTROL } from './nehubaUI.services'

declare var window:{
  [key:string] : any
  prototype : Window;
  new() : Window;
}

@Directive({
  selector : '[nehuba-viewer-host]'
})

export class NehubaViewerDirective{
  constructor(public viewContainerRef:ViewContainerRef){}
}

@Component({
  selector : 'NehubaViewer',
  template:`
    <ng-template nehuba-viewer-host>
    </ng-template>
  `,
  styles : [
    `
    `
  ]
})

export class NehubaViewerInnerContainer implements OnInit,AfterViewInit{

  @ViewChild(NehubaViewerDirective) host : NehubaViewerDirective
  nehubaViewerComponent : NehubaViewerComponent
  componentRef : ComponentRef<any>
  viewContainerRef : ViewContainerRef
  private templateLoaded : boolean = false
  darktheme : boolean = false

  colorMap : Map<number,{}>

  private onViewerInitHook : (()=>void)[] = []
  private afterviewerInitHook : (()=>void)[] = []

  private onParcellationSelectionHook : (()=>void)[] = []
  private afterParcellationSelectionHook : (()=>void)[] = []

  constructor(public mainController:MainController, private componentFactoryResolver: ComponentFactoryResolver ){
    
    /* TODO reduce complexity, as to not having multiple VIEW_CONTROL objects floating around */
    VIEWER_CONTROL.loadTemplate = (templateDescriptor:TemplateDescriptor) => {
      /* TODO implement a check that each el in the hooks are still defined and are fn's */
      this.onViewerInitHook.forEach(fn=>fn())
      this.loadTemplate(templateDescriptor.nehubaConfig)
      this.afterviewerInitHook.forEach(fn=>fn())
    }
    VIEWER_CONTROL.onViewerInit = (cb:()=>void) => this.onViewerInit(cb)
    VIEWER_CONTROL.afterViewerInit = (cb:()=>void) => this.afterViewerInit(cb)
    UI_CONTROL.onParcellationSelection = (cb:()=>void) => this.onParcellationSelection(cb)
    UI_CONTROL.afterParcellationSelection = (cb:()=>void) => this.afterParcellationSelection(cb)
    VIEWER_CONTROL.showSegment = (seg) => this.showSegment(seg)
    VIEWER_CONTROL.hideSegment = (seg) => this.hideSegment(seg)
    VIEWER_CONTROL.hideAllSegments = () => this.hideAllSegments()
    VIEWER_CONTROL.showAllSegments = () => this.showAllSegments()
    VIEWER_CONTROL.moveToNavigationLoc = (loc:number[],realSpace?:boolean) => this.moveToNavigationLoc(loc,realSpace)
    VIEWER_CONTROL.loadLayer = (layerObj:Object) => this.loadLayer(layerObj)

    this.mainController.viewerControl.hideAllSegments = () => this.hideAllSegments()
    this.mainController.viewerControl.showSegment = (segId) => this.showSegment(segId)
    this.mainController.viewerControl.showAllSegments = () => this.showAllSegments()
    this.mainController.viewerControl.loadLayer = (layerObj) => this.loadLayer(layerObj)
  }

  /**
   * attaches an onViewerInit callback.
   */
  public onViewerInit = (cb:()=>void) => this.onViewerInitHook.push(cb)

  /**
   * attaches an afterViewerInit callback
   */
  public afterViewerInit = (cb:()=>void)=> this.afterviewerInitHook.push(cb)

  /**
   * attaches an on parcellation selection callback
   */
  public onParcellationSelection = (cb:()=>void)=> this.onParcellationSelectionHook.push(cb)

  /**
   * attaches an after parcellation selection callback
   */
  public afterParcellationSelection = (cb:()=>void)=> this.afterParcellationSelectionHook.push(cb)

  /**
   * attaches an onViewerDestory callback. 
   * If no viewer is initiated, callback will be fired immediately.
   * NB onViewerInit callback will be called before onViewerDestory callback
   */
  public onViewerDestroy = (cb:()=>void)=>{
    if(!this.templateLoaded){
      cb()
    }else{
      this.componentRef.onDestroy(()=>{
        cb()
      })
    }
  }

  /**
   * Teleport to new location
   */
  public setNavigationLoc = (loc:number[],realSpace?:boolean)=>{
    this.nehubaViewerComponent.nehubaViewer.setPosition(vec3.fromValues(loc[0],loc[1],loc[2]),realSpace)
  }

  /**
   * teleport to a new orientation
   */
  public setNavigationOrientation = (_ori:number[])=>{
    /* waiting for proper api */
  }

  /**
   * Animation moving to new location
   */
  public moveToNavigationLoc = (loc:number[],realSpace?:boolean)=>{
    if(this.templateLoaded){
      this.nehubaViewerComponent.navigate(loc,300,realSpace?realSpace:false)
    }
  }

  ngOnInit(){
    this.viewContainerRef = this.host.viewContainerRef
  }

  ngAfterViewInit(){
    UI_CONTROL.afterTemplateSelection(()=>{
      this.darktheme = gExternalControl.metadata.selectedTemplate ? gExternalControl.metadata.selectedTemplate.useTheme == 'dark' : false;
      (<NehubaViewerComponent>this.componentRef.instance).darktheme = this.darktheme
    })
  }

  private loadTemplate(nehubaViewerConfig:NehubaViewerConfig){

    if ( this.templateLoaded ){
      /* I'm not too sure what does the dispose method do (?) */
      /* TODO: use something other than a flag? */
      (<NehubaViewerComponent>this.componentRef.instance).nehubaViewer.dispose()
      this.componentRef.destroy()
    }

    let newNehubaViewerUnit = new NehubaViewerUnit(NehubaViewerComponent,nehubaViewerConfig)
    let nehubaViewerFactory = this.componentFactoryResolver.resolveComponentFactory( newNehubaViewerUnit.component )
    this.componentRef = this.viewContainerRef.createComponent( nehubaViewerFactory );
    
    this.nehubaViewerComponent = <NehubaViewerComponent>this.componentRef.instance
    this.nehubaViewerComponent.createNewNehubaViewerWithConfig(nehubaViewerConfig)
    this.nehubaViewerComponent.darktheme = this.darktheme

    this.templateLoaded = true
  }

  public showSegment(segID:any){
    this.nehubaViewerComponent.showSeg(segID)
  }

  public hideSegment(segID:any){
    this.nehubaViewerComponent.hideSeg(segID)
  }

  public showAllSegments(){
    this.nehubaViewerComponent.allSeg(true)
  }

  public hideAllSegments(){
    this.nehubaViewerComponent.allSeg(false)
  }

  public loadLayer(layerObj:Object){
    this.nehubaViewerComponent.loadLayer(layerObj)
  }
}

@Component({
  template : `
    <div 
      (contextmenu)="showFloatingPopover($event)"
      id = "neuroglancer-container" 
      [ngClass]="{darktheme : darktheme}"
      #container>
    </div>
    
    <div id = "nehubaui-overlay" #nehubaUiOverlay>
      <nehubaui-overlay 
        [nanometersToOffsetPixelsFn] = "nanometersToOffsetPixelsFn[0]"
        class = "nehubaui-overlay-c" 
        id = "nehubaui-overlay-c1">
      </nehubaui-overlay>
      <nehubaui-overlay 
        [nanometersToOffsetPixelsFn] = "nanometersToOffsetPixelsFn[1]"
        class = "nehubaui-overlay-c" 
        id = "nehubaui-overlay-c2">
      </nehubaui-overlay>
      <nehubaui-overlay 
        [nanometersToOffsetPixelsFn] = "nanometersToOffsetPixelsFn[2]"
        class = "nehubaui-overlay-c" 
        id = "nehubaui-overlay-c3">
      </nehubaui-overlay>
      <nehubaui-overlay 
        class = "nehubaui-overlay-c" 
        id = "nehubaui-overlay-c4">
      </nehubaui-overlay>
    </div>
    <div [ngClass] = "{darktheme : darktheme}" id = "viewerStatus">

      <span nametagSelectedRegions>
        Selected Regions : 
      </span>
      <div class = "row" *ngIf="mainController.selectedRegions.length == 0">
        <i class = "col-sm-12 col-md-12 col-lg-12 text-muted" >No Region Selected </i>
      </div>
      <div
        class = "row"
        *ngFor = "let selectedRegion of mainController.selectedRegions">
        
        <div class = "col-sm-12 col-md-12 col-lg-12">
          {{selectedRegion.name}} 
        </div>
        <div class = "col-md-12 col-sm-12 col-lg-12" [innerHTML]="dynamicData(selectedRegion)">
          dynamic content here
        </div>
      </div>

      <br *ngIf="mainController.viewingMode == 'Receptor Data'" />
      <div class = "row" *ngIf="mainController.viewingMode == 'Receptor Data'" >
        <receptorDataDriver (receptorString)="setReceptorString($event)">
        </receptorDataDriver>
      </div>

      <br />
      <span>
        Hovering : {{!viewerSegment ? '' : viewerSegment.constructor.name == 'Number' ? '' : viewerSegment.name   }}
      </span>
      <br /><br />
      Mode : {{ mainController.viewingMode }}
      <br />
      <span 
        class = "btn btn-link"
        (click)="statusPanelRealSpace = !statusPanelRealSpace">
        {{statusPanelRealSpace ? 'RealSpace(mm)' : 'VoxelSpace'}}
      </span>

      <br />
      Navigation: <small>(
        {{
          statusPanelRealSpace ? 
            (viewerPosReal[0] | nmToMm | number) : 
            viewerPosVoxel[0]
        }},
        {{
          statusPanelRealSpace ? 
            (viewerPosReal[1] | nmToMm | number) : 
            viewerPosVoxel[1]
        }},
        {{
          statusPanelRealSpace ? 
            (viewerPosReal[2] | nmToMm | number) : 
            viewerPosVoxel[2]
        }}
      )</small> 

      <br />
      Mouse: <small>(
        {{
          statusPanelRealSpace ? 
            (mousePosReal[0] | nmToMm | number) : 
            mousePosVoxel[0]
        }},
        {{
          statusPanelRealSpace ? 
            (mousePosReal[1] | nmToMm | number) : 
            mousePosVoxel[1]
        }},
        {{
          statusPanelRealSpace ? 
            (mousePosReal[2] | nmToMm | number) : 
            mousePosVoxel[2]
        }}
      )</small> 
    </div>
    <floatingPopover>
    </floatingPopover>
  `,
  styles : [
    `
    div#neuroglancer-container
    {
      width:100%;
      height:100%;
      position:absolute;
      top:0px;
      left:0px;
      z-index:1;
    }
    div#nehubaui-overlay
    {
      width:100%;
      height:100%;
      position:absolute;
      top:0px;
      left:0px;
      z-index:2;
      display:grid;
      grid-template-columns : 50% 50%;
      grid-template-rows : 50% 50%;
      pointer-events:none;
    }

    .nehubaui-overlay-c
    {
      grid-column-end : span 1;
      grid-row-end : span 1;

      overflow:hidden;
      position:relative;
    }

    #nehubaui-overlay-c1
    {
      grid-column-start : 1;
      grid-row-start : 1;
    }
    #nehubaui-overlay-c2
    {
      grid-column-start : 2;
      grid-row-start : 1;
    }
    #nehubaui-overlay-c3
    {
      grid-column-start : 1;
      grid-row-start : 2;
    }
    #nehubaui-overlay-c4
    {
      grid-column-start : 2;
      grid-row-start : 2;
    }

    span[nametagSelectedRegions]
    {
      margin-bottom:0.5em;
    }
    div#viewerStatus
    {
      position:absolute;
      left:1em;
      bottom:1em;
      z-index:9;
      width:13em;
      overflow:hidden;
      box-sizing: border-box;
      padding:0.5em;
      white-space: nowrap;
      font-size-adjust:0.5;
    }

      div#viewerStatus .btn-link
      {
        padding: 0px;
      }

    `
  ]
})
export class NehubaViewerComponent implements OnDestroy,AfterViewInit{
  public nehubaViewer : NehubaViewer
  viewerConfig : NehubaViewerConfig
  darktheme : boolean
  sliceViewZoom : number
  viewerPosReal : number[] = [0,0,0]
  viewerPosVoxel : number[] = [0,0,0]
  viewerOri : number[] = [0,0,1,0]
  viewerSegment : RegionDescriptor | number | null
  mousePosReal :  number[] = [0,0,0]
  mousePosVoxel :  number[] = [0,0,0]

  statusPanelRealSpace : boolean = true

  segmentListener : any = {}

  nanometersToOffsetPixelsFn : Function[] = [()=>{},()=>{}, ()=>{}]

  @HostListener('document:mousedown',['$event'])
  clearContextmenu(_ev:any){
    if(this.floatingPopover.contextmenuEvent)this.floatingPopover.contextmenuEvent=null
  }

  @ViewChild(FloatingPopOver) floatingPopover : FloatingPopOver
  @ViewChild('container',{read:ElementRef}) viewerContainer : ElementRef

  onDestroyUnsubscribe : any[] = []
  heartbeatObserver : any

  constructor(private mainController:MainController){

    // const metadata = gExternalControl.metadata

    // UI_CONTROL.afterParcellationSelection(()=>{
    //   /**
    //    * applying default colour map.
    //    */
    //   this.nehubaViewer.batchAddAndUpdateSegmentColors(metadata.selectedParcellation!.colorMap)
        
    //   /**
    //    * patching surface parcellation and whole mesh vs single mesh
    //   */
    //   const colorMap = (<ParcellationDescriptor>metadata.selectedParcellation).colorMap
    //   /* TODO patching in surface parcellation */
    //   try{
    //     if( this.viewerConfig.layout!.useNehubaPerspective!.mesh!.surfaceParcellation ){
    //       colorMap.set(65535,{red:255,green:255,blue:255})
    //       this.nehubaViewer.batchAddAndUpdateSegmentColors(colorMap)
    //       this.nehubaViewer.setMeshesToLoad([65535,...Array.from(colorMap.keys())])
    //     }else{
    //       this.nehubaViewer.setMeshesToLoad(Array.from(colorMap.keys()))
    //     }
    //   }catch(e){
    //     console.log('loading surface parcellation error ',e)
    //   }

    //   // const parcellationName = _evPk.body.parcellation.ngId
    //   const shownSegmentObs = this.nehubaViewer.getShownSegmentsObservable()
    //   const shownSegmentObsSubscription = shownSegmentObs.subscribe((ev:number[])=>{
    //     /**
    //      * attach regionSelection listener and update surface parcellation patch
    //      */
    //     try{
    //       const newColorMap = new Map<number,{red:number,green:number,blue:number}>()
    //       const selectedParcellation = <ParcellationDescriptor>metadata.selectedParcellation
    //       if( this.viewerConfig.layout!.useNehubaPerspective!.mesh!.surfaceParcellation ){

    //         selectedParcellation.colorMap.forEach((activeColor,key)=>{
    //           newColorMap.set(key,ev.find(segId=>segId==key)?activeColor:{red:255,green:255,blue:255})
    //         })
    //         this.nehubaViewer.clearCustomSegmentColors()
    //         this.nehubaViewer.batchAddAndUpdateSegmentColors(ev.length == 0 ? selectedParcellation.colorMap : newColorMap)
    //       }else{
    //         // this.nehubaViewer.setMeshesToLoad( ev.length == 0 ? Array.from(selectedParcellation.colorMap.keys()) : ev )
    //         // this.nehubaViewer.setMeshesToLoad(ev)
    //       }
    //     }catch(e){
    //       console.log('toggling regions error surface parcellation ')
    //       throw e
    //     }

    //     gExternalControl.viewControl.next(new EventPacket('selectRegions','',102,{source:'viewer',regions:ev.map((id:any)=>({labelIndex:id}))}))
    //   })
    //   this.onDestroyUnsubscribe.push(shownSegmentObsSubscription)
    // })
  }

  public ngOnDestroy(){
    this.onDestroyUnsubscribe.forEach((subscription:any)=>subscription.unsubscribe())
    this.nehubaViewer.dispose()
    window['nehubaViewer'] = null
  }

  public ngAfterViewInit(){
  }

  public setReceptorString(ev:string|null){
    this.mainController.receptorString = ev
  }

  public createNewNehubaViewerWithConfig(config:NehubaViewerConfig){

    this.viewerConfig = config

    /* TODO potentially setting metadata before it was defined (?) */
    const metadata = gExternalControl.metadata
    this.nehubaViewer = createNehubaViewer(config,(err)=>{
      /* TODO: error handling?*/
      console.log('createnehubaviewer error handler',err)
    })

    this.mainController.nehubaViewer = this.nehubaViewer

    this.nehubaViewer.applyInitialNgState()

    /**
     * preventing errors such as visibleLayer of null/undefined
     */
    setTimeout(()=>{

      this.nehubaViewer.redraw()
      this.nehubaViewer.relayout()
      
      /* redraw/relayout is async */
      setTimeout(()=>{

        /* listens to custom events from neuroglancer-panel
          whenever it fires, updates the position of existing landmarks
        */
        (<HTMLElement>this.viewerContainer.nativeElement).querySelectorAll('.neuroglancer-panel').forEach(panel=>{
          
          Observable.fromEvent(panel,sliceRenderEventType).map(it=>it as CustomEvent)
            .subscribe(ev=>{
              const el = ev.target as HTMLElement
              const detail = ev.detail as SliceRenderEventDetail
              /* TODO this is a terrible way of identifying panels */
              el.offsetLeft < 5 ? 
                el.offsetTop < 5 ?
                  this.nanometersToOffsetPixelsFn[0] = detail.nanometersToOffsetPixels :
                  this.nanometersToOffsetPixelsFn[2] = detail.nanometersToOffsetPixels :
                el.offsetTop < 5 ?
                  this.nanometersToOffsetPixelsFn[1] = detail.nanometersToOffsetPixels :
                  (console.log('observable fired from perspective panel'))
            })
        })
      })
    })

    /**
     * attaching the mouse/navigation real/voxel listeners
     */
    const mouseRealSubscription = this.nehubaViewer.mousePosition.inRealSpace.subscribe((pos:any)=>this.mousePosReal = pos ? pos : this.mousePosReal)
    this.onDestroyUnsubscribe.push(mouseRealSubscription)
    const mouseVoxelSubscription = this.nehubaViewer.mousePosition.inVoxels.subscribe((pos:any)=>this.mousePosVoxel = pos ? pos :this.mousePosVoxel)
    this.onDestroyUnsubscribe.push(mouseVoxelSubscription)
    
    const navigationSubscription = this.nehubaViewer.navigationState.position.inRealSpace.subscribe((pos:any)=>{
      this.viewerPosReal = pos
      
      /* spatial query */
      const container = (<HTMLElement>this.viewerContainer.nativeElement)
      const width = Math.max(container.clientHeight/4,container.clientWidth/4) * this.sliceViewZoom / 1000000
      /* width in mm */
      this.mainController.querySpatialData(this.viewerPosReal.map(num=>num/1000000) as [number,number,number],width,`Colin 27`)
    })
    this.onDestroyUnsubscribe.push( navigationSubscription )
    const navigationSubscriptionVoxel = this.nehubaViewer.navigationState.position.inVoxels.subscribe((pos:any)=>this.viewerPosVoxel=pos)
    this.onDestroyUnsubscribe.push( navigationSubscriptionVoxel )
    
    const zoomSub = this.nehubaViewer.navigationState.sliceZoom.subscribe((zoom:any)=>{
      this.sliceViewZoom = zoom
    
      /* spatial query */
      const container = (<HTMLElement>this.viewerContainer.nativeElement)
      const width = Math.max(container.clientHeight/4,container.clientWidth/4) * this.sliceViewZoom / 1000000
      /* width in mm */
      this.mainController.querySpatialData(this.viewerPosReal.map(num=>num/1000000) as [number,number,number],width,`Colin 27`)
    })
    this.onDestroyUnsubscribe.push( zoomSub )

    const segmentListener = this.nehubaViewer.mouseOver.image
      .subscribe(ev=>{
        this.segmentListener[ev.layer.name] = ev.value
      })
    this.onDestroyUnsubscribe.push(segmentListener)
    /**
     * attaches viewerSegmentHover listener
     */
    const iterativeSearch = (regions:RegionDescriptor[],labelIndex:number):Promise<RegionDescriptor> => new Promise((resolve)=>{
      const find = regions.find(region=>region.labelIndex==labelIndex)
      if(find)resolve(find)
      Promise.race(regions.map(region=>iterativeSearch(region.children,labelIndex)))
        .then(region=>resolve(region))
    })
    const regionObserverSubscription = this.nehubaViewer.mouseOver.segment.subscribe((seg:any)=>{
      /* seg.segment = number | 0 | null seg.layer */

      /* TODO potentially generating some unresolvable promises here */
      if(seg.segment&&seg.segment!=0){
        this.viewerSegment=seg.segment
        iterativeSearch(metadata.selectedParcellation!.regions,seg.segment)
          .then(region=>this.viewerSegment=region)
          .catch(e=>console.log(e))
      }else{
        this.viewerSegment=null
      }
    })
    this.onDestroyUnsubscribe.push(regionObserverSubscription)

    window['nehubaViewer'] = this.nehubaViewer

    this.heartbeatObserver = 
      this.nehubaViewer.mouseOver.segment
        .merge(this.nehubaViewer.navigationState.sliceZoom)
        .merge(this.nehubaViewer.navigationState.perspectiveZoom)
        .subscribe((_ev:any)=>{
          //console.log('debug heartbeat',ev)
        })
    this.onDestroyUnsubscribe.push(this.heartbeatObserver)
  }

  public dynamicData(selectedData:RegionDescriptor):string{
    switch(this.mainController.viewingMode){
      case 'navigation (default mode)':
        return ``
      case 'Probability Map':{
        const value = this.segmentListener[this.mainController.selectedParcellation!.ngId + selectedData.name]
        return `&nbsp;&nbsp;Encoded value: ${ value ? Math.round(value * 1000)/1000 : ''}`
      }
      case 'Receptor Data' : 
        return this.mainController.nehubaViewer.getShownSegmentsNow().length == 0 ? `` : this.checkIdxForReceptorData(selectedData)
      default :
        return ``
    }
  }

  private checkIdxForReceptorData(m:RegionDescriptor):string{
    if(m.moreInfo.findIndex(info=>info.name=='Receptor Data')>= 0){
      if(this.mainController.receptorString){
        const imgSrc = TEMP_RECEPTORDATA_BASE_URL + m.moreInfo.find(i=>i.name=='Receptor Data')!.source + this.mainController.receptorString
        return `<img src = "${imgSrc}" style = "width:100%" />`
      }else{
        return `&nbsp;&nbsp;receptor data found ...`
      }
    }else{
      return `&nbsp;&nbsp;<i class = "text-muted">receptor data found</i>`
    }
  }

  // private returnReceptorData(regionInfo:DescriptorMoreInfoItem):string{
  //   regionInfo
  //   return ``
  // }

  public loadParcellation(_parcellation:ParcellationDescriptor){

  }

  public navigate(pos:number[],duration:number,realSpace:boolean){
    /* TODO: waiting on nehubaViewer api to implement rotation */
    
    if( duration>0 ){
      /* slice is required to make clones of the values */
      /* or else the values (startPos/deltaPos) will change mid-animation */
      let deltaPos = ([
        pos[0]-this.viewerPosReal[0],
        pos[1]-this.viewerPosReal[1],
        pos[2]-this.viewerPosReal[2]
      ]).slice()
      let startPos = (this.viewerPosReal).slice()
  
      let iterator = (new Animation(duration,'linear')).generate()
      let newAnimationFrame = () =>{
        let iteratedValue = iterator.next()
        this.nehubaViewer.setPosition(vec3.fromValues(
          startPos[0]+deltaPos[0]*iteratedValue.value,
          startPos[1]+deltaPos[1]*iteratedValue.value,
          startPos[2]+deltaPos[2]*iteratedValue.value
        ),realSpace)
        if(!iteratedValue.done){
          requestAnimationFrame(newAnimationFrame)
        }
      }
      requestAnimationFrame(newAnimationFrame)
    }else{
      this.nehubaViewer.setPosition(vec3.fromValues(pos[0],pos[1],pos[2]),realSpace)
    }
  }

  public showSeg(id:number){
    this.nehubaViewer.showSegment(id)
  }

  public hideSeg(id:number){
    this.nehubaViewer.hideSegment(id)
  }

  public allSeg(show:boolean){
    this.nehubaViewer.getShownSegmentsNow().forEach(segID => {
      this.nehubaViewer.hideSegment(segID)
    })
    if( !show ) {
      this.nehubaViewer.showSegment(0)
    }
  }

  //TODO: do this properly with proper api's
  public loadLayer(layerObj:Object){
    const state = (<NehubaViewer>window['nehubaViewer']).ngviewer.state.toJSON()
    Object.keys(layerObj).forEach(key=>state.layers[key]=(<any>layerObj)[key])
    this.nehubaViewer.ngviewer.state.restoreState(state)
  }

  public showFloatingPopover = (ev:any)=> {
    this.floatingPopover.cursorSegment = this.viewerSegment
    this.floatingPopover.cursorLocReal = this.mousePosReal
    this.floatingPopover.cursorLocVoxel = this.mousePosVoxel
    this.floatingPopover.contextmenuEvent = ev
  }
}

export class NehubaViewerUnit{
  viewerConfig : NehubaViewerConfig
  darktheme : boolean

  constructor(public component:Type<any>,viewerConfig:NehubaViewerConfig){  
    this.viewerConfig = viewerConfig
  }
}

@Component({
  selector : `nehubaui-overlay`,
  template : 
  `
  <span 
    [ngStyle] = "styleLandmark(landmark)"
    *ngFor="let landmark of mainController.landmarks"
    class="glyphicon glyphicon-map-marker"
    [tooltip]=" landmark.properties | jsonStringifyPipe"
    >
  </span>
  `,
  styles : [
    `
    .glyphicon
    {
      position:absolute;
      width:1em;
      height:1em;
      margin-top:-0.5em;
      margin-left:-0.5em;
      top:10px;
      left:10px;
      pointer-events:auto;
    }
    `
  ]
})

export class NehubaViewerOverlayUnit{
  @Input() nanometersToOffsetPixelsFn : Function 

  constructor(public mainController:MainController){
  }

  styleLandmark(landmark:Landmark){
    if(this.nanometersToOffsetPixelsFn){

      /* calculate the offset thanks to nehuba magic */
      const vec = this.nanometersToOffsetPixelsFn(landmark.pos.map((pt:number)=>pt*1000000) as any)
      const scale = Math.atan( 100.0 / ( 100.0 + vec[2])) / (Math.PI / 2) * 100.0
      
      if(scale>100.0){
        return({
          display:`none`
        })
      }

      /* check if the marker is inside the panel */
      // const dist = ( 1.0 - Math.abs( scale / 50.0  - 1.0 ) ) * 255.0
      const dist = scale / 100.0 * 255.0
      const a = dist / 255.0

      /* apply color */
      const r = Math.round(Math.min(255,dist*8/3))
      const g = Math.round(Math.min(255,Math.max(0,dist*8/3-255)))
      const b = Math.round(Math.min(255,Math.max(4/3*dist-255,0)))
      // marker.style.color = `rgba(${ r },${ g },${ b },${ a })`

      return ({
        'top' : `${vec[1]}px`,
        'left' : `${vec[0]}px`,
        'font-size' : `${ scale * 1.5 }%`,
        'color' : `rgba(${r},${g},${b},${a})`
      })

    } else {
      return({
        display:'none'
      })
    }
  }
}