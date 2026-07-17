const { jobtreadQuery, orgId } = require("./_jobtread");

// Only show jobs at these stages of the "Job Status" custom field in JobTread.
// (Excludes things like Appointment Set, Estimate Sent, Job Complete, Job Closed, Warranty Work.)
const ALLOWED_STATUSES = [
  "Engineering",
  "Land Development / Permitting",
  "Design Plans",
  "Sold (But not Scheduled)",
  "Pre-Con",
  "Active",
  "Danielle",
];

exports.handler = async () => {
  try {
    let jobs = [];
    let page = undefined;
    let safety = 0;

    while (safety < 15) {
      safety++;
      const data = await jobtreadQuery({
        organization: {
          $: { id: orgId() },
          jobs: {
            $: {
              size: 100,
              page,
              sortBy: [{ field: "name", order: "asc" }],
            },
            nodes: {
              id: {},
              name: {},
              number: {},
              customFieldValues: {
                $: { size: 20, where: [["customField", "name"], "Job Status"] },
                nodes: { value: {} },
              },
            },
            nextPage: {},
          },
        },
      });

      const nodes = data.organization.jobs.nodes || [];
      const filtered = nodes.filter((j) => {
        const values = (j.customFieldValues.nodes || []).map((v) => v.value);
        return values.some((v) => ALLOWED_STATUSES.includes(v));
      });

      jobs = jobs.concat(
        filtered.map((j) => ({
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
