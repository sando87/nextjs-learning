import Link from "next/link";
import { logout } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/blog", label: "Blog" },
  { href: "/schedule", label: "Schedule" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
      <nav className="mx-auto flex max-w-3xl items-center justify-between gap-6 px-6 py-4">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            nextjs-learning
          </span>
          <ul className="flex gap-4 text-sm font-medium">
            {navLinks.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="text-zinc-600 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
                >
                  {label}
                </Link>
              </li>
            ))}
            {user ? (
              <li>
                <Link
                  href="/profile"
                  className="text-zinc-600 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
                >
                  Profile
                </Link>
              </li>
            ) : null}
          </ul>
        </div>

        <div className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              <span className="hidden text-zinc-600 sm:inline dark:text-zinc-400">
                {user.email}
              </span>
              <form action={logout}>
                <button
                  type="submit"
                  className="font-medium text-zinc-600 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
                >
                  Logout
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="font-medium text-zinc-600 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                Login
              </Link>
              <Link
                href="/signup"
                className="font-medium text-zinc-600 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                Signup
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
