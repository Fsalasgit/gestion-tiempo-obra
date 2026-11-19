const basePlans=[
  {projectId:'DEMO-001',value:80,unit:'horas',start:'2026-11-02',teamId:'T1',crew:2},
  {projectId:'DEMO-002',value:90,unit:'horas',start:'2026-11-04',teamId:'T1',crew:2},
  {projectId:'DEMO-003',value:85,unit:'horas',start:'2026-11-05',teamId:'T1',crew:2},
  {projectId:'DEMO-004',value:60,unit:'horas',start:'2026-11-09',teamId:'T2',crew:2},
  {projectId:'DEMO-005',value:65,unit:'horas',start:'2026-11-11',teamId:'T2',crew:2},
  {projectId:'DEMO-006',value:75,unit:'horas',start:'2026-11-16',teamId:'T2',crew:2}
];
export const EXAMPLE_ESTIMATES=basePlans.map(a=>({projectId:a.projectId,value:a.value,unit:'horas',crewReference:2,outsourced:false,notes:'VALORES DE EJEMPLO. Reemplazar por tiempo real de colocación.',address:'',example:true}));
export const DEMO_SEED_ASSIGNMENTS=basePlans.map((a,i)=>({id:'demo-'+(i+1),projectId:a.projectId,teamId:a.teamId,start:a.start,crew:a.crew}));
