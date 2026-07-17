const { jobtreadQuery } = require("./_jobtread");

exports.handler = async (event) => {
  const jobId = event.queryStringParameters && event.queryStringParameters.jobId;
  if (!jobId) {
    return { statusCode: 400, body: JSON.stringify({ error: "jobId is required" }) };
  }

  try {
    let lineItems = [];
    let page = undefined;
    let safety = 0;

    // Paginate - a full build's budget can easily exceed JobTread's 100-per-request cap
    while (safety < 10) {
      safety++;
      const data = await jobtreadQuery({
        job: {
          $: { id: jobId },
          costItems: {
            // Master budget line items only - excludes items that live on a specific
            // vendor order/document (those nest under the master line, not this list).
            $: {
              size: 100,
              page,
              where: [["document", "id"], null],
              sortBy: [{ field: "name", order: "asc" }],
            },
            nodes: {
              id: {},
              name: {},
              cost: {},
              costCode: { name: {} },
              costType: { name: {} },
              hasFinalActualCost: {},
            },
            nextPage: {},
          },
        },
      });

      const nodes = data.job.costItems.nodes || [];
      // Skip line items marked complete/finalized in JobTread, and skip
      // Labor - those are clocked hours, not something that gets a PO.
      const openItems = nodes.filter(
        (c) => !c.hasFinalActualCost && (!c.costType || c.costType.name !== "Labor")
      );
      lineItems = lineItems.concat(
        openItems.map((c) => ({
          id: c.id,
          name: c.name,
          costCode: c.costCode ? c.costCode.name : null,
          budget: c.cost,
        }))
      );

      const next = data.job.costItems.nextPage;
      if (!next) break;
      page = next;
    }

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
