// Shared helper for talking to Airtable.
// Requires env vars: AIRTABLE_API_KEY, AIRTABLE_BASE_ID

const BASE_URL = "https://api.airtable.com/v0";

function authHeaders() {
  const key = process.env.AIRTABLE_API_KEY;
  if (!key) throw new Error("Missing AIRTABLE_API_KEY environment variable");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

function baseId() {
  const id = process.env.AIRTABLE_BASE_ID;
  if (!id) throw new Error("Missing AIRTABLE_BASE_ID environment variable");
  return id;
}

async function airtableCreate(table, fields) {
  const res = await fetch(`${BASE_URL}/${baseId()}/${encodeURIComponent(table)}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ fields, typecast: true }),
  });
  const data = await res.json();
  if (data.error) throw new Error("Airtable create error: " + JSON.stringify(data.error));
  return data;
}

async function airtableUpdate(table, recordId, fields) {
  const res = await fetch(`${BASE_URL}/${baseId()}/${encodeURIComponent(table)}/${recordId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ fields, typecast: true }),
  });
  const data = await res.json();
  if (data.error) throw new Error("Airtable update error: " + JSON.stringify(data.error));
  return data;
}

async function airtableList(table, params = "") {
  const res = await fetch(`${BASE_URL}/${baseId()}/${encodeURIComponent(table)}${params}`, {
    headers: authHeaders(),
  });
  const data = await res.json();
  if (data.error) throw new Error("Airtable list error: " + JSON.stringify(data.error));
  return data;
}

module.exports = { airtableCreate, airtableUpdate, airtableList };
