import { NgModule } from "@angular/core";
import { KeyListner } from "./directives/keyDownListener.directive";

import { StopPropagationDirective } from "./directives/stopPropagation.directive";
import { SafeResourcePipe } from "./pipes/safeResource.pipe";
import { CaptureClickListenerDirective } from "./directives/captureClickListener.directive";
import { NmToMm } from "./pipes/nmToMm.pipe";
import { SwitchDirective } from "./directives/switch.directive";
import { MediaQueryDirective } from './directives/mediaQuery.directive'
import { LayoutModule } from "@angular/cdk/layout";
import { MapToPropertyPipe } from "./pipes/mapToProperty.pipe";
import { ClickOutsideDirective } from "src/util/directives/clickOutside.directive";
import { GetNthElementPipe } from "./pipes/getNthElement.pipe";
import { ParseAsNumberPipe } from "./pipes/parseAsNumber.pipe";
import { GetUniquePipe } from "./pipes/getUnique.pipe";
import { GetPropertyPipe } from "./pipes/getProperty.pipe";
import { FilterArrayPipe } from "./pipes/filterArray.pipe";
import { DoiParserPipe } from "./pipes/doiPipe.pipe";
import { GetFilenamePipe } from "./pipes/getFilename.pipe";
import { CombineFnPipe } from "./pipes/combineFn.pipe";
import { MergeObjPipe } from "./mergeObj.pipe";

@NgModule({
  imports:[
    LayoutModule
  ],
  declarations: [
    StopPropagationDirective,
    KeyListner,
    SafeResourcePipe,
    CaptureClickListenerDirective,
    NmToMm,
    SwitchDirective,
    MediaQueryDirective,
    MapToPropertyPipe,
    ClickOutsideDirective,
    GetNthElementPipe,
    ParseAsNumberPipe,
    GetUniquePipe,
    GetPropertyPipe,
    FilterArrayPipe,
    DoiParserPipe,
    GetFilenamePipe,
    CombineFnPipe,
    MergeObjPipe,
  ],
  exports: [
    StopPropagationDirective,
    KeyListner,
    SafeResourcePipe,
    CaptureClickListenerDirective,
    NmToMm,
    SwitchDirective,
    MediaQueryDirective,
    MapToPropertyPipe,
    ClickOutsideDirective,
    GetNthElementPipe,
    ParseAsNumberPipe,
    GetUniquePipe,
    GetPropertyPipe,
    FilterArrayPipe,
    DoiParserPipe,
    GetFilenamePipe,
    CombineFnPipe,
    MergeObjPipe,
  ]
})

export class UtilModule {

}
