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

## Rotas de execução com rede aberta

### 1) VPS (recomendado para 24/7)

```bash
git clone <teu-repo>
cd 2sctob
cp .env.example .env
# preencher .env
npm run vanilla:update-prices
npm run vanilla:watch
```

### 2) GitHub Codespaces

No GitHub: **Code → Codespaces → Create codespace on main**.
Depois no terminal do codespace:

```bash
cp .env.example .env
npm run vanilla:update-prices
npm run vanilla:watch
```

### 3) Docker local

```bash
npm run docker:build
npm run docker:run
```

## Atualização de tabela de preços (vanilla)

Foi adicionado `update-prices.js` (sem dependências) para obter um feed JSON e gravar em `prices.json`.

```bash
npm run vanilla:update-prices
```

Variáveis usadas:
- `PRICE_SOURCE_URL`
- `PRICE_OUTPUT_FILE`

## Boas práticas de segurança operacional

- `.env` já está no `.gitignore` para evitar leak de credenciais.
- Arranca primeiro em modo seguro (monitorização/alertas) e valida comportamento antes de qualquer automação adicional.
- Se aparecerem muitos erros de `429`/`403`, interrompe execução e roda com novo proxy/IP.

## prices.json manual (modo imediato)

Podes operar sem API externa com uma base local na raiz do projeto (`prices.json`):

```json
{
  "AK-47 | Slate (Field-Tested)": 2.50,
  "AWP | Atheris (Field-Tested)": 2.10,
  "Desert Eagle | Mecha Industries (Minimal Wear)": 4.80
}
```

A regra no `sniper.js` é:

```txt
maxPurchasePrice = referencePrice * PROFITABILITY_MULTIPLIER
```

Por default, `PROFITABILITY_MULTIPLIER=0.80`.
O log de arranque mostra: `Loaded X items from price database`.
