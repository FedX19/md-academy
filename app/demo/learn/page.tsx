import {Suspense} from "react";import {PreviewLesson} from "@/components/preview-lesson";
export default function Learn(){return <Suspense fallback={<p>Loading lesson...</p>}><PreviewLesson/></Suspense>;}
