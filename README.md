# 💸 Parcelamentos + Mercado

App pessoal para controlar **parcelamentos**, **lista de supermercado** e **contas do mês** — tudo em um único arquivo HTML, sem servidor e sem banco de dados.

## ✨ O que tem

| Aba | O que faz |
|---|---|
| 🏠 **Painel** | Visão geral: parcelas em aberto, contas a pagar/receber, sobra do mês, próximos vencimentos |
| 💳 **Parcelamentos** | Compras parceladas com linha do tempo, alertas de vencimento e baixa de parcelas |
| 🛒 **Supermercado** | Lista por corredor, envio pelo WhatsApp e **leitura de cupom fiscal por foto (OCR)** |
| 💡 **Contas do mês** | Contas a pagar **e** a receber + calculadora "Meu mês" (entradas dia 05 e dia 20) |

## 🚀 Como usar

Acesse a URL publicada (Vercel) em qualquer PC ou celular.

- Os dados ficam salvos **no navegador do aparelho** (`localStorage`).
- Para levar os dados de um aparelho para outro, use **💾 Backup** e **📂 Restaurar** (aba *Parcelamentos*).

## 📷 Ler cupom por foto

Na aba *Supermercado*, clique em **📷 Ler cupom**, mande a foto do cupom fiscal e confira o que o app leu antes de adicionar à lista. O leitor (Tesseract.js) roda no navegador — na primeira vez baixa ~7 MB e depois fica em cache.

## 🔔 Alertas no celular

Configure em **🔔 Alertas** (aba *Parcelamentos*) usando um bot do **Telegram**. Os avisos disparam enquanto o app estiver aberto.

## 🛠️ Tecnologia

- HTML + CSS + JavaScript puro, **um único arquivo** (`index.html`)
- OCR: [Tesseract.js](https://tesseract.projectnaptha.com/)
- Hospedagem: [Vercel](https://vercel.com)
