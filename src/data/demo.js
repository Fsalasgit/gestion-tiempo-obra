import {toISO, addMonths} from '../lib/schedule.js';
const dateIn=(m,d)=>toISO(new Date(m.getFullYear(),m.getMonth(),d));
const next=(m,d)=>dateIn(addMonths(m,1),d);
export function createDemoData(today=new Date()) {
  const m=new Date(today.getFullYear(),today.getMonth(),1);
  const projects=[
    {id:'PR-260741',name:'Edificio Jacarandá',state:'Ejecución',inicio:dateIn(m,4),inicioP:dateIn(m,3),grupo:'Con Premarcos',locality:'San Miguel de Tucumán'},
    {id:'PR-260753',name:'Complejo Las Moras',state:'Planificación',inicio:'',inicioP:dateIn(m,11),grupo:'Sin Medición',locality:'Yerba Buena'},
    {id:'PR-260762',name:'Torre 9 de Julio',state:'Aprobado',inicio:dateIn(m,17),inicioP:dateIn(m,10),grupo:'Con Premarcos',locality:'San Miguel de Tucumán'},
    {id:'PR-260770',name:'Residencias Norte',state:'Ejecución',inicio:dateIn(m,22),inicioP:dateIn(m,18),grupo:'Retiro en Abalum',locality:'Tafí Viejo'},
    {id:'PR-260783',name:'Locales Plaza Central',state:'Técnica',inicio:'',inicioP:dateIn(m,26),grupo:'Sin Medición',locality:'Banda del Río Salí'},
    {id:'PR-260791',name:'Paseo del Bicentenario',state:'Solicitado',inicio:'',inicioP:next(m,6),grupo:'Con Premarcos',locality:'Yerba Buena'},
    {id:'PR-260795',name:'Condominio Los Ceibos',state:'Aprobado',inicio:next(m,9),inicioP:next(m,3),grupo:'Con Premarcos',locality:'San Pablo'},
    {id:'PR-260801',name:'Oficinas Av. Mate de Luna',state:'Aprobado',inicio:'',inicioP:next(m,17),grupo:'Retiro en Abalum',locality:'San Miguel de Tucumán'}
  ];
  const teams=[{id:'t1',name:'Equipo 01',subtitle:'Colocación · Norte',color:'#4e8cdb'},{id:'t2',name:'Equipo 02',subtitle:'Colocación · Centro',color:'#22a48b'},{id:'t3',name:'Equipo 03',subtitle:'Colocación · Sur',color:'#9d7bd8'}];
  const employees=[
    {id:'e1',name:'Martín Ruiz',teamId:'t1',role:'Jefe de equipo',activeFrom:'',activeUntil:'',temporary:false},
    {id:'e2',name:'Julián Arias',teamId:'t1',role:'Colocador',activeFrom:'',activeUntil:'',temporary:false},
    {id:'e3',name:'Lucas Torres',teamId:'t1',role:'Colocador',activeFrom:'',activeUntil:'',temporary:false},
    {id:'e4',name:'Diego Pérez',teamId:'t1',role:'Ayudante',activeFrom:'',activeUntil:'',temporary:false},
    {id:'e5',name:'Gonzalo Díaz',teamId:'t2',role:'Jefe de equipo',activeFrom:'',activeUntil:'',temporary:false},
    {id:'e6',name:'Tomás Herrera',teamId:'t2',role:'Colocador',activeFrom:'',activeUntil:'',temporary:false},
    {id:'e7',name:'Bruno López',teamId:'t2',role:'Ayudante',activeFrom:'',activeUntil:'',temporary:false},
    {id:'e8',name:'Matías Gómez',teamId:'t3',role:'Jefe de equipo',activeFrom:'',activeUntil:'',temporary:false},
    {id:'e9',name:'Nicolás Vega',teamId:'t3',role:'Colocador',activeFrom:'',activeUntil:'',temporary:false},
    {id:'e10',name:'Federico Cruz',teamId:'t2',role:'Refuerzo temporal',activeFrom:dateIn(m,18),activeUntil:dateIn(m,30),temporary:true},
  ];
  const absences=[{id:'b1',employeeId:'e3',start:dateIn(m,17),end:dateIn(m,24),type:'Accidente',note:'Baja temporal demostrativa'}];
  const assignments=[
    {id:'a1',projectId:'PR-260741',teamId:'t1',start:dateIn(m,2),end:dateIn(m,14),people:3,hoursPerDay:8,outsourced:false,note:'Frente 1 — aventanamientos',status:'En curso'},
    {id:'a2',projectId:'PR-260762',teamId:'t1',start:dateIn(m,12),end:dateIn(m,25),people:3,hoursPerDay:8,outsourced:false,note:'Acceso y hall principal',status:'Planificado'},
    {id:'a3',projectId:'PR-260753',teamId:'t2',start:dateIn(m,9),end:dateIn(m,20),people:3,hoursPerDay:8,outsourced:false,note:'Colocación etapa A',status:'En curso'},
    {id:'a4',projectId:'PR-260770',teamId:'t2',start:dateIn(m,18),end:next(m,5),people:2,hoursPerDay:8,outsourced:false,note:'Etapa de cerramientos',status:'Planificado'},
    {id:'a5',projectId:'PR-260783',teamId:'t3',start:dateIn(m,4),end:dateIn(m,24),people:2,hoursPerDay:8,outsourced:false,note:'Frente 2',status:'En curso'},
    {id:'a6',projectId:'PR-260791',teamId:null,start:dateIn(m,18),end:dateIn(m,28),people:3,hoursPerDay:8,outsourced:true,note:'Contratista externo',status:'Planificado'},
    {id:'a7',projectId:'PR-260795',teamId:'t1',start:next(m,3),end:next(m,18),people:4,hoursPerDay:8,outsourced:false,note:'Inicio sujeto a obra',status:'Planificado'},
    {id:'a8',projectId:'PR-260801',teamId:'t3',start:next(m,14),end:next(m,25),people:2,hoursPerDay:8,outsourced:false,note:'Segunda etapa',status:'Planificado'}
  ];
  return {projects,teams,employees,absences,assignments};
}
