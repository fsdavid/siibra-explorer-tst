import { AfterViewInit, Component, ComponentFactoryResolver, Inject, Injector, Input, OnDestroy, Optional, Pipe, PipeTransform, ViewChild, ViewContainerRef } from "@angular/core";
import { IAnnotationGeometry, UDPATE_ANNOTATION_TOKEN } from "../tools/type";
import { Point } from '../tools/point'
import { Polygon } from '../tools/poly'
import { UntypedFormControl, UntypedFormGroup } from "@angular/forms";
import { Subscription } from "rxjs";
import { select, Store } from "@ngrx/store";
import { ModularUserAnnotationToolService } from "../tools/service";
import { MatSnackBar } from "@angular/material/snack-bar";
import { Line } from "../tools/line";
import { atlasSelection } from "src/state";
import { map } from "rxjs/operators";

@Component({
  selector: 'single-annotation-unit',
  templateUrl: './singleAnnotationUnit.template.html',
  styleUrls: [
    './singleAnnotationUnit.style.css',
  ]
})

export class SingleAnnotationUnit implements OnDestroy, AfterViewInit{
  @Input('single-annotation-unit-annotation')
  public managedAnnotation: IAnnotationGeometry

  public formGrp: UntypedFormGroup

  @ViewChild('editAnnotationVCRef', { read: ViewContainerRef })
  editAnnotationVCR: ViewContainerRef

  private chSubs: Subscription[] = []
  private subs: Subscription[] = []
  public templateSpaces: {
    ['@id']: string
  }[] = []
  ngOnChanges(){
    while(this.chSubs.length > 0) this.chSubs.pop().unsubscribe()
    
    this.formGrp = new UntypedFormGroup({
      name: new UntypedFormControl(this.managedAnnotation.name),
      spaceId: new UntypedFormControl({
        value: this.managedAnnotation.space["@id"],
        disabled: true
      }),
      desc: new UntypedFormControl(this.managedAnnotation.desc),
    })

    this.chSubs.push(
      this.formGrp.valueChanges.subscribe(value => {
        const { name, desc, spaceId } = value
        this.managedAnnotation.name = name
        this.managedAnnotation.desc = desc
      })
    )
  }

  public tmpls$ = this.store.pipe(
    select(atlasSelection.selectors.selectedTemplate),
    map(val => {
      return [val]
    })
  )

  constructor(
    private store: Store<any>,
    private snackbar: MatSnackBar,
    private svc: ModularUserAnnotationToolService,
    private cfr: ComponentFactoryResolver,
    private injector: Injector,
  ){
  }

  ngAfterViewInit(){
    if (this.managedAnnotation && this.editAnnotationVCR) {
      const editCmp = this.svc.getEditAnnotationCmp(this.managedAnnotation)
      if (!editCmp) {
        this.snackbar.open(`Update component not found!`, 'Dismiss', {
          duration: 3000
        })
        throw new Error(`Edit component not found!`)
      }
      const cf = this.cfr.resolveComponentFactory(editCmp)
      
      const injector = Injector.create({
        providers: [{
          provide: UDPATE_ANNOTATION_TOKEN,
          useValue: this.managedAnnotation
        }],
        parent: this.injector
      })
      this.editAnnotationVCR.createComponent(cf, null, injector)
    }
  }

  ngOnDestroy(){
    while (this.subs.length > 0) this.subs.pop().unsubscribe()
  }

}

@Pipe({
  name: 'singleAnnotationNamePipe',
  pure: true
})

export class SingleAnnotationNamePipe implements PipeTransform{
  public transform(ann: IAnnotationGeometry, name?: string): string{
    if (name) return name
    if (ann instanceof Polygon) return `Unnamed Polygon`
    if (ann instanceof Point) return `Unnamed Point`
    if (ann instanceof Line) return `Unnamed Line`
    return `Unnamed geometry`
  }
}

@Pipe({
  name: 'singleannotationClsIconPipe',
  pure: true
})

export class SingleAnnotationClsIconPipe implements PipeTransform{
  public transform(ann: IAnnotationGeometry): string{
    if (ann instanceof Polygon) return `fas fa-draw-polygon`
    if (ann instanceof Point) return `fas fa-circle`
    if (ann instanceof Line) return `fas fa-slash`
    return `fas fa-mouse-pointer`
  }
}
