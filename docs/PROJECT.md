# RIVER ClubOS — Documentación de producto

## 1. Propósito
RIVER ClubOS es un sistema de gestión para clubes deportivos. Su núcleo es administrativo: deportistas, membresías, caja, inventario, personal, equipos, asistencia, cartera, comunicaciones, reportes y auditoría.

**No es una pasarela de pagos ni un e-commerce.** Las ventas de productos son salidas de inventario registradas internamente. El método de pago y la referencia son datos administrativos.

## 2. Arquitectura
- Frontend: Next.js + React + TypeScript, exportación estática para GitHub Pages.
- Backend: Supabase PostgreSQL + Auth + RLS + Edge Functions + pg_cron.
- Autorización: perfiles con roles `owner`, `admin`, `staff`.
- Persistencia multi-módulo en PostgreSQL.
- Funciones transaccionales para operaciones críticas de negocio.
- Auditoría e inventario registran operaciones sensibles.

## 3. Módulos
1. Dashboard
2. Deportistas
3. Membresías e inscripciones
4. Caja y pagos internos
5. Productos e inventario
6. Personal y pagos a personal
7. Equipos y categorías
8. Asistencia
9. Cartera y morosidad
10. Reportes
11. Comunicaciones
12. Configuración y usuarios
13. Auditoría

## 4. Flujo de inventario
Producto → variante/talla → stock → salida registrada → movimiento de inventario → auditoría.

Una salida:
- valida cantidad positiva;
- valida stock suficiente;
- calcula total;
- registra el movimiento financiero interno;
- registra la venta;
- registra el detalle;
- descuenta stock;
- registra movimiento de inventario;
- registra auditoría.

La operación se ejecuta como una única transacción de base de datos.

## 5. Roles
### Owner
Administración completa y configuración.

### Admin
Administración operativa y configuración permitida.

### Staff
Operación diaria: deportistas, membresías, caja, inventario, asistencia y consultas autorizadas.

## 6. Seguridad
Las tablas expuestas usan RLS y las políticas se basan en el rol almacenado en `profiles`. Las funciones privilegiadas se mantienen restringidas y con `search_path` explícito.

Antes de cada lanzamiento debe revisarse Security Advisor y ejecutar la suite de pruebas de base de datos.

## 7. Comunicaciones
El sistema puede generar una cola de recordatorios de vencimiento. La integración real con proveedores de email, WhatsApp o SMS es deliberadamente independiente y no forma parte del núcleo.

## 8. Modelo comercial para otros clubes
La solución debe evolucionar de instalación única a producto multi-club.

Fases recomendadas:
1. **Producto base:** estabilizar RIVER como referencia.
2. **Multi-tenant:** añadir `club_id` a todas las entidades de negocio y aislar datos mediante RLS.
3. **Onboarding:** asistente para crear club, administrador, categorías, planes y productos.
4. **Configuración por club:** logo, nombre, moneda, locale, métodos, plantillas y reglas.
5. **Planes comerciales:** Basic / Pro / Enterprise como empaquetado comercial, no como restricciones técnicas iniciales.
6. **Observabilidad:** errores, actividad, auditoría y métricas de uso.
7. **Backups y recuperación:** procedimiento documentado por cliente.
8. **Facturación SaaS:** implementar después de validar el producto con clubes piloto.

## 9. Regla de producto
No convertir el sistema en un e-commerce. El inventario y la caja son módulos administrativos. Cualquier integración de pago futuro debe ser opcional y desacoplada.

## 10. Criterios para considerar una versión lista
- Build de producción exitoso.
- Suite de pruebas de base de datos pasando.
- Flujos críticos probados.
- RLS revisado.
- Security Advisor revisado.
- Sin secretos en frontend.
- Migraciones reproducibles.
- Documentación actualizada.
