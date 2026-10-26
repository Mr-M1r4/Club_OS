# RIVER ClubOS — Manual operativo y QA

## Flujos críticos

### A. Alta de deportista
1. Crear deportista.
2. Asignar categoría/equipo opcional.
3. Verificar que aparece en el listado.
4. Editar datos.
5. Confirmar persistencia después de recargar.

### B. Inscripción
1. Seleccionar deportista y plan.
2. Definir fecha.
3. Registrar inscripción.
4. Verificar membresía y fecha final.
5. Verificar pagos internos generados.
6. Intentar segunda inscripción activa y confirmar rechazo.

### C. Renovación
1. Seleccionar membresía.
2. Renovar.
3. Verificar nueva fecha.
4. Verificar movimiento de pago.

### D. Inventario
1. Crear producto.
2. Crear variantes.
3. Registrar stock inicial.
4. Registrar salida.
5. Verificar que el stock disminuye exactamente por la cantidad.
6. Verificar venta, detalle, pago interno, movimiento y auditoría.
7. Intentar vender más stock del disponible y confirmar rechazo.
8. Intentar cantidad 0/negativa y confirmar rechazo.
9. Recargar y confirmar que el resultado persiste.

### E. Ajuste de inventario
1. Aplicar ajuste positivo.
2. Verificar stock.
3. Aplicar ajuste negativo válido.
4. Intentar dejar stock negativo y confirmar rechazo.
5. Verificar movimiento de inventario.

### F. Personal
1. Crear entrenador.
2. Registrar pago.
3. Verificar historial.
4. Confirmar que staff no puede gestionar pagos de personal.

### G. Equipos/asistencia
1. Crear categoría.
2. Crear equipo.
3. Asignar entrenador.
4. Asignar deportistas.
5. Crear entrenamiento.
6. Pasar lista.
7. Verificar resumen y porcentaje.
8. Las justificadas no deben penalizar el denominador de asistencia.

### H. Cartera/reportes
1. Crear/registrar membresías.
2. Consultar cartera.
3. Verificar pendientes/vencidos.
4. Cambiar rango de reportes.
5. Exportar CSV.
6. Imprimir/guardar PDF desde el navegador.

## Seguridad
Las pruebas deben incluir casos permitidos y denegados por rol. Supabase recomienda probar RLS por operación y por rol, incluyendo casos negativos, y automatizarlo con pgTAP/CI. citeturn0search0turn0search4

## Limitaciones conocidas
- No hay pasarela de pagos.
- No se envían mensajes externos hasta configurar proveedores.
- PDF se genera mediante impresión del navegador.
- La protección contra contraseñas comprometidas debe activarse desde la configuración de Auth si el plan de Supabase lo permite.
