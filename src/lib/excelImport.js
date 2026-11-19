import { normalizeKey, validProjectStatus, toISODate, sortProjects } from './domain.js';

function field(row, aliases) {
  for (const alias of aliases) {
    const key = Object.keys(row).find(k=>normalizeKey(k)===normalizeKey(alias));
    if (key!==undefined && row[key]!==undefined && row[key]!==null && row[key]!=='')return row[key];
  }
  return '';
}
const str = x=>String(x??'').trim();
/** Admite exportación anterior por artículo y exportación 19/11 por obra (28 columnas). */
export function normalizeProjectRows(rows) {
  if (!Array.isArray(rows) || !rows.length)throw Error('El Excel está vacío.');
  const first=rows[0];
  const keys=Object.keys(first).map(normalizeKey);
  if (!keys.includes('numero') || (!keys.includes('nombre')&&!keys.includes('proyecto')))
    throw Error('Formato no reconocido. Se esperan las columnas Numero y Nombre (o Proyecto).');
  const projects=new Map();let skipped=0,closed=0,duplicateRows=0,acceptedRows=0;
  for (const row of rows) {
    const numero=str(field(row,['Numero']));
    const nombre=str(field(row,['Nombre','Proyecto']));
    if (!numero||!nombre){skipped++;continue;}
    const estado=str(field(row,['Estado','PR - Estado']));
    if (!validProjectStatus(estado)) {closed++;continue;}
    const id=str(field(row,['Project ID']))||numero;
    const input={
      id,numero,proyecto:nombre,cliente:str(field(row,['Cliente'])),estado,
      inicio:toISODate(field(row,['Inicio'])),inicioP:toISODate(field(row,['Inicio P.'])),
      fechaEntrega:toISODate(field(row,['Fin P.','Fec Entrega','Fecha Entrega'])),
      produccion:str(field(row,['Producido','Produccion'])),entrega:str(field(row,['Entrega'])),
      lider:str(field(row,['Lider Proyecto','Lider de Proyecto'])),
      localidad:str(field(row,['Localidad Proyecto'])),items:1
    };
    if(projects.has(id)) {
      const current=projects.get(id);current.items+=1;duplicateRows++;
      if (current.produccion!==input.produccion) current.produccion='Mixta';
      if (current.entrega!==input.entrega) current.entrega='Mixta';
    } else projects.set(id,input);
    acceptedRows++;
  }
  if(!projects.size)throw Error('No se encontraron proyectos activos. El origen no se modificó.');
  return {projects:sortProjects([...projects.values()]),report:{originalRows:rows.length,active:projects.size,closed,skipped,duplicateRows,acceptedRows}};
}
export async function previewExcelFile(file){
  if (!/\.xlsx?$/i.test(file?.name||''))throw Error('Elegí un archivo .xls o .xlsx');
  const {read,utils}=await import('xlsx');
  const workbook=read(await file.arrayBuffer(),{type:'array',cellDates:true});
  const first=workbook.SheetNames[0];if(!first)throw Error('El archivo no tiene hojas.');
  const rows=utils.sheet_to_json(workbook.Sheets[first],{defval:'',raw:true});
  return {...normalizeProjectRows(rows),sheetName:first};
}
