import type { Metadata } from "next";
import { AdminStudio } from "@/components/admin/admin-studio";
import "./admin.css";

export const metadata: Metadata = {
 title:"Academy Admin Studio | Modern Day Coach",
 description:"Build and assign Modern Day Coach curriculum.",
 robots:{index:false,follow:false},
};
export default function AcademyAdminPage(){ return <AdminStudio/>; }
