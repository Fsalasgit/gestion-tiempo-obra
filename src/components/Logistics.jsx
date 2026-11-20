import React,{useEffect,useMemo,useRef,useState} from 'react';
import {ArrowRight,Clock3,MapPin,RefreshCcw,Truck} from 'lucide-react';
import {estimateTruckArrival,localDatetimeValue,TRUCK_SPEED_PRESETS} from '../lib/routeEstimate.js';
import '../capacity.css';
import './logistics.css';
const ORIGIN='Avenida Siria 1633, San Miguel de Tucumán, Tucumán, Argentina';
const intFormat=new Intl.NumberFormat('es-AR',{maximumFractionDigits:2});
const minuteText=minutes=>`${Math.floor(minutes/60)} h ${String(minutes%60).padStart(2,'0')} min`;
export default function Logistics({data,routeLookup}){
 const addresses=useMemo(()=>data.estimates.filter(e=>e.address&&data.projects.some(p=>String(p.id)===String(e.projectId))),[data.estimates,data.projects]);
 const [selected,setSelected]=useState('');
 const [speedPreset,setSpeedPreset]=useState('cargado');
 const [speed,setSpeed]=useState(30);
 const [departure,setDeparture]=useState(()=>localDatetimeValue());
 const [extra,setExtra]=useState(0);
 const [route,setRoute]=useState(null);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(false);
 const requestSequence=useRef(0);
 const estimate=addresses.find(e=>String(e.projectId)===String(selected));
 const address=String(estimate?.address||'').trim();
 const project=data.projects.find(p=>String(p.id)===String(selected));
 const destination=/\bargentina\b/i.test(address)?address:`${address}, ${project?.localidad ? project.localidad+', ' : ''}Tucumán, Argentina`;
 const url=address?`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(ORIGIN)}&destination=${encodeURIComponent(destination)}&travelmode=driving`:'';
 useEffect(()=>{requestSequence.current+=1;setRoute(null);setError('');setLoading(false);},[selected,address]);
 let forecast=null,forecastError='';
 if(route){try{forecast=estimateTruckArrival(route.distanceMeters,speed,departure,Number(extra));}catch(e){forecastError=e.message;}}
 const calculate=async()=>{
  if(!selected||loading)return;
  const sequence=++requestSequence.current;
  setLoading(true);setError('');setRoute(null);
  try{const result=await routeLookup(selected);if(result?.distanceMeters==null)throw Error('No llegó la distancia por ruta.');if(sequence===requestSequence.current)setRoute(result);}
  catch(e){if(sequence===requestSequence.current)setError(e.message||'No fue posible consultar la ruta.');}
  finally{if(sequence===requestSequence.current)setLoading(false);}
 };
 const setPreset=id=>{setSpeedPreset(id);const p=TRUCK_SPEED_PRESETS.find(p=>p.id===id);if(p&&id!=='personalizado')setSpeed(p.speed);};
 return <div className="logistics-grid">
  <div className="cap-panel">
   <div className="cap-intro"><div><h2>Logística · cálculo de ida</h2><p>Distancia vial desde ABALUM hasta una obra y llegada teórica del camión.</p></div></div>
   <div className="cap-logistics-origin"><MapPin size={21}/><div><small>ORIGEN FIJO · ABALUM</small><b>{ORIGIN}</b></div></div>
   <div className="log-fields">
    <label>Obra con dirección cargada<select value={selected} onChange={e=>{requestSequence.current+=1;setSelected(e.target.value);setRoute(null);setLoading(false);setError('');}}><option value="">Elegir obra…</option>{addresses.map(e=>{const p=data.projects.find(p=>String(p.id)===String(e.projectId));return <option value={e.projectId} key={e.projectId}>{p?.numero} · {e.address}</option>;})}</select></label>
    {address&&<div className="log-destination"><small>Dirección de destino</small><b>{address}</b>{project?.localidad&&<small>{project.localidad}</small>}</div>}
    <div className="log-actions"><button className="cap-btn primary" type="button" disabled={!address||loading} onClick={calculate}>{loading?<RefreshCcw size={16} className="log-spinner"/>:<Truck size={17}/>} {loading?'Calculando ruta…':'Calcular kilómetros de ida'}</button>{address&&<a href={url} className="cap-btn" rel="noopener noreferrer" target="_blank"><MapPin size={16}/> Ver en Google Maps <ArrowRight size={15}/></a>}</div>
    {error&&<div className="log-error" role="alert">{error}</div>}
   </div>
  </div>
  <div className="cap-panel">
   <div className="cap-intro"><div><h2>Camión · horario estimado</h2><p>Velocidad media prevista y horario de salida para calcular la llegada.</p></div></div>
   <div className="log-fields">
    <label>Modalidad de viaje<select value={speedPreset} onChange={e=>setPreset(e.target.value)}>{TRUCK_SPEED_PRESETS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
    <div className="log-two-cols"><label>Velocidad media (km/h)<input type="number" min="5" max="110" step="5" value={speed} onChange={e=>{setSpeedPreset('personalizado');setSpeed(e.target.value);}}/></label><label>Demora adicional (min)<input type="number" min="0" max="300" step="5" value={extra} onChange={e=>setExtra(e.target.value)}/></label></div>
    <label>Salida prevista<input type="datetime-local" value={departure} onChange={e=>setDeparture(e.target.value)}/></label>
   </div>
   {route&&forecast&&!forecastError?<div className="log-results" aria-live="polite">
      <div><small>Distancia por ruta · ida</small><strong>{intFormat.format(forecast.distanceKm)} km</strong></div>
      <div><small>Tiempo camión ({speed} km/h)</small><strong>{minuteText(forecast.totalMinutes)}</strong></div>
      <div className="log-arrival"><small>Llegada estimada</small><strong>{new Intl.DateTimeFormat('es-AR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(forecast.arrivalISO))}</strong></div>
      <div className="log-detail"><Clock3 size={15}/> Tiempo vial de referencia (auto, Google): {minuteText(Math.ceil(route.drivingDurationSeconds/60))}{Number(extra)>0?` · incluye ${extra} min de demora`:''}</div>
      {route.destinationResolved&&<small className="log-resolved">Destino encontrado por Google: {route.destinationResolved}</small>}
     </div>:<div className="log-placeholder">{forecastError?<span role="alert">{forecastError}</span>:'Seleccioná una obra y calculá su recorrido para ver distancia y llegada.'}</div>}
   <p className="log-disclaimer">La distancia proviene de una ruta de conducción. La llegada del camión es una estimación basada en la velocidad configurada, no incorpora tránsito real, restricciones para camiones ni tiempos de descarga. No descuenta todavía capacidad de colocación.</p>
  </div>
 </div>;
}
