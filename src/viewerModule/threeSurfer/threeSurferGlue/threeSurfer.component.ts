import { Component, Input, Output, EventEmitter, ElementRef, OnChanges, OnDestroy, AfterViewInit } from "@angular/core";
import { IViewer, TViewerEvent } from "src/viewerModule/viewer.interface";
import { TThreeSurferConfig, TThreeSurferMode } from "../types";
import { parseContext } from "../util";
import { retry } from 'common/util'

@Component({
  selector: 'three-surfer-glue-cmp',
  templateUrl: './threeSurfer.template.html',
  styleUrls: [
    './threeSurfer.style.css'
  ]
})

export class ThreeSurferGlueCmp implements IViewer, OnChanges, AfterViewInit, OnDestroy {

  @Input()
  selectedTemplate: any

  @Input()
  selectedParcellation: any
  
  @Output()
  viewerEvent = new EventEmitter<TViewerEvent>()

  private domEl: HTMLElement
  private config: TThreeSurferConfig
  public modes: TThreeSurferMode[] = []
  public selectedMode: string
  private colormap: Map<string, Map<number, [number, number, number]>> = new Map()

  constructor(
    private el: ElementRef,
  ){
    this.domEl = this.el.nativeElement
  }

  tsRef: any
  loadedMeshes: {
    threeSurfer: any,
    mesh: string,
    colormap: string,
    hemisphere: string,
    vIdxArr: number[]
  }[] = []

  private unloadAllMeshes() {
    while(this.loadedMeshes.length > 0) {
      const m = this.loadedMeshes.pop()
      this.tsRef.unloadMesh(m.threeSurfer)
    }
  }

  public async loadMode(mode: TThreeSurferMode) {
    
    this.unloadAllMeshes()

    this.selectedMode = mode.name
    const { meshes } = mode
    for (const singleMesh of meshes) {
      const { mesh, colormap, hemisphere } = singleMesh
      
      const tsM = await this.tsRef.loadMesh(
        parseContext(mesh, [this.config['@context']])
      )
      const applyCM = this.colormap.get(hemisphere)

      const tsC = await this.tsRef.loadColormap(
        parseContext(colormap, [this.config['@context']])
      )
      const colorIdx = tsC[0].getData()

      this.loadedMeshes.push({
        threeSurfer: tsM,
        colormap,
        mesh,
        hemisphere,
        vIdxArr: colorIdx
      })
      this.tsRef.applyColorMap(tsM, colorIdx, 
        {
          custom: applyCM
        }
      )
    }
  }

  async ngOnChanges(){
    if (this.tsRef) this.ngOnDestroy()
    if (this.selectedTemplate) {

      /**
       * wait until threesurfer is defined in window
       */
      await retry(async () => {
        if (typeof (window as any).ThreeSurfer === 'undefined') throw new Error('ThreeSurfer not yet defined')
      }, {
        timeout: 160,
        retries: 10,
      })
      
      this.config = this.selectedTemplate['three-surfer']
      // somehow curv ... cannot be parsed properly by gifti parser... something about points missing
      this.modes = this.config.modes.filter(m => !/curv/.test(m.name))
      if (!this.tsRef) {
        this.tsRef = new (window as any).ThreeSurfer(this.domEl, {highlightHovered: true})
        this.onDestroyCb.push(
          () => {
            this.tsRef.dispose()
            this.tsRef = null
          }
        )
      }

      for (const region of this.selectedParcellation.regions) {
        const map = new Map<number, [number, number, number]>()
        for (const child of region.children) {
          const color = (child.iav?.rgb as [number, number, number] ) || [200, 200, 200]
          map.set(Number(child.grayvalue), color.map(v => v/255) as [number, number, number])
        }
        this.colormap.set(region.name, map)
      }
      
      // load mode0 by default
      this.loadMode(this.config.modes[0])

      this.viewerEvent.emit({
        type: 'VIEWERLOADED',
        data: true
      })
    }
  }

  ngAfterViewInit(){
    const customEvHandler = (ev: CustomEvent) => {
      
      if (!ev.detail.mesh) {
        return this.handleMouseoverEvent([])
      }

      const evGeom = ev.detail.mesh.geometry
      const evVertIdx = ev.detail.mesh.verticesIdicies
      const found = this.loadedMeshes.find(({ threeSurfer }) => threeSurfer === evGeom)
      
      if (!found) return this.handleMouseoverEvent([])

      const { hemisphere: key, vIdxArr } = found

      if (!key || !evVertIdx) {
        return this.handleMouseoverEvent([])
      }

      const labelIdxSet = new Set<Number>()
      
      for (const vIdx of evVertIdx) {
        labelIdxSet.add(
          vIdxArr[vIdx]
        )
      }
      if (labelIdxSet.size === 0) {
        return this.handleMouseoverEvent([])
      }

      const foundRegion = this.selectedParcellation.regions.find(({ name }) => name === key)

      if (!foundRegion) {
        return this.handleMouseoverEvent(
          Array.from(labelIdxSet).map(v => {
            return `unknown#${v}`
          })
        )
      }

      return this.handleMouseoverEvent(
        Array.from(labelIdxSet)
          .map(lblIdx => {
            const ontoR = foundRegion.children.find(ontR => Number(ontR.grayvalue) === lblIdx)
            if (ontoR) {
              return ontoR.name
            } else {
              return `unkonwn#${lblIdx}`
            }
          })
      )

      
    }
    this.domEl.addEventListener((window as any).ThreeSurfer.CUSTOM_EVENTNAME, customEvHandler)
    this.onDestroyCb.push(
      () => this.domEl.removeEventListener((window as any).ThreeSurfer.CUSTOM_EVENTNAME, customEvHandler)
    )
  }

  public mouseoverText: string
  private handleMouseoverEvent(mouseover: any[]){
    this.mouseoverText = mouseover.length === 0 ? null : mouseover.join(' / ')
  }

  private onDestroyCb: (() => void) [] = []

  ngOnDestroy() {
    while (this.onDestroyCb.length > 0) this.onDestroyCb.pop()()
  }
}
