import { CommonModule, DOCUMENT } from "@angular/common"
import { HttpClientModule } from "@angular/common/http"
import { Component, EventEmitter, Output } from "@angular/core"
import { Meta, moduleMetadata, Story } from "@storybook/angular"
import { SAPI, SapiAtlasModel, SapiParcellationModel, SapiRegionModel, SapiSpaceModel } from "src/atlasComponents/sapi"
import { getHoc1Features, getHoc1Left, getHumanAtlas, getJba29, getMni152, HumanHoc1StoryBase } from "src/atlasComponents/sapi/stories.base"
import { AngularMaterialModule } from "src/sharedModules"
import { appendScriptFactory, APPEND_SCRIPT_TOKEN } from "src/util/constants"
import { ReceptorViewModule } from ".."

@Component({
  selector: 'fingerprint-wrapper-cmp',
  template: `
  <sxplr-sapiviews-features-receptor-fingerprint
    [sxplr-sapiviews-features-receptor-atlas]="atlas"
    [sxplr-sapiviews-features-receptor-parcellation]="parcellation"
    [sxplr-sapiviews-features-receptor-template]="template"
    [sxplr-sapiviews-features-receptor-region]="region"
    [sxplr-sapiviews-features-receptor-featureid]="featureId"
    (sxplr-sapiviews-features-receptor-fingerprint-receptor-selected)="selectReceptor.emit($event)"
  >
  </sxplr-sapiviews-features-receptor-fingerprint>
  `,
  styles: [
    `
    :host
    {
      display: block;
      width: 20rem;
      height: 20rem;
    }
    `
  ]
})
class FingerprintWrapperCls {
  atlas: SapiAtlasModel
  parcellation: SapiParcellationModel
  template: SapiSpaceModel
  region: SapiRegionModel
  featureId: string

  @Output()
  selectReceptor = new EventEmitter()
}

export default {
  component: FingerprintWrapperCls,
  decorators: [
    moduleMetadata({
      imports: [
        CommonModule,
        AngularMaterialModule,
        HttpClientModule,
        ReceptorViewModule,
      ],
      providers: [
        SAPI,
        {
          provide: APPEND_SCRIPT_TOKEN,
          useFactory: appendScriptFactory,
          deps: [ DOCUMENT ]
        }
      ],
      declarations: []
    })
  ],
} as Meta

const Template: Story<FingerprintWrapperCls> = (args: FingerprintWrapperCls, { loaded }) => {
  const { atlas, parc, space, region, receptorfeat } = loaded
  return ({
    props: {
      ...args,
      atlas: atlas,
      parcellation: parc,
      template: space,
      region: region,
      featureId: receptorfeat["@id"]
    },
  })
}

Template.loaders = [
  async () => {
    const atlas = await getHumanAtlas()
    const parc = await getJba29()
    const region = await getHoc1Left()
    const space = await getMni152()
    const features = await getHoc1Features()
    const receptorfeat = features.find(f => f.type === "siibra/receptor")
    return {
      atlas, parc, space, region, receptorfeat
    }
  }
]

export const Default = Template.bind({})
Default.args = {

}
Default.loaders = [
  ...Template.loaders
]