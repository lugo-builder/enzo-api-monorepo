# Motor de cálculo de tarifario de agua (Hydra)

Servicio: `WaterBillingCalculatorService.calculate(input, tariff)`.

## Modo operativo: tabla lookup CEA/PDF (`LOOKUP_BY_M3`)

El PDF CEA (p. ej. mayo 2026) lista **costo total por m³ entero** de 0 a 200.
Cada fila de `WaterTariffTier` tiene una sola clave `m3` y su `fixedAmount`.

1. Se carga el JSON completo vía `POST /water-tariffs/from-lookup-json`:

```json
{
  "residentialComplexId": "<uuid-hydra>",
  "rateTariffDate": "05-2026",
  "measures": [
    { "m3": 0, "price": "68.00" },
    { "m3": 5, "price": "157.00" },
    { "m3": 200, "price": "17666.00" }
  ]
}
```

Ese JSON queda registrado en `ImportBatch` (`type = WATER_TARIFF`, campo `payload`).

2. Al calcular lecturas (casa por casa): `floor(consumo)` → fila `m3` → `price`.
   - Hydra 1 consumió **5 m³** → **157.00**.
   - 5.7 m³ → se factura como **5** (floor).
   - Consumo > máximo de la tabla → error (hay que completar la tabla o corregir lectura).

Fixture de referencia: `apps/core/src/water-tariffs/fixtures/cea-mayo-2026.lookup.json`.

## Reglas del motor

1. **Entrada monetaria y de m³** como string decimal (nunca `number`/`float` en el contrato). Internamente se usa `Decimal` de Prisma.
2. **`billingConsumption = max(consumptionM3, minimumConsumptionM3)`**. La diferencia del macromedidor (`macroDifferencePrice`) es MXN y no altera los m³.
3. **Lookup**: `floor(billingConsumption)` debe existir como `WaterTariffTier.m3`.
4. **`baseCharge`** de la cabecera se suma siempre.
5. **Descuento**: `discountAmount + subtotal × (discountPercentage / 100)`.
6. **Total**: `round(baseCharge + tierAmount - discount) + macroDifferencePrice + manualAdjustment + reserveFund` (2 decimales, `HALF_UP` por defecto).
7. El motor **no persiste** nada; `simulate` y el cálculo de periodo lo consumen.

## Evidencia JSON (`ImportBatch`)

| type | Origen | Contiene |
|------|--------|----------|
| `WATER_TARIFF` | `POST /water-tariffs/from-lookup-json` | JSON del tarifario |
| `WATER_READINGS` | `POST /water-periods/:id/import-readings-json` | JSON de lecturas |
| `WATER_CONSUMPTION_REPORT` | Tras calcular el periodo | Snapshot del reporte |
| `PAYMENT_REPORT` | (reservado) | Reportes de pago |

Los datos canónicos siguen en `WaterReading` / `WaterTariff` / `UnitCharge`. El JSON en `ImportBatch.payload` es evidencia y permite reproceso.
