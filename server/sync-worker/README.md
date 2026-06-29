# sync-worker

가상서버용 sync-worker + validate-proxy (Plan 4).

## 구성

- `worker.js` — Supabase sync_jobs 큐 polling, 5초마다 한 잡 picking, 어댑터 라우팅
- `validate-server.js` — HTTP 서버 (기본 포트 3003), 스마트스토어/네이버광고 validate를 가상서버 IP로 대행
- `lib/supabase.js` — service_role 클라이언트
- `lib/adapters.js` — Plan 4 시점 stub (sync 메서드 미구현). Plan 5/6/7에서 매체별 추가
- `lib/job-type-routing.js` — job_type → adapter method 매핑

## 배포 (가상서버 `/root/sync-worker/`)

1. 로컬에서 rsync (또는 git push):
   ```
   rsync -av --exclude='.env' --exclude='node_modules' --exclude='*.log' \
     server/sync-worker/ root@203.245.41.105:/root/sync-worker/
   ```
2. 가상서버 SSH:
   ```
   cd /root/sync-worker
   npm install --omit=dev
   cp .env.example .env   # 첫 배포 시만
   nano .env              # SERVICE_ROLE_KEY, VALIDATE_PROXY_TOKEN 채움
   chmod 600 .env
   ```
3. PM2 등록:
   ```
   pm2 start ecosystem.config.js
   pm2 save
   ```
4. 로그 확인:
   ```
   pm2 logs sync-worker
   pm2 logs validate-proxy
   ```

## Cloudflare Tunnel 라우트

`~/.cloudflared/config.yml`의 ingress에 추가:

```yaml
ingress:
  - hostname: <tunnel-host>
    path: /validate/.*
    service: http://localhost:3003
  # 기존 라우트들 ...
```

`sudo systemctl restart cloudflared`.

## 검증

```bash
# validate-proxy 동작 확인 (TOKEN 일치 시)
curl -X POST https://<tunnel-host>/validate/naver_ad \
  -H "X-Proxy-Token: <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"customerId":"...","accessLicense":"...","secretKey":"..."}'

# 401 확인 (TOKEN 누락)
curl -X POST https://<tunnel-host>/validate/naver_ad -d '{}'
```
