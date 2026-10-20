<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep historical Bitcoin news separate from the capped live feed; fetch date-windowed RSS in a server-only helper and normalize dated headlines in a shared pure module so timeline history does not slow the first screen.
- Manage the shared ETF provider key through editor-only Lovable Cloud secrets, never through a public in-app write endpoint; validate CoinGlass responses in one pure parser used by both ETF views to keep units and missing values consistent.
- Fetch no-key Bitcoin monitoring through cached server-only public-data helpers and pure validated parsers; recent unlabelled output totals must never enter issuer-net-flow AI analysis because attribution and directional history are unavailable.
