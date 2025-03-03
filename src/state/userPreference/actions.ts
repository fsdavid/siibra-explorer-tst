import { createAction, props } from "@ngrx/store"
import { nameSpace, CSP } from "./const"

export const setAnimationFlag = createAction(
  `${nameSpace} setAnimationFlag`,
  props<{
    flag: boolean
  }>()
)

export const setGpuLimit = createAction(
  `${nameSpace} setGpuLimit`,
  props<{
    limit: number
  }>()
)

export const useMobileUi = createAction(
  `${nameSpace} setUseMobileUi`,
  props<{
    flag: boolean
  }>()
)

export const agreeCookie = createAction(
  `${nameSpace} agreeCookie`
)

export const agreeKgTos = createAction(
  `${nameSpace} agreeKgTos`
)

export const updateCsp = createAction(
  `${nameSpace} updateCsp`,
  props<{
    name: string
    csp: CSP
  }>()
)