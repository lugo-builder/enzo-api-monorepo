# Proceso Mensual de Lecturas de Agua y Pagos Internos — Condominio Hydra

## 1. Objetivo

Documentar el flujo de trabajo mensual para:

1. Registrar las lecturas individuales de los micromedidores de agua de las 90 viviendas.
2. Calcular el consumo mensual en metros cúbicos (`m³`) por vivienda.
3. Determinar el importe de agua utilizando el tarifario vigente de la CEA.
4. Mantener actualizado el catálogo de tarifas de agua de `0 m³` a `200 m³`.
5. Generar el reporte mensual consolidado de lecturas y consumo.
6. Generar el reporte mensual de pagos internos por vivienda.
7. Incorporar adeudos, sanciones y conceptos adicionales aplicables a cada residente.
8. Conservar trazabilidad entre lecturas, tarifas, cargos y reportes generados.

---

## 2. Alcance

El proceso aplica a las viviendas del condominio **Hydra** y contempla:

- Lectura física de micromedidores.
- Evidencia fotográfica de cada lectura.
- Registro individual de lectura inicial y final.
- Cálculo del consumo mensual.
- Consulta del tarifario vigente.
- Cálculo del importe del agua.
- Actualización trimestral del tarifario.
- Generación del reporte mensual de lecturas de agua.
- Generación del reporte mensual de pagos internos.
- Incorporación de cuotas fijas, variables, adeudos y sanciones.
- Validación previa a la distribución de los reportes.

---

# 3. Documentos involucrados

## 3.1 Reporte mensual de lecturas de agua

Formato de referencia:

```text
5_2026_CEA_Lecturas_Hydra_Final
```

Información principal:

| Campo | Descripción |
|---|---|
| Casa | Número de vivienda |
| Medidor | Número o identificador del micromedidor |
| Lectura inicial | Lectura correspondiente al cierre anterior |
| Lectura final | Lectura obtenida físicamente durante el periodo actual |
| M3 | Diferencia entre lectura final e inicial |
| Difer. Macro | Ajuste aplicable por diferencia del macromedidor |
| Total a pagar | Importe calculado de acuerdo con el tarifario vigente |

El reporte debe identificar también:

- Periodo de lectura.
- Notas o consideraciones del periodo.
- Viviendas con tratamiento especial.
- Viviendas morosas, cuando aplique.
- Ajustes administrativos relacionados con el consumo.

---

## 3.2 Catálogo de tarifas de agua

Formato de referencia:

```text
tarifario_cea_[mes]_[año]
```

Ejemplo:

```text
tarifario_cea_mayo_2026
```

El catálogo contiene la relación:

```text
m³ → costo
```

para consumos desde:

```text
0 m³
```

hasta:

```text
200 m³
```

Cada valor de consumo debe tener asociado un importe vigente.

Ejemplo conceptual:

| m³ | Costo |
|---:|---:|
| 0 | $68 |
| 1 | $85 |
| 2 | $102 |
| ... | ... |
| 200 | $17,666 |

> El tarifario debe conservarse por versión y vigencia. No se deben sobrescribir tarifas históricas utilizadas en periodos anteriores.

---

## 3.3 Reporte mensual de pagos internos

Formato de referencia:

```text
7.Hydra_PagosInternos_Julio_2026
```

Información principal:

| Campo | Descripción |
|---|---|
| Casa | Número de vivienda |
| Cuota ordinaria | Cuota fija mensual |
| Consumo agua | Importe calculado con base en el reporte de lecturas |
| Pago pendiente | Saldo pendiente proveniente de periodos anteriores |
| Sanción | Multa o sanción aplicable |
| Mes de pago | Mes correspondiente al estado de cuenta |
| Comentarios | Observaciones o conceptos adicionales |
| Total a pagar | Total del periodo |

---

# 4. Flujo general del proceso

```text
Toma de fotografías de micromedidores
        ↓
Captura individual de lecturas
        ↓
Validación contra lectura anterior
        ↓
Cálculo de consumo en m³
        ↓
Consulta del tarifario vigente
        ↓
Asignación del costo de agua
        ↓
Generación del reporte de lecturas
        ↓
Validación administrativa
        ↓
Generación de pagos internos
        ↓
Incorporación de adeudos / sanciones / adicionales
        ↓
Cálculo del total mensual
        ↓
Validación final
        ↓
Publicación o envío a residentes
```

---

# 5. Proceso mensual detallado

## Paso 1. Apertura del periodo de lectura

### Objetivo

Crear el nuevo periodo mensual de consumo de agua.

### Datos requeridos

- Mes de operación.
- Año.
- Fecha inicial del periodo.
- Fecha final del periodo.
- Tarifario vigente.
- Responsable de captura.

### Validaciones

- El periodo no debe existir previamente.
- Debe existir un tarifario vigente para la fecha del periodo.
- Las 90 viviendas deben encontrarse registradas.
- Cada vivienda debe tener identificado su micromedidor correspondiente.

### Resultado

Periodo disponible para comenzar la captura de lecturas.

---

## Paso 2. Toma de lectura física y fotografía

### Objetivo

Obtener evidencia física de la lectura final de cada micromedidor.

### Procedimiento

Para cada vivienda:

1. Identificar el número de casa.
2. Localizar el micromedidor correspondiente.
3. Verificar que el número físico del medidor coincida con el registrado.
4. Tomar una fotografía legible.
5. Registrar la lectura visible.
6. Registrar fecha y, cuando sea necesario, observaciones.

### Información mínima

```text
Casa
Número de medidor
Fecha de lectura
Lectura observada
Fotografía
Observaciones
```

### Reglas

- La fotografía debe permitir identificar claramente la lectura.
- No debe capturarse una lectura sin asociarla a una vivienda.
- Cuando el medidor se encuentre dañado, ilegible, sustituido o sin acceso, registrar la incidencia.
- La evidencia fotográfica debe mantenerse asociada al periodo y a la vivienda.

---

## Paso 3. Captura individual de lecturas

### Objetivo

Construir progresivamente el reporte mensual de lecturas.

Para cada vivienda se registra:

```text
lecturaInicial
lecturaFinal
```

La lectura inicial debe obtenerse, de manera predeterminada, de la lectura final del periodo anterior.

### Fórmula

```text
consumoM3 = lecturaFinal - lecturaInicial
```

Ejemplo:

```text
Lectura inicial: 438
Lectura final:   441

Consumo:

441 - 438 = 3 m³
```

### Validaciones

- `lecturaFinal >= lecturaInicial`.
- La lectura inicial debe coincidir con el cierre anterior.
- La lectura debe corresponder al medidor registrado.
- Una vivienda no debe tener dos lecturas activas para el mismo periodo.
- Cualquier corrección debe conservar trazabilidad.

### Excepciones

Documentar cuando exista:

- Cambio de medidor.
- Reinicio de medidor.
- Medidor dañado.
- Lectura estimada.
- Vivienda sin acceso.
- Lectura incorrecta del periodo anterior.

---

## Paso 4. Aplicación de diferencia del macromedidor

### Objetivo

Registrar, cuando corresponda, ajustes derivados de diferencias entre consumos individuales y consumo general.

Campo:

```text
DIFER. MACRO
```

### Regla

El ajuste debe registrarse explícitamente y no debe modificar silenciosamente la lectura física capturada.

Registrar:

```text
consumoMedidoM3
diferenciaMacroM3
consumoFacturableM3
```

Fórmula conceptual:

```text
consumoFacturableM3 =
consumoMedidoM3 + diferenciaMacroM3
```

Cuando la diferencia sea `0`, el consumo facturable será igual al consumo medido.

---

# 6. Consulta y aplicación del tarifario

## Paso 5. Identificación del tarifario vigente

Antes de realizar cualquier cálculo se debe localizar la versión del tarifario vigente.

Ejemplo de identificación:

```text
Tarifario: CEA Mayo 2026
Vigencia desde: [fecha]
Vigencia hasta: [fecha]
Rango: 0 a 200 m³
```

Cada periodo de lectura debe conservar la referencia exacta al tarifario utilizado.

---

## Paso 6. Obtención del costo por consumo

El consumo calculado se consulta en el catálogo.

Ejemplo:

```text
Consumo: 3 m³
Tarifa correspondiente: $120
```

Por tanto:

```text
totalAgua = $120
```

El sistema no debe calcular este importe mediante valores hardcodeados.

Debe realizar una búsqueda conceptual:

```text
tarifario[consumoM3] → costo
```

### Validaciones

- El valor de `m³` debe existir en el tarifario vigente.
- No se debe usar una tarifa vencida.
- El tarifario debe cubrir al menos `0–200 m³`.
- Si el consumo supera `200 m³`, el sistema debe generar una excepción administrativa o aplicar una regla explícitamente configurada.

---

# 7. Mantenimiento trimestral del tarifario de agua

## Objetivo

Actualizar los costos oficiales aproximadamente cada tres meses, manteniendo historial de las versiones anteriores.

## Procedimiento

1. Obtener el nuevo tarifario autorizado.
2. Registrar una nueva versión.
3. Indicar la fecha de inicio de vigencia.
4. Registrar los precios desde `0 m³` hasta `200 m³`.
5. Validar que existan exactamente los valores esperados.
6. Comparar contra la versión anterior.
7. Identificar incrementos, reducciones o valores anómalos.
8. Aprobar el catálogo.
9. Marcarlo como vigente.
10. Mantener el catálogo anterior únicamente como histórico.

## Datos sugeridos del catálogo

```text
id
nombre
fechaVigenciaInicio
fechaVigenciaFin
estatus
fuente
observaciones
```

Detalle:

```text
tarifaId
m3
costo
```

### Reglas

- No sobrescribir precios de una versión previamente utilizada.
- No permitir dos tarifarios vigentes para la misma fecha.
- Deben existir valores consecutivos de `0` a `200`.
- Cada `m³` debe existir una sola vez por versión.
- Todos los costos deben ser mayores o iguales a cero.
- Registrar quién realizó la actualización.
- Registrar quién aprobó la nueva versión.

---

# 8. Generación del reporte mensual de lecturas

## Paso 7. Validación de las 90 viviendas

Antes de cerrar el reporte validar:

```text
Total viviendas esperadas: 90
Total lecturas capturadas: 90
```

Generar alertas por:

- Vivienda sin lectura.
- Vivienda sin fotografía.
- Medidor no identificado.
- Lectura menor a la anterior.
- Consumo inusualmente alto.
- Consumo en `0 m³`.
- Ajustes manuales.
- Diferencias de macromedidor.
- Consumo fuera del tarifario.

---

## Paso 8. Generación del documento

Nombre sugerido:

```text
[mes_numérico]_[año]_CEA_Lecturas_Hydra_Final
```

Ejemplo:

```text
5_2026_CEA_Lecturas_Hydra_Final
```

Contenido:

```text
Periodo
Notas
Casa
Medidor
Lectura inicial
Lectura final
M3
Diferencia macro
Total a pagar
```

### Estado del reporte

```text
BORRADOR
VALIDADO
CERRADO
PUBLICADO
```

Una vez cerrado no debe modificarse directamente.

Cualquier corrección posterior debe quedar registrada.

---

# 9. Generación de pagos internos

## Paso 9. Apertura del periodo de pagos internos

Ejemplo:

```text
Julio 2026
```

La información de agua utilizada debe proceder del reporte de lecturas previamente validado.

---

## Paso 10. Incorporación de la cuota ordinaria

Cada vivienda recibe la cuota ordinaria vigente.

Ejemplo actual de referencia:

```text
$165
```

La cuota debe almacenarse como configuración con vigencia y no directamente en código.

---

## Paso 11. Incorporación del consumo de agua

Para cada vivienda:

```text
Consumo agua = total calculado en el reporte mensual de lecturas
```

Ejemplo:

```text
Casa 1

Consumo:
1 m³

Costo de agua:
$125
```

El importe debe provenir directamente de la lectura validada para evitar una segunda captura manual.

---

## Paso 12. Incorporación de pagos pendientes

Consultar el balance de cada vivienda al cierre del periodo anterior.

Registrar como:

```text
Saldo de apertura / Pago pendiente
```

### Regla crítica

El pago pendiente **no debe crearse nuevamente como un cargo financiero cada mes**.

Debe ser el saldo resultante de:

```text
cargos anteriores
- pagos aplicados
- descuentos
- bonificaciones
± ajustes
```

---

## Paso 13. Incorporación de sanciones

Cuando una vivienda tenga sanciones:

```text
SANCIÓN = importe correspondiente
```

Además debe registrarse:

```text
Tipo de sanción
Motivo
Fecha
Acuerdo o fundamento
Importe
Observaciones
```

Ejemplo:

```text
Sanción: $500
Comentario:
1er amonestación
Escala de multas No-1
```

---

## Paso 14. Incorporación de conceptos adicionales

Ejemplos:

```text
Cajón de estacionamiento adicional
Cuota extraordinaria
Ajuste
Recargo
Descuento
Fondo de reserva
Otros
```

Cada concepto debe existir como movimiento independiente y no únicamente como texto libre.

El campo `Comentarios` puede utilizarse para explicar el cargo.

---

# 10. Cálculo del pago interno mensual

La presentación actual puede expresarse como:

```text
TOTAL A PAGAR =
Cuota ordinaria
+ Consumo de agua
+ Saldo pendiente
+ Sanciones
+ Cargos adicionales
- Créditos / descuentos aplicables
```

Ejemplo:

```text
Cuota ordinaria:    $165
Consumo de agua:    $217
Pago pendiente:     $562
Sanción:            $500
--------------------------------
TOTAL A PAGAR:    $1,444
```

El sistema debe validar matemáticamente cada registro antes de generar el reporte.

---

# 11. Generación del reporte de pagos internos

## Paso 15. Validación previa

Validar para las 90 viviendas:

- Cuota ordinaria.
- Consumo de agua.
- Saldo anterior.
- Sanciones.
- Conceptos adicionales.
- Descuentos.
- Comentarios.
- Total.

Validar además:

```text
totalCalculado == totalReportado
```

---

## Paso 16. Generación del documento

Convención:

```text
[número_mes].Hydra_PagosInternos_[Mes]_[Año]
```

Ejemplo:

```text
7.Hydra_PagosInternos_Julio_2026
```

Columnas:

```text
CASA
CUOTA ORDINARIA
CONSUMO AGUA
PAGO PENDIENTE
SANCIÓN
MES DE PAGO
COMENTARIOS
TOTAL A PAGAR
```

---

# 12. Validación final del periodo

Antes de publicar los documentos se debe realizar una revisión cruzada.

## Agua

```text
[ ] Existen 90 viviendas
[ ] Todas tienen lectura o incidencia justificada
[ ] Todas las fotografías están asociadas
[ ] Lectura inicial coincide con periodo anterior
[ ] Lectura final fue validada
[ ] Consumo fue calculado
[ ] Tarifario utilizado es el vigente
[ ] Todos los importes corresponden al catálogo
[ ] Ajustes tienen justificación
```

## Pagos internos

```text
[ ] Existen 90 registros
[ ] Cuota ordinaria vigente aplicada
[ ] Consumo de agua coincide con reporte de lecturas
[ ] Saldos anteriores son correctos
[ ] Pagos registrados hasta el corte fueron aplicados
[ ] Sanciones están documentadas
[ ] Conceptos adicionales están justificados
[ ] Totales fueron recalculados
[ ] Periodo y fecha límite son correctos
```

---

# 13. Cierre del periodo

Una vez aprobados:

```text
Reporte de lecturas → CERRADO
Reporte de pagos internos → CERRADO
```

El cierre debe registrar:

```text
Fecha
Hora
Usuario
Periodo
Versión del tarifario
Número de viviendas
Total facturado por agua
Total de pagos internos
Observaciones
```

Posteriormente los documentos pueden pasar a:

```text
PUBLICADO
```

---

# 14. Trazabilidad requerida

Debe poder responderse históricamente:

### Para una vivienda

```text
¿Qué lectura tuvo?
¿Qué fotografía respaldó la lectura?
¿Qué medidor tenía?
¿Cuál fue el consumo?
¿Qué tarifario se utilizó?
¿Cuánto se cobró de agua?
¿Qué cuota ordinaria correspondió?
¿Qué adeudo anterior tenía?
¿Qué sanciones recibió?
¿Qué pagos realizó?
¿Cuál fue su total?
```

### Para un periodo

```text
¿Qué tarifario estaba vigente?
¿Cuántas lecturas se capturaron?
¿Cuál fue el consumo total?
¿Cuánto se facturó por agua?
¿Cuánto se facturó en cuotas?
¿Cuánto existía de cartera vencida?
¿Cuántas sanciones se aplicaron?
¿Qué viviendas tenían incidencias?
```

---

# 15. Estados sugeridos del flujo

## Lecturas

```text
PENDING
CAPTURED
VALIDATED
CALCULATED
CLOSED
```

## Tarifario

```text
DRAFT
APPROVED
ACTIVE
EXPIRED
```

## Pagos internos

```text
DRAFT
GENERATED
VALIDATED
CLOSED
PUBLISHED
```

---

# 16. Responsables

| Actividad | Responsable | Validación |
|---|---|---|
| Toma de fotografías | `[Responsable]` | `[Responsable]` |
| Captura de lectura | `[Responsable]` | `[Responsable]` |
| Validación de lecturas | `[Responsable]` | `[Responsable]` |
| Actualización tarifario | `[Responsable]` | `[Responsable]` |
| Cálculo de agua | Sistema / `[Responsable]` | `[Responsable]` |
| Registro de adeudos | `[Responsable]` | `[Responsable]` |
| Registro de sanciones | `[Responsable]` | `[Responsable]` |
| Generación pagos internos | Sistema / `[Responsable]` | `[Responsable]` |
| Cierre del periodo | `[Responsable]` | `[Responsable]` |
| Publicación | `[Responsable]` | `[Responsable]` |

---

# 17. Flujo resumido para implementación en backend

```text
1. Crear / seleccionar periodo de agua
2. Cargar lectura y fotografía casa por casa
3. Recuperar lectura anterior
4. Calcular m³ consumidos
5. Aplicar diferencia macro, cuando corresponda
6. Consultar tarifa vigente por m³
7. Calcular importe de agua
8. Validar las 90 viviendas
9. Cerrar reporte de agua
10. Crear periodo de pagos internos
11. Generar cuota ordinaria
12. Importar automáticamente el cargo de agua
13. Calcular saldo anterior
14. Incorporar sanciones
15. Incorporar cargos / créditos adicionales
16. Calcular total
17. Validar las 90 viviendas
18. Cerrar pagos internos
19. Generar PDF
20. Publicar / distribuir
```

---

# 18. Dependencias entre procesos

```text
CATÁLOGO TARIFARIO
        │
        ▼
LECTURAS MICROMEDIDORES
        │
        ▼
CÁLCULO CONSUMO m³
        │
        ▼
CÁLCULO COSTO AGUA
        │
        ▼
REPORTE CEA
        │
        ▼
PAGOS INTERNOS
        │
        ├── Cuota ordinaria
        ├── Agua
        ├── Saldo anterior
        ├── Sanciones
        ├── Adicionales
        └── Créditos
        │
        ▼
ESTADO DE CUENTA / TOTAL A PAGAR
```

---

# 19. Control de versiones de archivos

Convenciones recomendadas:

```text
Tarifario:
tarifario_cea_[mes]_[año]

Lecturas:
[num_mes]_[año]_CEA_Lecturas_Hydra_Final

Pagos internos:
[num_mes].Hydra_PagosInternos_[mes]_[año]
```

Para archivos preliminares:

```text
_DRAFT
_REV01
_REV02
```

Ejemplo:

```text
7.Hydra_PagosInternos_Julio_2026_DRAFT
7.Hydra_PagosInternos_Julio_2026_REV01
7.Hydra_PagosInternos_Julio_2026_FINAL
```

Una vez generado `FINAL`, cualquier corrección debe conservar la versión previa.

---

# 20. Consideraciones para automatización

La implementación backend debe intentar eliminar capturas duplicadas.

En particular:

- La lectura final del mes actual debe convertirse automáticamente en lectura inicial del siguiente.
- El costo del agua debe obtenerse automáticamente del tarifario.
- El resultado del reporte de agua debe alimentar directamente el reporte de pagos internos.
- El saldo pendiente debe calcularse desde movimientos financieros.
- Cuotas ordinarias recurrentes deben generarse automáticamente.
- Sanciones y cargos extraordinarios requieren autorización o captura explícita.
- Los reportes deben generarse a partir de la base de datos y no convertirse en la fuente primaria de información.
- Las fotografías deben funcionar como evidencia, no como el dato financiero maestro.
- Todo cambio posterior al cierre debe quedar auditado.

---

# 21. Criterios de aceptación del proceso

El flujo se considera completo cuando:

```text
[ ] Existe tarifario vigente.
[ ] El tarifario contiene valores de 0 a 200 m³.
[ ] Las lecturas de las viviendas fueron capturadas.
[ ] Existe evidencia fotográfica.
[ ] Los consumos fueron calculados correctamente.
[ ] Cada consumo tiene un importe asignado.
[ ] El reporte de agua fue validado y cerrado.
[ ] Los importes de agua fueron trasladados a pagos internos.
[ ] Se agregó la cuota ordinaria vigente.
[ ] Los saldos pendientes son correctos.
[ ] Las sanciones están documentadas.
[ ] Los cargos adicionales están documentados.
[ ] El total de cada vivienda es correcto.
[ ] El reporte de pagos internos fue validado.
[ ] El periodo fue cerrado.
[ ] Los documentos finales fueron generados.
[ ] La información histórica conserva trazabilidad.
```
