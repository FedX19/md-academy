import Image from "next/image";
export default function SignIn(){return <main className="entrance"><div className="entry"><Image src="/brand/md-academy.svg" alt="MD Academy" width={260} height={260} /><h1>ENTER <em>MD ACADEMY</em></h1><p className="lead">One account. One coaching system.</p><a className="button" href="/api/auth/start">Continue with UniteHQ</a></div></main>}
