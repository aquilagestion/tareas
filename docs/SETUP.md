# GREFA Tareas — monorepo

## Qué hay listo

- Estructura monorepo (`apps/web`, `apps/mobile`, `packages/*`, `functions`)
- Tipos + validación DNI + textos legales (`@grefa/shared`)
- Init Firebase + listeners `onSnapshot` (`@grefa/firebase`)
- Reglas Firestore + índices
- Web admin: home, login, personal, tareas (multi-select), revisión, auditoría
- Móvil: login, lista en tiempo real, modal chequeo cruzado → `taskLogs`
- Cloud Function programada 08:00 Madrid (FCM)

## Siguiente paso

1. `npm install` en la raíz
2. Crear proyecto Firebase y pegar claves en `.env`
3. `firebase deploy --only firestore:rules,firestore:indexes`
4. `npm run dev:web` / `npm run dev:mobile`
5. `npm run build:apk` (EAS)
