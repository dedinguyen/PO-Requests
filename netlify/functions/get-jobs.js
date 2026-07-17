const { jobtreadQuery, orgId } = require("./_jobtread");

exports.handler = async () => {
  try {
    let jobs = [];
    let page = undefined;
    let safety = 0;

    while (safety < 10) {
      safety++;
      const data = await jobtreadQuery({
        organization: {
          $: { id: orgId() },
          jobs: {
            $: {
              size: 100,
              page,
              where: ["closedOn", null],
              sortBy: [{ field: "name", order: "asc" }],
            },
            nodes: { id: {}, name: {}, number: {} },
            nextPage: {},
          },
        },
      });

      const nodes = data.organization.jobs.nodes || [];
      jobs = jobs.concat(
        nodes.map((j) => ({
          id: j.id,
          name: j.number ? `${j.name} (#${j.number})` : j.name,
        }))
      );

      const next = data.organization.jobs.nextPage;
      if (!next) break;
      page = next;
    }

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
