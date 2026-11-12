import type { Metadata } from "next";
import { SchoolClient } from "@/components/school-client";

export const metadata: Metadata = {
  title: "Learner Review | MD Academy",
  robots: { index: false, follow: false },
};
export default async function AcademyCoachPreview({ searchParams }: {
  searchParams: Promise<{ courseId?: string; lessonId?: string; open?: string }>
}) {
  const params = await searchParams;
  return <SchoolClient previewCourseId={params.courseId ?? ""}
    previewLessonId={params.lessonId}
    previewOpenCourse={params.open==="course"}/>;
}
