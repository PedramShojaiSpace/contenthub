import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createKlaviyoFlowEmailBackup,
  getKlaviyoFlowEmailBackup,
  listKlaviyoFlowEmailBackups,
  updateKlaviyoFlowEmailBackup,
} from "./db";
import { ENV } from "./_core/env";
import { protectedProcedure, router } from "./_core/trpc";
import { optimizeEmailHtmlPublic } from "./emailOptimizerRouter";

const KLAVIYO_BASE = "https://a.klaviyo.com/api";
const KLAVIYO_REVISION = "2026-07-15";

type KlaviyoApiResource = {
  id: string;
  type: string;
  attributes?: Record<string, unknown>;
};

type KlaviyoFlowSummary = {
  id: string;
  name: string;
  status: string;
  updatedAt: string | null;
  triggerType: string | null;
};

type KlaviyoFlowEmail = {
  flowActionId: string;
  actionName: string;
  subjectLine: string;
  templateId: string;
  templateName: string;
  editorType: string;
  html: string;
  htmlHash: string;
  originalBytes: number;
  optimizedHtml: string;
  optimizedHash: string;
  optimizedBytes: number;
  reductionPercent: number;
  changes: string[];
  warnings: string[];
  copyReview: Awaited<ReturnType<typeof optimizeEmailHtmlPublic>>["copyReview"];
  spamScore: Awaited<ReturnType<typeof optimizeEmailHtmlPublic>>["spamScore"];
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function klaviyoHeaders() {
  if (!ENV.klaviyoPrivateKey) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Klaviyo is not configured for this project.",
    });
  }
  return {
    Authorization: `Klaviyo-API-Key ${ENV.klaviyoPrivateKey}`,
    Accept: "application/vnd.api+json",
    "Content-Type": "application/vnd.api+json",
    revision: KLAVIYO_REVISION,
  };
}

async function klaviyoRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${KLAVIYO_BASE}${path}`, {
    ...init,
    headers: { ...klaviyoHeaders(), ...(init?.headers ?? {}) },
  });
  const body = await response.text();
  if (!response.ok) {
    throw new TRPCError({
      code: response.status === 401 || response.status === 403 ? "FORBIDDEN" : "BAD_GATEWAY",
      message: `Klaviyo API request failed (${response.status}): ${body.slice(0, 400) || "No response body"}`,
    });
  }
  return body ? (JSON.parse(body) as T) : ({} as T);
}

function stringAttribute(attributes: Record<string, unknown> | undefined, key: string): string {
  return typeof attributes?.[key] === "string" ? attributes[key] : "";
}

async function getTemplate(templateId: string) {
  const response = await klaviyoRequest<{ data: KlaviyoApiResource }>(
    `/templates/${encodeURIComponent(templateId)}/?additional-fields%5Btemplate%5D=definition`
  );
  const attributes = response.data.attributes ?? {};
  return {
    id: response.data.id,
    name: stringAttribute(attributes, "name") || "Untitled Klaviyo template",
    editorType: stringAttribute(attributes, "editor_type") || "UNKNOWN",
    html: stringAttribute(attributes, "html"),
  };
}

export function getMessageFromFlowAction(action: KlaviyoApiResource) {
  const attributes = action.attributes ?? {};
  const definition = (attributes.definition ?? {}) as Record<string, unknown>;
  const data = (definition.data ?? {}) as Record<string, unknown>;
  const nestedAction = (data.main_action ?? {}) as Record<string, unknown>;
  const nestedData = (nestedAction.data ?? {}) as Record<string, unknown>;
  const message = (data.message ?? nestedData.message ?? {}) as Record<string, unknown>;
  const actionType = stringAttribute(definition, "type") || stringAttribute(attributes, "action_type");

  return {
    isEmail: actionType === "send-email" && typeof message.template_id === "string",
    actionName: stringAttribute(message, "name") || stringAttribute(data, "name") || "Klaviyo email",
    subjectLine: stringAttribute(message, "subject_line"),
    templateId: stringAttribute(message, "template_id"),
  };
}

async function loadFlowSummary(flowId: string): Promise<KlaviyoFlowSummary> {
  const response = await klaviyoRequest<{ data: KlaviyoApiResource }>(`/flows/${encodeURIComponent(flowId)}/`);
  const attributes = response.data.attributes ?? {};
  return {
    id: response.data.id,
    name: stringAttribute(attributes, "name") || "Untitled Klaviyo flow",
    status: stringAttribute(attributes, "status") || "unknown",
    updatedAt: stringAttribute(attributes, "updated") || null,
    triggerType: stringAttribute(attributes, "trigger_type") || null,
  };
}

async function loadOptimizedFlow(flowId: string) {
  const flow = await loadFlowSummary(flowId);
  const actionResponse = await klaviyoRequest<{ data: KlaviyoApiResource[] }>(
    `/flows/${encodeURIComponent(flowId)}/flow-actions/?page%5Bsize%5D=50`
  );
  const candidates = actionResponse.data
    .map((action) => ({ action, message: getMessageFromFlowAction(action) }))
    .filter(({ message }) => message.isEmail && message.templateId);

  const messages = await Promise.all(
    candidates.map(async ({ action, message }) => {
      const template = await getTemplate(message.templateId);
      if (!template.html) return null;
      const optimized = await optimizeEmailHtmlPublic(template.html);
      return {
        flowActionId: action.id,
        actionName: message.actionName,
        subjectLine: message.subjectLine,
        templateId: template.id,
        templateName: template.name,
        editorType: template.editorType,
        html: template.html,
        htmlHash: sha256(template.html),
        originalBytes: optimized.originalBytes,
        optimizedHtml: optimized.optimizedHtml,
        optimizedHash: sha256(optimized.optimizedHtml),
        optimizedBytes: optimized.optimizedBytes,
        reductionPercent: optimized.reductionPercent,
        changes: optimized.changes,
        warnings: optimized.warnings,
        copyReview: optimized.copyReview,
        spamScore: optimized.spamScore,
      } satisfies KlaviyoFlowEmail;
    })
  );

  return { flow, messages: messages.filter((message): message is KlaviyoFlowEmail => Boolean(message)) };
}

async function updateTemplateHtml(templateId: string, html: string) {
  await klaviyoRequest(`/templates/${encodeURIComponent(templateId)}/`, {
    method: "PATCH",
    body: JSON.stringify({
      data: {
        type: "template",
        id: templateId,
        attributes: { html },
      },
    }),
  });
}

export const klaviyoFlowOptimizerRouter = router({
  listFlows: protectedProcedure.query(async () => {
    const response = await klaviyoRequest<{ data: KlaviyoApiResource[] }>("/flows/?page%5Bsize%5D=50");
    return response.data
      .map((flow) => {
        const attributes = flow.attributes ?? {};
        return {
          id: flow.id,
          name: stringAttribute(attributes, "name"),
          status: stringAttribute(attributes, "status"),
          updatedAt: stringAttribute(attributes, "updated") || null,
          triggerType: stringAttribute(attributes, "trigger_type") || null,
          archived: Boolean(attributes.archived),
        } satisfies KlaviyoFlowSummary & { archived: boolean };
      })
      .filter((flow) => !flow.archived)
      .sort((a, b) => a.name.localeCompare(b.name));
  }),

  inspectFlow: protectedProcedure
    .input(z.object({ flowId: z.string().min(1).max(64) }))
    .query(async ({ input }) => loadOptimizedFlow(input.flowId)),

  listBackups: protectedProcedure.query(async () => {
    const backups = await listKlaviyoFlowEmailBackups(50);
    return backups.map(({ originalHtml: _originalHtml, optimizedHtml: _optimizedHtml, ...backup }) => backup);
  }),

  applyOptimization: protectedProcedure
    .input(
      z.object({
        flowId: z.string().min(1).max(64),
        flowActionId: z.string().min(1).max(64),
        expectedOriginalHash: z.string().length(64),
        confirm: z.literal(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { flow, messages } = await loadOptimizedFlow(input.flowId);
      const message = messages.find((item) => item.flowActionId === input.flowActionId);
      if (!message) {
        throw new TRPCError({ code: "NOT_FOUND", message: "This Klaviyo email action was not found in the selected flow." });
      }
      if (message.htmlHash !== input.expectedOriginalHash) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "The Klaviyo email changed after it was loaded. Reload the flow and review the current version before applying anything.",
        });
      }
      if (message.html === message.optimizedHtml) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This email has no HTML cleanup changes to apply." });
      }

      const backup = await createKlaviyoFlowEmailBackup({
        flowId: flow.id,
        flowName: flow.name,
        flowActionId: message.flowActionId,
        templateId: message.templateId,
        templateName: message.templateName,
        subjectLine: message.subjectLine || null,
        originalHtml: message.html,
        optimizedHtml: message.optimizedHtml,
        originalHash: message.htmlHash,
        optimizedHash: message.optimizedHash,
        operation: "apply",
        status: "created",
        appliedByOpenId: ctx.user.openId,
      });

      try {
        await updateTemplateHtml(message.templateId, message.optimizedHtml);
        await updateKlaviyoFlowEmailBackup(backup.id, { status: "applied", appliedAt: new Date() });
        return { backupId: backup.id, templateName: message.templateName };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown Klaviyo template update failure";
        await updateKlaviyoFlowEmailBackup(backup.id, { status: "failed", errorMessage });
        throw error;
      }
    }),

  restoreBackup: protectedProcedure
    .input(z.object({ backupId: z.number().int().positive(), confirm: z.literal(true) }))
    .mutation(async ({ input, ctx }) => {
      const backup = await getKlaviyoFlowEmailBackup(input.backupId);
      if (!backup) throw new TRPCError({ code: "NOT_FOUND", message: "Klaviyo backup not found." });

      const current = await getTemplate(backup.templateId);
      const restoreSnapshot = await createKlaviyoFlowEmailBackup({
        flowId: backup.flowId,
        flowName: backup.flowName,
        flowActionId: backup.flowActionId,
        templateId: backup.templateId,
        templateName: backup.templateName,
        subjectLine: backup.subjectLine,
        originalHtml: current.html,
        optimizedHtml: backup.originalHtml,
        originalHash: sha256(current.html),
        optimizedHash: sha256(backup.originalHtml),
        operation: "restore",
        status: "created",
        appliedByOpenId: ctx.user.openId,
      });

      try {
        await updateTemplateHtml(backup.templateId, backup.originalHtml);
        await updateKlaviyoFlowEmailBackup(restoreSnapshot.id, { status: "restored", appliedAt: new Date() });
        return { restoredBackupId: backup.id, restoreSnapshotId: restoreSnapshot.id };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown Klaviyo template restore failure";
        await updateKlaviyoFlowEmailBackup(restoreSnapshot.id, { status: "failed", errorMessage });
        throw error;
      }
    }),
});
