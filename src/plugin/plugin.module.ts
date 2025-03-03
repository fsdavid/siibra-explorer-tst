import { CommonModule, DOCUMENT } from "@angular/common";
import { HttpClientModule } from "@angular/common/http";
import { NgModule } from "@angular/core";
import { LoggingModule } from "src/logging";
import { AngularMaterialModule } from "src/sharedModules";
import { UtilModule } from "src/util";
import { appendScriptFactory, APPEND_SCRIPT_TOKEN, removeScriptFactory, REMOVE_SCRIPT_TOKEN } from "src/util/constants";
import { IFrameSrcPipe } from "./iframeSrc.pipe";
import { PluginBannerUI } from "./pluginBanner/pluginBanner.component";
import { PluginPortal } from "./pluginPortal/pluginPortal.component";


@NgModule({
  imports: [
    CommonModule,
    LoggingModule,
    UtilModule,
    AngularMaterialModule,
    HttpClientModule,
  ],
  declarations: [
    PluginBannerUI,
    PluginPortal,
    IFrameSrcPipe,
  ],
  exports: [
    PluginBannerUI,
  ],
  providers: [
    {
      provide: APPEND_SCRIPT_TOKEN,
      useFactory: appendScriptFactory,
      deps: [ DOCUMENT ]
    },
    {
      provide: REMOVE_SCRIPT_TOKEN,
      useFactory: removeScriptFactory,
      deps: [ DOCUMENT ]
    },
  ]
})
export class PluginModule{}