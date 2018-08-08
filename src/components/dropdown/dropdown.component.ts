import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, HostListener, ViewChild, ElementRef } from "@angular/core";
import { dropdownAnimation } from "./dropdown.animation";

@Component({
  selector : 'dropdown',
  templateUrl : './dropdown.template.html',
  styleUrls : [
    `./dropdown.style.css`
  ],
  styles : [
    `
ul > li.selected > span:before
{
  content: '\u2022';
  width : 1em;
  display:inline-block;
}
ul > li:not(.selected) > span:before
{
  content: ' ';
  width : 1em;
  display:inline-block;
}  
    `
  ],
  animations:[
    dropdownAnimation
  ],
  changeDetection : ChangeDetectionStrategy.OnPush
})

export class DropdownComponent{

  @Input() inputArray : any[] = []
  @Input() selectedItem : any | null = null

  @Input() listDisplay : (obj:any)=>string = (obj)=>obj.name
  @Input() activeDisplay : (obj:any|null)=>string = (obj)=>obj ? obj.name : `Please select an item.`

  @Output() itemSelected : EventEmitter<any> = new EventEmitter()

  @ViewChild('dropdownToggle',{read:ElementRef}) dropdownToggle : ElementRef

  openState : boolean = false

  @HostListener('document:click',['$event'])
  close(event:MouseEvent){
    const contains = this.dropdownToggle.nativeElement.contains(event.srcElement)
    if(contains)
      this.openState = !this.openState
    else
      this.openState = false;
  }
}