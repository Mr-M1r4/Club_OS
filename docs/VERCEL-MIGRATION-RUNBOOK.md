# ClubOS — Runbook de migración segura a Vercel

**Estado:** preparación; no ejecutar el corte a producción hasta completar todos los controles de este documento.  
**Repositorio:** `Mr-M1r4/Club_OS` · rama de preparación: `chore/vercel-migration-readiness`  
**Producción actual:** `https://mr-m1r4.github.io/Club_OS/`  
**Backend:** Supabase existente (no crear ni migrar otro proyecto).

## Objetivo y límites

Migrar el hosting de GitHub Pages a Vercel y después convertir el repositorio GitHub en privado, conservando la aplicación, sus datos, Auth, RLS, Storage, Edge Functions y flujos actuales.

No hacer en esta fase:
- Cambiar visibilidad del repositorio.
- Desactivar GitHub Pages ni borrar su workflow.
- Cambiar el proyecto Supabase, sus tablas, datos, políticas o buckets.
- Ejecutar migraciones de base de datos como parte del cambio de hosting.
- Copiar secretos de Supabase al navegador ni publicar `service_role`.
- Reutilizar el proyecto Vercel `talentbase`.

## Diagnóstico confirmado

- Aplicación Next.js con `output: 'export'`; el build genera `out/`.
- El `basePath` actual es `/Club_OS` en producción para GitHub Pages. En el dominio raíz de Vercel debe ser vacío.
- El workflow actual construye y publica GitHub Pages desde `main`.
- Variables públicas usadas por el frontend: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. La clave publishable/anon está diseñada para el cliente; su seguridad depende de RLS. Nunca usar una service-role key como variable `NEXT_PUBLIC_*`.
- El proyecto Vercel disponible actualmente es `talentbase`; ClubOS aún no tiene proyecto propio.

## Fase 1 — Preparación Vercel

1. Crear un proyecto Vercel independiente llamado `club-os` o `clubos`, asociado exclusivamente a `Mr-M1r4/Club_OS`.
2. Confirmar Framework Preset Next.js, Root Directory `./`, Install Command `npm ci`, Build Command `npm run build`, Output Directory según detección automática de Next.js (no sobrescribir con `out` salvo que Vercel lo exija para el modo export estático).
3. No conectar el proyecto `talentbase`.
4. Añadir variables de entorno a Production, Preview y Development según necesidad:
   - `NEXT_PUBLIC_SUPABASE_URL` = URL del proyecto Supabase existente.
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = publishable/anon key existente.
5. No introducir `SUPABASE_SERVICE_ROLE_KEY` en el frontend ni en variables `NEXT_PUBLIC_*`. Si alguna función server-side futura la necesita, usar variable cifrada y solo en runtime server-side.
6. Mantener el proyecto privado y los previews protegidos si el plan de Vercel lo permite. No activar protecciones que impidan el acceso a la aplicación de producción para los usuarios finales.
7. Verificar el build preview y revisar logs antes de considerar cualquier dominio de producción.

## Fase 2 — Compatibilidad de rutas

El `basePath` de GitHub Pages es `/Club_OS`. Vercel debe servir desde la raíz del dominio. Antes de producción:
- Adaptar `next.config.ts` para que `basePath` sea `/Club_OS` en GitHub Pages y vacío en Vercel (por ejemplo, detectar `process.env.VERCEL === '1'`).
- Confirmar que las rutas de imágenes, logos, descargas, assets y enlaces internos no tengan `/Club_OS` codificado de forma fija.
- Comprobar recarga directa de rutas, navegación, sesión y callback de Auth.
- No cambiar el modo de exportación estática sin comprobar antes si la aplicación requiere APIs o funciones server-side.

## Fase 3 — Supabase Auth

Antes del corte, actualizar Auth > URL Configuration:
- Site URL: dominio definitivo de producción Vercel.
- Redirect URLs: dominio de producción y patrón de previews solo si se decide permitirlos; conservar temporalmente `https://mr-m1r4.github.io/Club_OS/**` durante la transición.
- Mantener `http://localhost:3000/**` para desarrollo si se usa.
- Probar inicio/cierre de sesión, recuperación de contraseña, enlace de recuperación, retorno a la app y persistencia de sesión.
- No retirar la URL antigua hasta confirmar que ya no se usa.

## Fase 4 — Pruebas de aceptación obligatorias

Usar una cuenta de prueba y datos controlados; no modificar ni borrar datos reales.

- Autenticación: login, logout, sesión al recargar, recuperación de contraseña.
- Autorización: roles y permisos de administrador/propietario; comprobar accesos denegados.
- Datos: lectura y escritura de deportistas, clubes, categorías, equipos y entrenamientos.
- Planes: crear/editar/desactivar plan; comprobar que planes activos aparecen en Caja y pagos > Nuevo pago > Concepto y precargan el valor.
- Pagos: crear y editar pagos; estados, fechas, métodos, referencias y asociación con deportista.
- Recibos: vista previa, PDF, impresión A5 de una sola página, contenido completo y sin páginas vacías.
- WhatsApp: compartir PDF con Web Share API cuando el navegador lo admita; fallback de descarga y apertura de WhatsApp con texto.
- Inventario/productos, asistencia, cartera, reportes y exportaciones.
- Imágenes: carga y visualización de logos e imágenes de productos desde Storage.
- Seguridad: RLS, acceso entre clubes, permisos de Storage, ausencia de secretos en bundle y consola sin errores críticos.
- Navegadores de escritorio y móvil; verificar URL de producción y recarga de páginas.

Registrar resultado, navegador, cuenta/rol de prueba y evidencia de cada caso. No promover producción con fallos críticos.

## Fase 5 — Corte controlado

1. Confirmar que preview Vercel pasa todas las pruebas.
2. Configurar el dominio final y TLS; no asumir que el dominio está disponible hasta verificarlo.
3. Actualizar Site URL y Redirect URLs de Supabase; probar recuperación de contraseña en el dominio final.
4. Publicar Vercel a producción y comprobar login y operaciones clave.
5. Mantener GitHub Pages activo y accesible como rollback durante el periodo de observación.
6. Solo después de aceptación explícita del propietario: convertir el repositorio en privado.
7. Confirmar que Vercel sigue recibiendo commits y desplegando desde el repositorio privado.
8. Mantener el workflow de GitHub Actions de verificación (CI). Desactivar únicamente el job/publicación de Pages cuando Vercel esté confirmado como producción estable.
9. Retirar URLs antiguas de Auth solo cuando no sean necesarias.

## Rollback

Si falla una prueba crítica o el servicio de Vercel:
- No borrar datos ni tocar Supabase.
- Volver a publicar/usar la última versión estable de GitHub Pages mientras siga disponible.
- Restaurar temporalmente Site URL/Redirect URLs de Supabase si el callback impide iniciar sesión.
- Corregir el problema en una rama; no hacer cambios apresurados directamente en producción.
- No volver público el repositorio como mecanismo de rollback salvo decisión expresa: el hosting anterior y la visibilidad del repositorio son controles separados.

## Criterios de cierre

- [ ] Proyecto Vercel independiente, conectado al repositorio correcto.
- [ ] Variables públicas configuradas sin secretos privilegiados.
- [ ] Preview validado en rutas raíz, Auth y flujos operativos.
- [ ] Pruebas de aceptación completas sin defectos críticos.
- [ ] Dominio y callbacks de Supabase verificados.
- [ ] Producción Vercel estable y rollback disponible.
- [ ] Repositorio convertido a privado por confirmación expresa.
- [ ] CI conservado; Pages desactivado solo después de estabilidad.
- [ ] Documentación y responsables de acceso actualizados.
