const { airtableList } = require("./_airtable");

exports.handler = async () => {
  try {
    // Plain query with no sort/filter - rules out a bad sort field silently
    // filtering things out.
    const data = await airtableList("PO Requests", "?pageSize=100");

    const records = (data.records || []).map((r) => ({
      id: r.id,
      ...r.fields,
    }));

    // Also ask Airtable's metadata API what tables this token can actually
    // see in this base - helps catch a table name mismatch (typo, extra
    // space, different capitalization) that wouldn't otherwise show up.
    let tableNames = [];
    let metaError = null;
    try {
      const metaRes = await fetch(
        `https://api.airtable.com/v0/meta/bases/${process.env.AIRTABLE_BASE_ID}/tables`,
        { headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` } }
      );
      const metaData = await metaRes.json();
      if (metaData.tables) {
        tableNames = metaData.tables.map((t) => ({ name: t.name, id: t.id }));
      } else {
        metaError = metaData;
      }
    } catch (e) {
      metaError = e.message;
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        records,
        _debug: {
          baseIdUsed: (process.env.AIRTABLE_BASE_ID || "MISSING").slice(0, 6) + "...",
          apiKeyPrefix: (process.env.AIRTABLE_API_KEY || "MISSING").slice(0, 8) + "...",
          recordCountFromAirtable: (data.records || []).length,
          tablesVisibleToThisToken: tableNames,
          metaError,
        },
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};


