import { Injectable } from "@angular/core";
import { APP_BASE_HREF } from "@angular/common";
import { Inject } from "@angular/core";
import { NavigationEnd, Router } from '@angular/router'
import { Store } from "@ngrx/store";
import { debounceTime, distinctUntilChanged, filter, map, shareReplay, startWith, switchMapTo, take, tap, withLatestFrom } from "rxjs/operators";
import { encodeCustomState, decodeCustomState, verifyCustomState } from "./util";
import { BehaviorSubject, combineLatest, merge, NEVER, Observable, of } from 'rxjs'
import { scan } from 'rxjs/operators'
import { RouteStateTransformSvc } from "./routeStateTransform.service";

@Injectable({
  providedIn: 'root'
})

export class RouterService {

  private logError(...e: any[]) {
    console.log(...e)
  }

  private _customRoute$ = new BehaviorSubject<{
    [key: string]: string
  }>({})

  public customRoute$: Observable<Record<string, any>>

  setCustomRoute(key: string, state: string){
    if (!verifyCustomState(key)) {
      throw new Error(`custom state key must start with x- `)
    }
    this._customRoute$.next({
      [key]: state
    })
  }

  constructor(
    router: Router,
    routeToStateTransformSvc: RouteStateTransformSvc,
    store$: Store<any>,
    @Inject(APP_BASE_HREF) baseHref: string
  ){

    // could be navigation (history api)
    // could be on init
    const navEnd$ = router.events.pipe(
      filter<NavigationEnd>(ev => ev instanceof NavigationEnd),
      shareReplay(1)
    )

    navEnd$.subscribe()

    // TODO fix
    const ready$ = NEVER.pipe(
      filter(flag => !!flag),
      take(1),
      shareReplay(1),
    )

    this.customRoute$ = ready$.pipe(
      switchMapTo(
        merge(
          navEnd$.pipe(
            map((ev: NavigationEnd) => {
              const fullPath = ev.urlAfterRedirects
              const customState = decodeCustomState(
                router.parseUrl(fullPath)
              )
              return customState || {}
            }),
          ),
          this._customRoute$
        ).pipe(
          scan<Record<string, string>>((acc, curr) => {
            return {
              ...acc,
              ...curr
            }
          }, {}),
          // TODO add obj eql distinctuntilchanged check
          distinctUntilChanged((o, n) => {
            if (Object.keys(o).length !== Object.keys(n).length) {
              return false
            }
            for (const key in o) {
              if (o[key] !== n[key]) return false
            }
            return true
          }),
        )
      ),
    )

    ready$.pipe(
      switchMapTo(
        navEnd$.pipe(
          withLatestFrom(
            store$,
            this.customRoute$.pipe(
              startWith({})
            )
          )
        )
      )
    ).subscribe(arg => {
      const [ev, state, customRoutes] = arg
      
      // const fullPath = ev.urlAfterRedirects
      // const stateFromRoute = cvtFullRouteToState(router.parseUrl(fullPath), state, this.logError)
      // let routeFromState: string
      // try {
      //   routeFromState = cvtStateToHashedRoutes(state)
      // } catch (_e) {
      //   routeFromState = ``
      // }

      // for (const key in customRoutes) {
      //   const customStatePath = encodeCustomState(key, customRoutes[key])
      //   if (!customStatePath) continue
      //   routeFromState += `/${customStatePath}`
      // }

      // if ( fullPath !== `/${routeFromState}`) {
      //   store$.dispatch(
      //     generalActions.generalApplyState({
      //       state: stateFromRoute
      //     })
      //   )
      // }
    })
    
    // TODO this may still be a bit finiky. 
    // we rely on that update of store happens within 160ms
    // which may or many not be 
    ready$.pipe(
      switchMapTo(
        combineLatest([
          store$.pipe(
            debounceTime(160),
            map(state => {
              try {
                return `` //cvtStateToHashedRoutes(state)
              } catch (e) {
                this.logError(e)
                return ``
              }
            })
          ),
          this.customRoute$,
        ]).pipe(
          map(([ routePath, customRoutes ]) => {
            let returnPath = routePath
            for (const key in customRoutes) {
              const customStatePath = encodeCustomState(key, customRoutes[key])
              if (!customStatePath) continue
              returnPath += `/${customStatePath}`
            }
            return returnPath
          })
        )
      )
    ).subscribe(routePath => {
      if (routePath === '') {
        router.navigate([ baseHref ])
      } else {

        // this needs to be done, because, for some silly reasons
        // router decodes encoded ':' character
        // this means, if url is compared with url, it will always be falsy
        // if a non encoded ':' exists
        const currUrlUrlTree = router.parseUrl(router.url)
        const joinedRoutes = `/${routePath}`
        const newUrlUrlTree = router.parseUrl(joinedRoutes)
        
        if (currUrlUrlTree.toString() !== newUrlUrlTree.toString()) {
          router.navigateByUrl(joinedRoutes)
        }
      }
    })
  }
}
