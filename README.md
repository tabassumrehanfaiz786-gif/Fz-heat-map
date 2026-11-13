# Fz Heatmap & Newsflow
### Empirical RegTech, Market Microstructure & Market Abuse Surveillance Platform

**Live Research Platform:** [https://fz-heatmap-news-flow.lovable.app](https://fz-heatmap-news-flow.lovable.app)  
**Author:** Faizan Rehan (Advocate and Independent Legal & Financial Markets Researcher)  
**Contact:** [faizanrehan.law@gmail.com](mailto:faizan.tabassumrehan@gmail.com) *(or your preferred Gmail)*  
**Primary Working Paper (SSRN):** [The Hierarchy of Liquidity Magnets (SSRN 7572258)](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=7572258)  
**Research Focus:** UK Financial Regulation, UK MAR (Regulation (EU) 596/2014), Limit Order Book Microstructure & RegTech Surveillance

---

## 1. Project Overview & Empirical Sandbox

**Fz Heatmap & Newsflow** is an independent empirical research sandbox and RegTech surveillance platform designed to evaluate market abuse typologies, order-book liquidity dynamics, cross-venue fragmentation, and information flow divergence in digital asset markets.

Under modern supervisory regimes such as the **UK Market Abuse Regulation (UK MAR - Regulation (EU) 596/2014 onshored via the European Union (Withdrawal) Act 2018)** and **FCA Handbook standards (COBS 11.2A, MAR 1, and SUP 15)**, investment firms and trading venues face statutory mandates to detect and report suspicious orders and transactions (STORs). This platform serves as the open-source empirical implementation evaluating the hypotheses formulated in the author's SSRN research papers.

---

## 2. Accompanying Working Papers (SSRN)

If evaluating this platform in academic, legal, or regulatory contexts, please refer to the author's accompanying working papers on SSRN:

1. **Primary Microstructure Paper:**  
   **Rehan, Faizan**, *The Hierarchy of Liquidity Magnets* (April 21, 2026). Available at SSRN: [https://papers.ssrn.com/sol3/papers.cfm?abstract_id=7572258](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=7572258).  
   *Focus:* Development of the Hierarchical Magnet Hypothesis (HMH), Price Liquidity Zones (Macro/Micro PLZs), order-flow imbalance, cancellation-to-execution ratios, and spoofing/layering heuristics.

2. **Order Dynamics Paper:**  
   **Rehan, Faizan**, *Liquidity Sweeps and Post-Sweep Acceptance in BTC* (October 3, 2026). Available at SSRN: [https://papers.ssrn.com/sol3/papers.cfm?abstract_id=7557779](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=7557779).  
   *Focus:* Falsifiable testing of resting-liquidity walls, sweep-and-acceptance dynamics, and treating resting liquidity as withdrawable/spoofable rather than subjective intent.

3. **Cross-Venue Fragmentation & Arbitrage Paper:**  
   **Rehan, Faizan**, *Global Crypto-Asset Markets and the Future of Borderless Trading: Regulatory Fragmentation, Arbitrage, and the Case for Interoperability* (2026). Available at SSRN: [https://doi.org/10.2139/ssrn.7505718](https://doi.org/10.2139/ssrn.7505718).  
   *Focus:* Cross-venue regulatory arbitrage and liquidity fragmentation across global venues.

---

## 3. Core Platform Surveillance Modules

| Module | Microstructure & Surveillance Function | Regulatory / Statutory Mapping | SSRN Paper Reference |
| :--- | :--- | :--- | :--- |
| **Order Book Heatmap & Large Wall Tracker** | Real-time visual tracking of resting limit-order depth (0–100k BTC filter), passive wall appearances, and cancellations. | Heuristic detection of potential **Spoofing & Layering** under UK MAR Article 12(1)(a) / 12(2)(a). | *The Hierarchy of Liquidity Magnets* (PLZ framework) |
| **Algo & Pattern Surveillance** | Automated tracking of iceberg order replenishment and TWAP/VWAP algorithmic execution patterns. | Algorithmic trading risk controls & surveillance obligations under **UK MAR Article 16(2)**. | *The Hierarchy of Liquidity Magnets* (Iceberg taxonomy) |
| **Synthetic Cross-Venue NBBO** | Consolidated National Best Bid and Offer across Binance, Coinbase, OKX, and Kraken to detect price dispersion and crossed books. | Best-execution audit requirements under **FCA COBS 11.2A** and **MiFIR Article 27**. | *Global Crypto-Asset Markets & Regulatory Fragmentation* |
| **Intraday ETF iNAV & AP Monitor** | Theoretical intraday net asset value estimation and arbitrage premium/discount tracking across top spot Bitcoin ETFs. | Regulatory creation/redemption stability analysis under **SEC Rule 6c-11** / UCITS arbitrage principles. | Cross-venue arbitrage and liquidity fragmentation |
| **Flows 30D & News Divergence** | Historical comparison between 30-day institutional ETF net flows and sentiment-classified market headlines. | Information asymmetry and price-formation dynamics; testing market reaction against disclosed institutional flow. | Information asymmetry and price migration |
| **Event Study Engine** | Empirical forward-return framework measuring $T+1$, $T+3$, and $T+7$ price performance following large institutional flow days ($>\$100\text{M}$). | Quantitative event study methodology evaluating institutional capital shocks. | Event study validation protocol |
| **Research & Legal Methodology** | In-app statutory documentation, legal problem statements, and evidentiary disclosures for admissions reviewers. | Direct alignment with UK LL.M. / MSc postgraduate research standards. | *Methodological and submission-readiness review* |

---

## 4. Evidentiary Boundary & Regulatory Limitations

A foundational contribution of this research sandbox is establishing the **evidentiary gap** between publicly observable market data and statutory legal findings:

1. **Absence of Subjective Intent (*Mens Rea*):** Public Level-2 order book feeds and heuristic indicators (e.g., cancelled order walls) cannot distinguish between unlawful spoofing and legitimate algorithmic market-making or dynamic risk management.
2. **Attribution Deficit:** Public exchange APIs do not identify the legal entity, beneficial owner, or prime broker executing trades.
3. **Requirement for Level-3 Audit Trails:** Formal regulatory enforcement under UK MAR Article 16 relies on non-public supervisory powers, exchange member logs, and Suspicious Transaction and Order Reports (STORs).

---

## 5. License

This repository and its empirical methodology documentation are licensed under the **MIT License** for academic, non-commercial research and educational review.

