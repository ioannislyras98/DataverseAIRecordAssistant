import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const sourceUrl = new URL(
  "../../src/DataverseAIRecordAssistant.WebResources/queueAnalysis.js",
  import.meta.url,
);
const source = await readFile(sourceUrl, "utf8");

function loadWebResource(xrm) {
  const sandbox = { Xrm: xrm };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: sourceUrl.pathname });
  return sandbox.DataverseAIRecordAssistant;
}

function createForm(recordId = "{7D6C63F1-5D42-4F20-BE29-0B13C766763D}") {
  let formRefreshes = 0;
  let gridRefreshes = 0;

  return {
    form: {
      data: {
        entity: { getId: () => recordId },
        getIsDirty: () => false,
        save: async () => {},
        refresh: async () => {
          formRefreshes += 1;
        },
      },
      getControl: (name) =>
        name === "AIAnalysisHistory"
          ? {
              refresh: () => {
                gridRefreshes += 1;
              },
            }
          : null,
    },
    counts: () => ({ formRefreshes, gridRefreshes }),
  };
}

test("creates the expected bound Custom API request", () => {
  const api = loadWebResource({});
  const request = api._createRequest("record-id");
  const metadata = request.getMetadata();

  assert.equal(request.entity.entityType, "lyr_trainingcourseapplication");
  assert.equal(request.entity.id, "record-id");
  assert.equal(metadata.boundParameter, "entity");
  assert.equal(metadata.operationName, "lyr_QueueAnalysis");
  assert.equal(metadata.operationType, 0);
  assert.equal(
    metadata.parameterTypes.entity.typeName,
    "mscrm.lyr_trainingcourseapplication",
  );
  assert.equal(metadata.parameterTypes.entity.structuralProperty, 5);
});

test("queues an analysis and refreshes the form and subgrid", async () => {
  let capturedRequest;
  let progressOpened = 0;
  let progressClosed = 0;
  const alerts = [];
  const fixture = createForm();
  const xrm = {
    Navigation: {
      openAlertDialog: async (alert) => alerts.push(alert),
    },
    Utility: {
      showProgressIndicator: () => {
        progressOpened += 1;
      },
      closeProgressIndicator: () => {
        progressClosed += 1;
      },
    },
    WebApi: {
      online: {
        execute: async (request) => {
          capturedRequest = request;
          return { ok: true, status: 204 };
        },
      },
    },
  };

  const api = loadWebResource(xrm);
  await api.queueAnalysis(fixture.form);

  assert.equal(
    capturedRequest.entity.id,
    "7D6C63F1-5D42-4F20-BE29-0B13C766763D",
  );
  assert.deepEqual(fixture.counts(), { formRefreshes: 1, gridRefreshes: 1 });
  assert.equal(progressOpened, 1);
  assert.equal(progressClosed, 1);
  assert.equal(alerts.at(-1).title, "AI analysis queued");
});

test("requires a saved record before invoking Dataverse", async () => {
  let executions = 0;
  const alerts = [];
  const fixture = createForm("");
  const xrm = {
    Navigation: {
      openAlertDialog: async (alert) => alerts.push(alert),
    },
    Utility: {
      showProgressIndicator: () => {},
      closeProgressIndicator: () => {},
    },
    WebApi: {
      online: {
        execute: async () => {
          executions += 1;
          return { ok: true };
        },
      },
    },
  };

  const api = loadWebResource(xrm);
  await api.queueAnalysis(fixture.form);

  assert.equal(executions, 0);
  assert.equal(alerts.at(-1).title, "Save required");
});

test("shows a bounded error without reading a provider response body", async () => {
  let responseBodyReads = 0;
  const alerts = [];
  const fixture = createForm();
  const xrm = {
    Navigation: {
      openAlertDialog: async (alert) => alerts.push(alert),
    },
    Utility: {
      showProgressIndicator: () => {},
      closeProgressIndicator: () => {},
    },
    WebApi: {
      online: {
        execute: async () => ({
          ok: false,
          status: 500,
          text: async () => {
            responseBodyReads += 1;
            return "sensitive response";
          },
        }),
      },
    },
  };

  const api = loadWebResource(xrm);
  await api.queueAnalysis(fixture.form);

  assert.equal(responseBodyReads, 0);
  assert.equal(alerts.at(-1).title, "AI analysis could not be queued");
  assert.match(alerts.at(-1).text, /HTTP 500/);
});

