# Arquitectura del Frontend — CondoApp

Diseño **feature-driven** con TypeScript estricto, capa de datos abstracta y
estado global limitado a la sesión.

## Principios aplicados

1. **Feature-driven:** cada módulo de negocio en `src/features/<feature>` se
   autocontiene (componentes, hooks, servicios, tipos, schema de validación).
2. **Capa de datos aislada:** ningún componente usa `axios`/`fetch` directo.
   Todo pasa por `src/services/api.ts` (instancia única con interceptores que
   inyectan el JWT y manejan el 401 → redirección a login) y por los
   `*.service.ts` de cada feature.
3. **Estado global mínimo:** `AuthContext` solo guarda `user / isAuthenticated /
   role`. Listas (pagos, propiedades) y filtros viven en hooks locales.
4. **TypeScript estricto:** sin `any`; entidades e `enum` en `src/types/domain.ts`.

## Estructura de `frontend/src`

```
src/
├── app/
│   ├── App.tsx                 # Providers (Auth) + RouterProvider + Toaster
│   └── router.tsx              # Definición de rutas y guards por rol
│
├── components/                 # UI compartida entre features
│   ├── ui/
│   │   ├── Button.tsx          # variantes primary/success/danger/outline/ghost
│   │   ├── Card.tsx
│   │   ├── Input.tsx           # Input + Select con estados de error
│   │   ├── Modal.tsx
│   │   ├── Drawer.tsx          # panel lateral (revisión de pagos admin)
│   │   ├── Skeleton.tsx        # Skeleton + TableSkeleton (shimmer)
│   │   └── EmptyState.tsx
│   ├── AppLayout.tsx           # barra superior autenticada
│   └── ProtectedRoute.tsx      # guard de sesión + rol
│
├── features/
│   ├── auth/
│   │   ├── context/AuthContext.tsx
│   │   ├── hooks/useAuth.ts
│   │   ├── pages/LoginPage.tsx
│   │   ├── services/auth.service.ts
│   │   └── schema.ts           # zod login
│   │
│   ├── payments/
│   │   ├── components/
│   │   │   ├── PaymentForm.tsx          # RHF + zod + archivo
│   │   │   ├── FileDropzone.tsx         # drag&drop + preview
│   │   │   ├── PaymentHistoryTable.tsx  # tabla + badges + descarga PDF
│   │   │   └── StatusBadge.tsx
│   │   ├── hooks/usePayments.ts
│   │   ├── services/payment.service.ts
│   │   ├── schema.ts                    # zod del formulario de pago
│   │   └── types.ts                     # PaymentMethod, metadatos de estado
│   │
│   ├── dashboard/              # vista del copropietario
│   │   ├── components/FinancialSummary.tsx   # KPI cards
│   │   ├── hooks/useAccountStatement.ts
│   │   ├── pages/OwnerDashboardPage.tsx
│   │   └── services/account.service.ts
│   │
│   └── admin-panel/           # vista del administrador
│       ├── components/
│       │   ├── ValidationInbox.tsx        # inbox de pagos pendientes
│       │   ├── PaymentReviewDrawer.tsx    # drawer: datos + comprobante + acciones
│       │   └── DelinquencyTable.tsx       # morosidad (filtro + búsqueda)
│       ├── hooks/usePendingPayments.ts
│       ├── hooks/useProperties.ts
│       ├── pages/AdminDashboardPage.tsx
│       ├── services/admin.service.ts
│       └── types.ts
│
├── services/
│   └── api.ts                  # Axios + interceptores (JWT, 401), ApiError
│
├── lib/
│   ├── format.ts              # moneda, fechas, períodos, isOverdue
│   └── cn.ts                  # composición de clases (clsx)
│
├── types/
│   └── domain.ts             # User, Property, Charge/Invoice, Payment, enums
│
├── main.tsx
├── index.css                 # Tailwind + fuente Inter
└── vite-env.d.ts             # tipado de import.meta.env
```

## Flujo de datos (ejemplo: registrar un pago)

```
PaymentForm (RHF + zodResolver)
   └─ onSubmit ─> paymentService.create(values)   [features/payments/services]
                     └─ api.post('/payments', FormData)   [services/api.ts]
                           └─ interceptor añade Authorization: Bearer <jwt>
   └─ toast.success(...) ─> onSuccess() ─> refetch hooks
```

## Notas de integración con el backend

- **Estado de pago:** el backend emite `CONFIRMED` (no `APPROVED`). El enum del
  frontend usa los mismos valores del wire y la UI muestra "Confirmado/Aprobado".
- **Comprobante y recibo:** se descargan como `blob` vía Axios (con JWT) y se
  convierten en `objectURL`, en vez de exponer `/uploads` estático sin auth.
