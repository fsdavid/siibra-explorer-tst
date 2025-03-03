import { Injectable } from "@angular/core";
import { MatBottomSheet, MatBottomSheetRef } from "@angular/material/bottom-sheet";
import { MatSnackBar } from "@angular/material/snack-bar";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { select, Store } from "@ngrx/store";
import { of } from "rxjs";
import { filter, map, mapTo, pairwise, startWith, switchMap, tap, withLatestFrom } from "rxjs/operators";
import { generalActionError } from "../actions";
import { userInterface } from "..";
import { selectors } from "../atlasSelection"
import * as actions from "./actions"

@Injectable()
export class Effects{

  freshRegionSelect = this.store.pipe(
    select(selectors.selectedRegions),
    map(selReg => selReg.length),
    startWith(0),
    pairwise(),
    filter(([prev, curr]) => prev === 0 && curr > 0),
  )

  onFreshRegionSelectSidePanelOpen = createEffect(() => this.freshRegionSelect.pipe(
    mapTo(actions.openSidePanel()),
  ))

  onFreshRegionSelectSidePanelDetailExpand = createEffect(() => this.freshRegionSelect.pipe(
    mapTo(actions.expandSidePanelDetailView())
  ))

  onGeneralError = createEffect(() => this.action.pipe(
    ofType(generalActionError.type),
    tap(payload => {
      this.snackbar.open(
        (payload as any)?.message || `Error: cannot complete your action`,
        'Dismiss',
        { duration: 5000 }
      )
    })
  ), { dispatch: false })

  onShowBottomSheet = createEffect(() => this.action.pipe(
    ofType(actions.showBottomSheet),
    tap(({ template, config }) => {

      if (this.bottomSheetRef) {
        this.bottomSheetRef.dismiss()
      }
      this.bottomSheetRef = this.bottomsheet.open(
        template,
        config
      )
      this.bottomSheetRef.afterDismissed().subscribe(() => this.bottomSheetRef = null)
    })
  ), { dispatch: false })

  onSnackbarMessage = createEffect(() => this.action.pipe(
    ofType(actions.snackBarMessage),
    tap(({ message, config }) => {
      const _config = config || { duration: 5000 }
      this.snackbar.open(message, "Dismiss", _config)
    })
  ), { dispatch: false })

  onMaximiseView = createEffect(() => this.action.pipe(
    ofType(actions.toggleMaximiseView),
    withLatestFrom(
      this.store.pipe(
        select(userInterface.selectors.panelMode),
      )
    ),
    switchMap(([ { targetIndex }, panelMode ]) => {
      const newMode: userInterface.PanelMode = panelMode === "FOUR_PANEL"
        ? "SINGLE_PANEL"
        : "FOUR_PANEL"
      const newOrder = newMode === "FOUR_PANEL"
        ? "0123"
        : "0123".split("").map(v => ((Number(v) + targetIndex) % 4).toString()).join("")
      return of(
        userInterface.actions.setPanelMode({
          panelMode: newMode
        }),
        userInterface.actions.setPanelOrder({
          order: newOrder
        })
      )
    })
  ))

  onCycleView = createEffect(() => this.action.pipe(
    ofType(userInterface.actions.cyclePanelMode),
    withLatestFrom(
      this.store.pipe(
        select(userInterface.selectors.panelMode)
      ),
      this.store.pipe(
        select(userInterface.selectors.panelOrder)
      ),
    ),
    filter(([_, panelMode, _1]) => panelMode === "SINGLE_PANEL"),
    map(([_, _1, panelOrder]) => userInterface.actions.setPanelOrder({
      order: [
        ...panelOrder.split('').slice(1),
        panelOrder[0]
      ].join('')
    }))
  ))

  private bottomSheetRef: MatBottomSheetRef
  constructor(
    private store: Store,
    private action: Actions,
    private bottomsheet: MatBottomSheet,
    private snackbar: MatSnackBar,
  ){
  }
}
