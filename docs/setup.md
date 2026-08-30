# Dataverse setup

This guide documents the environment components expected by the source code. It is intentionally manual because the repository does not yet contain an unpacked Dataverse solution.

## 1. Prerequisites

- A Power Platform environment with Dataverse
- Permissions to create tables, Custom APIs, web resources, model-driven apps, and plug-in steps
- Visual Studio 2022 or a current .NET SDK capable of building .NET Framework 4.6.2
- The Power Platform Plug-in Registration Tool
- A Cloudflare account with Workers AI access, an Account ID, and a scoped Workers AI API token

Use fictional or non-production data until privacy, retention, regional processing, and organizational AI-governance requirements have been approved.

## 2. Dataverse data model

Create these tables with the `lyr_` publisher prefix. The data types below are the types expected by the plug-ins.

### Training Course Application (`lyr_trainingcourseapplication`)

| Logical name | Suggested type | Required by processing |
| --- | --- | --- |
| `lyr_applicationnumber` | Autonumber or Text | No; not sent to the AI provider |
| `lyr_applicantname` | Text | No; not sent to the AI provider |
| `lyr_applicantemail` | Email | No; not sent to the AI provider |
| `lyr_trainingcourse` | Text | Yes |
| `lyr_trainingcentre` | Text | No |
| `lyr_yearsofexperience` | Whole Number | No |
| `lyr_qualifications` | Multiline Text | No |
| `lyr_applicationdetails` | Multiline Text | Yes |
| `lyr_applicationstatus` | Choice | Yes |
| `lyr_submittedon` | Date and Time | No |

### AI Analysis (`lyr_aianalysis`)

| Logical name | Suggested type |
| --- | --- |
| `lyr_analysisnumber` | Autonumber or Text (primary name) |
| `lyr_trainingcourseapplication` | Lookup to Training Course Application |
| `lyr_analysisstatus` | Choice |
| `lyr_inputsnapshot` | Multiline Text |
| `lyr_errormessage` | Multiline Text |
| `lyr_aisummary` | Multiline Text |
| `lyr_suggesteddecision` | Choice |
| `lyr_confidencescore` | Decimal Number, precision 2, range 0–100 |
| `lyr_risklevel` | Choice |
| `lyr_missinginformation` | Multiline Text |
| `lyr_decisionreason` | Multiline Text |
| `lyr_analyzedon` | Date and Time |

Create a one-to-many relationship from Training Course Application to AI Analysis using the lookup `lyr_trainingcourseapplication`.

Use these Choice values because the code maps the numeric values directly:

| Choice | Label | Value |
| --- | --- | ---: |
| Analysis Status | Queued | 858770000 |
| Analysis Status | Processing | 858770001 |
| Analysis Status | Completed | 858770002 |
| Analysis Status | Failed | 858770003 |
| Application Status | Submitted | 858770001 |
| Suggested Decision | Approve | 858770000 |
| Suggested Decision | Request corrections | 858770001 |
| Suggested Decision | Manual review | 858770002 |
| Suggested Decision | Reject | 858770003 |
| Risk Level | Low | 858770000 |
| Risk Level | Medium | 858770001 |
| Risk Level | High | 858770002 |

## 3. Build and register the plug-ins

Generate or obtain a protected strong-name key outside the repository, then build the assembly:

```powershell
dotnet restore DataverseAIRecordAssistant.sln --locked-mode
dotnet build DataverseAIRecordAssistant.sln --configuration Release --no-restore -p:SignAssembly=true -p:AssemblyOriginatorKeyFile=C:\secure\DataverseAIRecordAssistant.Plugins.snk
```

Register the resulting `DataverseAIRecordAssistant.Plugins.dll` with the Plug-in Registration Tool.

Create the processing step with these settings:

| Setting | Value |
| --- | --- |
| Plug-in type | `DataverseAIRecordAssistant.Plugins.ProcessAnalysisPlugin` |
| Message | `Create` |
| Primary table | `lyr_aianalysis` |
| Event pipeline stage | PostOperation |
| Execution mode | Asynchronous |

Add the Cloudflare values to the step's **Secure Configuration**:

```text
AccountId=<CLOUDFLARE_ACCOUNT_ID>;ApiToken=<CLOUDFLARE_API_TOKEN>;Model=@cf/meta/llama-3.1-8b-instruct-fast
```

The selected model must support Workers AI JSON Mode. Do not place these values in unsecure configuration, environment variables exposed to the browser, or source control.

## 4. Create the bound Custom API

Create a Custom API with these core settings:

| Setting | Value |
| --- | --- |
| Unique name | `lyr_QueueAnalysis` |
| Binding type | Entity |
| Bound entity logical name | `lyr_trainingcourseapplication` |
| Is Function | No |
| Allowed custom processing step type | None |
| Plug-in type | `DataverseAIRecordAssistant.Plugins.QueueAnalysisPlugin` |

The API uses the standard bound `Target` entity reference and does not require custom request or response properties.

## 5. Add the command-bar web resources

Upload these files as web resources:

- `src/DataverseAIRecordAssistant.WebResources/queueAnalysis.js`
- `src/DataverseAIRecordAssistant.WebResources/ai-sparkle.svg`

Add a command to the Training Course Application main form and configure it as follows:

| Setting | Value |
| --- | --- |
| Label | Analyze with AI |
| JavaScript function | `DataverseAIRecordAssistant.queueAnalysis` |
| Parameter | `PrimaryControl` |
| Icon | `ai-sparkle.svg` web resource |

The JavaScript saves pending form changes, invokes `lyr_QueueAnalysis`, refreshes the form, and attempts to refresh a subgrid named `AIAnalysisHistory`. If the form uses another control name, update `ANALYSIS_SUBGRID_NAME` in `queueAnalysis.js`.

## 6. Verify the workflow

1. Create a fictional Training Course Application and save it.
2. Select **Analyze with AI**.
3. Confirm that a related AI Analysis row is created with status `Queued`.
4. Confirm that the asynchronous step changes the status to `Processing` and then `Completed` or `Failed`.
5. Verify the snapshot and mapped result fields.
6. Confirm that the application decision itself was not changed.
7. Review the Dataverse plug-in trace log if processing fails.
