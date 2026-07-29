# Lo que YA está hecho (proyecto Firebase `grefa-tareas`)

- [x] Proyecto Firebase creado: **grefa-tareas**
- [x] Apps Web + Android registradas (`org.grefa.tareas`)
- [x] Cloud Firestore (europe-west1) + reglas + índices desplegados
- [x] Authentication Email/Password habilitado
- [x] Service account + seed de usuarios demo
- [x] `.env.local` (web) y `.env` (móvil) con la config real
- [x] `apps/mobile/google-services.json`
- [x] Build APK **local** → copia en `releases/`

## Tus tareas

### 1. Cambiar contraseñas demo (antes de uso real)

Consola: https://console.firebase.google.com/project/grefa-tareas/authentication/users

| Email | Acción |
|-------|--------|
| `admin@grefa.org` | Nueva contraseña segura |
| `trabajador@grefa.org` | Idem |
| `voluntario@grefa.org` | Idem |

Actualiza o borra `secrets/CREDENCIALES-DEMO.txt`.

### 2. Plan Blaze (solo si quieres el aviso 8:00 AM)

**No hace falta** para web, móvil, sync ni APK local.

Sí para Cloud Function programada + Scheduler/FCM diario:

1. https://console.firebase.google.com/project/grefa-tareas/usage/details  
2. Actualizar a **Blaze** (pago por uso)  
3. Avisa → se despliega `functions`

### 3. Generar APK (local, sin nube)

Requisito: Android SDK / JDK (como en gestiflota).

```powershell
cd C:\grefa-tareas
npm run build:apk
```

O doble clic / consola: `build-apk.bat`

La APK queda en:

```text
C:\grefa-tareas\releases\GREFA_TAREAS_0.1.0.apk
```

(`last_apk_path.txt` guarda la última ruta generada.)
