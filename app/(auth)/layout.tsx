export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      {children}
    </main>
  );
}
