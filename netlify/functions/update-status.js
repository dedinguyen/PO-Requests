const { jobtreadQuery } = require("./_jobtread");
const { airtableUpdate, airtableList } = require("./_airtable");
const { notifyByName } = require("./_notify");

const APPROVERS = ["danielle", "chris", "dedi"];

// Attempts to create a real vendor order (PO) in JobTread and immediately
// mark it approved. Returns the auto-assigned PO number on success, or null
// if anything about it couldn't be completed - callers should fall back to
// the old manual "type in the PO#" flow rather than fail the approval itself.
async function tryCreatePOInJobTread(record) {
  const f = record.fields;
  const jobId = f["Job ID"];
  const costItemId = f["Cost Item ID"];
  const vendorId = f["Vendor ID"];
  const amount = f.Amount;
  const vendorName = f.Vendor;
  const lineItemName = f["Budget Line Item"];

  if (!jobId || !costItemId || !vendorId || !amount) {
    return { number: null, error: "Missing job/line item/vendor ID needed to auto-create the PO" };
  }

  try {
    const createResult = await jobtreadQuery({
      createDocument: {
        $: {
          jobId,
          type: "vendorOrder",
          accountId: vendorId,
          name: "Purchase Order",
          fromName: "CLC Contractors",
          toName: vendorName,
          toOrganizationName: vendorName,
          taxRate: 0,
          jobLocationName: f["Job Name"] || "Jobsite",
          dueDays: 30,
          lineItems: [
            {
              _type: "costItem",
              jobCostItemId: costItemId,
              name: lineItemName,
              quantity: 1,
              unitCost: amount,
            },
          ],
        },
        createdDocument: { id: {} },
      },
    });

    const docId =
      createResult.createDocument &&
      createResult.createDocument.createdDocument &&
      createResult.createDocument.createdDocument.id;

    if (!docId) {
      return { number: null, error: "JobTread did not return a created document id" };
    }

    await jobtreadQuery({
      updateDocument: {
        $: { id: docId, status: "approved" },
      },
    });

    const readBack = await jobtreadQuery({
      document: { $: { id: docId }, number: {} },
    });

    return { number: readBack.document ? readBack.document.number : null, error: null };
  } catch (err) {
    return { number: null, error: err.message };
  }
}

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

    // Look the record up up front - needed both for the auto-PO-creation
    // fields on approve, and to know who to notify afterward either way.
    const existing = await airtableList(
      "PO Requests",
      `?filterByFormula=RECORD_ID()="${recordId}"`
    );
    const record = existing.records && existing.records[0];
    if (!record) {
      return { statusCode: 404, body: JSON.stringify({ error: "Request not found" }) };
    }
    const requestedBy = record.fields["Requested By"];

    const fields = {};
    let notifyTitle = "";
    let notifyBody = "";

    if (action === "approve") {
      const poResult = await tryCreatePOInJobTread(record);

      if (poResult.number) {
        // Auto-creation succeeded - skip the "Approved, awaiting PO#" stage
        // entirely and go straight to done.
        fields.Status = "PO Assigned";
        fields["PO Number"] = String(poResult.number);
        fields["Approved By"] = actorName;
        fields["Approved At"] = new Date().toISOString();
        notifyTitle = "PO approved";
        notifyBody = `Your PO is approved - PO #${poResult.number} was created automatically.`;
      } else {
        // Auto-creation didn't go through for some reason - fall back to the
        // old manual flow so the request isn't stuck. Note the failure
        // reason on the record itself so it's visible in Airtable.
        fields.Status = "Approved";
        fields["Approved By"] = actorName;
        fields["Approved At"] = new Date().toISOString();
        fields.Notes = `${record.fields.Notes || ""}\n[Auto-PO creation skipped: ${poResult.error}]`.trim();
        notifyTitle = "PO approved";
        notifyBody = "Your PO is approved, stand by for your PO number to be assigned.";
      }
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

    await airtableUpdate("PO Requests", recordId, {
      ...fields,
      "Status Updated At": new Date().toISOString(),
    });

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
