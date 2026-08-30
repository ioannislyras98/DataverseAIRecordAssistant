(function (global) {
  "use strict";

  var namespace = global.DataverseAIRecordAssistant || {};
  var APPLICATION_TABLE = "lyr_trainingcourseapplication";
  var CUSTOM_API_NAME = "lyr_QueueAnalysis";
  var ANALYSIS_SUBGRID_NAME = "AIAnalysisHistory";

  function normalizeId(id) {
    return (id || "").replace(/[{}]/g, "");
  }

  function createRequest(recordId) {
    return {
      entity: {
        entityType: APPLICATION_TABLE,
        id: recordId,
      },
      getMetadata: function () {
        return {
          boundParameter: "entity",
          parameterTypes: {
            entity: {
              typeName: "mscrm." + APPLICATION_TABLE,
              structuralProperty: 5,
            },
          },
          operationType: 0,
          operationName: CUSTOM_API_NAME,
        };
      },
    };
  }

  async function showAlert(title, text) {
    await Xrm.Navigation.openAlertDialog({
      title: title,
      text: text,
      confirmButtonLabel: "OK",
    });
  }

  async function queueAnalysis(primaryControl) {
    var formContext = primaryControl;

    if (!formContext || !formContext.data || !formContext.data.entity) {
      await showAlert(
        "Unable to analyze",
        "The application form context is unavailable.",
      );
      return;
    }

    var recordId = normalizeId(formContext.data.entity.getId());

    if (!recordId) {
      await showAlert(
        "Save required",
        "Save the application before requesting an AI analysis.",
      );
      return;
    }

    Xrm.Utility.showProgressIndicator("Queuing AI analysis...");

    try {
      if (
        typeof formContext.data.getIsDirty === "function" &&
        formContext.data.getIsDirty()
      ) {
        await formContext.data.save();
      }

      var response = await Xrm.WebApi.online.execute(createRequest(recordId));

      if (!response || !response.ok) {
        var status = response && response.status ? response.status : "unknown";
        throw new Error("The server returned HTTP " + status + ".");
      }

      await formContext.data.refresh(false);

      if (typeof formContext.getControl === "function") {
        var analysisGrid = formContext.getControl(ANALYSIS_SUBGRID_NAME);
        if (analysisGrid && typeof analysisGrid.refresh === "function") {
          analysisGrid.refresh();
        }
      }

      await showAlert(
        "AI analysis queued",
        "The analysis was queued successfully. Refresh the analysis history to see its progress.",
      );
    } catch (error) {
      var message =
        error && error.message
          ? error.message
          : "An unexpected error occurred while queuing the analysis.";

      await showAlert("AI analysis could not be queued", message);
    } finally {
      Xrm.Utility.closeProgressIndicator();
    }
  }

  namespace.queueAnalysis = queueAnalysis;
  namespace._createRequest = createRequest;
  global.DataverseAIRecordAssistant = namespace;
})(typeof window !== "undefined" ? window : globalThis);

