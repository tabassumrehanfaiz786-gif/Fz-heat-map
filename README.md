# Fz Heatmap & Newsflow

**An empirical market microstructure, liquidity surveillance, and regulatory research platform for Bitcoin spot markets, institutional ETF capital flows, and cross-venue price discovery.**

**© 2026 Faizan Rehan. All rights reserved. Proprietary; see [LICENSE](./LICENSE).**

**Live application:** https://fz-heatmap-news-flow.lovable.app

**Author and lead researcher:** Faizan Rehan, Advocate and Independent Legal & Financial Markets Researcher  
Contact: [faizan.tabassumrehan@gmail.com](mailto:faizan.tabassumrehan@gmail.com)  
[ORCID 0009-0000-2249-6711](https://orcid.org/0009-0000-2249-6711) · SSRN Author ID 13164428

---

## Purpose

Resting liquidity in the order book is central to questions regarding spoofing, layering, and market integrity, yet it is rarely visible in a form that can be systematically examined. **Fz Heatmap & Newsflow** renders live BTCUSDT order-book depth as a time-based heatmap, overlaid with executed trade bubbles, multi-timeframe price candles, cross-venue best quotes, and institutional ETF net capital flows.

It is designed as an empirical research and analytical testbed for studying market abuse, liquidity fragmentation, and information asymmetry—bridging algorithmic trading mechanics with statutory financial regulation.

---

## Research Context

This project supports the author's academic and regulatory research on crypto-asset market microstructure, digital asset custody, and financial market regulation:

- **Invisible Market Power in Crypto-Asset Markets** (working paper, SSRN, October 2026): [SSRN Abstract 7656978](https://papers.ssrn.com/abstract=7656978)

All research papers and preprints are indexed on the author's [SSRN](https://papers.ssrn.com/) and [ORCID](https://orcid.org/0009-0000-2249-6711) profiles.

---

## Core Analytical Modules

1. **Order-Book Liquidity Heatmap & Tape:** Live BTCUSDT resting depth streamed from public exchange feeds with customizable timeframes (10m, 15m, 30m, 1M, 3M) and passive order wall tracking.
2. **Candles + Institutional Flow Overlay:** Interactive multi-timeframe candlestick chart overlaid with daily net inflow/outflow markers (±$50M, ±$100M, ±$300M) for major issuers (BlackRock, Fidelity, Grayscale).
3. **Flow & Sentiment Divergence Engine:** 30-day timeline comparing institutional ETF net flows against live Bitcoin headlines, computing forward BTC return resolutions when capital flows conflict with narrative sentiment.
4. **Algorithmic Surveillance Engine (Algo Tab):** Heuristic detection of potential spoofing/layering candidates, disappearing liquidity walls, iceberg order refills, and regular TWAP execution bursts.
5. **Cross-Venue Synthetic Tape (NBBO Tab):** Consolidated top-of-book best bid and offer across Binance, Coinbase, OKX, and Kraken, highlighting cross-venue spread dispersion and locked/crossed markets.
6. **Intraday iNAV & AP Arbitrage:** Real-time tracking of synthetic intraday net asset value (iNAV), market price premium/discount, and Authorized Participant (AP) creation/redemption signals across 10 spot Bitcoin ETFs.
7. **Statutory Methodology Framework (Research Tab):** Direct mapping of technical signals to UK Market Abuse Regulation (UK MAR Art. 12 & 16), FCA Best Execution standards (COBS 11.2A), and MiFIR transparency guidelines.

---

## Statutory & Regulatory Scope

The platform formulates empirical questions under leading UK and international financial law frameworks:

- **UK MAR Article 12 (Market Manipulation):** Investigating whether observable order cancellations and depth refills meet legal thresholds for misleading market signals or artificial price positioning.
- **UK MAR Article 16 (Surveillance Systems):** Evaluating the minimum technical standards required for market operators and algorithmic trading firms to prevent and detect abusive behaviour.
- **FCA COBS 11.2A & MiFIR Consolidated Tape:** Examining cross-venue execution fragmentation between dollar and stablecoin venues where no statutory consolidated tape exists.
- **Evidentiary Boundaries:** Documenting why public Level-2 (L2) market data cannot establish subjective trading intent (*mens rea*) without Level-3 (L3) market-by-order audit trails and regulatory transaction reports (STORs).

---

## Research Design Principles

1. **Public Data Exclusivity:** Constructed strictly with public exchange feeds, transparent RSS news endpoints, and public ETF disclosure records.
2. **Data Honesty & No Fabrication:** Disconnected feeds, missing provider dates, or unverified on-chain records are explicitly labeled as missing rather than filled with synthetic defaults.
3. **Calibrated Regulatory Claims:** Technical detections are documented as empirical indicators and heuristics, not legal findings of fact or proof of statutory breach.

---

## Limitations and Responsible Use

This platform displays public market data only. It does not possess private account identifiers, execution flags, or trader identities. Order cancellations and quote adjustments can arise from legitimate hedging, risk mitigation, or liquidity provision algorithms. Sentiment scoring is an automated natural language heuristic. Nothing in this application constitutes legal, financial, regulatory, or investment advice.

---

## Ownership and Permitted Use

This repository and the live application are the exclusive intellectual property of Faizan Rehan. All rights reserved. No licence is granted for commercial redistribution, machine-learning model training, or automated scraping without written consent. Research enquiries may be directed to [faizan.tabassumrehan@gmail.com](mailto:faizan.tabassumrehan@gmail.com).

---

## How to Cite

```bibtex
@software{rehan2026fznewsflow,
  author = {Rehan, Faizan},
  title = {Fz Heatmap & Newsflow: An Empirical BTC Market Microstructure and Regulatory Surveillance Platform},
  year = {2026},
  url = {https://fz-heatmap-news-flow.lovable.app},
  publisher = {GitHub},
  journal = {GitHub repository},
  howpublished = {\url{https://github.com/tabassumrehanfaiz786-gif/Fz-heat-map}}
}

 