# TROUBLESHOOTING GUIDE
## SIH26238 Rijvan Module

---

## 1. Database & Migration Issues
- **Issue**: Database schema out of sync or `PrismaClientInitializationError`.
- **Fix**: Run `npm run prisma:generate && npm run prisma:migrate && npm run db:seed`.

## 2. Port Already in Use (Port 3000)
- **Issue**: Next.js reports port 3000 is occupied.
- **Fix**: Run `PORT=3001 npm run dev` or terminate the process on port 3000.

## 3. Re-running Tests Cleanly
- **Issue**: Tests fail due to cached Prisma client.
- **Fix**: Run `npm run prisma:generate && npm test`.
