import { WEEK } from './domain.js';
import PROJECTS from '../data/demo-projects.json';
import { EXAMPLE_ESTIMATES } from '../data/scenario.js';

// El bundle incluye únicamente proyectos ficticios. Los proyectos reales llegan autenticados del backend.
export const DEMO_PROJECTS=PROJECTS;
export const DEMO_DATA={
  projects:DEMO_PROJECTS,
  estimates:EXAMPLE_ESTIMATES,
  week:WEEK,holidays:[],recesses:[],events:[],
  users:[{username:'admin',name:'Super administrador (demo)',role:'SUPERADMIN',active:true}],
  teamSize:3, sourceFile:'Ejemplo ficticio (sin Excel privado)'
};
// Sin archivo .env, arranca la vista previa. Para activar el backend usar false.
export const isDemo=import.meta.env.VITE_DEMO_MODE!=='false';
export function readDemo(){
  try {const saved=JSON.parse(localStorage.getItem('obras-tiempo-demo-v3'));
    return saved?{...structuredClone(DEMO_DATA),...saved}:structuredClone(DEMO_DATA);
  }catch{return structuredClone(DEMO_DATA);}
}
export const saveDemo=data=>localStorage.setItem('obras-tiempo-demo-v3',JSON.stringify(data));
