import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";
import { login } from "@/app/auth/actions";

export const metadata: Metadata = {
  title: "Login | nextjs-learning",
  description: "로그인 페이지",
};

export default function LoginPage() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Login
        </h1>
        <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          이메일과 비밀번호로 로그인하세요.
        </p>
        <AuthForm
          action={login}
          submitLabel="로그인"
          footerText="계정이 없으신가요?"
          footerHref="/signup"
          footerLinkLabel="회원가입"
        />
      </main>
    </div>
  );
}
