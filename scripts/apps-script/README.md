# Script de correo (Google Apps Script)

`grefa-task-emails.gs` es la copia de trabajo del proyecto que envía los avisos de
tareas y el cuadrante semanal. El proyecto **está incrustado en una hoja de
cálculo**, así que no aparece en `clasp list-scripts` ni en Drive como archivo de
script: hay que usar su identificador directamente.

| Dato | Valor |
| --- | --- |
| Script ID | `12R--MtpnNCV5cRkJO5b8aWhzGigsvT-bHuhSefzSDGNQPqusjfDmS2cq` |
| Editor | https://script.google.com/u/0/home/projects/12R--MtpnNCV5cRkJO5b8aWhzGigsvT-bHuhSefzSDGNQPqusjfDmS2cq/edit |
| Hoja contenedora | `1l-rYv-0Gc--zC8qHGll_B-9lOPcnFnn8VjQkLpv5mTw` (hoja «TAREAS») |
| Despliegue que usan la web y la APK | `AKfycbzUDKoSuJXYQyw_XDx0y8FiWNyvbd4OA-IYZu5HUf2DJHGuatNVEQeMqMpg7vsuMOo3fw` |
| Cuenta propietaria | aquilagestion@grefa.org |
| Archivo remoto | `Código.js` (un solo archivo de código) |

La URL `/exec` de ese despliegue es la que está en
`apps/mobile/constants/notifications.ts` y en la configuración de la web.

## Antes de publicar: la clave

La copia del repositorio **no lleva la clave escrita** (`DEFAULT_SECRET` está
vacío), porque con ella y la URL cualquiera podría enviar correos por este
endpoint. La clave real tiene que estar en la propiedad `NOTIFY_SECRET` del
script: en el editor, ⚙ *Configuración del proyecto* → *Propiedades del script*.

Compruébalo antes de publicar desde aquí. Si esa propiedad no estuviera puesta,
el endpoint rechazaría todas las peticiones y dejarían de salir los avisos. Debe
coincidir con `EXPO_PUBLIC_NOTIFY_SECRET` de `apps/mobile/.env` y con
`notifySecret` de `apps/web/static-hosting/js/notifications-config.js` (ninguno
de los dos se sube a git).

## Publicar un cambio

El despliegue ya tiene concedidos los permisos de Gmail y Hojas de cálculo, así
que **hay que actualizar ese mismo despliegue**: si se crea uno nuevo cambia la
URL y hace falta volver a autorizar a mano desde el editor.

```powershell
$dir = "$env:TEMP\grefa-apps-script"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
Set-Content "$dir\.clasp.json" '{"scriptId":"12R--MtpnNCV5cRkJO5b8aWhzGigsvT-bHuhSefzSDGNQPqusjfDmS2cq","rootDir":"."}'

cd $dir
npx clasp pull                       # baja lo que hay publicado, para comparar
Copy-Item C:\grefa-tareas\scripts\apps-script\grefa-task-emails.gs "$dir\Código.js" -Force
npx clasp push --force
npx clasp create-version "Descripción del cambio"
npx clasp redeploy AKfycbzUDKoSuJXYQyw_XDx0y8FiWNyvbd4OA-IYZu5HUf2DJHGuatNVEQeMqMpg7vsuMOo3fw -V <nº de versión>
```

Antes de sobreescribir `Código.js` conviene comparar lo descargado con la copia
del repositorio: si alguien editó el código en el editor de Google, esos cambios
solo están en la versión publicada.

Requiere `clasp` autenticado con la cuenta propietaria (`npx clasp login`).

## Comprobar que quedó bien

```powershell
node scripts/test-roster-email.mjs aquilagestion@grefa.org <clave>
```

Manda un cuadrante de ejemplo a ese correo. Si el script publicado fuera antiguo,
la respuesta sería `{"ok":false,"error":"Sin notificaciones"}` en lugar de
`{"ok":true,"sent":1}`.
