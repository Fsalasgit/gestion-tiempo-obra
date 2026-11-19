# Análisis de exportaciones de proyectos

## Archivo actualizado — 19/11/2026 09:24:16

- Formato Microsoft Excel `.xls` (BIFF8 / OLE), hoja `Sheet1`.
- **28 columnas** (no el esquema de 48 columnas de la exportación de junio).
- Cabeceras originales: `Estado`, `Antig.`, ` Numero`, `Cliente`, `Nombre`, `Categoria`, `Inicio P.`, `Fin P.`, `Inicio`, `Fin `, ` Neto`, `Producido`, ` Entrega`, `Facturado`, `Saldo`, `Fecha Actualizacion`, `F. Ult Estado`, `OK Tecnico`, `Grupo`, ` Unidad Negocio`, `Contacto Cliente`, `Lider Proyecto`, `Comercial`, `Localidad Proyecto`, `Usuario Crea`, `Fecha Alta`, `Usuario Modifica`, `Fecha Modifica`.
- **1963 filas de proyectos + 1 fila de resumen**, además de los títulos.
- Estados contabilizados: `Terminado` 1828, `Cancelado` 33, `Ejecucion` 43, `Aprobado` 30, `Tecnica` 12, `Solicitado` 10, `Planificacion` 4, `Planificacion C` 2, `Pausa Cliente M` 1. La fila final de totales tiene contenido numérico de resumen y no es una obra.
- **102 proyectos no cerrados**, para seguimiento. La importación excluye `Terminado` y `Cancelado`, así como otros estados futuros inequívocamente cerrados.
- El nuevo esquema representa **una fila por obra**, en vez de varios artículos por proyecto.
- ID estable = `Numero` cuando no existe `Project ID` (nuevo archivo no lo incluye).
- `Nombre` se transforma en el campo interno `proyecto` para compatibilidad con el frontend v0.2.
- `Fin P.` se conserva como `fechaEntrega`/fin previsto sin reinterpretarlo como fecha de cierre confirmada.
- `Producido` y `Entrega` se conservan para consulta, pero **nunca definen por sí mismos** una obra terminada.
- `Localidad Proyecto` se guarda solo como contexto. La **dirección precisa de colocación** se carga en `tiempo_obra`, sin editar el origen.

## Archivo anterior — 03/06/2026 15:22:08

Era una exportación distinta, de 48 columnas, con repetición de artículos: alrededor de 116 proyectos únicos y 2625 registros. Incluía `Proyecto`, `PR - Estado` y `Project ID`. El importador conserva compatibilidad con este modelo y agrupa filas por `Project ID` o `Numero` sin duplicar tiempos.

## Reglas invariables

1. `proyecto` se **reemplaza solo** al importar/actualizar la fuente, no se edita manualmente.
2. `tiempo_obra` permanece independiente y **se conserva** aunque se actualice `proyecto`.
3. No forzar ni inventar una duración: el Excel **no trae tiempos de colocación**.
4. No editar fuente para asignar personal, fecha de planificación o dirección.
5. La lógica de ocupación se calcula a partir de tiempos y asignaciones reales o explícitamente marcados como ejemplos.
