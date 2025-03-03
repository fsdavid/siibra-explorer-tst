import { Pipe, PipeTransform } from "@angular/core";
import { SapiParcellationModel } from "src/atlasComponents/sapi/type";
import { GroupedParcellation } from "./groupedParcellation";

type Filterables = SapiParcellationModel | GroupedParcellation

const unsupportedIds = [
  "https://doi.org/10.1016/j.jneumeth.2020.108983/mni152",
  "https://identifiers.org/neurovault.image:23262"
]

const hideGroup = [
]

@Pipe({
  name: `filterUnsupportedParc`,
  pure: true
})

export class FilterUnsupportedParcPipe implements PipeTransform{
  public transform<T extends Filterables>(parcs: T[]): T[] {
    return (parcs || []).filter(p => {
      if (p instanceof GroupedParcellation) {
        return hideGroup.indexOf(p.name) < 0
      }
      if (unsupportedIds.includes(p["@id"])) {
        return false
      }
      if (p.version) {
        return !p.version.deprecated
      }
      return true
    })
  }
}
