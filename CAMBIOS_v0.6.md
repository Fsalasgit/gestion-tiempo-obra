# Cambios ObraTiempo v0.6 — 19/11/2026

## Objetivo UX

1. Sincronización de catálogo/estimaciones con Apps Script en segundo plano y sin pantalla bloqueante. Último estado confirmado disponible en caché; el token y perfil mínimo permiten recuperar la navegación sin volver a ingresar credenciales. Los guardados remotos siguen esperando confirmación del backend antes de considerarse finalizados.
2. Cubito editable mediante modal, en teléfono o escritorio; arrastrar abre la propuesta de movimiento. Mover fecha, reasignar equipo o devolver al backlog exige motivo y guarda un evento en `reprogramHistory`.
3. Colores RGBA por equipo desde modal con paleta, selector y transparencia.
4. Operarios por cubito, predeterminados desde la disponibilidad del equipo, posibilidad de liberarlos, reservarles menos horas y sumar auxiliares de Producción para una fecha puntual.
5. Horas de cada cubito, % cobertura hasta 100%, horas-persona sin cobertura, porcentaje de esfuerzo estimado de obra consumido.
6. Ocupación >100% de cada equipo por día y por mes; recuento de cubitos y reprogramaciones con tabla por proyecto.

## Fórmulas del prototipo

- Horas-persona del cubito: `personHours`.
- Capacidad nominal de un operario en un día: la jornada pura configurada (6h lun-jue, 5h viernes, sin feriados ni recesos).
- Horas cubiertas de cubito: suma de horas asignables a sus operarios, repartidas sin duplicar la jornada que ya aportaron a otro cubito de ese mismo día. Se respeta un máximo de horas configurado por operario.
- Cobertura: `min(100,100*horas cubiertas / horas-persona del cubito)`.
- Horas sin cubrir: `max(0,horas-persona del cubito − horas cubiertas)`.
- Ocupación de equipo: `100*sumatoria(horas comprometidas en cubitos)/sumatoria(capacidad de operarios del equipo)` (sin capar en 100%).
- Reprogramaciones: cantidad de eventos `reprogramHistory`, no cantidad de cubitos que alguna vez cambiaron.

## Límites deliberados

- Se calcula a nivel día, no franjas horarias ni traslados.
- La productividad real y avance físico no se infieren de la cobertura de personal.
- El historial de reprogramaciones no es un registro inmutable: por ahora solo vive en el navegador.
- No se modifica hoja `proyecto` ni el Apps Script v0.5; la planificación sigue pendiente de persistencia online.
- Si se limpian los datos del navegador se pierde el escenario local; el usuario debe guardar sus datos fuera del prototipo antes de usarlo operativamente.

## Test manual recomendado

- Abrir v0.5 en el mismo navegador, actualizar a v0.6 y verificar que conservó cubitos/equipos, sin marcar antiguos como hechos.
- Crear equipo con color, asignar obra y verificar color en el Gantt.
- Entrar al cubito, liberar un operario: comprobar cobertura y horas sin cubrir. Asignar un auxiliar para ese día y verificar aumento.
- Reprogramar por lluvia y luego volver del backlog: contar dos reprogramaciones con sus motivos.
- Hacer dos cubitos con los mismos operarios en un mismo día: la capacidad de cada operario no debe duplicarse; la ocupación de equipo puede superar 100%.
- Verificar ocupación de cada equipo al tocar una fecha y la mensual al cambiar de mes.
- En Vercel, iniciar sesión; cambiar de sección mientras el estado indica «Sincronizando», sin overlay. Cerrar sesión y verificar revocación.
