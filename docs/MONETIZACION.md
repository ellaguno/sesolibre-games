# Plan de monetización

> Estado: **plan** (sin implementar). Se aborda **después** del primer lanzamiento
> estable en Google Play. No bloquear el release inicial por esto.

## Resumen / decisión

Modelo **híbrido** en **una sola app gratuita** (NO dos listados separados — Google
penaliza apps duplicadas):

- **Gratis con anuncios** + **compra única "Quitar anuncios / Premium"** (IAP).
- El motor de recompensas existente (`src/core/RewardService.ts`: monedas, racha
  diaria, logros, cosméticos) es el punto de integración natural.

La monetización es realista **solo en la app de Android** (Play). La **PWA/web**
queda gratis como escaparate (AdMob es solo para apps; AdSense en un juego casi no
se aprueba y paga mal).

## Caminos de Google

| Camino | Producto de Google | Uso |
| --- | --- | --- |
| Anuncios | **AdMob** | rewarded, interstitial, banner |
| Pago sin anuncios | **Google Play Billing** | IAP único "Quitar anuncios" |

### Tipos de anuncio y dónde usarlos

- **Rewarded (recompensado) — PRIORITARIO.** Opt-in: "mira un anuncio y gana
  monedas / duplica la recompensa diaria / pista". Mejor UX y mejor pago; encaja
  directo con `RewardService`.
- **Interstitial** (pantalla completa) entre partidas, **con tope de frecuencia**
  (p. ej. cada N "game over"). Usar con moderación.
- **Banner**: solo en hub/menús, **nunca durante el juego**.

### Premium (IAP "Quitar anuncios")

- Compra **única** (~USD 1.99–2.99).
- Quita banners e interstitials. Los **rewarded** se mantienen como opción
  voluntaria (el usuario los ve solo si quiere recompensa).
- Persistir el flag `premium` en `RewardService` / storage
  (`@capacitor/preferences` en nativo, localStorage en web).

## Cumplimiento (IMPORTANTE)

- **Público infantil (COPPA / GDPR-K):** los juegos son family-friendly. Si se
  marca como dirigido a niños o "Designed for Families", **obligatorio** anuncios
  **no personalizados y family-safe** (configurable en AdMob). Declarar bien el
  **público objetivo** en Play Console. No segmentar anuncios a menores.
- **Consentimiento (UE/RU):** integrar el **UMP SDK** de Google (consent management)
  para personalización de anuncios.
- **Privacidad:** publicar **política de privacidad** (URL) — los SDK de anuncios
  recolectan datos.
- **Seguridad de los datos (Play):** actualizar el formulario declarando la
  recolección de los SDK de ads (deja de ser "todo local").
- **AdMob:** cuenta propia con aprobación; **pago mínimo USD 100** acumulados
  antes del primer depósito.

## Expectativas realistas

A escala de proyecto pequeño el ingreso es **muy bajo**: eCPM de casual bajo,
conversión a "quitar anuncios" típica 1–5%. Sin volumen de instalaciones son
centavos al mes. Tratarlo como **aprendizaje + base**, no como ingreso. El dinero
real requiere adquisición de usuarios / volumen.

## Secuencia (fases)

1. **Lanzar gratis primero** — completar prueba cerrada (12 testers, 14 días, ver
   [RELEASING.md](RELEASING.md)) y publicar **sin** monetización.
2. **Actualización con monetización:**
   - AdMob **rewarded** enganchado a las monedas de `RewardService`.
   - **IAP "Quitar anuncios"** + flag `premium`.
   - Interstitials suaves con tope de frecuencia.
   - UMP (consentimiento) + política de privacidad + data safety.
3. **Iterar** según métricas (frecuencia de ads, precio del IAP, qué rewarded usan).

## Stack técnico (cuando se implemente)

- **Anuncios:** `@capacitor-community/admob`.
- **IAP:** **RevenueCat** (capa gratuita, simplifica Play Billing y multiplataforma)
  o el billing nativo de Play.
- **Integración:** `RewardService` ya centraliza monedas/cosméticos → añadir ahí el
  flag `premium` y los hooks de rewarded.

## Pendientes / checklist (futuro)

- [ ] Crear cuenta AdMob y vincular la app.
- [ ] Definir público objetivo y configuración family-safe en Play + AdMob.
- [ ] Política de privacidad publicada (URL).
- [ ] UMP SDK (consentimiento UE/RU).
- [ ] Plugin AdMob + unidades (rewarded / interstitial / banner).
- [ ] IAP "Quitar anuncios" + flag `premium` persistido.
- [ ] Actualizar formulario de Seguridad de los datos.
