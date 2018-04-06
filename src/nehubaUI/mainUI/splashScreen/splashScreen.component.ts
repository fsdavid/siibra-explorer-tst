import { Component } from '@angular/core'
import { MainController } from 'nehubaUI/nehubaUI.services'

import template from './splashScreen.template.html'
import css from './splashScreen.style.css'
import { TemplateDescriptor } from 'nehubaUI/nehuba.model';

@Component({
  selector : 'nehuba-ui-splash-screen',
  template : template,
  styles : [ css ]
})

export class SplashScreen{

  constructor(public mainController:MainController){
  }

  loadTemplate(template:TemplateDescriptor){
    this.mainController.selectedTemplateBSubject.next(template)
  }
}