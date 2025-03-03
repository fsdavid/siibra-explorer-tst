import { Injectable } from "@angular/core";
import { HttpClient } from '@angular/common/http';
import { map, shareReplay, switchMap, take } from "rxjs/operators";
import { SAPIAtlas, SAPISpace } from './core'
import {
  SapiAtlasModel,
  SapiModalityModel,
  SapiParcellationModel,
  SapiQueryPriorityArg,
  SapiRegionalFeatureModel,
  SapiRegionModel,
  SapiSpaceModel,
  SpyNpArrayDataModel,
  SxplrCleanedFeatureModel
} from "./type";
import { getExportNehuba } from "src/util/fn";
import { SAPIParcellation } from "./core/sapiParcellation";
import { SAPIRegion } from "./core/sapiRegion"
import { MatSnackBar } from "@angular/material/snack-bar";
import { AtlasWorkerService } from "src/atlasViewer/atlasViewer.workerService.service";
import { EnumColorMapName } from "src/util/colorMaps";
import { PRIORITY_HEADER } from "src/util/priority";
import { NEVER, Observable } from "rxjs";
import { SAPIFeature } from "./features";
import { environment } from "src/environments/environment"

export const SIIBRA_API_VERSION_HEADER_KEY='x-siibra-api-version'
export const SIIBRA_API_VERSION = '0.2.3'

type RegistryType = SAPIAtlas | SAPISpace | SAPIParcellation

let BS_ENDPOINT_CACHED_VALUE: Observable<string> = null

@Injectable({
  providedIn: 'root'
})
export class SAPI{

  /**
   * Used to clear BsEndPoint, so the next static get BsEndpoints$ will
   * fetch again. Only used for unit test of BsEndpoint$
   */
  static ClearBsEndPoint(){
    BS_ENDPOINT_CACHED_VALUE = null
  }

  static async VerifyEndpoint(url: string): Promise<string> {
    const resp = await fetch(`${url}/atlases`)
    const atlases = await resp.json()
    if (atlases.length > 0) return url
  }

  /**
   * BsEndpoint$ is designed as a static getter mainly for unit testing purposes.
   * see usage of BsEndpoint$ and ClearBsEndPoint in sapi.service.spec.ts
   */
  static get BsEndpoint$(): Observable<string> {
    if (!!BS_ENDPOINT_CACHED_VALUE) return BS_ENDPOINT_CACHED_VALUE
    const endpoints = environment.SIIBRA_API_ENDPOINTS.split(',')
    if (endpoints.length === 0) {
      SAPI.ErrorMessage = `No siibra-api endpoint defined!`
      return NEVER
    }
    const mainEndpoint = endpoints[0]
    const backupEndpoints = endpoints.slice(1)
    
    BS_ENDPOINT_CACHED_VALUE = new Observable<string>(obs => {
      (async () => {
        const backupPr = new Promise<string>(rs => {
          for (const endpt of backupEndpoints) {
            SAPI.VerifyEndpoint(endpt)
              .then(flag => {
                if (flag) rs(endpt)
              })
              // eslint-disable-next-line  @typescript-eslint/no-empty-function
              .catch(e => {})
          }
        })
        try {
          const url = await Promise.race([
            SAPI.VerifyEndpoint(mainEndpoint),
            new Promise<string>((_, rj) => setTimeout(() => rj(`10s timeout`), 10000))
          ])
          obs.next(url)
        } catch (e) {

          try {
            const url = await Promise.race([
              backupPr,
              new Promise<string>((_, rj) => setTimeout(() => rj(`5s timeout`), 5000))
            ])
            obs.next(url)
          } catch (e) {
            SAPI.ErrorMessage = `No usabe mirror found`
          }
        } finally {
          obs.complete()
        }
      })()
    }).pipe(
      take(1),
      shareReplay(1),
    )
    return BS_ENDPOINT_CACHED_VALUE
  }

  static ErrorMessage = null
  
  registry = {
    _map: {} as Record<string, {
      func: (...arg: any[]) => RegistryType
      args: string[]
    }>,
    get<T>(id: string): T {
      if (!this._map[id]) return null
      const { func, args } = this._map[id]
      return func(...args)
    },
    set(id: string, func: (...args: any[]) => RegistryType, args: string[]) {
      if (this._map[id]) {
        console.warn(`id ${id} already mapped as ${this._map[id]}`)
      }
      this._map[id] = { func, args }
    }
  }

  getAtlas(atlasId: string): SAPIAtlas {
    return new SAPIAtlas(this, atlasId)
  }

  getSpace(atlasId: string, spaceId: string): SAPISpace {
    return new SAPISpace(this, atlasId, spaceId)
  }

  getParcellation(atlasId: string, parcId: string): SAPIParcellation {
    return new SAPIParcellation(this, atlasId, parcId)
  }

  getRegion(atlasId: string, parcId: string, regionId: string): SAPIRegion{
    return new SAPIRegion(this, atlasId, parcId, regionId)
  }

  getSpaceDetail(atlasId: string, spaceId: string, param?: SapiQueryPriorityArg): Observable<SapiSpaceModel> {
    return this.getSpace(atlasId, spaceId).getDetail(param)
  }

  getParcDetail(atlasId: string, parcId: string, param?: SapiQueryPriorityArg): Observable<SapiParcellationModel> {
    return this.getParcellation(atlasId, parcId).getDetail(param)
  }

  getParcRegions(atlasId: string, parcId: string, spaceId: string, queryParam?: SapiQueryPriorityArg): Observable<SapiRegionModel[]> {
    const parc = this.getParcellation(atlasId, parcId)
    return parc.getRegions(spaceId, queryParam)
  }

  getFeature(featureId: string, opts: Record<string, string> = {}) {
    return new SAPIFeature(this, featureId, opts)
  }

  getRegionFeatures(atlasId: string, parcId: string, spaceId: string, regionId: string, priority = 0): Observable<(SapiRegionalFeatureModel | SxplrCleanedFeatureModel)[]>{

    const reg = this.getRegion(atlasId, parcId, regionId)
    return reg.getFeatures(spaceId)
  }

  getModalities(): Observable<SapiModalityModel[]> {
    return SAPI.BsEndpoint$.pipe(
      switchMap(endpt => this.http.get<SapiModalityModel[]>(`${endpt}/modalities`))
    )
  }

  httpGet<T>(url: string, params?: Record<string, string>, sapiParam?: SapiQueryPriorityArg){
    const headers: Record<string, string> = {}
    if (sapiParam?.priority) {
      headers[PRIORITY_HEADER] = sapiParam.priority.toString()
    }
    return this.http.get<T>(
      url,
      {
        headers,
        params
      }
    )
  }

  public atlases$ = SAPI.BsEndpoint$.pipe(
    switchMap(endpt => this.http.get<SapiAtlasModel[]>(
      `${endpt}/atlases`,
      {
        observe: "response"
      }
    )),
    map(resp => {
      const respVersion = resp.headers.get(SIIBRA_API_VERSION_HEADER_KEY)
      if (respVersion !== SIIBRA_API_VERSION) {
        this.snackbar.open(`Expecting ${SIIBRA_API_VERSION}, got ${respVersion}. Some functionalities may not work as expected.`, 'Dismiss', {
          duration: 5000
        })
      }
      console.log(`siibra-api::version::${respVersion}, expecting::${SIIBRA_API_VERSION}`)
      return resp.body
    }),
    shareReplay(1)
  )

  constructor(
    public http: HttpClient,
    private snackbar: MatSnackBar,
    private workerSvc: AtlasWorkerService,
  ){
    if (SAPI.ErrorMessage) {
      this.snackbar.open(SAPI.ErrorMessage, 'Dismiss', { duration: 5000 })
    }
    this.atlases$.subscribe(atlases => {
      for (const atlas of atlases) {
        for (const space of atlas.spaces) {
          this.registry.set(space["@id"], this.getSpace.bind(this), [atlas["@id"], space["@id"]])
          this.getSpaceDetail(atlas["@id"], space["@id"])
        }
        for (const parc of atlas.parcellations) {
          this.registry.set(parc["@id"], this.getParcellation.bind(this), [atlas["@id"], parc["@id"]])
          this.getParcDetail(atlas["@id"], parc["@id"])
        }
      }
    })
  }
  
  async processNpArrayData<T extends keyof ProcessTypedArrayResult>(input: SpyNpArrayDataModel, method: PARSE_TYPEDARRAY = PARSE_TYPEDARRAY.RAW_ARRAY, params: ProcessTypedArrayResult[T]['input'] = null): Promise<ProcessTypedArrayResult[T]['output']> {

    const supportedDtype = [
      "uint8",
      "int32",
      "float32"
    ]
    const {
      "x-channel": channel,
      "x-width": width,
      "x-height": height,
      content,
      dtype,
      content_encoding: contentEncoding, 
      content_type: contentType
    } = input
    
    if (contentType !== "application/octet-stream") {
      throw new Error(`sapi.service#decodeNpArrayDataModel error: expecting content_type to be "application/octet-stream", but is ${contentType}`)
    }
    if (contentEncoding !== "gzip; base64") {
      throw new Error(`sapi.service#decodeNpArrayDataModel error: expecting content_encoding to be "gzip; base64", but is ${contentEncoding}`)
    }
    if (supportedDtype.indexOf(dtype) < 0) {
      throw new Error(`sapi.service#decodeNpArrayDataModel error: expecting dtype to be in ${JSON.stringify(supportedDtype)}, but is ${dtype}`)
    }

    try {
      const bin = atob(content)
      const { pako } = getExportNehuba()
      const array = pako.inflate(bin)
      let workerMsg: string
      switch (method) {
      case PARSE_TYPEDARRAY.CANVAS_FORTRAN_RGBA: {
        workerMsg = "PROCESS_TYPED_ARRAY_F2RGBA"
        break
      }
      case PARSE_TYPEDARRAY.CANVAS_COLORMAP_RGBA: {
        workerMsg = "PROCESS_TYPED_ARRAY_CM2RGBA"
        break
      }
      case PARSE_TYPEDARRAY.RAW_ARRAY: {
        workerMsg = "PROCESS_TYPED_ARRAY_RAW"
        break
      }
      default:{
        throw new Error(`sapi.service#decodeNpArrayDataModel: method cannot be deciphered: ${method}`)
      }
      }
      const { result } = await this.workerSvc.sendMessage({
        method: workerMsg,
        param: {
          inputArray: array,
          width,
          height,
          channel,
          dtype,
          processParams: params
        },
        transfers: [ array.buffer ]
      })
      const { buffer, outputArray, min, max } = result
      return {
        type: method,
        result: buffer,
        rawArray: outputArray,
        min,
        max
      }
    } catch (e) {
      throw new Error(`sapi.service#decodeNpArrayDataModel error: ${e}`)
    }
  }
}

export enum PARSE_TYPEDARRAY {
  CANVAS_FORTRAN_RGBA="CANVAS_FORTRAN_RGBA",
  CANVAS_COLORMAP_RGBA="CANVAS_COLORMAP_RGBA",
  RAW_ARRAY="RAW_ARRAY",
}

type ProcessTypedArrayResult = {
  [PARSE_TYPEDARRAY.CANVAS_FORTRAN_RGBA]: {
    input: null
    output: {
      type: PARSE_TYPEDARRAY
      result: Uint8ClampedArray
    }
  }
  [PARSE_TYPEDARRAY.CANVAS_COLORMAP_RGBA]: {
    input?: {
      colormap?: EnumColorMapName
      log?: boolean
    }
    output: {
      type: PARSE_TYPEDARRAY
      result: Uint8ClampedArray
      max: number
      min: number
    }
  }
  [PARSE_TYPEDARRAY.RAW_ARRAY]: {
    input: null
    output: {
      rawArray: number[][]
      min: number
      max: number
    }
  }
}
