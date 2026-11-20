import React from 'react';
import {RANGE_OPTIONS} from '../lib/ganttRange.js';

/** Controles accesibles, iguales en las vistas operativa, gerencial y de cliente. */
export default function RangeButtons({value,onChange,showMonth=true,options=RANGE_OPTIONS}){
 return <div className="gantt-range" role="group" aria-label="Período del cronograma">
  {options.filter(option=>showMonth||option.value!=='month').map(option=><button key={option.value} type="button" className={value===option.value?'active':''} aria-pressed={value===option.value} onClick={()=>onChange(option.value)}>{option.label}</button>)}
 </div>;
}
