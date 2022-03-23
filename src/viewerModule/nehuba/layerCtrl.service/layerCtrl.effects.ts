import { Injectable } from "@angular/core";
import { createEffect } from "@ngrx/effects";
import { select, Store } from "@ngrx/store";
import { forkJoin, of } from "rxjs";
import { mapTo, switchMap, withLatestFrom, filter, catchError, map, debounceTime, shareReplay, distinctUntilChanged } from "rxjs/operators";
import { SAPI, SapiAtlasModel, SapiParcellationModel, SapiSpaceModel } from "src/atlasComponents/sapi";
import { atlasAppearance, atlasSelection } from "src/state";
import { NgLayerCustomLayer } from "src/state/atlasAppearance";
import { arrayEqual } from "src/util/array";
import { EnumColorMapName } from "src/util/colorMaps";
import { getShader } from "src/util/constants";
import { getNgLayersFromVolumesATP, getRegionLabelIndex } from "../config.service";
import { ParcVolumeSpec } from "../store/util";
import { NehubaLayerControlService } from "./layerCtrl.service";

@Injectable()
export class LayerCtrlEffects {
  onRegionSelectClearPmapLayer = createEffect(() => this.store.pipe(
    select(atlasSelection.selectors.selectedRegions),
    distinctUntilChanged(
      arrayEqual((o, n) => o["@id"] === n["@id"])
    ),
    mapTo(
      atlasAppearance.actions.removeCustomLayer({
        id: NehubaLayerControlService.PMAP_LAYER_NAME
      })
    )
  ))

  onRegionSelectShowNewPmapLayer = createEffect(() => this.store.pipe(
    select(atlasSelection.selectors.selectedRegions),
    filter(regions => regions.length > 0),
    withLatestFrom(
      this.store.pipe(
        atlasSelection.fromRootStore.distinctATP()
      )
    ),
    switchMap(([ regions, { atlas, parcellation, template } ]) => {
      const sapiRegion = this.sapi.getRegion(atlas["@id"], parcellation["@id"], regions[0].name)
      return sapiRegion.getMapInfo(template["@id"])
        .then(val => 
          atlasAppearance.actions.addCustomLayer({
            customLayer: {
              clType: "customlayer/nglayer",
              id: NehubaLayerControlService.PMAP_LAYER_NAME,
              source: `nifti://${sapiRegion.getMapUrl(template["@id"])}`,
              shader: getShader({
                colormap: EnumColorMapName.VIRIDIS,
                highThreshold: val.max,
                lowThreshold: val.min,
                removeBg: true,
              })
            }
          })
        )
    }),
    catchError((err, obs) => of(
      atlasAppearance.actions.removeCustomLayer({
        id: NehubaLayerControlService.PMAP_LAYER_NAME
      })
    ))
  ))

  onATP$ = this.store.pipe(
    atlasSelection.fromRootStore.distinctATP(),
    map(val => val as { atlas: SapiAtlasModel, parcellation: SapiParcellationModel, template: SapiSpaceModel })
  )

  onATPClearBaseLayers = createEffect(() => this.onATP$.pipe(
    withLatestFrom(
      this.store.pipe(
        select(atlasAppearance.selectors.customLayers),
        map(
          cl => cl.filter(layer => layer.clType === "baselayer/nglayer" || layer.clType === "baselayer/colormap")
        )
      )
    ),
    switchMap(([_, layers]) => 
      of(
        ...layers.map(layer => 
          atlasAppearance.actions.removeCustomLayer({
            id: layer.id
          })  
        )
      )
    )
  ))

  private getNgLayers(atlas: SapiAtlasModel, parcellation: SapiParcellationModel, template: SapiSpaceModel){

    if (!!parcellation && !template) {
      throw new Error(`parcellation defined, but template not defined!`)
    }
    
    const parcVolumes$ = !parcellation
    ? of([])
    : forkJoin([
        this.sapi.getParcellation(atlas["@id"], parcellation["@id"]).getRegions(template["@id"]).pipe(
          map(regions => {

            const returnArr: ParcVolumeSpec[] = []
            for (const r of regions) {
              const source = r?.hasAnnotation?.visualizedIn?.["@id"]
              if (!source) continue
              if (source.indexOf("precomputed://") < 0) continue
              const labelIndex = getRegionLabelIndex(atlas, template, parcellation, r)
              if (!labelIndex) continue
              
              const found = returnArr.find(v => v.volumeSrc === source)
              if (found) {
                found.labelIndicies.push(labelIndex)
                continue
              }

              let laterality: "left hemisphere" | "right hemisphere" | "whole brain" = "whole brain"
              if (r.name.indexOf("left") >= 0) laterality = "left hemisphere"
              if (r.name.indexOf("right") >= 0) laterality = "right hemisphere"
              returnArr.push({
                volumeSrc: source,
                labelIndicies: [labelIndex],
                parcellation,
                laterality,
              })
            }
            return returnArr
          })
        ),
        this.sapi.getParcellation(atlas["@id"], parcellation["@id"]).getVolumes()
      ]).pipe(
        map(([ volumeSrcs, volumes ]) => {
          return volumes.map(
            v => {
              const found = volumeSrcs.find(volSrc => volSrc.volumeSrc.indexOf(v.data.url) >= 0)
              return {
                volume: v,
                volumeMetadata: found,
              }
            }).filter(
            v => !!v.volumeMetadata?.labelIndicies
          )
        })
      )
    
    const spaceVols$ = !!template
    ? this.sapi.getSpace(atlas["@id"], template["@id"]).getVolumes().pipe(
        shareReplay(1),
      )
    : of([])
    
    return forkJoin({
      tmplVolumes: spaceVols$.pipe(
        map(
          volumes => volumes.filter(vol => "neuroglancer/precomputed" in vol.data.detail)
        ),
      ),
      tmplAuxMeshVolumes: spaceVols$.pipe(
        map(
          volumes => volumes.filter(vol => "neuroglancer/precompmesh" in vol.data.detail)
        ),
      ),
      parcVolumes: parcVolumes$.pipe(
      )
    })
  }

  onATPDebounceNgLayers$ = this.onATP$.pipe(
    debounceTime(16),
    switchMap(({ atlas, parcellation, template }) => 
      this.getNgLayers(atlas, parcellation, template).pipe(
        map(volumes => getNgLayersFromVolumesATP(volumes, { atlas, parcellation, template }))
      )
    ),
    shareReplay(1)
  )

  onATPDebounceAddBaseLayers$ = createEffect(() => this.onATPDebounceNgLayers$.pipe(
    switchMap(ngLayers => {
      const { parcNgLayers, tmplAuxNgLayers, tmplNgLayers } = ngLayers
      
      const customBaseLayers: NgLayerCustomLayer[] = []
      for (const layers of [parcNgLayers, tmplAuxNgLayers, tmplNgLayers]) {
        for (const key in layers) {
          const { source, transform, opacity, visible } = layers[key]
          customBaseLayers.push({
            clType: "baselayer/nglayer",
            id: key,
            source,
            transform,
            opacity,
            visible,
          })
        }
      }
      return of(
        ...customBaseLayers.map(layer => 
          atlasAppearance.actions.addCustomLayer({
            customLayer: layer
          })  
        )
      )
    })
  ))

  constructor(
    private store: Store<any>,
    private sapi: SAPI,  
  ){

  }
}