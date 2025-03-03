import { Component, Inject } from "@angular/core";
import { MAT_DIALOG_DATA } from "@angular/material/dialog";

export type FallBackData = {
  title: string
  actions?: string[]
  desc?: string
  descMd?: string
}

@Component({
  selector: 'sxplr-dialog-fallback-tmpl',
  templateUrl: './tmpl.template.html',
  styleUrls: [
    './tmpl.style.css'
  ],
})

export class DialogFallbackCmp {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: FallBackData
  ){

  }
}
