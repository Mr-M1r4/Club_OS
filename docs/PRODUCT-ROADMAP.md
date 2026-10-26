# RIVER ClubOS — Plan de producto comercial

## Visión
Convertir la implementación de RIVER en un producto SaaS configurable para clubes deportivos pequeños y medianos.

## Principio
Separar el **núcleo del producto** de la configuración de cada club.

### Núcleo
Usuarios, roles, deportistas, membresías, caja, inventario, personal, equipos, asistencia, cartera, comunicaciones, reportes y auditoría.

### Configuración
Marca, logo, moneda, locale, categorías, planes, productos, horarios, plantillas y reglas.

## Paso crítico antes de vender a terceros
Implementar multi-tenancy real:
- tabla `clubs`;
- `club_id` obligatorio en entidades de negocio;
- pertenencia de usuarios a clubes;
- RLS basada en club + rol;
- prohibición de acceso cruzado entre clubes;
- datos de demostración separados;
- migraciones reproducibles;
- onboarding automatizado.

No se debe simplemente duplicar la base de datos manualmente para cada cliente.

## Modelo comercial inicial
- Implementación/onboarding.
- Suscripción mensual.
- Soporte.
- Servicios opcionales de personalización de marca.
- Migración de datos como servicio.

Los precios deben definirse después de validar costos reales de infraestructura, soporte y adquisición.

## Roadmap
### Fase 1 — Hardening
Pruebas automatizadas, QA, seguridad, documentación y observabilidad.

### Fase 2 — Multi-club
Aislamiento de tenants y onboarding.

### Fase 3 — Producto
Panel de administración del SaaS, métricas y configuración.

### Fase 4 — Comercial
Planes, facturación y portal de cliente.

### Fase 5 — Integraciones
WhatsApp/SMS/email y eventualmente pagos externos como módulos opcionales.
