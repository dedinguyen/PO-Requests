const { airtableList } = require("./_airtable");

exports.handler = async () => {
  try {
    const data = await airtableList(
      "PO Requests",
      "?sort%5B0%5D%5Bfield%5D=Created&sort%5B0%5D%5Bdirection%5D=asc&pageSize=100"
    );

    const records = (data.records || []).map((r) => ({
      id: r.id,
      ...r.fields,
    }));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        records,
        _debug: {
          baseIdUsed: (process.env.AIRTABLE_BASE_ID || "MISSING").slice(0, 6) + "...",
          apiKeyPrefix: (process.env.AIRTABLE_API_KEY || "MISSING").slice(0, 8) + "...",
          recordCountFromAirtable: (data.records || []).length,
        },
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

