# Hydra — Backend de operación financiera y agua (app core)

## Resumen

Módulo NestJS integrado en `apps/core` para administrar el condominio **Hydra** (90 viviendas): residentes, medidores, lecturas, tarifario, cargos, pagos, conciliación bancaria, estados de cuenta e importaciones CSV/XLSX.

## Principios

- La **vivienda** es la unidad contable; el saldo se deriva del ledger.
- Montos: `Decimal` en BD; string decimal en API.
- **Cuota ordinaria** vía `RecurringChargeConfig` versionado (no hardcodeada en servicios).
- Cifras de PDF **no** se cargan como productivas; fixtures solo con `SEED_HYDRA_DEV_FIXTURES=true`.

## Seed

```bash
npx prisma migrate dev
pnpm prisma db seed
```

Incluye:

| Dato | Valor |
|------|--------|
| Complejo residencial | Hydra (`ResidentialComplex`) |
| Viviendas | 1–90 |
| currency | MXN |
| paymentDueDay | 10 |
| Cuota ordinaria | `RecurringChargeConfig` → 165.00 MXN |
| Charge types | ORDINARY_FEE, WATER, PENALTY, PARKING, EXTRAORDINARY_FEE, RESERVE_FUND, SURCHARGE, DISCOUNT, ADJUSTMENT, OTHER (+ OPENING_BALANCE técnico) |
| Permisos | `RESIDENT_*` asignados a Admin y SuperAdmin |

### Micromedidores (previo a lecturas)

`POST /water-meters/from-json` — puede reutilizar el mismo archivo de lecturas:

```json
{
  "residentialComplexId": "<uuid-hydra>",
  "readings": [ { "unitNumber": "1", "meterSerial": "19000193", "previousReading": "49.00" } ]
}
```

O `meters: [{ unitNumber, serialNumber, initialReading }]`.

### Lecturas mensuales vía JSON (sin fotos)

1. Crear periodo: `POST /water-periods` (con `tariffId` CEA).
2. Cargar lecturas: `POST /water-periods/:id/import-readings-json`

```json
{
  "priceService": "40.00",
  "calculate": true,
  "readings": [
    {
      "unitNumber": "1",
      "meterSerial": "19000193",
      "previousReading": "49.00",
      "currentReading": "50.00",
      "macroDifferencePrice": "10.00",
      "calculationMode": "ACTUAL"
    }
  ]
}
```

- `priceService`: cargo fijo por servicio de lectura, sumado a **cada** vivienda.
- `macroDifferencePrice`: diferencia del macromedidor **en pesos (MXN)** por casa; se suma al total, no al consumo.
- Montos y lecturas se normalizan a **2 decimales**.

Fórmula por vivienda:

```text
consumoFacturable = current - previous
agua = tarifario[floor(consumoFacturable)]
total = agua + macroDifferencePrice + priceService (+ manual/reserva si aplica)
```

3. Reporte: `GET /water-periods/:id/report` → filas con `waterAmount`, `serviceFeeAmount`, `totalAmount`.

Cada carga JSON queda en `ImportBatch.payload` tipado (`WATER_READINGS`, y tras calcular también `WATER_CONSUMPTION_REPORT`). El tarifario CEA vía `from-lookup-json` se guarda como `WATER_TARIFF`. Los montos canónicos viven en `WaterReading` / `UnitCharge`.

Motor de agua: [HYDRA-WATER-TARIFF-CALCULATOR.md](./HYDRA-WATER-TARIFF-CALCULATOR.md). Tarifario CEA: `POST /water-tariffs/from-lookup-json` (tiers con columna `m3`, sin rangos). Flujo operativo: [flujo_operativo_agua_pagos_hydra.md](./flujo_operativo_agua_pagos_hydra.md). Swagger: `/api`.

## Pruebas

```bash
pnpm exec jest apps/core/src/water-tariffs apps/core/src/water-readings apps/core/src/billing-periods apps/core/src/payments apps/core/src/auth/guards apps/core/src/charges apps/core/src/bank-transactions
```

Cobertura unitaria (mocks Prisma): agua, lecturas/periodos, cargos/billing, pagos, saldos, conciliación duplicados, RolesGuard (sin token / sin permiso / autorizado / reopen / audit).
