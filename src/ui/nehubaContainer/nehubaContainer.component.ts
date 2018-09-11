import { Component, ViewChild, ViewContainerRef, ComponentFactoryResolver, ComponentFactory, ComponentRef, OnInit, OnDestroy, ElementRef } from "@angular/core";
import { NehubaViewerUnit } from "./nehubaViewer/nehubaViewer.component";
import { Store, select } from "@ngrx/store";
import { ViewerStateInterface, safeFilter, SELECT_REGIONS, getLabelIndexMap, DataEntry, CHANGE_NAVIGATION, isDefined, MOUSE_OVER_SEGMENT, USER_LANDMARKS, ADD_NG_LAYER, REMOVE_NG_LAYER, SHOW_NG_LAYER, NgViewerStateInterface, HIDE_NG_LAYER } from "../../services/stateStore.service";
import { Observable, Subscription, fromEvent, combineLatest, merge } from "rxjs";
import { filter,map, take, scan, debounceTime, distinctUntilChanged, switchMap, skip } from "rxjs/operators";
import { AtlasViewerAPIServices, UserLandmark } from "../../atlasViewer/atlasViewer.apiService.service";
import { timedValues } from "../../util/generator";

@Component({
  selector : 'ui-nehuba-container',
  templateUrl : './nehubaContainer.template.html',
  styleUrls : [
    `./nehubaContainer.style.css`
  ]
})

export class NehubaContainer implements OnInit, OnDestroy{

  @ViewChild('container',{read:ViewContainerRef}) container : ViewContainerRef
  @ViewChild('[pos00]',{read:ElementRef}) topleft : ElementRef
  @ViewChild('[pos01]',{read:ElementRef}) topright : ElementRef
  @ViewChild('[pos10]',{read:ElementRef}) bottomleft : ElementRef
  @ViewChild('[pos11]',{read:ElementRef}) bottomright : ElementRef

  private nehubaViewerFactory : ComponentFactory<NehubaViewerUnit>

  public viewerLoaded : boolean = false

  private newViewer$ : Observable<any>
  private selectedParcellation$ : Observable<any>
  private selectedRegions$ : Observable<any[]>
  private hideSegmentations$ : Observable<boolean>

  private fetchedSpatialDatasets$ : Observable<any[]>
  private userLandmarks$ : Observable<UserLandmark[]>
  public onHoverSegmentName$ : Observable<string>
  public onHoverSegment$ : Observable<any>

  private navigationChanges$ : Observable<any>
  public spatialResultsVisible$ : Observable<boolean>
  private spatialResultsVisible : boolean = false

  private selectedTemplate : any | null
  private selectedRegionIndexSet : Set<number> = new Set()
  public fetchedSpatialData : DataEntry[] = []

  private ngLayersRegister : NgViewerStateInterface = {layers : [], forceShowSegment: null}
  private ngLayers$ : Observable<NgViewerStateInterface>
  private selectedParcellationNgId : string
  public selectedParcellation : any | null

  private cr : ComponentRef<NehubaViewerUnit>
  public nehubaViewer : NehubaViewerUnit
  private regionsLabelIndexMap : Map<number,any> = new Map()
  
  private userLandmarks : UserLandmark[] = []
  
  private subscriptions : Subscription[] = []
  private nehubaViewerSubscriptions : Subscription[] = []

  public nanometersToOffsetPixelsFn : Function[] = []

  public combinedSpatialData$ : Observable<any[]>

  constructor(
    private apiService :AtlasViewerAPIServices,
    private csf:ComponentFactoryResolver,
    private store : Store<ViewerStateInterface>,
    private elementRef : ElementRef
  ){
    this.nehubaViewerFactory = this.csf.resolveComponentFactory(NehubaViewerUnit)

    this.newViewer$ = this.store.pipe(
      select('viewerState'),
      filter(state=>isDefined(state) && isDefined(state.templateSelected)),
      filter(state=>
        !isDefined(this.selectedTemplate) || 
        state.templateSelected.name !== this.selectedTemplate.name)
    )

    this.selectedParcellation$ = this.store.pipe(
      select('viewerState'),
      safeFilter('parcellationSelected'),
      map(state=>state.parcellationSelected),
      distinctUntilChanged()
    )

    this.selectedRegions$ = this.store.pipe(
      select('viewerState'),
      safeFilter('regionsSelected'),
      map(state=>state.regionsSelected)
    )

    this.fetchedSpatialDatasets$ = this.store.pipe(
      select('dataStore'),
      safeFilter('fetchedSpatialData'),
      debounceTime(300),
      map(state=>state.fetchedSpatialData)
    )

    this.navigationChanges$ = this.store.pipe(
      select('viewerState'),
      safeFilter('navigation'),
      map(state=>state.navigation)
    )

    this.spatialResultsVisible$ = this.store.pipe(
      select('spatialSearchState'),
      map(state=> isDefined(state) ?
        isDefined(state.spatialDataVisible) ?
          state.spatialDataVisible :
          true :
        true),
      distinctUntilChanged()
    )

    this.userLandmarks$ = this.store.pipe(
      select('viewerState'),
      // filter(state => isDefined(state) && isDefined(state.userLandmarks)),
      map(state => isDefined(state) && isDefined(state.userLandmarks)
        ? state.userLandmarks
        : [])
    )

    const segmentsUnchangedChanged = (s1,s2)=>
      !(typeof s1 === typeof s2 ?
        typeof s2 === 'undefined' ?
          false :
          typeof s2 === 'number' ?
            s2 !== s1 :
            s1 === s2 ?
              false :
              s1 === null || s2 === null ?
                true :
                s2.name !== s1.name :
        true)
    

    this.onHoverSegment$ = this.store.pipe(
      select('uiState'),
      filter(state=>isDefined(state)),
      map(state=>state.mouseOverSegment),
      distinctUntilChanged(segmentsUnchangedChanged)
    )

    this.onHoverSegmentName$ = this.store.pipe(
      select('uiState'),
      filter(state=>isDefined(state)),
      map(state=>state.mouseOverSegment ?
        state.mouseOverSegment.constructor === Number ? 
          state.mouseOverSegment.toString() : 
          state.mouseOverSegment.name :
        '' ),
      distinctUntilChanged()
    )

    /* each time a new viewer is initialised, take the first event to get the translation function */
    this.newViewer$.pipe(
      switchMap(() => fromEvent(this.elementRef.nativeElement, 'sliceRenderEvent')
        .pipe(
          scan((acc:Event[],event:Event)=>{
            const target = (event as Event).target as HTMLElement
            const key = target.offsetLeft < 5 && target.offsetTop < 5 ?
              0 :
              target.offsetLeft > 5 && target.offsetTop < 5 ?
                1 :
                target.offsetLeft < 5 && target.offsetTop > 5 ?
                2 :
                  target.offsetLeft > 5 && target.offsetTop > 5 ?
                  3 :
                  4
    
            const _ = {}
            _[key] = event
            return Object.assign({},acc,_)
          },[]),
          filter(v=>{
            const isdefined = (obj) => typeof obj !== 'undefined' && obj !== null
            return (isdefined(v[0]) && isdefined(v[1]) && isdefined(v[2])) 
          }),
          take(1)
        )
      )
    ).subscribe((events)=>{
      [0,1,2].forEach(idx=>this.nanometersToOffsetPixelsFn[idx] = (events[idx] as any).detail.nanometersToOffsetPixels)
    })

    this.combinedSpatialData$ = combineLatest(
      combineLatest(
        this.fetchedSpatialDatasets$,
        this.spatialResultsVisible$
      )
      .pipe(
        map(([datas,visible, ...rest]) => visible ? datas : []),
        map(arr => arr.map(v => Object.assign({}, v, {type : 'spatialSearchLandmark'})))
      ),
      this.userLandmarks$.pipe(
        map(arr => arr.map(v => Object.assign({}, v, {type : 'userLandmark'})))
      )
    ).pipe(map(arr => arr[0].concat(arr[1])))

    this.ngLayers$ = this.store.pipe(
      select('ngViewerState')
    )

    this.hideSegmentations$ = this.ngLayers$.pipe(
      map(state => isDefined(state)
        ? state.layers.findIndex(l => l.mixability === 'nonmixable') >= 0
        : false)
    )
  }

  ngOnInit(){

    this.subscriptions.push(
      combineLatest(
        this.fetchedSpatialDatasets$,
        this.spatialResultsVisible$
      ).subscribe(([fetchedSpatialData,visible])=>{

        this.fetchedSpatialData = fetchedSpatialData
        this.nehubaViewer.removeSpatialSearch3DLandmarks()

        if(visible)
          this.nehubaViewer.addSpatialSearch3DLandmarks(this.fetchedSpatialData.map((data:any)=>data.position))
      })
    )

    this.subscriptions.push(
      this.userLandmarks$.subscribe(landmarks => {
        this.userLandmarks = landmarks
        if(this.nehubaViewer){
          this.nehubaViewer.removeUserLandmarks()
          this.nehubaViewer.addUserLandmarks(landmarks)
        }
      })
    )
    
    this.subscriptions.push(
      this.spatialResultsVisible$.subscribe(visible => this.spatialResultsVisible = visible)
    )

    this.subscriptions.push(
      this.newViewer$.pipe(
        skip(1)
      ).subscribe(() => {

        /* on selecting of new template, remove additional nglayers */
        const baseLayerNames = Object.keys(this.selectedTemplate.nehubaConfig.dataset.initialNgState.layers)
        this.ngLayersRegister.layers
          .filter(layer => baseLayerNames.findIndex(l => l === layer.name) < 0)
          .map(l => l.name)
          .forEach(layerName => {
            this.store.dispatch({
              type : REMOVE_NG_LAYER,
              layer : {
                name : layerName
              }
            })
          })
      })
    )

    /* order of subscription will determine the order of execution */
    this.subscriptions.push(
      this.newViewer$.subscribe((state)=>{

        this.nehubaViewerSubscriptions.forEach(s=>s.unsubscribe())

        this.selectedTemplate = state.templateSelected
        this.createNewNehuba(state.templateSelected)
        const foundParcellation = state.templateSelected.parcellations.find(parcellation=>
          state.parcellationSelected.name === parcellation.name)
        this.handleParcellation(foundParcellation ? foundParcellation : state.templateSelected.parcellations[0])

        const nehubaConfig = state.templateSelected.nehubaConfig
        const initialSpec = nehubaConfig.dataset.initialNgState
        const {layers} = initialSpec
        
        const dispatchLayers = Object.keys(layers).map(key => {
          const layer = {
            name : key,
            source : layers[key].source,
            mixability : layers[key].type === 'image'
              ? 'base'
              : 'mixable',
            visible : typeof layers[key].visible === 'undefined'
              ? true
              : layers[key].visible,
            transform : typeof layers[key].transform === 'undefined'
              ? null
              : layers[key].transform
          }
          this.ngLayersRegister.layers.push(layer)
          return layer
        })

        this.store.dispatch({
          type : ADD_NG_LAYER,
          layer : dispatchLayers
        })
      })
    )

    this.subscriptions.push(
      this.selectedParcellation$.subscribe((this.handleParcellation).bind(this))
    )

    this.subscriptions.push(

      combineLatest(
        this.selectedRegions$,
        this.hideSegmentations$,
        this.ngLayers$.pipe(
          map(state => state.forceShowSegment)
        )
      )
        .subscribe(([regions,hideSegmentFlag,forceShowSegment])=>{
          if(!this.nehubaViewer) return

          /* selectedregionindexset needs to be updated regardless of forceshowsegment */
          this.selectedRegionIndexSet = new Set(regions.map(r=>Number(r.labelIndex)))

          if( forceShowSegment === false || (forceShowSegment === null && hideSegmentFlag) ){
            this.nehubaViewer.hideAllSeg()
            return
          }

          this.selectedRegionIndexSet.size > 0 ?
            this.nehubaViewer.showSegs([...this.selectedRegionIndexSet]) :
            this.nehubaViewer.showAllSeg()
          }
        )
    )


    this.subscriptions.push(
      this.ngLayers$.subscribe(ngLayersInterface => {
        if(!this.nehubaViewer) return

        const newLayers = ngLayersInterface.layers.filter(l => this.ngLayersRegister.layers.findIndex(ol => ol.name === l.name) < 0)
        const removeLayers = this.ngLayersRegister.layers.filter(l => ngLayersInterface.layers.findIndex(nl => nl.name === l.name) < 0)
        
        if(newLayers.length > 0){
          const newLayersObj:any = {}
          newLayers.forEach(obj => newLayersObj[obj.name] = obj)

          if(!this.nehubaViewer.nehubaViewer || !this.nehubaViewer.nehubaViewer.ngviewer){
            this.nehubaViewer.initNiftiLayers.push(newLayersObj)
          }else{
            this.nehubaViewer.loadLayer(newLayersObj)
          }
          this.ngLayersRegister.layers = this.ngLayersRegister.layers.concat(newLayers)
        }

        if(removeLayers.length > 0){
          removeLayers.forEach(l => {
            if(this.nehubaViewer.removeLayer({
              name : l.name
            }))
            this.ngLayersRegister.layers = this.ngLayersRegister.layers.filter(rl => rl.name !== l.name)
          })
        }
      })
    )

    /* setup init view state */
    combineLatest(
      this.navigationChanges$,
      this.selectedRegions$,
    ).subscribe(([navigation,regions])=>{
      this.nehubaViewer.initNav = 
        Object.assign({},navigation,{
          positionReal : true
        })
      this.nehubaViewer.initRegions = regions.map(re=>re.labelIndex)

      /* TODO what to do with init nfiti? */
    })

    this.subscriptions.push(
      this.navigationChanges$.subscribe(this.handleDispatchedNavigationChange.bind(this))
    )
  }

  ngOnDestroy(){
    this.subscriptions.forEach(s=>s.unsubscribe())
  }

  returnTruePos(quadrant:number,data:any){
    const pos = quadrant > 2 ?
      [0,0,0] :
      this.nanometersToOffsetPixelsFn && this.nanometersToOffsetPixelsFn[quadrant] ?
        this.nanometersToOffsetPixelsFn[quadrant](data.position.map(n=>n*1e6)) :
        [0,0,0]
    return pos
  }

  // get combinedSpatialData$(){
  //   return (this.fetchedSpatialData
  //     .filter(() => this.spatialResultsVisible)
  //     .map(v => Object.assign({}, v, {type: 'spatial'})) as any[])
  //     .concat(this.userLandmarks.map(v => Object.assign({}, v, {type: 'user'})))
  // }

  getPositionX(quadrant:number,data:any){
    return this.returnTruePos(quadrant,data)[0]
  }
  getPositionY(quadrant:number,data:any){
    return this.returnTruePos(quadrant,data)[1]
  }
  getPositionZ(quadrant:number,data:any){
    return this.returnTruePos(quadrant,data)[2]
  }

  handleMouseEnterLandmark(spatialData:any){
    spatialData.highlight = true
  }

  handleMouseLeaveLandmark(spatialData:any){
    spatialData.highlight = false
  }

  private handleParcellation(parcellation:any){
    this.regionsLabelIndexMap = getLabelIndexMap(parcellation.regions)
    this.nehubaViewer.regionsLabelIndexMap = this.regionsLabelIndexMap
    this.nehubaViewer.parcellationId = parcellation.ngId
    this.selectedParcellationNgId = parcellation.ngId
    this.selectedParcellation = parcellation
  }

  /* related spatial search */
  oldNavigation : any = {}
  spatialSearchPagination : number = 0

  private createNewNehuba(template:any){

    this.apiService.interactiveViewer.viewerHandle = null

    this.viewerLoaded = true
    if( this.cr )
      this.cr.destroy()
    this.container.clear()
    this.cr = this.container.createComponent(this.nehubaViewerFactory)
    this.nehubaViewer = this.cr.instance
    this.nehubaViewer.config = template.nehubaConfig

    this.nehubaViewerSubscriptions.push(
      this.nehubaViewer.debouncedViewerPositionChange.subscribe(this.handleEmittedNavigationChange.bind(this))
    )

    this.nehubaViewerSubscriptions.push(
      this.nehubaViewer.mouseoverSegmentEmitter.subscribe(this.handleEmittedMouseoverSegment.bind(this))
    )

    this.nehubaViewerSubscriptions.push(
      this.nehubaViewer.regionSelectionEmitter.subscribe(region => {
        this.selectedRegionIndexSet.has(region.labelIndex) ?
          this.store.dispatch({
            type : SELECT_REGIONS,
            selectRegions : [...this.selectedRegionIndexSet].filter(idx=>idx!==region.labelIndex).map(idx=>this.regionsLabelIndexMap.get(idx))
          }) :
          this.store.dispatch({
            type : SELECT_REGIONS,
            selectRegions : [...this.selectedRegionIndexSet].map(idx=>this.regionsLabelIndexMap.get(idx)).concat(region)
          })
      })
    )

    this.setupViewerHandleApi()
  }

  private setupViewerHandleApi(){
    this.apiService.interactiveViewer.viewerHandle = {
      setNavigationLoc : (coord,realSpace?)=>this.nehubaViewer.setNavigationState({
        position : coord,
        positionReal : typeof realSpace !== 'undefined' ? realSpace : true
      }),
      /* TODO introduce animation */
      moveToNavigationLoc : (coord,realSpace?)=>this.nehubaViewer.setNavigationState({
        position : coord,
        positionReal : typeof realSpace !== 'undefined' ? realSpace : true
      }),
      setNavigationOri : (quat)=>this.nehubaViewer.setNavigationState({
        orientation : quat
      }),
      /* TODO introduce animation */
      moveToNavigationOri : (quat)=>this.nehubaViewer.setNavigationState({
        orientation : quat
      }),
      showSegment : (labelIndex) => {
        if(!this.selectedRegionIndexSet.has(labelIndex)) 
          this.store.dispatch({
            type : SELECT_REGIONS,
            selectRegions :  [labelIndex, ...this.selectedRegionIndexSet]
          })
      },
      add3DLandmarks : landmarks => {
        if(!landmarks.every(l => isDefined(l.id)))
          throw new Error('every landmarks needs to be identified with the id field')
        if(!landmarks.every(l=> isDefined(l.position)))
          throw new Error('every landmarks needs to have position defined')
        if(!landmarks.every(l => l.position.constructor === Array) || !landmarks.every(l => l.position.every(v => !isNaN(v))) || !landmarks.every(l => l.position.length == 3))
          throw new Error('position needs to be a length 3 tuple of numbers ')
        this.store.dispatch({
          type: USER_LANDMARKS,
          landmarks : landmarks
        })
      },
      remove3DLandmarks : ids => {
        this.store.dispatch({
          type : USER_LANDMARKS,
          landmarks : this.userLandmarks.filter(l => ids.findIndex(id => id === l.id) < 0)
        })
      },
      hideSegment : (labelIndex) => {
        if(this.selectedRegionIndexSet.has(labelIndex)){
          this.store.dispatch({
            type :SELECT_REGIONS,
            selectRegions : [...this.selectedRegionIndexSet].filter(num=>num!==labelIndex)
          })
        }
      },
      showAllSegments : () => {
        this.store.dispatch({
          type : SELECT_REGIONS,
          selectRegions : this.regionsLabelIndexMap.keys()
        })
      },
      hideAllSegments : () => {
        this.store.dispatch({
          type : SELECT_REGIONS,
          selectRegions : []
        })
      },
      segmentColourMap : new Map(),
      applyColourMap : (map)=>{
        /* TODO to be implemented */
      },
      loadLayer : (layerObj)=>this.nehubaViewer.loadLayer(layerObj),
      removeLayer : (condition)=>this.nehubaViewer.removeLayer(condition),
      setLayerVisibility : (condition,visible)=>this.nehubaViewer.setLayerVisibility(condition,visible),
      mouseEvent : merge(
        fromEvent(this.nehubaViewer.elementRef.nativeElement,'click').pipe(
          map((ev:MouseEvent)=>({eventName :'click',event:ev}))
        ),
        fromEvent(this.nehubaViewer.elementRef.nativeElement,'mousemove').pipe(
          map((ev:MouseEvent)=>({eventName :'mousemove',event:ev}))
        ),
        fromEvent(this.nehubaViewer.elementRef.nativeElement,'mousedown').pipe(
          map((ev:MouseEvent)=>({eventName :'mousedown',event:ev}))
        ),
        fromEvent(this.nehubaViewer.elementRef.nativeElement,'mouseup').pipe(
          map((ev:MouseEvent)=>({eventName :'mouseup',event:ev}))
        ),
      ) ,
      mouseOverNehuba : this.onHoverSegment$
    }
  }

  handleEmittedMouseoverSegment(emitted : any | number | null){
    this.store.dispatch({
      type : MOUSE_OVER_SEGMENT,
      segment : emitted
    })
  }

  /* because the navigation can be changed from two sources, 
    either dynamically (e.g. navigation panel in the UI or plugins etc) 
    or actively (via user interaction with the viewer) 
    or lastly, set on init
    
    This handler function is meant to handle anytime viewer's navigation changes from either sources */
  handleEmittedNavigationChange(navigation){

    /* If the navigation is changed dynamically, this.oldnavigation is set prior to the propagation of the navigation state to the viewer.
      As the viewer updates the dynamically changed navigation, it will emit the navigation state. 
      The emitted navigation state should be identical to this.oldnavigation */

    const navigationChangedActively : boolean = Object.keys(this.oldNavigation).length === 0 || !Object.keys(this.oldNavigation).every(key=>{
      return this.oldNavigation[key].constructor === Number || this.oldNavigation[key].constructor === Boolean ?
        this.oldNavigation[key] === navigation[key] :
        this.oldNavigation[key].every((_,idx)=>this.oldNavigation[key][idx] === navigation[key][idx])
    })

    /* if navigation is changed dynamically (ie not actively), the state would have been propagated to the store already. Hence return */
    if( !navigationChangedActively )
      return
    
    
    /* navigation changed actively (by user interaction with the viewer)
      probagate the changes to the store */

    this.store.dispatch({
      type : CHANGE_NAVIGATION,
      navigation 
    })
  }

  handleDispatchedNavigationChange(navigation){

    /* extract the animation object */
    const { animation, ..._navigation } = navigation

    if( animation ){
      /* animated */

      const gen = timedValues()
      const dest = Object.assign({},_navigation)
      /* this.oldNavigation is old */
      const delta = Object.assign({}, ...Object.keys(dest).filter(key=>key !== 'positionReal').map(key=>{
        const returnObj = {}
        returnObj[key] = typeof dest[key] === 'number' ?
          dest[key] - this.oldNavigation[key] :
          typeof dest[key] === 'object' ?
            dest[key].map((val,idx)=>val - this.oldNavigation[key][idx]) :
            true
        return returnObj
      }))

      const animate = ()=>{
        const next = gen.next()
        const d =  next.value
        
        this.nehubaViewer.setNavigationState(
          Object.assign({}, ...Object.keys(dest).filter(k=>k !== 'positionReal').map(key=>{
            const returnObj = {}
            returnObj[key] = typeof dest[key] === 'number' ?
              dest[key] - ( delta[key] * ( 1 - d ) ) :
              dest[key].map((val,idx)=>val - ( delta[key][idx] * ( 1 - d ) ) )
            return returnObj
          }),{
            positionReal : true
          })
        )

        if( !next.done ){
          requestAnimationFrame(()=>animate())
        }else{

          /* set this.oldnavigation to represent the state of the store */
          /* animation done, set this.oldNavigation */
          this.oldNavigation = Object.assign({},this.oldNavigation,dest)
        }
      }
      requestAnimationFrame(()=>animate())
    } else {
      /* not animated */

      /* set this.oldnavigation to represent the state of the store */
      /* since the emitted change of navigation state is debounced, we can safely set this.oldNavigation to the destination */
      this.oldNavigation = Object.assign({},this.oldNavigation,_navigation)

      this.nehubaViewer.setNavigationState(Object.assign({},_navigation,{
        positionReal : true
      }))
    }
  }

  /* related to info-card */

  statusPanelRealSpace : boolean = true

  get mouseCoord():string{
    return this.nehubaViewer ?
      this.statusPanelRealSpace ? 
        this.nehubaViewer.mousePosReal ? 
          Array.from(this.nehubaViewer.mousePosReal.map(n=> isNaN(n) ? 0 : n/1e6))
            .map(n=>n.toFixed(3)+'mm').join(' , ') : 
          '0mm , 0mm , 0mm (mousePosReal not yet defined)' :
        this.nehubaViewer.mousePosVoxel ? 
          this.nehubaViewer.mousePosVoxel.join(' , ') :
          '0 , 0 , 0 (mousePosVoxel not yet defined)' :
      '0 , 0 , 0 (nehubaViewer not defined)'
  }

  editingNavState : boolean = false

  textNavigateTo(string:string){
    if(string.split(/[\s|,]+/).length>=3 && string.split(/[\s|,]+/).slice(0,3).every(entry=>!isNaN(Number(entry.replace(/mm/,''))))){
      const pos = (string.split(/[\s|,]+/).slice(0,3).map((entry)=>Number(entry.replace(/mm/,''))*(this.statusPanelRealSpace ? 1000000 : 1)))
      this.nehubaViewer.setNavigationState({
        position : (pos as [number,number,number]),
        positionReal : this.statusPanelRealSpace
      })
    }else{
      console.log('input did not parse to coordinates ',string)
    }
  }

  navigationValue(){
    return this.nehubaViewer ? 
      this.statusPanelRealSpace ? 
        Array.from(this.nehubaViewer.navPosReal.map(n=> isNaN(n) ? 0 : n/1e6))
          .map(n=>n.toFixed(3)+'mm').join(' , ') :
        Array.from(this.nehubaViewer.navPosVoxel.map(n=> isNaN(n) ? 0 : n)).join(' , ') :
      `[0,0,0] (neubaViewer is undefined)`
  }

  get showCitation(){
    return this.selectedTemplate && this.selectedTemplate.properties && this.selectedTemplate.properties.publications && this.selectedTemplate.properties.publications.constructor === Array
  }

  resetNavigation(){
    const initialNgState = this.selectedTemplate.nehubaConfig.dataset.initialNgState
    
    const perspectiveZoom = initialNgState ? initialNgState.perspectiveZoom : undefined
    const perspectiveOrientation = initialNgState ? initialNgState.perspectiveOrientation : undefined
    const zoom = initialNgState ? 
      initialNgState.navigation ?
        initialNgState.navigation.zoomFactor :
        undefined :
      undefined

    const position = initialNgState ? 
      initialNgState.navigation ?
        initialNgState.navigation.pose ?
          initialNgState.navigation.pose.position.voxelCoordinates ?
            initialNgState.navigation.pose.position.voxelCoordinates :
            undefined :
          undefined :
        undefined :
      undefined

    const orientation = [0,0,0,1]

    this.store.dispatch({
      type : CHANGE_NAVIGATION,
      navigation : Object.assign({},
        {
          perspectiveZoom,
          perspectiveOrientation,
          zoom,
          position,
          orientation
        },{
          positionReal : false,
          animation : {

          }
        })
    })
  }
}

export const CM_THRESHOLD = `0.05`
export const CM_MATLAB_JET = `float r;if( x < 0.7 ){r = 4.0 * x - 1.5;} else {r = -4.0 * x + 4.5;}float g;if (x < 0.5) {g = 4.0 * x - 0.5;} else {g = -4.0 * x + 3.5;}float b;if (x < 0.3) {b = 4.0 * x + 0.5;} else {b = -4.0 * x + 2.5;}float a = 1.0;`
export const getActiveColorMapFragmentMain = ():string=>`void main(){float x = toNormalized(getDataValue());${CM_MATLAB_JET}if(x>${CM_THRESHOLD}){emitRGB(vec3(r,g,b));}else{emitTransparent();}}`