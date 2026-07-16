// Shared helper for talking to JobTread's Pave API.
// Requires env vars: JOBTREAD_GRANT_KEY, JOBTREAD_ORG_ID

async function jobtreadQuery(queryBody) {
  const grantKey = process.env.JOBTREAD_GRANT_KEY;
  if (!grantKey) {
    throw new Error("Missing JOBTREAD_GRANT_KEY environment variable");
  }

  const res = await fetch("https://api.jobtread.com/pave", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: {
        $: { grantKey },
        ...queryBody,
      },
    }),
  });

  const data = await res.json();

  if (data.errors) {
    throw new Error(
      "JobTread API error: " + JSON.stringify(data.errors)
    );
  }

  return data;
}

function orgId() {
  const id = process.env.JOBTREAD_ORG_ID;
  if (!id) {
    throw new Error("Missing JOBTREAD_ORG_ID environment variable");
  }
  return id;
}

module.exports = { jobtreadQuery, orgId };
