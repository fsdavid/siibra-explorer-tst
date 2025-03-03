import { InjectionToken } from "@angular/core";
import { Observable } from "rxjs";

export const CLICK_INTERCEPTOR_INJECTOR = new InjectionToken<ClickInterceptor>('CLICK_INTERCEPTOR_INJECTOR')

export type TClickInterceptorConfig = {
  last?: boolean
}

export interface ClickInterceptor{
  register: (interceptorFunction: (ev: any) => boolean, config?: TClickInterceptorConfig) => void
  deregister: (interceptorFunction: (ev: any) => any) => void
}

export const CONTEXT_MENU_ITEM_INJECTOR = new InjectionToken('CONTEXT_MENU_ITEM_INJECTOR')

export type TContextMenu<T> = {
  register: (fn: T) => void
  deregister: (fn: (fn: T) => void) => void
}

export const DARKTHEME = new InjectionToken<Observable<boolean>>('DARKTHEME')
