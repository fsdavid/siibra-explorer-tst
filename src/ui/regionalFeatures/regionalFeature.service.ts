import { HttpClient } from "@angular/common/http";
import { Injectable, OnDestroy } from "@angular/core";
import { PureContantService } from "src/util";
import { getIdFromFullId } from 'common/util'
import { forkJoin, Subscription } from "rxjs";
import { switchMap } from "rxjs/operators";
import { IHasId } from "src/util/interfaces";
import { select, Store } from "@ngrx/store";
import { viewerStateSelectedTemplateSelector } from "src/services/state/viewerState/selectors";
import { viewerStateAddUserLandmarks, viewreStateRemoveUserLandmarks } from "src/services/state/viewerState/actions";
import { uiStateMouseoverUserLandmark } from "src/services/state/uiState/selectors";

export interface IFeature extends IHasId{
  type: string
  name: string
  data?: IHasId[]
}

@Injectable({
  providedIn: 'root'
})

export class RegionalFeaturesService implements OnDestroy{

  private subs: Subscription[] = []
  private templateSelected: any
  constructor(
    private http: HttpClient,
    private pureConstantService: PureContantService,
    private store$: Store<any>
  ){
    this.subs.push(
      this.store$.pipe(
        select(viewerStateSelectedTemplateSelector)
      ).subscribe(val => this.templateSelected = val)
    )
  }

  ngOnDestroy(){
    while (this.subs.length > 0) this.subs.pop().unsubscribe()
  }

  public onHoverLandmarks$ = this.store$.pipe(
    select(uiStateMouseoverUserLandmark)
  )

  public getAllFeaturesByRegion(region: {['fullId']: string}){
    if (!region.fullId) throw new Error(`getAllFeaturesByRegion - region does not have fullId defined`)
    const regionFullId = getIdFromFullId(region.fullId)

    const hemisphereObj =  region['status'] ? { hemisphere: region['status'] } : {}
    const refSpaceObj = this.templateSelected && this.templateSelected.fullId
      ? { referenceSpaceId: getIdFromFullId(this.templateSelected.fullId) }
      : {}

    return this.http.get<{features: IHasId[]}>(
      `${this.pureConstantService.backendUrl}regionalFeatures/byRegion/${encodeURIComponent( regionFullId )}`,
      {
        params: {
          ...hemisphereObj,
          ...refSpaceObj,
          
        },
        responseType: 'json'
      }
    ).pipe(
      switchMap(({ features }) => forkJoin(
        features.map(({ ['@id']: featureId }) => 
          this.http.get<IFeature>(
            `${this.pureConstantService.backendUrl}regionalFeatures/byRegion/${encodeURIComponent( regionFullId )}/${encodeURIComponent( featureId )}`,
            {
              params: {
                ...hemisphereObj,
                ...refSpaceObj,
              },
              responseType: 'json'
            }
          )
        )
      )),
    )
  }

  public getFeatureData(region: any,feature: IFeature, data: IHasId){
    if (!feature['@id']) throw new Error(`@id attribute for feature is required`)
    if (!data['@id']) throw new Error(`@id attribute for data is required`)
    const refSpaceObj = this.templateSelected && this.templateSelected.fullId
      ? { referenceSpaceId: getIdFromFullId(this.templateSelected.fullId) }
      : {}
    return this.http.get<IHasId>(
      `${this.pureConstantService.backendUrl}regionalFeatures/byFeature/${encodeURIComponent(feature['@id'])}/${encodeURIComponent(data['@id'])}`,
      {
        params: {
          ...refSpaceObj,
        },
        responseType: 'json'
      }
    )
  }

  public addLandmarks(lms: IHasId[]) {
    this.store$.dispatch(
      viewerStateAddUserLandmarks({
        landmarks: lms.map(lm => ({
          ...lm,
          id: lm['@id'],
          name: `region feature: ${lm['@id']}`
        }))
      })
    )
  }

  public removeLandmarks(lms: IHasId[]) {
    this.store$.dispatch(
      viewreStateRemoveUserLandmarks({
        payload: {
          landmarkIds: lms.map(l => l['@id'])
        }
      })
    )
  }
}
