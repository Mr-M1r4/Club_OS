# Checklist legal y operativo antes de comercializar ClubOS

Este checklist es una puerta de salida a producción comercial, no una certificación. Marcar cada punto solo cuando exista evidencia.

## A. Identidad del proveedor y propiedad intelectual

- [ ] Definir quién es el titular y quién factura: persona natural o sociedad.
- [ ] Completar razón social, NIT, domicilio, representante, correo y canales de reclamación.
- [ ] Verificar titularidad y cesiones de derechos de autores/contratistas sobre código, diseño, textos y marca.
- [ ] Revisar licencias de dependencias, tipografías, iconos, imágenes y componentes de terceros.
- [ ] Definir estrategia de protección de marca ClubOS y búsqueda de antecedentes en SIC.
- [ ] Mantener avisos de copyright y repositorio privado para código fuente de explotación.
- [ ] Aclarar que el repositorio público actual expone el código: una política o cláusula no vuelve secreto lo que ya es públicamente accesible. Evaluar privatización del repositorio y credenciales/secretos expuestos.
- [ ] Evaluar registro de software ante la Dirección Nacional de Derecho de Autor como evidencia adicional; el derecho de autor nace con la creación, el registro no es requisito constitutivo.

## B. Datos personales

- [ ] Inventario real de campos, datos, titulares, finalidades, bases jurídicas, accesos, sistemas, países y retenciones.
- [ ] Mapear los roles Responsable/Encargado para cada flujo, sin asumir que una cláusula resuelve el rol real.
- [ ] Publicar política y avisos personalizados del proveedor y del club cliente.
- [ ] Implementar aceptación/registro de versión, fecha, usuario, texto y evidencia de autorización cuando corresponda.
- [ ] Implementar flujo de consultas, reclamos, rectificación, revocatoria y supresión con trazabilidad.
- [ ] Revisar datos de menores y autorización/representación; no tratar datos sensibles por defecto.
- [ ] Definir si se requiere inscripción en el RNBD según criterios legales vigentes y características del responsable/base.
- [ ] Publicar inventario de subencargados, funciones y países de tratamiento.
- [ ] Verificar contratos, transferencias/transmisiones internacionales y regiones de almacenamiento.
- [ ] Definir plazos reales de retención, exportación, borrado activo y purga de backups.
- [ ] Establecer procedimiento de incidentes, evaluación y notificación.
- [ ] Evaluar cookies, analítica, almacenamiento local y tecnologías de seguimiento reales.

## C. Contratación y venta

- [ ] Términos SaaS, licencia y orden comercial completos y aprobados.
- [ ] Acuerdo de tratamiento de datos firmado con cada club.
- [ ] Definir planes, precio total, impuestos, periodicidad, renovación y medios de pago.
- [ ] Definir mora, suspensión, cancelación, reembolsos y exportación sin cláusulas abusivas.
- [ ] SLA: disponibilidad, mantenimiento, soporte, recuperación, RPO/RTO y exclusiones realistas.
- [ ] Flujo de aceptación con facultad del representante y registro auditable.
- [ ] Facturación y obligaciones tributarias revisadas por contador/asesor.
- [ ] Canal de PQR, reclamaciones y soporte publicado.
- [ ] Revisar obligaciones del Estatuto del Consumidor cuando la relación sea de consumo; no asumir que todo cliente empresarial es consumidor ni excluir automáticamente esa protección.

## D. Seguridad y operación

- [ ] Pruebas negativas de aislamiento multi-club y RLS.
- [ ] Revisión de permisos de administradores y personal.
- [ ] MFA para roles privilegiados cuando sea posible.
- [ ] Secretos solo en gestores/variables seguras, nunca en repositorio.
- [ ] Backups probados con restauración real.
- [ ] Logs de auditoría protegidos y retención definida.
- [ ] Procedimiento de incidentes ensayado.
- [ ] Pruebas de exportación y eliminación por club sin afectar otros tenants.
- [ ] Revisión de dependencias, vulnerabilidades y despliegues.
- [ ] Pruebas de aceptación y regresión de funciones críticas.

## E. Condiciones de no lanzamiento

No iniciar venta masiva si:
1. no se identifica jurídicamente al proveedor;
2. no se conoce dónde se alojan los datos y quiénes son los subencargados;
3. no existe aislamiento probado entre clubes;
4. no hay procedimiento viable para derechos de titulares e incidentes;
5. se capturan datos de menores o sensibles sin controles y autorizaciones adecuados;
6. no hay contrato, precio, cancelación y exportación claros;
7. no se ha revisado el riesgo de exponer públicamente el código y secretos.

## F. Evidencias a conservar

- versiones de políticas y contratos aceptados;
- órdenes de servicio, facturas y comprobantes;
- autorizaciones de titulares y representantes;
- registro de solicitudes y respuestas;
- inventario de datos y subencargados;
- evaluaciones de riesgo, pruebas de seguridad y restauración;
- incidentes, decisiones y acciones correctivas;
- evidencia de exportación, devolución y eliminación;
- historial de cambios y aprobaciones.
