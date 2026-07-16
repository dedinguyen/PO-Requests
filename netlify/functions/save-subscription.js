const { airtableList, airtableCreate, airtableUpdate } = require("./_airtable");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const { name, subscription } = JSON.parse(event.body);
    if (!name || !subscription) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "name and subscription are required" }),
      };
    }

    const existing = await airtableList(
      "Push Subscriptions",
      `?filterByFormula=LOWER({Name})="${name.toLowerCase().trim()}"`
    );

    const fields = { Name: name, Subscription: JSON.stringify(subscription) };

    if (existing.records && existing.records.length > 0) {
      await airtableUpdate("Push Subscriptions", existing.records[0].id, fields);
    } else {
      await airtableCreate("Push Subscriptions", fields);
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
