import {ConnectivityBrowserComponent} from "./connectivityBrowser.component";
import {ComponentFixture, TestBed} from "@angular/core/testing";
import {Action} from "@ngrx/store";
import {CUSTOM_ELEMENTS_SCHEMA, Directive, Input} from "@angular/core";
import {provideMockActions} from "@ngrx/effects/testing";
import {MockStore, provideMockStore} from "@ngrx/store/testing";
import {Observable, of} from "rxjs";
import {SAPI} from "src/atlasComponents/sapi";
import {AngularMaterialModule} from "src/sharedModules";
import { SapiAtlasModel, SapiModalityModel, SapiParcellationFeatureModel, SapiParcellationModel } from "src/atlasComponents/sapi/type";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";

/**
 * injecting databrowser module is bad idea
 * since it relies on its own selectors
 * since the only reason why data browser is imported is to use show dataset dialogue
 * just use a dummy directive
 */
const MOCK_BS_ENDPOINT = `http://localhost:1234`

@Directive({
    selector: '[iav-dataset-show-dataset-dialog]'
})

class DummyDirective{
    @Input('iav-dataset-show-dataset-dialog-name')
    name: string
    @Input('iav-dataset-show-dataset-dialog-description')
    description: string
    @Input('iav-dataset-show-dataset-dialog-kgid')
    kgId: string
    @Input('iav-dataset-show-dataset-dialog-kgschema')
    kgSchema: string
}

describe('ConnectivityComponent', () => {

    let component: ConnectivityBrowserComponent;
    let fixture: ComponentFixture<ConnectivityBrowserComponent>;
    const actions$: Observable<Action> = of({type: 'TEST'})
    let httpTestingController: HttpTestingController;
    let req

    const types: SapiModalityModel[] = [{
        name: 'StreamlineCounts',
        types: ['siibra/features/connectivity/streamlineCounts']
    },{
        name: 'StreamlineLengths',
        types: ['siibra/features/connectivity/streamlineLengths']
    },{
        name: 'FunctionalConnectivity',
        types: ['siibra/features/connectivity/functional']
    }]

    let datasetList: SapiParcellationFeatureModel[] = [
        {
            '@id': 'id1',
            name: 'id1',
            cohort: 'HCP',
            subject: '100',
            '@type': 'siibra/features/connectivity/streamlineCounts',
        } as SapiParcellationFeatureModel, {
            '@id': 'id2',
            name: 'id2',
            cohort: '1000BRAINS',
            subject: 'average',
        } as SapiParcellationFeatureModel
    ]

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [
                HttpClientTestingModule,
                AngularMaterialModule
            ],
            providers: [
                provideMockActions(() => actions$),
                provideMockStore(),
                {
                    provide: SAPI,
                    useValue: {
                        atlases$: of([]),
                        getParcellation: jasmine.createSpy('getParcellation'), // getFeatureInstance(instanceId: string): Observable<SapiParcellationFeatureModel>
                        getSpaceDetail: jasmine.createSpy('getSpaceDetail'),
                        getParcDetail: jasmine.createSpy('getParcDetail'),
                        getParcRegions: jasmine.createSpy('getParcRegions'),
                    }
                }
            ],
            declarations: [
                ConnectivityBrowserComponent,
                DummyDirective,
            ],
            schemas: [
                CUSTOM_ELEMENTS_SCHEMA,
            ],
        }).compileComponents()
        httpTestingController = TestBed.inject(HttpTestingController);
    });

    it('> component can be created', async () => {
        fixture = TestBed.createComponent(ConnectivityBrowserComponent)
        component = fixture.componentInstance
        expect(component).toBeTruthy()
    })

    describe('> Select modality', async () => {
        beforeEach(async () => {
            fixture = TestBed.createComponent(ConnectivityBrowserComponent)
            component = fixture.componentInstance
            component.types = types

            const atlas = 'atlases/juelich/iav/atlas/v1.0.0/1'
            const parcellation = 'minds/core/parcellationatlas/v1.0.0/94c1125b-b87e-45e4-901c-00daee7f2579-290'
            const endp = await SAPI.BsEndpoint$.toPromise()

            component.atlas = { '@id': atlas } as SapiAtlasModel
            component.parcellation = { '@id': parcellation } as SapiParcellationModel

            component.selectType('StreamlineCounts')

            const url = `${endp}/atlases/${encodeURIComponent(atlas)}/parcellations/${encodeURIComponent(parcellation)}/features?type=${component.selectedTypeId}&size=${100}&page=${1}`

            req = httpTestingController.expectOne(`${url}`);

            await req.flush({
                page: 1,
                size: 2,
                total: 2,
                items: datasetList
            });
        })

        it('> Get request should be called', () => {
            expect(req.request.method).toEqual('GET')
        })

        it('> Datasets are set correctly', () => {
            expect(datasetList).toEqual(component.fetchedItems)
        })
        
        it('> Cohorts are set correctly', () => {
            expect(datasetList.map(d => d.cohort)).toEqual(component.cohorts)
        })
    })

});
