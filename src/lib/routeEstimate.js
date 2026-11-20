export const TRUCK_SPEED_PRESETS = [
  {id:'cargado',label:'Camión cargado · 30 km/h',speed:30},
  {id:'ruta',label:'Viaje largo · 50 km/h',speed:50},
  {id:'personalizado',label:'Velocidad personalizada',speed:40},
];
export function estimateTruckArrival(distanceMeters,speedKmH,departureLocal,extraMinutes=0){
 const distance=Number(distanceMeters),speed=Number(speedKmH),extra=Number(extraMinutes);
 if(!Number.isFinite(distance)||distance<0)throw Error('Distancia de ruta inválida.');
 if(!Number.isFinite(speed)||speed<5||speed>110)throw Error('Indicá una velocidad media entre 5 y 110 km/h.');
 if(!Number.isFinite(extra)||extra<0||extra>300)throw Error('Las demoras adicionales deben estar entre 0 y 300 minutos.');
 // Control explícito para evitar que Date.parse acepte fechas incompletas o deslocalizadas.
 if(typeof departureLocal!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(departureLocal))throw Error('Indicá fecha y hora de salida.');
 const date=new Date(departureLocal);
 if(Number.isNaN(date.getTime()))throw Error('Fecha y hora de salida inválidas.');
 const travelMinutes=Math.ceil(distance/1000/speed*60);
 const totalMinutes=travelMinutes+extra;
 return {distanceKm:Math.round(distance/10)/100,travelMinutes,totalMinutes,arrivalISO:new Date(date.getTime()+totalMinutes*60000).toISOString()};
}
export function localDatetimeValue(date=new Date()){
 const pad=x=>String(x).padStart(2,'0');
 return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
