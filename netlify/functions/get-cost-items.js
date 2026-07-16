const { jobtreadQuery } = require("./_jobtread");

exports.handler = async (event) => {
  const jobId = event.queryStringParameters && event.queryStringParameters.jobId;
  if (!jobId) {
    return { statusCode: 400, body: JSON.stringify({ error: "jobId is required" }) };
  }

  try {
    const data = await jobtreadQuery({
      job: {
        $: { id: jobId },
        costItems: {
          // Master budget line items only - excludes items that live on a specific
          // vendor order/document (those nest under the master line, not this list).
          $: {
            size: 500,
            where: [["document", "id"], null],
            sortBy: [{ field: "name", order: "asc" }],
          },
          nodes: {
            id: {},
            name: {},
            cost: {},
            costCode: { name: {} },
          },
        },
      },
    });

    const lineItems = data.job.costItems.nodes.map((c) => ({
      id: c.id,
      name: c.name,
      costCode: c.costCode ? c.costCode.name : null,
      budget: c.cost,
    }));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineItems }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
