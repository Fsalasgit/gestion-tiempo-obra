import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProjectText,searchProjects} from '../src/lib/projectSearch.js';
import {estimateTruckArrival,TRUCK_SPEED_PRESETS} from '../src/lib/routeEstimate.js';
const projects=[{id:'1',numero:'PR-261011',proyecto:'Shopping Vidrios',cliente:'Pérez'},{id:'2',numero:'PR-30555',proyecto:'Fachada Córdoba',cliente:'Gómez'},{id:'3',numero:'PR-40999',proyecto:'Local comercial',cliente:'Zamora'}];
test('busca obras por número, cliente y nombre tolerando acentos',()=>{
 assert.equal(normalizeProjectText('PÉREZ'),'perez');
 assert.equal(searchProjects(projects,'261011')[0].id,'1');
 assert.equal(searchProjects(projects,'perez shopping')[0].id,'1');
 assert.equal(searchProjects(projects,'CORDOBA')[0].id,'2');
 assert.equal(searchProjects(projects,'no existe').length,0);
});
test('limita el número de coincidencias al buscar un catálogo grande',()=>{
 assert.equal(searchProjects(projects,'',2).length,2);
 assert.equal(searchProjects(projects,'PR',1).length,1);
});
test('camión cargado calcula 20 km a 30 km/h como 40 minutos de ida',()=>{
 const e=estimateTruckArrival(20000,30,'2026-11-20T08:00');
 assert.equal(e.distanceKm,20);assert.equal(e.travelMinutes,40);
 assert.equal(e.totalMinutes,40);assert.ok(e.arrivalISO.endsWith('11:40:00.000Z') || Number.isFinite(Date.parse(e.arrivalISO)));
});
test('sumar demora y velocidad 50 km/h recalcula llegada sin consultar Maps',()=>{
 const e=estimateTruckArrival(50000,50,'2026-11-20T09:00',20);
 assert.equal(e.totalMinutes,80);
 assert.equal(new Date(e.arrivalISO).getTime()-new Date('2026-11-20T09:00').getTime(),80*60000);
 assert.equal(TRUCK_SPEED_PRESETS[1].speed,50);
});
test('rechaza distancias/velocidades/fechas erróneas',()=>{
 assert.throws(()=>estimateTruckArrival(-20,30,'2026-11-20T08:00'),/Distancia/);
 assert.throws(()=>estimateTruckArrival(10000,0,'2026-11-20T08:00'),/velocidad/);
 assert.throws(()=>estimateTruckArrival(10000,30,'2026-11-20',0),/fecha y hora/);
 assert.throws(()=>estimateTruckArrival(10000,30,'2026-11-20T08:00',1000),/demoras/);
});
