# Order Manager SaaS

멀티브랜드 쇼핑몰 + 광고 통합 관리 SaaS.

## 스택

- Next.js 16 (App Router, Turbopack) + TypeScript
- Supabase (Postgres + Auth + Vault + pg_cron)
- Tailwind CSS v4 + shadcn/ui
- Vercel

## 디자인 문서

`docs/superpowers/specs/2026-06-29-order-manager-saas-design.md` (기존 `order-manager` 레포)

## 시작

```bash
npm install
cp .env.example .env.local   # 값 채워넣기
npm run dev                  # http://localhost:3030
```

## 배포

- **Production**: https://order-manager-saas-bay.vercel.app
- **Supabase**: 기존 `order-manager` 프로젝트 재사용 (멀티테넌트 RLS 적용)
- **GitHub Actions**: 미설정 (Vercel auto-deploy)
