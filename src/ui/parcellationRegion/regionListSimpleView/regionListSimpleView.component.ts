import { Component, Input } from "@angular/core";

import { RegionBase } from '../region.base'
import { Store } from "@ngrx/store";
import { IavRootStoreInterface } from "src/services/stateStore.service";

@Component({
  selector: 'region-list-simple-view',
  templateUrl: './regionListSimpleView.template.html',
  styleUrls: [
    './regionListSimpleView.style.css'
  ]
})

export class RegionListSimpleViewComponent extends RegionBase{
  
  @Input()
  showBrainIcon: boolean = false

  @Input()
  showDesc: boolean = false

  constructor(
    store$: Store<IavRootStoreInterface>
  ){
    super(store$)
  }
}