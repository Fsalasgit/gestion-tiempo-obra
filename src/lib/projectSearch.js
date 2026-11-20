// Búsqueda tolerante a acentos y mayúsculas, por número, nombre o cliente.
export const normalizeProjectText = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-AR').trim();
export function searchProjects(projects, query, limit = 15) {
  const words = normalizeProjectText(query).split(/\s+/).filter(Boolean);
  if (!words.length) return (projects || []).slice(0,limit);
  return (projects || []).filter(project => {
    const haystack = normalizeProjectText([project.numero,project.proyecto,project.cliente,project.id].join(' '));
    return words.every(word=>haystack.includes(word));
  }).slice(0,limit);
}
