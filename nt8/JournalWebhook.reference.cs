// =============================================================================
// NT8 → Journal webhook — reference snippet for MADSnowball.cs
// =============================================================================
// This is NOT a standalone file. Paste these pieces into the existing
// MADSnowball strategy at:
//   E:\Documents\NinjaTrader 8\bin\Custom\Strategies\TradeSaberStrategies\MADSnowball.cs
//
// Posts each completed trade to the Vercel endpoint when the position goes flat.
// Fire-and-forget on a background task so OnPositionUpdate never blocks.
// =============================================================================

// --- 1. Add these usings at the top of the file (if not already present) ---
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using System.Globalization;

// --- 2. A shared HttpClient (one per strategy instance). Put with other fields. ---
private static readonly HttpClient journalHttp = new HttpClient();

// --- 3. Strategy properties — appear in the NT8 strategy parameters panel ---
//        so the URL and secret are configurable without recompiling.
[NinjaScriptProperty]
[Display(Name = "Journal Webhook URL", Order = 1, GroupName = "12. Journal Sync")]
public string JournalWebhookUrl { get; set; } = "https://your-journal.vercel.app/api/trades";

[NinjaScriptProperty]
[Display(Name = "Journal Webhook Secret", Order = 2, GroupName = "12. Journal Sync")]
public string JournalWebhookSecret { get; set; } = "";

[NinjaScriptProperty]
[Display(Name = "Journal Sync Enabled", Order = 3, GroupName = "12. Journal Sync")]
public bool JournalSyncEnabled { get; set; } = true;

// --- 4. In OnPositionUpdate, when the position becomes flat, post the trade. ---
//        Add this inside the existing OnPositionUpdate (or add the override).
protected override void OnPositionUpdate(Position position, double averagePrice,
                                         int quantity, MarketPosition marketPosition)
{
    // ... keep any existing OnPositionUpdate logic above this ...

    if (!JournalSyncEnabled) return;
    // Only real fills — never replay history bootstrapping or backtests.
    if (State != State.Realtime && State != State.Playback) return;
    // Fire only on the transition to flat (a closed round-trip trade).
    if (marketPosition != MarketPosition.Flat) return;
    if (SystemPerformance.AllTrades.Count == 0) return;

    PostLastTradeToJournal();
}

// --- 5. Helper: read the last completed trade and POST it. ---
private void PostLastTradeToJournal()
{
    try
    {
        var t = SystemPerformance.AllTrades[SystemPerformance.AllTrades.Count - 1];
        string side = t.Entry.MarketPosition == MarketPosition.Long ? "long" : "short";

        // ISO-8601 UTC so the journal parses times unambiguously.
        string entryIso = t.Entry.Time.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ", CultureInfo.InvariantCulture);
        string exitIso  = t.Exit.Time.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ", CultureInfo.InvariantCulture);

        // Hand-built JSON to avoid pulling in a serializer dependency.
        string json = "{"
            + "\"instrument\":\"" + Escape(Instrument.FullName) + "\","
            + "\"side\":\"" + side + "\","
            + "\"qty\":" + t.Quantity.ToString(CultureInfo.InvariantCulture) + ","
            + "\"entryPrice\":" + t.Entry.Price.ToString(CultureInfo.InvariantCulture) + ","
            + "\"exitPrice\":" + t.Exit.Price.ToString(CultureInfo.InvariantCulture) + ","
            + "\"entryTime\":\"" + entryIso + "\","
            + "\"exitTime\":\"" + exitIso + "\","
            + "\"profit\":" + t.ProfitCurrency.ToString(CultureInfo.InvariantCulture) + ","
            + "\"commission\":" + t.Commission.ToString(CultureInfo.InvariantCulture) + ","
            + "\"strategyName\":\"MADSnowball\","
            + "\"account\":\"" + Escape(Account != null ? Account.Name : "") + "\""
            + "}";

        string url = JournalWebhookUrl;
        string secret = JournalWebhookSecret;

        // Fire and forget — do not block the trading thread on network I/O.
        Task.Run(async () =>
        {
            try
            {
                using (var req = new HttpRequestMessage(HttpMethod.Post, url))
                {
                    req.Headers.Add("X-NT8-Secret", secret);
                    req.Content = new StringContent(json, Encoding.UTF8, "application/json");
                    var resp = await journalHttp.SendAsync(req);
                    if (!resp.IsSuccessStatusCode)
                        Print("[JournalSync] POST failed: " + (int)resp.StatusCode + " " + resp.ReasonPhrase);
                }
            }
            catch (Exception ex)
            {
                Print("[JournalSync] error: " + ex.Message);
            }
        });
    }
    catch (Exception ex)
    {
        Print("[JournalSync] build error: " + ex.Message);
    }
}

// --- 6. Minimal JSON string escaper for instrument/account names. ---
private static string Escape(string s)
{
    if (string.IsNullOrEmpty(s)) return "";
    return s.Replace("\\", "\\\\").Replace("\"", "\\\"");
}
