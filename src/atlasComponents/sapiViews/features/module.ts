import { CommonModule, DOCUMENT } from "@angular/common"
import { NgModule } from "@angular/core"
import { AngularMaterialModule } from "src/sharedModules"
import { appendScriptFactory, APPEND_SCRIPT_TOKEN } from "src/util/constants"
import { FeatureEntryCmp } from "./entry/entry.component"
import { SapiViewsFeaturesEntryListItem } from "./entryListItem/entryListItem.component"
import { FeatureBadgeColourPipe } from "./featureBadgeColor.pipe"
import { FeatureBadgeFlagPipe } from "./featureBadgeFlag.pipe"
import { FeatureBadgeNamePipe } from "./featureBadgeName.pipe"
import * as ieeg from "./ieeg"
import * as receptor from "./receptors"
import * as voi from "./voi"

const {
  SxplrSapiViewsFeaturesIeegModule
} = ieeg
const {
  ReceptorViewModule
} = receptor
const { SapiViewsFeaturesVoiModule } = voi

@NgModule({
  imports: [
    CommonModule,
    ReceptorViewModule,
    SxplrSapiViewsFeaturesIeegModule,
    AngularMaterialModule,
    SapiViewsFeaturesVoiModule,
  ],
  declarations: [
    FeatureEntryCmp,
    FeatureBadgeNamePipe,
    FeatureBadgeColourPipe,
    FeatureBadgeFlagPipe,
    SapiViewsFeaturesEntryListItem,
  ],
  providers: [
    {
      provide: APPEND_SCRIPT_TOKEN,
      useFactory: appendScriptFactory,
      deps: [ DOCUMENT ]
    }
  ],
  exports: [
    FeatureEntryCmp,
    SapiViewsFeaturesEntryListItem,
    SapiViewsFeaturesVoiModule,
  ]
})
export class SapiViewsFeaturesModule{}