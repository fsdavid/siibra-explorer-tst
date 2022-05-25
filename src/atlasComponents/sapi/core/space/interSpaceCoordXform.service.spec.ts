import { InterSpaceCoordXformSvc, VALID_TEMPLATE_SPACE_NAMES } from './interSpaceCoordXform.service'
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing'
import { TestBed, fakeAsync, tick } from '@angular/core/testing'

describe('InterSpaceCoordXformSvc.service.spec.ts', () => {
  describe('InterSpaceCoordXformSvc', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [
          HttpClientTestingModule
        ],
        providers: [
          InterSpaceCoordXformSvc
        ]
      })
    })

    afterEach(() => {
      const ctrl = TestBed.inject(HttpTestingController)
      ctrl.verify()
    })

    describe('#transform', () => {
      it('should instantiate service properly', () => {
        const service = TestBed.inject(InterSpaceCoordXformSvc)
        expect(service).toBeTruthy()
        expect(service.transform).toBeTruthy()
      })

      it('should transform argument properly', () => {
        const service = TestBed.inject(InterSpaceCoordXformSvc)
        const httpTestingController = TestBed.inject(HttpTestingController)

        // subscriptions are necessary for http fetch to occur
        service.transform(
          VALID_TEMPLATE_SPACE_NAMES.MNI152,
          VALID_TEMPLATE_SPACE_NAMES.BIG_BRAIN,
          [1,2,3]
        ).subscribe((_ev) => {
          
        })
        const req = httpTestingController.expectOne(service['url'])
        expect(req.request.method).toEqual('POST')
        expect(
          JSON.parse(req.request.body)
        ).toEqual({
          'source_space': VALID_TEMPLATE_SPACE_NAMES.MNI152,
          'target_space': VALID_TEMPLATE_SPACE_NAMES.BIG_BRAIN,
          'source_points': [
            [1e-6, 2e-6, 3e-6]
          ]
        })
        req.flush({})
      })


      it('should transform response properly', () => {

        const service = TestBed.inject(InterSpaceCoordXformSvc)
        const httpTestingController = TestBed.inject(HttpTestingController)

        service.transform(
          VALID_TEMPLATE_SPACE_NAMES.MNI152,
          VALID_TEMPLATE_SPACE_NAMES.BIG_BRAIN,
          [1,2,3]
        ).subscribe(({ status, result }) => {
          expect(status).toEqual('completed')
          expect(result).toEqual([1e6, 2e6, 3e6])
        })
        const req = httpTestingController.expectOne(service['url'])
        req.flush({
          'target_points':[
            [1, 2, 3]
          ]
        })
      })

      it('if server returns >=400, fallback gracefully', done => {
        const service = TestBed.inject(InterSpaceCoordXformSvc)
        const httpTestingController = TestBed.inject(HttpTestingController)

        service.transform(
          VALID_TEMPLATE_SPACE_NAMES.MNI152,
          VALID_TEMPLATE_SPACE_NAMES.BIG_BRAIN,
          [1,2,3]
        ).subscribe(({ status }) => {
          expect(status).toEqual('error')
          done()
        })
        const req = httpTestingController.expectOne(service['url'])
        
        req.flush('intercepted', { status: 500, statusText: 'internal server error' })
      })

      it('if server does not respond after 3s, fallback gracefully', fakeAsync(() => {

        const service = TestBed.inject(InterSpaceCoordXformSvc)
        const httpTestingController = TestBed.inject(HttpTestingController)

        service.transform(
          VALID_TEMPLATE_SPACE_NAMES.MNI152,
          VALID_TEMPLATE_SPACE_NAMES.BIG_BRAIN,
          [1,2,3]
        ).subscribe(({ status, statusText }) => {
          expect(status).toEqual('error')
          expect(statusText).toEqual(`Timeout after 3s`)
        })
        const req = httpTestingController.expectOne(service['url'])
        tick(4000)
        expect(req.cancelled).toBe(true)
      }))
    })
  })
})
