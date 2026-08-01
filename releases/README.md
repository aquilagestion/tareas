# APK locales — GREFA Tareas

Tras compilar con `scripts/build-apk-local.ps1`, la APK queda aquí como `GREFA_TAREAS_x.apk`.

## Distribución

1. Compila: `npm run build:apk`
2. El archivo queda en esta carpeta (`releases/`)
3. **Distribúyela manualmente** (Drive, WhatsApp, etc.) a cada usuario

La **web** se actualiza sola al desplegar hosting (`firebase deploy --only hosting`).  
La APK **no** se actualiza automáticamente: tú envías la nueva versión cuando corresponda.
