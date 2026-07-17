const { airtableUpdate, airtableList } = require("./_airtable");
const { notifyByName } = require("./_notify");

const APPROVERS = ["danielle", "chris", "dedi"];

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const body = JSON.parse(event.body);
    const { recordId, action, actorName, poNumber, note } = body;

    if (!recordId || !action || !actorName) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "recordId, action, and actorName are required" }),
      };
    }

    // Approve / Needs Info / Reject are restricted to the three named approvers.
    // Entering a PO number is left open since it's just admin data entry once approved.
    if (["approve", "needs_info", "reject"].includes(action)) {
      if (!APPROVERS.includes(actorName.toLowerCase().trim())) {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: "Only Danielle, Chris, or Dedi can approve requests" }),
        };
      }
    }

    const fields = {};
    let notifyTitle = "";
    let notifyBody = "";

    if (action === "approve") {
      fields.Status = "Approved";
      fields["Approved By"] = actorName;
      fields["Approved At"] = new Date().toISOString();
      notifyTitle = "PO approved";
      notifyBody = "Your PO is approved, stand by for your PO number to be assigned.";
    } else if (action === "needs_info") {
      fields.Status = "Needs Info";
      fields.Notes = note || "";
      notifyTitle = "PO needs more info";
      notifyBody = note || "Check the app - your PO request needs more detail.";
    } else if (action === "reject") {
      fields.Status = "Rejected";
      fields.Notes = note || "";
      notifyTitle = "PO rejected";
      notifyBody = note || "Your PO request was rejected. Check the app for details.";
    } else if (action === "assign_po") {
      if (!poNumber) {
        return { statusCode: 400, body: JSON.stringify({ error: "poNumber is required" }) };
      }
      fields["PO Number"] = poNumber;
      fields.Status = "PO Assigned";
      notifyTitle = "PO number assigned";
      notifyBody = `PO #${poNumber} is set - good to go.`;
    } else {
      return { statusCode: 400, body: JSON.stringify({ error: "Unknown action" }) };
    }

    await airtableUpdate("PO Requests", recordId, fields);

    // Look up who requested it, so we can notify them directly
    const existing = await airtableList(
      "PO Requests",
      `?filterByFormula=RECORD_ID()="${recordId}"`
    );
    const requestedBy =
      existing.records && existing.records[0] && existing.records[0].fields["Requested By"];

    if (requestedBy) {
      await notifyByName([requestedBy], notifyTitle, notifyBody, "/");
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
