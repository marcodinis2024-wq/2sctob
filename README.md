# Steam Market Monitor Bot (Starter)

Estrutura inicial em **Node.js + TypeScript** para monitorização com inteligência de preço pré-calculada em Redis e execução de compra autenticada por cookies.

> ⚠️ Usa apenas em conformidade com os Termos de Serviço da Steam e legislação local.

## O que já está implementado

- `PriceService` com cálculo de `max_buy_price` e cache em Redis por `market_hash_name`
- Worker `price-updater` para refrescar preços de referência (placeholder de adapters Buff163/CSFloat)
- Worker `watcher` para polling do endpoint `/market/recent` com rotação de proxies
- `SessionManager` (`core/session.ts`) para headers/cookies Steam (`sessionid` + `steamLoginSecure`)
- `PurchaseService` para envio de compra no endpoint `/market/buylisting/:listingId`
- `WalletService` para validar saldo antes de tentativa de compra
- Notificações Telegram por tentativa de compra e por cooldown
- Guardrails de sobrevivência:
  - cooldown automático (15–30 min) em respostas `429/403`
  - kill switch por ficheiro `stop.txt`

## Fórmula de compra pré-calculada

```txt
MaxBuyPrice = (BuffPrice * 0.87) * (1 - DesiredMargin)
```

- `0.87`: net estimado pós-taxas Steam (margem de segurança)
- `DesiredMargin`: definido por `TARGET_MARGIN_PERCENT` no `.env`

## Estrutura de pastas

```txt
src/
  config/
  core/
    redis.ts
    session.ts
    guardrails/
      cooldown.ts
      kill-switch.ts
  workers/
    watcher.ts
    price-updater.ts
  services/
    market/
      market-parser.ts
    notifications/
      telegram-service.ts
    pricing/
      price-service.ts
    proxy/
      proxy-pool.ts
    purchase/
      purchase-service.ts
    rate-limit/
      jitter.ts
    wallet/
      wallet-service.ts
  utils/
    logger.ts
    sleep.ts
```

## Setup

1. Copia `.env.example` para `.env`
2. Instala dependências:

   ```bash
   npm install
   ```

3. Arranca Redis local
4. Corre worker de preços:

   ```bash
   npm run worker:prices
   ```

5. Corre watcher:

   ```bash
   npm run worker:watcher
   ```

## Operação segura

- Extrai `sessionid` e `steamLoginSecure` manualmente do browser e guarda no `.env`
- Para parar o bot remotamente por SSH, cria `stop.txt` na raiz
- Se houver bloqueio `429/403`, o watcher entra em pausa automática

## Próximos passos

- Integrar adapters reais Buff163/CSFloat
- Refinar cálculo real de `subtotal/fee/total_price` por listing
- Persistir tentativas/sucessos/erros em PostgreSQL
- Adicionar idempotência para evitar tentativas de compra duplicadas

## Modo Zero-Dependencies (Vanilla Node.js)

Também foi incluído `sniper.js`, uma versão sem dependências externas, usando apenas `https` nativo do Node.

- Faz polling do endpoint `/market/recent`
- Extrai listings do `results_html`
- Envia alerta para Telegram quando o preço fica abaixo de `VANILLA_MAX_ALERT_PRICE_EUR`
- **Não executa compra automática** (modo seguro)

Executar:

```bash
npm run vanilla:watch
```
