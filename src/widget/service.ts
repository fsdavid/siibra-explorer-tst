import { ComponentPortal } from "@angular/cdk/portal";
import { ComponentFactory, ComponentFactoryResolver, ComponentRef, Injectable, Injector, ViewContainerRef } from "@angular/core";
import { RM_WIDGET } from "./constants";
import { WidgetPortal } from "./widgetPortal/widgetPortal.component";

@Injectable({
  providedIn: 'root'
})

export class WidgetService {
  
  public vcr: ViewContainerRef

  private viewRefMap = new Map<WidgetPortal<unknown>, ComponentRef<WidgetPortal<unknown>>>()
  private cf: ComponentFactory<WidgetPortal<unknown>>
  
  constructor(cfr: ComponentFactoryResolver){
    this.cf = cfr.resolveComponentFactory(WidgetPortal)
  }

  public addNewWidget<T>(Component: new (...arg: any) => T, injector: Injector): WidgetPortal<T> {
    const inj = Injector.create({
      providers: [{
        provide: RM_WIDGET,
        useValue: (cmp: WidgetPortal<T>) => this.rmWidget(cmp)
      }],
      parent: injector
    })
    const widgetPortal = this.vcr.createComponent(this.cf, 0, inj) as ComponentRef<WidgetPortal<T>>
    const cmpPortal = new ComponentPortal<T>(Component, this.vcr, inj)
    
    this.viewRefMap.set(widgetPortal.instance, widgetPortal)

    widgetPortal.instance.portal = cmpPortal
    return widgetPortal.instance
  }

  public rmWidget(wdg: WidgetPortal<unknown>) {
    
    /**
     * if wdg no longer exist in viewRefMap, it should already been deleted.
     */
    if (!this.viewRefMap.has(wdg)) {
      return
    }
    const hostView = this.viewRefMap.get(wdg).hostView

    this.viewRefMap.delete(wdg)
    
    const idx = this.vcr.indexOf(hostView)
    if (idx < 0) {
      console.warn(`idx less than 0, cannot remove`)
    }
    this.vcr.remove(idx)
  }
}
