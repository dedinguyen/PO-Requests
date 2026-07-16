const { jobtreadQuery } = require("./_jobtread");

// Applies Dee Dee's established spent-to-date methodology:
// total spent = committed cost (approved + pending vendor orders) + time cost.
// Pending POs count as already spent. Vendor bills are ignored (not used at CLC).
exports.handler = async (event) => {
  const { costItemId, amount } = event.queryStringParameters || {};
  if (!costItemId || amount === undefined) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "costItemId and amount are required" }),
    };
  }

  try {
    const data = await jobtreadQuery({
      costItem: {
        $: { id: costItemId },
        cost: {},
        name: {},
        committed: {
          _: "documentCostItems",
          $: {
            where: {
              and: [
                [["document", "type"], "vendorOrder"],
                [["document", "status"], "in", ["approved", "pending"]],
              ],
            },
          },
          sum: { $: "cost" },
        },
        timeCost: {
          _: "timeEntries",
          sum: { $: "cost" },
        },
      },
    });

    const budget = data.costItem.cost || 0;
    const committed = (data.costItem.committed && data.costItem.committed.sum) || 0;
    const timeCost = (data.costItem.timeCost && data.costItem.timeCost.sum) || 0;
    const spentToDate = committed + timeCost;
    const requested = parseFloat(amount);
    const remaining = budget - spentToDate;
    const inBudget = requested <= remaining;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lineItemName: data.costItem.name,
        budget,
        spentToDate,
        remaining,
        requested,
        inBudget,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
