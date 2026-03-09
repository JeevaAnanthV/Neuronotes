// Prevent static prerendering — auth page requires runtime env vars
export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
