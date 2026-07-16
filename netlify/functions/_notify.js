// Shared helper for sending push notifications.
// Requires env vars: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
const webpush = require("web-push");
const { airtableList } = require("./_airtable");

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(
    "mailto:ops@clccontractors.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  configured = true;
}

// Sends a notification to every stored subscription matching one of the given names.
// names: array of strings (case-insensitive match against the "Name" field)
async function notifyByName(names, title, body, url) {
  configure();
  const lowerNames = names.map((n) => n.toLowerCase().trim());

  const data = await airtableList(
    "Push Subscriptions",
    `?filterByFormula=OR(${lowerNames
      .map((n) => `LOWER({Name})="${n}"`)
      .join(",")})`
  );

  const records = data.records || [];
  const payload = JSON.stringify({ title, body, url: url || "/" });

  await Promise.all(
    records.map(async (record) => {
      const sub = record.fields.Subscription;
      if (!sub) return;
      try {
        const parsed = JSON.parse(sub);
        await webpush.sendNotification(parsed, payload);
      } catch (err) {
        // Subscription likely expired/invalid - ignore, don't fail the whole request
        console.error("Push failed for", record.fields.Name, err.message);
      }
    })
  );
}

module.exports = { notifyByName };
