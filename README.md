# Fz Heatmap

**A live BTCUSDT liquidity heatmap and order-flow research terminal, with trade bubbles, candles, institutional ETF flow and a sentiment-coded Bitcoin news feed. Built for research on crypto market microstructure and market integrity.**

**© 2026 Faizan Rehan. All rights reserved. Proprietary; see [LICENSE](./LICENSE).**

**Live application:** https://fz-heatmap.lovable.app

**Author and lead researcher:** Faizan Rehan, Advocate and Independent Legal & Financial Markets Researcher
Contact: [faizan.tabassumrehan@gmail.com](mailto:faizan.tabassumrehan@gmail.com)
[ORCID 0009-0000-2249-6711](https://orcid.org/0009-0000-2249-6711) · SSRN Author ID 13164428

## Purpose

Resting liquidity in the order book is central to questions about spoofing, layering and market integrity, yet it is rarely visible in a form that can be examined and discussed. Fz Heatmap renders live BTCUSDT order-book depth as a time-based heatmap, overlaid with executed trades and price candles, so that liquidity behaviour can be observed and studied alongside the wider market context.

It is a research and visualisation tool, not an enforcement tool or a source of legal conclusions.

## Research context

This project supports the author's research on crypto market microstructure, market manipulation and financial regulation:

- **Invisible Market Power in Crypto-Asset Markets** (working paper, SSRN, October 2026): [SSRN Abstract 7656978](https://papers.ssrn.com/abstract=7656978)

All papers are listed on the author's [SSRN](https://papers.ssrn.com/) and [ORCID](https://orcid.org/0009-0000-2249-6711) profiles.

## What the application does

- **Liquidity heatmap:** live order-book depth over time for BTCUSDT, rendered with a custom colour scale.
- **Trade bubbles:** executed trades plotted by size on the heatmap.
- **Candles:** price candles aligned with the heatmap.
- **Live BTCUSDT data:** streamed from a public exchange feed.
- **Institutional ETF flow:** a panel tracking flows into Bitcoin ETFs of large institutions such as BlackRock.
- **Bitcoin news feed:** a live feed with headlines coloured green for positive and red for negative sentiment for BTC.

## Research design principles

1. **Public data only.** No private order-flow, account or identity data is used.
2. **No fabricated data.** A feed that is not connected should show as unavailable and not be filled with sample values.
3. **Calibrated claims.** Outputs are visualisations of observable patterns, not findings of fact.

## Limitations and responsible use

The heatmap shows displayed liquidity in public data only. It cannot show hidden orders, account identity or intent, and displayed liquidity can be placed or cancelled for many reasons. News sentiment colouring is an automated heuristic and may be wrong. ETF flow figures depend on third-party data and may be delayed or revised. Nothing in this application is proof of a market-abuse offence, nor legal, financial or investment advice.

## Ownership and permitted use

This repository and the live application are the exclusive intellectual property of Faizan Rehan and are not open source. No licence is granted to any other person. Use for machine-learning training or automated scraping is prohibited. Permission requests and research enquiries may be sent to faizan.tabassumrehan@gmail.com.

## How to cite

Rehan, F. (2026). *Fz Heatmap: a live BTCUSDT liquidity heatmap and order-flow research terminal* [Software]. https://github.com/tabassumrehanfaiz786-gif/Fz-heat-map
