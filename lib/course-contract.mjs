const slug=/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const key=/^[a-z][a-z0-9_-]{1,63}$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
    for(const k of Object.keys(lesson))if(!["id","title","summary","type","estimatedMinutes","videoAssetId","resourceAssetIds","questions","body"].includes(k))fail(p+"."+k,"unknown field");
    if(typeof lesson.id!=="string"||!key.test(lesson.id))fail(p+".id","invalid");else if(lessonIds.has(lesson.id))fail(p+".id","duplicate across course");
    lessonIds.add(lesson.id);
    if(!text(lesson.title,100))fail(p+".title","required");
    if(!text(lesson.summary,500))fail(p+".summary","required");
    if(!["video","article","quiz"].includes(lesson.type))fail(p+".type","invalid");
    if(!Number.isInteger(lesson.estimatedMinutes)||lesson.estimatedMinutes<1||lesson.estimatedMinutes>90)fail(p+".estimatedMinutes","must be 1-90");
    if(lesson.videoAssetId!==undefined&&(typeof lesson.videoAssetId!=="string"||!uuid.test(lesson.videoAssetId)||lesson.type!=="video"))fail(p+".videoAssetId","invalid asset ID or lesson type");
    if(course.status==="published"&&lesson.type==="video"&&!lesson.videoAssetId)fail(p+".videoAssetId","registered asset required to publish");
    if(lesson.body!==undefined&&(lesson.type!=="article"||typeof lesson.body!=="string"||lesson.body.length>20000))fail(p+".body","only article lessons support 20k characters of text");
    if(lesson.type==="quiz"&&(!Array.isArray(lesson.questions)||!lesson.questions.length))fail(p+".questions","quiz requires questions");
    if(lesson.type==="quiz"&&Array.isArray(lesson.questions)){
     const questionIds=new Set();
     lesson.questions.forEach((question,k)=>{
      const qp=p+".questions["+k+"]";
      if(!object(question)){fail(qp,"expected object");return}
      for(const attr of Object.keys(question))if(!["id","prompt","choices","correctIndex","explanation","sortOrder"].includes(attr))fail(qp+"."+attr,"unknown field");
      if(typeof question.id!=="string"||!key.test(question.id))fail(qp+".id","invalid");
      else if(questionIds.has(question.id))fail(qp+".id","duplicate");
      questionIds.add(question.id);
      if(!text(question.prompt,800))fail(qp+".prompt","required");
      if(!Array.isArray(question.choices)||question.choices.length<2||question.choices.length>6||!question.choices.every(x=>text(x,200)))fail(qp+".choices","must contain 2-6 answers");
      if(!Number.isInteger(question.correctIndex)||question.correctIndex<0||question.correctIndex>=(Array.isArray(question.choices)?question.choices.length:0))fail(qp+".correctIndex","invalid");
      if(question.explanation!==undefined&&(typeof question.explanation!=="string"||question.explanation.length>1000))fail(qp+".explanation","invalid");
      if(question.sortOrder!==undefined&&(!Number.isInteger(question.sortOrder)||question.sortOrder<0))fail(qp+".sortOrder","invalid");
     });
    }
    if(lesson.questions!==undefined&&lesson.type!=="quiz")fail(p+".questions","only quizzes have questions");
   });
  });
 }
 return{ok:errors.length===0,errors};
}
