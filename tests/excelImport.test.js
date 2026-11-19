import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeProjectRows} from '../src/lib/excelImport.js';
import projects from '../src/data/demo-projects.json' with {type:'json'};
test('Se reconoce la nueva cabecera de 28 columnas y se excluyen terminados',()=>{
const x=normalizeProjectRows([
 {'Estado':'Terminado',' Numero':'PR-1',Nombre:'Finalizado',Cliente:'X'},
 {'Estado':'Ejecucion',' Numero':'PR-2',Nombre:'Obra nueva',Cliente:'X','Producido':'Parcial','Inicio P.':46339,'Localidad Proyecto':'TUCUMAN'},
 {'Estado':'Cancelado',' Numero':'PR-3',Nombre:'Cancelada'},
 {'Estado':'1963',Numero:'',Nombre:''}
]);assert.equal(x.projects.length,1);assert.equal(x.projects[0].numero,'PR-2');assert.equal(x.projects[0].inicioP,'2026-11-13');assert.equal(x.report.closed,2);});
test('Se agrupan artículos del formato anterior, sin alterar los tiempos',()=>{
 const r=normalizeProjectRows([{Numero:'PR-11',Proyecto:'Obra', 'PR - Estado':'Ejecucion','Project ID':'20'},{Numero:'PR-11',Proyecto:'Obra', 'PR - Estado':'Ejecucion','Project ID':'20'}]);assert.equal(r.projects[0].items,2);assert.equal(r.projects.length,1);
});
test('Los proyectos de demostración son ficticios y tienen claves únicas',()=>{assert.equal(projects.length,6);assert.equal(new Set(projects.map(p=>p.id)).size,6);assert(projects.every(p=>p.estado!=='Terminado'&&p.numero));});
