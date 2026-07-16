const { jobtreadQuery, orgId } = require("./_jobtread");

exports.handler = async () => {
  try {
    const data = await jobtreadQuery({
      organization: {
        $: { id: orgId() },
        jobs: {
          $: {
            size: 200,
            where: ["closedOn", null],
            sortBy: [{ field: "name", order: "asc" }],
          },
          nodes: { id: {}, name: {}, number: {} },
        },
      },
    });

    const jobs = data.organization.jobs.nodes.map((j) => ({
      id: j.id,
      name: j.number ? `${j.name} (#${j.number})` : j.name,
    }));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobs }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
