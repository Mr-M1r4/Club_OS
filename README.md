# Club OS

Sistema de gestión administrativa para clubes deportivos.

## Qué resuelve
- Deportistas y expedientes.
- Inscripciones y membresías.
- Caja y pagos registrados.
- Productos e inventario.
- Personal y pagos a personal.
- Equipos y categorías.
- Entrenamientos y asistencia.
- Cartera y morosidad.
- Reportes y exportación.
- Comunicaciones y recordatorios.
- Usuarios, roles y auditoría.

## Importante: no es una pasarela de pagos
Las operaciones económicas son registros administrativos internos. El módulo de productos registra salidas de inventario; no procesa tarjetas, bancos ni pagos online.

## Stack
- Next.js / React / TypeScript
- Supabase PostgreSQL / Auth / RLS / Edge Functions
- GitHub Pages

## Desarrollo
```bash
npm install
npm run dev
```

Producción está configurada para exportación estática y despliegue en GitHub Pages.

## Base de datos
Las migraciones viven en `supabase/migrations`.

Las pruebas de integridad están en `supabase/tests/database/` y el workflow de CI en `.github/workflows/database-tests.yml`.

Supabase recomienda automatizar pruebas de RLS y casos negativos con pgTAP/CI antes de producción.

## Documentación
- `docs/PROJECT.md` — arquitectura y visión del producto.
- `docs/QA-OPERATIONS.md` — plan de pruebas y operación.
- `docs/PRODUCT-ROADMAP.md` — evolución hacia producto SaaS multi-club.

## Evolución comercial
La siguiente transformación importante es multi-tenancy real: cada club debe quedar aislado por `club_id` mediante RLS. No se recomienda clonar manualmente una base de datos por cliente.

## Estado
El sistema incluye ahora un panel de plataforma para administrar suscripciones SaaS y cobros por club, con periodos, vencimientos, estados e historial de pagos separados de la operación financiera de cada club.

La base funcional de Club OS está implementada. Antes de comercializarla a terceros deben completarse las pruebas autenticadas end-to-end, multi-tenancy, onboarding y observabilidad.
