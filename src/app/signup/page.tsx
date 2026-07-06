import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";
import { signup } from "@/app/auth/actions";

export const metadata: Metadata = {
  title: "Signup | nextjs-learning",
  description: "회원가입 페이지",
};

export default function SignupPage() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Signup
        </h1>
        <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          새 계정을 만들어 로그인하세요.
        </p>
        <AuthForm
          action={signup}
          submitLabel="회원가입"
          footerText="이미 계정이 있으신가요?"
          footerHref="/login"
          footerLinkLabel="로그인"
        />
      </main>
    </div>
  );
}
