import type { ReactNode } from 'react';

// A route group has no path of its own, so the generated LayoutProps<'/route'>
// helper does not apply here.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="container-page flex min-h-[70vh] items-center justify-center py-10">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
