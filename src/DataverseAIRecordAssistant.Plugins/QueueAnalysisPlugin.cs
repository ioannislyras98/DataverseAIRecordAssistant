using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using System;

namespace DataverseAIRecordAssistant.Plugins
{
    public class QueueAnalysisPlugin : PluginBase
    {
        private const string ApplicationTable =
            "lyr_trainingcourseapplication";

        private const string AnalysisTable =
            "lyr_aianalysis";

        private const string ApplicationLookup =
            "lyr_trainingcourseapplication";

        private const string AnalysisStatusColumn =
            "lyr_analysisstatus";

        private const string ApplicationStatusColumn =
            "lyr_applicationstatus";

        private const string CustomApiName = "lyr_QueueAnalysis";

        private const int QueuedStatusValue = 858770000;
        private const int SubmittedApplicationStatusValue = 858770001;

        public QueueAnalysisPlugin(
            string unsecureConfiguration,
            string secureConfiguration)
            : base(typeof(QueueAnalysisPlugin))
        {
        }

        protected override void ExecuteDataversePlugin(
            ILocalPluginContext localPluginContext)
        {
            if (localPluginContext == null)
            {
                throw new ArgumentNullException(
                    nameof(localPluginContext));
            }

            var context =
                localPluginContext.PluginExecutionContext;

            var tracingService =
                localPluginContext.TracingService;

            var organizationService =
                localPluginContext.OrgSvcFactory
                    .CreateOrganizationService(context.UserId);

            tracingService.Trace(
                "QueueAnalysisPlugin execution started.");

            if (!string.Equals(
                    context.MessageName,
                    CustomApiName,
                    StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidPluginExecutionException(
                    "QueueAnalysisPlugin must be registered as the " +
                    "lyr_QueueAnalysis Custom API implementation.");
            }

            if (!context.InputParameters.Contains("Target") ||
                !(context.InputParameters["Target"]
                    is EntityReference target))
            {
                throw new InvalidPluginExecutionException(
                    "A Training Course Application record is required.");
            }

            if (!string.Equals(
                    target.LogicalName,
                    ApplicationTable,
                    StringComparison.OrdinalIgnoreCase) ||
                target.Id == Guid.Empty)
            {
                throw new InvalidPluginExecutionException(
                    "The selected record is not a valid " +
                    "Training Course Application.");
            }

            tracingService.Trace(
                "Application received. ID: {0}",
                target.Id);

            Entity application = organizationService.Retrieve(
                ApplicationTable,
                target.Id,
                new ColumnSet(ApplicationStatusColumn));

            OptionSetValue applicationStatus =
                application.GetAttributeValue<OptionSetValue>(
                    ApplicationStatusColumn);

            if (applicationStatus == null ||
                applicationStatus.Value != SubmittedApplicationStatusValue)
            {
                throw new InvalidPluginExecutionException(
                    "Only submitted applications can be analyzed.");
            }

            var analysis = new Entity(AnalysisTable);

            analysis[ApplicationLookup] =
                new EntityReference(ApplicationTable, target.Id);

            analysis[AnalysisStatusColumn] =
                new OptionSetValue(QueuedStatusValue);

            Guid analysisId =
                organizationService.Create(analysis);

            tracingService.Trace(
                "AI Analysis created successfully. ID: {0}",
                analysisId);

            tracingService.Trace(
                "QueueAnalysisPlugin execution completed.");
        }
    }
}
