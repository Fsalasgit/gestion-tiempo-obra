const basePlans=[
  {projectId:'PR-261024',value:80,unit:'horas',start:'2026-11-02',teamId:'T1',crew:2},
  {projectId:'PR-261029',value:90,unit:'horas',start:'2026-11-04',teamId:'T1',crew:2},
  {projectId:'PR-261030',value:85,unit:'horas',start:'2026-11-05',teamId:'T1',crew:2},
  {projectId:'PR-261037',value:60,unit:'horas',start:'2026-11-09',teamId:'T2',crew:2},
  {projectId:'PR-261027',value:65,unit:'horas',start:'2026-11-11',teamId:'T2',crew:2},
  {projectId:'PR-261040',value:75,unit:'horas',start:'2026-11-16',teamId:'T2',crew:2}
];
export const EXAMPLE_ESTIMATES=basePlans.map(a=>({projectId:a.projectId,value:a.value,unit:'horas',crewReference:2,outsourced:false,notes:'VALORES DE EJEMPLO. Reemplazar por tiempo real de colocación.',address:'',example:true}));
export const DEMO_SEED_ASSIGNMENTS=basePlans.map((a,i)=>({id:'demo-'+(i+1),projectId:a.projectId,teamId:a.teamId,start:a.start,crew:a.crew}));
