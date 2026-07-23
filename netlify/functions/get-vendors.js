const { jobtreadQuery, orgId } = require("./_jobtread");

exports.handler = async () => {
  try {
    let vendors = [];
    let page = undefined;
    let safety = 0;

    while (safety < 15) {
      safety++;
      const data = await jobtreadQuery({
        organization: {
          $: { id: orgId() },
          accounts: {
            $: {
              size: 100,
              page,
              where: ["type", "vendor"],
              sortBy: [{ field: "name", order: "asc" }],
            },
            nodes: { id: {}, name: {} },
            nextPage: {},
          },
        },
      });

      const nodes = data.organization.accounts.nodes || [];
      vendors = vendors.concat(nodes.map((v) => ({ id: v.id, name: v.name })));

      const next = data.organization.accounts.nextPage;
      if (!next) break;
      page = next;
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendors }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
