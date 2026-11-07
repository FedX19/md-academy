const slug=/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const key=/^[a-z][a-z0-9_-]{1,63}$/;
const object=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const text=(x,n)=>typeof x==="string"&&x.trim().length>0&&x.length<=n;
export function validateCourse(course){
 const errors=[];const fail=(path,message)=>errors.push(path+": "+message);
 if(!object(course))return{ok:false,errors:["course: expected object"]};
 const allowed=["schemaVersion","slug","title","summary","status","audience","modules","tags","coverAssetId"];
 for(const k of Object.keys(course))if(!allowed.includes(k))fail(k,"unknown field");
 if(course.schemaVersion!==1)fail("schemaVersion","must be 1");
 if(typeof course.slug!=="string"||!slug.test(course.slug)||course.slug.length>72)fail("slug","invalid URL slug");
 if(!text(course.title,100))fail("title","required");
 if(!text(course.summary,320))fail("summary","required");
 if(!["draft","review","published"].includes(course.status))fail("status","invalid");
 if(!["mdc-coach","league-coach","parent","public"].includes(course.audience))fail("audience","invalid");
 if(!Array.isArray(course.modules)||course.modules.length<1||course.modules.length>30)fail("modules","expected 1-30 modules");
 else{
  const moduleIds=new Set(),lessonIds=new Set();
  course.modules.forEach((module,i)=>{
   const path="modules["+i+"]";
   if(!object(module)){fail(path,"expected object");return}
   for(const k of Object.keys(module))if(!["id","title","lessons"].includes(k))fail(path+"."+k,"unknown field");
   if(typeof module.id!=="string"||!key.test(module.id))fail(path+".id","invalid");else if(moduleIds.has(module.id))fail(path+".id","duplicate");
   moduleIds.add(module.id);
   if(!text(module.title,100))fail(path+".title","required");
   if(!Array.isArray(module.lessons)||module.lessons.length<1||module.lessons.length>40){fail(path+".lessons","expected 1-40 lessons");return}
   module.lessons.forEach((lesson,j)=>{
    const p=path+".lessons["+j+"]";
    if(!object(lesson)){fail(p,"expected object");return}
    for(const k of Object.keys(lesson))if(!["id","title","summary","type","estimatedMinutes","videoAssetId","resourceAssetIds","questions"].includes(k))fail(p+"."+k,"unknown field");
    if(typeof lesson.id!=="string"||!key.test(lesson.id))fail(p+".id","invalid");else if(lessonIds.has(lesson.id))fail(p+".id","duplicate across course");
    lessonIds.add(lesson.id);
    if(!text(lesson.title,100))fail(p+".title","required");
    if(!text(lesson.summary,500))fail(p+".summary","required");
    if(!["video","article","quiz"].includes(lesson.type))fail(p+".type","invalid");
    if(!Number.isInteger(lesson.estimatedMinutes)||lesson.estimatedMinutes<1||lesson.estimatedMinutes>90)fail(p+".estimatedMinutes","must be 1-90");
    if(lesson.videoAssetId!==undefined&&(typeof lesson.videoAssetId!=="string"||!key.test(lesson.videoAssetId)||lesson.type!=="video"))fail(p+".videoAssetId","invalid asset ID or lesson type");
    if(course.status==="published"&&lesson.type==="video"&&!lesson.videoAssetId)fail(p+".videoAssetId","registered asset required to publish");
    if(lesson.type==="quiz"&&(!Array.isArray(lesson.questions)||!lesson.questions.length))fail(p+".questions","quiz requires questions");
    if(lesson.questions!==undefined&&lesson.type!=="quiz")fail(p+".questions","only quizzes have questions");
   });
  });
 }
 return{ok:errors.length===0,errors};
}
