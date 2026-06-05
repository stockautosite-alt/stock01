# StockAuto Auth Testing Playbook

## Credentials (see /app/memory/test_credentials.md)
- Admin: admin@stockauto.com / Admin@123
- Dealer (active): contato@autocentersilva.com / Dealer@123

## Endpoints
- POST /api/auth/register  body: {email, password, store_name, phone, whatsapp, city, uf, plan_code}
- POST /api/auth/login  body: {email, password}
- POST /api/auth/logout
- GET  /api/auth/me

## Cookies
Cookies are set httpOnly on login/register: `access_token` (15 min), `refresh_token` (7 days).

## Test (curl)
```
curl -c c.txt -X POST $API/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@stockauto.com","password":"Admin@123"}'
curl -b c.txt $API/api/auth/me
```
