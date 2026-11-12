import type { Metadata,Viewport } from "next";
import "./globals.css";
export const metadata: Metadata={title:"MD Academy | Modern Day Coach",description:"Modern player development education for MDC coaches and parents.",robots:{index:false,follow:false},icons:{icon:"/brand/md-academy.svg"}};
export const viewport: Viewport={themeColor:"#08090b"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
