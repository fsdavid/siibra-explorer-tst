import { CommonModule } from "@angular/common";
import { APP_INITIALIZER, NgModule } from "@angular/core";
import { Store } from "@ngrx/store";
import { ComponentsModule } from "src/components";
import { AngularMaterialModule } from "src/sharedModules";
import { atlasAppearance } from "src/state";
import { UtilModule } from "src/util";
import { SapiViewsCoreParcellationParcellationChip } from "./chip/parcellation.chip.component";
import { FilterGroupedParcellationPipe } from "./filterGroupedParcellations.pipe";
import { FilterUnsupportedParcPipe } from "./filterUnsupportedParc.pipe";
import { ParcellationIsBaseLayer } from "./parcellationIsBaseLayer.pipe";
import { ParcellationVisibilityService } from "./parcellationVis.service";
import { PreviewParcellationUrlPipe } from "./previewParcellationUrl.pipe";
import { SapiViewsCoreParcellationParcellationSmartChip } from "./smartChip/parcellation.smartChip.component";
import { SapiViewsCoreParcellationParcellationTile } from "./tile/parcellation.tile.component";

@NgModule({
  imports: [
    CommonModule,
    ComponentsModule,
    AngularMaterialModule,
    UtilModule,
  ],
  declarations: [
    SapiViewsCoreParcellationParcellationTile,
    SapiViewsCoreParcellationParcellationChip,
    SapiViewsCoreParcellationParcellationSmartChip,
    PreviewParcellationUrlPipe,
    FilterGroupedParcellationPipe,
    FilterUnsupportedParcPipe,
    ParcellationIsBaseLayer,
  ],
  exports: [
    SapiViewsCoreParcellationParcellationTile,
    SapiViewsCoreParcellationParcellationChip,
    SapiViewsCoreParcellationParcellationSmartChip,
    FilterGroupedParcellationPipe,
    FilterUnsupportedParcPipe,
  ],
  providers: [
    ParcellationVisibilityService,
    {
      provide: APP_INITIALIZER,
      useFactory: (store: Store, svc: ParcellationVisibilityService) => {
        svc.visibility$.subscribe(val => {
          store.dispatch(
            atlasAppearance.actions.setShowDelineation({
              flag: val
            })
          )
        })
        return () => Promise.resolve()
      },
      multi: true,
      deps: [ Store, ParcellationVisibilityService ]
    }
  ]
})

export class SapiViewsCoreParcellationModule{}