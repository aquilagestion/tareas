# GREFA Tareas

Sistema multiplataforma (Web + APK Android) sincronizado en tiempo real con Firebase para gestión, asignación, ejecución, revisión y liquidación de tareas/gastos de personal y voluntarios de **GREFA** (Majadahonda).

## Estructura

```text
grefa-tareas/
├── apps/web          # Next.js (App Router) — Administradores
├── apps/mobile       # Expo — Trabajadores / Voluntarios (APK)
├── packages/shared   # Tipos, validación DNI, textos legales
├── packages/firebase # Init Auth + Firestore
├── functions         # Cloud Functions (reminder 8:00 AM)
└── firebase/         # firestore.rules + indexes
```

## Requisitos

- Node.js ≥ 20
- Cuenta Firebase
- Cuenta Expo (para EAS Build / APK)

## Arranque rápido

```bash
cd C:\grefa-tareas
npm install
npm run seed:users   # (ya ejecutado) recrea usuarios demo si hace falta
npm run dev:web      # Admin → http://localhost:3000
npm run dev:mobile   # Expo APK/campo
```

Proyecto Firebase: **grefa-tareas** (ya creado y configurado).  
Detalle de lo pendiente: [`docs/TU-CHECKLIST.md`](docs/TU-CHECKLIST.md)  
Credenciales demo: `secrets/CREDENCIALES-DEMO.txt`

## Generar APK Android (local)

```bash
cd C:\grefa-tareas
npm run build:apk
# o: build-apk.bat
```

Copia automática en `releases/GREFA_TAREAS_<version>.apk` (sin EAS cloud).

## Firebase

1. Proyecto ya creado: **grefa-tareas** (Auth + Firestore + rules desplegados).
2. Credenciales demo: `secrets/CREDENCIALES-DEMO.txt`
3. Tu checklist: [`docs/TU-CHECKLIST.md`](docs/TU-CHECKLIST.md)


## Roles

| Rol | App | Capacidades |
|-----|-----|-------------|
| `ADMIN` | Web | Personal, asignar tareas, revisar, auditoría |
| `WORKER` | Móvil / Web | Ver tareas, chequear, comentarios |

`userType`: `TRABAJADOR_GREFA` (badge azul) | `VOLUNTARIO` (badge verde)

## Flujo de estados

`PENDING` → (chequeo en campo) → `IN_REVIEW` → (admin) → `COMPLETED`  
El admin puede devolver `IN_REVIEW` → `PENDING`.
