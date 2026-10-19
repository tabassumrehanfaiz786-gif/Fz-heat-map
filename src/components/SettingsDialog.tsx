import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { setSettings, useSettings, type EtfProvider } from "@/lib/settings";
import { getEtfFlows } from "@/lib/etf.functions";
import { Button } from "@/components/ui/button";
import { ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";
import { issuerConnectionStatus } from "@/lib/coinglass-data";

const PROVIDERS: { id: EtfProvider; name: string; secret: string; where: string }[] = [
  { id: "coinglass", name: "CoinGlass", secret: "COINGLASS_API_KEY", where: "coinglass.com → API → your plan's API key" },
  { id: "sosovalue", name: "SoSoValue", secret: "SOSOVALUE_API_KEY", where: "sosovalue.com → Developer → API key" },
];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <Label className="text-sm text-foreground">{label}</Label>
      {children}
    </div>
  );
}

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const s = useSettings();
  const queryClient = useQueryClient();
  const [checked, setChecked] = useState<{ provider: string; at: number } | null>(null);
  const status = useQuery({ queryKey: ["etf", s.etfProvider], queryFn: () => getEtfFlows({ data: { provider: s.etfProvider } }), enabled: open });
  const p = PROVIDERS.find((x) => x.id === s.etfProvider) ?? PROVIDERS[0];
  const connection = issuerConnectionStatus(status.data);
  const testConnection = async () => {
    const result = await status.refetch();
    setChecked({ provider: s.etfProvider, at: Date.now() });
    if (issuerConnectionStatus(result.data) === "connected") {
      await queryClient.invalidateQueries({ queryKey: ["etf-hist", s.etfProvider] });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Fz Heatmap settings</DialogTitle>
          <DialogDescription>Data providers, big-order alerts and wall detection.</DialogDescription>
        </DialogHeader>

        <section className="space-y-2">
          <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">ETF flow data provider</h3>
          <div className="flex gap-2">
            {PROVIDERS.map((x) => (
              <button key={x.id} className={`btn-chip ${s.etfProvider === x.id ? "btn-chip-active" : ""}`} onClick={() => setSettings({ etfProvider: x.id })}>{x.name}</button>
            ))}
          </div>
          <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
            Status:{" "}
            {status.isFetching ? "Testing saved key…" : connection === "connected" ? (
              <span className="text-bull">Live issuer flows connected · {status.data?.rows.length} issuers{status.data?.date ? ` · latest flow ${status.data.date}` : ""}</span>
            ) : connection === "missing-key" ? <span className="text-bear">No saved API key found · live issuer flows not connected</span>
              : connection === "no-issuer-data" ? <span className="text-bear">Key configured, but no live issuer flows returned</span>
              : <span className="text-bear">Live issuer flows not connected · {status.data?.error ?? "Unable to check connection. Try again."}</span>}
          </p>
          {checked?.provider === s.etfProvider && <p className="text-xs text-muted-foreground">Last tested: {new Date(checked.at).toLocaleString()}</p>}
          <p className="text-xs text-muted-foreground">Get your key at {p?.where}. Save it as {p?.secret} in Lovable Cloud secrets. Only project editors can change it; visitors cannot view or overwrite it.</p>
          <p className="text-xs text-muted-foreground">On-chain vault tracking (Vaults tab) uses Arkham Intelligence. Save your key as ARKHAM_API_KEY the same way; without it the tab shows clearly-labelled sample transfers.</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline"><a href="https://lovable.dev/projects/5aa12fb1-55cb-4274-b4fe-ebe2e0e1095f?view=more&subview=cloud" target="_blank" rel="noreferrer"><ShieldCheck />Secure key settings<ExternalLink /></a></Button>
            <Button size="sm" variant="outline" disabled={status.isFetching} onClick={testConnection}><RefreshCw className={status.isFetching ? "animate-spin" : ""} />{status.isFetching ? "Testing…" : "Test saved API key"}</Button>
          </div>
        </section>

        <section className="space-y-1 border-t border-border pt-3">
          <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Big bubble alerts</h3>
          <Row label="Alerts on"><Switch checked={s.alertsOn} onCheckedChange={(v) => setSettings({ alertsOn: v })} /></Row>
          <Row label="Large buys"><Switch checked={s.alertBuy} onCheckedChange={(v) => setSettings({ alertBuy: v })} /></Row>
          <Row label="Large sells"><Switch checked={s.alertSell} onCheckedChange={(v) => setSettings({ alertSell: v })} /></Row>
          <Row label="Minimum size (BTC per second)">
            <Input type="number" min={0.5} step={0.5} className="w-24" value={s.alertMinBtc} onChange={(e) => setSettings({ alertMinBtc: Math.max(0.5, Number(e.target.value) || 0.5) })} />
          </Row>
          <Row label="Sound"><Switch checked={s.alertSound} onCheckedChange={(v) => setSettings({ alertSound: v })} /></Row>
          <Row label="Desktop notifications">
            <Switch
              checked={s.alertNotify}
              onCheckedChange={async (v) => {
                if (v && "Notification" in window && Notification.permission !== "granted") {
                  const r = await Notification.requestPermission();
                  if (r !== "granted") return;
                }
                setSettings({ alertNotify: v });
              }}
            />
          </Row>
        </section>

        <section className="space-y-1 border-t border-border pt-3">
          <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Passive order walls</h3>
          <Row label="Show red line when a resting order is at least (BTC)">
            <Input type="number" min={1} step={5} className="w-24" value={s.wallMinBtc} onChange={(e) => setSettings({ wallMinBtc: Math.max(1, Number(e.target.value) || 1) })} />
          </Row>
        </section>
      </DialogContent>
    </Dialog>
  );
}
